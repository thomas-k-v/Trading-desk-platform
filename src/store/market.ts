import { create } from 'zustand';
import type { Quote } from '../api/types';
import { initialSeries, quotesFromSeries, stepSeries, type SeriesState } from '../market/feed';

interface MarketState {
  series: Record<string, SeriesState>;
  quotes: Record<string, Quote>;
  marketOpen: boolean;
  tick: () => void;
  setMarketOpen: (open: boolean) => void;
}

const series = initialSeries();

export const useMarket = create<MarketState>((set, get) => ({
  series,
  quotes: quotesFromSeries(series),
  // The simulator runs a session at any time of day so the demo always works;
  // the header toggle lets you close it to try After-Market Orders.
  marketOpen: true,
  tick: () => {
    if (!get().marketOpen) return;
    const next = stepSeries(get().series);
    set({ series: next, quotes: quotesFromSeries(next) });
  },
  setMarketOpen: (marketOpen) => set({ marketOpen }),
}));
