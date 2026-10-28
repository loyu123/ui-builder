// F3 · 画板导出 PNG（零依赖：DOM → SVG foreignObject → canvas → blob）
// 取舍说明：
// - 不用 html2canvas 类库，避免额外体积与版本风险；画板内容本来就是绝对定位 + 内联样式，适合 foreignObject 路线
// - 逐元素把 computedStyle 内联到克隆节点，解决 CSS 变量 / 继承字体 / 阴影在 SVG 文档里丢失的问题
// - 跨域图片会污染 canvas（toBlob 抛错）→ 由调用方提示用户改用本地图片
// 纯函数部分（文件名 / 倍率钳制）单独导出，便于单测

export const PNG_SCALE_MIN = 1;
export const PNG_SCALE_MAX = 3;

/** 倍率钳制到 [1, 3]（默认 2 倍，即视网膜清晰度） */
export function normalizeScale(scale?: number): number {
  const v = scale ?? 2;
  if (!Number.isFinite(v)) return 2;
  return Math.min(PNG_SCALE_MAX, Math.max(PNG_SCALE_MIN, v));
}

/** 文件名：项目-页面-设备-日期.png，剔除文件系统非法字符 */
export function boardPngFileName(
  projectName: string,
  pageName: string,
  device: string,
  now: Date = new Date(),
): string {
  const slug = (s: string) =>
    s.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/^-+|-+$/g, '') || 'board';
  const d = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  return `${slug(projectName)}-${slug(pageName)}-${device}-${d}.png`;
}

// 逐元素内联计算样式（克隆树与源树按查询顺序一一对应）
function inlineComputedStyle(source: Element, target: Element): void {
  const cs = window.getComputedStyle(source);
  const parts: string[] = [];
  for (let i = 0; i < cs.length; i++) {
    const prop = cs.item(i);
    parts.push(`${prop}:${cs.getPropertyValue(prop)}`);
  }
  target.setAttribute('style', parts.join(';'));
}

/** 把画板元素渲染成 PNG Blob（scale 默认 2，钳制到 1~3） */
export async function exportBoardPng(el: HTMLElement, opts: { scale?: number } = {}): Promise<Blob> {
  const scale = normalizeScale(opts.scale);
  const w = Math.max(1, Math.round(el.offsetWidth));
  const h = Math.max(1, Math.round(el.offsetHeight));

  const clone = el.cloneNode(true) as HTMLElement;
  inlineComputedStyle(el, clone);
  const sources = el.querySelectorAll('*');
  const targets = clone.querySelectorAll('*');
  sources.forEach((s, i) => {
    const d = targets[i];
    if (d) inlineComputedStyle(s, d);
  });
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';        // 画板投影属于编辑器台面，不进成品

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<foreignObject x="0" y="0" width="${w}" height="${h}">` +
    clone.outerHTML +
    '</foreignObject></svg>';

  const img = new Image();
  img.decoding = 'sync';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('PNG 渲染失败：SVG 转图片失败'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PNG 渲染失败：无法创建 canvas 上下文');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('PNG 编码失败（可能是图片跨域）'))), 'image/png');
  });
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
