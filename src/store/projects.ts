// F1 · 多项目切片：新建 / 切换 / 重命名 / 删除（索引在 lib/persist.ts，纯逻辑在 lib/projectIndex.ts）
// 约束：切换与删除前必须 flushSave()，否则防抖窗口内的最后一批改动会丢
import type { StoreApi } from 'zustand';
import { uid } from '../lib/id';
import { deleteProjectData, loadProjectById, loadProjectIndex, saveProject, setCurrentProjectId } from '../lib/persist';
import type { Project } from '../types';
import { emptyProject, flushSave, scheduleSave } from './project';
import type { HistorySlice, Store } from './types';

type Set = StoreApi<Store>['setState'];
type Get = StoreApi<Store>['getState'];

const freshHistory = (): HistorySlice => ({ past: [], future: [], lastTag: '', lastAt: 0, log: [] });

export function makeProjects(set: Set, get: Get): Pick<Store['actions'],
  'refreshProjects' | 'createProject' | 'switchProject' | 'renameProject' | 'deleteProject'> {
  // 进入某个项目后的状态复位：编辑态回到首页，选中/剪贴板/历史清空（避免跨项目撤销）
  function enterProject(p: Project) {
    set(s => ({
      project: p,
      editor: {
        ...s.editor,
        currentPageId: p.pages[0]?.id ?? s.editor.currentPageId,
        selection: [],
        clipboard: [],
        // 保留当前设备与缩放（跨项目操作习惯一致）
      },
      history: freshHistory(),
    }));
  }

  return {
    refreshProjects: async () => {
      const index = await loadProjectIndex();
      set(s => ({ projects: { ...s.projects, list: index.list, currentId: index.currentId } }));
    },

    // 新建项目（M2 起支持从模板传入完整 Project）
    createProject: async opts => {
      await flushSave();
      set(s => ({ projects: { ...s.projects, busy: true } }));
      try {
        const p: Project = opts?.from ? { ...opts.from, id: uid('p') } : emptyProject();
        await saveProject(p, { makeCurrent: true });
        enterProject(p);
        await get().actions.refreshProjects();
      } finally {
        set(s => ({ projects: { ...s.projects, busy: false } }));
      }
    },

    switchProject: async id => {
      if (id === get().project.id) return;
      set(s => ({ projects: { ...s.projects, busy: true } }));
      try {
        await flushSave();                     // 先把当前项目的改动落盘
        const target = await loadProjectById(id);
        if (!target) {                         // 数据缺失：刷新索引（自愈）并放弃切换
          await get().actions.refreshProjects();
          return;
        }
        await setCurrentProjectId(id);
        enterProject(target);
        await get().actions.refreshProjects();
      } finally {
        set(s => ({ projects: { ...s.projects, busy: false } }));
      }
    },

    renameProject: async (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const s = get();
      if (s.project.id === id) {
        const p = { ...s.project, name: trimmed };
        set({ project: p });
        scheduleSave(p);                       // 走既有防抖通道，顺手刷新索引 updatedAt
        await flushSave();
      } else {
        const p = await loadProjectById(id);
        if (!p) return;
        await saveProject({ ...p, name: trimmed });
      }
      await get().actions.refreshProjects();
    },

    deleteProject: async id => {
      const index = await loadProjectIndex();
      if (index.list.length <= 1) return;      // 至少保留一个项目
      set(s => ({ projects: { ...s.projects, busy: true } }));
      try {
        await flushSave();
        await deleteProjectData(id);
        if (get().project.id === id) {
          // 删的是当前项目 → 切到索引里的下一个；若其余项目数据也缺失则新建空白项目兜底
          const next = index.list.find(e => e.id !== id);
          const p = next ? await loadProjectById(next.id) : null;
          if (p) {
            await setCurrentProjectId(p.id);
            enterProject(p);
          } else {
            const fresh = emptyProject();
            await saveProject(fresh, { makeCurrent: true });
            enterProject(fresh);
          }
        }
        await get().actions.refreshProjects();
      } finally {
        set(s => ({ projects: { ...s.projects, busy: false } }));
      }
    },
  };
}
