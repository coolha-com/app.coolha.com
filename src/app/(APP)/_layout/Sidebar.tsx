'use client'

import Link from "next/link";
import { usePathname } from "next/navigation";

import { motion } from "framer-motion";
import { useTranslations } from 'next-intl'
import ButtonMenu from "./ButtonMenu";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { RiSearchFill, RiSearchLine, RiHomeFill, RiHomeLine, RiCompassFill, RiCompassLine, RiChat1Fill, RiChat1Line, RiUserFill, RiUserLine, RiPuzzleLine, RiSettingsLine, RiWallet3Fill, RiWallet3Line, RiSettingsFill, RiRobot2Fill, RiRobot2Line } from "react-icons/ri";
import { IoStatsChartOutline, IoWalletOutline, } from "react-icons/io5";
import { FaRobot } from "react-icons/fa6";

const ConnectButton = dynamic(() => import("@/components/web3/ConnectButton"), { ssr: false });

export default function Sidebar() {
    return (
        <div className="hidden md:flex md:w-16 xl:w-64 flex-col fixed top-0 left-0 z-50 border-r bg-sidebar h-svh p-3 gap-4">
            <Logo />
            {/* <Search /> */}
            <div className="flex-1 overflow-y-auto">
                <NavbarLink />
            </div>

            <div className="mt-auto flex flex-col gap-4">
                <div className="px-2">
                    <ButtonMenu />
                </div>
                <div className="px-2 pb-2">
                    <ConnectButton />
                </div>
            </div>
        </div>
    )
}

function Logo() {
    return (
        <div className="h-12 flex items-center px-3 mb-2">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link href={`/dashboard`} className="flex flex-row items-center gap-3">
                    <Avatar className="w-9 h-9 border">
                        <AvatarImage src="/favicon.ico" alt="Coolha" />
                        <AvatarFallback>CH</AvatarFallback>
                    </Avatar>
                    <div className="text-xl font-bold xl:block hidden tracking-tight">
                        Coolha
                    </div>
                </Link>
            </motion.div>
        </div>
    )
}



function NavbarLink() {
    const pathname = usePathname();
    const t = useTranslations('sidebar')
    const links = [
        {
            title: t('dashboard'),
            href: '/dashboard',
            iconActive: RiHomeLine,
            iconInactive: RiHomeLine,
            startsWith: '/dashboard'
        },
        {
            title: t('find'),
            href: '/find',
            iconActive: RiCompassLine,
            iconInactive: RiCompassLine,
            startsWith: '/find'
        },
        {
            title: t('ai'),
            href: '/ai',
            iconActive: RiRobot2Line,
            iconInactive: RiRobot2Fill,
            startsWith: '/ai'
        },
        {
            title: t('wallet'),
            href: '/wallet',
            iconActive: RiWallet3Line,
            iconInactive: RiWallet3Fill,
            startsWith: '/wallet'
        },
        {
            title: t('profile'),
            href: '/profile',
            iconActive: RiUserLine,
            iconInactive: RiUserFill,
            startsWith: '/profile'
        },
        {
            title: t('settings'),
            href: '/settings',
            iconActive: RiSettingsLine,
            iconInactive: RiSettingsFill,
            startsWith: '/settings'
        }
    ];
    return (
        <ul className="flex flex-col gap-1 px-2">
            {links.map(link => {
                const isActive = pathname && pathname.startsWith(link.startsWith);
                return (
                    <li key={link.href}>
                        <Button
                            asChild
                            variant={isActive ? "secondary" : "ghost"}
                            className={`w-full justify-center xl:justify-start h-10 px-2 xl:px-3 ${isActive ? "font-medium" : "text-muted-foreground"}`}
                        >
                            <Link href={link.href} className="flex items-center gap-3">
                                <link.iconActive className={`w-5 h-5 ${isActive ? "text-foreground" : ""}`} />
                                <span className="hidden xl:flex text-sm">
                                    {link.title}
                                </span>
                            </Link>
                        </Button>
                    </li>
                )
            })}
        </ul>
    )
}
