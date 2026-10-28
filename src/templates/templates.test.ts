// F2 · 模板库测试：清单完整性 / 结构合法 / 模块类型在注册表 / props 键不写错 / 实例独立
// v1.2.1 · 每套模板都要求「手机 + 电脑」两套布局，且都通过同样的校验
import { describe, it, expect } from 'vitest';
import { TEMPLATES, createFromTemplate } from './index';
import { REGISTRY_MAP } from '../modules/registry';
import { isValidProject } from '../types';
import type { Board } from '../types';

const boardsOf = (p: ReturnType<typeof TEMPLATES[number]['build']>): Array<[string, Board]> =>
  (['mobile', 'desktop'] as const).map(d => [d, p.pages[0].boards[d]]);

describe('templates · 内置模板库', () => {
  it('清单：至少 5 套、id 唯一、中英标签非空、都声明了手机与电脑布局', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(5);
    expect(new Set(TEMPLATES.map(t => t.id)).size).toBe(TEMPLATES.length);
    for (const t of TEMPLATES) {
      expect(t.label.trim().length).toBeGreaterThan(0);
      expect(t.labelEn.trim().length).toBeGreaterThan(0);
      expect(t.devices).toContain('mobile');
      expect(t.devices).toContain('desktop');
    }
  });

  it.each(TEMPLATES.map(t => [t.id, t] as const))(
    '模板 %s：项目结构合法，手机与电脑画板都有完整模块树',
    (_id, tpl) => {
      const p = tpl.build();
      expect(isValidProject(p)).toBe(true);
      expect(p.pages.length).toBeGreaterThanOrEqual(1);

      for (const [device, board] of boardsOf(p)) {
        const nodes = Object.values(board.nodes);
        expect(nodes.length, `${tpl.id}/${device} 模块太少`).toBeGreaterThanOrEqual(6);

        for (const n of nodes) {
          expect(REGISTRY_MAP[n.type], `${tpl.id}/${device} 出现未注册类型 ${n.type}`).toBeTruthy();
          if (n.parentId) {
            const parent = board.nodes[n.parentId];
            expect(parent, `${tpl.id}/${device}/${n.type} 的父节点缺失`).toBeTruthy();
            expect(parent.children).toContain(n.id);
          }
        }
        const root = board.nodes[board.rootId];
        for (const cid of root.children) expect(board.nodes[cid]).toBeTruthy();
      }
    },
  );

  it.each(TEMPLATES.map(t => [t.id, t] as const))(
    '模板 %s：props 键必须是 registry 默认 props 或 props 字段（防写错键名，如把 label 写成 text）',
    (_id, tpl) => {
      const p = tpl.build();
      for (const [device, board] of boardsOf(p)) {
        for (const n of Object.values(board.nodes)) {
          const meta = REGISTRY_MAP[n.type];
          if (!meta) continue;
          const allowed = new Set([
            ...Object.keys(meta.props),
            ...meta.fields.filter(f => f.target === 'props').map(f => f.key),
          ]);
          for (const k of Object.keys(n.props)) {
            expect(allowed.has(k), `${tpl.id}/${device}/${n.type} 的 props.${k} 不在注册表定义里`).toBe(true);
          }
        }
      }
    },
  );

  it('嵌套模块的父节点必须是注册表里的容器类型（card / group）', () => {
    for (const tpl of TEMPLATES) {
      const p = tpl.build();
      for (const [, board] of boardsOf(p)) {
        for (const n of Object.values(board.nodes)) {
          if (!n.parentId || n.parentId === board.rootId) continue;
          const parent = board.nodes[n.parentId];
          expect(REGISTRY_MAP[parent.type]?.isContainer, `${tpl.id}/${n.type} 挂在非容器 ${parent.type} 上`).toBe(true);
        }
      }
    }
  });

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
    expect(a.pages[0].boards.desktop.rootId).not.toBe(b.pages[0].boards.desktop.rootId);
    expect(createFromTemplate('nope')).toBeNull();
  });
});
