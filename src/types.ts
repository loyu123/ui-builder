// WS-03 · 数据模型类型定义（对齐可行性方案第 5 章）
// 节点存扁平字典，父子关系用 parentId/children 维护

export type DeviceId = 'desktop' | 'mobile' | 'watch';

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

// events：事件挂载点（v1 不执行，只记录意图）
export interface EventSpec {
  action: 'none' | 'navigate' | 'submit' | 'back' | 'dismiss' | 'toggle' | 'bind' | 'external';
  target?: string | null;
  note?: string;
}

export interface Node {
  id: string;
  type: string;              // 对应模块注册表 key
  name: string;              // 图层名
  parentId: string | null;
  children: string[];        // 仅容器有；顺序 = 叠放顺序
  frame: Frame;              // 相对父 content-box
  style: Record<string, string | number>;
  props: Record<string, unknown>;
  events: Record<string, EventSpec>;
  locked?: boolean;          // PP-03 · 锁定：不可拖动/缩放，但可选中查看
  hidden?: boolean;          // PP-03 · 隐藏：不渲染
}

export interface Board {
  device: DeviceId;
  frame: { w: number; h: number };
  rootId: string;
  nodes: Record<string, Node>;   // 扁平字典
}

export interface Page {
  id: string;
  name: string;
  boards: Record<DeviceId, Board>;
}

export interface ThemeTokens {
  colors: Record<string, string>;
  radius: Record<string, number>;
  font: { family: string; base: number };
}

export interface Project {
  id: string;
  name: string;
  schemaVersion: number;
  createdAt: string;
  pages: Page[];
  theme: ThemeTokens;
}

// ---------- 运行时校验（ST-05 导入 / ST-03 读取时用） ----------

export function isFrame(f: unknown): f is Frame {
  const v = f as Frame;
  return !!v && typeof v.x === 'number' && typeof v.y === 'number'
    && typeof v.w === 'number' && typeof v.h === 'number';
}

export function isNode(n: unknown): boolean {
  const v = n as Node;
  return !!v && typeof v.id === 'string' && typeof v.type === 'string'
    && isFrame(v.frame) && typeof v.style === 'object'
    && typeof v.props === 'object' && typeof v.events === 'object';
}

export function isProject(p: unknown): p is Project {
  const v = p as Project;
  return !!v && typeof v.schemaVersion === 'number'
    && Array.isArray(v.pages) && typeof v.theme === 'object';
}
