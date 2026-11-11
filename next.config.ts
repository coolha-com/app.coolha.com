import fs from "node:fs";
import path from "node:path";
import { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "package.json"), "utf-8"),
) as { version: string };

const nextConfig: NextConfig = {
  // 版本号由 package.json 驱动，构建期内联到客户端（webpack / turbopack 均生效）
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  // 由 `next upgrade --agent=security` 写入：后续升级沿用 security 策略
  experimental: {
    agentUpgrade: "security",
  },
  // 旧路由兼容：/ai 聚合模块与已下线的接入页，统一跳到主导航对应子路由。
  // 站内链接已全部改到新路径，这里只兜底外部书签、文档与历史链接。
  async redirects() {
    return [
      { source: "/ai", destination: "/data/tools", permanent: false },
      { source: "/ai/tools", destination: "/data/tools", permanent: false },
      { source: "/ai/research", destination: "/agents", permanent: false },
      { source: "/ai/agents/rwa-research", destination: "/", permanent: false },
      { source: "/agents/rwa-research", destination: "/", permanent: false },
      { source: "/ai/models/:id", destination: "/agents/models/:id", permanent: false },
      { source: "/ai/models", destination: "/agents/models", permanent: false },
      { source: "/console/models/:id", destination: "/agents/models/:id", permanent: false },
      { source: "/console/models", destination: "/agents/models", permanent: false },
      { source: "/rwa", destination: "/data/rwa", permanent: false },
      { source: "/account", destination: "/settings/account", permanent: false },
      { source: "/chat", destination: "/", permanent: false },
      { source: "/ai/billing", destination: "/billing/subscription", permanent: false },
      { source: "/ai/usage", destination: "/billing/usage", permanent: false },
      { source: "/connect", destination: "/console", permanent: false },
      { source: "/developers", destination: "/console", permanent: false },
    ]
  },
  // /eve/v1/* 一律先过 Next 侧受控代理（会话校验），再转发到 eve Runtime。
  // 生产不自动暴露：必须显式设置 EVE_RUNTIME_ORIGIN。
  // 本地用 COOLHA_EVE_LOCAL=1 开启：`next start` 同样是 NODE_ENV=production，
  // 只看 NODE_ENV 会让本地构建丢掉 rewrite，表现为 /eve/v1/* 404。
  async rewrites() {
    const enabled =
      process.env.EVE_RUNTIME_ORIGIN !== undefined ||
      process.env.COOLHA_EVE_LOCAL === "1" ||
      process.env.NODE_ENV !== "production"
    if (!enabled) return []
    return [
      { source: "/eve/v1/:path*", destination: "/api/eve/v1/:path*" },
    ]
  },
  turbopack: {
    resolveAlias: {
      "@wagmi/connectors": path.join(__dirname, "src/shims/wagmi-connectors.ts"),
      "@wagmi/connectors/dist/esm/exports/index.js": path.join(__dirname, "src/shims/wagmi-connectors.ts"),
    },
  },
  webpack: config => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@wagmi/connectors": path.join(__dirname, "src/shims/wagmi-connectors.ts"),
      "@wagmi/connectors/dist/esm/exports/index.js": path.join(__dirname, "src/shims/wagmi-connectors.ts"),
    }
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    return config
  }
};

const withNextIntl = createNextIntlPlugin();
// 暂不接 withEve()：eve@1.0.0-rc.8 的 dev host 在 Windows 上把绝对路径写成
// "./C:/..."，导致 UNRESOLVED_IMPORT 并带崩 next dev。eve 先作独立 Runtime。
export default withNextIntl(nextConfig);
