// 树工具：绝对原点、容器命中测试（CV-06 嵌套）
import type { Point } from './coords';
import type { Board, Node } from '../types';

// 可作为容器的模块类型（与 LB-01 注册表 isContainer 对应）
export const CONTAINER_TYPES = new Set(['card', 'group']);

/** 节点在画板坐标系中的绝对左上角（沿父链累加） */
export function absOrigin(board: Board, id: string): Point {
  let ox = 0, oy = 0;
  let cur: Node | undefined = board.nodes[id];
  while (cur && cur.parentId) {
    ox += cur.frame.x;
    oy += cur.frame.y;
    cur = board.nodes[cur.parentId];
  }
  return { x: ox, y: oy };
}

/** maybeId 是否为 ancestorId 自身或其后代（防止把容器拖进自己） */
export function isSelfOrDescendant(board: Board, ancestorId: string, maybeId: string): boolean {
  let cur: Node | undefined = board.nodes[maybeId];
  while (cur) {
    if (cur.id === ancestorId) return true;
    cur = cur.parentId ? board.nodes[cur.parentId] : undefined;
  }
  return false;
}

function depth(board: Board, id: string): number {
  let d = 0;
  let cur: Node | undefined = board.nodes[id];
  while (cur && cur.parentId) { d++; cur = board.nodes[cur.parentId]; }
  return d;
}

/** 命中测试：返回包含 pt 的最深层容器 id（排除 exclude），无则 null（即画板根层） */
export function findContainerAt(board: Board, pt: Point, exclude: Set<string>): string | null {
  let best: { id: string; depth: number } | null = null;
  for (const n of Object.values(board.nodes)) {
    if (!CONTAINER_TYPES.has(n.type) || exclude.has(n.id)) continue;
    const o = absOrigin(board, n.id);
    if (pt.x >= o.x && pt.x <= o.x + n.frame.w && pt.y >= o.y && pt.y <= o.y + n.frame.h) {
      const d = depth(board, n.id);
      if (!best || d > best.depth) best = { id: n.id, depth: d };
    }
  }
  return best?.id ?? null;
}

/** 某节点的全部后代 id 集合（含自身） */
export function subtreeIds(board: Board, id: string): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    out.add(cur);
    const n = board.nodes[cur];
    if (n) stack.push(...n.children);
  }
  return out;
}
