import { Fragment, useState } from 'react';
import type { Order } from '../../api/types';
import { useTrading } from '../../store/trading';
import { useUi } from '../../store/ui';
import { useAnalytics } from '../../analytics/track';
import { cancelOrder } from '../../api/mockBroker';
import { isWorking } from '../../engine/orderEngine';
import { fmt, time } from '../../lib/format';
import { Badge, Button, Card, Empty, Table, Tabs, Td } from '../../components/ui';

type Tab = 'open' | 'executed' | 'rejected' | 'all';

const statusColor = (s: Order['status']) =>
  s === 'COMPLETE' ? 'green' : s === 'REJECTED' ? 'red' : s === 'CANCELLED' ? 'slate' : s === 'AMO_PENDING' ? 'violet' : 'blue';

export function OrderBook() {
  const orders = useTrading((s) => s.orders);
  const variant = useAnalytics((s) => s.variant);
  const openOrderPad = useUi((s) => s.openOrderPad);
  const toast = useUi((s) => s.toast);
  const [tab, setTab] = useState<Tab>('open');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = orders.filter((o) =>
    tab === 'open' ? isWorking(o) : tab === 'executed' ? o.status === 'COMPLETE' : tab === 'rejected' ? o.status === 'REJECTED' : true,
  );
  const count = (t: Tab) => orders.filter((o) => (t === 'open' ? isWorking(o) : t === 'executed' ? o.status === 'COMPLETE' : t === 'rejected' ? o.status === 'REJECTED' : true)).length;

  return (
    <Card
      title="Orders"
      actions={
        <Tabs
          value={tab}
          onChange={setTab}
          size="sm"
          options={(['open', 'executed', 'rejected', 'all'] as Tab[]).map((t) => ({ value: t, label: `${t[0].toUpperCase()}${t.slice(1)} (${count(t)})` }))}
        />
      }
    >
      {filtered.length === 0 ? (
        <Empty title={tab === 'open' ? 'No open orders' : 'Nothing here yet'} body="Pick a stock from the watchlist and press B or S to place an order." />
      ) : (
        <Table head={['Time', 'Instrument', 'Type', 'Qty', 'Price', 'Avg', 'Status', '']}>
          {filtered.map((o) => (
            <Fragment key={o.id}>
              <tr className="hover:bg-slate-50">
                <Td left className="text-slate-500">{time(o.createdAt)}</Td>
                <Td left>
                  <div className="flex items-center gap-2">
                    <Badge color={o.side === 'BUY' ? 'blue' : 'red'}>{o.side}</Badge>
                    <span className="font-medium">{o.symbol}</span>
                  </div>
                </Td>
                <Td><span className="text-xs text-slate-500">{o.orderType} · {o.product}{o.variety === 'AMO' ? ' · AMO' : ''}</span></Td>
                <Td>{o.filledQty}/{o.qty}</Td>
                <Td>{o.orderType === 'MARKET' ? 'MKT' : fmt(o.price ?? 0)}{o.triggerPrice ? <div className="text-[11px] text-slate-400">trg {fmt(o.triggerPrice)}</div> : null}</Td>
                <Td>{o.avgPrice ? fmt(o.avgPrice) : '—'}</Td>
                <Td>
                  <button onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                    <Badge color={statusColor(o.status)}>{o.status.replace('_', ' ')}</Badge>
                  </button>
                </Td>
                <Td>
                  {isWorking(o) && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => openOrderPad({ ...o }, o.source, o.id)}>Modify</Button>
                      <Button size="sm" variant="ghost" onClick={async () => {
                        const r = await cancelOrder(o.id);
                        toast(r.status === 'success' ? { kind: 'info', title: `Cancelled ${o.symbol}` } : { kind: 'error', title: r.error.message });
                      }}>Cancel</Button>
                    </div>
                  )}
                  {o.status === 'REJECTED' && (
                    <Button size="sm" variant="outline" onClick={() => openOrderPad({ ...o }, o.source)}>{variant === 'smart' ? 'Fix & retry' : 'Retry'}</Button>
                  )}
                </Td>
              </tr>
              {o.status === 'REJECTED' && (expanded === o.id || tab === 'rejected') && (
                <tr>
                  <td colSpan={8} className="bg-red-50/50 px-4 py-2 text-xs">
                    {variant === 'smart' ? (
                      <span className="text-red-800"><b>Why it was rejected:</b> {o.rejectionReason}</span>
                    ) : (
                      <code className="text-red-700">{o.rejectionRaw}</code>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </Table>
      )}
    </Card>
  );
}
