// Domain types shared by the mock broker API, the order engine and the UI.

export type Exchange = 'NSE' | 'NFO' | 'BSE';
export type Segment = 'INDEX' | 'EQ' | 'FUT' | 'OPT';
export type OptionType = 'CE' | 'PE';

export interface Instrument {
  symbol: string;
  name: string;
  exchange: Exchange;
  segment: Segment;
  lotSize: number;
  tickSize: number;
  basePrice: number;
  sector?: string;
  /** Circuit band as a fraction of previous close (equities only). */
  circuitPct?: number;
  /** Max quantity per order before the exchange rejects it (F&O). */
  freezeQty?: number;
  underlying?: string;
  expiry?: string; // ISO date
  strike?: number;
  optionType?: OptionType;
  tradable: boolean;
}

export interface Quote {
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  volume: number;
  change: number;
  changePct: number;
  bid: number;
  ask: number;
  upperCircuit: number;
  lowerCircuit: number;
  oi?: number;
  iv?: number;
  delta?: number;
  updatedAt: number;
}

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Side = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
/** CNC = delivery, MIS = intraday, NRML = carry-forward F&O. */
export type Product = 'CNC' | 'MIS' | 'NRML';
export type Variety = 'REGULAR' | 'AMO';
export type OrderStatus =
  | 'OPEN'
  | 'TRIGGER_PENDING'
  | 'PARTIAL'
  | 'COMPLETE'
  | 'REJECTED'
  | 'CANCELLED'
  | 'AMO_PENDING';

export interface OrderDraft {
  symbol: string;
  side: Side;
  qty: number;
  orderType: OrderType;
  product: Product;
  variety: Variety;
  price?: number;
  triggerPrice?: number;
}

export interface Order extends OrderDraft {
  id: string;
  status: OrderStatus;
  filledQty: number;
  avgPrice: number;
  rejectionCode?: RejectionCode;
  /** Raw RMS message, the way legacy broker back-ends return it. */
  rejectionRaw?: string;
  /** Plain-language explanation shown by the Smart Order Pad. */
  rejectionReason?: string;
  source: 'smart' | 'classic' | 'alert' | 'chart' | 'option_chain';
  createdAt: number;
  updatedAt: number;
}

export interface Trade {
  id: string;
  orderId: string;
  symbol: string;
  side: Side;
  qty: number;
  price: number;
  product: Product;
  time: number;
  charges: number;
}

export interface Holding {
  symbol: string;
  qty: number;
  avgPrice: number;
}

export interface Position {
  symbol: string;
  product: Product;
  netQty: number;
  buyQty: number;
  sellQty: number;
  buyAvg: number;
  sellAvg: number;
  ltp: number;
  pnl: number;
  realized: number;
  unrealized: number;
  /** Average price of the open side. */
  avgPrice: number;
}

export type LedgerType = 'PAYIN' | 'PAYOUT' | 'DELIVERY_BUY' | 'DELIVERY_SELL' | 'CHARGES' | 'MF_PURCHASE' | 'OPENING';

export interface LedgerEntry {
  id: string;
  time: number;
  type: LedgerType;
  amount: number; // + credit, - debit
  narration: string;
}

export type RejectionCode =
  | 'MARKET_CLOSED'
  | 'INVALID_QTY'
  | 'LOT_SIZE'
  | 'FREEZE_QTY'
  | 'TICK_SIZE'
  | 'CIRCUIT_LIMIT'
  | 'INSUFFICIENT_MARGIN'
  | 'NO_HOLDINGS'
  | 'INVALID_TRIGGER'
  | 'PRODUCT_NOT_ALLOWED';

export interface ApiError {
  code: RejectionCode | 'NOT_FOUND' | 'INVALID_STATE' | 'NETWORK';
  message: string;
}

export type ApiResponse<T> =
  | { status: 'success'; data: T }
  | { status: 'error'; error: ApiError };

export interface MutualFund {
  code: string;
  name: string;
  amc: string;
  category: string;
  risk: 'Low' | 'Moderate' | 'High' | 'Very High';
  nav: number;
  expenseRatio: number;
  minSip: number;
  minLumpsum: number;
  cagr1y: number;
  cagr3y: number;
  cagr5y: number;
  aumCr: number;
}

export interface MfHolding {
  code: string;
  units: number;
  invested: number;
}

export interface Sip {
  id: string;
  code: string;
  amount: number;
  dayOfMonth: number;
  createdAt: number;
  active: boolean;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: 'ABOVE' | 'BELOW';
  price: number;
  channels: { app: boolean; whatsapp: boolean };
  status: 'ACTIVE' | 'TRIGGERED';
  createdAt: number;
  triggeredAt?: number;
  triggeredPrice?: number;
}
