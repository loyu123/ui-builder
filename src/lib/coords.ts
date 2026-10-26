// DV-02 前身 · v0 只需一层换算：屏幕 → 画板
// W2 将扩展 boardToParent（嵌套）并补 6 条单测

export function screenToBoard(
  clientX: number,
  clientY: number,
  boardEl: HTMLElement,
  zoom: number,
): { x: number; y: number } {
  const r = boardEl.getBoundingClientRect();
  return {
    x: (clientX - r.left) / zoom,
    y: (clientY - r.top) / zoom,
  };
}
