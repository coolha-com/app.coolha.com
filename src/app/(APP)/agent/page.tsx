'use client'

import { useTranslations } from 'next-intl'

export default function AgentPage() {
  const t = useTranslations()
  return (
    <div className=''>
     创造基于ERC8004的Agent，让其拥有链上身份在公开市场上被发现，可验证的信任与历史声誉记录，基于x402标准可编程结算的支付收款能力。

     未来Agent将替你交易和操控万物，RWA代币化连接物理世界
    </div>
  )
}
