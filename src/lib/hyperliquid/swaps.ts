import type { Address, WalletClient } from 'viem'

import type { SwapTransactionRequest } from './types'

type ZeroExSwapPayload = {
  transaction?: {
    to?: string
    data?: string
    value?: string
  }
}

export function buildSwapTransaction(quote: ZeroExSwapPayload): SwapTransactionRequest {
  const transaction = quote.transaction

  if (!transaction?.to || !transaction.data) {
    throw new Error('报价返回的交易数据不完整。')
  }

  return {
    to: transaction.to as Address,
    data: transaction.data as `0x${string}`,
    value: BigInt(transaction.value ?? '0'),
  }
}

export async function sendSwapTransaction(walletClient: WalletClient, quote: ZeroExSwapPayload) {
  const account = walletClient.account

  if (!account) {
    throw new Error('钱包客户端尚未连接。')
  }

  const transaction = buildSwapTransaction(quote)

  return walletClient.sendTransaction({
    account,
    chain: walletClient.chain,
    ...transaction,
  })
}
