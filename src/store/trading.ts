import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Holding, LedgerEntry, MfHolding, Order, Position, PriceAlert, Quote, Sip, Trade,
} from '../api/types';
import { INSTRUMENT_MAP, MF_MAP } from '../market/instruments';
import { incrementalMargin } from '../engine/riskChecks';
import { requiredMargin } from '../engine/margin';
import { computePositions } from '../engine/pnl';
import { isWorking } from '../engine/orderEngine';

export interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
}

export interface TradingState {
  orders: Order[];
  trades: Trade[];
  holdings: Holding[];
  ledger: LedgerEntry[];
  mfHoldings: MfHolding[];
  sips: Sip[];
  alerts: PriceAlert[];
  watchlists: Watchlist[];
  activeWatchlist: string;
  reset: () => void;
}

const now = Date.now();

export const seedState = (): Omit<TradingState, 'reset'> => ({
  orders: [],
  trades: [],
  holdings: [
    { symbol: 'RELIANCE', qty: 40, avgPrice: 1281.4 },
    { symbol: 'HDFCBANK', qty: 60, avgPrice: 905.2 },
    { symbol: 'INFY', qty: 25, avgPrice: 1610.0 },
    { symbol: 'ITC', qty: 150, avgPrice: 438.7 },
    { symbol: 'TCS', qty: 8, avgPrice: 3390.5 },
    { symbol: 'SBIN', qty: 50, avgPrice: 762.3 },
  ],
  ledger: [{ id: 'l0', time: now - 86400000, type: 'OPENING', amount: 500000, narration: 'Opening balance (paper money)' }],
  mfHoldings: [
    { code: 'NIFTYIDX', units: 118.42, invested: 26000 },
    { code: 'FLEXICAP', units: 210.5, invested: 17500 },
  ],
  sips: [{ id: 's0', code: 'NIFTYIDX', amount: 2000, dayOfMonth: 5, createdAt: now - 86400000 * 300, active: true }],
  alerts: [],
  watchlists: [
    { id: 'w1', name: 'Nifty leaders', symbols: ['RELIANCE', 'HDFCBANK', 'ICICIBANK', 'TCS', 'INFY', 'SBIN', 'BHARTIARTL', 'ITC', 'LT'] },
    { id: 'w2', name: 'F&O', symbols: Object.values(INSTRUMENT_MAP).filter((i) => i.segment === 'FUT').map((i) => i.symbol) },
    { id: 'w3', name: 'Momentum', symbols: ['ETERNAL', 'SUZLON', 'IRFC', 'BAJFINANCE', 'TITAN'] },
  ],
  activeWatchlist: 'w1',
});

export const useTrading = create<TradingState>()(
  persist(
    (set) => ({
      ...seedState(),
      reset: () => set(seedState()),
    }),
    {
      name: 'tradedesk-trading',
      version: 1,
      // Weekly option symbols roll over; drop anything that no longer exists.
      merge: (persisted, current) => {
        const p = persisted as Partial<TradingState>;
        const known = (s: string) => !!INSTRUMENT_MAP[s];
        return {
          ...current,
          ...p,
          watchlists: (p.watchlists ?? current.watchlists).map((w) => ({ ...w, symbols: w.symbols.filter(known) })),
          orders: (p.orders ?? []).filter((o) => known(o.symbol)),
          trades: (p.trades ?? []).filter((t) => known(t.symbol)),
          alerts: (p.alerts ?? []).filter((a) => known(a.symbol)),
        };
      },
    },
  ),
);

export interface FundsSummary {
  ledgerBalance: number;
  payin: number;
  realized: number;
  unrealized: number;
  positionMargin: number;
  orderMargin: number;
  usedMargin: number;
  available: number;
  positions: Position[];
}

/** Funds view, recomputed from trades, positions and open orders. */
export function computeFunds(state: Pick<TradingState, 'ledger' | 'trades' | 'orders'>, quotes: Record<string, Quote>): FundsSummary {
  const ledgerBalance = state.ledger.reduce((a, l) => a + l.amount, 0);
  const payin = state.ledger.filter((l) => l.type === 'PAYIN').reduce((a, l) => a + l.amount, 0);
  const positions = computePositions(state.trades, quotes);
  let positionMargin = 0, realized = 0, unrealized = 0;
  for (const p of positions) {
    realized += p.realized;
    unrealized += p.unrealized;
    if (p.netQty === 0) continue;
    const inst = INSTRUMENT_MAP[p.symbol];
    positionMargin += requiredMargin({
      instrument: inst,
      product: p.product,
      side: p.netQty > 0 ? 'BUY' : 'SELL',
      qty: Math.abs(p.netQty),
      price: p.avgPrice,
      underlyingPrice: inst.underlying ? quotes[inst.underlying]?.ltp : undefined,
    });
  }
  let orderMargin = 0;
  for (const o of state.orders.filter(isWorking)) {
    const inst = INSTRUMENT_MAP[o.symbol];
    const q = quotes[o.symbol];
    if (!inst || !q) continue;
    const pos = positions.find((p) => p.symbol === o.symbol && p.product === o.product)?.netQty ?? 0;
    orderMargin += incrementalMargin({
      draft: { ...o, qty: o.qty - o.filledQty },
      instrument: inst,
      quote: q,
      underlyingPrice: inst.underlying ? quotes[inst.underlying]?.ltp : undefined,
      availableMargin: 0,
      holdingQty: 0,
      positionQty: pos,
      marketOpen: true,
    });
  }
  const usedMargin = positionMargin + orderMargin;
  const available = ledgerBalance + realized + Math.min(0, unrealized) - usedMargin;
  return { ledgerBalance, payin, realized, unrealized, positionMargin, orderMargin, usedMargin, available, positions };
}

export const mfNav = (code: string, quotes: Record<string, Quote>) => {
  // NAV drifts with the Nifty so MF holdings feel live.
  const f = MF_MAP[code];
  const n = quotes['NIFTY 50'];
  if (!f || !n) return f?.nav ?? 0;
  const beta = f.category.startsWith('Debt') ? 0 : f.category === 'Commodity' ? 0.1 : f.category === 'Hybrid' ? 0.5 : 1;
  return f.nav * (1 + (n.changePct / 100) * beta);
};
