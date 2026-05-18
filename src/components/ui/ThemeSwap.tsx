'use client'
import { useTheme } from "next-themes"
import { useEffect, useState } from "react";
import { RiMoonLine, RiSunLine, RiComputerLine } from "react-icons/ri";
import { Button } from "@/components/ui/button";

export default function ThemeSwap() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <Button variant="outline" size="icon" className="rounded-full">
                <RiSunLine size={20} />
            </Button>
        );
    }

    return (
        <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
            {theme === 'dark' ? (<RiSunLine size={20} />) : (<RiMoonLine size={20} />)}
        </Button>
    )
}
