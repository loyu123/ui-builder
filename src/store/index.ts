// ST-01 + ST-02 · zustand + immer：project / editor / history 切片
// 撤销采用整步快照（deep clone pages），上限 50 步；拖动 400ms 内合并为一步
import { create } from 'zustand';
import { produce } from 'immer';
import { uid } from '../lib/id';
import { loadProject, saveProject, migrate } from '../lib/persist';
import { subtreeIds } from '../lib/tree';
import { REGISTRY_MAP } from '../modules/registry';
import type { Board, DeviceId, Frame, Node, Page, Project } from '../types';

export const DEVICES: Record<DeviceId, { label: string; w: number; h: number }> = {
  desktop: { label: '电脑', w: 1440, h: 900 },
  mobile: { label: '手机', w: 390, h: 844 },
  watch: { label: '手表', w: 200, h: 242 },
};

function emptyBoard(device: DeviceId): Board {
  const rootId = uid('n');
  const d = DEVICES[device];
  const root: Node = {
    id: rootId, type: 'page', name: '页面', parentId: null, children: [],
    frame: { x: 0, y: 0, w: d.w, h: d.h },
    style: { background: '#ffffff' }, props: {}, events: {},
  };
  return { device, frame: { w: d.w, h: d.h }, rootId, nodes: { [rootId]: root } };
}

function emptyProject(): Project {
  const page: Page = {
    id: uid('pg'), name: '登录页',
    boards: { desktop: emptyBoard('desktop'), mobile: emptyBoard('mobile'), watch: emptyBoard('watch') },
  };
  return {
    id: uid('p'), name: '我的原型', schemaVersion: 1,
    createdAt: new Date().toISOString(),
    pages: [page],
    theme: {
      colors: { primary: '#f97316', bg: '#ffffff', text: '#1f2328', muted: '#6b7280' },
      radius: { sm: 6, md: 10, pill: 999 },
      font: { family: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif', base: 14 },
    },
  };
}

type PagesSnapshot = Page[];

interface HistorySlice {
  past: PagesSnapshot[];
  future: PagesSnapshot[];
  lastTag: string;      // 合并用：同一手势（如拖动）300ms 内只压一次栈
  lastAt: number;
}

interface EditorSlice {
  currentPageId: string;
  currentDevice: DeviceId;
  selection: string[];
  zoom: number;
  pan: { x: number; y: number };
  clipboard: Array<{ rootId: string; subtree: Record<string, Node> }>;
}

interface Actions {
  pushHistory: (tag?: string) => void;
  undo: () => void;
  redo: () => void;
  addNode: (type: string, frame: Frame, parentId?: string) => void;
  moveNode: (id: string, x: number, y: number, newParentId?: string | null) => void;
  resizeNode: (id: string, frame: Frame) => void;
  setProp: (id: string, key: string, value: unknown) => void;
  setStyle: (id: string, key: string, value: string | number) => void;
  setFrameField: (id: string, key: 'x' | 'y' | 'w' | 'h', value: number) => void;
  deleteNode: (id: string) => void;
  select: (ids: string[]) => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  setDevice: (d: DeviceId) => void;
  setPage: (id: string) => void;
  setZoom: (z: number) => void;
  setPan: (p: { x: number; y: number }) => void;
  addPage: () => void;
  renamePage: (id: string, name: string) => void;
  deletePage: (id: string) => void;
  copyBoardFrom: (from: DeviceId) => void;
  setNodeFlag: (id: string, key: 'locked' | 'hidden', value: boolean) => void;
  setNodeName: (id: string, name: string) => void;
  setProjectName: (name: string) => void;
  reorderNode: (id: string, to: 'front' | 'back' | 'forward' | 'backward') => void;
  importProject: (json: string) => boolean;
  hydrate: () => Promise<void>;
}

interface Store {
  project: Project;
  editor: EditorSlice;
  history: HistorySlice;
  actions: Actions;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSave(p: Project) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void saveProject(p), 1000);
}

function pick(draft: Project, pageId: string, device: DeviceId) {
  const page = draft.pages.find(pg => pg.id === pageId) ?? draft.pages[0];
  return { page, board: page.boards[device] };
}

export const useStore = create<Store>((set, get) => ({
  project: emptyProject(),
  editor: {
    currentPageId: '', currentDevice: 'mobile',
    selection: [], zoom: 1, pan: { x: 24, y: 24 }, clipboard: [],
  },
  history: { past: [], future: [], lastTag: '', lastAt: 0 },

  actions: {
    // ST-02 · 快照入栈（300ms 内同 tag 合并，拖动手势只算一步）
    pushHistory: tag => {
      const s = get();
      const now = Date.now();
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
        },
        editor: { ...s.editor, selection: [] },
      });
      scheduleSave(get().project);
    },

    // CV-02/06 · 拖入画布或容器
    addNode: (type, frame, parentId) => {
      const s = get();
      s.actions.pushHistory('add');
      const p = produce(s.project, draft => {
        const { board } = pick(draft, s.editor.currentPageId, s.editor.currentDevice);
        const meta = REGISTRY_MAP[type];
        const id = uid('n');
        const pid = parentId ?? board.rootId;
        const node: Node = {
          id, type,
          name: meta?.label ?? type,
          parentId: pid,
          children: [],
          frame,
          style: { ...(meta?.style ?? {}) },
          props: JSON.parse(JSON.stringify(meta?.props ?? {})),
          events: { onClick: { action: 'none', note: '占位，后续接真实行为' } },
        };
        board.nodes[id] = node;
        board.nodes[pid].children.push(id);
      });
      scheduleSave(p);
      set({ project: p, editor: { ...s.editor, selection: [] } });
    },

    // CV-04/06 · 提交位置；newParentId 不同则重挂载
    moveNode: (id, x, y, newParentId) => {
      const s = get();
      s.actions.pushHistory('drag');
      const p = produce(s.project, draft => {
        const { board } = pick(draft, s.editor.currentPageId, s.editor.currentDevice);
        const n = board.nodes[id];
        if (!n || !n.parentId) return;
        n.frame.x = Math.round(x);
        n.frame.y = Math.round(y);
        if (newParentId && newParentId !== n.parentId) {
          const old = board.nodes[n.parentId];
          old.children = old.children.filter(c => c !== id);
          board.nodes[newParentId].children.push(id);
          n.parentId = newParentId;
        }
      });
      scheduleSave(p);
      set({ project: p });
    },

    // CV-05 · 提交尺寸
    resizeNode: (id, frame) => {
      const s = get();
      s.actions.pushHistory('resize');
      const p = produce(s.project, draft => {
        const { board } = pick(draft, s.editor.currentPageId, s.editor.currentDevice);
        const n = board.nodes[id];
        if (n && n.parentId) {
          n.frame = {
            x: Math.round(frame.x), y: Math.round(frame.y),
            w: Math.round(frame.w), h: Math.round(frame.h),
          };
        }
      });
      scheduleSave(p);
      set({ project: p });
    },

    // PP-02/03 · 属性面板写入
    setProp: (id, key, value) => {
      const s = get();
      s.actions.pushHistory('prop');
      const p = produce(s.project, draft => {
        const { board } = pick(draft, s.editor.currentPageId, s.editor.currentDevice);
        const n = board.nodes[id];
        if (n) n.props[key] = value;
      });
      scheduleSave(p);
      set({ project: p });
    },

    setStyle: (id, key, value) => {
      const s = get();
      s.actions.pushHistory('style');
      const p = produce(s.project, draft => {
        const { board } = pick(draft, s.editor.currentPageId, s.editor.currentDevice);
        const n = board.nodes[id];
        if (n) n.style[key] = value;
      });
      scheduleSave(p);
      set({ project: p });
    },

    setFrameField: (id, key, value) => {
      const s = get();
      s.actions.pushHistory('frame');
      const p = produce(s.project, draft => {
        const { board } = pick(draft, s.editor.currentPageId, s.editor.currentDevice);
        const n = board.nodes[id];
        if (n) n.frame[key] = Math.round(value);
      });
      scheduleSave(p);
      set({ project: p });
    },

    // CV-03 · 删除子树
    deleteNode: id => {
      const s = get();
      s.actions.pushHistory('delete');
      const p = produce(s.project, draft => {
        const { board } = pick(draft, s.editor.currentPageId, s.editor.currentDevice);
        const n = board.nodes[id];
        if (!n || !n.parentId) return;
        const parent = board.nodes[n.parentId];
        parent.children = parent.children.filter(c => c !== id);
        const stack = [id];
        while (stack.length) {
          const cur = stack.pop()!;
          const node = board.nodes[cur];
          if (!node) continue;
          stack.push(...node.children);
          delete board.nodes[cur];
        }
      });
      scheduleSave(p);
      set({ project: p, editor: { ...s.editor, selection: [] } });
    },

    select: ids => set(s => ({ editor: { ...s.editor, selection: ids } })),

    copySelection: () => {
      const s = get();
      const page = s.project.pages.find(pg => pg.id === s.editor.currentPageId) ?? s.project.pages[0];
      const board = page.boards[s.editor.currentDevice];
      const clipboard = s.editor.selection
        .filter(id => board.nodes[id])
        .map(id => {
          const subtree: Record<string, Node> = {};
          for (const nid of subtreeIds(board, id)) {
            subtree[nid] = JSON.parse(JSON.stringify(board.nodes[nid]));
          }
          return { rootId: id, subtree };
        });
      set({ editor: { ...s.editor, clipboard } });
    },

    pasteClipboard: () => {
      const s = get();
      if (!s.editor.clipboard.length) return;
      s.actions.pushHistory('paste');
      let newSel: string[] = [];
      const p = produce(s.project, draft => {
        const { board } = pick(draft, s.editor.currentPageId, s.editor.currentDevice);
        newSel = [];
        for (const clip of s.editor.clipboard) {
          const idMap: Record<string, string> = {};
          for (const oldId of Object.keys(clip.subtree)) idMap[oldId] = uid('n');
          for (const [oldId, src] of Object.entries(clip.subtree)) {
            const copy: Node = JSON.parse(JSON.stringify(src));
            copy.id = idMap[oldId];
            copy.parentId = oldId === clip.rootId
              ? board.rootId
              : (idMap[copy.parentId as string] ?? board.rootId);
            if (oldId === clip.rootId) { copy.frame.x += 8; copy.frame.y += 8; }
            copy.children = src.children.map(c => idMap[c]).filter(Boolean);
            board.nodes[copy.id] = copy;
          }
          board.nodes[board.rootId].children.push(idMap[clip.rootId]);
          newSel.push(idMap[clip.rootId]);
        }
      });
      scheduleSave(p);
      set({ project: p, editor: { ...s.editor, selection: newSel } });
    },

    setDevice: d => set(s => ({ editor: { ...s.editor, currentDevice: d, selection: [] } })),
    setPage: id => set(s => ({ editor: { ...s.editor, currentPageId: id, selection: [] } })),
    setZoom: z => set(s => ({ editor: { ...s.editor, zoom: Math.min(2, Math.max(0.25, z)) } })),
    setPan: p => set(s => ({ editor: { ...s.editor, pan: p } })),

    // WS-04 · 页面管理
    addPage: () => {
      const s = get();
      s.actions.pushHistory('page');
      const id = uid('pg');
      const p = produce(s.project, draft => {
        draft.pages.push({
          id, name: `页面 ${draft.pages.length + 1}`,
          boards: { desktop: emptyBoard('desktop'), mobile: emptyBoard('mobile'), watch: emptyBoard('watch') },
        });
      });
      scheduleSave(p);
      set({ project: p, editor: { ...s.editor, currentPageId: id, selection: [] } });
    },

    renamePage: (id, name) => {
      const s = get();
      const p = produce(s.project, draft => {
        const pg = draft.pages.find(x => x.id === id);
        if (pg && name.trim()) pg.name = name.trim();
      });
      scheduleSave(p);
      set({ project: p });
    },

    deletePage: id => {
      const s = get();
      if (s.project.pages.length <= 1) return;
      s.actions.pushHistory('page-del');
      const p = produce(s.project, draft => {
        draft.pages = draft.pages.filter(pg => pg.id !== id);
      });
      scheduleSave(p);
      const currentPageId = p.pages.some(pg => pg.id === s.editor.currentPageId)
        ? s.editor.currentPageId : p.pages[0].id;
      set({ project: p, editor: { ...s.editor, currentPageId, selection: [] } });
    },

    // DV-04 · 复制某设备画板设计到当前设备
    copyBoardFrom: from => {
      const s = get();
      if (from === s.editor.currentDevice) return;
      s.actions.pushHistory('copy-board');
      const p = produce(s.project, draft => {
        const { page, board } = pick(draft, s.editor.currentPageId, s.editor.currentDevice);
        const src = page.boards[from];
        board.nodes = JSON.parse(JSON.stringify(src.nodes));
        board.rootId = src.rootId;
      });
      scheduleSave(p);
      set({ project: p, editor: { ...s.editor, selection: [] } });
    },

    // PP-03 · 显隐 / 锁定
    setNodeFlag: (id, key, value) => {
      const s = get();
      s.actions.pushHistory('flag');
      const p = produce(s.project, draft => {
        const { board } = pick(draft, s.editor.currentPageId, s.editor.currentDevice);
        const n = board.nodes[id];
        if (n) n[key] = value;
      });
      scheduleSave(p);
      set({ project: p });
    },

    // PP-02 · 节点名称（图层名）
    setNodeName: (id, name) => {
      const s = get();
      const p = produce(s.project, draft => {
        const { board } = pick(draft, s.editor.currentPageId, s.editor.currentDevice);
        const n = board.nodes[id];
        if (n && name.trim()) n.name = name.trim();
      });
      scheduleSave(p);
      set({ project: p });
    },

    // 项目名称（顶栏）
    setProjectName: name => {
      const s = get();
      const p = produce(s.project, draft => {
        if (name.trim()) draft.name = name.trim();
      });
      scheduleSave(p);
      set({ project: p });
    },

    // PP-02/03 · 图层顺序：置顶/上移/下移/置底（兄弟之间）
    reorderNode: (id, to) => {
      const s = get();
      s.actions.pushHistory('reorder');
      const p = produce(s.project, draft => {
        const { board } = pick(draft, s.editor.currentPageId, s.editor.currentDevice);
        const n = board.nodes[id];
        if (!n || !n.parentId) return;
        const arr = board.nodes[n.parentId].children;
        const i = arr.indexOf(id);
        if (i < 0) return;
        arr.splice(i, 1);
        const j = to === 'front' ? arr.length : to === 'back' ? 0 : to === 'forward' ? Math.min(arr.length, i + 1) : Math.max(0, i - 1);
        arr.splice(j, 0, id);
      });
      scheduleSave(p);
      set({ project: p });
    },

    // ST-05 · 导入 JSON（含校验与迁移；失败返回 false 不白屏）
    importProject: json => {
      try {
        const raw = JSON.parse(json);
        if (!raw || typeof raw !== 'object' || !Array.isArray(raw.pages)) return false;
        const migrated = migrate(raw as Project);
        set({
          project: migrated,
          editor: { ...get().editor, currentPageId: migrated.pages[0].id, selection: [] },
        });
        scheduleSave(get().project);
        return true;
      } catch (e) {
        console.error('[import] 导入失败', e);
        return false;
      }
    },

    hydrate: async () => {
      const saved = await loadProject();
      const project = saved ?? emptyProject();
      set(s => ({
        project,
        editor: { ...s.editor, currentPageId: project.pages[0].id },
      }));
    },
  },
}));
