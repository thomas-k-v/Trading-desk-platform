import type { Instrument, OrderDraft, Quote, RejectionCode } from '../api/types';
import { requiredMargin } from './margin';

export type CheckLevel = 'pass' | 'warn' | 'fail';

export interface CheckResult {
  id: string;
  level: CheckLevel;
  title: string;
  /** Plain-language explanation shown in the Smart Order Pad. */
  message: string;
  /** Cryptic RMS-style text, what a classic order book would show after rejection. */
  raw?: string;
  code?: RejectionCode;
  fix?: CheckFix;
}

export type CheckFix =
  | { kind: 'SET_QTY'; qty: number; label: string }
  | { kind: 'SET_PRICE'; price: number; label: string }
  | { kind: 'SET_PRODUCT'; product: OrderDraft['product']; label: string }
  | { kind: 'SET_VARIETY_AMO'; label: string }
  | { kind: 'ADD_FUNDS'; amount: number; label: string };

export interface CheckContext {
  draft: OrderDraft;
  instrument: Instrument;
  quote: Quote;
  underlyingPrice?: number;
  availableMargin: number;
  holdingQty: number;
  /** Open position quantity for this symbol + product (used to allow exits). */
  positionQty: number;
  marketOpen: boolean;
}

export const inr = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

const isMultiple = (value: number, step: number) => {
  const r = value / step;
  return Math.abs(r - Math.round(r)) < 1e-6;
};

/** Price the order would most likely execute at, for margin and value estimates. */
export function effectivePrice(draft: OrderDraft, quote: Quote): number {
  if (draft.orderType === 'LIMIT' || draft.orderType === 'SL') return draft.price || quote.ltp;
  if (draft.orderType === 'SL-M') return draft.triggerPrice || quote.ltp;
  return draft.side === 'BUY' ? quote.ask : quote.bid;
}

/** Margin this order adds. Orders that reduce an existing position need none. */
export function incrementalMargin(ctx: CheckContext): number {
  const { draft, instrument, quote, underlyingPrice, positionQty } = ctx;
  const signed = draft.side === 'BUY' ? draft.qty : -draft.qty;
  const closing = positionQty !== 0 && Math.sign(signed) !== Math.sign(positionQty);
  const openingQty = closing ? Math.max(0, Math.abs(signed) - Math.abs(positionQty)) : draft.qty;
  if (instrument.segment === 'EQ' && draft.product === 'CNC' && draft.side === 'SELL') return 0;
  return requiredMargin({
    instrument,
    product: draft.product,
    side: draft.side,
    qty: openingQty,
    price: effectivePrice(draft, quote),
    underlyingPrice,
  });
}

/**
 * Pre-trade checks run both client-side (Smart Order Pad) and inside the mock RMS.
 * Order matters: the first failure is what the RMS reports as the rejection reason.
 */
export function runPreTradeChecks(ctx: CheckContext): CheckResult[] {
  const { draft, instrument, quote, availableMargin, holdingQty, marketOpen } = ctx;
  const results: CheckResult[] = [];
  const isFno = instrument.segment === 'FUT' || instrument.segment === 'OPT';

  // 1. Market session
  if (!marketOpen && draft.variety !== 'AMO') {
    results.push({
      id: 'market',
      level: 'fail',
      code: 'MARKET_CLOSED',
      title: 'Market is closed',
      message: 'Regular orders can only be placed between 9:15 AM and 3:30 PM. Place it as an After-Market Order and it will go to the exchange at the next open.',
      raw: 'RMS:Rule: Check circuit limit including square off order exceeds / Market Closed',
      fix: { kind: 'SET_VARIETY_AMO', label: 'Place as AMO' },
    });
  } else {
    results.push({ id: 'market', level: 'pass', title: draft.variety === 'AMO' ? 'After-market order' : 'Market open', message: draft.variety === 'AMO' ? 'Will be sent to the exchange at 9:15 AM.' : 'Order will go to the exchange immediately.' });
  }

  // 2. Quantity, lot size, freeze limit
  if (!Number.isFinite(draft.qty) || draft.qty <= 0 || !Number.isInteger(draft.qty)) {
    results.push({ id: 'qty', level: 'fail', code: 'INVALID_QTY', title: 'Enter a quantity', message: 'Quantity must be a whole number greater than zero.', raw: 'RMS:Invalid Quantity' });
  } else if (isFno && draft.qty % instrument.lotSize !== 0) {
    const fixQty = Math.max(instrument.lotSize, Math.round(draft.qty / instrument.lotSize) * instrument.lotSize);
    results.push({
      id: 'qty',
      level: 'fail',
      code: 'LOT_SIZE',
      title: 'Quantity must be in lots',
      message: `${instrument.symbol} trades in lots of ${instrument.lotSize}. ${draft.qty} is not a multiple of the lot size.`,
      raw: `RMS:Quantity should be multiple of lot size ${instrument.lotSize}`,
      fix: { kind: 'SET_QTY', qty: fixQty, label: `Use ${fixQty / instrument.lotSize} lot${fixQty / instrument.lotSize > 1 ? 's' : ''} (${fixQty})` },
    });
  } else if (instrument.freezeQty && draft.qty > instrument.freezeQty) {
    results.push({
      id: 'qty',
      level: 'fail',
      code: 'FREEZE_QTY',
      title: 'Above exchange freeze limit',
      message: `The exchange accepts at most ${instrument.freezeQty} qty per order for this contract. Split it into smaller orders.`,
      raw: `Freeze quantity exceeded. Max allowed: ${instrument.freezeQty}`,
      fix: { kind: 'SET_QTY', qty: instrument.freezeQty, label: `Use max ${instrument.freezeQty}` },
    });
  } else {
    results.push({ id: 'qty', level: 'pass', title: 'Quantity valid', message: isFno ? `${draft.qty / instrument.lotSize} lot(s) × ${instrument.lotSize}` : `${draft.qty} share(s)` });
  }

  // 3. Product allowed for segment
  if (isFno && draft.product === 'CNC') {
    results.push({ id: 'product', level: 'fail', code: 'PRODUCT_NOT_ALLOWED', title: 'Use NRML or MIS for F&O', message: 'Delivery (CNC) is only for equity shares. Use NRML to carry the position or MIS for intraday.', raw: 'RMS:Product type CNC not allowed for NFO', fix: { kind: 'SET_PRODUCT', product: 'NRML', label: 'Switch to NRML' } });
  } else if (!isFno && draft.product === 'NRML') {
    results.push({ id: 'product', level: 'fail', code: 'PRODUCT_NOT_ALLOWED', title: 'Use CNC or MIS for equity', message: 'NRML applies to futures & options. Use CNC for delivery or MIS for intraday.', raw: 'RMS:Product type NRML not allowed for NSE', fix: { kind: 'SET_PRODUCT', product: 'CNC', label: 'Switch to CNC' } });
  }

  // 4. Price: tick size and circuit band
  if (draft.orderType === 'LIMIT' || draft.orderType === 'SL') {
    const price = draft.price ?? 0;
    if (!(price > 0)) {
      results.push({ id: 'price', level: 'fail', code: 'TICK_SIZE', title: 'Enter a price', message: 'Limit orders need a price.', raw: 'RMS:Invalid Price' });
    } else if (!isMultiple(price, instrument.tickSize)) {
      const fixed = Math.round(price / instrument.tickSize) * instrument.tickSize;
      results.push({ id: 'price', level: 'fail', code: 'TICK_SIZE', title: `Price must be in steps of ₹${instrument.tickSize}`, message: `${inr(price)} is not a valid tick. The nearest valid price is ${inr(fixed)}.`, raw: `RMS:Price not multiple of tick size ${instrument.tickSize}`, fix: { kind: 'SET_PRICE', price: +fixed.toFixed(2), label: `Use ${inr(fixed)}` } });
    } else if (price > quote.upperCircuit || price < quote.lowerCircuit) {
      const bound = price > quote.upperCircuit ? quote.upperCircuit : quote.lowerCircuit;
      results.push({ id: 'price', level: 'fail', code: 'CIRCUIT_LIMIT', title: 'Outside today\'s price band', message: `Exchange allows prices between ${inr(quote.lowerCircuit)} and ${inr(quote.upperCircuit)} today.`, raw: `RMS:Rule: Check circuit limit including square off order exceeds. Price: ${price}`, fix: { kind: 'SET_PRICE', price: bound, label: `Use ${inr(bound)}` } });
    } else {
      const drift = Math.abs(price - quote.ltp) / quote.ltp;
      if (drift > 0.05) {
        results.push({ id: 'price', level: 'warn', title: `Price is ${(drift * 100).toFixed(1)}% away from LTP`, message: `LTP is ${inr(quote.ltp)}. Double-check for a typo — the order may not fill today.`, fix: { kind: 'SET_PRICE', price: quote.ltp, label: `Use LTP ${inr(quote.ltp)}` } });
      } else {
        results.push({ id: 'price', level: 'pass', title: 'Price within band', message: `Band ${inr(quote.lowerCircuit)} – ${inr(quote.upperCircuit)}` });
      }
    }
  }

  // 5. Trigger price for stop-loss orders
  if (draft.orderType === 'SL' || draft.orderType === 'SL-M') {
    const trig = draft.triggerPrice ?? 0;
    const buy = draft.side === 'BUY';
    const badSide = buy ? trig <= quote.ltp : trig >= quote.ltp;
    const badLimit = draft.orderType === 'SL' && draft.price !== undefined && (buy ? draft.price < trig : draft.price > trig);
    if (!(trig > 0) || badSide || badLimit) {
      results.push({
        id: 'trigger',
        level: 'fail',
        code: 'INVALID_TRIGGER',
        title: 'Check the trigger price',
        message: buy
          ? `For a stop-loss BUY, the trigger must be above LTP (${inr(quote.ltp)}) and the limit price at or above the trigger.`
          : `For a stop-loss SELL, the trigger must be below LTP (${inr(quote.ltp)}) and the limit price at or below the trigger.`,
        raw: 'RMS:Trigger price for stoploss buy orders should be higher than last traded price',
      });
    } else {
      results.push({ id: 'trigger', level: 'pass', title: 'Trigger valid', message: `Activates when LTP ${buy ? 'rises to' : 'falls to'} ${inr(trig)}.` });
    }
  }

  // 6. Holdings for delivery sell
  if (instrument.segment === 'EQ' && draft.product === 'CNC' && draft.side === 'SELL') {
    if (holdingQty < draft.qty) {
      results.push({
        id: 'holdings',
        level: 'fail',
        code: 'NO_HOLDINGS',
        title: holdingQty === 0 ? 'You don\'t hold this stock' : `You hold only ${holdingQty}`,
        message: holdingQty === 0
          ? 'Delivery sell needs shares in your demat. To short-sell for the day, use Intraday (MIS).'
          : `You can sell up to ${holdingQty} shares from your holdings.`,
        raw: 'RMS:Holding not available / Sell quantity exceeds holdings',
        fix: holdingQty > 0 ? { kind: 'SET_QTY', qty: holdingQty, label: `Sell ${holdingQty}` } : { kind: 'SET_PRODUCT', product: 'MIS', label: 'Switch to Intraday' },
      });
    } else {
      results.push({ id: 'holdings', level: 'pass', title: 'Holdings available', message: `${holdingQty} shares in demat.` });
    }
  }

  // 7. Margin
  const need = incrementalMargin(ctx);
  if (need > availableMargin + 1e-6) {
    const shortfall = Math.ceil(need - availableMargin);
    const unit = requiredMargin({ instrument, product: draft.product, side: draft.side, qty: instrument.lotSize, price: effectivePrice(draft, quote), underlyingPrice: ctx.underlyingPrice });
    const affordable = unit > 0 ? Math.floor(availableMargin / unit) * instrument.lotSize : 0;
    results.push({
      id: 'margin',
      level: 'fail',
      code: 'INSUFFICIENT_MARGIN',
      title: `Short by ${inr(shortfall)}`,
      message: `This order needs ${inr(need)} margin; you have ${inr(availableMargin)} available.` + (affordable > 0 ? ` You can afford up to ${affordable} qty.` : ''),
      raw: `RMS:Margin Exceeds,Required:${need.toFixed(2)}, Available:${availableMargin.toFixed(2)} for entity account-SIM across exchange across segment across product`,
      fix: { kind: 'ADD_FUNDS', amount: shortfall, label: `Add ${inr(shortfall)}` },
    });
  } else {
    results.push({ id: 'margin', level: 'pass', title: 'Sufficient margin', message: `Needs ${inr(need)} of ${inr(availableMargin)} available.` });
  }

  // 8. Informational warnings
  if (draft.product === 'MIS') {
    results.push({ id: 'mis', level: 'warn', title: 'Intraday auto square-off at 3:20 PM', message: 'Open MIS positions are closed automatically near market close.' });
  }
  if (instrument.segment === 'OPT' && draft.side === 'SELL') {
    results.push({ id: 'optsell', level: 'warn', title: 'Option selling has unlimited risk', message: 'Losses can exceed the premium received if the market moves sharply.' });
  }
  if (instrument.expiry && new Date(instrument.expiry).toDateString() === new Date().toDateString()) {
    results.push({ id: 'expiry', level: 'warn', title: 'Contract expires today', message: 'Expiry-day premiums decay fast and exchanges may apply extra margin.' });
  }

  return results;
}

export const firstFailure = (r: CheckResult[]) => r.find((c) => c.level === 'fail');
