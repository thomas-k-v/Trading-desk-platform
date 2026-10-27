import { useMemo, useState } from 'react';
import { EVENTS, type EventName } from '../../analytics/events';
import { useAnalytics, type TrackedEvent, type Variant } from '../../analytics/track';
import { time } from '../../lib/format';
import { Badge, Button, Card, Empty, Stat, Table, Td } from '../../components/ui';

const FUNNEL: EventName[] = ['order_pad_opened', 'order_review_shown', 'order_placed', 'order_executed'];

function metrics(events: TrackedEvent[]) {
  const count = (n: EventName) => events.filter((e) => e.name === n).length;
  const placed = count('order_placed');
  const rejected = count('order_rejected');
  const attempts = placed + rejected;
  return {
    funnel: FUNNEL.map((n) => ({ name: n, value: count(n) })),
    attempts,
    rejected,
    rejectionRate: attempts ? (rejected / attempts) * 100 : 0,
    successRate: attempts ? (placed / attempts) * 100 : 0,
    fixes: count('pretrade_fix_applied'),
    blocked: count('pretrade_check_failed'),
  };
}

export function AnalyticsView() {
  const events = useAnalytics((s) => s.events);
  const clear = useAnalytics((s) => s.clear);
  const [filter, setFilter] = useState<EventName | ''>('');
  const byVariant = useMemo(() => {
    const out = {} as Record<Variant, ReturnType<typeof metrics>>;
    for (const v of ['smart', 'classic'] as Variant[]) out[v] = metrics(events.filter((e) => e.variant === v));
    return out;
  }, [events]);
  const reasons = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events.filter((e) => e.name === 'order_rejected')) m.set(String(e.props.reason), (m.get(String(e.props.reason)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [events]);
  const shown = (filter ? events.filter((e) => e.name === filter) : events).slice(-200).reverse();

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <b>Live product analytics from your own session.</b> Every interaction is tracked against the taxonomy in <code>docs/09-analytics-tracking-plan.md</code>.
        Switch the order pad experiment between <b>Smart</b> and <b>Classic</b> in the header, try a few orders in each, and compare the funnels below.
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {(['smart', 'classic'] as Variant[]).map((v) => {
          const m = byVariant[v];
          const top = m.funnel[0].value || 1;
          return (
            <Card key={v} title={<>Variant: <Badge color={v === 'smart' ? 'green' : 'slate'}>{v === 'smart' ? 'Smart order pad' : 'Classic (control)'}</Badge></>}>
              <div className="grid grid-cols-3 gap-2 p-4">
                <Stat label="Order attempts" value={m.attempts} />
                <Stat label="RMS rejection rate" value={<span className={m.rejectionRate > 0 ? 'text-down' : ''}>{m.rejectionRate.toFixed(1)}%</span>} />
                <Stat label="One-tap fixes" value={m.fixes} sub={`${m.blocked} blocks shown`} />
              </div>
              <div className="space-y-2 px-4 pb-4">
                {m.funnel.map((s, i) => (
                  <div key={s.name}>
                    <div className="mb-0.5 flex justify-between text-xs"><span className="text-slate-600">{i + 1}. {s.name}</span><b className="tabular-nums">{s.value}{i > 0 && m.funnel[i - 1].value ? <span className="ml-1 font-normal text-slate-400">({((s.value / m.funnel[i - 1].value) * 100).toFixed(0)}%)</span> : null}</b></div>
                    <div className="h-2.5 rounded bg-slate-100"><div className={`h-2.5 rounded ${v === 'smart' ? 'bg-up' : 'bg-slate-400'}`} style={{ width: `${(s.value / top) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Top rejection reasons">
          {reasons.length === 0 ? <Empty title="No rejections yet" body="Try the Classic pad with an F&O order of 10 qty, or a delivery sell of a stock you don't hold." /> : (
            <ul className="divide-y divide-slate-100">
              {reasons.map(([r, n]) => (
                <li key={r} className="flex justify-between px-4 py-2 text-sm"><code className="text-xs">{r}</code><b>{n}</b></li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={`Event stream (${events.length})`} className="lg:col-span-2" actions={
          <>
            <select value={filter} onChange={(e) => setFilter(e.target.value as EventName | '')} className="rounded border border-slate-300 px-2 py-1 text-xs">
              <option value="">All events</option>
              {Object.keys(EVENTS).map((k) => <option key={k}>{k}</option>)}
            </select>
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </>
        }>
          <div className="max-h-96 overflow-y-auto">
            <Table head={['Time', 'Event', 'Variant', 'Properties']}>
              {shown.map((e) => (
                <tr key={e.id}>
                  <Td left className="text-slate-500">{time(e.ts)}</Td>
                  <Td left><code className="text-xs">{e.name}</code></Td>
                  <Td><Badge color={e.variant === 'smart' ? 'green' : 'slate'}>{e.variant}</Badge></Td>
                  <Td left><code className="block max-w-md truncate text-[11px] text-slate-500">{JSON.stringify(e.props)}</code></Td>
                </tr>
              ))}
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
