import type { PublicClient } from 'viem'

export type PendingTransactionState = 'idle' | 'pending' | 'confirmed' | 'failed'

export type PendingTransaction = {
  hash: `0x${string}`
  status: PendingTransactionState
}

export async function waitForTransaction(
  publicClient: PublicClient,
  hash: `0x${string}`,
  confirmations = 1,
) {
  return publicClient.waitForTransactionReceipt({
    hash,
    confirmations,
  })
}

export async function waitForTransactionAndRefresh(
  publicClient: PublicClient,
  hash: `0x${string}`,
  onConfirmed?: () => Promise<void> | void,
) {
  const receipt = await waitForTransaction(publicClient, hash)

  await onConfirmed?.()

  return receipt
}

export function markPendingTransaction(
  hash: `0x${string}`,
  status: PendingTransactionState = 'pending',
): PendingTransaction {
  return {
    hash,
    status,
  }
}
