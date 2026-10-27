import type { Holding, Position, Product, Quote, Trade } from '../api/types';

/**
 * Net positions per symbol+product from the day's trades.
 * P&L = (sell value − buy value) + net qty × LTP — the standard broker day-position formula.
 */
export function computePositions(trades: Trade[], quotes: Record<string, Quote>): Position[] {
  const groups = new Map<string, Trade[]>();
  for (const t of trades) {
    if (t.product === 'CNC') continue; // delivery trades flow into holdings
    const key = `${t.symbol}|${t.product}`;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }
  const out: Position[] = [];
  for (const [key, list] of groups) {
    const [symbol, product] = key.split('|') as [string, Product];
    let buyQty = 0, sellQty = 0, buyVal = 0, sellVal = 0;
    for (const t of list) {
      if (t.side === 'BUY') { buyQty += t.qty; buyVal += t.qty * t.price; }
      else { sellQty += t.qty; sellVal += t.qty * t.price; }
    }
    const netQty = buyQty - sellQty;
    const ltp = quotes[symbol]?.ltp ?? 0;
    const buyAvg = buyQty ? buyVal / buyQty : 0;
    const sellAvg = sellQty ? sellVal / sellQty : 0;
    const pnl = sellVal - buyVal + netQty * ltp;
    const matched = Math.min(buyQty, sellQty);
    const realized = matched ? matched * (sellAvg - buyAvg) : 0;
    out.push({
      symbol,
      product,
      netQty,
      buyQty,
      sellQty,
      buyAvg,
      sellAvg,
      ltp,
      pnl,
      realized,
      unrealized: pnl - realized,
      avgPrice: netQty > 0 ? buyAvg : netQty < 0 ? sellAvg : 0,
    });
  }
  return out;
}

export interface HoldingView extends Holding {
  ltp: number;
  invested: number;
  current: number;
  pnl: number;
  pnlPct: number;
  dayChange: number;
  dayChangePct: number;
}

export function valueHoldings(holdings: Holding[], quotes: Record<string, Quote>): HoldingView[] {
  return holdings
    .filter((h) => h.qty > 0)
    .map((h) => {
      const q = quotes[h.symbol];
      const ltp = q?.ltp ?? h.avgPrice;
      const invested = h.qty * h.avgPrice;
      const current = h.qty * ltp;
      const dayChange = q ? h.qty * (ltp - q.prevClose) : 0;
      return {
        ...h,
        ltp,
        invested,
        current,
        pnl: current - invested,
        pnlPct: invested ? ((current - invested) / invested) * 100 : 0,
        dayChange,
        dayChangePct: q ? ((ltp - q.prevClose) / q.prevClose) * 100 : 0,
      };
    });
}

/** Apply a delivery trade to holdings; returns new holdings and realised P&L for sells. */
export function applyDeliveryTrade(holdings: Holding[], t: Trade): { holdings: Holding[]; realized: number } {
  const existing = holdings.find((h) => h.symbol === t.symbol);
  if (t.side === 'BUY') {
    if (!existing) return { holdings: [...holdings, { symbol: t.symbol, qty: t.qty, avgPrice: t.price }], realized: 0 };
    const qty = existing.qty + t.qty;
    const avgPrice = (existing.qty * existing.avgPrice + t.qty * t.price) / qty;
    return { holdings: holdings.map((h) => (h === existing ? { ...h, qty, avgPrice } : h)), realized: 0 };
  }
  if (!existing) return { holdings, realized: 0 };
  const realized = t.qty * (t.price - existing.avgPrice);
  return {
    holdings: holdings
      .map((h) => (h === existing ? { ...h, qty: h.qty - t.qty } : h))
      .filter((h) => h.qty > 0),
    realized,
  };
}
