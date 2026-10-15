"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
    RiChatSmileAiLine,
    RiDashboardHorizontalLine,
    RiExchangeDollarLine,
    RiMenuUnfoldLine,
    RiRobot2Line,
    RiSidebarFoldLine,
    RiWallet3Line,
} from "react-icons/ri";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import ButtonMenu from "./ButtonMenu";
import { setSidebarDrawer, toggleSidebarMode, useSidebar } from "./sidebar-store";

const ConnectButton = dynamic(() => import("@/components/web3/ConnectButton"), { ssr: false });

/**
 * 侧边栏：
 * - ≥lg 常驻，两种宽度：expanded 16rem（图标+文字）/ collapsed 4.5rem（仅图标），带宽度过渡
 * - <lg 抽屉式（顶部汉堡按钮唤出，点遮罩关闭）
 * - 文字标签是否显示由模式决定，与视口宽度无关
 */
export default function Sidebar() {
    const { mode, drawerOpen } = useSidebar()
    const expanded = mode === "expanded"
    // 抽屉展开时始终显示文字（它是覆盖层，需要完整可读性）
    const showLabels = expanded || drawerOpen

    return (
        <>
            {/* 移动端遮罩 */}
            <button
                type="button"
                aria-label="关闭导航"
                tabIndex={drawerOpen ? 0 : -1}
                onClick={() => setSidebarDrawer(false)}
                className={cn(
                    "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 lg:hidden",
                    drawerOpen ? "opacity-100" : "pointer-events-none opacity-0",
                )}
            />

            <aside
                className={cn(
                    "z-50 flex h-svh w-72 shrink-0 flex-col border-r bg-sidebar px-2 py-3",
                    "transition-[width,transform] duration-200 ease-out",
                    "fixed inset-y-0 left-0 lg:sticky lg:top-0 lg:h-svh lg:translate-x-0",
                    drawerOpen ? "translate-x-0" : "-translate-x-full",
                    expanded ? "lg:w-64 lg:px-3" : "lg:w-[4.5rem]",
                )}
            >
                <Logo showLabels={showLabels} />

                <div className={cn("mt-4 flex w-full flex-1 flex-col overflow-y-auto", showLabels ? "items-stretch" : "items-center")}>
                    <NavbarLink showLabels={showLabels} />
                </div>

                <div className={cn("mt-auto flex w-full flex-col gap-3 pb-2", showLabels ? "items-stretch" : "items-center")}>
                    <SidebarControls expanded={expanded} showLabels={showLabels} />
                    <div className={cn("flex w-full", showLabels ? "justify-start" : "justify-center")}>
                        <ButtonMenu showLabels={showLabels} />
                    </div>
                    <div className={cn("flex w-full", showLabels ? "justify-start" : "justify-center")}>
                        <ConnectButton sidebar showLabels={showLabels} />
                    </div>
                </div>
            </aside>
        </>
    )
}

function Logo({ showLabels }: { showLabels: boolean }) {
    return (
        <div className={cn("flex w-full", showLabels ? "justify-start" : "justify-center")}>
            <motion.div className="w-auto" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                    href={`/dashboard`}
                    className={cn(
                        "flex size-11 items-center justify-center rounded-full hover:bg-accent",
                        showLabels && "h-11 w-full justify-start gap-3 px-4",
                    )}
                >
                    <Avatar className="size-8 shrink-0 border">
                        <AvatarImage src="/favicon.ico" alt="Coolha" />
                        <AvatarFallback>CH</AvatarFallback>
                    </Avatar>
                    {showLabels ? <div className="text-lg font-bold tracking-tight">Coolha</div> : null}
                </Link>
            </motion.div>
        </div>
    )
}

function NavbarLink({ showLabels }: { showLabels: boolean }) {
    const pathname = usePathname();
    const t = useTranslations('sidebar')
    const links = [
        {
            title: t('dashboard'),
            href: '/dashboard',
            icon: RiDashboardHorizontalLine,
            startsWith: ['/dashboard']
        },
        {
            title: t('chat'),
            href: '/chat',
            icon: RiChatSmileAiLine,
            startsWith: ['/chat', '/ai']
        },
        {
            title: t('agent'),
            href: '/agent',
            icon: RiRobot2Line,
            startsWith: ['/agent']
        },
        {
            title: t('rwa'),
            href: '/rwa',
            icon: RiExchangeDollarLine,
            startsWith: ['/rwa']
        },
        {
            title: t('wallet'),
            href: '/wallet',
            icon: RiWallet3Line,
            startsWith: ['/wallet']
        },
    ];

    return (
        <ul className={cn("flex w-full flex-col gap-1", showLabels ? "items-stretch" : "items-center")}>
            {links.map(link => {
                const isActive = link.startsWith.some(prefix => pathname?.startsWith(prefix));
                return (
                    <li key={link.href} className={cn("w-auto", showLabels && "w-full")}>
                        <Button
                            asChild
                            variant={isActive ? "secondary" : "ghost"}
                            className={cn(
                                "size-11 justify-center rounded-full p-0",
                                showLabels && "h-11 w-full justify-start px-4",
                                isActive ? "font-medium" : "text-muted-foreground",
                            )}
                        >
                            <Link
                                href={link.href}
                                title={showLabels ? undefined : link.title}
                                className={cn(
                                    "flex size-11 items-center justify-center",
                                    showLabels && "size-auto w-full justify-start gap-3",
                                )}
                            >
                                <link.icon className={cn("size-6", isActive && "text-foreground")} />
                                {showLabels ? <span className="text-sm">{link.title}</span> : null}
                            </Link>
                        </Button>
                    </li>
                )
            })}
        </ul>
    )
}

/** 底部控制区：收起 / 展开切换（位于「更多」按钮上方，仅桌面常驻态） */
function SidebarControls({ expanded, showLabels }: { expanded: boolean; showLabels: boolean }) {
    return (
        <div
            className={cn(
                "hidden w-full items-center border-b border-border/60 pb-3 lg:flex",
                showLabels ? "justify-start" : "justify-center",
            )}
        >
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 rounded-full"
                onClick={toggleSidebarMode}
                title={expanded ? "收起为图标栏" : "展开侧边栏"}
                aria-label={expanded ? "收起为图标栏" : "展开侧边栏"}
            >
                {expanded ? <RiSidebarFoldLine className="size-5" /> : <RiMenuUnfoldLine className="size-5" />}
            </Button>
        </div>
    )
}