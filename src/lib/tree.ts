// 树工具：绝对原点、容器命中测试（CV-06 嵌套）
import type { Point } from './coords';
import type { Board, Node } from '../types';
import { CONTAINER_TYPES } from '../modules/registry';

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

// ---------- F5 · 图层树：扁平化 + 名称过滤 + 折叠 ----------
export interface LayerRow {
  id: string;
  depth: number;
  hasChildren: boolean;
  collapsed: boolean;
}

/**
 * 把画板根下的节点树拍平成可渲染的行列表。
 * - keyword 非空时只保留「自身命中或后代命中」的分支（父链保留以便定位），且忽略折叠状态
 * - keyword 为空时按 collapsed 过滤子级
 */
export function buildLayerRows(
  board: Board,
  keyword = '',
  collapsed: Set<string> = new Set(),
): LayerRow[] {
  const root = board.nodes[board.rootId];
  if (!root) return [];
  const kw = keyword.trim().toLowerCase();
  const hit = (n: Node) => {
    if (!kw) return true;
    return n.name.toLowerCase().includes(kw) || n.type.toLowerCase().includes(kw);
  };
  const memo = new Map<string, boolean>();
  const hasHit = (id: string): boolean => {
    const n = board.nodes[id];
    if (!n) return false;
    if (memo.has(id)) return memo.get(id)!;
    const r = hit(n) || n.children.some(hasHit);
    memo.set(id, r);
    return r;
  };

  const out: LayerRow[] = [];
  const walk = (id: string, depth: number) => {
    const n = board.nodes[id];
    if (!n) return;
    if (kw && !hasHit(id)) return;
    const hasChildren = n.children.length > 0;
    const isCollapsed = !kw && collapsed.has(id);
    out.push({ id, depth, hasChildren, collapsed: isCollapsed });
    if (hasChildren && !isCollapsed) n.children.forEach(cid => walk(cid, depth + 1));
  };
  root.children.forEach(cid => walk(cid, 0));
  return out;
}
