// actions 切片（B1 拆分）：全部业务动作（画布/属性/页面/导入导出入口）
import { produce } from 'immer';
import { uid } from '../lib/id';
import { loadProject, migrate } from '../lib/persist';
import { subtreeIds } from '../lib/tree';
import { REGISTRY_MAP } from '../modules/registry';
import type { StoreApi } from 'zustand';
import type { Node } from '../types';
import { isProject, isValidProject } from '../types';
import { emptyBoard, emptyProject, pick, scheduleSave } from './project';
import { makeHistory } from './history';
import type { Store } from './types';

type Set = StoreApi<Store>['setState'];
type Get = StoreApi<Store>['getState'];

export function makeActions(set: Set, get: Get): Store['actions'] {
  const hist = makeHistory(set, get);
  return {
    ...hist,

    // CV-02/06 · 拖入画布或容器
    addNode: (type, frame, parentId) => {
      const s = get();
      hist.pushHistory('add');
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
      hist.pushHistory('drag');
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
      hist.pushHistory('resize');
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
      hist.pushHistory('prop');
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
      hist.pushHistory('style');
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
      hist.pushHistory('frame');
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
      hist.pushHistory('delete');
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

    // 清空当前画板（保留 root，删除全部子节点），走持久化
    clearBoard: () => {
      const s = get();
      hist.pushHistory('clear');
      const p = structuredClone(s.project);
      const page = p.pages.find(pg => pg.id === s.editor.currentPageId) ?? p.pages[0];
      const board = page.boards[s.editor.currentDevice];
      board.nodes[board.rootId].children = [];
      for (const id of Object.keys(board.nodes)) {
        if (id !== board.rootId) delete board.nodes[id];
      }
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
      hist.pushHistory('paste');
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
      hist.pushHistory('page');
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
      hist.pushHistory('page-del');
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
      hist.pushHistory('copy-board');
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
      hist.pushHistory('flag');
      const p = produce(s.project, draft => {
        const { board } = pick(draft, s.editor.currentPageId, s.editor.currentDevice);
        const n = board.nodes[id];
        if (n) n[key] = value;
      });
      scheduleSave(p);
      set({ project: p });
    },

    // 旋转模块（度，0~359；吸附/对齐仍按未旋转外接矩形近似）
    setNodeRotation: (id, deg) => {
      const s = get();
      hist.pushHistory('rotate');
      const p = produce(s.project, draft => {
        const { board } = pick(draft, s.editor.currentPageId, s.editor.currentDevice);
        const n = board.nodes[id];
        if (n) n.rotation = ((Math.round(deg) % 360) + 360) % 360;
      });
      scheduleSave(p);
      set({ project: p });
    },

    // P2-30 · 多选批量对齐：把所有选中节点对齐到选中集的公共边界（单次快照可整体撤销）
    alignSelection: dir => {
      const s = get();
      if (s.editor.selection.length < 2) return;
      hist.pushHistory('align');
      const p = produce(s.project, draft => {
        const { board } = pick(draft, s.editor.currentPageId, s.editor.currentDevice);
        const nodes = s.editor.selection.map(id => board.nodes[id]).filter(n => n && n.parentId);
        if (nodes.length < 2) return;
        const minX = Math.min(...nodes.map(n => n.frame.x));
        const minY = Math.min(...nodes.map(n => n.frame.y));
        const maxX = Math.max(...nodes.map(n => n.frame.x + n.frame.w));
        const maxY = Math.max(...nodes.map(n => n.frame.y + n.frame.h));
        for (const n of nodes) {
          if (dir === 'left') n.frame.x = minX;
          if (dir === 'right') n.frame.x = maxX - n.frame.w;
          if (dir === 'top') n.frame.y = minY;
          if (dir === 'bottom') n.frame.y = maxY - n.frame.h;
        }
      });
      scheduleSave(p);
      set({ project: p });
    },

    // P2-10 · 事件绑定编辑（action/target/note；navigate 的 target 存页面 id）
    setNodeEvent: (id, ev, spec) => {
      const s = get();
      const p = produce(s.project, draft => {
        const { board } = pick(draft, s.editor.currentPageId, s.editor.currentDevice);
        const n = board.nodes[id];
        if (n) n.events[ev] = spec;
      });
      scheduleSave(p);
      set({ project: p });
    },

    // P2-11 · 主题令牌编辑（颜色/圆角/字体；导出 tokens.css 使用）
    updateTheme: patch => {
      const s = get();
      const p = produce(s.project, draft => {
        if (patch.colors) draft.theme.colors = { ...draft.theme.colors, ...patch.colors };
        if (patch.radius) draft.theme.radius = { ...draft.theme.radius, ...patch.radius };
        if (patch.font) draft.theme.font = { ...draft.theme.font, ...patch.font };
      });
      scheduleSave(p);
      set({ project: p });
    },

    // PP-03 · 功能备注（该模块在最终成果中的功能描述）
    setNodeNote: (id, note) => {
      const s = get();
      const p = produce(s.project, draft => {
        const { board } = pick(draft, s.editor.currentPageId, s.editor.currentDevice);
        const n = board.nodes[id];
        if (n) n.note = note;
      });
      scheduleSave(p);
      set({ project: p });
    },

    setNodePos: (id, pos) => {
      const s = get();
      const p = produce(s.project, draft => {
        const { board } = pick(draft, s.editor.currentPageId, s.editor.currentDevice);
        const n = board.nodes[id];
        if (n) n.pos = pos;
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
      hist.pushHistory('reorder');
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

    // ST-05 · 导入 JSON（含校验与迁移；失败返回可读原因，成功返回 null）
    importProject: json => {
      try {
        const raw = JSON.parse(json);
        if (!isProject(raw)) return '文件缺少必要字段（pages / theme / schemaVersion）';
        const migrated = migrate(raw);
        // ST-05 · 深校验：结构损坏（父子断裂/root 丢失）直接拒绝，不进 store 不落盘
        if (!isValidProject(migrated)) {
          console.error('[import] 导入失败：项目结构校验未通过');
          return '项目结构校验未通过：画板 root 缺失，或模块父子关系断裂';
        }
        set({
          project: migrated,
          editor: { ...get().editor, currentPageId: migrated.pages[0].id, selection: [] },
        });
        scheduleSave(get().project);
        return null;
      } catch {
        return '不是合法的 JSON 文本';
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
  };
}
