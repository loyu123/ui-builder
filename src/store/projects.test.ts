// F1 · 多项目 store 流程测试：新建 / 切换（含防抖落盘）/ 重命名 / 删除（含最后一个项目保护）
import { describe, it, expect, beforeAll } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

beforeAll(() => {
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
});

import { useStore } from './index';
import { clearAll, loadProjectIndex, saveProject } from '../lib/persist';
import { emptyProject } from './project';
import type { Project } from '../types';

const actions = () => useStore.getState().actions;

/** 直接落盘一个命名项目并设为当前（模拟已有本地项目） */
async function seed(name: string): Promise<Project> {
  const p = { ...emptyProject(), name };
  await saveProject(p, { makeCurrent: true });
  return p;
}

/** 把 store 切到某个项目的内存态（跳过 UI 流程） */
function useInMemory(p: Project) {
  useStore.setState(s => ({
    project: p,
    editor: { ...s.editor, currentPageId: p.pages[0].id, selection: [] },
    history: { past: [], future: [], lastTag: '', lastAt: 0, log: [] },
  }));
}

describe('store/projects · 多项目', () => {
  it('createProject：新建并入库，切换当前项目，索引列表增长', async () => {
    await clearAll();
    const first = await seed('第一个');
    useInMemory(first);
    await actions().refreshProjects();
    expect(useStore.getState().projects.list.length).toBe(1);

    await actions().createProject();
    const st = useStore.getState();
    expect(st.project.id).not.toBe(first.id);
    expect(st.project.name).toBe('我的原型');
    expect(st.editor.currentPageId).toBe(st.project.pages[0].id);
    expect(st.history.past.length).toBe(0);

    const index = await loadProjectIndex();
    expect(index.list.length).toBe(2);
    expect(index.currentId).toBe(st.project.id);
  });

  it('switchProject：切换前 flush 防抖改动，切回后改动仍在', async () => {
    await clearAll();
    const a = await seed('A');
    useInMemory(a);
    await actions().refreshProjects();

    // 改名走 scheduleSave（1s 防抖），紧接着新建项目 → 内部 flushSave 必须把它落盘
    // 注意：改的是「当前设备」的画板（初始设备为 mobile）
    const dev = useStore.getState().editor.currentDevice;
    const rootId = a.pages[0].boards[dev].rootId;
    actions().setNodeName(rootId, '改过的图层名');
    await actions().createProject();
    await actions().switchProject(a.id);

    const back = useStore.getState().project;
    expect(back.id).toBe(a.id);
    expect(back.pages[0].boards[dev].nodes[rootId].name).toBe('改过的图层名');
    expect(useStore.getState().projects.currentId).toBe(a.id);
  });

  it('renameProject：当前项目改名同步到状态与索引', async () => {
    await clearAll();
    const a = await seed('旧名');
    useInMemory(a);
    await actions().refreshProjects();

    await actions().renameProject(a.id, '  新名字  ');
    expect(useStore.getState().project.name).toBe('新名字');   // 去空格
    const index = await loadProjectIndex();
    expect(index.list.find(e => e.id === a.id)!.name).toBe('新名字');
  });

  it('deleteProject：删除当前项目后自动切到另一个；仅剩一个时拒绝删除', async () => {
    await clearAll();
    const a = await seed('A');
    const b = await seed('B');
    useInMemory(b);
    await actions().refreshProjects();

    await actions().deleteProject(b.id);
    expect(useStore.getState().project.id).toBe(a.id);          // 自动切到剩余项目
    expect(useStore.getState().projects.list.length).toBe(1);

    await actions().deleteProject(a.id);                        // 最后一个项目 → 无操作
    expect(useStore.getState().project.id).toBe(a.id);
    expect((await loadProjectIndex()).list.length).toBe(1);
  });
});
