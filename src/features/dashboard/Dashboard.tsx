import { EQUITIES } from '../../market/instruments';
import { useMarket } from '../../store/market';
import { useTrading } from '../../store/trading';
import { useUi } from '../../store/ui';
import { useAnalytics } from '../../analytics/track';
import { isWorking } from '../../engine/orderEngine';
import { useFunds, useHoldings } from '../hooks';
import { fmt, inr, pct, tone } from '../../lib/format';
import { Button, Card, Stat } from '../../components/ui';

export function Dashboard() {
  const quotes = useMarket((s) => s.quotes);
  const funds = useFunds();
  const holdings = useHoldings();
  const orders = useTrading((s) => s.orders);
  const alerts = useTrading((s) => s.alerts);
  const events = useAnalytics((s) => s.events);
  const { setPage, openChart, openOrderPad } = useUi();

  const dayPnl = funds.positions.reduce((a, p) => a + p.pnl, 0);
  const holdValue = holdings.reduce((a, h) => a + h.current, 0);
  const holdPnl = holdings.reduce((a, h) => a + h.pnl, 0);
  const movers = EQUITIES.map((i) => quotes[i.symbol]).sort((a, b) => b.changePct - a.changePct);

  const tasks = [
    { done: events.some((e) => e.name === 'order_executed'), label: 'Place and execute your first order', go: () => openOrderPad({ symbol: 'INFY', side: 'BUY' }) },
    { done: events.some((e) => e.name === 'pretrade_fix_applied'), label: 'Use a one-tap fix in the Smart Order Pad', go: () => openOrderPad({ symbol: Object.keys(quotes).find((s) => s.endsWith('FUT'))!, side: 'BUY', qty: 10 }) },
    { done: events.some((e) => e.name === 'position_squared_off'), label: 'Open an intraday position and square it off', go: () => openOrderPad({ symbol: 'SBIN', side: 'BUY', product: 'MIS', qty: 100 }) },
    { done: alerts.length > 0, label: 'Set a price alert with WhatsApp delivery', go: () => setPage('alerts') },
    { done: events.some((e) => e.name === 'option_chain_viewed'), label: 'Explore the NIFTY option chain', go: () => setPage('optionchain') },
    { done: events.some((e) => e.name === 'experiment_variant_changed'), label: 'Switch the A/B variant and compare in Analytics', go: () => setPage('analytics') },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Available margin" value={inr(funds.available, 0)} sub={<button className="text-brand" onClick={() => setPage('funds')}>Add funds →</button>} />
        <Stat label="Positions P&L (today)" value={<span className={tone(dayPnl)}>{inr(dayPnl)}</span>} sub={<button className="text-brand" onClick={() => setPage('positions')}>{funds.positions.filter((p) => p.netQty).length} open →</button>} />
        <Stat label="Holdings value" value={inr(holdValue, 0)} sub={<span className={tone(holdPnl)}>{inr(holdPnl, 0)} overall</span>} />
        <Stat label="Open orders" value={orders.filter(isWorking).length} sub={<button className="text-brand" onClick={() => setPage('orders')}>Order book →</button>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Indices" className="lg:col-span-1">
          <ul className="divide-y divide-slate-100">
            {['NIFTY 50', 'NIFTY BANK', 'SENSEX'].map((s) => {
              const q = quotes[s];
              return (
                <li key={s}>
                  <button onClick={() => openChart(s)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50">
                    <span className="text-sm font-medium">{s}</span>
                    <span className="text-right tabular-nums">
                      <span className={`block text-sm font-semibold ${tone(q.change)}`}>{fmt(q.ltp)}</span>
                      <span className={`text-xs ${tone(q.change)}`}>{fmt(q.change)} ({pct(q.changePct)})</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title="Top movers">
          <div className="grid grid-cols-2 divide-x divide-slate-100">
            {[movers.slice(0, 5), movers.slice(-5).reverse()].map((list, i) => (
              <ul key={i} className="divide-y divide-slate-50">
                <li className="px-3 py-1.5 text-[11px] font-semibold uppercase text-slate-400">{i ? 'Losers' : 'Gainers'}</li>
                {list.map((q) => (
                  <li key={q.symbol}>
                    <button onClick={() => openChart(q.symbol)} className="flex w-full justify-between px-3 py-1.5 text-xs hover:bg-slate-50">
                      <span className="font-medium">{q.symbol}</span>
                      <span className={`tabular-nums ${tone(q.change)}`}>{pct(q.changePct)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </Card>
        <Card title={`Guided tour · ${tasks.filter((t) => t.done).length}/${tasks.length}`}>
          <ul className="divide-y divide-slate-100">
            {tasks.map((t) => (
              <li key={t.label} className="flex items-center justify-between gap-2 px-4 py-2 text-xs">
                <span className={t.done ? 'text-slate-400 line-through' : ''}><span className={t.done ? 'text-up' : 'text-slate-300'}>●</span> {t.label}</span>
                {!t.done && <Button size="sm" variant="ghost" onClick={t.go}>Go</Button>}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="About this prototype">
        <div className="grid gap-4 p-4 text-sm text-slate-600 md:grid-cols-3">
          <div><b className="text-slate-800">Problem.</b> Order rejections (margin shortfall, wrong lot size, price outside band, selling unheld stock) are a leading cause of failed trades and support tickets, and legacy RMS messages don't tell users how to fix them.</div>
          <div><b className="text-slate-800">Bet.</b> A Smart Order Pad that runs the RMS checks <i>before</i> submit, explains them in plain language and offers one-tap fixes will lift order success rate and reduce time-to-trade.</div>
          <div><b className="text-slate-800">Proof.</b> The whole journey is instrumented; an A/B toggle compares Smart vs Classic live in the Analytics tab. PRD, stories, flows and metrics plan live in <code>/docs</code>.</div>
        </div>
      </Card>
    </div>
  );
}
