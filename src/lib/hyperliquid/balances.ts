import { erc20Abi, formatUnits, type Address, type PublicClient } from 'viem'

import { HYPEREVM_TOKENS, getTokenBySymbol } from './tokens'
import type { TokenSymbol } from './types'

export async function readNativeHypeBalance(publicClient: PublicClient, address: Address): Promise<string> {
  const balance = await publicClient.getBalance({ address })

  return formatUnits(balance, 18)
}

export async function readTokenBalance(
  publicClient: PublicClient,
  wallet: Address,
  symbol: TokenSymbol | string,
): Promise<string | null> {
  const token = getTokenBySymbol(symbol)

  if (!token) {
    throw new Error(`Unknown token symbol: ${symbol}`)
  }

  if (token.address === 'native') {
    return readNativeHypeBalance(publicClient, wallet)
  }

  const balance = await publicClient.readContract({
    address: token.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [wallet],
  })

  return formatUnits(balance, token.decimals)
}

export async function readAllTokenBalances(publicClient: PublicClient, wallet: Address): Promise<Record<TokenSymbol, string>> {
  const balances = await Promise.all(
    HYPEREVM_TOKENS.map(async (token) => {
      const balance = await readTokenBalance(publicClient, wallet, token.symbol)

      return [token.symbol, balance ?? '0'] as const
    }),
  )

  return Object.fromEntries(balances) as Record<TokenSymbol, string>
}
