"use client";

import Link from "next/link";
import { usePathname, } from 'next/navigation'

import type { ReactNode } from "react";
import {
    RiApps2Line,
    RiCpuFill,
    RiCpuLine,
    RiDashboardHorizontalLine,
    RiExchangeDollarFill,
    RiExchangeDollarLine,
    RiPuzzleFill,
    RiPuzzleLine,
    RiRobot2Fill,
    RiRobot2Line,
    RiWalletLine,
} from "react-icons/ri";


export default function NavFooter() {
    return (
        <div>
            <div className="md:hidden h-14" aria-hidden />

            <div className="md:hidden fixed inset-x-0 bottom-0 flex h-14 bg-accent backdrop-filter backdrop-saturate-180 backdrop-blur-16 z-50 p-1">
                <NavLink
                    href='/dashboard'
                    activeHrefs={['/dashboard']}
                    icon={<RiDashboardHorizontalLine className="size-7" />}
                    activeIcon={<RiDashboardHorizontalLine className="size-7" />}
                />

                <NavLink
                    href='/market'
                    activeHrefs={['/market']}
                    icon={<RiApps2Line  className="size-7" />}
                    activeIcon={<RiApps2Line  className="size-7" />}
                />

                <NavLink
                    href='/wallet'
                    activeHrefs={['/wallet']}
                    icon={<RiWalletLine className="size-7" />}
                    activeIcon={<RiWalletLine className="size-7" />}
                />


                {/*                 <NavLink
                    href='/ai'
                    activeHrefs={['/ai']}
                    icon={<RiCpuLine className="size-7" />}
                    activeIcon={<RiCpuFill className="size-7" />}
                />

                <NavLink
                    href='/agent'
                    activeHrefs={['/agent']}
                    icon={<RiRobot2Line className="size-7" />}
                    activeIcon={<RiRobot2Fill className="size-7" />}
                />

                <NavLink
                    href='/discover'
                    activeHrefs={['/discover']}
                    icon={<RiPuzzleLine className="size-7" />}
                    activeIcon={<RiPuzzleFill className="size-7" />}
                />

                <NavLink
                    href='/rwa'
                    activeHrefs={['/rwa']}
                    icon={<RiExchangeDollarLine className="size-7" />}
                    activeIcon={<RiExchangeDollarFill className="size-7" />}
                /> */}
            </div>
        </div>
    );
}


function NavLink({ href, activeIcon, icon, activeHrefs, }: {
    href: string
    activeIcon: ReactNode
    icon: ReactNode
    activeHrefs: string[]
}) {
    const pathname = usePathname();
    const isActive = activeHrefs.some((activeHref) => pathname.startsWith(activeHref));


    return (
        <Link
            className={`flex-1 flex flex-col items-center justify-center h-full  transition-shadow text-base-content/60  hover:bg-base-content/20 rounded-full  ${isActive ? '' : ''}`}
            href={href}
            prefetch={true} passHref
        >

            <div className={`flex flex-col items-center justify-center  ${isActive && 'text-base-content'} `}>
                {isActive ? activeIcon : icon}
            </div>

        </Link>
    );
}
