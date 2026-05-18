import path from "node:path";
import { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";


const nextConfig: NextConfig = {
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
