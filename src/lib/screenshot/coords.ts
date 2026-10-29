// SS-03 · 坐标：探测模型用的坐标系 → 归一化到 0-1 → 映射到画板像素
// 为什么必须探测：同一句 prompt 下不同厂商返回 0-1、0-1000（Qwen-VL 系）或绝对像素，
// 不先判定就会整批错位，且看起来像"模型不准"。
import type { RatioBox } from './schema';

export type CoordSpace = 'ratio' | 'grid1000' | 'pixels';
export interface Size { w: number; h: number }
export interface PxBox { x: number; y: number; w: number; h: number }

export const GRID1000 = 1000;

/** 依据数值范围 + 图片尺寸判定坐标系 */
export function detectCoordSpace(boxes: readonly RatioBox[], image?: Size | null): CoordSpace {
  if (!boxes.length) return 'ratio';
  let maxVal = 0;
  for (const b of boxes) maxVal = Math.max(maxVal, b.x + b.w, b.y + b.h);
  if (maxVal <= 1.5) return 'ratio';
  if (image && maxVal <= Math.max(image.w, image.h) * 1.05) return 'pixels';
  if (maxVal <= GRID1000) return 'grid1000';
  return 'pixels';
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 归一化到 0-1；像素坐标需要图片尺寸，缺失时按 0-1000 网格兜底 */
export function normalizeBox(box: RatioBox, space: CoordSpace, image?: Size | null): RatioBox {
  let { x, y, w, h } = box;
  if (space === 'grid1000') {
    x /= GRID1000; y /= GRID1000; w /= GRID1000; h /= GRID1000;
  } else if (space === 'pixels') {
    const sw = image?.w ?? GRID1000;
    const sh = image?.h ?? GRID1000;
    x /= sw; y /= sh; w /= sw; h /= sh;
  }
  const nx = clamp01(x);
  const ny = clamp01(y);
  return {
    x: nx,
    y: ny,
    w: Math.max(0.002, Math.min(1 - nx, w) || 0.002),
    h: Math.max(0.002, Math.min(1 - ny, h) || 0.002),
  };
}

/** 0-1 → 画板像素（四舍五入，最小边 ≥ min） */
export function toBoardFrame(box: RatioBox, board: Size, min = 2): PxBox {
  const x = Math.round(box.x * board.w);
  const y = Math.round(box.y * board.h);
  return {
    x: Math.min(x, Math.max(0, board.w - min)),
    y: Math.min(y, Math.max(0, board.h - min)),
    w: Math.max(min, Math.round(box.w * board.w)),
    h: Math.max(min, Math.round(box.h * board.h)),
  };
}

/** 由图片宽高比推荐画板（手机 390/844、手表 200/242、电脑 1440/900 里最接近的） */
export function recommendDevice<T extends string>(
  imageAspect: number,
  devices: Record<T, Size>,
): T {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const key of Object.keys(devices) as T[]) {
    const d = devices[key];
    const dist = Math.abs(Math.log((d.w / d.h) / Math.max(0.01, imageAspect)));
    if (dist < bestDist) { bestDist = dist; best = key; }
  }
  return (best ?? (Object.keys(devices)[0] as T));
}
