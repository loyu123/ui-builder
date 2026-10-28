// F8 · 导出范围：页面 / 设备可裁剪
// 抽成纯函数的原因：范围规则（空选=全部、未知 id 忽略、顺序稳定）值得直接单测，
// 而 zip 生成依赖 JSZip，测起来更重。
import type { DeviceId, Project } from '../types';

export const EXPORT_DEVICES: readonly DeviceId[] = ['desktop', 'mobile', 'watch'];

export interface ExportScope {
  pageIds?: readonly string[];
  devices?: readonly string[];
}

/** 设备范围归一化：缺省/空/全不合法 → 全部；结果按固定顺序去重 */
export function normalizeDevices(devices?: readonly string[]): DeviceId[] {
  if (!devices?.length) return [...EXPORT_DEVICES];
  const picked = new Set<string>(devices);
  const out = EXPORT_DEVICES.filter(d => picked.has(d));
  return out.length ? out : [...EXPORT_DEVICES];
}

/** 页面裁剪：保留原顺序、忽略未知 id；空选择或全不合法 → 全部（导出不能产出空工程） */
export function scopeProject(project: Project, pageIds?: readonly string[]): Project {
  if (!pageIds?.length) return project;
  const picked = new Set(pageIds);
  const pages = project.pages.filter(p => picked.has(p.id));
  return pages.length ? { ...project, pages } : project;
}

/** index.tsx 的默认导出设备：移动端优先，否则取范围内第一个 */
export function defaultDevice(devices: readonly DeviceId[]): DeviceId {
  return devices.includes('mobile') ? 'mobile' : devices[0] ?? 'mobile';
}

export function applyExportScope(
  project: Project,
  scope: ExportScope = {},
): { project: Project; devices: DeviceId[] } {
  return { project: scopeProject(project, scope.pageIds), devices: normalizeDevices(scope.devices) };
}
