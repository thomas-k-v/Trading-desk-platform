import { useState } from 'react';
import { INSTRUMENTS, INSTRUMENT_MAP } from '../../market/instruments';
import { useTrading } from '../../store/trading';
import { useMarket } from '../../store/market';
import { useUi } from '../../store/ui';
import { createAlert, deleteAlert } from '../../api/mockBroker';
import { track } from '../../analytics/track';
import { dateTime, fmt, pct } from '../../lib/format';
import { Badge, Button, Card, Empty, Field, Table, Td, inputCls } from '../../components/ui';
import type { PriceAlert } from '../../api/types';

/** WhatsApp Business-style template body for a fired alert. */
export const alertMessage = (a: PriceAlert) =>
  `🔔 *Price alert*: ${a.symbol} is now ₹${fmt(a.triggeredPrice ?? a.price)} (${a.condition === 'ABOVE' ? 'crossed above' : 'fell below'} your ₹${fmt(a.price)} level).`;

export function Alerts() {
  const alerts = useTrading((s) => s.alerts);
  const quotes = useMarket((s) => s.quotes);
  const toast = useUi((s) => s.toast);
  const openOrderPad = useUi((s) => s.openOrderPad);
  const initial = sessionStorage.getItem('alertSymbol') ?? 'RELIANCE';
  const [symbol, setSymbol] = useState(INSTRUMENT_MAP[initial] ? initial : 'RELIANCE');
  const ltp = quotes[symbol]?.ltp ?? 0;
  const [condition, setCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [price, setPrice] = useState((ltp * 1.002).toFixed(2));
  const [whatsapp, setWhatsapp] = useState(true);

  const pickSymbol = (s: string) => {
    setSymbol(s);
    sessionStorage.setItem('alertSymbol', s);
    const l = quotes[s]?.ltp ?? 0;
    setPrice((l * (condition === 'ABOVE' ? 1.002 : 0.998)).toFixed(2));
  };

  const submit = async () => {
    const p = Number(price);
    if (!(p > 0)) return;
    await createAlert({ symbol, condition, price: p, channels: { app: true, whatsapp } });
    toast({ kind: 'success', title: `Alert set: ${symbol} ${condition.toLowerCase()} ₹${fmt(p)}`, body: whatsapp ? 'You\'ll get a WhatsApp message too (simulated).' : undefined });
  };

  const triggered = alerts.filter((a) => a.status === 'TRIGGERED' && a.channels.whatsapp);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card title="Create price alert">
          <div className="grid gap-3 p-4 sm:grid-cols-4">
            <Field label="Instrument">
              <select className={inputCls} value={symbol} onChange={(e) => pickSymbol(e.target.value)}>
                {INSTRUMENTS.filter((i) => i.segment !== 'OPT').map((i) => <option key={i.symbol}>{i.symbol}</option>)}
              </select>
            </Field>
            <Field label="Condition">
              <select className={inputCls} value={condition} onChange={(e) => setCondition(e.target.value as 'ABOVE' | 'BELOW')}>
                <option value="ABOVE">Goes above</option>
                <option value="BELOW">Falls below</option>
              </select>
            </Field>
            <Field label="Price" hint={`LTP ${fmt(ltp)}`}>
              <input className={inputCls} type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
            </Field>
            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} /> Also notify on WhatsApp</label>
              <Button onClick={submit}>Create alert</Button>
            </div>
          </div>
          <p className="px-4 pb-3 text-[11px] text-slate-400">Tip: set the level close to LTP — the simulated market moves every second, so you'll see the alert fire within a minute or so.</p>
        </Card>
        <Card title={`Alerts (${alerts.length})`}>
          {alerts.length === 0 ? <Empty title="No alerts" body="Alerts fire in-app and (optionally) as WhatsApp messages with one-tap Buy/Sell replies." /> : (
            <Table head={['Instrument', 'Condition', 'Distance', 'Channels', 'Status', '']}>
              {alerts.map((a) => {
                const l = quotes[a.symbol]?.ltp ?? 0;
                return (
                  <tr key={a.id}>
                    <Td left className="font-medium">{a.symbol}</Td>
                    <Td>{a.condition === 'ABOVE' ? '≥' : '≤'} {fmt(a.price)}</Td>
                    <Td className="text-slate-500">{a.status === 'ACTIVE' ? pct(((a.price - l) / l) * 100) : `@ ${fmt(a.triggeredPrice ?? 0)}`}</Td>
                    <Td><div className="flex justify-end gap-1"><Badge>App</Badge>{a.channels.whatsapp && <Badge color="green">WhatsApp</Badge>}</div></Td>
                    <Td><Badge color={a.status === 'ACTIVE' ? 'blue' : 'amber'}>{a.status}</Badge>{a.triggeredAt && <div className="text-[10px] text-slate-400">{dateTime(a.triggeredAt)}</div>}</Td>
                    <Td><Button size="sm" variant="ghost" onClick={() => deleteAlert(a.id)}>Delete</Button></Td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>
      </div>
      <Card title="WhatsApp preview (simulated)">
        <div className="m-4 overflow-hidden rounded-2xl border-4 border-slate-800 bg-[#efe7dd]">
          <div className="flex items-center gap-2 bg-[#075e54] px-3 py-2 text-white">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold">TD</div>
            <div><div className="text-sm font-semibold">TradeDesk Alerts</div><div className="text-[10px] opacity-75">Verified business · simulated</div></div>
          </div>
          <div className="h-80 space-y-2 overflow-y-auto p-3">
            {triggered.length === 0 && <div className="mx-auto mt-24 w-fit rounded-md bg-white/70 px-3 py-1.5 text-center text-[11px] text-slate-500">Messages from triggered alerts appear here</div>}
            {triggered.map((a) => (
              <div key={a.id} className="max-w-[90%] rounded-lg rounded-tl-none bg-white p-2 text-xs shadow-sm">
                <div className="whitespace-pre-wrap">{alertMessage(a).replace(/\*/g, '')}</div>
                <div className="mt-1 text-right text-[9px] text-slate-400">{a.triggeredAt && dateTime(a.triggeredAt)}</div>
                <div className="mt-1.5 grid grid-cols-2 gap-1 border-t border-slate-100 pt-1.5">
                  {INSTRUMENT_MAP[a.symbol].tradable && (['BUY', 'SELL'] as const).map((side) => (
                    <button key={side} onClick={() => { track('alert_cta_clicked', { symbol: a.symbol, cta: side }); openOrderPad({ symbol: a.symbol, side }, 'alert'); }} className="rounded py-1 text-center font-semibold text-[#128c7e] hover:bg-slate-50">{side === 'BUY' ? 'Buy' : 'Sell'}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="px-4 pb-4 text-[11px] text-slate-500">In production this is a pre-approved WhatsApp Business template with quick-reply buttons that deep-link into the order pad. See <code>docs/10-roadmap-and-prioritization.md</code>.</p>
      </Card>
    </div>
  );
}
