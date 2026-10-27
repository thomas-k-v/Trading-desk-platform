import { describe, expect, it } from 'vitest';
import { applyDeliveryTrade, computePositions } from '../src/engine/pnl';
import { requiredMargin } from '../src/engine/margin';
import type { Trade } from '../src/api/types';
import { future, option, quote, stock } from './fixtures';

const trade = (t: Partial<Trade>): Trade => ({ id: 't', orderId: 'o', symbol: 'TEST', side: 'BUY', qty: 10, price: 100, product: 'MIS', time: 0, charges: 0, ...t });

describe('computePositions', () => {
  it('marks an open long to market', () => {
    const [p] = computePositions([trade({})], { TEST: quote('TEST', 105) });
    expect(p.netQty).toBe(10);
    expect(p.pnl).toBeCloseTo(50);
    expect(p.realized).toBe(0);
  });

  it('splits realised and unrealised after a partial exit', () => {
    const [p] = computePositions([trade({}), trade({ side: 'SELL', qty: 4, price: 110 })], { TEST: quote('TEST', 102) });
    expect(p.netQty).toBe(6);
    expect(p.realized).toBeCloseTo(40);
    expect(p.unrealized).toBeCloseTo(12);
  });

  it('excludes delivery trades', () => {
    expect(computePositions([trade({ product: 'CNC' })], {})).toHaveLength(0);
  });
});

describe('applyDeliveryTrade', () => {
  it('averages buys and realises P&L on sells', () => {
    let h = applyDeliveryTrade([], trade({ product: 'CNC' })).holdings;
    h = applyDeliveryTrade(h, trade({ product: 'CNC', price: 110 })).holdings;
    expect(h[0]).toMatchObject({ qty: 20, avgPrice: 105 });
    const r = applyDeliveryTrade(h, trade({ product: 'CNC', side: 'SELL', qty: 20, price: 120 }));
    expect(r.realized).toBeCloseTo(300);
    expect(r.holdings).toHaveLength(0);
  });
});

describe('requiredMargin', () => {
  it('uses 100% for delivery and 20% for intraday equity', () => {
    expect(requiredMargin({ instrument: stock, product: 'CNC', side: 'BUY', qty: 10, price: 100 })).toBe(1000);
    expect(requiredMargin({ instrument: stock, product: 'MIS', side: 'BUY', qty: 10, price: 100 })).toBe(200);
  });
  it('charges premium for option buys and notional-based margin for writes', () => {
    expect(requiredMargin({ instrument: option, product: 'NRML', side: 'BUY', qty: 75, price: 100 })).toBe(7500);
    expect(requiredMargin({ instrument: option, product: 'NRML', side: 'SELL', qty: 75, price: 100, underlyingPrice: 25000 })).toBeCloseTo(225000);
  });
  it('uses SPAN-like rate for futures', () => {
    expect(requiredMargin({ instrument: future, product: 'NRML', side: 'BUY', qty: 75, price: 25000 })).toBeCloseTo(225000);
  });
});
