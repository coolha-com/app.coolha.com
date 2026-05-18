'use client';

import { RiTranslate } from 'react-icons/ri';
import { useLocale } from 'next-intl';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const locales = [
    { code: 'en', label: 'English' },
    { code: 'zh-Hans', label: '简体中文' },
    { code: 'zh-Hant', label: '繁體中文' }
];

export default function LanguageSwitcher() {
    const locale = useLocale();

    const handleSelect = (nextLocale: string) => {
        document.cookie = `NEXT_LOCALE=${nextLocale}; path=/;`;
        window.location.reload();
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full">
                    <RiTranslate size={20} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {locales.map(l => (
                    <DropdownMenuItem
                        key={l.code}
                        onClick={() => handleSelect(l.code)}
                        className={l.code === locale ? 'text-primary' : ''}
                    >
                        {l.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
