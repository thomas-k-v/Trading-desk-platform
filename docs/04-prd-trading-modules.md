# 04 · PRDs — Core Trading Modules

Short-form PRDs for the modules this role owns. Each lists the problem, key requirements, metrics and what the prototype demonstrates.

---

## 4.1 Watchlist

**Problem.** The watchlist is the home screen for traders; it must be glanceable, fast and personal.

| Priority | Requirement |
|---|---|
| P0 | Multiple named watchlists; add/remove; search across equity, futures and options by symbol or name |
| P0 | Live LTP, absolute and % change, colour by direction, tick flash |
| P0 | Hover/swipe actions: Buy, Sell, Chart, Alert, Remove |
| P1 | Sort by added order, % change, A–Z; re-sort throttled so rows don't jump |
| P1 | Segment badge (NSE/BSE/FUT/OPT) and lot size for F&O |
| P2 | Personalised starter watchlist from holdings and recent searches |

**Metrics.** Watchlist → order pad CTR; symbols added per user; DAU who open watchlist.
**Prototype.** [`Watchlist.tsx`](../src/features/watchlist/Watchlist.tsx) · ![](images/mobile-watchlist.png)

---

## 4.2 Order Book

**Problem.** Users need to know instantly what happened to every order and act on it.

| Priority | Requirement |
|---|---|
| P0 | Tabs: Open (incl. trigger pending, partial, AMO), Executed, Rejected, All with counts |
| P0 | Modify (price, qty, trigger, type) and Cancel for working orders |
| P0 | Status chips; filled/total qty; average price |
| P0 | Rejection reason in plain language + *Fix & retry* (opens pad prefilled) |
| P1 | Partial fill progression; order history timeline |

**Metrics.** Modify/cancel success rate; retry-after-rejection rate; time from rejection to retry.

---

## 4.3 Positions

**Problem.** Intraday and F&O traders need live P&L and a fast exit.

| Priority | Requirement |
|---|---|
| P0 | Net qty, average, LTP, live P&L per position and total |
| P0 | Exit (market square-off) per position; Exit all with confirmation |
| P0 | Realised vs unrealised split |
| P1 | Add to position (pad prefilled) |
| P1 | MIS auto square-off countdown |
| P2 | Convert MIS ↔ NRML / CNC |

**P&L formula.** `(sell value − buy value) + net qty × LTP`; realised = `min(buy qty, sell qty) × (sell avg − buy avg)`. Code: [`pnl.ts`](../src/engine/pnl.ts).

---

## 4.4 Portfolio / Holdings

**Problem.** Investors want one view of everything they own and how it's doing.

| Priority | Requirement |
|---|---|
| P0 | Invested, current, total P&L (₹, %), day's P&L |
| P0 | Per-stock qty, avg cost, LTP, P&L, day change; Buy more / Sell |
| P0 | Mutual fund holdings in the same view |
| P1 | Sector allocation chart |
| P2 | XIRR, benchmark comparison, tax-lot view |

**Prototype.** ![](images/holdings.png)

---

## 4.5 Funds

**Problem.** "How much can I trade with?" must have one clear answer.

| Priority | Requirement |
|---|---|
| P0 | Available margin; used margin split into positions and open orders |
| P0 | Add funds (UPI instant, net banking); withdraw with withdrawable limit |
| P0 | Ledger with narration per entry |
| P1 | Quick amount chips; inline add from order pad |
| P2 | Collateral (pledge) margin; auto-sweep from linked bank account |

**Available margin (prototype):** `ledger balance + realised P&L + min(0, unrealised MTM) − position margin − open-order margin`.

---

## 4.6 Reports

**Problem.** Traders and investors need reports that reconcile, for tax and for self-review.

| Priority | Requirement |
|---|---|
| P0 | P&L by symbol: realised, unrealised, charges, net |
| P0 | Tradebook with every fill |
| P0 | CSV export |
| P1 | Date range filters; FY presets |
| P2 | Tax P&L (STCG/LTCG/speculative/non-speculative), contract notes PDF |

---

## 4.7 Charts, Option Chain, Mutual Funds, Alerts (supporting modules)

| Module | Must-haves in prototype |
|---|---|
| Charts | Candles + volume; 1m/5m/15m/1D; SMA/EMA; depth; trade from chart |
| Option chain | CE/PE LTP, OI bars, IV, delta; ATM marker; ITM shading; PCR; max pain; tap to trade |
| Mutual funds | Category filters; returns 1Y/3Y/5Y; expense; NAV trend; SIP calculator; start/pause SIP; lumpsum |
| Alerts | Above/below price; app + WhatsApp channel; WhatsApp-style preview with Buy/Sell quick replies |
