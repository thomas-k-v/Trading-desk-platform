# 05 · User Stories & Backlog

JIRA-style backlog. Story points use the Fibonacci scale; a 2-week sprint is assumed at ~30 points for one squad (2 mobile, 1 web, 1 backend, 1 QA).

## Epics

| Key | Epic | Goal |
|---|---|---|
| TD-E1 | Smart Order Pad | Pre-submit checks, explanations, one-tap fixes |
| TD-E2 | Order Book & rejection UX | Plain reasons, fix & retry, modify/cancel |
| TD-E3 | Funds in context | Inline pay-in, clear margin breakup |
| TD-E4 | Experimentation & analytics | Flag, A/B, events, dashboards |
| TD-E5 | Positions & portfolio | Live P&L, exits, allocation |
| TD-E6 | Engagement | WhatsApp alerts, personalised watchlists |

## Stories

### TD-E1 · Smart Order Pad

**TD-101 · Lot-size check for F&O** — 3 pts
*As an F&O trader, I want to be told before submitting that my quantity isn't a lot multiple, so that my order isn't rejected.*
- **Given** an F&O instrument with lot size 75 **when** I enter qty 10 **then** I see "Quantity must be in lots" and the Review button is disabled.
- **Given** that failure **when** I tap "Use 1 lot (75)" **then** qty becomes 75 and the check passes.
- **Given** any F&O instrument **then** the quantity field is labelled "Lots" and shows total qty.

**TD-102 · Margin check with shortfall** — 5 pts
*As a trader, I want to see margin required vs available and the exact shortfall, so I can fix it.*
- **Given** required ₹2,34,072 and available ₹1,98,000 **then** I see "Short by ₹36,072" and the affordable quantity.
- **Given** an order that reduces an existing position **then** incremental margin is ₹0.
- **Given** open orders blocking margin **then** available margin excludes them.

**TD-103 · Inline add funds** — 5 pts
*As a trader short on margin, I want to add funds without leaving the pad.*
- **When** I tap "Add ₹37,000" **then** UPI flow starts with amount prefilled (rounded up to ₹1,000).
- **When** payment succeeds **then** available margin updates and the margin check re-runs without closing the pad.
- **When** payment fails/cancels **then** the pad remains with my inputs intact.

**TD-104 · Circuit band & tick size** — 3 pts
- **Given** a limit price above upper circuit **then** "Outside today's price band" with band shown and "Use ₹{upper}".
- **Given** price not a multiple of tick **then** the nearest valid price is offered.

**TD-105 · Delivery sell without holdings** — 2 pts
- **Given** CNC SELL of a stock I don't hold **then** "You don't hold this stock" + "Switch to Intraday".
- **Given** I hold 25 and enter 50 **then** "You hold only 25" + "Sell 25". Pending sell orders reduce sellable qty.

**TD-106 · Stop-loss trigger validation** — 2 pts
- **Given** SL BUY with trigger ≤ LTP **then** blocking message explaining direction.
- **Given** SL SELL with limit > trigger **then** blocking message.

**TD-107 · Market closed → AMO** — 2 pts
- **Given** market closed and REGULAR variety **then** "Market is closed" + "Place as AMO".
- **Given** AMO **then** the order shows status AMO PENDING and goes to exchange at open.

**TD-108 · Non-blocking warnings** — 3 pts
- Fat-finger: price > 5% from LTP → warning + "Use LTP"; MIS square-off note; option-writing risk; expiry day.

**TD-109 · Review step** — 3 pts
- Summary shows order, type, product, price, value, margin, charges and warnings; Back preserves inputs.

### TD-E2 · Order Book

**TD-201 · Plain-language rejection reason** — 3 pts
- **Given** a rejected order **then** the Rejected tab shows "Why it was rejected" text mapped from the RMS code; unknown codes fall back to raw text.

**TD-202 · Fix & retry** — 2 pts
- **When** I tap Fix & retry **then** the pad opens prefilled with the rejected order and live checks.

**TD-203 · Modify & cancel** — 5 pts
- Modify re-runs checks excluding the order itself; cancel moves order to Cancelled; both are idempotent.

### TD-E3 · Funds
**TD-301 · Margin breakup** — 3 pts · ledger, realised, MTM loss, position margin, order margin, available.
**TD-302 · Withdraw limit** — 2 pts · cannot withdraw more than available; clear error.

### TD-E4 · Experimentation & analytics
**TD-401 · Feature flag + sticky assignment** — 3 pts
**TD-402 · Event instrumentation per tracking plan** — 5 pts · all events carry `variant`, `platform`, `session_id`.
**TD-403 · Experiment dashboard** — 3 pts · funnel, rejection rate, fix adoption by variant, guardrails.

### TD-E5 · Positions & portfolio
**TD-501 · Live MTM and exit** — 5 pts · **TD-502 · Exit all with confirm** — 2 pts · **TD-503 · Allocation donut** — 2 pts

### TD-E6 · Engagement
**TD-601 · Price alerts with WhatsApp channel** — 5 pts
- Template approved; quick replies "Buy"/"Sell" deep-link to pad with symbol; opt-in captured with timestamp.

## Definition of Ready / Done

| DoR | DoD |
|---|---|
| Problem and metric linked | Acceptance criteria pass on Android, iOS, web |
| Designs attached (Figma) | Unit tests for rules; QA regression on order flows |
| Copy approved by Compliance | Events verified in analytics debugger |
| Dependencies identified | Feature-flagged; release note drafted |

## Sprint plan

| Sprint | Scope | Points | Outcome |
|---|---|---|---|
| S1 | TD-101, 102, 104, 105, 106, 109, 401 | 23 + 3 = 26 | Core checks behind flag, internal dogfood |
| S2 | TD-103, 107, 108, 201, 202, 402 | 22 | Full Smart pad + order book UX, events live |
| S3 | TD-203, 301, 302, 403, 501, 502 | 23 | Experiment dashboard; 5% rollout |
| Later | TD-503, 601, P2s | — | Roadmap |
