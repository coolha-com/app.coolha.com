'use client'

import Link from "next/link";
import { LuGrip } from "react-icons/lu";
import { useTranslations } from 'next-intl'
import ThemeSwap from "@/components/ThemeSwap";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { RiSettingsLine } from "react-icons/ri";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ButtonMenu({ showLabels = false }: { showLabels?: boolean } = {}) {
    const t = useTranslations('menu')

    return (
        <>
            {/* 菜单按钮 */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild id="sidebar-more-menu-trigger">
                    <button className={cn("inline-flex size-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full p-0 text-sm font-medium transition-all outline-none disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:hover:bg-accent/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", showLabels && "h-11 w-full justify-start px-4")}>
                        <LuGrip className="size-6 md:size-6 " />
                        <span className={cn("text-lg", showLabels ? "flex" : "hidden")}>{t('more')}</span>
                    </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent className="p-3 bg-background shadow-lg border min-w-64" style={{ borderRadius: '1.5rem' }} align="end" sideOffset={8}>

                    {/* 主要功能区 */}
                    <div className="mb-3">
                        <div className="flex items-center mb-3 gap-2 px-2">
                            <ThemeSwap />
                            <LanguageSwitcher />

                            <Button asChild variant="outline" size="icon" className="rounded-full">
                                <Link href="/settings">
                                    <RiSettingsLine size={20} />
                                </Link>
                            </Button>
                        </div>
                    </div>



                    {/* 分隔线 */}
                    <DropdownMenuSeparator />

                    {/* 信息链接区 */}
                    <div className="px-2 py-2 space-y-3">



                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            <Link href={`https://coolha.com`} target='_blank' className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors">
                                {t('about')}
                            </Link>
                            {/*                             <Link href={`https://docs.coolha.com`} className="text-muted-foreground hover:text-foreground hover:underline transition-colors" target='_blank'>
                                {t('docs')}
                            </Link> */}
                            <Link href={`https://coolha.com/privacy`} className="text-muted-foreground hover:text-foreground hover:underline transition-colors" target='_blank'>
                                {t('privacy')}
                            </Link>
                            <Link href={`https://coolha.com/terms`} className="text-muted-foreground hover:text-foreground hover:underline transition-colors" target='_blank'>
                                {t('terms')}
                            </Link>
                        </div>


                        {/* 版权信息 */}
                        <div className="text-xs text-muted-foreground/50 pt-2 border-t mt-2">
                            <span>©2026 app.coolha.com </span>
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                                {`v${process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.1-alpha"}`}
                            </span>
                        </div>


                    </div>

                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}
