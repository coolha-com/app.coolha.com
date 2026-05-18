'use client'
import { useTheme } from "next-themes"
import { RiMoonLine, RiSunLine } from "react-icons/ri";
import { Button } from "@/components/ui/button";

export default function ThemeSwap() {
    const { resolvedTheme, setTheme } = useTheme();
    const isDark = resolvedTheme === 'dark'

    return (
        <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
        >
            {isDark ? (<RiSunLine size={20} />) : (<RiMoonLine size={20} />)}
        </Button>
    )
}
