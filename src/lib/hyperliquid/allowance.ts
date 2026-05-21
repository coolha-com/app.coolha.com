import { erc20Abi, maxUint256, type Address, type PublicClient } from 'viem'

import { getTokenBySymbol } from './tokens'
import type { TokenSymbol } from './types'

export function needsApproval(currentAllowance: bigint, requiredAmount: bigint): boolean {
  return currentAllowance < requiredAmount
}

export function buildApproveRequest(tokenAddress: Address, spender: Address, amount: bigint = maxUint256) {
  return {
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, amount],
  } as const
}

export async function readTokenAllowance(
  publicClient: PublicClient,
  wallet: Address,
  spender: Address,
  symbol: TokenSymbol | string,
): Promise<bigint | null> {
  const token = getTokenBySymbol(symbol)

  if (!token) {
    return null
  }

  if (token.address === 'native' || !token.isAddressVerified) {
    return null
  }

  const allowance = await publicClient.readContract({
    address: token.address,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [wallet, spender],
  })

  return allowance
}

export async function approvalState(
  publicClient: PublicClient,
  wallet: Address,
  spender: Address,
  symbol: TokenSymbol | string,
  requiredAmount: bigint,
) {
  const allowance = await readTokenAllowance(publicClient, wallet, spender, symbol)

  if (allowance === null) {
    return {
      allowance,
      approvalRequired: false,
    }
  }

  return {
    allowance,
    approvalRequired: needsApproval(allowance, requiredAmount),
  }
}
