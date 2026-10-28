// F10 · 间距标注：选中元素与「同容器内其他元素」的最近间距（画板坐标系，纯函数）
// 规则（对齐 Figma 的直觉）：
// - 只在与另一轴有重叠时才标注（没重叠的元素谈不上"间距"）
// - 每个方向只标最近的那个；间距 <= 0（重叠/贴边）不标
// - 线画在两个最近的边之间，数值落在线的中点
export interface Rect { x: number; y: number; w: number; h: number }

export type GapSide = 'left' | 'right' | 'top' | 'bottom';

export interface SpacingGap {
  side: GapSide;
  gap: number;          // 间距像素（> 0）
  axis: 'h' | 'v';      // h：水平标注线（左右间距）；v：垂直标注线（上下间距）
  x: number;            // 标注线起点（画板坐标）
  y: number;
  length: number;       // 标注线长度（= gap）
}

const overlapX = (a: Rect, b: Rect) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
const overlapY = (a: Rect, b: Rect) => Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);

/** 计算 sel 相对 others 的四个方向最近间距（每个方向最多一条） */
export function spacingGaps(sel: Rect, others: readonly Rect[]): SpacingGap[] {
  let left: { gap: number; from: number; at: number } | null = null;
  let right: { gap: number; from: number; at: number } | null = null;
  let top: { gap: number; from: number; at: number } | null = null;
  let bottom: { gap: number; from: number; at: number } | null = null;

  for (const o of others) {
    const oy = overlapY(sel, o);
    if (oy > 0) {
      const gLeft = sel.x - (o.x + o.w);                        // 对方在左
      if (gLeft > 0 && (!left || gLeft < left.gap)) {
        left = { gap: gLeft, from: o.x + o.w, at: Math.max(sel.y, o.y) + oy / 2 };
      }
      const gRight = o.x - (sel.x + sel.w);                     // 对方在右
      if (gRight > 0 && (!right || gRight < right.gap)) {
        right = { gap: gRight, from: sel.x + sel.w, at: Math.max(sel.y, o.y) + oy / 2 };
      }
    }

    const ox = overlapX(sel, o);
    if (ox > 0) {
      const gTop = sel.y - (o.y + o.h);                         // 对方在上
      if (gTop > 0 && (!top || gTop < top.gap)) {
        top = { gap: gTop, from: o.y + o.h, at: Math.max(sel.x, o.x) + ox / 2 };
      }
      const gBottom = o.y - (sel.y + sel.h);                    // 对方在下
      if (gBottom > 0 && (!bottom || gBottom < bottom.gap)) {
        bottom = { gap: gBottom, from: sel.y + sel.h, at: Math.max(sel.x, o.x) + ox / 2 };
      }
    }
  }

  const out: SpacingGap[] = [];
  if (left) out.push({ side: 'left', gap: left.gap, axis: 'h', x: left.from, y: left.at, length: left.gap });
  if (right) out.push({ side: 'right', gap: right.gap, axis: 'h', x: right.from, y: right.at, length: right.gap });
  if (top) out.push({ side: 'top', gap: top.gap, axis: 'v', x: top.at, y: top.from, length: top.gap });
  if (bottom) out.push({ side: 'bottom', gap: bottom.gap, axis: 'v', x: bottom.at, y: bottom.from, length: bottom.gap });
  return out;
}
