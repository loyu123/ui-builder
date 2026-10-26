// ST-01 · zustand + immer：project / editor 两个切片（v0 精简版）
// history / ai 切片 W3/W4 再加
import { create } from 'zustand';
import { produce } from 'immer';
import { uid } from '../lib/id';
import { loadProject, saveProject } from '../lib/persist';
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

interface EditorSlice {
  currentPageId: string;
  currentDevice: DeviceId;
  selection: string[];
  zoom: number;
}

interface Actions {
  addNode: (type: string, frame: Frame) => void;
  moveNode: (id: string, x: number, y: number) => void;
  resizeNode: (id: string, frame: Frame) => void;
  select: (ids: string[]) => void;
  setDevice: (d: DeviceId) => void;
  setPage: (id: string) => void;
  hydrate: () => Promise<void>;
}

interface Store {
  project: Project;
  editor: EditorSlice;
  actions: Actions;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSave(p: Project) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void saveProject(p), 1000);
}

export const useStore = create<Store>((set, get) => ({
  project: emptyProject(),
  editor: { currentPageId: '', currentDevice: 'mobile', selection: [], zoom: 1 },

  actions: {
    // CV-02 · 拖入画布：按落点创建节点
    addNode: (type, frame) => {
      const s = get();
      const p = produce(s.project, draft => {
        const page = draft.pages.find(pg => pg.id === s.editor.currentPageId) ?? draft.pages[0];
        const board = page.boards[s.editor.currentDevice];
        const meta = NODE_DEFAULTS[type];
        const id = uid('n');
        const node: Node = {
          id, type,
          name: meta?.label ?? type,
          parentId: board.rootId,
          children: [],
          frame,
          style: { ...(meta?.style ?? {}) },
          props: JSON.parse(JSON.stringify(meta?.props ?? {})),
          events: { onClick: { action: 'none', note: '占位，后续接真实行为' } },
        };
        board.nodes[id] = node;
        board.nodes[board.rootId].children.push(id);
      });
      scheduleSave(p);
      set({ project: p, editor: { ...s.editor, selection: [] } });
    },

    // CV-04 简化版 · pointerup 时提交最终位置
    moveNode: (id, x, y) => {
      const s = get();
      const p = produce(s.project, draft => {
        const page = draft.pages.find(pg => pg.id === s.editor.currentPageId) ?? draft.pages[0];
        const board = page.boards[s.editor.currentDevice];
        const n = board.nodes[id];
        if (n && n.parentId) {
          n.frame.x = Math.round(x);
          n.frame.y = Math.round(y);
        }
      });
      scheduleSave(p);
      set({ project: p });
    },

    // CV-05 · pointerup 时提交最终尺寸与位置
    resizeNode: (id, frame) => {
      const s = get();
      const p = produce(s.project, draft => {
        const page = draft.pages.find(pg => pg.id === s.editor.currentPageId) ?? draft.pages[0];
        const board = page.boards[s.editor.currentDevice];
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

    select: ids => set(s => ({ editor: { ...s.editor, selection: ids } })),

    setDevice: d => set(s => ({ editor: { ...s.editor, currentDevice: d, selection: [] } })),
    setPage: id => set(s => ({ editor: { ...s.editor, currentPageId: id, selection: [] } })),

    hydrate: async () => {
      const saved = await loadProject();
      const project = saved ?? emptyProject();
      set(s => ({
        project,
        editor: { ...s.editor, currentPageId: project.pages[0].id },
      }));
      void get();
    },
  },
}));

// 模块默认值（v0 的 5 类；LB-01 注册表 W3 扩成完整注册表）
export interface ModuleDefault {
  label: string;
  w: number; h: number;
  props: Record<string, unknown>;
  style: Record<string, string | number>;
}
export const NODE_DEFAULTS: Record<string, ModuleDefault> = {
  'button-primary': {
    label: '主按钮', w: 200, h: 48,
    props: { label: '登录' },
    style: { background: '#f97316', color: '#ffffff', radius: 8, fontSize: 16, fontWeight: 600 },
  },
  heading: {
    label: '标题', w: 200, h: 34,
    props: { text: '欢迎回来' },
    style: { fontSize: 22, fontWeight: 700, color: '#1f2328' },
  },
  paragraph: {
    label: '正文段落', w: 240, h: 48,
    props: { text: '这里是一段说明文字。' },
    style: { fontSize: 14, color: '#6b7280' },
  },
  input: {
    label: '单行输入框', w: 260, h: 48,
    props: { label: '手机号', placeholder: '请输入手机号' },
    style: { radius: 8, border: '1px solid #e5e7eb', background: '#ffffff', fontSize: 14 },
  },
  card: {
    label: '卡片', w: 280, h: 160,
    props: {},
    style: { background: '#ffffff', radius: 12, border: '1px solid #e5e7eb' },
  },
};
