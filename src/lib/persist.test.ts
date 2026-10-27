// P3-36 · IndexedDB 持久化往返测试（fake-indexeddb 模拟浏览器环境）
import { describe, it, expect, beforeAll } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

beforeAll(() => {
  // persist.ts 运行时检查 typeof indexedDB，须在任何调用前注入
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
});

import { saveProject, loadProject, clearAll, migrate } from './persist';
import { createEmptyProject } from '../store';
import type { Project } from '../types';

describe('lib/persist · IndexedDB 往返（fake-indexeddb）', () => {
  it('save → load 往返还原项目（含模块与事件）', async () => {
    const p = createEmptyProject();
    p.name = '持久化测试';
    p.pages[0].boards.mobile.nodes;
    await saveProject(p);
    const loaded = await loadProject();
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe('持久化测试');
    expect(loaded!.pages.length).toBe(p.pages.length);
    expect(loaded!.schemaVersion).toBe(2);
  });

  it('load 无数据时返回 null，不抛错', async () => {
    // 注：idb-keyval 首次调用后缓存库引用，空库场景由 clearAll 用例覆盖
    await clearAll();
    expect(await loadProject()).toBeNull();
  });

  it('v1 旧数据经迁移链升级到 v2 并补 events', async () => {
    const v1 = createEmptyProject();
    v1.schemaVersion = 1;
    for (const b of Object.values(v1.pages[0].boards)) {
      for (const n of Object.values(b.nodes)) (n as { events?: unknown }).events = undefined;
    }
    const out = migrate(JSON.parse(JSON.stringify(v1)) as Project);
    expect(out.schemaVersion).toBe(2);
    for (const b of Object.values(out.pages[0].boards)) {
      for (const n of Object.values(b.nodes)) expect(n.events).toBeTypeOf('object');
    }
  });

  it('clearAll 后 load 返回 null（主键与备份都被删除）', async () => {
    await saveProject(createEmptyProject());
    await clearAll();
    expect(await loadProject()).toBeNull();
  });
});
