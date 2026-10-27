import { useMemo } from 'react';
import { INSTRUMENT_MAP, MF_MAP } from '../../market/instruments';
import { mfNav, useTrading } from '../../store/trading';
import { useMarket } from '../../store/market';
import { useUi } from '../../store/ui';
import { useHoldings } from '../hooks';
import { fmt, inr, pct, tone } from '../../lib/format';
import { Button, Card, Empty, Stat, Table, Td } from '../../components/ui';

const PALETTE = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#64748b'];

function Donut({ slices }: { slices: { label: string; value: number }[] }) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  let acc = 0;
  const r = 42, c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
        {slices.map((s, i) => {
          const len = (s.value / total) * c;
          const el = <circle key={s.label} cx="50" cy="50" r={r} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="14" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} />;
          acc += len;
          return el;
        })}
      </svg>
      <ul className="space-y-1 text-xs">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="w-24 text-slate-600">{s.label}</span>
            <span className="font-medium tabular-nums">{((s.value / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Holdings() {
  const holdings = useHoldings();
  const mf = useTrading((s) => s.mfHoldings);
  const quotes = useMarket((s) => s.quotes);
  const openOrderPad = useUi((s) => s.openOrderPad);
  const openChart = useUi((s) => s.openChart);

  const mfRows = mf.map((h) => {
    const nav = mfNav(h.code, quotes);
    return { ...h, nav, current: h.units * nav, fund: MF_MAP[h.code] };
  });
  const eqInvested = holdings.reduce((a, h) => a + h.invested, 0);
  const eqCurrent = holdings.reduce((a, h) => a + h.current, 0);
  const mfInvested = mfRows.reduce((a, h) => a + h.invested, 0);
  const mfCurrent = mfRows.reduce((a, h) => a + h.current, 0);
  const invested = eqInvested + mfInvested;
  const current = eqCurrent + mfCurrent;
  const day = holdings.reduce((a, h) => a + h.dayChange, 0);

  const sectors = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of holdings) m.set(INSTRUMENT_MAP[h.symbol]?.sector ?? 'Other', (m.get(INSTRUMENT_MAP[h.symbol]?.sector ?? 'Other') ?? 0) + h.current);
    if (mfCurrent) m.set('Mutual funds', mfCurrent);
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [holdings, mfCurrent]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Invested" value={inr(invested, 0)} />
        <Stat label="Current value" value={inr(current, 0)} />
        <Stat label="Total P&L" value={<span className={tone(current - invested)}>{inr(current - invested, 0)}</span>} sub={<span className={tone(current - invested)}>{pct(((current - invested) / invested) * 100)}</span>} />
        <Stat label="Day's P&L (stocks)" value={<span className={tone(day)}>{inr(day, 0)}</span>} />
      </div>
      <Card title={`Stocks (${holdings.length})`}>
          {holdings.length === 0 ? <Empty title="No holdings" body="Delivery (CNC) buys appear here." /> : (
            <Table head={['Stock', 'Qty', 'Avg cost', 'LTP', 'Current', 'P&L', 'Day', '']}>
              {holdings.map((h) => (
                <tr key={h.symbol} className="hover:bg-slate-50">
                  <Td left><button className="font-medium hover:text-brand" onClick={() => openChart(h.symbol)}>{h.symbol}</button></Td>
                  <Td>{h.qty}</Td>
                  <Td>{fmt(h.avgPrice)}</Td>
                  <Td>{fmt(h.ltp)}</Td>
                  <Td>{inr(h.current, 0)}</Td>
                  <Td className={tone(h.pnl)}>{inr(h.pnl, 0)}<div className="text-[11px]">{pct(h.pnlPct)}</div></Td>
                  <Td className={tone(h.dayChangePct)}>{pct(h.dayChangePct)}</Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => openOrderPad({ symbol: h.symbol, side: 'BUY', product: 'CNC' })}>Buy</Button>
                      <Button size="sm" variant="sell" onClick={() => openOrderPad({ symbol: h.symbol, side: 'SELL', product: 'CNC', qty: h.qty })}>Sell</Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title={`Mutual funds (${mfRows.length})`} className="xl:col-span-2">
          {mfRows.length === 0 ? <Empty title="No mutual funds" /> : (
            <Table head={['Fund', 'NAV', 'Invested', 'Current', 'Returns']}>
              {mfRows.map((h) => (
                <tr key={h.code}>
                  <Td left><div className="font-medium">{h.fund.name}</div><div className="text-[11px] text-slate-400">{h.fund.category} · {h.units.toFixed(3)} units</div></Td>
                  <Td>{fmt(h.nav)}</Td>
                  <Td>{inr(h.invested, 0)}</Td>
                  <Td>{inr(h.current, 0)}</Td>
                  <Td className={tone(h.current - h.invested)}>{inr(h.current - h.invested, 0)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card title="Allocation">
          <div className="p-4"><Donut slices={sectors} /></div>
        </Card>
      </div>
    </div>
  );
}
