// F1 · 多项目索引：纯函数（可单测）。IndexedDB 实际读写见 lib/persist.ts
// 存结构：{ version, currentId, list: [{ id, name, updatedAt }] }，list 按最近使用倒序
export interface ProjectEntry {
  id: string;
  name: string;
  updatedAt: string;   // ISO 时间
}

export interface ProjectIndex {
  version: 1;
  currentId: string | null;
  list: ProjectEntry[];
}

const EPOCH = new Date(0).toISOString();

export function emptyIndex(): ProjectIndex {
  return { version: 1, currentId: null, list: [] };
}

// 容错解析：任何不合法输入退化为空索引（启动不崩），并修正失效的 currentId
export function parseIndex(raw: unknown): ProjectIndex {
  const v = raw as Partial<ProjectIndex> | undefined;
  if (!v || typeof v !== 'object' || !Array.isArray(v.list)) return emptyIndex();
  const list: ProjectEntry[] = v.list
    .filter(e => e && typeof e.id === 'string' && e.id.length > 0 && typeof e.name === 'string')
    .map(e => ({
      id: e.id,
      name: e.name,
      updatedAt: typeof e.updatedAt === 'string' ? e.updatedAt : EPOCH,
    }));
  const currentId = typeof v.currentId === 'string' && list.some(e => e.id === v.currentId)
    ? v.currentId
    : (list[0]?.id ?? null);
  return { version: 1, list, currentId };
}

export function entryOf(p: { id: string; name: string }, now: Date = new Date()): ProjectEntry {
  return { id: p.id, name: p.name, updatedAt: now.toISOString() };
}

// 插入/更新（去重）后按 updatedAt 倒序；currentId 为空时顺手设为该项
export function upsertEntry(index: ProjectIndex, entry: ProjectEntry): ProjectIndex {
  const list = [entry, ...index.list.filter(e => e.id !== entry.id)]
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  return { ...index, list, currentId: index.currentId ?? entry.id };
}

// 删除一项：若删的是当前项，回退到列表首个（无则 null）
export function removeEntry(index: ProjectIndex, id: string): ProjectIndex {
  const list = index.list.filter(e => e.id !== id);
  const currentId = index.currentId === id ? (list[0]?.id ?? null) : index.currentId;
  return { ...index, list, currentId };
}

// 自愈：剔除数据已缺失的条目（persist 层探测数据是否存在后回写）
export function pruneIds(index: ProjectIndex, missingIds: Iterable<string>): ProjectIndex {
  let out = index;
  for (const id of missingIds) out = removeEntry(out, id);
  return out;
}

// 旧版「单 key 当前项目」→ 单条目索引（v1.1 数据升级用）
export function indexFromLegacy(p: { id: string; name: string }, now: Date = new Date()): ProjectIndex {
  return { version: 1, currentId: p.id, list: [entryOf(p, now)] };
}
