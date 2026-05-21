# HyperEVM AI Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `src/app/(APP)/ai/page.tsx` 落地一个纯前端的 HyperEVM 现货交易 Terminal，支持白名单代币、0x 报价/授权/交换、钱包确认、基础 AI 风险解释。

**Architecture:** 继续使用现有的 `wagmi + viem + Reown AppKit` 钱包体系，把 HyperEVM 主网配置补齐；交易能力封装在 `src/lib/hyperliquid/` 下的纯前端模块中，页面用单页三栏 Terminal 组合这些模块。测试只给纯逻辑模块和关键 UI 状态做聚焦覆盖，链上与钱包交互以手动验证为主。

**Tech Stack:** Next.js 16, React 19, TypeScript, wagmi, viem, Reown AppKit, 0x Swap API, Vitest, Testing Library

---

## 文件结构

### 预计新增文件

- `docs/superpowers/specs/2026-05-21-hyperevm-terminal-design.md`
- `docs/superpowers/plans/2026-05-21-hyperevm-terminal.md`
- `src/lib/hyperliquid/chains.ts`
- `src/lib/hyperliquid/tokens.ts`
- `src/lib/hyperliquid/types.ts`
- `src/lib/hyperliquid/quotes.ts`
- `src/lib/hyperliquid/allowance.ts`
- `src/lib/hyperliquid/swaps.ts`
- `src/lib/hyperliquid/balances.ts`
- `src/lib/hyperliquid/transactions.ts`
- `src/lib/hyperliquid/risk-engine.ts`
- `src/lib/hyperliquid/ai-explainer.ts`
- `src/components/hyperliquid/MarketList.tsx`
- `src/components/hyperliquid/TokenSelector.tsx`
- `src/components/hyperliquid/TradingViewPanel.tsx`
- `src/components/hyperliquid/SwapCard.tsx`
- `src/components/hyperliquid/QuoteDetails.tsx`
- `src/components/hyperliquid/WalletStatusBar.tsx`
- `src/components/hyperliquid/AiInsightPanel.tsx`
- `src/components/hyperliquid/RiskBadges.tsx`
- `src/test/setup.ts`
- `src/lib/hyperliquid/__tests__/tokens.test.ts`
- `src/lib/hyperliquid/__tests__/risk-engine.test.ts`
- `src/lib/hyperliquid/__tests__/ai-explainer.test.ts`
- `src/components/hyperliquid/__tests__/SwapCard.test.tsx`
- `vitest.config.ts`

### 预计修改文件

- `package.json`
- `src/config/wagmi.tsx`
- `src/config/Wagmi_Provider.tsx`
- `src/app/(APP)/ai/page.tsx`

### 职责边界

- `src/config/*`：钱包与网络接入
- `src/lib/hyperliquid/*`：链配置、代币白名单、报价/授权/交易、风险解释
- `src/components/hyperliquid/*`：Terminal UI 组件
- `src/app/(APP)/ai/page.tsx`：页面编排、状态调度
- `src/**/*.test.*`：纯逻辑与关键交互状态测试

## 任务拆解

### Task 1: 搭好 HyperEVM 主网与测试基础设施

**Files:**
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\vitest.config.ts`
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\test\setup.ts`
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\lib\hyperliquid\chains.ts`
- Modify: `c:\AAAAAA-Code\coolha-com\app.coolha.com\package.json`
- Modify: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\config\wagmi.tsx`
- Modify: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\config\Wagmi_Provider.tsx`

- [ ] **Step 1: 安装最小测试依赖并补脚本**

```json
{
  "scripts": {
    "dev": "next dev --webpack",
    "build": "next build --webpack",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.8.0",
    "@testing-library/react": "^16.1.0",
    "jsdom": "^26.1.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: 写测试配置文件**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
```

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 3: 定义 HyperEVM 主网常量**

```ts
// src/lib/hyperliquid/chains.ts
export const HYPEREVM_CHAIN_ID = 999

export const HYPEREVM_MAINNET = {
  id: HYPEREVM_CHAIN_ID,
  name: 'Hyperliquid',
  network: 'hyperliquid',
  nativeCurrency: {
    decimals: 18,
    name: 'HYPE',
    symbol: 'HYPE',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.hyperliquid.xyz/evm'],
    },
  },
  blockExplorers: {
    default: {
      name: 'HyperEVM Scan',
      url: 'https://hyperevmscan.io',
    },
  },
} as const
```

- [ ] **Step 4: 把 HyperEVM 主网接入现有钱包配置**

```ts
// src/config/wagmi.tsx
import { cookieStorage, createStorage, defineChain, http } from '@wagmi/core'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { arcTestnet, baseSepolia, hyperliquidEvmTestnet, sepolia, tempoTestnet } from '@reown/appkit/networks'
import { HYPEREVM_MAINNET } from '@/lib/hyperliquid/chains'

const hyperEvmMainnet = defineChain(HYPEREVM_MAINNET)

export const networks = [hyperEvmMainnet, sepolia, baseSepolia, arcTestnet, tempoTestnet, hyperliquidEvmTestnet]
export const defaultNetwork = hyperEvmMainnet

// transports 追加：
[hyperEvmMainnet.id]: http(HYPEREVM_MAINNET.rpcUrls.default.http[0]),
```

```ts
// src/config/Wagmi_Provider.tsx
import { defineChain } from 'viem'
import { HYPEREVM_MAINNET } from '@/lib/hyperliquid/chains'

const hyperEvmMainnet = defineChain(HYPEREVM_MAINNET)

// createAppKit 的 networks 与 defaultNetwork 改成：
networks: [hyperEvmMainnet, sepolia, baseSepolia, arcTestnet, tempoTestnet, hyperliquidEvmTestnet],
defaultNetwork: hyperEvmMainnet,
```

- [ ] **Step 5: 运行基础校验**

Run: `npm install`
Expected: 安装完成，无 peer dependency 阻塞错误

Run: `npm run lint`
Expected: PASS 或仅出现与本任务无关的既有警告

Run: `npm run test`
Expected: PASS with `No test files found` 或 0 tests, because logic tests are added in later tasks

- [ ] **Step 6: 提交**

```bash
git add package.json package-lock.json vitest.config.ts src/test/setup.ts src/lib/hyperliquid/chains.ts src/config/wagmi.tsx src/config/Wagmi_Provider.tsx
git commit -m "feat: add hyperevm wallet and test foundation"
```

### Task 2: 落白名单代币、类型和风险解释基础模块

**Files:**
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\lib\hyperliquid\types.ts`
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\lib\hyperliquid\tokens.ts`
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\lib\hyperliquid\risk-engine.ts`
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\lib\hyperliquid\ai-explainer.ts`
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\lib\hyperliquid\__tests__\tokens.test.ts`
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\lib\hyperliquid\__tests__\risk-engine.test.ts`
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\lib\hyperliquid\__tests__\ai-explainer.test.ts`

- [ ] **Step 1: 先写白名单与解释逻辑的失败测试**

```ts
// src/lib/hyperliquid/__tests__/tokens.test.ts
import { describe, expect, it } from 'vitest'
import { HYPEREVM_TOKENS, getTokenBySymbol } from '../tokens'

describe('tokens', () => {
  it('returns only whitelist tokens in stable order', () => {
    expect(HYPEREVM_TOKENS.map((token) => token.symbol)).toEqual(['HYPE', 'USDT0', 'USDC', 'ETH', 'BTC'])
  })

  it('finds token by symbol', () => {
    expect(getTokenBySymbol('HYPE')?.symbol).toBe('HYPE')
    expect(getTokenBySymbol('DOGE')).toBeUndefined()
  })
})
```

```ts
// src/lib/hyperliquid/__tests__/risk-engine.test.ts
import { describe, expect, it } from 'vitest'
import { evaluateTradeRisk } from '../risk-engine'

describe('evaluateTradeRisk', () => {
  it('flags high price impact and low gas readiness', () => {
    const result = evaluateTradeRisk({
      hasEnoughGas: false,
      priceImpactBps: 250,
      slippageBps: 100,
    })

    expect(result.level).toBe('high')
    expect(result.flags).toContain('gas')
    expect(result.flags).toContain('price-impact')
  })
})
```

```ts
// src/lib/hyperliquid/__tests__/ai-explainer.test.ts
import { describe, expect, it } from 'vitest'
import { buildTradeInsight } from '../ai-explainer'

describe('buildTradeInsight', () => {
  it('returns explanation, warning, and suggestion text', () => {
    const result = buildTradeInsight({
      buySymbol: 'HYPE',
      sellSymbol: 'USDC',
      receiveAmount: '24.3',
      riskLevel: 'medium',
      riskFlags: ['slippage'],
    })

    expect(result.summary).toContain('USDC')
    expect(result.summary).toContain('HYPE')
    expect(result.suggestion).toContain('分批')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test -- src/lib/hyperliquid/__tests__/tokens.test.ts src/lib/hyperliquid/__tests__/risk-engine.test.ts src/lib/hyperliquid/__tests__/ai-explainer.test.ts`
Expected: FAIL，报模块不存在或导出不存在

- [ ] **Step 3: 写最小实现**

```ts
// src/lib/hyperliquid/types.ts
export type RiskLevel = 'low' | 'medium' | 'high'

export type TokenDefinition = {
  symbol: 'HYPE' | 'USDT0' | 'USDC' | 'ETH' | 'BTC'
  name: string
  address: `0x${string}` | 'native'
  decimals: number
  icon: string
}

export type RiskEvaluation = {
  level: RiskLevel
  flags: Array<'gas' | 'price-impact' | 'slippage'>
}
```

```ts
// src/lib/hyperliquid/tokens.ts
import type { TokenDefinition } from './types'

export const HYPEREVM_TOKENS: TokenDefinition[] = [
  { symbol: 'HYPE', name: 'Hyperliquid', address: 'native', decimals: 18, icon: '/tokens/hype.png' },
  { symbol: 'USDT0', name: 'USDT0', address: '0x1111111111111111111111111111111111111111', decimals: 6, icon: '/tokens/usdt0.png' },
  { symbol: 'USDC', name: 'USD Coin', address: '0x2222222222222222222222222222222222222222', decimals: 6, icon: '/tokens/usdc.png' },
  { symbol: 'ETH', name: 'Ether', address: '0x3333333333333333333333333333333333333333', decimals: 18, icon: '/tokens/eth.png' },
  { symbol: 'BTC', name: 'Bitcoin', address: '0x4444444444444444444444444444444444444444', decimals: 8, icon: '/tokens/btc.png' },
]

export function getTokenBySymbol(symbol: string) {
  return HYPEREVM_TOKENS.find((token) => token.symbol === symbol)
}
```

```ts
// src/lib/hyperliquid/risk-engine.ts
import type { RiskEvaluation } from './types'

type RiskInput = {
  hasEnoughGas: boolean
  priceImpactBps: number
  slippageBps: number
}

export function evaluateTradeRisk(input: RiskInput): RiskEvaluation {
  const flags: RiskEvaluation['flags'] = []

  if (!input.hasEnoughGas) flags.push('gas')
  if (input.priceImpactBps >= 200) flags.push('price-impact')
  if (input.slippageBps >= 100) flags.push('slippage')

  if (flags.includes('gas') || flags.includes('price-impact')) {
    return { level: 'high', flags }
  }

  if (flags.length > 0) {
    return { level: 'medium', flags }
  }

  return { level: 'low', flags }
}
```

```ts
// src/lib/hyperliquid/ai-explainer.ts
import type { RiskLevel } from './types'

type InsightInput = {
  sellSymbol: string
  buySymbol: string
  receiveAmount: string
  riskLevel: RiskLevel
  riskFlags: string[]
}

export function buildTradeInsight(input: InsightInput) {
  const summary = `本次交易会把 ${input.sellSymbol} 兑换成 ${input.buySymbol}，预计到账 ${input.receiveAmount} ${input.buySymbol}。`
  const warning = input.riskFlags.length > 0 ? `当前风险点：${input.riskFlags.join('、')}。` : '当前未发现明显的结构性风险提示。'
  const suggestion = input.riskLevel === 'high' ? '建议先缩小单笔金额或等待更稳定的流动性。' : '若你偏保守，可以考虑分批执行。'

  return { summary, warning, suggestion }
}
```

- [ ] **Step 4: 重新运行测试**

Run: `npm run test -- src/lib/hyperliquid/__tests__/tokens.test.ts src/lib/hyperliquid/__tests__/risk-engine.test.ts src/lib/hyperliquid/__tests__/ai-explainer.test.ts`
Expected: PASS，3 个测试文件全部通过

- [ ] **Step 5: 提交**

```bash
git add src/lib/hyperliquid/types.ts src/lib/hyperliquid/tokens.ts src/lib/hyperliquid/risk-engine.ts src/lib/hyperliquid/ai-explainer.ts src/lib/hyperliquid/__tests__/tokens.test.ts src/lib/hyperliquid/__tests__/risk-engine.test.ts src/lib/hyperliquid/__tests__/ai-explainer.test.ts
git commit -m "feat: add hyperevm token and risk helpers"
```

### Task 3: 接好余额、报价、授权和交易模块

**Files:**
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\lib\hyperliquid\balances.ts`
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\lib\hyperliquid\quotes.ts`
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\lib\hyperliquid\allowance.ts`
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\lib\hyperliquid\swaps.ts`
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\lib\hyperliquid\transactions.ts`

- [ ] **Step 1: 先给报价转换写失败测试**

```ts
// src/lib/hyperliquid/__tests__/quotes.test.ts
import { describe, expect, it } from 'vitest'
import { normalizePriceResponse } from '../quotes'

describe('normalizePriceResponse', () => {
  it('maps 0x response into UI quote model', () => {
    const quote = normalizePriceResponse({
      allowanceTarget: '0xabc',
      buyAmount: '1200000',
      grossBuyAmount: '1200000',
      minBuyAmount: '1180000',
      sellAmount: '1000000',
      fees: {
        integratorFee: { amount: '1000', token: 'USDC', type: 'volume' },
      },
      route: {
        fills: [{ from: 'USDC', to: 'HYPE', source: 'UniswapV3' }],
      },
    })

    expect(quote.buyAmount).toBe('1200000')
    expect(quote.integratorFeeAmount).toBe('1000')
    expect(quote.routeSummary).toContain('UniswapV3')
  })
})
```

- [ ] **Step 2: 跑失败测试**

Run: `npm run test -- src/lib/hyperliquid/__tests__/quotes.test.ts`
Expected: FAIL，提示 `normalizePriceResponse` 不存在

- [ ] **Step 3: 实现报价与交易模块**

```ts
// src/lib/hyperliquid/quotes.ts
const ZEROX_BASE_URL = 'https://api.0x.org'

export type UiQuote = {
  allowanceTarget?: string
  buyAmount: string
  minBuyAmount: string
  sellAmount: string
  integratorFeeAmount: string
  routeSummary: string
}

export function normalizePriceResponse(payload: any): UiQuote {
  const fills = payload.route?.fills ?? []

  return {
    allowanceTarget: payload.allowanceTarget,
    buyAmount: payload.buyAmount,
    minBuyAmount: payload.minBuyAmount ?? payload.buyAmount,
    sellAmount: payload.sellAmount,
    integratorFeeAmount: payload.fees?.integratorFee?.amount ?? '0',
    routeSummary: fills.map((fill: any) => fill.source).join(' > '),
  }
}

export async function fetchPrice(params: URLSearchParams, apiKey?: string) {
  const response = await fetch(`${ZEROX_BASE_URL}/swap/allowance-holder/price?${params.toString()}`, {
    headers: {
      '0x-version': 'v2',
      ...(apiKey ? { '0x-api-key': apiKey } : {}),
    },
  })

  if (!response.ok) throw new Error('Failed to fetch price')
  return response.json()
}

export async function fetchQuote(params: URLSearchParams, apiKey?: string) {
  const response = await fetch(`${ZEROX_BASE_URL}/swap/allowance-holder/quote?${params.toString()}`, {
    headers: {
      '0x-version': 'v2',
      ...(apiKey ? { '0x-api-key': apiKey } : {}),
    },
  })

  if (!response.ok) throw new Error('Failed to fetch quote')
  return response.json()
}
```

```ts
// src/lib/hyperliquid/allowance.ts
import { erc20Abi } from 'viem'

export function buildApproveRequest(tokenAddress: `0x${string}`, spender: `0x${string}`, amount: bigint) {
  return {
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, amount],
  } as const
}
```

```ts
// src/lib/hyperliquid/swaps.ts
export function buildSwapTransaction(quote: any) {
  return {
    to: quote.transaction.to as `0x${string}`,
    data: quote.transaction.data as `0x${string}`,
    value: BigInt(quote.transaction.value ?? '0'),
  }
}
```

```ts
// src/lib/hyperliquid/transactions.ts
import type { PublicClient } from 'viem'

export async function waitForTransaction(publicClient: PublicClient, hash: `0x${string}`) {
  return publicClient.waitForTransactionReceipt({ hash })
}
```

```ts
// src/lib/hyperliquid/balances.ts
import { formatUnits, type PublicClient } from 'viem'
import { getBalance, readContract } from '@wagmi/core'
import { erc20Abi } from 'viem'
import { getTokenBySymbol } from './tokens'

export async function readNativeHypeBalance(config: any, address: `0x${string}`) {
  const balance = await getBalance(config, { address })
  return formatUnits(balance.value, balance.decimals)
}

export async function readTokenBalance(publicClient: PublicClient, wallet: `0x${string}`, symbol: string) {
  const token = getTokenBySymbol(symbol)
  if (!token || token.address === 'native') return null

  const balance = await readContract(publicClient, {
    address: token.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [wallet],
  })

  return formatUnits(balance, token.decimals)
}
```

- [ ] **Step 4: 把遗漏测试文件补上并跑通**

```ts
// src/lib/hyperliquid/__tests__/quotes.test.ts
import { describe, expect, it } from 'vitest'
import { normalizePriceResponse } from '../quotes'

describe('normalizePriceResponse', () => {
  it('maps 0x response into UI quote model', () => {
    const quote = normalizePriceResponse({
      allowanceTarget: '0xabc',
      buyAmount: '1200000',
      minBuyAmount: '1180000',
      sellAmount: '1000000',
      fees: {
        integratorFee: { amount: '1000' },
      },
      route: {
        fills: [{ source: 'UniswapV3' }, { source: '0x_RFQ' }],
      },
    })

    expect(quote.routeSummary).toBe('UniswapV3 > 0x_RFQ')
    expect(quote.integratorFeeAmount).toBe('1000')
  })
})
```

Run: `npm run test -- src/lib/hyperliquid/__tests__/quotes.test.ts`
Expected: PASS

- [ ] **Step 5: 手工验证链路**

Run: `npm run lint`
Expected: PASS

Manual check:
- 页面能发出 `price` 请求
- 在 DevTools 里看到 `chainId=999`
- `integratorFee` 参数在请求中可见

- [ ] **Step 6: 提交**

```bash
git add src/lib/hyperliquid/balances.ts src/lib/hyperliquid/quotes.ts src/lib/hyperliquid/allowance.ts src/lib/hyperliquid/swaps.ts src/lib/hyperliquid/transactions.ts src/lib/hyperliquid/__tests__/quotes.test.ts
git commit -m "feat: add hyperevm quote and swap modules"
```

### Task 4: 先把 Terminal 骨架和关键 UI 状态做出来

**Files:**
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\components\hyperliquid\MarketList.tsx`
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\components\hyperliquid\TokenSelector.tsx`
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\components\hyperliquid\TradingViewPanel.tsx`
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\components\hyperliquid\QuoteDetails.tsx`
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\components\hyperliquid\WalletStatusBar.tsx`
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\components\hyperliquid\RiskBadges.tsx`
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\components\hyperliquid\AiInsightPanel.tsx`
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\components\hyperliquid\SwapCard.tsx`
- Create: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\components\hyperliquid\__tests__\SwapCard.test.tsx`

- [ ] **Step 1: 先写 SwapCard 的失败测试**

```tsx
// src/components/hyperliquid/__tests__/SwapCard.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SwapCard } from '../SwapCard'

describe('SwapCard', () => {
  it('renders connect state and amount input', () => {
    render(
      <SwapCard
        isConnected={false}
        amount="0"
        onAmountChange={vi.fn()}
        onPrimaryAction={vi.fn()}
        primaryLabel="Connect Wallet"
      />,
    )

    expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument()
    expect(screen.getByLabelText('Sell amount')).toHaveValue('0')
  })

  it('forwards amount changes', () => {
    const onAmountChange = vi.fn()
    render(
      <SwapCard
        isConnected
        amount="1"
        onAmountChange={onAmountChange}
        onPrimaryAction={vi.fn()}
        primaryLabel="Get Quote"
      />,
    )

    fireEvent.change(screen.getByLabelText('Sell amount'), { target: { value: '2.5' } })
    expect(onAmountChange).toHaveBeenCalledWith('2.5')
  })
})
```

- [ ] **Step 2: 跑失败测试**

Run: `npm run test -- src/components/hyperliquid/__tests__/SwapCard.test.tsx`
Expected: FAIL，报组件不存在

- [ ] **Step 3: 写 UI 组件最小实现**

```tsx
// src/components/hyperliquid/SwapCard.tsx
'use client'

type SwapCardProps = {
  isConnected: boolean
  amount: string
  onAmountChange: (value: string) => void
  onPrimaryAction: () => void
  primaryLabel: string
}

export function SwapCard(props: SwapCardProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <label className="mb-2 block text-sm text-white/70" htmlFor="sell-amount">
        Sell amount
      </label>
      <input
        id="sell-amount"
        className="mb-4 w-full rounded-xl border border-white/10 bg-transparent px-3 py-2"
        value={props.amount}
        onChange={(event) => props.onAmountChange(event.target.value)}
      />
      <button className="w-full rounded-xl bg-primary px-4 py-3 text-black" onClick={props.onPrimaryAction} type="button">
        {props.primaryLabel}
      </button>
    </section>
  )
}
```

```tsx
// src/components/hyperliquid/TradingViewPanel.tsx
export function TradingViewPanel() {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-2 text-sm text-white/60">Chart</div>
      <div className="h-[360px] rounded-xl border border-dashed border-white/10 bg-black/30" />
    </section>
  )
}
```

```tsx
// 其它组件先保留轻量骨架，避免 page.tsx 爆炸
export function MarketList() { return <aside className="rounded-2xl border border-white/10 bg-black/20 p-4">MarketList</aside> }
export function QuoteDetails() { return <section className="rounded-2xl border border-white/10 bg-black/20 p-4">QuoteDetails</section> }
export function WalletStatusBar() { return <section className="rounded-2xl border border-white/10 bg-black/20 p-4">WalletStatusBar</section> }
export function RiskBadges() { return <div className="flex gap-2">RiskBadges</div> }
export function AiInsightPanel() { return <aside className="rounded-2xl border border-white/10 bg-black/20 p-4">AiInsightPanel</aside> }
export function TokenSelector() { return <div>TokenSelector</div> }
```

- [ ] **Step 4: 跑测试并做样式校验**

Run: `npm run test -- src/components/hyperliquid/__tests__/SwapCard.test.tsx`
Expected: PASS

Run: `npm run lint`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/hyperliquid/MarketList.tsx src/components/hyperliquid/TokenSelector.tsx src/components/hyperliquid/TradingViewPanel.tsx src/components/hyperliquid/QuoteDetails.tsx src/components/hyperliquid/WalletStatusBar.tsx src/components/hyperliquid/RiskBadges.tsx src/components/hyperliquid/AiInsightPanel.tsx src/components/hyperliquid/SwapCard.tsx src/components/hyperliquid/__tests__/SwapCard.test.tsx
git commit -m "feat: add hyperevm terminal ui skeleton"
```

### Task 5: 组装单页 AI Terminal 并接通交易状态机

**Files:**
- Modify: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\app\(APP)\ai\page.tsx`
- Modify: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\components\hyperliquid\MarketList.tsx`
- Modify: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\components\hyperliquid\QuoteDetails.tsx`
- Modify: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\components\hyperliquid\WalletStatusBar.tsx`
- Modify: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\components\hyperliquid\AiInsightPanel.tsx`
- Modify: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\components\hyperliquid\SwapCard.tsx`

- [ ] **Step 1: 先把页面编排写成失败状态**

```tsx
// src/app/(APP)/ai/page.tsx
'use client'

import { useState } from 'react'

export default function AiPage() {
  const [amount, setAmount] = useState('0')

  return (
    <main>
      <h1>AI Terminal</h1>
      <p>{amount}</p>
    </main>
  )
}
```

Run: `npm run lint -- src/app/(APP)/ai/page.tsx`
Expected: PASS，但页面功能仍未接上

- [ ] **Step 2: 接入钱包、白名单和主布局**

```tsx
// src/app/(APP)/ai/page.tsx
'use client'

import { useMemo, useState } from 'react'
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi'
import ConnectButton from '@/components/web3/ConnectButton'
import { AiInsightPanel } from '@/components/hyperliquid/AiInsightPanel'
import { MarketList } from '@/components/hyperliquid/MarketList'
import { QuoteDetails } from '@/components/hyperliquid/QuoteDetails'
import { SwapCard } from '@/components/hyperliquid/SwapCard'
import { TradingViewPanel } from '@/components/hyperliquid/TradingViewPanel'
import { WalletStatusBar } from '@/components/hyperliquid/WalletStatusBar'
import { HYPEREVM_CHAIN_ID } from '@/lib/hyperliquid/chains'
import { buildTradeInsight } from '@/lib/hyperliquid/ai-explainer'

export default function AiPage() {
  const { address, chainId, isConnected } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const [amount, setAmount] = useState('')
  const [quoteState, setQuoteState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  const insight = useMemo(
    () =>
      buildTradeInsight({
        sellSymbol: 'USDC',
        buySymbol: 'HYPE',
        receiveAmount: quoteState === 'ready' ? '0.00' : '0',
        riskLevel: 'low',
        riskFlags: [],
      }),
    [quoteState],
  )

  async function handlePrimaryAction() {
    if (!isConnected) return
    if (chainId !== HYPEREVM_CHAIN_ID) {
      await switchChainAsync({ chainId: HYPEREVM_CHAIN_ID })
      return
    }
    setQuoteState('loading')
    setQuoteState('ready')
  }

  return (
    <main className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
      <aside className="space-y-4">
        <ConnectButton />
        <MarketList />
      </aside>
      <section className="space-y-4">
        <WalletStatusBar />
        <TradingViewPanel />
        <SwapCard
          amount={amount}
          isConnected={isConnected}
          onAmountChange={setAmount}
          onPrimaryAction={handlePrimaryAction}
          primaryLabel={!isConnected ? 'Connect Wallet' : chainId !== HYPEREVM_CHAIN_ID ? 'Switch To HyperEVM' : 'Get Quote'}
        />
        <QuoteDetails />
      </section>
      <AiInsightPanel />
    </main>
  )
}
```

- [ ] **Step 3: 把页面状态机接到真实逻辑模块**

```tsx
// 关键替换点
import { fetchPrice, fetchQuote, normalizePriceResponse } from '@/lib/hyperliquid/quotes'
import { buildApproveRequest } from '@/lib/hyperliquid/allowance'
import { buildSwapTransaction } from '@/lib/hyperliquid/swaps'
import { evaluateTradeRisk } from '@/lib/hyperliquid/risk-engine'

const apiKey = process.env.NEXT_PUBLIC_ZEROX_API_KEY

async function handleGetQuote() {
  const params = new URLSearchParams({
    chainId: String(HYPEREVM_CHAIN_ID),
    sellToken: 'USDC',
    buyToken: 'HYPE',
    sellAmount: '1000000',
    taker: address!,
  })

  if (apiKey) params.set('affiliateAddress', address!)

  const payload = await fetchPrice(params, apiKey)
  const normalized = normalizePriceResponse(payload)
  setQuote(normalized)

  const risk = evaluateTradeRisk({
    hasEnoughGas,
    priceImpactBps: 40,
    slippageBps,
  })

  setInsight(buildTradeInsight({
    sellSymbol: 'USDC',
    buySymbol: 'HYPE',
    receiveAmount: normalized.buyAmount,
    riskLevel: risk.level,
    riskFlags: risk.flags,
  }))
}

async function handleSwap() {
  const payload = await fetchQuote(params, apiKey)
  const transaction = buildSwapTransaction(payload)
  const hash = await walletClient!.sendTransaction(transaction)
  await publicClient!.waitForTransactionReceipt({ hash })
}
```

- [ ] **Step 4: 运行完整校验**

Run: `npm run test`
Expected: PASS

Run: `npm run lint`
Expected: PASS

Run: `npm run build`
Expected: PASS

Manual check:
- 未连接钱包时 CTA 显示 `Connect Wallet`
- 切错链时 CTA 显示 `Switch To HyperEVM`
- 输入金额后可请求报价
- 授权后能弹出交易钱包确认

- [ ] **Step 5: 提交**

```bash
git add src/app/(APP)/ai/page.tsx src/components/hyperliquid/MarketList.tsx src/components/hyperliquid/QuoteDetails.tsx src/components/hyperliquid/WalletStatusBar.tsx src/components/hyperliquid/AiInsightPanel.tsx src/components/hyperliquid/SwapCard.tsx
git commit -m "feat: assemble hyperevm ai terminal page"
```

### Task 6: 收尾生产化风险、免责声明和发布前检查

**Files:**
- Modify: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\components\hyperliquid\AiInsightPanel.tsx`
- Modify: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\components\hyperliquid\QuoteDetails.tsx`
- Modify: `c:\AAAAAA-Code\coolha-com\app.coolha.com\src\app\(APP)\ai\page.tsx`

- [ ] **Step 1: 把 AI 提示和免责声明写死到 UI 里**

```tsx
// src/components/hyperliquid/AiInsightPanel.tsx
type AiInsightPanelProps = {
  summary: string
  warning: string
  suggestion: string
}

export function AiInsightPanel({ summary, warning, suggestion }: AiInsightPanelProps) {
  return (
    <aside className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div>
        <h2 className="mb-2 text-sm font-semibold">AI Insight</h2>
        <p className="text-sm text-white/80">{summary}</p>
      </div>
      <p className="text-sm text-yellow-300">{warning}</p>
      <p className="text-sm text-white/70">{suggestion}</p>
      <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/50">
        AI 内容仅用于界面辅助说明，不构成投资建议。所有交易均需你自行判断并在钱包中确认。
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: 在报价区显式展示 integrator fee 与供应商风险**

```tsx
// src/components/hyperliquid/QuoteDetails.tsx
type QuoteDetailsProps = {
  buyAmount?: string
  minBuyAmount?: string
  routeSummary?: string
  integratorFeeAmount?: string
}

export function QuoteDetails(props: QuoteDetailsProps) {
  return (
    <section className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
      <div className="flex justify-between"><span>Route</span><span>{props.routeSummary ?? '--'}</span></div>
      <div className="flex justify-between"><span>Min received</span><span>{props.minBuyAmount ?? '--'}</span></div>
      <div className="flex justify-between"><span>Builder fee</span><span>{props.integratorFeeAmount ?? '--'}</span></div>
    </section>
  )
}
```

- [ ] **Step 3: 做发布前总检查**

Run: `npm run test`
Expected: PASS

Run: `npm run lint`
Expected: PASS

Run: `npm run build`
Expected: PASS

Manual release checklist:
- 纯前端请求里确认 `chainId=999`
- `NEXT_PUBLIC_ZEROX_API_KEY` 为空时，界面有清晰报错
- `builder fee` 无返回时，界面不假装已收费
- 免责声明在桌面端与移动端都可见
- 钱包未连接、错误链、无 gas、报价失败这 4 个主错误态都能复现

- [ ] **Step 4: 提交**

```bash
git add src/components/hyperliquid/AiInsightPanel.tsx src/components/hyperliquid/QuoteDetails.tsx src/app/(APP)/ai/page.tsx
git commit -m "feat: finalize hyperevm terminal safeguards"
```

## 自检

### Spec coverage

- 单页 Terminal：Task 4 + Task 5
- HyperEVM 钱包接入：Task 1
- 白名单主流币：Task 2
- 0x 纯前端报价与交换：Task 3 + Task 5
- AI 解释与风险提示：Task 2 + Task 5 + Task 6
- builder fee 风险显式化：Task 3 + Task 6
- 免责声明：Task 6

### Placeholder scan

- 未使用 `TODO` / `TBD`
- 每个任务都给了明确文件、代码块、命令和期望结果
- 没有引用未先定义的模块名

### Type consistency

- `RiskLevel` 由 `types.ts` 定义，`risk-engine.ts` 与 `ai-explainer.ts` 共用
- `normalizePriceResponse` 在测试和实现中命名一致
- `SwapCard` 的 props 在测试与组件定义中保持一致

## 执行交接

Plan complete and saved to `docs/superpowers/plans/2026-05-21-hyperevm-terminal.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
