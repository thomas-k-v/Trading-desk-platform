import { useState } from 'react';
import { addFunds, withdrawFunds } from '../../api/mockBroker';
import { useTrading } from '../../store/trading';
import { useUi } from '../../store/ui';
import { useFunds } from '../hooks';
import { dateTime, inr, tone } from '../../lib/format';
import { Badge, Button, Card, Field, Stat, Table, Tabs, Td, inputCls } from '../../components/ui';

export function Funds() {
  const f = useFunds();
  const ledger = useTrading((s) => s.ledger);
  const toast = useUi((s) => s.toast);
  const [mode, setMode] = useState<'add' | 'withdraw'>('add');
  const [amount, setAmount] = useState('10000');
  const [method, setMethod] = useState<'UPI' | 'NETBANKING'>('UPI');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const n = Number(amount);
    if (!(n > 0)) return;
    setBusy(true);
    const r = mode === 'add' ? await addFunds(n, method) : await withdrawFunds(n);
    setBusy(false);
    toast(r.status === 'success' ? { kind: 'success', title: mode === 'add' ? `${inr(n, 0)} added` : `Withdrawal of ${inr(n, 0)} requested`, body: mode === 'withdraw' ? 'Credited to bank by next working day (simulated).' : undefined } : { kind: 'error', title: r.error.message });
  };

  const rows: [string, number, string?][] = [
    ['Opening balance + pay-ins', f.ledgerBalance, 'Cash ledger incl. delivery buys/sells and charges'],
    ['Realised P&L (positions)', f.realized],
    ['Unrealised MTM loss', Math.min(0, f.unrealized), 'Only losses reduce available margin'],
    ['Margin used — positions', -f.positionMargin],
    ['Margin blocked — open orders', -f.orderMargin],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Available margin" value={inr(f.available)} />
        <Stat label="Used margin" value={inr(f.usedMargin)} />
        <Stat label="Today's pay-in" value={inr(f.payin, 0)} />
        <Stat label="Unrealised MTM" value={<span className={tone(f.unrealized)}>{inr(f.unrealized)}</span>} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Margin breakup" className="lg:col-span-2">
          <dl className="divide-y divide-slate-100">
            {rows.map(([k, v, hint]) => (
              <div key={k} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <dt>{k}{hint && <div className="text-[11px] text-slate-400">{hint}</div>}</dt>
                <dd className={`tabular-nums ${tone(v)}`}>{inr(v)}</dd>
              </div>
            ))}
            <div className="flex justify-between bg-slate-50 px-4 py-2.5 text-sm font-semibold">
              <dt>Available to trade</dt>
              <dd className="tabular-nums">{inr(f.available)}</dd>
            </div>
          </dl>
        </Card>
        <Card title="Move money" actions={<Tabs value={mode} onChange={setMode} size="sm" options={[{ value: 'add', label: 'Add' }, { value: 'withdraw', label: 'Withdraw' }]} />}>
          <div className="space-y-3 p-4">
            <Field label="Amount (₹)">
              <input className={inputCls} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <div className="flex gap-1.5">
              {[5000, 25000, 100000].map((n) => (
                <button key={n} onClick={() => setAmount(String(n))} className="rounded-full border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50">+{inr(n, 0)}</button>
              ))}
            </div>
            {mode === 'add' && (
              <Tabs value={method} onChange={setMethod} size="sm" options={[{ value: 'UPI', label: 'UPI (instant)' }, { value: 'NETBANKING', label: 'Net banking' }]} />
            )}
            <Button className="w-full" disabled={busy} onClick={submit}>{busy ? 'Processing…' : mode === 'add' ? 'Add funds' : 'Withdraw'}</Button>
            <p className="text-[11px] text-slate-400">Simulated — no real payment is made.</p>
          </div>
        </Card>
      </div>
      <Card title="Ledger">
        <Table head={['Date', 'Narration', 'Type', 'Amount']}>
          {[...ledger].reverse().slice(0, 50).map((l) => (
            <tr key={l.id}>
              <Td left className="text-slate-500">{dateTime(l.time)}</Td>
              <Td left>{l.narration}</Td>
              <Td><Badge>{l.type.replace('_', ' ')}</Badge></Td>
              <Td className={tone(l.amount)}>{inr(l.amount)}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
