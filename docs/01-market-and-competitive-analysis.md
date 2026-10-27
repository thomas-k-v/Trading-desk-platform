# 01 · Market & Competitive Analysis

> Feature observations below are from public app experiences and are directional. Verify current behaviour in each app before quoting them in an interview — these products ship weekly.

## 1. Market context (India retail broking)

- **Demat accounts have grown several-fold since 2020**, driven by zero-brokerage delivery, UPI-based funding and simple mobile onboarding. Growth is now coming from Tier-2/3 cities and first-time investors.
- **Activity is concentrated in F&O**, especially index options on expiry days. SEBI's 2024–25 measures (fewer weekly expiries per exchange, higher contract sizes, upfront collection of option premium, intraday position-limit monitoring) raised the cost of mistakes and made **margin clarity** more important.
- **Discount brokers dominate active users**; bank-led brokers win on trust, 3-in-1 accounts (bank + demat + trading) and an existing customer base, but are often perceived as heavier and less modern on mobile.
- **Mutual fund SIPs** are the steady-state product for most new investors and the main cross-sell path from investing to trading.

**Implication:** a bank-backed broker can't win on price. It wins on **trust + fewer failed journeys + a seamless 3-in-1 money flow** (funds instantly available to trade, no pay-in friction).

## 2. Competitive teardown — core trading modules

| Module | Zerodha Kite | Groww | Upstox | Dhan | Angel One | **Gap / opportunity** |
|---|---|---|---|---|---|---|
| Watchlist | Multiple lists, dense, keyboard-first on web | Simple, investor-first | Multiple lists, widgets | Trader-oriented, options-first | Lists + recommendations | Personalised starter lists from holdings and searches |
| Order Pad | Fast, compact; margin shown; rejections post-submit | Very simple; fewer advanced types up front | Standard; margin calc | Fast, scalper features, option-chain trading | Standard; plenty of upsell | **Pre-submit RMS checks with one-tap fixes** — not standard anywhere |
| Order Book | Clear; RMS text on rejection | Simplified status | Standard | Standard | Standard | Plain-language reason + *Fix & retry* |
| Positions | MTM, exit, convert | Simple | Analytics | Strong P&L views | Standard | Realised/unrealised split + one-tap exit |
| Portfolio | Holdings + analytics in partner apps | Strong MF + stocks unified view | Unified | Unified | Unified | Sector allocation & day P&L at a glance |
| Funds | UPI, clear margin breakup | UPI-first | UPI | UPI | UPI | **Instant pay-in from inside the order pad** (bank advantage) |
| Charts | TradingView + ChartIQ | TradingView-based | TradingView | TradingView, trade from chart | TradingView | Table stakes — must match, not differentiate |
| Option chain | Via partner tools / Kite | Built-in, simple | Built-in with Greeks | Advanced (OI, Greeks, strategy) | Built-in | Add PCR, max-pain, ITM shading, tap-to-trade |
| Alerts | GTT + alerts | Price alerts | Alerts | Alerts | Alerts + WhatsApp-based support | **WhatsApp alert → deep-link to order pad** |
| Client / Algo APIs | Kite Connect (paid, mature) | Limited | Upstox API (free tier) | DhanHQ API (free) | SmartAPI (free) | Free, well-documented API + no-code strategy builder |

## 3. Positioning for a bank-led broker

| Strength to exploit | Product expression |
|---|---|
| Customer already has a bank account with us | Pay-in without leaving the order pad; auto-sweep idle cash (opt-in) |
| Trust and service | Explain every rejection; human-readable contract notes and charges |
| Large base of savers who are not yet traders | MF/SIP first, guided first trade, paper-money mode |
| Relationship managers and branches | RM-assisted baskets, WhatsApp as a service channel |

## 4. SWOT (for the trading app)

| | |
|---|---|
| **Strengths** — Bank parent, 3-in-1 account, brand trust, research desk | **Weaknesses** — Perceived as slower/heavier UX, legacy RMS messaging, more steps per order |
| **Opportunities** — First-time investors, WhatsApp engagement, client APIs for algo traders, personalisation | **Threats** — Discount brokers' speed and pricing, regulatory changes to F&O, rising expectations of instant everything |

## 5. Where TradeDesk focuses

1. **Order Pad reliability** (this case study) — highest frequency, highest emotion moment.
2. **Funds-to-trade continuity** — bank advantage.
3. **Engagement loops** — WhatsApp alerts, personalised watchlists.
4. **Developer platform** — client API and strategy builder for the active-trader segment.
