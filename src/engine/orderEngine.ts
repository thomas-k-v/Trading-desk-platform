import type { Order, Quote } from '../api/types';

export interface FillResult {
  order: Order;
  fill?: { qty: number; price: number };
}

/** Quantity the simulated book can absorb in a single tick. */
export const LIQUIDITY_PER_TICK = 2000;

/**
 * Match one working order against the latest quote. Pure: returns the updated
 * order and the fill (if any) without touching global state.
 */
export function matchOrder(order: Order, quote: Quote, now = Date.now()): FillResult {
  if (!['OPEN', 'TRIGGER_PENDING', 'PARTIAL'].includes(order.status)) return { order };
  const buy = order.side === 'BUY';
  let working = order;

  if (order.status === 'TRIGGER_PENDING') {
    const trig = order.triggerPrice ?? 0;
    const triggered = buy ? quote.ltp >= trig : quote.ltp <= trig;
    if (!triggered) return { order };
    working = { ...order, status: 'OPEN', updatedAt: now };
  }

  const marketLike = working.orderType === 'MARKET' || working.orderType === 'SL-M';
  const touch = buy ? quote.ask : quote.bid;
  let fillPrice: number | undefined;
  if (marketLike) fillPrice = touch;
  else if (buy && touch <= (working.price ?? 0)) fillPrice = touch;
  else if (!buy && touch >= (working.price ?? Infinity)) fillPrice = touch;

  if (fillPrice === undefined) return { order: working };

  const remaining = working.qty - working.filledQty;
  const qty = Math.min(remaining, LIQUIDITY_PER_TICK);
  const filledQty = working.filledQty + qty;
  const avgPrice = (working.avgPrice * working.filledQty + fillPrice * qty) / filledQty;
  return {
    order: {
      ...working,
      filledQty,
      avgPrice,
      status: filledQty >= working.qty ? 'COMPLETE' : 'PARTIAL',
      updatedAt: now,
    },
    fill: { qty, price: fillPrice },
  };
}

export const initialStatus = (orderType: Order['orderType']): Order['status'] =>
  orderType === 'SL' || orderType === 'SL-M' ? 'TRIGGER_PENDING' : 'OPEN';

export const isWorking = (o: Order) => ['OPEN', 'TRIGGER_PENDING', 'PARTIAL', 'AMO_PENDING'].includes(o.status);
