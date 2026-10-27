import { useState } from 'react';
import { useUi, type Page } from '../../store/ui';
import { NAV } from './Header';

const TABS: { page: Page; label: string; icon: string }[] = [
  { page: 'watchlist', label: 'Watchlist', icon: '☰' },
  { page: 'orders', label: 'Orders', icon: '⇅' },
  { page: 'positions', label: 'Positions', icon: '◧' },
  { page: 'holdings', label: 'Portfolio', icon: '◔' },
];

export function MobileNav() {
  const page = useUi((s) => s.page);
  const setPage = useUi((s) => s.setPage);
  const [more, setMore] = useState(false);
  const go = (p: Page) => { setPage(p); setMore(false); };
  return (
    <>
      {more && (
        <div className="fixed inset-0 z-30 bg-slate-900/30 md:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-x-0 bottom-14 grid grid-cols-3 gap-2 rounded-t-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            {NAV.filter((n) => !TABS.some((t) => t.page === n.page)).map((n) => (
              <button key={n.page} onClick={() => go(n.page)} className={`rounded-lg border px-2 py-3 text-xs font-medium ${page === n.page ? 'border-brand text-brand' : 'border-slate-200 text-slate-600'}`}>{n.label}</button>
            ))}
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid h-14 grid-cols-5 border-t border-slate-200 bg-white md:hidden">
        {TABS.map((t) => (
          <button key={t.page} onClick={() => go(t.page)} className={`flex flex-col items-center justify-center text-[10px] font-medium ${page === t.page ? 'text-brand' : 'text-slate-500'}`}>
            <span className="text-base leading-none">{t.icon}</span>{t.label}
          </button>
        ))}
        <button onClick={() => setMore(!more)} className={`flex flex-col items-center justify-center text-[10px] font-medium ${more ? 'text-brand' : 'text-slate-500'}`}>
          <span className="text-base leading-none">⋯</span>More
        </button>
      </nav>
    </>
  );
}
