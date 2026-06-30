
import DiscoverLayoutUI from './_layout/layout'

export const metadata = {
  title: { absolute: 'layout', },
}

export default function layout({ children }) {
  return (
    <>
      <DiscoverLayoutUI />
      {children}
    </>
  )
}