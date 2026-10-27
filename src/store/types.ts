// store 切片类型定义（B1 拆分）：状态切片与动作接口集中在此，避免循环依赖
import type { DeviceId, EventSpec, Frame, Node, Page, Project, ThemeTokens } from '../types';

export type PagesSnapshot = Page[];

export interface HistorySlice {
  past: PagesSnapshot[];
  future: PagesSnapshot[];
  lastTag: string;      // 合并用：同一手势（如拖动）400ms 内只压一次栈
  lastAt: number;
  log: string[];        // AI 助手"操作记录"（最近 6 条标签）
}

export interface EditorSlice {
  currentPageId: string;
  currentDevice: DeviceId;
  selection: string[];
  zoom: number;
  pan: { x: number; y: number };
  clipboard: Array<{ rootId: string; subtree: Record<string, Node> }>;
}

export interface Actions {
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
  clearBoard: () => void;
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
  setNodeEvent: (id: string, ev: string, spec: EventSpec) => void;
  updateTheme: (patch: {
    colors?: Record<string, string>;
    radius?: Record<string, number>;
    font?: Partial<ThemeTokens['font']>;
  }) => void;
  setNodeNote: (id: string, note: string) => void;
  setNodePos: (id: string, pos: string) => void;
  setNodeName: (id: string, name: string) => void;
  setProjectName: (name: string) => void;
  reorderNode: (id: string, to: 'front' | 'back' | 'forward' | 'backward') => void;
  importProject: (json: string) => boolean;
  hydrate: () => Promise<void>;
}

export interface Store {
  project: Project;
  editor: EditorSlice;
  history: HistorySlice;
  actions: Actions;
}
