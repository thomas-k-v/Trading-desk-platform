import type { Instrument, MutualFund } from '../api/types';

// All prices, lot sizes and fund figures are illustrative for the simulator,
// not live exchange data.

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Weekly NIFTY expiry (Tuesday) shown in the option chain. On expiry day itself
 * the simulator rolls to next week so the chain has meaningful time value.
 */
export function nextWeeklyExpiry(from = new Date()): Date {
  const d = new Date(from);
  d.setHours(15, 30, 0, 0);
  const diff = (2 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Monthly expiry: last Tuesday of the month (rolls to next month once passed). */
export function monthlyExpiry(from = new Date()): Date {
  const lastTuesday = (y: number, m: number) => {
    const d = new Date(y, m + 1, 0, 15, 30);
    while (d.getDay() !== 2) d.setDate(d.getDate() - 1);
    return d;
  };
  let d = lastTuesday(from.getFullYear(), from.getMonth());
  if (d.getTime() < from.getTime()) d = lastTuesday(from.getFullYear(), from.getMonth() + 1);
  return d;
}

export const expiryLabel = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;

const eq = (
  symbol: string,
  name: string,
  basePrice: number,
  sector: string,
  circuitPct = 0.2,
): Instrument => ({
  symbol,
  name,
  exchange: 'NSE',
  segment: 'EQ',
  lotSize: 1,
  tickSize: basePrice > 100 ? 0.1 : 0.05,
  basePrice,
  sector,
  circuitPct,
  tradable: true,
});

export const EQUITIES: Instrument[] = [
  eq('RELIANCE', 'Reliance Industries', 1418.5, 'Energy'),
  eq('HDFCBANK', 'HDFC Bank', 992.4, 'Banking'),
  eq('ICICIBANK', 'ICICI Bank', 1388.2, 'Banking'),
  eq('TCS', 'Tata Consultancy Services', 3052.6, 'IT'),
  eq('INFY', 'Infosys', 1496.3, 'IT'),
  eq('SBIN', 'State Bank of India', 884.7, 'Banking'),
  eq('BHARTIARTL', 'Bharti Airtel', 2015.9, 'Telecom'),
  eq('ITC', 'ITC', 412.35, 'FMCG'),
  eq('LT', 'Larsen & Toubro', 3842.1, 'Infra'),
  eq('HINDUNILVR', 'Hindustan Unilever', 2468.0, 'FMCG'),
  eq('KOTAKBANK', 'Kotak Mahindra Bank', 2148.6, 'Banking'),
  eq('AXISBANK', 'Axis Bank', 1214.5, 'Banking'),
  eq('BAJFINANCE', 'Bajaj Finance', 1032.8, 'NBFC'),
  eq('MARUTI', 'Maruti Suzuki', 16210.0, 'Auto'),
  eq('SUNPHARMA', 'Sun Pharmaceutical', 1688.4, 'Pharma'),
  eq('TITAN', 'Titan Company', 3612.2, 'Consumer'),
  eq('ASIANPAINT', 'Asian Paints', 2452.7, 'Consumer'),
  eq('WIPRO', 'Wipro', 247.85, 'IT'),
  eq('ETERNAL', 'Eternal (Zomato)', 334.6, 'Internet'),
  eq('IRFC', 'Indian Railway Finance Corp', 128.4, 'PSU', 0.05),
  eq('SUZLON', 'Suzlon Energy', 58.6, 'Power', 0.05),
];

export const INDICES: Instrument[] = [
  { symbol: 'NIFTY 50', name: 'Nifty 50 Index', exchange: 'NSE', segment: 'INDEX', lotSize: 1, tickSize: 0.05, basePrice: 25840, tradable: false },
  { symbol: 'NIFTY BANK', name: 'Nifty Bank Index', exchange: 'NSE', segment: 'INDEX', lotSize: 1, tickSize: 0.05, basePrice: 57620, tradable: false },
  { symbol: 'SENSEX', name: 'BSE Sensex', exchange: 'BSE', segment: 'INDEX', lotSize: 1, tickSize: 0.05, basePrice: 84310, tradable: false },
];

export const NIFTY_LOT = 75;
export const BANKNIFTY_LOT = 35;
export const STRIKE_STEP = 50;
export const STRIKES_EACH_SIDE = 10;

function buildDerivatives(now = new Date()): Instrument[] {
  const fut = monthlyExpiry(now);
  const futLabel = MONTHS[fut.getMonth()];
  const futures: Instrument[] = [
    { symbol: `NIFTY ${futLabel} FUT`, name: 'Nifty 50 Futures', exchange: 'NFO', segment: 'FUT', lotSize: NIFTY_LOT, tickSize: 0.1, basePrice: 25840 * 1.004, underlying: 'NIFTY 50', expiry: fut.toISOString(), freezeQty: 1800, tradable: true },
    { symbol: `BANKNIFTY ${futLabel} FUT`, name: 'Nifty Bank Futures', exchange: 'NFO', segment: 'FUT', lotSize: BANKNIFTY_LOT, tickSize: 0.2, basePrice: 57620 * 1.004, underlying: 'NIFTY BANK', expiry: fut.toISOString(), freezeQty: 900, tradable: true },
    { symbol: `RELIANCE ${futLabel} FUT`, name: 'Reliance Futures', exchange: 'NFO', segment: 'FUT', lotSize: 500, tickSize: 0.1, basePrice: 1418.5 * 1.004, underlying: 'RELIANCE', expiry: fut.toISOString(), freezeQty: 20000, tradable: true },
  ];

  const wk = nextWeeklyExpiry(now);
  const atm = Math.round(25840 / STRIKE_STEP) * STRIKE_STEP;
  const options: Instrument[] = [];
  for (let i = -STRIKES_EACH_SIDE; i <= STRIKES_EACH_SIDE; i++) {
    const strike = atm + i * STRIKE_STEP;
    for (const optionType of ['CE', 'PE'] as const) {
      options.push({
        symbol: optionSymbol(wk, strike, optionType),
        name: `Nifty ${expiryLabel(wk)} ${strike} ${optionType}`,
        exchange: 'NFO',
        segment: 'OPT',
        lotSize: NIFTY_LOT,
        tickSize: 0.05,
        basePrice: 0,
        underlying: 'NIFTY 50',
        expiry: wk.toISOString(),
        strike,
        optionType,
        freezeQty: 1800,
        tradable: true,
      });
    }
  }
  return [...futures, ...options];
}

export function optionSymbol(expiry: Date, strike: number, type: 'CE' | 'PE') {
  return `NIFTY ${expiryLabel(expiry)} ${strike} ${type}`;
}

export const DERIVATIVES = buildDerivatives();

export const INSTRUMENTS: Instrument[] = [...INDICES, ...EQUITIES, ...DERIVATIVES];
export const INSTRUMENT_MAP: Record<string, Instrument> = Object.fromEntries(
  INSTRUMENTS.map((i) => [i.symbol, i]),
);

export const getInstrument = (symbol: string): Instrument => {
  const inst = INSTRUMENT_MAP[symbol];
  if (!inst) throw new Error(`Unknown instrument ${symbol}`);
  return inst;
};

export const MUTUAL_FUNDS: MutualFund[] = [
  { code: 'NIFTYIDX', name: 'Nifty 50 Index Fund – Direct Growth', amc: 'Alpha AMC', category: 'Index', risk: 'Very High', nav: 248.31, expenseRatio: 0.18, minSip: 100, minLumpsum: 500, cagr1y: 9.8, cagr3y: 13.6, cagr5y: 16.9, aumCr: 21450 },
  { code: 'FLEXICAP', name: 'Flexi Cap Fund – Direct Growth', amc: 'Beacon AMC', category: 'Flexi Cap', risk: 'Very High', nav: 92.47, expenseRatio: 0.64, minSip: 500, minLumpsum: 1000, cagr1y: 12.4, cagr3y: 17.2, cagr5y: 20.1, aumCr: 68210 },
  { code: 'MIDCAP', name: 'Midcap Opportunities – Direct Growth', amc: 'Crest AMC', category: 'Mid Cap', risk: 'Very High', nav: 188.92, expenseRatio: 0.71, minSip: 500, minLumpsum: 1000, cagr1y: 14.9, cagr3y: 22.8, cagr5y: 26.4, aumCr: 34120 },
  { code: 'SMALLCAP', name: 'Small Cap Fund – Direct Growth', amc: 'Delta AMC', category: 'Small Cap', risk: 'Very High', nav: 151.06, expenseRatio: 0.66, minSip: 500, minLumpsum: 1000, cagr1y: 11.2, cagr3y: 24.1, cagr5y: 29.7, aumCr: 29880 },
  { code: 'ELSS', name: 'Tax Saver (ELSS) – Direct Growth', amc: 'Beacon AMC', category: 'ELSS', risk: 'Very High', nav: 121.73, expenseRatio: 0.81, minSip: 500, minLumpsum: 500, cagr1y: 10.6, cagr3y: 16.4, cagr5y: 19.3, aumCr: 15340 },
  { code: 'BAF', name: 'Balanced Advantage – Direct Growth', amc: 'Alpha AMC', category: 'Hybrid', risk: 'Moderate', nav: 54.88, expenseRatio: 0.74, minSip: 100, minLumpsum: 500, cagr1y: 8.9, cagr3y: 12.1, cagr5y: 13.4, aumCr: 92310 },
  { code: 'LIQUID', name: 'Liquid Fund – Direct Growth', amc: 'Crest AMC', category: 'Debt – Liquid', risk: 'Low', nav: 4012.55, expenseRatio: 0.2, minSip: 500, minLumpsum: 500, cagr1y: 6.9, cagr3y: 6.8, cagr5y: 5.7, aumCr: 51200 },
  { code: 'GOLD', name: 'Gold ETF FoF – Direct Growth', amc: 'Delta AMC', category: 'Commodity', risk: 'High', nav: 38.12, expenseRatio: 0.15, minSip: 100, minLumpsum: 500, cagr1y: 21.3, cagr3y: 18.7, cagr5y: 13.8, aumCr: 7420 },
];

export const MF_MAP = Object.fromEntries(MUTUAL_FUNDS.map((f) => [f.code, f]));
