import { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, CrosshairMode, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import { getCandles, type Timeframe } from '../../market/feed';
import { INSTRUMENT_MAP } from '../../market/instruments';
import { useMarket } from '../../store/market';
import { useUi } from '../../store/ui';
import { useQuote } from '../hooks';
import { track } from '../../analytics/track';
import { compact, fmt, pct, tone } from '../../lib/format';
import { Badge, Button, Card, Tabs } from '../../components/ui';
import type { Candle } from '../../api/types';

function sma(c: Candle[], n: number) {
  const out: { time: UTCTimestamp; value: number }[] = [];
  let sum = 0;
  c.forEach((b, i) => {
    sum += b.close;
    if (i >= n) sum -= c[i - n].close;
    if (i >= n - 1) out.push({ time: b.time as UTCTimestamp, value: sum / n });
  });
  return out;
}

function ema(c: Candle[], n: number) {
  const k = 2 / (n + 1);
  let prev = c[0]?.close ?? 0;
  return c.map((b, i) => {
    prev = i === 0 ? b.close : b.close * k + prev * (1 - k);
    return { time: b.time as UTCTimestamp, value: prev };
  }).slice(n);
}

export function ChartView() {
  const symbol = useUi((s) => s.chartSymbol);
  const openOrderPad = useUi((s) => s.openOrderPad);
  const series = useMarket((s) => s.series);
  const quote = useQuote(symbol);
  const inst = INSTRUMENT_MAP[symbol];
  const [tf, setTf] = useState<Timeframe>('5m');
  const [studies, setStudies] = useState({ sma20: true, ema50: false });
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi>();
  const refs = useRef<{ candles?: ISeriesApi<'Candlestick'>; volume?: ISeriesApi<'Histogram'>; sma?: ISeriesApi<'Line'>; ema?: ISeriesApi<'Line'> }>({});

  const lastKey = useRef('');
  const candles = useMemo(() => getCandles(symbol, tf, series), [symbol, tf, series]);

  useEffect(() => { track('chart_opened', { symbol, timeframe: tf }); }, [symbol, tf]);

  useEffect(() => {
    if (!el.current) return;
    const c = createChart(el.current, {
      autoSize: true,
      layout: { background: { color: '#ffffff' }, textColor: '#475569', fontFamily: 'Inter' },
      grid: { vertLines: { color: '#f1f5f9' }, horzLines: { color: '#f1f5f9' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#e2e8f0' },
      timeScale: { borderColor: '#e2e8f0', timeVisible: true, secondsVisible: false },
    });
    refs.current.candles = c.addCandlestickSeries({ upColor: '#16a34a', downColor: '#dc2626', borderVisible: false, wickUpColor: '#16a34a', wickDownColor: '#dc2626' });
    refs.current.volume = c.addHistogramSeries({ priceScaleId: 'vol', priceFormat: { type: 'volume' } });
    c.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    refs.current.sma = c.addLineSeries({ color: '#2563eb', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    refs.current.ema = c.addLineSeries({ color: '#f59e0b', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    chart.current = c;
    lastKey.current = '';
    return () => c.remove();
  }, []);

  useEffect(() => {
    const r = refs.current;
    if (!r.candles || !candles.length) return;
    const data = candles.map((b) => ({ time: b.time as UTCTimestamp, open: b.open, high: b.high, low: b.low, close: b.close }));
    const vol = candles.map((b) => ({ time: b.time as UTCTimestamp, value: b.volume, color: b.close >= b.open ? 'rgba(22,163,74,.35)' : 'rgba(220,38,38,.35)' }));
    const key = `${symbol}|${tf}|${candles.length}`;
    if (key === lastKey.current) {
      r.candles.update(data[data.length - 1]);
      r.volume!.update(vol[vol.length - 1]);
    } else {
      const fresh = !lastKey.current.startsWith(`${symbol}|${tf}|`);
      r.candles.setData(data);
      r.volume!.setData(vol);
      if (fresh) chart.current?.timeScale().fitContent();
      lastKey.current = key;
    }
    r.sma!.setData(studies.sma20 ? sma(candles, 20) : []);
    r.ema!.setData(studies.ema50 ? ema(candles, 50) : []);
  }, [candles, studies]);

  if (!inst) return null;

  return (
    <Card
      title={
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-base">{symbol}</span>
          <Badge>{inst.segment === 'INDEX' ? 'Index' : inst.exchange}</Badge>
          {quote && (
            <>
              <span className={`text-base font-semibold tabular-nums ${tone(quote.change)}`}>{fmt(quote.ltp)}</span>
              <span className={`text-xs tabular-nums ${tone(quote.change)}`}>{fmt(quote.change)} ({pct(quote.changePct)})</span>
            </>
          )}
        </div>
      }
      actions={inst.tradable && (
        <>
          <Button size="sm" variant="buy" onClick={() => openOrderPad({ symbol, side: 'BUY' }, 'chart')}>Buy</Button>
          <Button size="sm" variant="sell" onClick={() => openOrderPad({ symbol, side: 'SELL' }, 'chart')}>Sell</Button>
        </>
      )}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-2">
        <Tabs value={tf} onChange={setTf} size="sm" options={(['1m', '5m', '15m', '1D'] as Timeframe[]).map((t) => ({ value: t, label: t }))} />
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={studies.sma20} onChange={(e) => setStudies({ ...studies, sma20: e.target.checked })} /> <span className="text-blue-600">SMA 20</span></label>
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={studies.ema50} onChange={(e) => setStudies({ ...studies, ema50: e.target.checked })} /> <span className="text-amber-600">EMA 50</span></label>
        {quote && (
          <div className="ml-auto flex gap-4 text-xs tabular-nums text-slate-500">
            <span>O <b className="text-slate-700">{fmt(quote.open)}</b></span>
            <span>H <b className="text-slate-700">{fmt(quote.high)}</b></span>
            <span>L <b className="text-slate-700">{fmt(quote.low)}</b></span>
            <span>Prev <b className="text-slate-700">{fmt(quote.prevClose)}</b></span>
            {quote.volume > 0 && <span>Vol <b className="text-slate-700">{compact(quote.volume)}</b></span>}
          </div>
        )}
      </div>
      <div className="grid lg:grid-cols-[1fr_220px]">
        <div ref={el} className="h-[420px] w-full" />
        {quote && inst.tradable && <Depth />}
      </div>
    </Card>
  );
}

/** Simulated 5-level market depth around the touch. */
function Depth() {
  const symbol = useUi((s) => s.chartSymbol);
  const q = useQuote(symbol)!;
  const inst = INSTRUMENT_MAP[symbol];
  const step = Math.max(inst.tickSize, Math.round((q.ltp * 0.0002) / inst.tickSize) * inst.tickSize);
  const size = (i: number, salt: number) => Math.round((Math.sin(q.ltp * (i + 1) * salt) + 1.3) * 400 * inst.lotSize);
  const bids = Array.from({ length: 5 }, (_, i) => ({ p: q.bid - i * step, q: size(i, 1.7) }));
  const asks = Array.from({ length: 5 }, (_, i) => ({ p: q.ask + i * step, q: size(i, 2.3) }));
  const max = Math.max(...bids.map((b) => b.q), ...asks.map((a) => a.q));
  return (
    <div className="border-t border-slate-100 p-3 text-xs tabular-nums lg:border-l lg:border-t-0">
      <div className="mb-2 font-semibold text-slate-600">Market depth</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="mb-1 flex justify-between text-slate-400"><span>Bid</span><span>Qty</span></div>
          {bids.map((b) => (
            <div key={b.p} className="relative flex justify-between py-0.5">
              <div className="absolute inset-y-0 right-0 bg-blue-50" style={{ width: `${(b.q / max) * 100}%` }} />
              <span className="relative text-blue-700">{fmt(b.p)}</span><span className="relative">{compact(b.q)}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="mb-1 flex justify-between text-slate-400"><span>Ask</span><span>Qty</span></div>
          {asks.map((a) => (
            <div key={a.p} className="relative flex justify-between py-0.5">
              <div className="absolute inset-y-0 left-0 bg-red-50" style={{ width: `${(a.q / max) * 100}%` }} />
              <span className="relative text-red-700">{fmt(a.p)}</span><span className="relative">{compact(a.q)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 space-y-1 text-slate-500">
        <div className="flex justify-between"><span>Upper circuit</span><b className="text-slate-700">{fmt(q.upperCircuit)}</b></div>
        <div className="flex justify-between"><span>Lower circuit</span><b className="text-slate-700">{fmt(q.lowerCircuit)}</b></div>
        {inst.lotSize > 1 && <div className="flex justify-between"><span>Lot size</span><b className="text-slate-700">{inst.lotSize}</b></div>}
        {q.oi !== undefined && <div className="flex justify-between"><span>Open interest</span><b className="text-slate-700">{compact(q.oi)}</b></div>}
      </div>
    </div>
  );
}
