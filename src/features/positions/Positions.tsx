import { useState } from 'react';
import { squareOff } from '../../api/mockBroker';
import { useUi } from '../../store/ui';
import { useFunds } from '../hooks';
import { fmt, inr, tone } from '../../lib/format';
import { Badge, Button, Card, Empty, Table, Td } from '../../components/ui';

export function Positions() {
  const { positions } = useFunds();
  const toast = useUi((s) => s.toast);
  const openOrderPad = useUi((s) => s.openOrderPad);
  const [busy, setBusy] = useState<string | null>(null);
  const open = positions.filter((p) => p.netQty !== 0);
  const total = positions.reduce((a, p) => a + p.pnl, 0);
  const realized = positions.reduce((a, p) => a + p.realized, 0);

  const exit = async (key: string, p: (typeof positions)[number]) => {
    setBusy(key);
    const r = await squareOff(p);
    setBusy(null);
    toast(r.status === 'success' ? { kind: 'success', title: `Squared off ${p.symbol}`, body: `P&L ${inr(p.pnl)}` } : { kind: 'error', title: 'Square-off failed', body: r.error.message });
  };

  return (
    <Card
      title={<>Positions <span className="ml-2 font-normal text-slate-400">{open.length} open</span></>}
      actions={
        <>
          <span className="text-xs text-slate-500">Realised <b className={tone(realized)}>{inr(realized)}</b></span>
          <span className="text-sm">Total P&L <b className={`tabular-nums ${tone(total)}`}>{inr(total)}</b></span>
          {open.length > 1 && <Button size="sm" variant="outline" onClick={async () => { for (const p of open) await exit(p.symbol + p.product, p); }}>Exit all</Button>}
        </>
      }
    >
      {positions.length === 0 ? (
        <Empty title="No positions today" body="Intraday (MIS) and F&O (NRML) trades show up here with live mark-to-market P&L. Delivery buys go to Holdings." />
      ) : (
        <Table head={['Instrument', 'Product', 'Net qty', 'Avg', 'LTP', 'P&L', '']}>
          {positions.map((p) => {
            const key = p.symbol + p.product;
            return (
              <tr key={key} className={p.netQty === 0 ? 'text-slate-400' : ''}>
                <Td left><span className="font-medium">{p.symbol}</span></Td>
                <Td><Badge color={p.product === 'MIS' ? 'amber' : 'violet'}>{p.product}</Badge></Td>
                <Td className={p.netQty > 0 ? 'text-brand' : p.netQty < 0 ? 'text-down' : ''}>{p.netQty}</Td>
                <Td>{p.netQty ? fmt(p.avgPrice) : '—'}</Td>
                <Td>{fmt(p.ltp)}</Td>
                <Td className={`font-semibold ${tone(p.pnl)}`}>{inr(p.pnl)}</Td>
                <Td>
                  {p.netQty !== 0 ? (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => openOrderPad({ symbol: p.symbol, side: p.netQty > 0 ? 'BUY' : 'SELL', product: p.product, qty: Math.abs(p.netQty) })}>Add</Button>
                      <Button size="sm" variant={p.netQty > 0 ? 'sell' : 'buy'} disabled={busy === key} onClick={() => exit(key, p)}>{busy === key ? '…' : 'Exit'}</Button>
                    </div>
                  ) : <span className="text-xs">Closed</span>}
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
    </Card>
  );
}
