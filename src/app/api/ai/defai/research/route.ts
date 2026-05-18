import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ResearchPayload = {
  projectUrl?: string;
  note?: string;
  action?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ResearchPayload;
    const projectUrl = (body.projectUrl || "").trim();
    const note = (body.note || "").trim();
    const action = (body.action || "full_research").trim();

    if (!projectUrl) {
      return NextResponse.json(
        { message: "projectUrl 不能为空" },
        { status: 400 },
      );
    }

    const apiBase =
      process.env.ELIZA_API_BASE?.trim() || "http://127.0.0.1:3001";
    const endpoint =
      process.env.ELIZA_RESEARCH_ENDPOINT?.trim() || "/api/defai/research";

    const normalizedBase = apiBase.replace(/\/$/, "");
    const normalizedEndpoint = endpoint.startsWith("/")
      ? endpoint
      : `/${endpoint}`;
    const target = `${normalizedBase}${normalizedEndpoint}`;

    const upstreamResponse = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectUrl,
        note,
        action,
        source: "nextjs-ai-bridge",
      }),
      cache: "no-store",
    });

    const contentType = upstreamResponse.headers.get("content-type") || "";
    const upstreamBody = contentType.includes("application/json")
      ? await upstreamResponse.json().catch(() => ({}))
      : await upstreamResponse.text().catch(() => "");

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        {
          message: "ElizaOS 上游请求失败",
          upstream: {
            status: upstreamResponse.status,
            endpoint: target,
          },
          detail: upstreamBody,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      mode: "live",
      message: "ElizaOS 调用成功",
      request: {
        projectUrl,
        note,
        action,
      },
      upstream: {
        status: upstreamResponse.status,
        endpoint: target,
      },
      result: upstreamBody,
    });
  } catch (error) {
    return NextResponse.json({
      ok: true,
      mode: "mock",
      message:
        error instanceof Error
          ? `ElizaOS 不可用，已回退 mock：${error.message}`
          : "ElizaOS 不可用，已回退 mock",
      request: {
        projectUrl: "",
        note: "",
        action: "full_research",
      },
      result: {
        summary: "Mock: 建议优先检查代币解锁节奏、真实用户增长与流动性深度。",
        perception: [
          "RootData: 资本与关联关系",
          "OKX: 价格异动",
          "Dune: 活跃地址趋势",
        ],
        decision: ["社媒情绪加权", "RWA/Pre-IPO 事件联动"],
        execution: ["TWAP 分批执行", "控制单笔滑点与失败重试"],
      },
    });
  }
}
