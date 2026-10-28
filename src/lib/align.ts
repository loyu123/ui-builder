// F4 · 对齐与等距分布：纯函数（可单测，不触 store/DOM）
// 坐标均为同一父容器内的局部坐标；调用方负责保证被对齐的节点同父
import type { Frame } from '../types';

export type AlignDir = 'left' | 'right' | 'top' | 'bottom' | 'hcenter' | 'vcenter';
export type DistributeAxis = 'h' | 'v';

export interface AlignItem { id: string; frame: Frame }
export interface FramePatch { id: string; frame: Frame }

/** 选中集的公共外接矩形 */
export function bounds(items: AlignItem[]): Frame {
  const minX = Math.min(...items.map(i => i.frame.x));
  const minY = Math.min(...items.map(i => i.frame.y));
  const maxX = Math.max(...items.map(i => i.frame.x + i.frame.w));
  const maxY = Math.max(...items.map(i => i.frame.y + i.frame.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** 对齐到选中集公共边界（<2 个节点不产生补丁）；返回全部补丁，调用方按需应用 */
export function alignFrames(items: AlignItem[], dir: AlignDir): FramePatch[] {
  if (items.length < 2) return [];
  const b = bounds(items);
  return items.map(it => {
    const f = { ...it.frame };
    switch (dir) {
      case 'left': f.x = b.x; break;
      case 'right': f.x = b.x + b.w - f.w; break;
      case 'top': f.y = b.y; break;
      case 'bottom': f.y = b.y + b.h - f.h; break;
      case 'hcenter': f.x = b.x + (b.w - f.w) / 2; break;
      case 'vcenter': f.y = b.y + (b.h - f.h) / 2; break;
    }
    f.x = Math.round(f.x);
    f.y = Math.round(f.y);
    return { id: it.id, frame: f };
  });
}

/**
 * 等距分布：首尾节点固定，中间节点等分「净间距」（≥3 个才生效）。
 * 净间距可为负（重叠时按数学值等分），保证结果稳定可预测。
 */
export function distributeFrames(items: AlignItem[], axis: DistributeAxis): FramePatch[] {
  if (items.length < 3) return [];
  const size = (f: Frame) => (axis === 'h' ? f.w : f.h);
  const pos = (f: Frame) => (axis === 'h' ? f.x : f.y);

  const sorted = [...items].sort((a, b) => pos(a.frame) - pos(b.frame));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const startEdge = pos(first.frame) + size(first.frame);         // 首节点尾边
  const endEdge = pos(last.frame);                                 // 末节点头边
  const innerSize = sorted.slice(1, -1).reduce((s, it) => s + size(it.frame), 0);
  const gap = (endEdge - startEdge - innerSize) / (sorted.length - 1);

  let cursor = startEdge + gap;
  const out: FramePatch[] = [];
  for (const it of sorted.slice(1, -1)) {
    const f = { ...it.frame };
    if (axis === 'h') f.x = Math.round(cursor);
    else f.y = Math.round(cursor);
    cursor += size(it.frame) + gap;
    out.push({ id: it.id, frame: f });
  }
  return out;
}
