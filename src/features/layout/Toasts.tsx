import { useUi } from '../../store/ui';
import { track } from '../../analytics/track';

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  const openOrderPad = useUi((s) => s.openOrderPad);
  return (
    <div className="pointer-events-none fixed bottom-16 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 md:bottom-4 md:left-auto md:right-4 md:translate-x-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`slide-in pointer-events-auto rounded-xl p-3 text-sm shadow-lg ring-1 ${
            t.kind === 'whatsapp' ? 'bg-[#dcf8c6] ring-green-300' : t.kind === 'error' ? 'bg-white ring-red-200' : 'bg-white ring-slate-200'
          }`}
        >
          <div className="flex items-start gap-2">
            <span className={t.kind === 'error' ? 'text-down' : t.kind === 'success' ? 'text-up' : t.kind === 'whatsapp' ? 'text-green-700' : 'text-brand'}>
              {t.kind === 'error' ? '✕' : t.kind === 'success' ? '✓' : t.kind === 'whatsapp' ? '💬' : 'ℹ'}
            </span>
            <div className="min-w-0 flex-1">
              {t.kind === 'whatsapp' && <div className="text-[10px] font-semibold uppercase text-green-800">WhatsApp · TradeDesk Alerts</div>}
              <div className="font-semibold text-slate-800">{t.title}</div>
              {t.body && <div className="mt-0.5 break-words text-xs text-slate-600">{t.body}</div>}
              {t.action && (
                <button
                  onClick={() => { track('alert_cta_clicked', { symbol: t.action!.symbol, cta: t.action!.side, surface: 'toast' }); openOrderPad({ symbol: t.action!.symbol, side: t.action!.side }, 'alert'); dismiss(t.id); }}
                  className="mt-1.5 rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-green-800 shadow-sm"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-slate-400">×</button>
          </div>
        </div>
      ))}
    </div>
  );
}
