import type { Instrument, Product, Side } from '../api/types';

// Simplified margin model, documented in docs/03-prd-smart-order-pad.md.
// Real brokers use exchange SPAN + exposure files; these rates are approximations
// that keep the simulator's behaviour realistic.
export const MARGIN_RATES = {
  EQ_CNC: 1, // full value for delivery
  EQ_MIS: 0.2, // 5x intraday leverage
  FUT_NRML: 0.12, // ~SPAN + exposure
  FUT_MIS: 0.06,
  OPT_SELL_NRML: 0.12, // of underlying notional
  OPT_SELL_MIS: 0.06,
};

export interface MarginInput {
  instrument: Instrument;
  product: Product;
  side: Side;
  qty: number;
  price: number;
  underlyingPrice?: number;
}

export function requiredMargin({ instrument, product, side, qty, price, underlyingPrice }: MarginInput): number {
  const value = qty * price;
  switch (instrument.segment) {
    case 'EQ':
      if (product === 'CNC') return side === 'BUY' ? value * MARGIN_RATES.EQ_CNC : 0;
      return value * MARGIN_RATES.EQ_MIS;
    case 'FUT':
      return value * (product === 'MIS' ? MARGIN_RATES.FUT_MIS : MARGIN_RATES.FUT_NRML);
    case 'OPT': {
      if (side === 'BUY') return value; // premium paid upfront
      const notional = qty * (underlyingPrice ?? price);
      return notional * (product === 'MIS' ? MARGIN_RATES.OPT_SELL_MIS : MARGIN_RATES.OPT_SELL_NRML);
    }
    default:
      return 0;
  }
}

export interface ChargeBreakup {
  brokerage: number;
  stt: number;
  exchange: number;
  gst: number;
  stamp: number;
  total: number;
}

/** Approximate statutory charges for one order leg. */
export function estimateCharges(instrument: Instrument, product: Product, side: Side, qty: number, price: number): ChargeBreakup {
  const value = qty * price;
  const brokerage = product === 'CNC' ? 0 : Math.min(20, value * 0.0003);
  let stt = 0;
  if (instrument.segment === 'EQ') stt = product === 'CNC' ? value * 0.001 : side === 'SELL' ? value * 0.00025 : 0;
  if (instrument.segment === 'FUT') stt = side === 'SELL' ? value * 0.0002 : 0;
  if (instrument.segment === 'OPT') stt = side === 'SELL' ? value * 0.001 : 0;
  const exchange = value * (instrument.segment === 'OPT' ? 0.0003503 : instrument.segment === 'FUT' ? 0.0000173 : 0.0000297);
  const gst = (brokerage + exchange) * 0.18;
  const stamp = side === 'BUY' ? value * (product === 'CNC' ? 0.00015 : 0.00003) : 0;
  const total = brokerage + stt + exchange + gst + stamp;
  const r = (n: number) => Math.round(n * 100) / 100;
  return { brokerage: r(brokerage), stt: r(stt), exchange: r(exchange), gst: r(gst), stamp: r(stamp), total: r(total) };
}
