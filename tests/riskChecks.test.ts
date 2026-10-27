import { describe, expect, it } from 'vitest';
import { firstFailure, runPreTradeChecks, type CheckContext } from '../src/engine/riskChecks';
import { future, option, quote, stock } from './fixtures';

const base = (over: Partial<CheckContext> = {}): CheckContext => ({
  draft: { symbol: 'TEST', side: 'BUY', qty: 10, orderType: 'LIMIT', product: 'CNC', variety: 'REGULAR', price: 100 },
  instrument: stock,
  quote: quote('TEST', 100),
  availableMargin: 100_000,
  holdingQty: 0,
  positionQty: 0,
  marketOpen: true,
  ...over,
});

describe('runPreTradeChecks', () => {
  it('passes a valid delivery buy', () => {
    expect(firstFailure(runPreTradeChecks(base()))).toBeUndefined();
  });

  it('flags insufficient margin with shortfall and an add-funds fix', () => {
    const r = firstFailure(runPreTradeChecks(base({ availableMargin: 400 })));
    expect(r?.code).toBe('INSUFFICIENT_MARGIN');
    expect(r?.fix).toEqual({ kind: 'ADD_FUNDS', amount: 600, label: expect.any(String) });
  });

  it('suggests the nearest lot for F&O quantity', () => {
    const r = firstFailure(runPreTradeChecks(base({
      instrument: future, quote: quote(future.symbol, 25000),
      draft: { symbol: future.symbol, side: 'BUY', qty: 100, orderType: 'MARKET', product: 'NRML', variety: 'REGULAR' },
      availableMargin: 10_000_000,
    })));
    expect(r?.code).toBe('LOT_SIZE');
    expect(r?.fix).toMatchObject({ kind: 'SET_QTY', qty: 75 });
  });

  it('enforces freeze quantity', () => {
    const r = firstFailure(runPreTradeChecks(base({
      instrument: option, quote: quote(option.symbol, 120),
      draft: { symbol: option.symbol, side: 'BUY', qty: 1875, orderType: 'MARKET', product: 'NRML', variety: 'REGULAR' },
      availableMargin: 10_000_000,
    })));
    expect(r?.code).toBe('FREEZE_QTY');
  });

  it('rejects prices outside the circuit band', () => {
    const r = firstFailure(runPreTradeChecks(base({ draft: { ...base().draft, price: 115 } })));
    expect(r?.code).toBe('CIRCUIT_LIMIT');
    expect(r?.fix).toMatchObject({ kind: 'SET_PRICE', price: 110 });
  });

  it('rejects prices off the tick grid', () => {
    const r = firstFailure(runPreTradeChecks(base({ draft: { ...base().draft, price: 100.03 } })));
    expect(r?.code).toBe('TICK_SIZE');
  });

  it('blocks delivery sell without holdings and suggests intraday', () => {
    const r = firstFailure(runPreTradeChecks(base({ draft: { ...base().draft, side: 'SELL' } })));
    expect(r?.code).toBe('NO_HOLDINGS');
    expect(r?.fix).toMatchObject({ kind: 'SET_PRODUCT', product: 'MIS' });
  });

  it('requires AMO when the market is closed', () => {
    const r = firstFailure(runPreTradeChecks(base({ marketOpen: false })));
    expect(r?.code).toBe('MARKET_CLOSED');
    expect(firstFailure(runPreTradeChecks(base({ marketOpen: false, draft: { ...base().draft, variety: 'AMO' } })))).toBeUndefined();
  });

  it('validates stop-loss trigger direction', () => {
    const r = firstFailure(runPreTradeChecks(base({ draft: { ...base().draft, side: 'SELL', product: 'MIS', orderType: 'SL', price: 99, triggerPrice: 101 } })));
    expect(r?.code).toBe('INVALID_TRIGGER');
  });

  it('needs no margin to exit an existing position', () => {
    const r = runPreTradeChecks(base({ draft: { ...base().draft, side: 'SELL', product: 'MIS' }, positionQty: 10, availableMargin: 0 }));
    expect(firstFailure(r)).toBeUndefined();
  });

  it('warns about fat-finger prices', () => {
    const r = runPreTradeChecks(base({ draft: { ...base().draft, price: 92 } }));
    expect(r.find((c) => c.id === 'price')?.level).toBe('warn');
  });
});
