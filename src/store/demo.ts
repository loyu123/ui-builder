// P2-34 · 示例项目入口（?demo=login）
// F2 起示例直接复用内置模板「登录页」，避免两套登录页各自漂移
// （原实现用 props.text 填主按钮，registry 里实际字段是 label，已随模板统一修正）
import { createFromTemplate } from '../templates';
import type { Project } from '../types';
import { emptyProject } from './project';

export function demoLoginProject(): Project {
  const p = createFromTemplate('login') ?? emptyProject();
  p.name = '示例 · 登录页';
  return p;
}
