import { useMarket } from '../../store/market';
import { useTrading } from '../../store/trading';
import { useUi, type Page } from '../../store/ui';
import { useAnalytics, track } from '../../analytics/track';
import { useFunds } from '../hooks';
import { fmt, inr, pct, tone } from '../../lib/format';

export const NAV: { page: Page; label: string }[] = [
  { page: 'dashboard', label: 'Dashboard' },
  { page: 'orders', label: 'Orders' },
  { page: 'positions', label: 'Positions' },
  { page: 'holdings', label: 'Holdings' },
  { page: 'funds', label: 'Funds' },
  { page: 'optionchain', label: 'Option chain' },
  { page: 'mutualfunds', label: 'Mutual funds' },
  { page: 'alerts', label: 'Alerts' },
  { page: 'reports', label: 'Reports' },
  { page: 'analytics', label: 'Analytics' },
];

function IndexTicker({ symbol, label }: { symbol: string; label: string }) {
  const q = useMarket((s) => s.quotes[symbol]);
  const openChart = useUi((s) => s.openChart);
  return (
    <button onClick={() => openChart(symbol)} className="whitespace-nowrap text-left text-xs tabular-nums">
      <span className="font-semibold text-slate-700">{label}</span>{' '}
      <span className={tone(q.change)}>{fmt(q.ltp)}</span>{' '}
      <span className={`${tone(q.change)} hidden sm:inline`}>{pct(q.changePct)}</span>
    </button>
  );
}

export function Header() {
  const page = useUi((s) => s.page);
  const setPage = useUi((s) => s.setPage);
  const marketOpen = useMarket((s) => s.marketOpen);
  const setMarketOpen = useMarket((s) => s.setMarketOpen);
  const variant = useAnalytics((s) => s.variant);
  const setVariant = useAnalytics((s) => s.setVariant);
  const funds = useFunds();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="flex items-center gap-4 px-4 py-2">
        <button onClick={() => setPage('dashboard')} className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">T</span>
          <span className="hidden font-semibold sm:inline">TradeDesk</span>
        </button>
        <div className="flex min-w-0 gap-4 overflow-x-auto">
          <IndexTicker symbol="NIFTY 50" label="NIFTY" />
          <IndexTicker symbol="NIFTY BANK" label="BANKNIFTY" />
          <span className="hidden lg:inline"><IndexTicker symbol="SENSEX" label="SENSEX" /></span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 text-xs">
          <span className="hidden text-slate-500 xl:inline">Margin <b className="tabular-nums text-slate-800">{inr(funds.available, 0)}</b></span>
          <button
            title="Toggle the simulated market session"
            onClick={() => setMarketOpen(!marketOpen)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${marketOpen ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${marketOpen ? 'animate-pulse bg-green-600' : 'bg-slate-400'}`} />
            {marketOpen ? 'Market open' : 'Market closed'}
          </button>
          <label className="hidden items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 font-semibold text-violet-700 sm:flex" title="A/B experiment: order pad variant">
            A/B
            <select
              value={variant}
              onChange={(e) => { const v = e.target.value as typeof variant; track('experiment_variant_changed', { from: variant, to: v }); setVariant(v); }}
              className="bg-transparent font-semibold outline-none"
            >
              <option value="smart">Smart pad</option>
              <option value="classic">Classic pad</option>
            </select>
          </label>
          <button
            title="Reset demo data"
            onClick={() => { if (confirm('Reset all simulated orders, funds and holdings?')) { useTrading.getState().reset(); } }}
            className="rounded-full px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >↺</button>
        </div>
      </div>
      <nav className="hidden gap-1 overflow-x-auto px-3 md:flex">
        {NAV.map((n) => (
          <button
            key={n.page}
            onClick={() => setPage(n.page)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${page === n.page ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {n.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
