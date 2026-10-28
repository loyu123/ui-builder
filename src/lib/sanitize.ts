// 输入净化（安全加固用，纯函数）：
// 1) 图片地址协议白名单 —— 挡掉 javascript: / data:text/html 等历史坑
// 2) 导出代码里的用户字符串转义 —— 项目名/页面名会被拼进 HTML、模板字符串与注释
const SAFE_IMAGE_PROTOCOLS = new Set(['http:', 'https:', 'blob:']);

/** 允许 http(s) / blob / data:image/* / 相对路径；其余（javascript:、data:text/html、file: …）一律拒绝 */
export function isSafeImageUrl(raw: unknown): boolean {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (!v) return false;
  if (/^data:image\/[a-z0-9.+-]+[;,]/i.test(v)) return true;
  try {
    const u = new URL(v, 'https://relative.invalid');   // 相对路径按同源处理
    return SAFE_IMAGE_PROTOCOLS.has(u.protocol);
  } catch {
    return false;
  }
}

/** 不安全或为空时返回空串（渲染层据此显示占位符） */
export function safeImageSrc(raw: unknown): string {
  return isSafeImageUrl(raw) ? String(raw).trim() : '';
}

/** HTML 文本转义（<title> / 属性值） */
export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 压成单行安全文本：去掉换行/制表、反引号与 $（避免破坏导出器自身的模板字符串 / TSX 注释），
 * 并限制长度，防止超长名字把产物撑坏
 */
export function safeInlineText(raw: string, max = 120): string {
  const one = raw.replace(/[\r\n\t]+/g, ' ').replace(/[`$]/g, '').replace(/\s{2,}/g, ' ').trim();
  return one.length > max ? one.slice(0, max) : one;
}
