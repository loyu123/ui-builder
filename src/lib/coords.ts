// DV-02 · 坐标换算核心（全项目唯一的坐标换算入口）
// 三个参考系：屏幕坐标 → 画布坐标 → 父容器坐标
// 纪律：除以 zoom 只出现在本文件；拖动用增量；取整只在提交时做一次

export interface Point { x: number; y: number }
export interface RectLike { left: number; top: number }

/** 屏幕 → 画板。rect 为画板元素的 getBoundingClientRect()（已含滚动与缩放后的实际位置） */
export function screenToBoard(clientX: number, clientY: number, rect: RectLike, zoom: number): Point {
  return {
    x: (clientX - rect.left) / zoom,
    y: (clientY - rect.top) / zoom,
  };
}

/** 画板 → 父容器。parentOrigin 为父容器在画板坐标系中的左上角 */
export function boardToParent(p: Point, parentOrigin: Point): Point {
  return { x: p.x - parentOrigin.x, y: p.y - parentOrigin.y };
}

/** 屏幕位移增量 → 画板位移增量（拖动时用增量，不用绝对坐标） */
export function deltaToBoard(dx: number, dy: number, zoom: number): Point {
  return { x: dx / zoom, y: dy / zoom };
}

/** 拖动的吸附阈值（屏幕像素 6px，换算成画板像素） */
export function snapThreshold(zoom: number): number {
  return 6 / zoom;
}
