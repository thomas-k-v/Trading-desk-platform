import { useEffect, useMemo, useRef, useState } from 'react';
import type { OrderDraft, OrderType, Product, Side } from '../../api/types';
import { INSTRUMENT_MAP } from '../../market/instruments';
import { useUi } from '../../store/ui';
import { useMarket } from '../../store/market';
import { useTrading } from '../../store/trading';
import { useAnalytics, track } from '../../analytics/track';
import { addFunds, checkContext, modifyOrder, placeOrder } from '../../api/mockBroker';
import { effectivePrice, incrementalMargin, runPreTradeChecks, type CheckFix, type CheckResult } from '../../engine/riskChecks';
import { estimateCharges } from '../../engine/margin';
import { useFunds, useQuote } from '../hooks';
import { fmt, inr, pct, tone } from '../../lib/format';
import { Badge, Button, Field, Tabs, inputCls } from '../../components/ui';

const ORDER_TYPES: OrderType[] = ['MARKET', 'LIMIT', 'SL', 'SL-M'];

export function OrderPad() {
  const pad = useUi((s) => s.orderPad);
  if (!pad.open || !pad.draft) return null;
  // Remount per open so state starts fresh from the prefill.
  return <OrderPadInner key={`${pad.draft.symbol}-${pad.modifyId ?? ''}-${pad.draft.side}`} />;
}

function OrderPadInner() {
  const pad = useUi((s) => s.orderPad);
  const close = useUi((s) => s.closeOrderPad);
  const toast = useUi((s) => s.toast);
  const variant = useAnalytics((s) => s.variant);
  const prefill = pad.draft!;
  const inst = INSTRUMENT_MAP[prefill.symbol];
  const quote = useQuote(prefill.symbol);
  const funds = useFunds();
  const marketOpen = useMarket((s) => s.marketOpen);
  const isFno = inst.segment === 'FUT' || inst.segment === 'OPT';
  const modifying = !!pad.modifyId;

  const [side, setSide] = useState<Side>(prefill.side);
  const [product, setProduct] = useState<Product>(prefill.product ?? (isFno ? 'NRML' : 'CNC'));
  const [orderType, setOrderType] = useState<OrderType>(prefill.orderType ?? (prefill.price ? 'LIMIT' : 'MARKET'));
  const [qty, setQty] = useState<number>(prefill.qty ?? inst.lotSize);
  const [price, setPrice] = useState<string>(prefill.price ? String(prefill.price) : quote ? quote.ltp.toFixed(2) : '');
  const [trigger, setTrigger] = useState<string>(prefill.triggerPrice ? String(prefill.triggerPrice) : '');
  const [amo, setAmo] = useState(prefill.variety === 'AMO');
  const [step, setStep] = useState<'edit' | 'review'>('edit');
  const [busy, setBusy] = useState(false);
  const loggedFailures = useRef(new Set<string>());
  const openedAt = useRef(Date.now());

  useEffect(() => {
    if (!modifying) track('order_pad_opened', { symbol: prefill.symbol, side: prefill.side, source: pad.source, segment: inst.segment });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const draft: OrderDraft = {
    symbol: prefill.symbol,
    side,
    qty,
    orderType,
    product,
    variety: amo ? 'AMO' : 'REGULAR',
    price: orderType === 'LIMIT' || orderType === 'SL' ? Number(price) : undefined,
    triggerPrice: orderType === 'SL' || orderType === 'SL-M' ? Number(trigger) : undefined,
  };

  const ctx = useMemo(() => checkContext(draft, pad.modifyId), [JSON.stringify(draft), quote?.ltp, funds.available, marketOpen]);
  const checks = useMemo(() => runPreTradeChecks(ctx), [ctx]);
  const failures = checks.filter((c) => c.level === 'fail');
  const warnings = checks.filter((c) => c.level === 'warn');
  const passes = checks.filter((c) => c.level === 'pass');
  const margin = incrementalMargin(ctx);
  const execPrice = quote ? effectivePrice(draft, quote) : 0;
  const charges = estimateCharges(inst, product, side, qty || 0, execPrice);
  const smart = variant === 'smart';

  useEffect(() => {
    if (!smart) return;
    for (const f of failures) {
      if (loggedFailures.current.has(f.code!)) continue;
      loggedFailures.current.add(f.code!);
      track('pretrade_check_failed', { symbol: draft.symbol, code: f.code });
    }
  }, [failures.map((f) => f.code).join()]);

  if (!quote) return null;

  const applyFix = async (fix: CheckFix, check: CheckResult) => {
    track('pretrade_fix_applied', { code: check.code, fix: fix.kind });
    if (fix.kind === 'SET_QTY') setQty(fix.qty);
    if (fix.kind === 'SET_PRICE') { setPrice(fix.price.toFixed(2)); if (orderType === 'MARKET') setOrderType('LIMIT'); }
    if (fix.kind === 'SET_PRODUCT') setProduct(fix.product);
    if (fix.kind === 'SET_VARIETY_AMO') setAmo(true);
    if (fix.kind === 'ADD_FUNDS') {
      const amount = Math.ceil(fix.amount / 1000) * 1000;
      const res = await addFunds(amount, 'UPI');
      if (res.status === 'success') toast({ kind: 'success', title: `${inr(amount, 0)} added via UPI`, body: 'Simulated instant pay-in. Margin updated.' });
    }
  };

  const submit = async () => {
    setBusy(true);
    const res = modifying
      ? await modifyOrder(pad.modifyId!, { qty: draft.qty, price: draft.price, triggerPrice: draft.triggerPrice, orderType: draft.orderType })
      : await placeOrder(draft, pad.source === 'smart' ? (smart ? 'smart' : 'classic') : pad.source);
    setBusy(false);
    close();
    if (res.status === 'success') {
      const o = res.data;
      toast({ kind: 'success', title: `${modifying ? 'Modified' : o.status === 'COMPLETE' ? 'Executed' : 'Placed'}: ${o.side} ${o.qty} ${o.symbol}`, body: o.status === 'COMPLETE' ? `Avg ${inr(o.avgPrice)}` : `${o.orderType} · ${o.status.replace('_', ' ')}` });
    } else {
      const order = useTrading.getState().orders[0];
      toast({
        kind: 'error',
        title: modifying ? 'Modify failed' : `Order rejected: ${draft.side} ${draft.qty} ${draft.symbol}`,
        body: smart || modifying ? order?.rejectionReason ?? res.error.message : res.error.message,
      });
    }
  };

  const review = () => {
    setStep('review');
    track('order_review_shown', { symbol: draft.symbol, has_warnings: warnings.length > 0, ms_since_open: Date.now() - openedAt.current });
  };

  const buy = side === 'BUY';
  const lots = isFno ? qty / inst.lotSize : qty;
  const blocked = smart && failures.length > 0;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end bg-slate-900/30 md:items-stretch" onClick={close}>
      <div onClick={(e) => e.stopPropagation()} className="slide-in flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl md:max-h-none md:w-[440px] md:rounded-none">
        {/* Header */}
        <div className={`px-5 py-4 text-white ${buy ? 'bg-up' : 'bg-down'}`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-medium opacity-80">{modifying ? 'Modify order' : `${buy ? 'Buy' : 'Sell'}`} · {inst.exchange}</div>
              <div className="text-lg font-semibold">{inst.symbol}</div>
              <div className="text-sm tabular-nums opacity-90">LTP {fmt(quote.ltp)} <span className="opacity-80">({pct(quote.changePct)})</span></div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button aria-label="Close" onClick={close} className="text-xl leading-none opacity-80 hover:opacity-100">×</button>
              {!modifying && (
                <div className="flex rounded-full bg-white/20 p-0.5 text-xs font-semibold">
                  {(['BUY', 'SELL'] as Side[]).map((s) => (
                    <button key={s} onClick={() => setSide(s)} className={`rounded-full px-3 py-1 ${side === s ? 'bg-white text-slate-900' : 'text-white'}`}>{s}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {step === 'edit' ? (
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Tabs
                value={product}
                onChange={(p) => !modifying && setProduct(p)}
                options={(isFno ? (['NRML', 'MIS'] as Product[]) : (['CNC', 'MIS'] as Product[])).map((p) => ({
                  value: p,
                  label: p === 'CNC' ? 'Delivery' : p === 'MIS' ? 'Intraday' : 'Carry (NRML)',
                }))}
              />
              <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={amo} onChange={(e) => setAmo(e.target.checked)} disabled={modifying} /> AMO
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={isFno ? 'Lots' : 'Quantity'} hint={isFno ? `${qty} qty` : undefined}>
                <div className="flex">
                  <button className="rounded-l-lg border border-r-0 border-slate-300 px-2.5 text-slate-500" onClick={() => setQty(Math.max(inst.lotSize, qty - inst.lotSize))}>−</button>
                  <input
                    aria-label={isFno ? 'Lots' : 'Quantity'}
                    className={`${inputCls} rounded-none text-center`}
                    type="number"
                    min={1}
                    value={isFno ? (Number.isInteger(lots) ? lots : +lots.toFixed(2)) : qty || ''}
                    onChange={(e) => setQty(isFno ? Math.round(Number(e.target.value) * inst.lotSize) : Math.floor(Number(e.target.value)))}
                  />
                  <button className="rounded-r-lg border border-l-0 border-slate-300 px-2.5 text-slate-500" onClick={() => setQty(qty + inst.lotSize)}>+</button>
                </div>
              </Field>
              <Field label="Price" hint={orderType === 'MARKET' || orderType === 'SL-M' ? 'At market' : `Tick ${inst.tickSize}`}>
                <input aria-label="Price" className={inputCls} type="number" step={inst.tickSize} value={orderType === 'MARKET' || orderType === 'SL-M' ? '' : price} placeholder="Market" disabled={orderType === 'MARKET' || orderType === 'SL-M'} onChange={(e) => setPrice(e.target.value)} />
              </Field>
            </div>

            {isFno && !smart && (
              <div className="text-xs text-slate-400">Enter quantity in lots. 1 lot = {inst.lotSize}</div>
            )}

            <div>
              <Tabs value={orderType} onChange={setOrderType} options={ORDER_TYPES.map((t) => ({ value: t, label: t }))} size="sm" />
            </div>
            {(orderType === 'SL' || orderType === 'SL-M') && (
              <Field label="Trigger price" hint={buy ? 'Above LTP' : 'Below LTP'}>
                <input aria-label="Trigger price" className={inputCls} type="number" step={inst.tickSize} value={trigger} onChange={(e) => setTrigger(e.target.value)} />
              </Field>
            )}

            {/* Margin strip */}
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-xs">
              <div>
                <div className="text-slate-500">Margin req.</div>
                <div className="font-semibold tabular-nums">{inr(margin)}</div>
              </div>
              <div>
                <div className="text-slate-500">Available</div>
                <div className={`font-semibold tabular-nums ${smart && margin > ctx.availableMargin ? 'text-down' : ''}`}>{inr(ctx.availableMargin)}</div>
              </div>
              <div>
                <div className="text-slate-500">Charges ≈</div>
                <div className="font-semibold tabular-nums">{inr(charges.total)}</div>
              </div>
            </div>

            {smart ? (
              <ChecksPanel failures={failures} warnings={warnings} passes={passes} onFix={applyFix} />
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500">
                <Badge color="slate">Classic pad</Badge> No pre-trade guidance. Switch the experiment to <b>Smart</b> in the header to compare.
              </div>
            )}
          </div>
        ) : (
          <ReviewStep draft={draft} execPrice={execPrice} margin={margin} charges={charges.total} warnings={smart ? warnings : []} />
        )}

        <div className="border-t border-slate-100 p-4">
          {step === 'edit' ? (
            <Button variant={buy ? 'buy' : 'sell'} size="lg" className="w-full" disabled={blocked || !qty} onClick={review}>
              {blocked ? `Fix ${failures.length} issue${failures.length > 1 ? 's' : ''} to continue` : modifying ? 'Review changes' : `Review ${buy ? 'buy' : 'sell'}`}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="lg" onClick={() => setStep('edit')}>Back</Button>
              <Button variant={buy ? 'buy' : 'sell'} size="lg" className="flex-1" disabled={busy} onClick={submit}>
                {busy ? 'Sending…' : modifying ? 'Confirm modify' : `Confirm ${buy ? 'buy' : 'sell'}`}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChecksPanel({ failures, warnings, passes, onFix }: { failures: CheckResult[]; warnings: CheckResult[]; passes: CheckResult[]; onFix: (f: CheckFix, c: CheckResult) => void }) {
  const [showPasses, setShowPasses] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pre-trade checks</div>
        <Badge color={failures.length ? 'red' : warnings.length ? 'amber' : 'green'}>
          {failures.length ? `${failures.length} blocking` : warnings.length ? `${warnings.length} heads-up` : 'All clear'}
        </Badge>
      </div>
      {[...failures, ...warnings].map((c) => (
        <div key={c.id + c.title} className={`rounded-lg border p-3 ${c.level === 'fail' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className={`text-sm font-semibold ${c.level === 'fail' ? 'text-red-800' : 'text-amber-800'}`}>{c.level === 'fail' ? '✕' : '!'} {c.title}</div>
          <div className={`mt-0.5 text-xs ${c.level === 'fail' ? 'text-red-700' : 'text-amber-700'}`}>{c.message}</div>
          {c.fix && (
            <button onClick={() => onFix(c.fix!, c)} className="mt-2 rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-brand shadow-sm ring-1 ring-slate-200 hover:bg-blue-50">
              {c.fix.label}
            </button>
          )}
        </div>
      ))}
      <button onClick={() => setShowPasses(!showPasses)} className="text-xs text-slate-500 hover:text-slate-700">
        ✓ {passes.length} checks passed {showPasses ? '▴' : '▾'}
      </button>
      {showPasses && (
        <ul className="space-y-1 pl-1">
          {passes.map((c) => (
            <li key={c.id} className="text-xs text-slate-600"><span className="text-up">✓</span> <b>{c.title}</b> — {c.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewStep({ draft, execPrice, margin, charges, warnings }: { draft: OrderDraft; execPrice: number; margin: number; charges: number; warnings: CheckResult[] }) {
  const inst = INSTRUMENT_MAP[draft.symbol];
  const rows: [string, string][] = [
    ['Order', `${draft.side} ${draft.qty}${inst.lotSize > 1 ? ` (${draft.qty / inst.lotSize} lot)` : ''}`],
    ['Type', `${draft.orderType}${draft.variety === 'AMO' ? ' · AMO' : ''}`],
    ['Product', draft.product === 'CNC' ? 'Delivery (CNC)' : draft.product === 'MIS' ? 'Intraday (MIS)' : 'Carry forward (NRML)'],
    ['Price', draft.orderType === 'MARKET' || draft.orderType === 'SL-M' ? `Market (~${fmt(execPrice)})` : fmt(draft.price ?? 0)],
    ...(draft.triggerPrice ? [['Trigger', fmt(draft.triggerPrice)] as [string, string]] : []),
    ['Order value ≈', inr(draft.qty * execPrice)],
    ['Margin blocked', inr(margin)],
    ['Charges ≈', inr(charges)],
  ];
  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-5">
      <div className="text-sm font-semibold text-slate-700">Review your order</div>
      <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between px-3 py-2 text-sm">
            <dt className="text-slate-500">{k}</dt>
            <dd className="font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {warnings.map((w) => (
        <div key={w.id} className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800"><b>{w.title}.</b> {w.message}</div>
      ))}
      {inst.segment === 'OPT' && draft.side === 'BUY' && (
        <div className={`rounded-lg bg-slate-50 p-2.5 text-xs ${tone(0)}`}>Max loss on this option buy is the premium paid: <b>{inr(draft.qty * execPrice)}</b>.</div>
      )}
    </div>
  );
}
