import type { ReactNode } from "react";
import { ComputeNotes } from "@/components/compute/ComputeNotes";

/**
 * 算力相关子页面壳层。模块切换已收进左侧主导航，这里不再渲染顶部标签栏。
 */
export function ModulePage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  /** 保留参数以免旧调用报错；顶部标签栏已移除 */
  subNav?: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </header>

      <div className="flex-1">{children}</div>

      <ComputeNotes />
    </div>
  );
}
