/**
 * 账户页「登录方式」三张卡片（邮箱 / 密码 / 钱包）共用同一套内外边距。
 * 不设固定高度——高度由内容决定，靠统一的内边距与行高对齐。
 */
export const ACCOUNT_CARD_CLASS = "flex flex-col gap-3 px-5 py-4"

/** 每张卡片首行（图标 + 值 + 徽章 + 操作）的统一高度，三张卡片必须一致 */
export const ACCOUNT_ROW_CLASS = "flex min-h-8 flex-wrap items-center justify-between gap-2"
