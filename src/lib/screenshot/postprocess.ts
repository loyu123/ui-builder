// SS-06 · 后处理流水线（纯函数）：
// 栅格吸附 → 越界裁剪 → 列对齐 → IoU 去重 → 置信度分级
// 原则：修到能用 + 明确标记修不好；宁可降级为占位块，也不让错坐标上画布
import { toBoardFrame, type PxBox, type Size } from './coords';
import type { RatioBox } from './schema';
import type { StyleValue } from './styleAlias';

export interface MappedModule {
  id: string;
  rawType: string;       // 模型原始 type（仅用于提示文案）
  type: string;          // 已映射为注册表 type（或占位类型）
  known: boolean;        // 映射是否可信（别名命中 / 精确命中）
  confidence: number;
  box: RatioBox;         // 0-1
  text: string;
  style: Record<string, StyleValue>;
}

export type ConfidenceTier = 'low' | 'warn' | 'ok';

export interface ProcessedModule extends MappedModule {
  frame: PxBox;          // 画板像素，已吸附 / 裁剪 / 对齐
  tier: ConfidenceTier;
  placeholder: boolean;  // true：降级为占位块（类型未知或置信度过低）
  overlapWarn: boolean;  // true：与更高置信度模块部分重叠，请人工确认
}

export interface ProcessOptions {
  grid?: number;         // 栅格（默认 4px）
  alignTol?: number;     // 列对齐容差（默认 8px）
  mergeIou?: number;     // ≥ 该值视为同一元素，直接合并（默认 0.6）
  flagIou?: number;      // ≥ 该值标记「可能重叠」（默认 0.3）
  lowConfidence?: number;
  highConfidence?: number;
  minSize?: number;
}

const DEFAULTS: Required<ProcessOptions> = {
  grid: 4, alignTol: 8, mergeIou: 0.6, flagIou: 0.3,
  lowConfidence: 0.4, highConfidence: 0.7, minSize: 2,
};

export const snapToGrid = (v: number, grid: number): number => Math.round(v / grid) * grid;

export function iou(a: PxBox, b: PxBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return 0;
  const inter = (x2 - x1) * (y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * 列对齐：左边缘 → 右边缘 → 中心线 三轮聚类（容差内统一到簇内锚点）。
 * 锚点取排序后的首个值而不是「上一个已改过的值」，避免链式漂移。
 * 加右边缘是因为卡片/按钮常见右对齐，只做左边缘会把它们又拉歪。
 */
export function alignColumns(frames: PxBox[], tol: number): PxBox[] {
  const out = frames.map(f => ({ ...f }));
  const cluster = (getVal: (f: PxBox) => number, setVal: (f: PxBox, v: number) => void) => {
    const sorted = [...out].sort((a, b) => getVal(a) - getVal(b));
    let anchor: number | null = null;
    for (const f of sorted) {
      const v = getVal(f);
      if (anchor === null || Math.abs(v - anchor) > tol) anchor = v;
      else setVal(f, anchor);
    }
  };
  cluster(f => f.x, (f, v) => { f.x = v; });
  cluster(f => f.x + f.w, (f, v) => { f.x = v - f.w; });
  cluster(f => f.x + f.w / 2, (f, v) => { f.x = Math.round(v - f.w / 2); });
  return out;
}

/** 主流水线；返回顺序 = 绘制顺序（大块在前，避免容器压住子元素） */
export function processModules(
  mods: readonly MappedModule[],
  board: Size,
  opts: ProcessOptions = {},
): ProcessedModule[] {
  const o = { ...DEFAULTS, ...opts };
  const minSize = o.minSize;

  // 1-2. 映射到像素 + 栅格吸附
  let frames = mods.map(m => {
    const f = toBoardFrame(m.box, board, minSize);
    return {
      ...f,
      x: snapToGrid(f.x, o.grid),
      y: snapToGrid(f.y, o.grid),
      w: Math.max(minSize, snapToGrid(f.w, o.grid)),
      h: Math.max(minSize, snapToGrid(f.h, o.grid)),
    };
  });

  // 3. 越界裁剪（吸附后可能顶出画板）
  frames = frames.map(f => {
    const w = Math.min(f.w, board.w);
    const h = Math.min(f.h, board.h);
    return {
      w, h,
      x: Math.min(Math.max(0, f.x), board.w - w),
      y: Math.min(Math.max(0, f.y), board.h - h),
    };
  });

  // 4. 列对齐（对齐可能把框推出画板，再夹回来一次）
  frames = alignColumns(frames, o.alignTol).map(f => ({
    ...f,
    x: Math.min(Math.max(0, f.x), Math.max(0, board.w - f.w)),
    y: Math.min(Math.max(0, f.y), Math.max(0, board.h - f.h)),
  }));

  // 5. IoU 去重（高置信度优先保留）
  const order = mods.map((m, i) => i).sort((a, b) => mods[b].confidence - mods[a].confidence);
  const kept: number[] = [];
  const overlapWarn = new Set<number>();
  for (const i of order) {
    const hit = kept.find(k => iou(frames[k], frames[i]) >= o.mergeIou);
    if (hit !== undefined) continue;
    const near = kept.find(k => iou(frames[k], frames[i]) >= o.flagIou);
    if (near !== undefined) overlapWarn.add(i);
    kept.push(i);
  }

  // 6. 置信度分级 + 占位块
  const result: ProcessedModule[] = kept.map(i => {
    const m = mods[i];
    const tier: ConfidenceTier = m.confidence < o.lowConfidence ? 'low'
      : m.confidence < o.highConfidence ? 'warn' : 'ok';
    return {
      ...m,
      frame: { ...frames[i] },
      tier,
      placeholder: !m.known || tier === 'low',
      overlapWarn: overlapWarn.has(i),
    };
  });

  // 绘制顺序：面积大的先画（容器在下），面积相同保持模型原序
  return result.sort((a, b) => (b.frame.w * b.frame.h) - (a.frame.w * a.frame.h));
}
