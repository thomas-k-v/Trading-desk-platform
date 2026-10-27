import { describe, expect, it } from 'vitest';
import { LIQUIDITY_PER_TICK, matchOrder } from '../src/engine/orderEngine';
import { order, quote } from './fixtures';

describe('matchOrder', () => {
  it('fills a market buy at the ask', () => {
    const r = matchOrder(order({ orderType: 'MARKET', price: undefined }), quote('TEST', 100));
    expect(r.order.status).toBe('COMPLETE');
    expect(r.fill?.price).toBeCloseTo(100.05);
  });

  it('leaves a limit buy open until price comes down', () => {
    expect(matchOrder(order({ price: 99 }), quote('TEST', 100)).order.status).toBe('OPEN');
    const r = matchOrder(order({ price: 99 }), quote('TEST', 98.9));
    expect(r.order.status).toBe('COMPLETE');
    expect(r.fill?.price).toBeCloseTo(98.95);
  });

  it('triggers a stop-loss sell then fills as a limit', () => {
    const sl = order({ side: 'SELL', orderType: 'SL', triggerPrice: 95, price: 94.5, status: 'TRIGGER_PENDING' });
    expect(matchOrder(sl, quote('TEST', 96)).order.status).toBe('TRIGGER_PENDING');
    const r = matchOrder(sl, quote('TEST', 94.9));
    expect(r.order.status).toBe('COMPLETE');
  });

  it('partially fills large orders across ticks', () => {
    const big = order({ orderType: 'MARKET', qty: LIQUIDITY_PER_TICK + 500 });
    const first = matchOrder(big, quote('TEST', 100));
    expect(first.order.status).toBe('PARTIAL');
    expect(first.order.filledQty).toBe(LIQUIDITY_PER_TICK);
    const second = matchOrder(first.order, quote('TEST', 101));
    expect(second.order.status).toBe('COMPLETE');
    expect(second.order.avgPrice).toBeGreaterThan(100.05);
  });

  it('ignores finished orders', () => {
    const done = order({ status: 'CANCELLED' });
    expect(matchOrder(done, quote('TEST', 1)).fill).toBeUndefined();
  });
});
