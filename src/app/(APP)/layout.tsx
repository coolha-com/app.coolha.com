'use client'

import NavBar from './_layout/NavBar';
import NavFooter from './_layout/NavFooter';
import Sidebar from './_layout/Sidebar';
import { usePathname } from 'next/navigation';


export default function layout({ children }) {
  const pathname = usePathname();
  const activeHrefs = ['/dashboard',  '/wallet', '/profile']

  const isActive = activeHrefs.some((activeHref) => pathname.startsWith(activeHref));
  return (
    <div className='bg-base-200  min-h-dvh flex'>

      <div className="hidden md:block md:w-16 xl:w-64">
        <Sidebar />
      </div>

      <div className="flex-1">
        <NavBar />
        {children}
        <NavFooter />
      </div>

      <div className={`hidden lg:block ${isActive ? 'lg:w-16 xl:w-64' : ''}`} />

    </div>
  )
}
