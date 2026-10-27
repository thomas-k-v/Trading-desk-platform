# 08 · API Specification

The prototype's UI only writes through [`src/api/mockBroker.ts`](../src/api/mockBroker.ts), which mirrors this REST contract. Swapping the mock for HTTP calls would not change any screen.

Base URL: `https://api.tradedesk.example/v1` · Auth: `Authorization: Bearer <access_token>` (OAuth 2.0, 1-day token for client API apps) · Content type: JSON.

## Response envelope

```json
{ "status": "success", "data": { } }
{ "status": "error", "error": { "code": "INSUFFICIENT_MARGIN", "message": "Short by ₹36,072…" } }
```

## Orders

### `POST /orders` — place order

Headers: `Idempotency-Key: <uuid>` (required; retries return the original result).

```json
{
  "symbol": "NIFTY OCT FUT",
  "side": "BUY",
  "qty": 75,
  "order_type": "LIMIT",
  "product": "NRML",
  "variety": "REGULAR",
  "price": 25990.0,
  "trigger_price": null,
  "tag": "smart_pad"
}
```

`201 Created`

```json
{ "status": "success", "data": { "id": "O1J8K2…", "status": "OPEN", "filled_qty": 0, "avg_price": 0, "created_at": "2026-10-27T09:41:05Z" } }
```

`422 Unprocessable` — RMS rejection (order is still recorded with status `REJECTED`):

```json
{ "status": "error", "error": { "code": "LOT_SIZE", "message": "Quantity should be multiple of lot size 75", "explanation": "NIFTY OCT FUT trades in lots of 75. 10 is not a multiple of the lot size.", "fix": { "kind": "SET_QTY", "qty": 75 } } }
```

> Returning `explanation` and `fix` from the server keeps web, mobile and API clients consistent with the Smart pad.

### `PUT /orders/{id}` — modify
Body: any of `qty`, `price`, `trigger_price`, `order_type`. Only for `OPEN`, `TRIGGER_PENDING`, `PARTIAL`, `AMO_PENDING`.

### `DELETE /orders/{id}` — cancel
### `GET /orders` — order book (today) · `GET /orders/{id}/history` — state transitions
### `GET /trades` — tradebook

## Pre-trade

### `POST /margins/orders` — margin for one or more orders

```json
{ "orders": [{ "symbol": "NIFTY 03 NOV 26000 CE", "side": "SELL", "qty": 75, "product": "NRML", "order_type": "MARKET" }] }
```

```json
{ "status": "success", "data": { "required": 233910.5, "available": 498750.04, "charges": { "brokerage": 20, "stt": 11.3, "exchange": 3.95, "gst": 4.31, "stamp": 0, "total": 39.56 } } }
```

### `POST /orders/checks` — dry-run RMS
Same body as `POST /orders`; returns the full check list (`pass`/`warn`/`fail`, `code`, `explanation`, `fix`) without placing. Used by the Smart pad on submit-intent and by API clients.

## Portfolio & funds

| Method | Path | Description |
|---|---|---|
| GET | `/positions` | Day & net positions with P&L |
| POST | `/positions/square-off` | `{ symbol, product }` → market order for net qty |
| GET | `/holdings` | Demat holdings with avg cost |
| GET | `/funds` | Ledger balance, realised, MTM, used margin, available |
| POST | `/funds/payin` | `{ amount, method: "UPI" \| "NETBANKING" }` → payment intent |
| POST | `/funds/payout` | `{ amount }` |
| GET | `/ledger?from&to` | Ledger entries |

## Market data

| Method | Path | Description |
|---|---|---|
| GET | `/instruments` | Master: symbol, segment, lot, tick, freeze qty, expiry, strike |
| GET | `/quotes?symbols=` | LTP, OHLC, bid/ask, circuits, OI, IV |
| GET | `/candles/{symbol}?tf=5m&from&to` | Historical candles |
| GET | `/option-chain/{underlying}?expiry=` | Chain with OI, IV, Greeks |
| WS | `/stream` | Subscribe `{"a":"subscribe","v":["RELIANCE"]}`; ticks + order updates |

## Mutual funds & alerts

| Method | Path | Description |
|---|---|---|
| GET | `/mf/funds` | Fund list with returns, expense, risk |
| POST | `/mf/orders` | Lumpsum `{ code, amount }` |
| POST | `/mf/sips` | `{ code, amount, day_of_month }` |
| PATCH | `/mf/sips/{id}` | Pause/resume/modify |
| POST | `/alerts` | `{ symbol, condition, price, channels: { app, whatsapp } }` |
| DELETE | `/alerts/{id}` | |

## Error codes

| Code | HTTP | Meaning | Smart pad fix |
|---|---|---|---|
| `MARKET_CLOSED` | 422 | Regular order outside session | Place as AMO |
| `INVALID_QTY` | 422 | qty ≤ 0 or not integer | — |
| `LOT_SIZE` | 422 | F&O qty not multiple of lot | Nearest lot |
| `FREEZE_QTY` | 422 | Above exchange freeze limit | Cap at freeze qty |
| `TICK_SIZE` | 422 | Price not on tick grid | Nearest tick |
| `CIRCUIT_LIMIT` | 422 | Price outside band | Band edge |
| `INSUFFICIENT_MARGIN` | 422 | Required > available | Add funds |
| `NO_HOLDINGS` | 422 | Delivery sell > holdings | Sell held qty / Intraday |
| `INVALID_TRIGGER` | 422 | SL trigger on wrong side | — |
| `PRODUCT_NOT_ALLOWED` | 422 | CNC on F&O or NRML on equity | Switch product |
| `NOT_FOUND` | 404 | Unknown order | — |
| `INVALID_STATE` | 409 | Modify/cancel a finished order | — |
| `RATE_LIMITED` | 429 | Too many requests | Retry-After header |

## Client API / algo programme (Preferred skill in JD)

| Topic | Proposal |
|---|---|
| Access | Self-serve app registration, OAuth 2.0 login, daily token; static IP whitelisting per SEBI algo framework |
| Rate limits | 10 orders/s per user, 3 quote req/s, 1 WebSocket with 3,000 instruments |
| Algo tagging | Every API order carries an exchange-approved algo ID / `tag`; orders above threshold OPS require registered strategy |
| Webhooks | `order.update`, `alert.triggered` with HMAC signature |
| Sandbox | Paper-trading environment mirroring this prototype's simulator |
| SDKs | Python, Node; Postman collection; examples for pre-trade checks |
| Metrics | Active API apps, API order share, error rate by code, p95 latency |
