// ST-03 + ST-04 · IndexedDB 持久化（idb-keyval）+ schema 版本迁移链
import { get, set, del } from 'idb-keyval';
import type { Page, Project } from '../types';

const KEY = 'ui-builder:current-project';
const BACKUP_KEY = 'ui-builder:backup';
export const CURRENT_SCHEMA = 2;

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

export async function saveProject(p: Project): Promise<void> {
  if (typeof indexedDB === 'undefined') return;   // node 测试环境无 IndexedDB，静默跳过
  try {
    await set(KEY, JSON.parse(JSON.stringify(p)));
  } catch (e) {
    console.error('[persist] 保存失败', e);
  }
}

export async function loadProject(): Promise<Project | null> {
  try {
    const raw = await get(KEY);
    if (!raw) return null;
    if (raw && typeof raw === 'object' && Array.isArray((raw as Project).pages)) {
      const migrated = migrate(raw as Project);
      // 迁移前留一份备份，失败可捞回
      await set(BACKUP_KEY, raw);
      return migrated;
    }
    return null;
  } catch (e) {
    console.error('[persist] 读取失败', e);
    return null;
  }
}

// 清空本地全部持久化数据（ErrorBoundary「清空缓存并重置」用）：
// 项目主键 + 迁移备份 + localStorage 标记，reload 后回到全新项目
export async function clearAll(): Promise<void> {
  try {
    await del(KEY);
    await del(BACKUP_KEY);
  } catch (e) {
    console.error('[persist] 清空失败', e);
  }
  try {
    localStorage.removeItem('ub-last-export');
  } catch {
    /* 无 localStorage 环境忽略 */
  }
}
