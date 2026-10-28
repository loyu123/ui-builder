// ST-03 + ST-04 · IndexedDB 持久化（idb-keyval）+ schema 版本迁移链
// F1 · 多项目：索引键 `ui-builder:index` + 每项目数据键 `ui-builder:project:<id>`；
//      v1.1 的单 key 数据（`ui-builder:current-project`）在首次读取时自动迁移并保留备份。
import { get, set, del } from 'idb-keyval';
import { clearAiSettings } from './aiSettings';
import type { Page, Project } from '../types';
import {
  emptyIndex, entryOf, indexFromLegacy, parseIndex, pruneIds, removeEntry, upsertEntry,
  type ProjectIndex,
} from './projectIndex';

const LEGACY_KEY = 'ui-builder:current-project';
const LEGACY_BACKUP_KEY = 'ui-builder:backup';
const INDEX_KEY = 'ui-builder:index';
const projectKey = (id: string) => `ui-builder:project:${id}`;
export const CURRENT_SCHEMA = 2;

const hasIDB = () => typeof indexedDB !== 'undefined';

// ST-04 · 迁移链：每加一版追加一个函数；纯函数
const MIGRATIONS: Record<number, (p: Project) => Project> = {
  // v1 → v2：补齐 events 字段（password 模块等早期数据没有 events）
  1: p => ({
    ...p,
    schemaVersion: 2,
    pages: p.pages.map(pg => ({
      ...pg,
      boards: Object.fromEntries(
        Object.entries(pg.boards).map(([d, b]) => [d, {
          ...b,
          nodes: Object.fromEntries(
            Object.entries(b.nodes).map(([id, n]) => [id, { ...n, events: n.events ?? {} }]),
          ),
        }]),
      ) as Page['boards'],
    })),
  }),
};

export function migrate(p: Project): Project {
  let cur = p;
  while ((cur.schemaVersion ?? 1) < CURRENT_SCHEMA) {
    const f = MIGRATIONS[cur.schemaVersion ?? 1];
    if (!f) break;
    cur = f(cur);
  }
  return cur;
}

// ---------- 索引读写 ----------

export async function readIndex(): Promise<ProjectIndex> {
  if (!hasIDB()) return emptyIndex();
  try {
    return parseIndex(await get(INDEX_KEY));
  } catch (e) {
    console.error('[persist] 读取索引失败', e);
    return emptyIndex();
  }
}

async function writeIndex(index: ProjectIndex): Promise<void> {
  try {
    await set(INDEX_KEY, index);
  } catch (e) {
    console.error('[persist] 写入索引失败', e);
  }
}

// 启动时读索引并自愈：剔除「有条目但数据缺失」的项，避免切到空项目
export async function loadProjectIndex(): Promise<ProjectIndex> {
  const index = await readIndex();
  if (!hasIDB() || !index.list.length) return index;
  const missing: string[] = [];
  for (const e of index.list) {
    const raw = await get(projectKey(e.id));
    if (!raw) missing.push(e.id);
  }
  if (!missing.length) return index;
  const healed = pruneIds(index, missing);
  await writeIndex(healed);
  return healed;
}

export async function setCurrentProjectId(id: string): Promise<void> {
  const index = await readIndex();
  await writeIndex({ ...index, currentId: id });
}

// ---------- 单项目读写 ----------

export async function loadProjectById(id: string): Promise<Project | null> {
  if (!hasIDB()) return null;
  try {
    const raw = await get(projectKey(id));
    if (raw && typeof raw === 'object' && Array.isArray((raw as Project).pages)) {
      return migrate(raw as Project);
    }
    return null;
  } catch (e) {
    console.error('[persist] 读取项目失败', e);
    return null;
  }
}

// 保存项目数据 + 更新索引（updatedAt 刷新；索引无当前项时设为该项）
export async function saveProject(p: Project, opts: { makeCurrent?: boolean } = {}): Promise<void> {
  if (!hasIDB()) return;   // node 测试环境无 IndexedDB，静默跳过
  try {
    await set(projectKey(p.id), JSON.parse(JSON.stringify(p)));
    let index = await readIndex();
    index = upsertEntry(index, entryOf(p));
    if (opts.makeCurrent) index = { ...index, currentId: p.id };
    await writeIndex(index);
  } catch (e) {
    console.error('[persist] 保存失败', e);
  }
}

export async function deleteProjectData(id: string): Promise<void> {
  if (!hasIDB()) return;
  try {
    await del(projectKey(id));
    const index = await readIndex();
    await writeIndex(removeEntry(index, id));
  } catch (e) {
    console.error('[persist] 删除项目失败', e);
  }
}

// 读取当前项目：索引 → 项目数据；索引缺失时把 v1.1 单 key 数据迁移过来
export async function loadProject(): Promise<Project | null> {
  if (!hasIDB()) return null;
  try {
    const index = await readIndex();
    if (index.currentId) {
      const cur = await loadProjectById(index.currentId);
      if (cur) return cur;
    }
    // 旧版单项目数据迁移（保留旧键作备份，不删）
    const legacy = await get(LEGACY_KEY);
    if (legacy && typeof legacy === 'object' && Array.isArray((legacy as Project).pages)) {
      const migrated = migrate(legacy as Project);
      await set(LEGACY_BACKUP_KEY, legacy);
      await saveProject(migrated, { makeCurrent: true });
      await writeIndex(indexFromLegacy(migrated));
      return migrated;
    }
    return null;
  } catch (e) {
    console.error('[persist] 读取失败', e);
    return null;
  }
}

// 清空本地全部持久化数据（ErrorBoundary「清空缓存并重置」用）：
// 索引 + 所有项目数据 + 迁移备份 + localStorage 标记，reload 后回到全新项目
export async function clearAll(): Promise<void> {
  try {
    const index = await readIndex();
    for (const e of index.list) await del(projectKey(e.id));
    await del(INDEX_KEY);
    await del(LEGACY_KEY);
    await del(LEGACY_BACKUP_KEY);
  } catch (e) {
    console.error('[persist] 清空失败', e);
  }
  try {
    localStorage.removeItem('ub-last-export');
    clearAiSettings();          // SEC-01 · 「清空并重置」连 AI 密钥一起抹掉，别让用户以为已经清干净
  } catch {
    /* 无 localStorage 环境忽略 */
  }
}
