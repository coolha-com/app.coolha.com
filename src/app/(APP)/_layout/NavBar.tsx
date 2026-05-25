'use client'
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import ButtonMenu from "./ButtonMenu";

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

function Profile() {
    return (
        <>
            <div className="flex-1">
            </div>
            <div className="flex-none"> </div>
            <div className="flex-1 flex justify-end items-center gap-2">
                <ButtonMenu />
                <ConnectButton />
            </div>
        </>
    )
}
