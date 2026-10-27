import { useEffect, useMemo, useRef, useState } from 'react';
import { INSTRUMENTS, INSTRUMENT_MAP } from '../../market/instruments';
import { useTrading } from '../../store/trading';
import { useMarket } from '../../store/market';
import { useUi } from '../../store/ui';
import { useQuote } from '../hooks';
import { fmt, pct, tone } from '../../lib/format';
import { track } from '../../analytics/track';
import { Badge } from '../../components/ui';

type Sort = 'manual' | 'change' | 'name';

function Row({ symbol, onRemove }: { symbol: string; onRemove: () => void }) {
  const q = useQuote(symbol);
  const inst = INSTRUMENT_MAP[symbol];
  const openOrderPad = useUi((s) => s.openOrderPad);
  const openChart = useUi((s) => s.openChart);
  const setPage = useUi((s) => s.setPage);
  const prev = useRef(q?.ltp);
  const [flash, setFlash] = useState('');
  useEffect(() => {
    if (!q) return;
    if (prev.current !== undefined && q.ltp !== prev.current) {
      setFlash(q.ltp > prev.current ? 'flash-up' : 'flash-down');
      const t = setTimeout(() => setFlash(''), 800);
      prev.current = q.ltp;
      return () => clearTimeout(t);
    }
    prev.current = q.ltp;
  }, [q?.ltp]);
  if (!q || !inst) return null;
  const segBadge = inst.segment === 'FUT' ? 'FUT' : inst.segment === 'OPT' ? 'OPT' : inst.exchange;
  return (
    <div className="group relative flex items-center justify-between border-b border-slate-100 px-4 py-2.5 hover:bg-slate-50">
      <button className="min-w-0 text-left" onClick={() => openChart(symbol)}>
        <div className={`truncate text-sm font-medium ${tone(q.change)}`}>{symbol}</div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Badge>{segBadge}</Badge>
          {inst.lotSize > 1 && <span>Lot {inst.lotSize}</span>}
        </div>
      </button>
      <div className="text-right tabular-nums group-hover:invisible">
        <div className={`rounded px-1 text-sm font-semibold ${tone(q.change)} ${flash}`}>{fmt(q.ltp)}</div>
        <div className="text-[11px] text-slate-500">{fmt(q.change)} ({pct(q.changePct)})</div>
      </div>
      <div className="absolute right-3 hidden items-center gap-1 group-hover:flex">
        {inst.tradable && (
          <>
            <button aria-label={`Buy ${symbol}`} onClick={() => openOrderPad({ symbol, side: 'BUY' })} className="rounded bg-up px-2 py-1 text-xs font-bold text-white">B</button>
            <button aria-label={`Sell ${symbol}`} onClick={() => openOrderPad({ symbol, side: 'SELL' })} className="rounded bg-down px-2 py-1 text-xs font-bold text-white">S</button>
          </>
        )}
        <button title="Chart" onClick={() => openChart(symbol)} className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs">📈</button>
        <button title="Set alert" onClick={() => { sessionStorage.setItem('alertSymbol', symbol); setPage('alerts'); }} className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs">🔔</button>
        <button title="Remove" onClick={onRemove} className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs">✕</button>
      </div>
    </div>
  );
}

export function Watchlist() {
  const watchlists = useTrading((s) => s.watchlists);
  const active = useTrading((s) => s.activeWatchlist);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('manual');
  const list = watchlists.find((w) => w.id === active) ?? watchlists[0];

  const results = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    return INSTRUMENTS.filter((i) => i.symbol.includes(q) || i.name.toUpperCase().includes(q)).slice(0, 12);
  }, [query]);

  useEffect(() => {
    if (!query) return;
    const t = setTimeout(() => track('search_performed', { query, results: results.length }), 600);
    return () => clearTimeout(t);
  }, [query, results.length]);

  const update = (symbols: string[]) =>
    useTrading.setState((s) => ({ watchlists: s.watchlists.map((w) => (w.id === list.id ? { ...w, symbols } : w)) }));

  const add = (symbol: string) => {
    if (!list.symbols.includes(symbol)) {
      update([...list.symbols, symbol]);
      track('watchlist_symbol_added', { symbol, watchlist: list.name });
    }
    setQuery('');
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-slate-200 p-3">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search & add: infy, nifty fut, 25800 ce"
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand focus:bg-white"
          />
          {results.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
              {results.map((i) => (
                <button key={i.symbol} onClick={() => add(i.symbol)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50">
                  <span>
                    <span className="font-medium">{i.symbol}</span>
                    <span className="ml-2 text-xs text-slate-400">{i.name}</span>
                  </span>
                  <span className="text-xs font-semibold text-brand">{list.symbols.includes(i.symbol) ? 'Added' : '+ Add'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 gap-1 overflow-x-auto">
            {watchlists.map((w) => (
              <button
                key={w.id}
                onClick={() => { useTrading.setState({ activeWatchlist: w.id }); track('watchlist_viewed', { watchlist: w.name, size: w.symbols.length }); }}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium ${w.id === list.id ? 'bg-blue-50 text-brand' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                {w.name} <span className="text-slate-400">{w.symbols.length}</span>
              </button>
            ))}
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="shrink-0 rounded border-none bg-transparent text-xs text-slate-500">
            <option value="manual">Sort: Added</option>
            <option value="change">Sort: % change</option>
            <option value="name">Sort: A–Z</option>
          </select>
        </div>
      </div>
      <SortedRows symbols={list.symbols} sort={sort} onRemove={(s) => { update(list.symbols.filter((x) => x !== s)); track('watchlist_symbol_removed', { symbol: s }); }} />
    </div>
  );
}


function SortedRows({ symbols, sort, onRemove }: { symbols: string[]; sort: Sort; onRemove: (s: string) => void }) {
  // Re-sort only every few seconds so rows don't jump on every tick.
  const [order, setOrder] = useState(symbols);
  useEffect(() => {
    const apply = () => {
      const quotes = useMarket.getState().quotes;
      const s = [...symbols];
      if (sort === 'change') s.sort((a, b) => (quotes[b]?.changePct ?? 0) - (quotes[a]?.changePct ?? 0));
      if (sort === 'name') s.sort();
      setOrder(s);
    };
    apply();
    if (sort !== 'change') return;
    const t = setInterval(apply, 5000);
    return () => clearInterval(t);
  }, [symbols, sort]);
  if (!symbols.length) return <div className="p-6 text-center text-sm text-slate-500">This watchlist is empty. Search above to add instruments.</div>;
  return (
    <div className="flex-1 overflow-y-auto">
      {order.filter((s) => symbols.includes(s)).map((s) => <Row key={s} symbol={s} onRemove={() => onRemove(s)} />)}
    </div>
  );
}
