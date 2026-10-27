import type { Candle, Instrument, Quote } from '../api/types';
import { blackScholes } from './blackScholes';
import { EQUITIES, INDICES, INSTRUMENT_MAP, DERIVATIVES } from './instruments';
import { gaussian, hashString, mulberry32, roundToTick } from './rng';

// Simulated market: seeded history so charts look the same on every load,
// then a live random walk that ticks once a second.

export const BASE_INSTRUMENTS: Instrument[] = [...INDICES, ...EQUITIES];
const tickRand = mulberry32(Date.now() & 0xffffffff);
const YEAR_MS = 365 * 24 * 3600 * 1000;
const FUT_CARRY = 0.004;

/** Per-second tick volatility. */
const volFor = (i: Instrument) => (i.segment === 'INDEX' ? 0.0001 : i.basePrice < 200 ? 0.0003 : 0.0002);
const dailyVolFor = (i: Instrument) => (i.segment === 'INDEX' ? 0.008 : i.basePrice < 200 ? 0.022 : 0.015);
const tzOffset = -new Date().getTimezoneOffset() * 60;

export interface SeriesState {
  daily: Candle[]; // completed sessions
  intraday: Candle[]; // today's 1-minute bars
}

function sessionStart(now = new Date()) {
  const d = new Date(now);
  d.setHours(9, 15, 0, 0);
  return d;
}

/** Generate deterministic daily + intraday history for an underlying. */
function buildSeries(inst: Instrument, now = new Date()): SeriesState {
  const rand = mulberry32(hashString(inst.symbol));
  const dailyVol = dailyVolFor(inst);
  const days = 260;
  const closes: number[] = [inst.basePrice];
  for (let i = 1; i < days; i++) closes.unshift(closes[0] / (1 + gaussian(rand) * dailyVol + 0.0004));
  const daily: Candle[] = [];
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  let cursor = new Date(day);
  const dates: number[] = [];
  while (dates.length < days) {
    cursor.setDate(cursor.getDate() - 1);
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) dates.unshift(cursor.getTime() / 1000 + tzOffset);
  }
  for (let i = 0; i < days; i++) {
    const close = closes[i];
    const open = i === 0 ? close : closes[i - 1] * (1 + gaussian(rand) * dailyVol * 0.3);
    const high = Math.max(open, close) * (1 + Math.abs(gaussian(rand)) * dailyVol * 0.5);
    const low = Math.min(open, close) * (1 - Math.abs(gaussian(rand)) * dailyVol * 0.5);
    daily.push({ time: dates[i], open, high, low, close, volume: Math.round(1e5 + rand() * 9e5) });
  }

  // Intraday: from 9:15 to now (min 60 bars so charts are never empty off-hours).
  const start = sessionStart(now);
  const minutes = Math.max(60, Math.min(375, Math.floor((now.getTime() - start.getTime()) / 60000)));
  const barStart = now.getTime() - minutes * 60000;
  let last = inst.basePrice * (1 + gaussian(rand) * dailyVol * 0.3);
  const intraday: Candle[] = [];
  for (let m = 0; m < minutes; m++) {
    const open = last;
    let high = open, low = open, close = open;
    for (let s = 0; s < 4; s++) {
      close = close * (1 + gaussian(rand) * volFor(inst) * 1.5);
      high = Math.max(high, close);
      low = Math.min(low, close);
    }
    last = close;
    const t = Math.floor((barStart + m * 60000) / 60000) * 60 + tzOffset;
    intraday.push({ time: t, open, high, low, close, volume: Math.round(500 + rand() * 5000) });
  }
  return { daily, intraday };
}

export function initialSeries(): Record<string, SeriesState> {
  const now = new Date();
  return Object.fromEntries(BASE_INSTRUMENTS.map((i) => [i.symbol, buildSeries(i, now)]));
}

function quoteFromSeries(inst: Instrument, s: SeriesState, ltp: number, now: number): Quote {
  const prevClose = s.daily[s.daily.length - 1].close;
  const bars = s.intraday;
  const high = Math.max(...bars.map((b) => b.high), ltp);
  const low = Math.min(...bars.map((b) => b.low), ltp);
  const spread = Math.max(inst.tickSize, ltp * 0.0002);
  const band = inst.circuitPct ?? 0.2;
  return {
    symbol: inst.symbol,
    ltp,
    open: bars[0]?.open ?? ltp,
    high,
    low,
    prevClose,
    volume: bars.reduce((a, b) => a + b.volume, 0) * (inst.segment === 'INDEX' ? 0 : 1),
    change: ltp - prevClose,
    changePct: ((ltp - prevClose) / prevClose) * 100,
    bid: roundToTick(ltp - spread / 2, inst.tickSize),
    ask: roundToTick(ltp + spread / 2, inst.tickSize),
    upperCircuit: +roundToTick(prevClose * (1 + band), inst.tickSize).toFixed(2),
    lowerCircuit: +roundToTick(prevClose * (1 - band), inst.tickSize).toFixed(2),
    updatedAt: now,
  };
}

const ivFor = (strike: number, spot: number) => 0.115 + 1e-7 * (strike - spot) ** 2 + (strike < spot ? 0.008 : 0);

function oiFor(inst: Instrument, spot: number) {
  const r = mulberry32(hashString(inst.symbol))();
  const dist = ((inst.strike ?? spot) - spot) / 50;
  const skew = inst.optionType === 'CE' ? (dist >= 0 ? 1.2 : 0.5) : dist <= 0 ? 1.2 : 0.5;
  const base = Math.exp(-(dist * dist) / 40) * skew;
  const round = (inst.strike ?? 0) % 500 === 0 ? 1.8 : 1;
  return Math.round((20 + 160 * base * round) * (0.7 + r * 0.6)) * 75 * 100;
}

/** Futures and options are priced off their underlying on every tick. */
export function deriveQuotes(base: Record<string, Quote>, now: number): Record<string, Quote> {
  const out: Record<string, Quote> = {};
  for (const inst of DERIVATIVES) {
    const u = base[inst.underlying!];
    if (!u) continue;
    if (inst.segment === 'FUT') {
      const ltp = roundToTick(u.ltp * (1 + FUT_CARRY), inst.tickSize);
      const prevClose = u.prevClose * (1 + FUT_CARRY);
      out[inst.symbol] = {
        ...u,
        symbol: inst.symbol,
        ltp,
        open: u.open * (1 + FUT_CARRY),
        high: u.high * (1 + FUT_CARRY),
        low: u.low * (1 + FUT_CARRY),
        prevClose,
        change: ltp - prevClose,
        changePct: ((ltp - prevClose) / prevClose) * 100,
        bid: roundToTick(ltp - inst.tickSize, inst.tickSize),
        ask: roundToTick(ltp + inst.tickSize, inst.tickSize),
        upperCircuit: +roundToTick(prevClose * 1.1, inst.tickSize).toFixed(2),
        lowerCircuit: +roundToTick(prevClose * 0.9, inst.tickSize).toFixed(2),
        volume: Math.round(u.volume / 40) * inst.lotSize,
        oi: Math.round(1.2e5 + mulberry32(hashString(inst.symbol))() * 1e5) * inst.lotSize,
        updatedAt: now,
      };
      continue;
    }
    const strike = inst.strike!;
    const years = Math.max(0, new Date(inst.expiry!).getTime() - now) / YEAR_MS;
    const iv = ivFor(strike, u.ltp);
    const p = blackScholes(inst.optionType!, u.ltp, strike, years, iv);
    const prev = blackScholes(inst.optionType!, u.prevClose, strike, years + 1 / 365, ivFor(strike, u.prevClose));
    const ltp = Math.max(0.05, roundToTick(p.price, inst.tickSize));
    const prevClose = Math.max(0.05, roundToTick(prev.price, inst.tickSize));
    const spread = Math.max(0.05, roundToTick(ltp * 0.002, 0.05));
    out[inst.symbol] = {
      symbol: inst.symbol,
      ltp,
      open: prevClose,
      high: Math.max(prevClose, ltp),
      low: Math.min(prevClose, ltp),
      prevClose,
      volume: Math.round(oiFor(inst, u.ltp) * 0.6),
      change: ltp - prevClose,
      changePct: ((ltp - prevClose) / prevClose) * 100,
      bid: Math.max(0.05, +(ltp - spread).toFixed(2)),
      ask: +(ltp + spread).toFixed(2),
      upperCircuit: +(Math.max(ltp * 3, ltp + 200)).toFixed(2),
      lowerCircuit: 0.05,
      oi: oiFor(inst, u.ltp),
      iv,
      delta: p.delta,
      updatedAt: now,
    };
  }
  return out;
}

export function quotesFromSeries(series: Record<string, SeriesState>, now = Date.now()) {
  const base: Record<string, Quote> = {};
  for (const inst of BASE_INSTRUMENTS) {
    const s = series[inst.symbol];
    const ltp = roundToTick(s.intraday[s.intraday.length - 1].close, inst.tickSize);
    base[inst.symbol] = quoteFromSeries(inst, s, ltp, now);
  }
  return { ...base, ...deriveQuotes(base, now) };
}

/** Advance every underlying one tick; mutates nothing, returns the new series. */
export function stepSeries(series: Record<string, SeriesState>, now = Date.now()): Record<string, SeriesState> {
  const next: Record<string, SeriesState> = {};
  const market = gaussian(tickRand) * 0.00008; // common factor so stocks move together a little
  for (const inst of BASE_INSTRUMENTS) {
    const s = series[inst.symbol];
    const last = s.intraday[s.intraday.length - 1];
    const prevClose = s.daily[s.daily.length - 1].close;
    const band = inst.circuitPct ?? 0.2;
    const meanRevert = ((prevClose - last.close) / prevClose) * 0.002;
    const beta = inst.segment === 'INDEX' ? 1 : 0.8;
    let price = last.close * (1 + market * beta + gaussian(tickRand) * volFor(inst) + meanRevert);
    price = Math.min(prevClose * (1 + band), Math.max(prevClose * (1 - band), price));
    const minute = Math.floor(now / 60000) * 60 + tzOffset;
    const vol = Math.round(50 + tickRand() * 400);
    const intraday =
      minute > last.time
        ? [...s.intraday.slice(-374), { time: minute, open: last.close, high: Math.max(last.close, price), low: Math.min(last.close, price), close: price, volume: vol }]
        : [...s.intraday.slice(0, -1), { ...last, high: Math.max(last.high, price), low: Math.min(last.low, price), close: price, volume: last.volume + vol }];
    next[inst.symbol] = { daily: s.daily, intraday };
  }
  return next;
}

export type Timeframe = '1m' | '5m' | '15m' | '1D';

function aggregate(bars: Candle[], minutes: number): Candle[] {
  const out: Candle[] = [];
  for (const b of bars) {
    const bucket = Math.floor(b.time / (minutes * 60)) * minutes * 60;
    const cur = out[out.length - 1];
    if (cur && cur.time === bucket) {
      cur.high = Math.max(cur.high, b.high);
      cur.low = Math.min(cur.low, b.low);
      cur.close = b.close;
      cur.volume += b.volume;
    } else out.push({ ...b, time: bucket });
  }
  return out;
}

/** Candles for any instrument; derivatives are mapped from their underlying's path. */
export function getCandles(symbol: string, tf: Timeframe, series: Record<string, SeriesState>): Candle[] {
  const inst = INSTRUMENT_MAP[symbol];
  if (!inst) return [];
  const baseSym = inst.segment === 'FUT' || inst.segment === 'OPT' ? inst.underlying! : symbol;
  const s = series[baseSym];
  if (!s) return [];
  const today = aggregate(s.intraday, 1440)[0];
  const raw = tf === '1D' ? [...s.daily, ...(today ? [{ ...today, time: s.daily[s.daily.length - 1].time + 86400 }] : [])] : tf === '1m' ? s.intraday : aggregate(s.intraday, tf === '5m' ? 5 : 15);
  if (inst.segment === 'FUT') return raw.map((c) => ({ ...c, open: c.open * (1 + FUT_CARRY), high: c.high * (1 + FUT_CARRY), low: c.low * (1 + FUT_CARRY), close: c.close * (1 + FUT_CARRY) }));
  if (inst.segment === 'OPT') {
    const expiry = new Date(inst.expiry!).getTime();
    const nowSec = Date.now() / 1000;
    const price = (spot: number, t: number) => {
      const years = Math.max(0, expiry - (t - tzOffset) * 1000) / YEAR_MS;
      return Math.max(0.05, blackScholes(inst.optionType!, spot, inst.strike!, years, ivFor(inst.strike!, spot)).price);
    };
    const bars = tf === '1D' ? raw.slice(-30) : raw;
    return bars.map((c) => {
      const t = Math.min(c.time, nowSec + tzOffset);
      const o = price(c.open, t), cl = price(c.close, t), h = price(inst.optionType === 'CE' ? c.high : c.low, t), l = price(inst.optionType === 'CE' ? c.low : c.high, t);
      return { time: c.time, open: o, close: cl, high: Math.max(o, cl, h), low: Math.min(o, cl, l), volume: c.volume * 10 };
    });
  }
  return raw;
}

export function isMarketHours(now = new Date()): boolean {
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= 555 && mins < 930;
}
