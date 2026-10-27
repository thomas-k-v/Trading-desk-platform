import { useMemo, useState } from 'react';
import type { MutualFund } from '../../api/types';
import { MUTUAL_FUNDS, MF_MAP } from '../../market/instruments';
import { mfNav, useTrading } from '../../store/trading';
import { useMarket } from '../../store/market';
import { useUi } from '../../store/ui';
import { investLumpsum, startSip, toggleSip } from '../../api/mockBroker';
import { hashString, mulberry32, gaussian } from '../../market/rng';
import { compact, fmt, inr } from '../../lib/format';
import { Badge, Button, Card, Field, Table, Tabs, Td, inputCls } from '../../components/ui';

/** Weekly NAV path for 3 years that ends at today's NAV and matches the 3Y CAGR. */
function navHistory(f: MutualFund) {
  const rand = mulberry32(hashString(f.code));
  const weeks = 156;
  const drift = Math.log(1 + f.cagr3y / 100) / 52;
  const vol = f.risk === 'Low' ? 0.0008 : f.risk === 'Moderate' ? 0.012 : 0.022;
  const pts = [f.nav];
  for (let i = 1; i < weeks; i++) pts.unshift(pts[0] / Math.exp(drift + gaussian(rand) * vol));
  return pts;
}

function Sparkline({ values }: { values: number[] }) {
  const min = Math.min(...values), max = Math.max(...values);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${(i / (values.length - 1)) * 300},${100 - ((v - min) / (max - min || 1)) * 90 - 5}`).join(' ');
  return (
    <svg viewBox="0 0 300 100" className="h-32 w-full" preserveAspectRatio="none">
      <path d={`${d} L300,100 L0,100 Z`} fill="rgba(37,99,235,.08)" />
      <path d={d} fill="none" stroke="#2563eb" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Future value of a monthly SIP. */
export const sipFutureValue = (monthly: number, annualPct: number, years: number) => {
  const r = annualPct / 100 / 12, n = years * 12;
  return r === 0 ? monthly * n : monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
};

export function MutualFunds() {
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState<MutualFund>(MUTUAL_FUNDS[0]);
  const categories = ['All', ...new Set(MUTUAL_FUNDS.map((f) => f.category))];
  const funds = MUTUAL_FUNDS.filter((f) => category === 'All' || f.category === category);
  const sips = useTrading((s) => s.sips);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={`rounded-full border px-3 py-1 text-xs font-medium ${c === category ? 'border-brand bg-blue-50 text-brand' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>{c}</button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card title="Explore funds" className="lg:col-span-3">
          <Table head={['Fund', '1Y', '3Y', '5Y', 'Expense']}>
            {funds.map((f) => (
              <tr key={f.code} onClick={() => setSelected(f)} className={`cursor-pointer hover:bg-slate-50 ${selected.code === f.code ? 'bg-blue-50/50' : ''}`}>
                <Td left>
                  <div className="font-medium">{f.name}</div>
                  <div className="mt-0.5 flex gap-1"><Badge>{f.category}</Badge><Badge color={f.risk === 'Low' ? 'green' : f.risk === 'Moderate' ? 'amber' : 'red'}>{f.risk}</Badge></div>
                </Td>
                <Td className="text-up">{f.cagr1y}%</Td>
                <Td className="text-up">{f.cagr3y}%</Td>
                <Td className="text-up">{f.cagr5y}%</Td>
                <Td>{f.expenseRatio}%<div className="text-[11px] text-slate-400">AUM ₹{compact(f.aumCr * 1e7)}</div></Td>
              </tr>
            ))}
          </Table>
        </Card>
        <FundDetail key={selected.code} fund={selected} />
      </div>
      <Card title={`My SIPs (${sips.length})`}>
        <Table head={['Fund', 'Amount', 'Date', 'Status', '']}>
          {sips.map((s) => (
            <tr key={s.id}>
              <Td left className="font-medium">{MF_MAP[s.code]?.name}</Td>
              <Td>{inr(s.amount, 0)}</Td>
              <Td>{s.dayOfMonth} of every month</Td>
              <Td><Badge color={s.active ? 'green' : 'slate'}>{s.active ? 'Active' : 'Paused'}</Badge></Td>
              <Td><Button size="sm" variant="ghost" onClick={() => toggleSip(s.id)}>{s.active ? 'Pause' : 'Resume'}</Button></Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}

function FundDetail({ fund }: { fund: MutualFund }) {
  const quotes = useMarket((s) => s.quotes);
  const toast = useUi((s) => s.toast);
  const [mode, setMode] = useState<'sip' | 'lumpsum'>('sip');
  const [amount, setAmount] = useState(String(Math.max(fund.minSip, 1000)));
  const [day, setDay] = useState(5);
  const [years, setYears] = useState(10);
  const history = useMemo(() => navHistory(fund), [fund]);
  const nav = mfNav(fund.code, quotes);
  const n = Number(amount) || 0;
  const fv = sipFutureValue(n, fund.cagr5y, years);
  const min = mode === 'sip' ? fund.minSip : fund.minLumpsum;

  const submit = async () => {
    if (n < min) return toast({ kind: 'error', title: `Minimum is ${inr(min, 0)}` });
    const r = mode === 'sip' ? await startSip(fund.code, n, day) : await investLumpsum(fund.code, n);
    if (r.status === 'success') toast({ kind: 'success', title: mode === 'sip' ? `SIP of ${inr(n, 0)} started` : `Invested ${inr(n, 0)}`, body: fund.name });
    else toast({ kind: 'error', title: r.error.message });
  };

  return (
    <Card title={fund.name} className="lg:col-span-2">
      <div className="space-y-4 p-4">
        <div className="flex items-baseline justify-between">
          <div><div className="text-xs text-slate-500">NAV</div><div className="text-xl font-semibold tabular-nums">{fmt(nav, 4)}</div></div>
          <div className="text-right text-xs text-slate-500">3Y NAV trend</div>
        </div>
        <Sparkline values={history} />
        <Tabs value={mode} onChange={setMode} options={[{ value: 'sip', label: 'Monthly SIP' }, { value: 'lumpsum', label: 'One-time' }]} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)" hint={`Min ${inr(min, 0)}`}>
            <input className={inputCls} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          {mode === 'sip' && (
            <Field label="SIP date">
              <select className={inputCls} value={day} onChange={(e) => setDay(Number(e.target.value))}>
                {[1, 5, 10, 15, 20, 25].map((d) => <option key={d} value={d}>{d} of month</option>)}
              </select>
            </Field>
          )}
        </div>
        {mode === 'sip' && (
          <div className="rounded-lg bg-slate-50 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">If you invest for</span>
              <input type="range" min={1} max={25} value={years} onChange={(e) => setYears(Number(e.target.value))} className="mx-2 flex-1" />
              <b>{years} yrs</b>
            </div>
            <div className="mt-2 flex justify-between"><span className="text-slate-500">Invested</span><b className="tabular-nums">{inr(n * 12 * years, 0)}</b></div>
            <div className="flex justify-between"><span className="text-slate-500">Projected at {fund.cagr5y}% p.a.</span><b className="tabular-nums text-up">{inr(fv, 0)}</b></div>
            <div className="mt-1 text-[10px] text-slate-400">Past returns are not a guarantee of future returns.</div>
          </div>
        )}
        <Button className="w-full" onClick={submit}>{mode === 'sip' ? 'Start SIP' : 'Invest now'}</Button>
      </div>
    </Card>
  );
}
