// 导入体积护栏：避免超大 JSON 把标签页拖死 / 撑爆 IndexedDB
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;   // 5 MB

/** 粗估 UTF-8 字节数并判断是否超限（超限即提前返回，不遍历完整个文件） */
export function isOversizedImport(text: string, max = MAX_IMPORT_BYTES): boolean {
  if (text.length > max) return true;                 // 单字节字符都不止 max 个
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    bytes += c < 0x80 ? 1 : c < 0x800 ? 2 : 3;
    if (bytes > max) return true;
  }
  return false;
}
