# HyperEVM AI Terminal MVP Design

## 1. Overview

This document defines the MVP design for a HyperEVM spot trading terminal inside `app.coolha.com`.

The product direction is:

- A single-page `AI Terminal`
- HyperEVM spot token swaps only
- Pure frontend integration
- Direct quote and transaction assembly through `0x Swap API` on HyperEVM
- Self-custody only
- No user fund custody
- No private key handling
- No trade execution without wallet confirmation
- Revenue target through `builder / integrator fee`, subject to supplier support

The MVP is designed for crypto-native non-US users, but the first version only includes disclaimers and does not implement geo-blocking or IP gating.

## 2. Goals

### Primary goals

- Let users connect an EVM wallet and trade whitelist tokens on HyperEVM
- Make each trade fully self-custodial and wallet-confirmed
- Provide a terminal-like interface with chart, swap card, wallet status, and AI insight panel
- Try to monetize through `builder / integrator fee` using a direct frontend supplier integration
- Keep the implementation close to the existing `Next.js + wagmi + viem + Reown AppKit` stack

### MVP success criteria

- User can connect wallet from the existing app shell
- User can switch to HyperEVM mainnet
- User can view a quote for supported token pairs
- User can approve ERC-20 tokens when needed
- User can submit a swap transaction from wallet
- User can see pending, success, and failure states
- User can read AI-generated trade explanation, risk summary, and non-automatic trade suggestions

### Out of scope

- Real stocks or listed securities
- Perpetuals
- Limit orders
- Copy trading
- Automated execution without confirmation
- Portfolio management
- Full compliance gating by region
- Backend API router
- Multi-provider routing
- Full PnL or cost-basis accounting

## 3. Product Boundaries

The product must be positioned as a self-custody trading interface, not as an exchange, broker, advisor, or asset manager.

The boundary rules are:

- Every trade must be confirmed by the user in wallet
- The app must never store, export, or request private keys
- The app must never custody user assets
- The app must never place trades on behalf of users
- The AI layer must not automatically trigger wallet actions
- The AI layer may explain trades, flag risks, and provide scenario-style suggestions only

### Allowed AI language

- "This trade swaps X for Y"
- "Liquidity is thinner than usual"
- "Slippage risk is elevated"
- "A more conservative approach may be to split the order"
- "This appears aggressive for the current price context"

### Disallowed AI language

- "Guaranteed return"
- "Buy now for profit"
- "I will execute this for you"
- "This is a safe investment"
- "You should copy this strategy"

### Required disclaimer direction

The interface should include concise warnings such as:

- This interface is for self-custody token trading only
- All transactions require your own wallet confirmation
- AI content is for interface assistance and does not constitute investment advice
- Token trading involves market, liquidity, and smart contract risks

## 4. User Scope

### Target user

- Crypto-native user
- Familiar with wallets such as MetaMask, Rabby, and WalletConnect-compatible apps
- Wants a clean swap terminal on HyperEVM
- Accepts a self-directed trading experience

### Supported wallets

- MetaMask
- Rabby
- WalletConnect-compatible wallets

### Unsupported in MVP

- Embedded wallets
- Social login wallets
- Managed wallets
- Exchange account login

## 5. Asset Scope

### Whitelist-only token universe

The first release uses a strict whitelist:

- `HYPE`
- `USDT0`
- `USDC`
- `ETH`
- `BTC`

Rationale:

- Reduces risk from malicious tokens
- Keeps token metadata controlled
- Simplifies quote, balance, and chart logic
- Fits the user's stated MVP scope

### Token listing policy in MVP

- Only whitelisted tokens appear in selector and market list
- No arbitrary token address entry
- No long-tail token discovery
- Token decimals, symbols, icons, and sorting are maintained locally in code

## 6. Technical Approach

### Chosen integration path

The MVP uses:

- Pure frontend integration
- Single liquidity / quote provider
- `0x Swap API` for HyperEVM

Public references indicate that `0x Swap API` supports `HyperEVM` using `chainId 999`, which makes it a viable direct-integration candidate for this MVP:

- https://0x.org/post/hyperevm-support

HyperEVM base chain parameters referenced during design:

- Chain ID: `999`
- Native gas token: `HYPE`
- RPC: `https://rpc.hyperliquid.xyz/evm`

Reference:

- https://hyperliquid.gitbook.io/hyperliquid-docs/onboarding/how-to-use-the-hyperevm

### Why this path

- Fastest path to shipping a working terminal
- Stays aligned with the user's requirement for pure frontend implementation
- Reuses the existing frontend wallet stack already present in the project
- Avoids building or operating an API router in the MVP

### Known constraints

- `builder / integrator fee` stability depends on supplier support, configuration, and policy
- Pure frontend exposure can make supplier credentials or rate-limited access harder to protect
- A single supplier creates availability and business dependency risk
- Some production controls such as logging, throttling, geo-control, and key protection are weaker without a backend layer

## 7. Core User Flow

### Happy path

1. User opens the AI terminal page
2. User connects wallet
3. App checks active chain
4. If needed, app prompts switch to HyperEVM
5. App loads whitelist token balances
6. User selects sell token, buy token, and amount
7. App fetches quote from `0x Swap API`
8. App displays expected output, route summary, gas estimate, slippage, and fee details
9. If sell token allowance is insufficient, user sends `approve`
10. User confirms the swap in wallet
11. App tracks the transaction
12. App refreshes balances after confirmation
13. AI panel updates explanation, risk notes, and suggestion text

### Key failure branches

- Wallet not connected
- Wrong chain
- No HYPE for gas
- Quote unavailable
- Allowance transaction rejected
- Swap transaction rejected
- Swap transaction reverted
- Quote expired before signing

## 8. Interface Design

### Page model

The MVP is a single-page terminal at:

- `src/app/(APP)/ai/page.tsx`

### Layout

The recommended layout is a three-column desktop terminal:

- Left column: market and token list
- Center column: chart and swap execution card
- Right column: AI insight and risk panel

On smaller screens:

- Chart and swap become the primary stack
- Market list collapses into a drawer or top sheet
- AI panel collapses below trade card or into tabs

### Primary sections

#### Left column

- Token whitelist list
- Search over whitelisted assets
- 24h change display
- Quick pair selection

#### Center column

- Token pair header
- Third-party chart widget or chart panel
- Swap card
- Quote details
- CTA area for connect, switch network, approve, and swap

#### Right column

- Trade explanation
- Risk badges
- Non-automatic suggestion text
- Disclaimer block
- Wallet status summary

### Page states

- Not connected
- Connected on unsupported chain
- Connected on HyperEVM
- Loading balances
- No quote yet
- Loading quote
- Quote ready
- Awaiting approval
- Awaiting swap confirmation
- Transaction pending
- Transaction succeeded
- Transaction failed

## 9. Component Plan

Recommended component structure:

```txt
src/
  app/
    (APP)/
      ai/
        page.tsx
  components/
    hyperliquid/
      MarketList.tsx
      TokenSelector.tsx
      TradingViewPanel.tsx
      SwapCard.tsx
      QuoteDetails.tsx
      WalletStatusBar.tsx
      AiInsightPanel.tsx
      RiskBadges.tsx
  lib/
    hyperliquid/
      allowance.ts
      ai-explainer.ts
      balances.ts
      chains.ts
      quotes.ts
      risk-engine.ts
      swaps.ts
      tokens.ts
      transactions.ts
      types.ts
```

### Responsibilities

- `page.tsx`: top-level composition and state orchestration
- `MarketList.tsx`: whitelist asset browsing and quick pair selection
- `TokenSelector.tsx`: sell and buy token selection UI
- `TradingViewPanel.tsx`: chart host component
- `SwapCard.tsx`: amount input, slippage, and action state machine
- `QuoteDetails.tsx`: route, price impact, estimated receive, fee display
- `WalletStatusBar.tsx`: network, wallet, and gas readiness
- `AiInsightPanel.tsx`: explanation, risk summary, suggestion area
- `RiskBadges.tsx`: compact risk signals

## 10. Frontend Modules

### `tokens.ts`

- Stores whitelist token metadata
- Contains symbol, address, decimals, icon path, and display order

### `chains.ts`

- Centralizes HyperEVM chain configuration
- Exposes chain ID, rpc URL, native token metadata, and explorer URL

### `balances.ts`

- Reads native HYPE balance
- Reads ERC-20 balances for whitelisted assets
- Normalizes values for UI consumption

### `quotes.ts`

- Encapsulates 0x quote fetching
- Maps supplier response into app-specific quote model
- Handles loading, expiry, and error normalization

### `allowance.ts`

- Reads ERC-20 allowance
- Determines whether approval is required before swap
- Builds approval flow data for UI

### `swaps.ts`

- Converts supplier transaction payload into wallet-sendable transaction request
- Sends swap transaction through connected wallet

### `transactions.ts`

- Tracks pending transactions
- Waits for confirmations
- Refreshes balances after settlement

### `risk-engine.ts`

- Local deterministic risk rules
- Works even if AI output is unavailable

### `ai-explainer.ts`

- Builds structured UI text from quote, token pair, balances, and risk engine output
- Keeps first release usable without requiring autonomous agents

### `types.ts`

- Shared interfaces for tokens, quotes, risk flags, transaction states, and UI models

## 11. State and Data Model

### Core UI state

- Connected address
- Active wallet connection status
- Active chain ID
- Sell token
- Buy token
- Sell amount
- Slippage setting
- Current quote
- Allowance status
- Approval transaction status
- Swap transaction status
- Wallet balances
- Native gas readiness
- AI insight block

### Minimal derived states

- `isWalletConnected`
- `isCorrectChain`
- `hasEnoughGas`
- `needsApproval`
- `canRequestQuote`
- `canSwap`
- `quoteExpired`

## 12. AI Layer Design

The AI layer is assistive, not autonomous.

### Inputs

- Selected pair
- Amount entered
- Quote output
- Estimated slippage
- Expected price impact
- Wallet balance context
- Token concentration against total visible whitelist balance

### Outputs

- Plain-language trade explanation
- Risk notes
- A simple action style such as conservative, neutral, or aggressive
- Scenario-style suggestion such as splitting an order or waiting for better liquidity

### Guardrails

- No automatic signing or execution
- No continuous monitoring promise
- No profit promise
- No account-management framing
- Suggestions must remain informational and reversible

## 13. External Dependencies

### Wallet and chain

- `wagmi`
- `viem`
- `@reown/appkit`
- `@reown/appkit-adapter-wagmi`

### Quote and swap

- `0x Swap API`

### Chart

- Third-party chart widget or embedded market chart source

### RPC

- Official HyperEVM RPC or compatible provider endpoint

## 14. Builder Fee and Revenue Risk

Revenue is a product requirement, but this MVP has an important dependency:

- The app is pure frontend
- The app uses a single supplier
- The app expects stable `builder / integrator fee`

This creates a structural business risk:

- Revenue depends on the supplier's support for integrator configuration on HyperEVM
- Revenue behavior may depend on API key policy, partner setup, or commercial approval
- Exposing integration details in a pure frontend architecture is weaker than using a protected backend layer

Therefore the design records the following truth:

- Builder fee is a required business objective
- Builder fee stability is an external dependency, not an internally guaranteed property

This should be treated as the highest-risk assumption in the MVP.

## 15. Compliance and Messaging

### Product posture

The product should be described as:

- Self-custody trading interface
- Wallet-connected swap terminal
- AI-assisted interface for explanation and risk awareness

The product should not be described as:

- Wealth manager
- AI trader
- Managed strategy
- Automatic execution system
- Broker for securities

### Compliance posture in MVP

- Disclaimer only
- No geo-fencing
- No IP blocking
- No region-specific legal workflow

This is intentionally lightweight, but it increases legal exposure versus a gated rollout.

## 16. Testing Strategy

### Functional verification

- Connect wallet
- Switch to HyperEVM
- Load balances for whitelisted assets
- Request quote for supported pairs
- Handle no-quote states
- Run approval flow when needed
- Submit swap
- Detect pending and confirmed transaction states
- Refresh balances after completion

### Error-path verification

- Reject wallet connection
- Reject network switch
- Reject approval
- Reject swap
- Simulate expired quote
- Simulate insufficient HYPE gas
- Simulate supplier quote failure

### UI verification

- Desktop three-column layout
- Mobile stacked layout
- Dark and light theme compatibility with project theme system
- Long token symbol fallback handling
- Disabled action states clarity

## 17. Open Risks

### Highest risk

- Stable builder fee depends on supplier capabilities and policy

### High risk

- Pure frontend exposure increases risk around rate limiting or supplier abuse
- Single-provider dependency can disable trading if the supplier is degraded

### Medium risk

- Disclaimer-only compliance posture may be insufficient for broad public distribution
- AI suggestion language can accidentally drift into advisory framing if not tightly controlled

### Lower risk

- Wallet-driven self-custody execution is aligned with common DeFi integration patterns
- Whitelist-only asset support reduces token safety and UX complexity issues

## 18. Recommended Next Phase

After user review of this design, the implementation plan should break work into:

1. HyperEVM mainnet wallet/network support
2. Token whitelist and balance plumbing
3. Quote fetching and swap execution flow
4. Single-page terminal UI
5. AI explanation and risk panels
6. Builder fee validation and production-readiness review

## 19. Final Summary

This MVP is a lean HyperEVM spot trading terminal built as a pure frontend application inside the existing Next.js app.

It deliberately optimizes for:

- Fast launch
- Minimal architecture change
- Self-custody execution
- Familiar wallet-based UX
- Early monetization through builder fee if supplier support holds

It deliberately accepts:

- Single-provider dependency
- Higher supplier exposure due to frontend-only integration
- Limited compliance controls in the first release

The design is suitable for a first release as long as builder fee dependency is explicitly treated as the core go/no-go assumption.
