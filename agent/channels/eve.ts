import { eveChannel } from "eve/channels/eve";
import { localDev, placeholderAuth, type AuthFn } from "eve/channels/auth";

/**
 * Route auth（/eve/v1/*）：只接受经过 Coolha 主站 SIWE 校验的请求。
 *
 * 链路：浏览器 → /eve/v1/*（同源 rewrite）→ src/app/api/eve/v1/[...path]/route.ts
 *       → 校验 coolha_wallet_session / wallet_sessions → 注入内部密钥 + subject → eve。
 *
 * 这里不再使用 `none()`：匿名与绕过主站直连 Runtime 的请求一律 401。
 * principalId 用钱包地址（与项目 identity 口径一致），可用于后续按主体计量。
 *
 * 本地开发有占位密钥；生产必须显式设置 EVE_INTERNAL_SECRET，否则放行不了任何请求。
 */
const DEV_SECRET = "coolha-local-eve-proxy";

function coolhaSiweProxy(): AuthFn<Request> {
  return (request) => {
    const expected =
      process.env.EVE_INTERNAL_SECRET ??
      (process.env.COOLHA_EVE_LOCAL === "1" ? DEV_SECRET : null);
    if (!expected) return null;
    if (request.headers.get("x-coolha-eve-secret") !== expected) return null;

    const subject = request.headers.get("x-coolha-subject");
    if (!subject) return null;

    // 模型由 Next 代理按平台白名单校验后注入；这里只信任已验证的内部密钥通道，
    // 不接受请求体里的模型字段（eve 请求体也会拒绝未知顶层字段）。
    const model = request.headers.get("x-coolha-eve-model") ?? "";

    return {
      authenticator: "coolha-siwe",
      principalId: subject,
      principalType: "user",
      attributes: {
        via: "coolha-next-proxy",
        ...(model ? { model } : {}),
      },
    };
  };
}

export default eveChannel({
  auth: [coolhaSiweProxy(), localDev(), placeholderAuth()],
});
