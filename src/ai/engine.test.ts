// P2-12 · AI 规则引擎单测：5 类规则各有正/反例，保证 evidence 数字与 patch 正确
import { describe, it, expect } from 'vitest';
import { runRules } from './engine';
import type { Board, Node } from '../types';

let seq = 0;
function node(p: Partial<Node> & { id?: string }): Node {
  seq++;
  return {
    id: p.id ?? `n${seq}`,
    type: 'heading',
    name: p.name ?? '模块',
    parentId: p.parentId ?? 'root',
    children: [],
    frame: p.frame ?? { x: 0, y: 0, w: 200, h: 40 },
    style: p.style ?? {},
    props: p.props ?? {},
    events: {},
  };
}

function boardOf(...nodes: Node[]): Board {
  const root: Node = {
    id: 'root', type: 'page', name: '页面', parentId: null,
    children: nodes.map(n => n.id),
    frame: { x: 0, y: 0, w: 390, h: 844 },
    style: {}, props: {}, events: {},
  };
  const dict: Record<string, Node> = { root };
  for (const n of nodes) dict[n.id] = n;
  return { device: 'mobile', frame: { w: 390, h: 844 }, rootId: 'root', nodes: dict };
}

describe('AI-01 · 规则引擎（R1~R5）', () => {
  it('R1 对齐：≤4px 偏差向多数值看齐并生成 setFrame 补丁', () => {
    const b = boardOf(
      node({ id: 'a', frame: { x: 100, y: 10, w: 120, h: 40 } }),
      node({ id: 'b', frame: { x: 100, y: 60, w: 120, h: 40 } }),
      node({ id: 'c', frame: { x: 103, y: 110, w: 120, h: 40 } }),   // x 偏 3px
    );
    const align = runRules(b).filter(s => s.rule === 'align' && s.id.includes('-x'));
    expect(align.length).toBe(1);
    expect(align[0].evidence['模块数']).toBe(1);
    const patch = align[0].patches[0];
    expect(patch.kind).toBe('setFrame');
    expect(patch.kind === 'setFrame' && patch.frame.x).toBe(100);   // 103 → 100
  });

  it('R1 反例：完全对齐的节点不报', () => {
    const b = boardOf(
      node({ frame: { x: 100, y: 10, w: 120, h: 40 } }),
      node({ frame: { x: 100, y: 60, w: 120, h: 40 } }),
    );
    expect(runRules(b).filter(s => s.rule === 'align')).toEqual([]);
  });

  it('R2 间距：非 8 倍数垂直间距建议就近收敛并给出补丁', () => {
    const b = boardOf(
      node({ id: 'a', frame: { x: 0, y: 0, w: 200, h: 40 } }),
      node({ id: 'b', frame: { x: 0, y: 53, w: 200, h: 40 } }),   // gap 13
      node({ id: 'c', frame: { x: 0, y: 106, w: 200, h: 40 } }),  // gap 13
    );
    const spacing = runRules(b).filter(s => s.rule === 'spacing');
    expect(spacing.length).toBe(1);   // 每组只报第一条
    expect(spacing[0].evidence['当前间距']).toBe(13);
    expect(spacing[0].evidence['建议间距']).toBe(16);
    const p = spacing[0].patches[0];
    expect(p.kind === 'setFrame' && p.frame.y).toBe(56);   // 53 + 3
  });

  it('R3 对比度：浅底深字不报，浅底浅字报并建议深色', () => {
    const ok = boardOf(node({ style: { color: '#1f2328', background: '#ffffff' } }));
    expect(runRules(ok).filter(s => s.rule === 'contrast')).toEqual([]);

    const bad = boardOf(node({ name: '浅字', style: { color: '#999999', background: '#ffffff' } }));
    const c = runRules(bad).filter(s => s.rule === 'contrast');
    expect(c.length).toBe(1);
    expect(c[0].evidence['建议色']).toBe('#1f2328');
    expect(c[0].patches[0]).toMatchObject({ kind: 'setStyle', key: 'color', value: '#1f2328' });
  });

  it('R4 层级：字号种类 >3 收敛到 24/16/13，≤3 不报', () => {
    const ok = boardOf(
      node({ type: 'heading', style: { fontSize: 24 } }),
      node({ type: 'heading', style: { fontSize: 16 } }),
      node({ type: 'heading', style: { fontSize: 13 } }),
      node({ type: 'heading', style: { fontSize: 24 } }),
    );
    expect(runRules(ok).filter(s => s.rule === 'hierarchy')).toEqual([]);

    const bad = boardOf(
      node({ type: 'heading', style: { fontSize: 12 } }),
      node({ type: 'heading', style: { fontSize: 18 } }),
      node({ type: 'heading', style: { fontSize: 26 } }),
      node({ type: 'heading', style: { fontSize: 31 } }),
    );
    const h = runRules(bad).filter(s => s.rule === 'hierarchy');
    expect(h.length).toBe(1);
    expect(h[0].evidence['字号种类']).toBe(4);
    expect(h[0].patches.length).toBe(4);   // 12/18/26/31 都不在 24/16/13 内
    const targets = h[0].patches.map(p => (p.kind === 'setStyle' ? p.value : 0)).sort((a, b) => (a as number) - (b as number));
    expect(targets).toEqual([13, 16, 24, 24]);   // 就近收敛
  });

  it('R5 文案长度：估算宽超模块宽 15% 报溢出，否则不报', () => {
    const bad = boardOf(node({
      name: '长标题',
      props: { text: '一个特别特别特别长的标题文案' },   // 14 字 × 14px = 196px
      frame: { x: 0, y: 0, w: 100, h: 40 },
    }));
    const s = runRules(bad).filter(s2 => s2.rule === 'length');
    expect(s.length).toBe(1);
    expect(s[0].evidence['字数']).toBe(14);

    const ok = boardOf(node({ props: { text: '短标题' }, frame: { x: 0, y: 0, w: 200, h: 40 } }));
    expect(runRules(ok).filter(s2 => s2.rule === 'length')).toEqual([]);
  });

  it('空画板（只有页面根）返回空建议', () => {
    expect(runRules(boardOf())).toEqual([]);
  });
});
