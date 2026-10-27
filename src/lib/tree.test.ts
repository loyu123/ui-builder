// P1-3.1 · 树工具单测：容器命中（最深优先/exclude）、防自嵌套、子树集合、绝对原点
import { describe, it, expect } from 'vitest';
import { absOrigin, isSelfOrDescendant, findContainerAt, subtreeIds } from './tree';
import type { Board, Frame, Node } from '../types';

function mk(
  id: string, type: string, frame: Frame,
  parentId: string | null, children: string[] = [],
): Node {
  return {
    id, type, name: id, parentId, children, frame,
    style: {}, props: {}, events: {},
  };
}

// 结构：root ← card1(10,10,200,200) ← card2(20,20,100,100) ← btn(30,30,50,30)；root ← grp(300,300,80,80)
function board(): Board {
  const nodes: Record<string, Node> = {
    root: mk('root', 'page', { x: 0, y: 0, w: 390, h: 844 }, null, ['card1', 'grp']),
    card1: mk('card1', 'card', { x: 10, y: 10, w: 200, h: 200 }, 'root', ['card2']),
    card2: mk('card2', 'card', { x: 20, y: 20, w: 100, h: 100 }, 'card1', ['btn']),
    btn: mk('btn', 'button-primary', { x: 30, y: 30, w: 50, h: 30 }, 'card2'),
    grp: mk('grp', 'group', { x: 300, y: 300, w: 80, h: 80 }, 'root'),
  };
  return { device: 'mobile', frame: { w: 390, h: 844 }, rootId: 'root', nodes };
}

describe('lib/tree · 容器命中与子树', () => {
  it('findContainerAt：点在嵌套容器内返回最深层容器', () => {
    // 点 (35,35)：card1 内、card2 内（btn 非容器）→ card2 更深
    expect(findContainerAt(board(), { x: 35, y: 35 }, new Set())).toBe('card2');
  });

  it('findContainerAt：点在空白返回 null（落到画板根层）', () => {
    expect(findContainerAt(board(), { x: 380, y: 800 }, new Set())).toBeNull();
  });

  it('findContainerAt：exclude 命中的容器及候选被跳过', () => {
    expect(findContainerAt(board(), { x: 35, y: 35 }, new Set(['card2']))).toBe('card1');
    expect(findContainerAt(board(), { x: 35, y: 35 }, new Set(['card1', 'card2']))).toBeNull();
  });

  it('isSelfOrDescendant：自身为真、后代为真、无关节点为假', () => {
    const b = board();
    expect(isSelfOrDescendant(b, 'card1', 'card1')).toBe(true);
    expect(isSelfOrDescendant(b, 'card1', 'btn')).toBe(true);
    expect(isSelfOrDescendant(b, 'card1', 'grp')).toBe(false);
  });

  it('subtreeIds：含自身与全部后代，不含兄弟与根', () => {
    const s = subtreeIds(board(), 'card1');
    expect(s.has('card1')).toBe(true);
    expect(s.has('card2')).toBe(true);
    expect(s.has('btn')).toBe(true);
    expect(s.has('grp')).toBe(false);
    expect(s.has('root')).toBe(false);
  });

  it('absOrigin：沿父链累加（btn 绝对原点 = 10+20+30）', () => {
    const b = board();
    expect(absOrigin(b, 'btn')).toEqual({ x: 60, y: 60 });
    expect(absOrigin(b, 'card2')).toEqual({ x: 30, y: 30 });
    expect(absOrigin(b, 'root')).toEqual({ x: 0, y: 0 });
  });
});
