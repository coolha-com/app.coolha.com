import type { Metadata } from 'next'
import { RwaMarketplace } from '@/components/rwa/RwaMarketplace'
import { RWA_ASSETS, RWA_PROTOCOLS } from '@/lib/rwa/mockData'

export const metadata: Metadata = {
  title: 'RWA Marketplace',
  description: 'Discover mock RWA assets, rankings, filters, and protocol-ready routes.',
}

export default function DiscoverPage() {
  return <RwaMarketplace assets={RWA_ASSETS} protocols={Object.values(RWA_PROTOCOLS)} />
}
