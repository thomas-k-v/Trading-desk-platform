# 03 · PRD — Smart Order Pad

| Field | Value |
|---|---|
| Owner | Product Manager, Trading Platform |
| Status | Prototype built · ready for design review & sizing |
| Platforms | Android, iOS, Web (responsive) |
| Partners | Engineering (mobile, web, OMS/RMS), Design, QA, Risk & Compliance, Business, Customer Support, Analytics |
| Related | [Case study](00-case-study.md) · [Stories](05-user-stories-backlog.md) · [Flows](06-process-flows.md) · [Tracking plan](09-analytics-tracking-plan.md) |

## 1. Problem statement

Orders rejected by RMS for avoidable, deterministic reasons (margin, lot size, freeze quantity, circuit band, tick size, holdings, trigger price, market hours) cost users trades and cost us turnover, trust and support load. Today the reason is shown **after** submission, in back-office language, with no path to fix it.

## 2. Goals & non-goals

**Goals**
1. Reduce avoidable RMS rejections by surfacing them before submit.
2. Make every block actionable with a one-tap fix where one exists.
3. Keep order entry at least as fast as today for experienced traders.

**Non-goals (v1)**
- Changing RMS rules or margin policy.
- Basket orders, GTT/OCO, iceberg auto-slicing (tracked in roadmap).
- Advisory ("should you buy this?") content.

## 3. Success metrics

| Type | Metric | Target (hypothesis) |
|---|---|---|
| Primary | Avoidable RMS rejection rate | −40% relative vs control |
| Secondary | Orders executed / order pad opened | +5 pp |
| Secondary | Fix adoption rate (`pretrade_fix_applied / pretrade_check_failed`) | ≥ 35% |
| Secondary | Tickets tagged "order rejected" per 1k active traders | −25% |
| Guardrail | Median time from pad open → review (experienced traders, >20 orders/month) | ≤ +300 ms |
| Guardrail | Pad abandonment (opened, no order in 60 s) | No significant increase |
| Guardrail | Client/server check disagreement (`order_rejected` where client showed all-pass) | < 0.5% of orders |

## 4. Users & scenarios

| Scenario | Persona | Today | With Smart pad |
|---|---|---|---|
| Buys 10 qty of NIFTY futures | Rahul | Rejected: lot size | Blocked live; *Use 1 lot (75)* |
| Buys options with insufficient funds | Rahul | Rejected: margin exceeds | *Short by ₹X* · *Add ₹X via UPI* inline |
| Sells same-day delivery stock not yet in demat / not held | Arjun | Rejected: holding not available | *You don't hold this* · *Switch to Intraday* |
| Types 1,850 instead of 1,580 | Meera | Order rests unfilled / rejected | Fat-finger warning; *Use LTP* |
| Places order at 8 PM | Arjun | Rejected: market closed | *Place as AMO* |
| SL-sell trigger above LTP | Rahul | Rejected | Explains direction rule |

## 5. Requirements

### P0 — must have
| ID | Requirement |
|---|---|
| SOP-1 | Run pre-trade checks client-side on every input change and quote tick (debounced ≤ 100 ms). |
| SOP-2 | Checks: market session/AMO, quantity > 0 & integer, F&O lot multiple, freeze quantity, product validity per segment (CNC equity only; NRML F&O only), tick size, circuit band, SL trigger direction & limit relation, delivery-sell holdings (net of pending sells), incremental margin (exits need none). |
| SOP-3 | Each failed check shows a title, a one-sentence explanation with numbers, and a fix CTA where deterministic. |
| SOP-4 | Primary button disabled with label "Fix N issue(s) to continue" while any blocking check fails. |
| SOP-5 | Margin required, available margin and estimated charges are always visible. |
| SOP-6 | Review step summarises order, value, margin and warnings before confirm. |
| SOP-7 | Server RMS remains authoritative; on server rejection show the plain-language reason and *Fix & retry* in the order book. |
| SOP-8 | F&O quantity entered in lots with qty shown alongside. |
| SOP-9 | All events in the tracking plan are emitted with variant. |
| SOP-10 | Feature flag + A/B allocation at user level, sticky. |

### P1 — should have
| ID | Requirement |
|---|---|
| SOP-11 | Inline add-funds (UPI) for margin shortfall, rounded up to the next ₹1,000. |
| SOP-12 | Non-blocking warnings: price > 5% from LTP, MIS auto square-off time, option writing risk, expiry day. |
| SOP-13 | "N checks passed" expandable list for transparency. |
| SOP-14 | "Affordable quantity" hint on margin failure. |

### P2 — could have
| ID | Requirement |
|---|---|
| SOP-15 | Auto-slice above freeze quantity (iceberg) with explanation. |
| SOP-16 | Personal "common mistakes" nudge based on the user's past rejections. |
| SOP-17 | Remote config for rules/rates/copy (no app release needed). |

## 6. Business rules (as implemented in the prototype)

| Rule | Prototype logic | Production note |
|---|---|---|
| Delivery buy margin | 100% of value | Same |
| Intraday equity margin | 20% (5× leverage) | Per-stock VaR+ELM from exchange files |
| Futures margin | 12% NRML / 6% MIS of contract value | SPAN + exposure from NSE SPAN files |
| Option buy | Full premium | Same |
| Option sell | 12% of underlying notional NRML | SPAN + exposure; hedge benefit for spreads |
| Exit orders | No incremental margin | Same; consider partial exits |
| Circuit band | ±20% (±5% for some stocks) of previous close | From exchange band file daily |
| Freeze qty | NIFTY 1,800 · BANKNIFTY 900 | From exchange circular, config-driven |
| Charges | Brokerage min(₹20, 0.03%) intraday/F&O, ₹0 delivery; STT, exchange, GST, stamp approximations | Pull from tariff service |

Code: [`src/engine/riskChecks.ts`](../src/engine/riskChecks.ts), [`src/engine/margin.ts`](../src/engine/margin.ts). Unit tests: [`tests/riskChecks.test.ts`](../tests/riskChecks.test.ts).

## 7. Edge cases

- **Price moves between check and submit** → server may still reject; show plain reason + retry with refreshed price.
- **Open orders already blocking margin** → available margin excludes them; message says so.
- **Modify order** → re-run checks excluding the order being modified.
- **Partially filled order modify** → only remaining qty is checked.
- **Pending delivery sells** reduce sellable holdings.
- **Expiry day** → warn; consider higher margin per exchange.
- **Lot-size change on contract rollover** → master data refresh; existing positions unaffected.
- **Index instruments** are not tradable → hide B/S.
- **Network loss during submit** → idempotency key on `POST /orders`; show pending state, reconcile from order book.

## 8. Compliance & risk notes

- Copy reviewed by Compliance: explanatory, not advisory. No "you should buy".
- Charges labelled as estimates; contract note is authoritative.
- Margin shown is indicative; exchange may revise intraday (peak margin rules).
- Option-selling warning text aligned with exchange risk disclosures.
- Audit: client check results are logged with the order for dispute resolution.

## 9. Dependencies

| Dependency | Owner | Need |
|---|---|---|
| Margin calculator API (per-order and basket) | OMS/RMS team | p95 < 150 ms |
| Instrument master (lot, tick, freeze, band) | Market data | Daily refresh before 8:30 AM |
| UPI intent/collect from pad | Payments | Funds credited to trading limit within seconds |
| Remote config | Platform | Rules & copy without release |
| Analytics SDK | Data | Events with variant attribute |

## 10. Rollout

1. Internal dogfood (employees) · 1 week
2. 5% of active traders, A/B 50/50 within cohort · 2 weeks or until MDE reached
3. 50% → 100% if primary metric improves and guardrails hold
4. Kill switch: flag off reverts to classic pad instantly

Experiment design is in [09-analytics-tracking-plan.md](09-analytics-tracking-plan.md#5-experiment-design).

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Client rules drift from RMS | Shared rule definitions via config; disagreement metric as guardrail |
| Slower entry for power users | Checks are passive; no extra taps when all clear; measure time-to-order |
| Users treat "all clear" as guarantee | Copy: "Checks passed" not "Guaranteed"; server is source of truth |
| Inline add-funds misuse/fraud | Same UPI limits and 2FA as Funds screen |

## 12. Open questions

1. Should we allow "Place anyway" for blocking checks the client might be wrong about (e.g. stale margin)?
2. Do we auto-slice above freeze qty in v1 given expiry-day volumes?
3. Which charges breakdown does Compliance require pre-trade?
