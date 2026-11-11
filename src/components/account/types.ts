/**
 * 账户页的数据契约。
 * 单独放一个文件，避免客户端组件去 import 带 `server-only` 的服务端模块。
 */

export interface AccountWallet {
  address: string
  createdAt: string
}

export interface AccountSnapshot {
  /** 当前会话是通过什么方式建立的 */
  source: "web2" | "wallet"
  displayName: string | null
  email: string | null
  emailVerified: boolean
  image: string | null
  /** 是否设置过密码（Neon Auth credential） */
  hasPassword: boolean
  /** 是否有 Neon Auth 身份（纯钱包账号为 false，邮箱/密码都改不了） */
  hasNeonAuth: boolean
  wallets: AccountWallet[]
  /** 除钱包外还绑了别的登录方式，决定最后一个钱包能否解绑 */
  hasNonWalletCredential: boolean
  /** 当前会话正在使用的钱包地址（仅钱包登录） */
  currentAddress: string | null
  /** 没有名称/邮箱时头像里显示的首字母（取地址第 3 位，避免显示 "0"） */
  fallbackLabel: string
}
