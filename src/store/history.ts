// history 切片（B1 拆分）：ST-02 快照入栈（400ms 内同 tag 合并）+ undo/redo + 操作记录
// P1-07 · 分级快照：页面级操作（新建/删除页）拍全量 pages；其余只拍当前画板 board
import { produce } from 'immer';
import type { StoreApi } from 'zustand';
import { scheduleSave } from './project';
import type { HistorySnap, Store } from './types';

type Set = StoreApi<Store>['setState'];
type Get = StoreApi<Store>['getState'];

// 操作记录标签（AI 助手"操作记录"展示用）
const TAG_LABEL: Record<string, string> = {
  add: '拖入模块', drag: '移动模块', resize: '调整尺寸', prop: '修改属性', style: '修改样式',
  frame: '修改位置尺寸', delete: '删除模块', paste: '粘贴模块', page: '新建页面', 'page-del': '删除页面',
  'copy-board': '复制设备设计', reorder: '调整图层顺序', flag: '显隐/锁定', clear: '清空画板', 'ai-apply': '应用 AI 建议', rotate: '旋转模块', align: '批量对齐',
};

// 按操作类型决定快照粒度
function takeSnapshot(s: Store, tag?: string): HistorySnap {
  if (tag === 'page' || tag === 'page-del') {
    return { kind: 'full', pages: structuredClone(s.project.pages) };
  }
  const page = s.project.pages.find(pg => pg.id === s.editor.currentPageId) ?? s.project.pages[0];
  const device = s.editor.currentDevice;
  return { kind: 'board', pageId: page.id, device, board: structuredClone(page.boards[device]) };
}

// 把快照恢复进当前 project（board 粒度只替换对应页对应设备的画板）
function applySnapshot(s: Store, snap: HistorySnap) {
  if (snap.kind === 'full') {
    return { ...s.project, pages: structuredClone(snap.pages) };
  }
  return produce(s.project, d => {
    const pg = d.pages.find(p => p.id === snap.pageId) ?? d.pages[0];
    pg.boards[snap.device] = structuredClone(snap.board);
  });
}

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
          past: [...s.history.past.slice(-49), takeSnapshot(s, tag)],
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
      const snap = s.history.past[s.history.past.length - 1];
      set({
        project: applySnapshot(s, snap),
        history: {
          past: s.history.past.slice(0, -1),
          // 反向帧记录"现在"，用全量保证任意操作序列可正确重做
          future: [...s.history.future, { kind: 'full' as const, pages: structuredClone(s.project.pages) }],
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
      const snap = s.history.future[s.history.future.length - 1];
      set({
        project: applySnapshot(s, snap),
        history: {
          past: [...s.history.past, { kind: 'full' as const, pages: structuredClone(s.project.pages) }],
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
