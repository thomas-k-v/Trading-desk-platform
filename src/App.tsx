import { useEffect } from 'react';
import { useMarket } from './store/market';
import { useUi } from './store/ui';
import { onAlert, onFill, runMatching } from './api/mockBroker';
import { track, useAnalytics } from './analytics/track';
import { alertMessage } from './features/alerts/Alerts';
import { inr } from './lib/format';
import { Header } from './features/layout/Header';
import { MobileNav } from './features/layout/MobileNav';
import { Toasts } from './features/layout/Toasts';
import { Onboarding } from './features/layout/Onboarding';
import { Watchlist } from './features/watchlist/Watchlist';
import { OrderPad } from './features/orderpad/OrderPad';
import { Dashboard } from './features/dashboard/Dashboard';
import { ChartView } from './features/chart/ChartView';
import { OrderBook } from './features/orderbook/OrderBook';
import { Positions } from './features/positions/Positions';
import { Holdings } from './features/portfolio/Holdings';
import { Funds } from './features/funds/Funds';
import { Reports } from './features/reports/Reports';
import { OptionChain } from './features/optionchain/OptionChain';
import { MutualFunds } from './features/mutualfunds/MutualFunds';
import { Alerts } from './features/alerts/Alerts';
import { AnalyticsView } from './features/analytics/AnalyticsView';

const PAGES = {
  dashboard: Dashboard,
  chart: ChartView,
  orders: OrderBook,
  positions: Positions,
  holdings: Holdings,
  funds: Funds,
  reports: Reports,
  optionchain: OptionChain,
  mutualfunds: MutualFunds,
  alerts: Alerts,
  analytics: AnalyticsView,
  watchlist: Watchlist,
};

export default function App() {
  const page = useUi((s) => s.page);
  const toast = useUi((s) => s.toast);
  const Page = PAGES[page];

  useEffect(() => {
    // Deep links, e.g. ?page=chart&symbol=INFY&variant=smart&tour=0 (used for demos and screenshots).
    const params = new URLSearchParams(location.search);
    const linkPage = params.get('page') as keyof typeof PAGES | null;
    if (linkPage && linkPage in PAGES) useUi.setState({ page: linkPage });
    if (params.get('symbol')) useUi.setState({ chartSymbol: params.get('symbol')! });
    const v = params.get('variant');
    if (v === 'smart' || v === 'classic') useAnalytics.setState({ variant: v });
    if (params.get('tour') === '0') useUi.setState({ onboarded: true });
    const pad = params.get('pad');
    if (pad) useUi.getState().openOrderPad({ symbol: pad, side: params.get('side') === 'SELL' ? 'SELL' : 'BUY', qty: Number(params.get('qty')) || undefined });

    track('app_opened', { ua: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop' });
    const id = setInterval(() => {
      useMarket.getState().tick();
      runMatching();
    }, 1000);
    const offFill = onFill((o) => {
      if (o.status === 'COMPLETE' && o.orderType !== 'MARKET') {
        toast({ kind: 'success', title: `Executed: ${o.side} ${o.qty} ${o.symbol}`, body: `Avg ${inr(o.avgPrice)} · ${o.orderType}` });
      }
    });
    const offAlert = onAlert((a) => {
      toast(
        a.channels.whatsapp
          ? { kind: 'whatsapp', title: `${a.symbol} ${a.condition === 'ABOVE' ? '▲' : '▼'} ${inr(a.triggeredPrice ?? a.price)}`, body: alertMessage(a).replace(/\*/g, ''), action: { label: 'Buy now', symbol: a.symbol, side: 'BUY' } }
          : { kind: 'info', title: `Alert: ${a.symbol} ${a.condition.toLowerCase()} ${inr(a.price)}` },
      );
    });
    return () => { clearInterval(id); offFill(); offAlert(); };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[340px] shrink-0 border-r border-slate-200 md:block">
          <Watchlist />
        </aside>
        <main className={`min-w-0 flex-1 overflow-y-auto pb-20 md:pb-6 ${page === 'watchlist' ? '' : 'p-4 md:p-5'}`}>
          {page === 'watchlist' ? <div className="h-full md:hidden"><Watchlist /></div> : <Page />}
          {page === 'watchlist' && <div className="hidden p-5 md:block"><Dashboard /></div>}
        </main>
      </div>
      <MobileNav />
      <OrderPad />
      <Toasts />
      <Onboarding />
    </div>
  );
}
