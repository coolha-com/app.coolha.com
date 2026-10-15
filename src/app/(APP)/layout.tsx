"use client"

import type { ReactNode } from "react";
import NavBar from "./_layout/NavBar";
import Sidebar from "./_layout/Sidebar";
// NavFooter（移动端底部标签栏）暂时停用，文件保留，需要时恢复此行即可：
// import NavFooter from "./_layout/NavFooter";

/**
 * 应用外壳：侧边栏 + 内容区为同级 flex 容器。
 * - 内容区 min-w-0：避免长内容（表格、代码块）撑破并挤压侧边栏
 * - 侧边栏宽度由用户控制（expanded/collapsed），不随视口挤压内容
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-base-200">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <NavBar />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}