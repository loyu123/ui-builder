// B2 · 漂移守卫：导出模板（componentBody）与模块注册表（registry fields/默认值）字段一致性。
// 渲染器与导出模板是双份实现，此测试保证模板引用的 props 键不会悄悄偏离注册表定义。
import { describe, it, expect } from 'vitest';
import { REGISTRY, type FieldDef } from '../modules/registry';
import { componentBody, collectActions } from './exporter';
import type { Project } from '../types';

// 从模板提取用到的 props 键：p("k") / t("k") / props.k（含模板插值）
function propKeysOf(body: string): string[] {
  const keys = new Set<string>();
  for (const m of body.matchAll(/\b[pt]\("([^"]+)"\)/g)) keys.add(m[1]);
  for (const m of body.matchAll(/props\.(\w+)/g)) keys.add(m[1]);
  return [...keys];
}

// 注册表里该模块「允许的」props 键 = fields(props 类) ∪ 默认 props
function allowedPropKeys(type: string): Set<string> {
  const meta = REGISTRY.find(m => m.type === type)!;
  const keys = new Set<string>(
    meta.fields.filter((f: FieldDef) => f.target === 'props').map(f => f.key),
  );
  for (const k of Object.keys(meta.props)) keys.add(k);
  return keys;
}

describe('B2 · 导出模板与注册表字段一致性守卫', () => {
  it('每个模块模板引用的 props 键都在注册表 fields/默认值内（防双份漂移）', () => {
    const problems: string[] = [];
    for (const meta of REGISTRY) {
      if (meta.type === 'page') continue;
      const body = componentBody(meta.type);
      const allowed = allowedPropKeys(meta.type);
      for (const k of propKeysOf(body)) {
        if (!allowed.has(k)) problems.push(`${meta.type}: 引用了未定义的 props.${k}`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('collectActions 的 key 拼法与页面 TSX 的 fire() 调用一致（ev_action_target）', () => {
    const project = {
      pages: [{
        boards: {
          mobile: {
            nodes: {
              n1: { events: { onClick: { action: 'submit', target: 'login' } } },
              n2: { events: { onClick: { action: 'none', target: null } } },   // none 不收集
            },
          },
        },
      }],
    } as unknown as Project;
    const keys = collectActions(project);
    expect(keys).toEqual(['onClick_submit_login']);
  });
});
