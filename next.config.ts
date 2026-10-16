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
