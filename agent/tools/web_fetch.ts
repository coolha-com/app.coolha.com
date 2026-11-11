import { disableTool } from "eve/tools";

/** 白名单外：禁用 eve 内置的 web_fetch 工具（避免任意外联 / SSRF）。 */
export default disableTool();
