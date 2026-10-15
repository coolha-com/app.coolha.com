import type { ReactNode } from "react";
import Link from "next/link";
import { RiArrowLeftLine } from "react-icons/ri";
import { ComputeNotes } from "@/components/compute/ComputeNotes";

/**
 * 算力市场子页面壳层（模型广场 / API 连接 / 用量记录 / 余额与账单）。
 * 顶部提供返回 Chat 的入口，底部统一收纳说明——主视觉流只留交互元件。
 */
export function ModulePage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5">
        <Link
          href="/chat"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <RiArrowLeftLine className="size-4" />
          返回 Chat
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </header>

      <div className="flex-1">{children}</div>

      <ComputeNotes />
    </div>
  );
}
