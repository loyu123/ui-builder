// SS-01 · 批量落地：同一事务写入 + 单条历史 + 落地后选中
import { describe, it, expect } from 'vitest';
import { useStore, createEmptyProject } from '../store';
import { insertSpecs } from './builders';
import type { NodeSpec } from './builders';

const specs: NodeSpec[] = [
  { type: 'heading', frame: { x: 24, y: 40, w: 200, h: 34 }, props: { text: '欢迎回来' } },
  { type: 'button-primary', frame: { x: 24, y: 300, w: 342, h: 48 }, props: { label: '登 录' } },
  { type: 'group', frame: { x: 0, y: 0, w: 100, h: 60 }, style: { border: '1px dashed #94a3b8' }, name: '未知模块' },
];

describe('SS-01 · 批量落地', () => {
  it('insertSpecs 按顺序挂到根、并复用 registry 默认 props', () => {
    useStore.setState({ project: createEmptyProject() });
    const board = useStore.getState().project.pages[0].boards.mobile;
    const nodes = insertSpecs(board, specs);
    expect(nodes).toHaveLength(3);
    const root = board.nodes[board.rootId];
    expect(root.children).toEqual(nodes.map(n => n.id));
    // registry 默认 props 打底 + 覆盖
    expect(nodes[1].props).toMatchObject({ label: '登 录' });
    expect(nodes[2].name).toBe('未知模块');
  });

  it('addNodesTree 一次写入并在一次撤销内全撤', () => {
    useStore.setState({ project: createEmptyProject(), history: { past: [], future: [], lastTag: '', lastAt: 0, log: [] } });
    const a = useStore.getState().actions;
    const before = Object.keys(useStore.getState().project.pages[0].boards.mobile.nodes).length;

    const n = a.addNodesTree(specs);
    expect(n).toBe(3);
    const boardAfter = useStore.getState().project.pages[0].boards.mobile;
    expect(Object.keys(boardAfter.nodes)).toHaveLength(before + 3);
    expect(useStore.getState().editor.selection).toHaveLength(3);

    a.undo();
    const boardUndone = useStore.getState().project.pages[0].boards.mobile;
    expect(Object.keys(boardUndone.nodes)).toHaveLength(before);   // 一次撤销全部回退
  });

  it('空数组不写历史、不报错', () => {
    useStore.setState({ project: createEmptyProject(), history: { past: [], future: [], lastTag: '', lastAt: 0, log: [] } });
    const a = useStore.getState().actions;
    expect(a.addNodesTree([])).toBe(0);
    expect(useStore.getState().history.past).toHaveLength(0);
  });
});
