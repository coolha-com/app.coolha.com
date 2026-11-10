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
      { source: "/ai/research", destination: "/agents/research", permanent: false },
      { source: "/ai/agents/rwa-research", destination: "/agents/rwa-research", permanent: false },
      { source: "/ai/models/:id", destination: "/console/models/:id", permanent: false },
      { source: "/ai/models", destination: "/console/models", permanent: false },
      { source: "/ai/api-keys", destination: "/console/api-keys", permanent: false },
      { source: "/ai/billing", destination: "/billing/subscription", permanent: false },
      { source: "/ai/usage", destination: "/billing/usage", permanent: false },
      { source: "/connect", destination: "/console", permanent: false },
      { source: "/developers", destination: "/console", permanent: false },
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
export default withNextIntl(nextConfig);
