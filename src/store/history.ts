// history 切片（B1 拆分）：ST-02 快照入栈（400ms 内同 tag 合并）+ undo/redo + 操作记录
import type { StoreApi } from 'zustand';
import { scheduleSave } from './project';
import type { Store } from './types';

type Set = StoreApi<Store>['setState'];
type Get = StoreApi<Store>['getState'];

// 操作记录标签（AI 助手"操作记录"展示用）
const TAG_LABEL: Record<string, string> = {
  add: '拖入模块', drag: '移动模块', resize: '调整尺寸', prop: '修改属性', style: '修改样式',
  frame: '修改位置尺寸', delete: '删除模块', paste: '粘贴模块', page: '新建页面', 'page-del': '删除页面',
  'copy-board': '复制设备设计', reorder: '调整图层顺序', flag: '显隐/锁定', clear: '清空画板', 'ai-apply': '应用 AI 建议', rotate: '旋转模块',
};

export function makeHistory(set: Set, get: Get) {
  return {
    // ST-02 · 快照入栈 + 操作记录
    pushHistory: (tag?: string) => {
      const s = get();
      const now = Date.now();
      const label = TAG_LABEL[tag ?? ''] ?? '操作';
      if (tag && tag === s.history.lastTag && now - s.history.lastAt < 400) {
        set({ history: { ...s.history, lastAt: now } });
        return;
      }
      set({
        history: {
          past: [...s.history.past.slice(-49), structuredClone(s.project.pages)],
          future: [],
          lastTag: tag ?? '',
          lastAt: now,
          log: [label, ...s.history.log].slice(0, 6),
        },
      });
    },

    undo: () => {
      const s = get();
      if (!s.history.past.length) return;
      const prev = s.history.past[s.history.past.length - 1];
      set({
        project: { ...s.project, pages: structuredClone(prev) },
        history: {
          past: s.history.past.slice(0, -1),
          future: [...s.history.future, structuredClone(s.project.pages)],
          lastTag: '', lastAt: 0,
          log: ['撤销', ...s.history.log].slice(0, 6),
        },
        editor: { ...s.editor, selection: [] },
      });
      scheduleSave(get().project);
    },

    redo: () => {
      const s = get();
      if (!s.history.future.length) return;
      const next = s.history.future[s.history.future.length - 1];
      set({
        project: { ...s.project, pages: structuredClone(next) },
        history: {
          past: [...s.history.past, structuredClone(s.project.pages)],
          future: s.history.future.slice(0, -1),
          lastTag: '', lastAt: 0,
          log: ['重做', ...s.history.log].slice(0, 6),
        },
        editor: { ...s.editor, selection: [] },
      });
      scheduleSave(get().project);
    },
  };
}
