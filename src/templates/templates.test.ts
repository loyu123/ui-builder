// F2 · 模板库测试：清单完整性 / 结构合法 / 模块类型在注册表 / props 键不写错 / 实例独立
import { describe, it, expect } from 'vitest';
import { TEMPLATES, createFromTemplate } from './index';
import { REGISTRY_MAP } from '../modules/registry';
import { isValidProject } from '../types';

describe('templates · 内置模板库', () => {
  it('清单：至少 5 套、id 唯一、中英标签非空', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(5);
    expect(new Set(TEMPLATES.map(t => t.id)).size).toBe(TEMPLATES.length);
    for (const t of TEMPLATES) {
      expect(t.label.trim().length).toBeGreaterThan(0);
      expect(t.labelEn.trim().length).toBeGreaterThan(0);
    }
  });

  it.each(TEMPLATES.map(t => [t.id, t] as const))(
    '模板 %s：项目结构合法、模块类型都在注册表、树链完整',
    (_id, tpl) => {
      const p = tpl.build();
      expect(isValidProject(p)).toBe(true);
      expect(p.pages.length).toBeGreaterThanOrEqual(1);

      const board = p.pages[0].boards.mobile;
      const nodes = Object.values(board.nodes);
      expect(nodes.length).toBeGreaterThanOrEqual(5);         // 骨架至少 5 个模块（含根）

      for (const n of nodes) {
        expect(REGISTRY_MAP[n.type], `${tpl.id} 出现未注册类型 ${n.type}`).toBeTruthy();
        if (n.parentId) {
          const parent = board.nodes[n.parentId];
          expect(parent, `${tpl.id}/${n.type} 的父节点缺失`).toBeTruthy();
          expect(parent.children).toContain(n.id);
        }
      }
      // 根节点的子节点都在 nodes 里
      const root = board.nodes[board.rootId];
      for (const cid of root.children) expect(board.nodes[cid]).toBeTruthy();
    },
  );

  it.each(TEMPLATES.map(t => [t.id, t] as const))(
    '模板 %s：props 键必须是 registry 默认 props 或 props 字段（防写错键名，如把 label 写成 text）',
    (_id, tpl) => {
      const p = tpl.build();
      const board = p.pages[0].boards.mobile;
      for (const n of Object.values(board.nodes)) {
        const meta = REGISTRY_MAP[n.type];
        if (!meta) continue;
        const allowed = new Set([
          ...Object.keys(meta.props),
          ...meta.fields.filter(f => f.target === 'props').map(f => f.key),
        ]);
        for (const k of Object.keys(n.props)) {
          expect(allowed.has(k), `${tpl.id}/${n.type} 的 props.${k} 不在注册表定义里`).toBe(true);
        }
      }
    },
  );

  it('每个模块都带默认 onClick 事件占位（与 addNode 行为一致）', () => {
    for (const tpl of TEMPLATES) {
      const board = tpl.build().pages[0].boards.mobile;
      for (const n of Object.values(board.nodes)) {
        if (n.type === 'page') continue;
        expect(n.events?.onClick?.action).toBe('none');
      }
    }
  });

  it('createFromTemplate：已知 id 返回新实例（两次构建互不共享引用），未知 id 返回 null', () => {
    const a = createFromTemplate('login')!;
    const b = createFromTemplate('login')!;
    expect(a).toBeTruthy();
    expect(a.pages[0].boards.mobile.rootId).not.toBe(b.pages[0].boards.mobile.rootId);
    expect(createFromTemplate('nope')).toBeNull();
  });
});
