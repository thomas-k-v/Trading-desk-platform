import { useMemo } from 'react';
import { useMarket } from '../store/market';
import { computeFunds, useTrading } from '../store/trading';
import { valueHoldings } from '../engine/pnl';

export const useQuote = (symbol: string) => useMarket((s) => s.quotes[symbol]);

export function useFunds() {
  const quotes = useMarket((s) => s.quotes);
  const ledger = useTrading((s) => s.ledger);
  const trades = useTrading((s) => s.trades);
  const orders = useTrading((s) => s.orders);
  return useMemo(() => computeFunds({ ledger, trades, orders }, quotes), [ledger, trades, orders, quotes]);
}

export function useHoldings() {
  const quotes = useMarket((s) => s.quotes);
  const holdings = useTrading((s) => s.holdings);
  return useMemo(() => valueHoldings(holdings, quotes), [holdings, quotes]);
}
