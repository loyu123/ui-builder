// project 切片（B1 拆分）：项目/画板工厂 + 当前页画板定位 + 防抖持久化
import { uid } from '../lib/id';
import { saveProject } from '../lib/persist';
import type { Board, DeviceId, Node, Page, Project } from '../types';

export const DEVICES: Record<DeviceId, { label: string; w: number; h: number }> = {
  desktop: { label: '电脑', w: 1440, h: 900 },
  mobile: { label: '手机', w: 390, h: 844 },
  watch: { label: '手表', w: 200, h: 242 },
};

export function emptyBoard(device: DeviceId): Board {
  const rootId = uid('n');
  const d = DEVICES[device];
  const root: Node = {
    id: rootId, type: 'page', name: '页面', parentId: null, children: [],
    frame: { x: 0, y: 0, w: d.w, h: d.h },
    style: { background: '#ffffff' }, props: {}, events: {},
  };
  return { device, frame: { w: d.w, h: d.h }, rootId, nodes: { [rootId]: root } };
}

export function emptyProject(): Project {
  const page: Page = {
    id: uid('pg'), name: '登录页',
    boards: { desktop: emptyBoard('desktop'), mobile: emptyBoard('mobile'), watch: emptyBoard('watch') },
  };
  return {
    id: uid('p'), name: '我的原型', schemaVersion: 2,
    createdAt: new Date().toISOString(),
    pages: [page],
    theme: {
      colors: { primary: '#2563eb', bg: '#ffffff', text: '#111827', muted: '#6b7280' },
      radius: { sm: 6, md: 10, pill: 999 },
      font: { family: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif', base: 14 },
    },
  };
}

/** 测试/重置入口：全新空白项目 */
export function createEmptyProject(): Project {
  return emptyProject();
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pending: Project | undefined;

export function scheduleSave(p: Project) {
  pending = p;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const snapshot = pending;
    pending = undefined;
    saveTimer = undefined;
    if (snapshot) void saveProject(snapshot);
  }, 1000);
}

/**
 * F1 · 立即落盘（切换项目 / 删除项目 / 关闭页面前调用）
 * 防抖窗口内的改动不会丢失；无待写数据时为空操作
 */
export async function flushSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }
  const snapshot = pending;
  pending = undefined;
  if (snapshot) await saveProject(snapshot);
}

/** 定位当前页/当前设备的画板（immer draft 上用） */
export function pick(draft: Project, pageId: string, device: DeviceId) {
  const page = draft.pages.find(pg => pg.id === pageId) ?? draft.pages[0];
  return { page, board: page.boards[device] };
}
