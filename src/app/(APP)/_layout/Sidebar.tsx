'use client'

import Link from "next/link";
import { usePathname } from "next/navigation";

import { motion } from "framer-motion";
import { useTranslations } from 'next-intl'
import ButtonMenu from "./ButtonMenu";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
    RiCpuLine,
    RiDashboardHorizontalLine,
    RiExchangeDollarLine,
    RiPuzzleFill,
    RiPuzzleLine,
    RiRobot2Fill,
    RiRobot2Line,
    RiWallet3Fill,
    RiWallet3Line,
} from "react-icons/ri";

const ConnectButton = dynamic(() => import("@/components/web3/ConnectButton"), { ssr: false });

export default function Sidebar() {
    return (
        <div className="hidden md:flex md:w-16 xl:w-64 fixed top-0 left-0 z-50 h-svh flex-col items-center border-r bg-sidebar px-2 py-3 xl:items-start xl:px-3">
            <Logo />
            {/* <Search /> */}
            <div className="mt-4 flex w-full flex-1 justify-center overflow-y-auto xl:justify-start">
                <NavbarLink />
            </div>

            <div className="mt-auto flex w-full flex-col items-center gap-4 pb-2 xl:items-start">
                <div className="flex w-full justify-center xl:justify-start">
                    <ButtonMenu />
                </div>
                <div className="flex w-full justify-center xl:justify-start">
                    <ConnectButton sidebar />
                </div>
            </div>
        </div>
    )
}

function Logo() {
    return (
        <div className="flex w-full justify-center xl:justify-start">
            <motion.div className="w-auto xl:w-full" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                    href={`/dashboard`}
                    className="flex size-11 items-center justify-center rounded-full xl:h-11 xl:w-full xl:justify-start xl:gap-3 xl:px-4 hover:bg-accent"
                >
                    <Avatar className="size-8 shrink-0 border">
                        <AvatarImage src="/favicon.ico" alt="Coolha" />
                        <AvatarFallback>CH</AvatarFallback>
                    </Avatar>
                    <div className="hidden text-lg font-bold tracking-tight xl:block">
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
            iconActive: RiDashboardHorizontalLine,
            iconInactive: RiDashboardHorizontalLine,
            startsWith: '/dashboard'
        },
        {
            title: t('ai'),
            href: '/ai',
            iconActive: RiCpuLine,
            iconInactive: RiCpuLine,
            startsWith: '/ai'
        },
        {
            title: t('agent'),
            href: '/agent',
            iconActive: RiRobot2Line,
            iconInactive: RiRobot2Fill,
            startsWith: '/agent'
        },
        {
            title: t('discover'),
            href: '/discover',
            iconActive: RiPuzzleLine,
            iconInactive: RiPuzzleFill,
            startsWith: '/discover'
        },
        {
            title: t('rwa'),
            href: '/rwa',
            iconActive: RiExchangeDollarLine,
            iconInactive: RiExchangeDollarLine,
            startsWith: '/rwa'
        },
        {
            title: t('wallet'),
            href: '/wallet',
            iconActive: RiWallet3Line,
            iconInactive: RiWallet3Fill,
            startsWith: '/wallet'
        },

    ];
    return (
        <ul className="flex w-full flex-col items-center gap-1 ">
            {links.map(link => {
                const isActive = pathname && pathname.startsWith(link.startsWith);
                return (
                    <li key={link.href} className="w-auto xl:w-full">
                        <Button
                            asChild
                            variant={isActive ? "secondary" : "ghost"}
                            className={`size-11 justify-center rounded-full p-0 xl:h-11 xl:w-full xl:justify-start xl:px-4 ${isActive ? "font-medium" : "text-muted-foreground"}`}
                        >
                            <Link href={link.href} className="flex size-11 items-center justify-center xl:size-auto xl:w-full xl:justify-start xl:gap-3">
                                <link.iconActive className={`size-6 ${isActive ? "text-foreground" : ""}`} />
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
