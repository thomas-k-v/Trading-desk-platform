import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EventName } from './events';

export type Variant = 'smart' | 'classic';

export interface TrackedEvent {
  id: number;
  name: EventName;
  props: Record<string, unknown>;
  ts: number;
  sessionId: string;
  variant: Variant;
  platform: 'web' | 'mobile_web';
}

interface AnalyticsState {
  events: TrackedEvent[];
  variant: Variant;
  setVariant: (v: Variant) => void;
  clear: () => void;
}

const sessionId = Math.random().toString(36).slice(2, 10);

export const useAnalytics = create<AnalyticsState>()(
  persist(
    (set) => ({
      events: [],
      // 50/50 assignment on first visit, sticky afterwards.
      variant: Math.random() < 0.5 ? 'smart' : 'classic',
      setVariant: (variant) => set({ variant }),
      clear: () => set({ events: [] }),
    }),
    { name: 'tradedesk-analytics' },
  ),
);

let counter = Date.now();

/** Single entry point for product analytics. In production this would fan out to a CDP. */
export function track(name: EventName, props: Record<string, unknown> = {}) {
  const { variant } = useAnalytics.getState();
  const event: TrackedEvent = {
    id: counter++,
    name,
    props,
    ts: Date.now(),
    sessionId,
    variant,
    platform: typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile_web' : 'web',
  };
  useAnalytics.setState((s) => ({ events: [...s.events.slice(-999), event] }));
}
