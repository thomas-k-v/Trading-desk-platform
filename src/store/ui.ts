import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OrderDraft, Order } from '../api/types';

export type Page =
  | 'dashboard' | 'chart' | 'orders' | 'positions' | 'holdings' | 'funds'
  | 'reports' | 'optionchain' | 'mutualfunds' | 'alerts' | 'analytics' | 'watchlist';

export interface OrderPadState {
  open: boolean;
  draft?: Partial<OrderDraft> & { symbol: string; side: OrderDraft['side'] };
  source: Order['source'];
  /** When set, the pad modifies this open order instead of placing a new one. */
  modifyId?: string;
}

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info' | 'whatsapp';
  title: string;
  body?: string;
  action?: { label: string; symbol: string; side: OrderDraft['side'] };
}

interface UiState {
  page: Page;
  chartSymbol: string;
  orderPad: OrderPadState;
  toasts: Toast[];
  onboarded: boolean;
  setPage: (p: Page) => void;
  openChart: (symbol: string) => void;
  openOrderPad: (draft: OrderPadState['draft'], source?: Order['source'], modifyId?: string) => void;
  closeOrderPad: () => void;
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  setOnboarded: () => void;
}

let toastId = 1;

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      page: 'dashboard',
      chartSymbol: 'NIFTY 50',
      orderPad: { open: false, source: 'smart' },
      toasts: [],
      onboarded: false,
      setPage: (page) => set({ page }),
      openChart: (chartSymbol) => set({ chartSymbol, page: 'chart' }),
      openOrderPad: (draft, source = 'smart', modifyId) => set({ orderPad: { open: true, draft, source, modifyId } }),
      closeOrderPad: () => set((s) => ({ orderPad: { ...s.orderPad, open: false } })),
      toast: (t) => {
        const id = toastId++;
        set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
        setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.kind === 'whatsapp' ? 9000 : 5000);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
      setOnboarded: () => set({ onboarded: true }),
    }),
    { name: 'tradedesk-ui', partialize: (s) => ({ onboarded: s.onboarded, chartSymbol: s.chartSymbol }) },
  ),
);
