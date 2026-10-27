# 06 · Process Flows

Diagrams use Mermaid (renders on GitHub).

## 6.1 Order lifecycle (state machine)

```mermaid
stateDiagram-v2
    [*] --> Draft: Open order pad
    Draft --> Draft: Edit (checks re-run)
    Draft --> Review: All blocking checks pass
    Review --> Draft: Back
    Review --> RMS: Confirm
    RMS --> Rejected: Rule fails
    RMS --> AMO_Pending: AMO & market closed
    RMS --> Trigger_Pending: SL / SL-M
    RMS --> Open: MARKET / LIMIT
    AMO_Pending --> Open: Market opens
    Trigger_Pending --> Open: LTP crosses trigger
    Open --> Partial: Partial fill
    Partial --> Complete: Remaining filled
    Open --> Complete: Fully filled
    Open --> Cancelled: User cancels
    Partial --> Cancelled: User cancels remainder
    Trigger_Pending --> Cancelled: User cancels
    Rejected --> Draft: Fix & retry
    Complete --> [*]
    Cancelled --> [*]
```

## 6.2 Smart Order Pad — check & fix loop

```mermaid
flowchart TD
    A[User opens pad from watchlist / chart / option chain / alert] --> B[Prefill symbol, side, product default]
    B --> C{Run pre-trade checks}
    C -->|any FAIL| D[Show blocking card + fix CTA<br/>Button: 'Fix N issues']
    D -->|Tap fix| E{Fix type}
    E -->|Set qty / price / product / AMO| C
    E -->|Add funds| F[UPI from pad] --> G{Payment ok?}
    G -->|Yes| C
    G -->|No| D
    D -->|User edits fields| C
    C -->|WARN only| H[Show heads-up cards<br/>Button enabled]
    C -->|All PASS| I[Button: Review]
    H --> I
    I --> J[Review sheet: value, margin, charges, warnings]
    J -->|Confirm| K[POST /orders]
    K --> L{RMS}
    L -->|Accepted| M[Toast + Order book]
    L -->|Rejected| N[Plain reason + Fix & retry]
```

## 6.3 Place order — sequence

```mermaid
sequenceDiagram
    participant U as User
    participant App as App (Smart pad)
    participant API as Broker API
    participant RMS
    participant OMS
    participant X as Exchange
    U->>App: Enter qty / price
    App->>App: runPreTradeChecks (local, every change)
    App->>API: GET /margins/order (debounced)
    API-->>App: required, available
    U->>App: Confirm
    App->>API: POST /orders (Idempotency-Key)
    API->>RMS: validate
    alt fails
        RMS-->>API: code + raw text
        API-->>App: 4xx {code, message}
        App-->>U: Plain reason + Fix & retry
    else passes
        RMS->>OMS: route
        OMS->>X: new order
        X-->>OMS: ack / fills
        OMS-->>App: order update (WebSocket)
        App-->>U: Toast + order book
    end
```

## 6.4 Square-off a position

```mermaid
flowchart LR
    A[Positions] --> B[Tap Exit] --> C[Build opposite MARKET order<br/>qty = |net qty|, same product]
    C --> D[Checks: exit needs no margin] --> E[POST /orders] --> F{Filled?}
    F -->|Yes| G[Position closed · realised P&L · margin released]
    F -->|No| H[Show error + retry]
```

## 6.5 Add funds (inline or Funds screen)

```mermaid
sequenceDiagram
    participant U as User
    participant App
    participant Pay as Payments (UPI)
    participant L as Ledger
    U->>App: Add ₹37,000
    App->>Pay: Create intent (amount, account)
    Pay-->>U: UPI app / collect request
    U->>Pay: Approve with UPI PIN
    Pay-->>App: Success callback
    App->>L: Credit PAYIN
    L-->>App: New available margin
    App-->>U: Margin updated, checks re-run
```

## 6.6 Start a SIP

```mermaid
flowchart TD
    A[Mutual funds] --> B[Pick fund] --> C[Monthly SIP tab]
    C --> D[Amount ≥ min SIP? date] --> E{Mandate exists?}
    E -->|Yes| F[Create SIP]
    E -->|No| G[Set up e-mandate / UPI AutoPay] --> F
    F --> H[SIP active · next date shown]
```

## 6.7 WhatsApp price alert → trade

```mermaid
sequenceDiagram
    participant U as User
    participant App
    participant Alerts as Alert engine
    participant WA as WhatsApp Business API
    U->>App: Create alert (RELIANCE ≥ 1,420, WhatsApp on)
    App->>Alerts: POST /alerts
    Alerts->>Alerts: Evaluate on every tick
    Alerts->>WA: Send template "price_alert" + quick replies
    WA-->>U: Message with Buy / Sell buttons
    U->>WA: Tap Buy
    WA->>App: Deep link app://order?symbol=RELIANCE&side=BUY
    App-->>U: Smart pad prefilled
```
