import { defineSandbox } from "eve/sandbox";
import { JustBashSandbox } from "eve/sandbox/just-bash";

/**
 * ③ Sandbox：命令与文件只在解释器内的虚拟文件系统里发生。
 *
 * 为什么不是 DockerSandbox：Docker 只在装了 Docker Desktop 的机器上可用，
 * 本机与 Vercel 运行时都没有 daemon，`eve build` 会直接死在
 * 「initializing sandbox template」这一步，整个 Runtime 起不来。
 *
 * 为什么不是 VercelSandbox：需要 VERCEL_OIDC_TOKEN + 付费额度，且本地无法
 * 自测；作为「先让 Runtime 跑通」的第一步不划算。
 *
 * JustBashSandbox 是纯 JS 的 shell 解释器 + 虚拟文件系统：
 * - 不 spawn 宿主进程，任何 `bash` 命令都在解释器里模拟；
 * - 没有网络命令（eve 对它的 networkPolicy 只接受 allow-all，因为根本没有网络面）；
 * - 文件写在自己的虚拟根目录，碰不到宿主仓库。
 * 它不是内核级隔离，所以定位是「比宿主执行严格，比容器轻」——
 * 一旦真的需要跑不可信二进制，再换回 DockerSandbox / VercelSandbox。
 *
 * 这一层是双保险：② 已从编译期关掉 bash / 读写文件 / 联网等内置工具，
 * 正常路径根本不会请求沙箱。若将来误加了需要沙箱的工具，这里仍然兜住。
 *
 * eve 的编译期契约：必须具名导出 `environment`，且 selector 只能 open
 * 这个对象一次并 return 它。不要在 selector 里按 host 三元切换 provider
 * （build 记录的 artifact provider 会与 runtime 不一致）。
 */
export const environment = JustBashSandbox.environment();

export default defineSandbox(async () => {
  try {
    return await environment.open();
  } catch (cause) {
    throw new Error(
      "Coolha: 隔离沙箱不可用（just-bash 未就绪），拒绝在宿主环境执行命令或读写文件。",
      { cause },
    );
  }
});
