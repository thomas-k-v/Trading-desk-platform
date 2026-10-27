import { useUi } from '../../store/ui';
import { useAnalytics } from '../../analytics/track';
import { Button } from '../../components/ui';

export function Onboarding() {
  const onboarded = useUi((s) => s.onboarded);
  const done = useUi((s) => s.setOnboarded);
  const variant = useAnalytics((s) => s.variant);
  if (onboarded) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="slide-in w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand">Product prototype</div>
        <h1 className="text-xl font-semibold">Welcome to TradeDesk</h1>
        <p className="mt-2 text-sm text-slate-600">
          A working prototype of a broking app's core trading journeys — Watchlist, Order Pad, Order Book, Positions, Holdings, Funds, Reports — built to explore one product bet:
        </p>
        <blockquote className="my-4 rounded-lg border-l-4 border-brand bg-blue-50 p-3 text-sm text-blue-900">
          Catch order rejections <b>before</b> the user hits submit, explain them in plain language, and offer one-tap fixes.
        </blockquote>
        <ul className="space-y-1.5 text-sm text-slate-600">
          <li>💰 You start with <b>₹5,00,000</b> paper money and a sample portfolio.</li>
          <li>📈 Prices are <b>simulated</b> and tick every second — no real orders, no real data.</li>
          <li>🧪 You were assigned the <b>{variant === 'smart' ? 'Smart' : 'Classic'}</b> order pad. Switch with the A/B control in the header.</li>
          <li>📊 Everything you do is tracked in the <b>Analytics</b> tab.</li>
        </ul>
        <Button size="lg" className="mt-5 w-full" onClick={done}>Start trading</Button>
      </div>
    </div>
  );
}
