// P1-14 · Canvas 手势纯函数：缩放推框与框选命中（不触 store/DOM，可单测）
// 对应原 Canvas.tsx 内联逻辑，行为保持一致
import type { Frame, Node } from '../../types';

export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const RESIZE_MIN = 16;

// CV-05 · 由起始帧 + 手柄方向 + 指针位移推缩放预览帧；Shift 仅角点手柄（两字符）锁宽高比
export function resizeFrame(start: Frame, handle: Handle, dx: number, dy: number, shiftKey: boolean): Frame {
  const f = { ...start };
  if (handle.includes('e')) f.w = Math.max(RESIZE_MIN, start.w + dx);
  if (handle.includes('s')) f.h = Math.max(RESIZE_MIN, start.h + dy);
  if (handle.includes('w')) {
    const w = Math.max(RESIZE_MIN, start.w - dx);
    f.x = start.x + (start.w - w);
    f.w = w;
  }
  if (handle.includes('n')) {
    const hgt = Math.max(RESIZE_MIN, start.h - dy);
    f.y = start.y + (start.h - hgt);
    f.h = hgt;
  }
  if (shiftKey && handle.length === 2) {
    const ratio = start.w / Math.max(1, start.h);
    if (handle.includes('e') || handle.includes('w')) {
      f.h = Math.max(RESIZE_MIN, f.w / ratio);
      if (handle.includes('n')) f.y = start.y + (start.h - f.h);
    } else {
      f.w = Math.max(RESIZE_MIN, f.h * ratio);
      if (handle.includes('w')) f.x = start.x + (start.w - f.w);
    }
  }
  return f;
}

// CV-03 · 框选命中：根层子节点与矩形相交（矩形 <3px 视为点击，不框选）
export function marqueeHits(children: Node[], rect: Frame): string[] {
  if (rect.w < 3 && rect.h < 3) return [];
  return children
    .filter(n => n.frame.x < rect.x + rect.w && n.frame.x + n.frame.w > rect.x
      && n.frame.y < rect.y + rect.h && n.frame.y + n.frame.h > rect.y)
    .map(n => n.id);
}
