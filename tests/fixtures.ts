import type { Instrument, Order, Quote } from '../src/api/types';

export const stock: Instrument = { symbol: 'TEST', name: 'Test Ltd', exchange: 'NSE', segment: 'EQ', lotSize: 1, tickSize: 0.05, basePrice: 100, circuitPct: 0.1, tradable: true };
export const future: Instrument = { symbol: 'NIFTY FUT', name: 'Nifty Fut', exchange: 'NFO', segment: 'FUT', lotSize: 75, tickSize: 0.1, basePrice: 25000, freezeQty: 1800, underlying: 'NIFTY 50', tradable: true };
export const option: Instrument = { symbol: 'NIFTY 25000 CE', name: 'Nifty CE', exchange: 'NFO', segment: 'OPT', lotSize: 75, tickSize: 0.05, basePrice: 0, freezeQty: 1800, underlying: 'NIFTY 50', strike: 25000, optionType: 'CE', tradable: true };

export const quote = (symbol: string, ltp: number, band = 0.1): Quote => ({
  symbol, ltp, open: ltp, high: ltp, low: ltp, prevClose: ltp, volume: 0, change: 0, changePct: 0,
  bid: ltp - 0.05, ask: ltp + 0.05, upperCircuit: +(ltp * (1 + band)).toFixed(2), lowerCircuit: +(ltp * (1 - band)).toFixed(2), updatedAt: 0,
});

export const order = (o: Partial<Order>): Order => ({
  id: 'o1', symbol: 'TEST', side: 'BUY', qty: 10, orderType: 'LIMIT', product: 'CNC', variety: 'REGULAR',
  price: 100, status: 'OPEN', filledQty: 0, avgPrice: 0, source: 'smart', createdAt: 0, updatedAt: 0, ...o,
});
