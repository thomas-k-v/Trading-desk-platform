import { useEffect, useMemo } from 'react';
import { DERIVATIVES, nextWeeklyExpiry, expiryLabel, NIFTY_LOT } from '../../market/instruments';
import { useMarket } from '../../store/market';
import { useUi } from '../../store/ui';
import { track } from '../../analytics/track';
import { compact, fmt, pct, tone } from '../../lib/format';
import { Card, Stat } from '../../components/ui';

const options = DERIVATIVES.filter((i) => i.segment === 'OPT');
const strikes = [...new Set(options.map((o) => o.strike!))].sort((a, b) => a - b);
const delta = (d = 0) => (Math.abs(d) < 0.005 ? 0 : d).toFixed(2);

export function OptionChain() {
  const quotes = useMarket((s) => s.quotes);
  const openOrderPad = useUi((s) => s.openOrderPad);
  const spot = quotes['NIFTY 50'];
  const expiry = nextWeeklyExpiry();
  const daysLeft = Math.max(0, (expiry.getTime() - Date.now()) / 86400000);

  useEffect(() => { track('option_chain_viewed', { underlying: 'NIFTY', expiry: expiry.toISOString().slice(0, 10) }); }, []);

  const rows = strikes.map((k) => {
    const ce = options.find((o) => o.strike === k && o.optionType === 'CE')!;
    const pe = options.find((o) => o.strike === k && o.optionType === 'PE')!;
    return { k, ce, pe, cq: quotes[ce.symbol], pq: quotes[pe.symbol] };
  });
  const maxOi = Math.max(...rows.flatMap((r) => [r.cq?.oi ?? 0, r.pq?.oi ?? 0]));
  const atm = strikes.reduce((a, b) => (Math.abs(b - spot.ltp) < Math.abs(a - spot.ltp) ? b : a), strikes[0]);
  const totalCe = rows.reduce((a, r) => a + (r.cq?.oi ?? 0), 0);
  const totalPe = rows.reduce((a, r) => a + (r.pq?.oi ?? 0), 0);

  // Max pain: strike where option writers' total payout is smallest.
  const maxPain = useMemo(() => {
    let best = strikes[0], bestPain = Infinity;
    for (const s of strikes) {
      let pain = 0;
      for (const r of rows) {
        pain += Math.max(0, s - r.k) * (r.cq?.oi ?? 0) + Math.max(0, r.k - s) * (r.pq?.oi ?? 0);
      }
      if (pain < bestPain) { bestPain = pain; best = s; }
    }
    return best;
  }, [Math.round(spot.ltp / 10)]);

  const cell = (sym: string, side: 'BUY' | 'SELL') => openOrderPad({ symbol: sym, side, product: 'NRML', qty: NIFTY_LOT }, 'option_chain');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="NIFTY spot" value={fmt(spot.ltp)} sub={<span className={tone(spot.change)}>{pct(spot.changePct)}</span>} />
        <Stat label="Expiry" value={expiryLabel(expiry)} sub={`${daysLeft.toFixed(1)} days left`} />
        <Stat label="PCR (OI)" value={(totalPe / totalCe).toFixed(2)} sub={totalPe > totalCe ? 'Put-heavy: support below' : 'Call-heavy: resistance above'} />
        <Stat label="Max pain" value={maxPain} />
        <Stat label="Lot size" value={NIFTY_LOT} />
      </div>
      <Card title="NIFTY option chain" actions={<span className="text-xs text-slate-400">Click LTP to buy · right-click to sell</span>}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500">
                <th colSpan={4} className="py-2 text-center font-semibold text-slate-700">CALLS</th>
                <th className="bg-slate-50" />
                <th colSpan={4} className="py-2 text-center font-semibold text-slate-700">PUTS</th>
              </tr>
              <tr className="border-b border-slate-100 text-[11px] uppercase text-slate-400">
                <th className="px-2 py-1.5 text-right">OI</th><th className="px-2 text-right">IV</th><th className="px-2 text-right">Δ</th><th className="px-2 text-right">LTP</th>
                <th className="bg-slate-50 px-3 text-center">Strike</th>
                <th className="px-2 text-left">LTP</th><th className="px-2 text-left">Δ</th><th className="px-2 text-left">IV</th><th className="px-2 text-left">OI</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ k, ce, pe, cq, pq }) => {
                const itmCall = k < spot.ltp, itmPut = k > spot.ltp;
                return (
                  <tr key={k} className={`border-b border-slate-50 ${k === atm ? 'outline outline-1 outline-blue-300' : ''}`}>
                    <td className={`relative px-2 py-1.5 text-right ${itmCall ? 'bg-amber-50/60' : ''}`}>
                      <div className="absolute inset-y-1 right-0 bg-red-100" style={{ width: `${((cq?.oi ?? 0) / maxOi) * 100}%` }} />
                      <span className="relative">{compact(cq?.oi ?? 0)}</span>
                    </td>
                    <td className={`px-2 text-right text-slate-500 ${itmCall ? 'bg-amber-50/60' : ''}`}>{((cq?.iv ?? 0) * 100).toFixed(1)}</td>
                    <td className={`px-2 text-right text-slate-500 ${itmCall ? 'bg-amber-50/60' : ''}`}>{delta(cq?.delta)}</td>
                    <td className={`px-2 text-right ${itmCall ? 'bg-amber-50/60' : ''}`}>
                      <button onClick={() => cell(ce.symbol, 'BUY')} onContextMenu={(e) => { e.preventDefault(); cell(ce.symbol, 'SELL'); }} className={`rounded px-1.5 py-0.5 font-semibold hover:bg-blue-100 ${tone(cq?.change ?? 0)}`}>{fmt(cq?.ltp ?? 0)}</button>
                    </td>
                    <td className="bg-slate-50 px-3 text-center font-semibold">{k}{k === atm && <div className="text-[9px] font-bold text-brand">ATM</div>}</td>
                    <td className={`px-2 text-left ${itmPut ? 'bg-amber-50/60' : ''}`}>
                      <button onClick={() => cell(pe.symbol, 'BUY')} onContextMenu={(e) => { e.preventDefault(); cell(pe.symbol, 'SELL'); }} className={`rounded px-1.5 py-0.5 font-semibold hover:bg-blue-100 ${tone(pq?.change ?? 0)}`}>{fmt(pq?.ltp ?? 0)}</button>
                    </td>
                    <td className={`px-2 text-left text-slate-500 ${itmPut ? 'bg-amber-50/60' : ''}`}>{delta(pq?.delta)}</td>
                    <td className={`px-2 text-left text-slate-500 ${itmPut ? 'bg-amber-50/60' : ''}`}>{((pq?.iv ?? 0) * 100).toFixed(1)}</td>
                    <td className={`relative px-2 text-left ${itmPut ? 'bg-amber-50/60' : ''}`}>
                      <div className="absolute inset-y-1 left-0 bg-green-100" style={{ width: `${((pq?.oi ?? 0) / maxOi) * 100}%` }} />
                      <span className="relative">{compact(pq?.oi ?? 0)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-[11px] text-slate-400">Shaded = in-the-money. Premiums are Black-Scholes values on the simulated spot with a volatility smile; not live data.</div>
      </Card>
    </div>
  );
}
