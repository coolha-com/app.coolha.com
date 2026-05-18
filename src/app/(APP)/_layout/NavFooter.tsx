"use client";

import Link from "next/link";
import { useTranslations } from 'next-intl'
import { usePathname, } from 'next/navigation'

import { RiChat1Fill, RiChat1Line, RiCompassFill, RiCompassLine, RiHomeFill, RiHomeLine, RiRobot2Fill, RiRobot2Line, RiUserFill, RiUserLine, RiWallet3Fill, RiWallet3Line } from "react-icons/ri";


export default function NavFooter() {
    const t = useTranslations('navigation')
    return (
        <div>
            <div className="md:hidden h-14" aria-hidden />

            <div className="md:hidden fixed inset-x-0 bottom-0 flex h-14 bg-accent backdrop-filter backdrop-saturate-180 backdrop-blur-16 z-50 p-1">

                <NavLink
                    href='/dashboard'
                    activeHrefs={['/dashboard']}
                    icon={<RiHomeLine className="size-7" />}
                    activeIcon={<RiHomeFill className="size-7" />}
                />

                <NavLink
                    href='/find'
                    activeHrefs={['/find']}
                    icon={<RiCompassLine className="size-7" />}
                    activeIcon={<RiCompassFill className="size-7" />}
                />

                <NavLink
                    href='/ai'
                    activeHrefs={['/ai']}
                    icon={<RiRobot2Line className="size-7" />}
                    activeIcon={<RiRobot2Fill className="size-7" />}
                />

                <NavLink
                    href='/wallet'
                    activeHrefs={['/wallet',]}
                    icon={<RiWallet3Line className="size-7" />}
                    activeIcon={<RiWallet3Fill className="size-7" />}
                />

                <NavLink
                    href={`/profile`}
                    activeHrefs={[`/profile`]}
                    icon={<RiUserLine className="size-7" />}
                    activeIcon={<RiUserFill className="size-7" />}
                />

                {/*        {address ? () : (
          <NavLink
            href={`/profile/sin`}
            activeHrefs={[`/profile/sin`]}
            icon={<RiUserLine className="Navicon" />}
            activeIcon={<RiUserFill className="Navicon" />}
          />
        )}
 */}
            </div>


        </div>
    );
}


function NavLink({ href, activeIcon, icon, activeHrefs, }) {
    const pathname = usePathname();
    // 检查路径是否以activeHrefs中的任何一个前缀开头
    const isActive = activeHrefs.some((activeHref) => pathname.startsWith(activeHref));


    return (
        <Link
            className={`flex-1 flex flex-col items-center justify-center h-full  transition-shadow text-base-content/60  hover:bg-base-content/20 rounded-full  ${isActive ? '' : ''}`}
            href={href}
            prefetch={true} passHref
        >

            <div className={`flex flex-col items-center justify-center  ${isActive && 'text-base-content'} `}>
                {isActive ? activeIcon : icon}
                {/* <span className="text-xs mt-0.5">{text}</span> */}
            </div>

        </Link>
    );
}
