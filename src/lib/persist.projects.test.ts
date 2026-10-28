// F1 · 多项目持久化测试：索引读写 / v1.1 单 key 迁移 / 自愈 / 删除 / 当前项目切换
import { describe, it, expect, beforeAll } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

beforeAll(() => {
  // persist.ts 运行时检查 typeof indexedDB，须在任何调用前注入
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
});

import { get, set, del } from 'idb-keyval';
import {
  clearAll, deleteProjectData, loadProject, loadProjectById, loadProjectIndex,
  saveProject, setCurrentProjectId,
} from './persist';
import { createEmptyProject } from '../store';

const mk = (name: string) => {
  const p = createEmptyProject();
  p.name = name;
  return p;
};

describe('lib/persist · 多项目（索引 + 每项目数据键）', () => {
  it('saveProject 写入数据并登记索引；makeCurrent 切换当前项目', async () => {
    await clearAll();
    const a = mk('A');
    const b = mk('B');
    await saveProject(a, { makeCurrent: true });
    await saveProject(b);

    let index = await loadProjectIndex();
    expect(index.list.map(e => e.name).sort()).toEqual(['A', 'B']);
    expect(index.currentId).toBe(a.id);                 // 未 makeCurrent 不改变当前项目
    expect((await loadProject())!.id).toBe(a.id);

    await setCurrentProjectId(b.id);
    expect((await loadProject())!.id).toBe(b.id);
    expect((await loadProjectById(b.id))!.name).toBe('B');
  });

  it('saveProject 刷新索引里的 name 与顺序（最近修改在前）', async () => {
    await clearAll();
    const a = mk('A');
    const b = mk('B');
    await saveProject(a, { makeCurrent: true });
    await new Promise(r => setTimeout(r, 5));            // 保证 ISO 时间不同
    await saveProject(b);
    let index = await loadProjectIndex();
    expect(index.list[0].id).toBe(b.id);

    await saveProject({ ...a, name: 'A-改名' });
    index = await loadProjectIndex();
    expect(index.list[0].id).toBe(a.id);
    expect(index.list[0].name).toBe('A-改名');
  });

  it('v1.1 单 key 数据首次读取时自动迁移到索引，并保留一份备份', async () => {
    await clearAll();
    const legacy = mk('旧数据');
    await set('ui-builder:current-project', JSON.parse(JSON.stringify(legacy)));

    const loaded = await loadProject();
    expect(loaded!.id).toBe(legacy.id);

    const index = await loadProjectIndex();
    expect(index.currentId).toBe(legacy.id);
    expect(index.list.map(e => e.id)).toEqual([legacy.id]);
    expect(await get('ui-builder:backup')).toBeTruthy();   // 迁移前备份保留
  });

  it('索引自愈：数据已缺失的条目被剔除，currentId 回退到存活项', async () => {
    await clearAll();
    const a = mk('A');
    const b = mk('B');
    await saveProject(a, { makeCurrent: true });
    await saveProject(b);
    await del(`ui-builder:project:${a.id}`);              // 模拟数据损坏/丢失

    const index = await loadProjectIndex();
    expect(index.list.map(e => e.id)).toEqual([b.id]);
    expect(index.currentId).toBe(b.id);
  });

  it('deleteProjectData 同时删除数据与索引条目', async () => {
    await clearAll();
    const a = mk('A');
    const b = mk('B');
    await saveProject(a, { makeCurrent: true });
    await saveProject(b, { makeCurrent: true });

    await deleteProjectData(b.id);
    expect(await loadProjectById(b.id)).toBeNull();
    const index = await loadProjectIndex();
    expect(index.list.map(e => e.id)).toEqual([a.id]);
    expect(index.currentId).toBe(a.id);                   // 删除当前项 → 回退到列表首个
  });

  it('clearAll 清空索引与全部项目数据', async () => {
    await clearAll();
    await saveProject(mk('A'), { makeCurrent: true });
    await saveProject(mk('B'));
    await clearAll();

    const index = await loadProjectIndex();
    expect(index.list).toEqual([]);
    expect(index.currentId).toBeNull();
    expect(await loadProject()).toBeNull();
  });
});
