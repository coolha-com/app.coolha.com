"use client"

import dynamic from "next/dynamic";
import { RiMenuLine } from "react-icons/ri";
import ButtonMenu from "./ButtonMenu";
import { setSidebarDrawer } from "./sidebar-store";

const ConnectButton = dynamic(() => import("@/components/web3/ConnectButton"), { ssr: false });

/**
 * 移动端/平板顶栏（<lg）：汉堡唤出侧边栏抽屉 + 更多菜单与钱包。
 * ≥lg 时侧边栏常驻（顶部已有 Logo 与导航），顶栏隐藏。
 */
export default function NavBar() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <button
          type="button"
          onClick={() => setSidebarDrawer(true)}
          title="打开导航"
          aria-label="打开导航"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-accent"
        >
          <RiMenuLine className="size-6" />
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <ButtonMenu />
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}