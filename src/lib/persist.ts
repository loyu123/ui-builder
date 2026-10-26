// ST-03 · IndexedDB 持久化（idb-keyval），1s 去抖由 store 订阅触发
import { get, set } from 'idb-keyval';
import type { Project } from '../types';

const KEY = 'ui-builder:current-project';

export async function saveProject(p: Project): Promise<void> {
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
    // 基础校验，坏数据直接丢弃（W2 换 migrate 链）
    if (raw && typeof raw === 'object' && Array.isArray((raw as Project).pages)) {
      return raw as Project;
    }
    return null;
  } catch (e) {
    console.error('[persist] 读取失败', e);
    return null;
  }
}
