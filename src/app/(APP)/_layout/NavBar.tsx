'use client'
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { RxPlusCircled, RxMagnifyingGlass } from "react-icons/rx";
import ButtonMenu from "./ButtonMenu";
import { Button } from "@/components/ui/button";
import { RiSettingsLine } from "react-icons/ri";
import Link from "next/link";

const ConnectButton = dynamic(() => import("@/components/web3/ConnectButton"), { ssr: false });

export default function NavBar() {
    const pathname = usePathname();

    return (
        <>
            {[/* "/find", */  "/profile"].includes(pathname) ? (
                <div className="flex md:hidden w-full p-0 bg-background h-12 border-b">
                    <div className="flex items-center justify-between w-full px-2 h-12">
                        {pathname && pathname.startsWith("/profile") && null}
                        {pathname === "/profile" && <Profile />}
                    </div>
                </div>
            ) : null}
        </>
    )
}

function Find() {
    const router = useRouter();
    return (
        <>
            <div className="flex-1"> </div>
            <div className="flex-none font-bold">发现</div>
            <div className="flex-1"> </div>
        </>
    )
}

function Message() {
    return (
        <>
            <div className="flex-1"> </div>
            <div className="flex-none font-bold">消息</div>
            <div className="flex-1 flex justify-end">
                <Button variant="ghost" size="icon">
                    <RxPlusCircled className="w-7 h-7" />
                </Button>
            </div>
        </>
    );
}

function Profile() {
    return (
        <>
            <div className="flex-1">
            </div>
            <div className="flex-none"> </div>
            <div className="flex-1 flex justify-end items-center gap-2">
                <Button variant="ghost" size="icon">
                    <Link href="/settings">
                        <RiSettingsLine className="w-8 h-8" />
                    </Link>
                </Button>
                <ButtonMenu />
                <ConnectButton />
            </div>
        </>
    )
}
