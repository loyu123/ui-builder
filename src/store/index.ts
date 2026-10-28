// ST-01 + ST-02 · zustand 组合层（B1 拆分后）
// project/project.ts（工厂+持久化调度）· history.ts（撤销栈）· editor.ts（编辑态）· actions.ts（业务动作）
// 外部 API 不变：useStore / DEVICES / createEmptyProject
import { create } from 'zustand';
import { emptyProject } from './project';
import { initialEditor } from './editor';
import { makeActions } from './actions';
import type { Store } from './types';

export const useStore = create<Store>((set, get) => ({
  project: emptyProject(),
  editor: initialEditor,
  history: { past: [], future: [], lastTag: '', lastAt: 0, log: [] },
  projects: { list: [], currentId: null, busy: false },   // F1 · 多项目索引快照（hydrate 后填充）
  actions: makeActions(set, get),
}));

export { DEVICES, createEmptyProject } from './project';
export type { Store, EditorSlice, HistorySlice, Actions } from './types';
