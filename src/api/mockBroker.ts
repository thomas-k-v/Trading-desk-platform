// Mock broker API. Every UI write goes through these functions so the client
// talks to a REST-shaped contract (see docs/08-api-spec.md) — swapping this file
// for real HTTP calls would not change any screen.

import type {
  ApiResponse, Holding, LedgerEntry, Order, OrderDraft, Position, PriceAlert, Sip, Trade,
} from './types';
import { getInstrument, MF_MAP } from '../market/instruments';
import { useMarket } from '../store/market';
import { computeFunds, mfNav, useTrading, type FundsSummary } from '../store/trading';
import { firstFailure, runPreTradeChecks } from '../engine/riskChecks';
import { initialStatus, isWorking, matchOrder } from '../engine/orderEngine';
import { estimateCharges } from '../engine/margin';
import { applyDeliveryTrade } from '../engine/pnl';
import { track } from '../analytics/track';

const latency = () => new Promise((r) => setTimeout(r, 120 + Math.random() * 230));
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
const ok = <T>(data: T): ApiResponse<T> => ({ status: 'success', data });

export function getFunds(): FundsSummary {
  return computeFunds(useTrading.getState(), useMarket.getState().quotes);
}

/** Build the risk-check context the RMS (and the Smart Order Pad) evaluates. */
export function checkContext(draft: OrderDraft, excludeOrderId?: string) {
  const { quotes, marketOpen } = useMarket.getState();
  const state = useTrading.getState();
  const instrument = getInstrument(draft.symbol);
  const funds = computeFunds(
    excludeOrderId ? { ...state, orders: state.orders.filter((o) => o.id !== excludeOrderId) } : state,
    quotes,
  );
  // Shares already committed to other open delivery-sell orders are not available.
  const pendingSell = state.orders
    .filter((o) => o.id !== excludeOrderId && isWorking(o) && o.symbol === draft.symbol && o.product === 'CNC' && o.side === 'SELL')
    .reduce((a, o) => a + o.qty - o.filledQty, 0);
  return {
    draft,
    instrument,
    quote: quotes[draft.symbol],
    underlyingPrice: instrument.underlying ? quotes[instrument.underlying]?.ltp : undefined,
    availableMargin: Math.max(0, funds.available),
    holdingQty: Math.max(0, (state.holdings.find((h) => h.symbol === draft.symbol)?.qty ?? 0) - pendingSell),
    positionQty: funds.positions.find((p) => p.symbol === draft.symbol && p.product === draft.product)?.netQty ?? 0,
    marketOpen,
  };
}

/** POST /orders */
export async function placeOrder(draft: OrderDraft, source: Order['source']): Promise<ApiResponse<Order>> {
  await latency();
  const checks = runPreTradeChecks(checkContext(draft));
  const fail = firstFailure(checks);
  const t = Date.now();
  const order: Order = {
    ...draft,
    id: uid('O'),
    status: fail ? 'REJECTED' : draft.variety === 'AMO' && !useMarket.getState().marketOpen ? 'AMO_PENDING' : initialStatus(draft.orderType),
    filledQty: 0,
    avgPrice: 0,
    source,
    createdAt: t,
    updatedAt: t,
    ...(fail ? { rejectionCode: fail.code, rejectionRaw: fail.raw, rejectionReason: fail.message } : {}),
  };
  useTrading.setState((s) => ({ orders: [order, ...s.orders] }));
  const props = { order_id: order.id, symbol: draft.symbol, side: draft.side, order_type: draft.orderType, product: draft.product, qty: draft.qty, source };
  if (fail) {
    track('order_rejected', { ...props, reason: fail.code });
    return { status: 'error', error: { code: fail.code!, message: fail.raw ?? fail.message } };
  }
  track('order_placed', props);
  runMatching(); // market orders fill straight away
  return ok(useTrading.getState().orders.find((o) => o.id === order.id)!);
}

/** PUT /orders/:id */
export async function modifyOrder(id: string, changes: Partial<Pick<OrderDraft, 'qty' | 'price' | 'triggerPrice' | 'orderType'>>): Promise<ApiResponse<Order>> {
  await latency();
  const existing = useTrading.getState().orders.find((o) => o.id === id);
  if (!existing) return { status: 'error', error: { code: 'NOT_FOUND', message: 'Order not found' } };
  if (!isWorking(existing)) return { status: 'error', error: { code: 'INVALID_STATE', message: `Order is ${existing.status}` } };
  const draft = { ...existing, ...changes };
  const fail = firstFailure(runPreTradeChecks(checkContext({ ...draft, qty: draft.qty - draft.filledQty }, id)));
  if (fail) return { status: 'error', error: { code: fail.code!, message: fail.message } };
  const updated: Order = { ...draft, status: existing.status === 'AMO_PENDING' ? 'AMO_PENDING' : existing.filledQty ? 'PARTIAL' : initialStatus(draft.orderType), updatedAt: Date.now() };
  useTrading.setState((s) => ({ orders: s.orders.map((o) => (o.id === id ? updated : o)) }));
  track('order_modified', { order_id: id, ...changes });
  runMatching();
  return ok(updated);
}

/** DELETE /orders/:id */
export async function cancelOrder(id: string): Promise<ApiResponse<Order>> {
  await latency();
  const existing = useTrading.getState().orders.find((o) => o.id === id);
  if (!existing) return { status: 'error', error: { code: 'NOT_FOUND', message: 'Order not found' } };
  if (!isWorking(existing)) return { status: 'error', error: { code: 'INVALID_STATE', message: `Order is ${existing.status}` } };
  const updated: Order = { ...existing, status: 'CANCELLED', updatedAt: Date.now() };
  useTrading.setState((s) => ({ orders: s.orders.map((o) => (o.id === id ? updated : o)) }));
  track('order_cancelled', { order_id: id, symbol: existing.symbol });
  return ok(updated);
}

/** POST /positions/square-off */
export async function squareOff(position: Position): Promise<ApiResponse<Order>> {
  const res = await placeOrder(
    { symbol: position.symbol, side: position.netQty > 0 ? 'SELL' : 'BUY', qty: Math.abs(position.netQty), orderType: 'MARKET', product: position.product, variety: 'REGULAR' },
    'smart',
  );
  if (res.status === 'success') track('position_squared_off', { symbol: position.symbol, qty: position.netQty, pnl: Math.round(position.pnl) });
  return res;
}

/** POST /funds/payin  and  POST /funds/payout */
export async function addFunds(amount: number, method: 'UPI' | 'NETBANKING'): Promise<ApiResponse<LedgerEntry>> {
  await latency();
  const entry: LedgerEntry = { id: uid('L'), time: Date.now(), type: 'PAYIN', amount, narration: `Funds added via ${method} (simulated)` };
  useTrading.setState((s) => ({ ledger: [...s.ledger, entry] }));
  track('funds_added', { amount, method });
  return ok(entry);
}

export async function withdrawFunds(amount: number): Promise<ApiResponse<LedgerEntry>> {
  await latency();
  const available = getFunds().available;
  if (amount > available) return { status: 'error', error: { code: 'INSUFFICIENT_MARGIN', message: `Only ₹${available.toFixed(2)} is withdrawable` } };
  const entry: LedgerEntry = { id: uid('L'), time: Date.now(), type: 'PAYOUT', amount: -amount, narration: 'Withdrawal to primary bank (simulated)' };
  useTrading.setState((s) => ({ ledger: [...s.ledger, entry] }));
  track('funds_withdrawn', { amount });
  return ok(entry);
}

/** POST /mf/orders */
export async function investLumpsum(code: string, amount: number): Promise<ApiResponse<{ units: number }>> {
  await latency();
  if (amount > getFunds().available) return { status: 'error', error: { code: 'INSUFFICIENT_MARGIN', message: 'Not enough funds' } };
  const nav = mfNav(code, useMarket.getState().quotes);
  const units = amount / nav;
  useTrading.setState((s) => {
    const existing = s.mfHoldings.find((h) => h.code === code);
    return {
      mfHoldings: existing
        ? s.mfHoldings.map((h) => (h.code === code ? { ...h, units: h.units + units, invested: h.invested + amount } : h))
        : [...s.mfHoldings, { code, units, invested: amount }],
      ledger: [...s.ledger, { id: uid('L'), time: Date.now(), type: 'MF_PURCHASE', amount: -amount, narration: `Lumpsum: ${MF_MAP[code].name}` }],
    };
  });
  track('mf_lumpsum_invested', { fund: code, amount });
  return ok({ units });
}

/** POST /mf/sips */
export async function startSip(code: string, amount: number, dayOfMonth: number): Promise<ApiResponse<Sip>> {
  await latency();
  const sip: Sip = { id: uid('S'), code, amount, dayOfMonth, createdAt: Date.now(), active: true };
  useTrading.setState((s) => ({ sips: [...s.sips, sip] }));
  track('mf_sip_started', { fund: code, amount, day: dayOfMonth });
  return ok(sip);
}

export async function toggleSip(id: string): Promise<ApiResponse<Sip>> {
  await latency();
  useTrading.setState((s) => ({ sips: s.sips.map((x) => (x.id === id ? { ...x, active: !x.active } : x)) }));
  return ok(useTrading.getState().sips.find((x) => x.id === id)!);
}

/** POST /alerts */
export async function createAlert(a: Omit<PriceAlert, 'id' | 'status' | 'createdAt'>): Promise<ApiResponse<PriceAlert>> {
  await latency();
  const alert: PriceAlert = { ...a, id: uid('A'), status: 'ACTIVE', createdAt: Date.now() };
  useTrading.setState((s) => ({ alerts: [alert, ...s.alerts] }));
  track('alert_created', { symbol: a.symbol, condition: a.condition, price: a.price, whatsapp: a.channels.whatsapp });
  return ok(alert);
}

export async function deleteAlert(id: string): Promise<ApiResponse<null>> {
  useTrading.setState((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) }));
  return ok(null);
}

export type FillListener = (o: Order, t: Trade) => void;
export type AlertListener = (a: PriceAlert) => void;
const fillListeners = new Set<FillListener>();
const alertListeners = new Set<AlertListener>();
export const onFill = (fn: FillListener) => (fillListeners.add(fn), () => fillListeners.delete(fn));
export const onAlert = (fn: AlertListener) => (alertListeners.add(fn), () => alertListeners.delete(fn));

/** Exchange simulator: match working orders and evaluate alerts against latest quotes. */
export function runMatching() {
  const { quotes, marketOpen } = useMarket.getState();
  if (!marketOpen) return;
  const state = useTrading.getState();
  let { holdings, ledger, trades } = state;
  const fills: [Order, Trade][] = [];
  const orders = state.orders.map((o) => {
    if (o.status === 'AMO_PENDING') o = { ...o, status: initialStatus(o.orderType), updatedAt: Date.now() };
    if (!isWorking(o)) return o;
    const q = quotes[o.symbol];
    if (!q) return o;
    const { order, fill } = matchOrder(o, q);
    if (!fill) return order;
    const inst = getInstrument(o.symbol);
    const charges = estimateCharges(inst, o.product, o.side, fill.qty, fill.price).total;
    const trade: Trade = { id: uid('T'), orderId: o.id, symbol: o.symbol, side: o.side, qty: fill.qty, price: fill.price, product: o.product, time: Date.now(), charges };
    trades = [...trades, trade];
    const value = fill.qty * fill.price;
    ledger = [...ledger, { id: uid('L'), time: trade.time, type: 'CHARGES', amount: -charges, narration: `Charges: ${o.side} ${fill.qty} ${o.symbol}` }];
    if (o.product === 'CNC') {
      const r = applyDeliveryTrade(holdings as Holding[], trade);
      holdings = r.holdings;
      ledger = [...ledger, {
        id: uid('L'), time: trade.time, type: o.side === 'BUY' ? 'DELIVERY_BUY' : 'DELIVERY_SELL',
        amount: o.side === 'BUY' ? -value : value, narration: `${o.side} ${fill.qty} ${o.symbol} @ ${fill.price.toFixed(2)}`,
      }];
    }
    fills.push([order, trade]);
    return order;
  });

  let alerts = state.alerts;
  const fired: PriceAlert[] = [];
  alerts = alerts.map((a) => {
    if (a.status !== 'ACTIVE') return a;
    const q = quotes[a.symbol];
    if (!q) return a;
    const hit = a.condition === 'ABOVE' ? q.ltp >= a.price : q.ltp <= a.price;
    if (!hit) return a;
    const done: PriceAlert = { ...a, status: 'TRIGGERED', triggeredAt: Date.now(), triggeredPrice: q.ltp };
    fired.push(done);
    return done;
  });

  const changed = fills.length || fired.length || orders.some((o, i) => o !== state.orders[i]);
  if (!changed) return;
  useTrading.setState({ orders, trades, holdings, ledger, alerts });
  for (const [o, t] of fills) {
    if (o.status === 'COMPLETE') track('order_executed', { order_id: o.id, symbol: o.symbol, avg_price: +o.avgPrice.toFixed(2), latency_ms: o.updatedAt - o.createdAt, source: o.source });
    fillListeners.forEach((fn) => fn(o, t));
  }
  for (const a of fired) {
    track('alert_triggered', { symbol: a.symbol, price: a.triggeredPrice, whatsapp: a.channels.whatsapp });
    alertListeners.forEach((fn) => fn(a));
  }
}
