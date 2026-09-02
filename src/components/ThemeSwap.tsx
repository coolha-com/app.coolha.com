"use client"

import { RiComputerLine, RiMoonLine, RiSunLine } from "react-icons/ri"
import { useTheme } from "next-themes"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function ThemeSwap() {
    const t = useTranslations("theme")
    const { setTheme, theme } = useTheme()
    const currentTheme = theme ?? "system"

    const themes = [
        { key: "light" as const, icon: RiSunLine },
        { key: "dark" as const, icon: RiMoonLine },
        { key: "system" as const, icon: RiComputerLine },
    ]

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full">
                    {themes.map(({ key, icon: Icon }) => (
                        <Icon
                            key={key}
                            size={20}
                            className={` transition-all ${currentTheme === key
                                    ? "scale-100 rotate-0 opacity-100"
                                    : "absolute scale-0 -rotate-90 opacity-0"
                                }`}
                        />
                    ))}
                    <span className="sr-only">{t("toggle_theme")}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {themes.map(({ key, icon: Icon }) => (
                    <DropdownMenuItem
                        key={key}
                        onClick={() => setTheme(key)}
                        className={theme === key ? "text-primary" : undefined}
                    >
                        <Icon />
                        <span>{t(key)}</span>
                        <span className={`ml-auto ${theme === key ? "opacity-100" : "opacity-0"}`}>
                            ✓
                        </span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
