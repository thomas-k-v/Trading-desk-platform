import { useMemo, useState } from 'react';
import type { Trade } from '../../api/types';
import { useTrading, seedState } from '../../store/trading';
import { useFunds } from '../hooks';
import { applyDeliveryTrade } from '../../engine/pnl';
import { dateTime, downloadCsv, fmt, inr, tone } from '../../lib/format';
import { track } from '../../analytics/track';
import { Badge, Button, Card, Empty, Stat, Table, Tabs, Td } from '../../components/ui';

/** Realised P&L on delivery sells, replayed from the opening holdings. */
function deliveryRealised(trades: Trade[]) {
  let holdings = seedState().holdings;
  const bySymbol = new Map<string, number>();
  for (const t of trades.filter((t) => t.product === 'CNC')) {
    const r = applyDeliveryTrade(holdings, t);
    holdings = r.holdings;
    if (t.side === 'SELL') bySymbol.set(t.symbol, (bySymbol.get(t.symbol) ?? 0) + r.realized);
  }
  return bySymbol;
}

export function Reports() {
  const trades = useTrading((s) => s.trades);
  const { positions } = useFunds();
  const [tab, setTab] = useState<'pnl' | 'tradebook'>('pnl');

  const pnlRows = useMemo(() => {
    const rows = new Map<string, { symbol: string; segment: string; realized: number; unrealized: number; charges: number }>();
    for (const p of positions) {
      const r = rows.get(p.symbol) ?? { symbol: p.symbol, segment: p.product, realized: 0, unrealized: 0, charges: 0 };
      r.realized += p.realized;
      r.unrealized += p.unrealized;
      rows.set(p.symbol, r);
    }
    for (const [symbol, realized] of deliveryRealised(trades)) {
      const r = rows.get(symbol) ?? { symbol, segment: 'CNC', realized: 0, unrealized: 0, charges: 0 };
      r.realized += realized;
      rows.set(symbol, r);
    }
    for (const t of trades) {
      const r = rows.get(t.symbol);
      if (r) r.charges += t.charges;
    }
    return [...rows.values()];
  }, [positions, trades]);

  const realized = pnlRows.reduce((a, r) => a + r.realized, 0);
  const charges = trades.reduce((a, t) => a + t.charges, 0);
  const turnover = trades.reduce((a, t) => a + t.qty * t.price, 0);

  const exportCsv = () => {
    if (tab === 'tradebook') {
      downloadCsv('tradebook.csv', [['Trade ID', 'Order ID', 'Time', 'Symbol', 'Side', 'Product', 'Qty', 'Price', 'Charges'], ...trades.map((t) => [t.id, t.orderId, new Date(t.time).toISOString(), t.symbol, t.side, t.product, t.qty, t.price.toFixed(2), t.charges.toFixed(2)])]);
    } else {
      downloadCsv('pnl-report.csv', [['Symbol', 'Segment', 'Realised', 'Unrealised', 'Charges', 'Net realised'], ...pnlRows.map((r) => [r.symbol, r.segment, r.realized.toFixed(2), r.unrealized.toFixed(2), r.charges.toFixed(2), (r.realized - r.charges).toFixed(2)])]);
    }
    track('report_exported', { report: tab, rows: tab === 'tradebook' ? trades.length : pnlRows.length });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Realised P&L" value={<span className={tone(realized)}>{inr(realized)}</span>} />
        <Stat label="Charges & taxes" value={inr(charges)} />
        <Stat label="Net realised" value={<span className={tone(realized - charges)}>{inr(realized - charges)}</span>} />
        <Stat label="Turnover" value={inr(turnover, 0)} sub={`${trades.length} trades`} />
      </div>
      <Card
        title="Reports"
        actions={
          <>
            <Tabs value={tab} onChange={setTab} size="sm" options={[{ value: 'pnl', label: 'P&L' }, { value: 'tradebook', label: 'Tradebook' }]} />
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!trades.length}>⬇ CSV</Button>
          </>
        }
      >
        {trades.length === 0 ? <Empty title="No trades yet" body="Executed trades and P&L appear here, ready to export." /> : tab === 'pnl' ? (
          <Table head={['Symbol', 'Segment', 'Realised', 'Unrealised', 'Charges', 'Net realised']}>
            {pnlRows.map((r) => (
              <tr key={r.symbol}>
                <Td left className="font-medium">{r.symbol}</Td>
                <Td><Badge>{r.segment}</Badge></Td>
                <Td className={tone(r.realized)}>{inr(r.realized)}</Td>
                <Td className={tone(r.unrealized)}>{inr(r.unrealized)}</Td>
                <Td>{inr(r.charges)}</Td>
                <Td className={`font-semibold ${tone(r.realized - r.charges)}`}>{inr(r.realized - r.charges)}</Td>
              </tr>
            ))}
          </Table>
        ) : (
          <Table head={['Time', 'Symbol', 'Side', 'Product', 'Qty', 'Price', 'Charges']}>
            {[...trades].reverse().map((t) => (
              <tr key={t.id}>
                <Td left className="text-slate-500">{dateTime(t.time)}</Td>
                <Td className="font-medium">{t.symbol}</Td>
                <Td><Badge color={t.side === 'BUY' ? 'blue' : 'red'}>{t.side}</Badge></Td>
                <Td>{t.product}</Td>
                <Td>{t.qty}</Td>
                <Td>{fmt(t.price)}</Td>
                <Td>{inr(t.charges)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
