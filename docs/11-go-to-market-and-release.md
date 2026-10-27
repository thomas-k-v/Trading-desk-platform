# 11 · Go-to-Market & Release Plan — Smart Order Pad

## 1. Release phases

| Phase | Audience | Duration | Exit criteria |
|---|---|---|---|
| Alpha | Employees (dogfood) | 1 week | No P0 bugs; client/server disagreement < 1% |
| Beta / A/B | 5% of active traders, 50/50 | 2–3 weeks | Primary metric significant; guardrails hold |
| Ramp | 50% | 1 week | Stable crash rate and latency |
| GA | 100% | — | Classic pad retired after 2 more weeks |

Kill switch: remote flag reverts to classic pad without an app release.

## 2. Readiness checklist

| Team | Item |
|---|---|
| Engineering | Flag, remote config for rules/copy, idempotent order API, margin API SLAs |
| QA | Regression on all order types × products × segments; expiry-day and market-closed tests; slow network |
| Risk & Compliance | Copy sign-off; margin disclaimer; audit logging of client checks |
| Support | FAQ and macros for each rejection code; internal demo |
| Analytics | Events validated; experiment dashboard live before beta |
| Marketing / Growth | In-app announcement, release notes, short video, WhatsApp broadcast to opted-in users |
| Business | Brief RMs and branch partners on new behaviour |

## 3. Messaging

**Headline:** *Know before you trade.*
**Sub-head:** TradeDesk now checks your order before you place it — margin, lot size, price band and more — and fixes it in one tap.

| Audience | Message | Channel |
|---|---|---|
| Active F&O traders | "No more 'Margin exceeds' surprises. See exactly what you need, top up in one tap." | In-app, push |
| New investors | "We explain every step, in plain English, before your order goes out." | Onboarding, email |
| RMs / support | What changed, top 5 rejection codes, how to guide clients | Internal training |

## 4. Release notes (draft)

> **What's new**
> - The order pad now checks your order as you type and tells you if it would be rejected, why, and how to fix it.
> - Short on margin? Add funds via UPI without leaving the order pad.
> - Rejected orders now show a clear reason and a *Fix & retry* button.

## 5. FAQ (support)

**Why can't I tap Buy?** One or more checks would make the exchange or our RMS reject this order. Tap the suggested fix or edit the highlighted field.
**I passed all checks but the order was rejected.** Prices or margins can change in the seconds before your order reaches the exchange. Check the reason in the Order Book and tap *Fix & retry*.
**Are the charges exact?** They are estimates. Your contract note shows the final charges.

## 6. Post-launch review cadence

| When | Review |
|---|---|
| Daily (first 2 weeks) | Rejection rate by code, crash rate, support tickets |
| Weekly | Experiment readout, guardrails, qualitative feedback from support and app reviews |
| 30 days | Ship/iterate decision; next iteration (iceberg, personal nudges) |
| 90 days | Impact on activation, retention and turnover per active trader |
