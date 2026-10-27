# 02 · User Research & Personas

> **Method note.** These personas are *proto-personas*: hypotheses built from public app reviews, community forums, support-style FAQs published by brokers, and my own use of trading apps. Before building, they would be validated with ~12 interviews (4 per segment) and support-ticket tagging. The interview guide is at the end.

## Persona 1 — Rahul, the F&O intraday trader

| | |
|---|---|
| Age / city | 29, Pune · IT professional who trades in the morning and at lunch |
| Experience | 3 years, mostly NIFTY/BANKNIFTY options, some stock futures |
| Devices | Web on a laptop at home, mobile at work |
| Goals | Enter and exit fast; know exact margin; never get stuck in a position |
| Frustrations | "Margin exceeds" when he *thought* he had funds (premium blocked by an open order); quantity not in lots after lot-size changes; freeze-qty rejections on big orders on expiry day |
| Quote (paraphrased theme) | "By the time I understood why it was rejected, the move was gone." |
| What success looks like | Order goes through on the first tap; one place shows margin needed vs available |

## Persona 2 — Meera, the long-term investor

| | |
|---|---|
| Age / city | 41, Mumbai · Chartered accountant |
| Experience | 10+ years in mutual funds, 4 years in direct equity |
| Goals | Build a portfolio, run SIPs, rebalance yearly, download clean tax reports |
| Frustrations | Hard to see total portfolio (stocks + MF) in one place; P&L reports that don't reconcile with the ledger; jargon |
| What success looks like | One portfolio view, sector allocation, clean CSV/PDF reports |

## Persona 3 — Arjun, the first-time trader

| | |
|---|---|
| Age / city | 23, Indore · First job, opened a 3-in-1 account through his bank app |
| Experience | Weeks; learned from YouTube |
| Goals | Make a first trade without embarrassing mistakes; learn |
| Frustrations | Doesn't know the difference between CNC/MIS/NRML, LIMIT/MARKET/SL; tried to sell a stock he bought the same day as "delivery" and got a cryptic error; scared of losing money on an accidental order |
| What success looks like | Guided first trade, plain language, "undo-able" feeling, small amounts |

## Jobs to be done

| When… | I want to… | So I can… |
|---|---|---|
| I see a level breaking on the chart | place the right order in one go | catch the move |
| An order is rejected | understand why and fix it immediately | not miss the trade |
| I have open positions | see live P&L and exit in one tap | control risk |
| I get paid | start or step up a SIP | invest without thinking |
| A stock hits my price | get notified where I already am (WhatsApp) | act without watching screens |
| It's tax season | export realised P&L and charges | file correctly |

## Journey map — "place an F&O order" (current state with classic order pad)

| Stage | Discover | Decide | Enter order | Submit | Outcome |
|---|---|---|---|---|---|
| Action | Watchlist / option chain | Chart, OI | Choose lots, price, product | Tap Buy | Order book |
| Thinking | "Is this the right strike?" | "How much margin?" | "Is it 75 or 1 lot?" | "Hope this works" | "Why rejected??" |
| Emotion | 🙂 | 😐 | 😟 | 😬 | 😡 |
| Pain | — | Margin not visible until pad | Lot vs qty confusion | No pre-check | Cryptic RMS text, no fix path |
| **Opportunity** | Tap-to-trade from chain | Margin in pad | Lots input + lot hint | **Pre-trade checks** | **Plain reason + Fix & retry** |

## Prioritised pain points

| # | Pain | Personas | Frequency | Severity | Addressed by |
|---|---|---|---|---|---|
| 1 | Rejections with unclear reasons | Rahul, Arjun | High | High | Smart Order Pad |
| 2 | Margin needed vs available unclear | Rahul | High | High | Margin strip + inline add funds |
| 3 | Product/order-type jargon | Arjun | Medium | Medium | Plain labels ("Delivery", "Intraday") + checks |
| 4 | Fragmented portfolio view | Meera | Medium | Medium | Holdings with MF + allocation |
| 5 | Missing moves when away | Rahul, Meera | Medium | Medium | WhatsApp alerts with quick replies |
| 6 | Reports don't reconcile | Meera | Low | High | Reports with charges + ledger |

## Interview guide (validation)

1. Walk me through the last order you placed. What screen did you start from?
2. Tell me about a time an order didn't go through. What did you see? What did you do next?
3. How do you check whether you have enough margin before trading?
4. (Show classic vs smart pad prototype) Which would you trust more and why?
5. How do you prefer to be notified about price moves? Have you ever acted on a notification?
6. What do you do at the end of the financial year with your trading reports?
