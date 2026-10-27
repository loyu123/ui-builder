// P3-40 · i18n 单测：字典键一致性、回退链、占位替换、语言切换副作用
import { describe, it, expect, beforeEach } from 'vitest';
import { t, DICT, getLang, setLang, moduleLabel, categoryLabel } from './i18n';
import { REGISTRY_MAP } from '../modules/registry';

describe('lib/i18n · UI 文案字典', () => {
  beforeEach(() => setLang('zh'));

  it('zh / en 字典键集合完全一致（防漏译/多译）', () => {
    const zhKeys = Object.keys(DICT.zh).sort();
    const enKeys = Object.keys(DICT.en).sort();
    expect(enKeys).toEqual(zhKeys);
  });

  it('zh / en 值均非空字符串', () => {
    for (const [k, v] of Object.entries(DICT.zh)) expect(v.trim().length, `zh.${k}`).toBeGreaterThan(0);
    for (const [k, v] of Object.entries(DICT.en)) expect(v.trim().length, `en.${k}`).toBeGreaterThan(0);
  });

  it('t()：缺省中文；切换后取英文；未知键回退键名；{n} 占位替换', () => {
    expect(getLang()).toBe('zh');
    expect(t('preview')).toBe('预览');
    setLang('en');
    expect(t('preview')).toBe('Preview');
    expect(t('drag_hint', { n: 30 })).toBe('Drag a module onto the canvas to create it · 30 modules');
    expect(t('no_such_key')).toBe('no_such_key');
    setLang('zh');
    expect(t('drag_hint', { n: 30 })).toBe('拖动模块到画布即可创建 · 当前 30 个模块');
  });

  it('moduleLabel：en 用 labelEn，zh 用中文 label；缺 labelEn 回退中文', () => {
    const btn = REGISTRY_MAP['button-primary']!;
    expect(moduleLabel(btn)).toBe('主按钮');
    setLang('en');
    expect(moduleLabel(btn)).toBe('Primary button');
    expect(moduleLabel({ label: '自定义', labelEn: undefined })).toBe('自定义');
    setLang('zh');
  });

  it('categoryLabel：分类中文名是稳定 id，仅展示层翻译；未知分类原样返回', () => {
    expect(categoryLabel('基础容器')).toBe('基础容器');
    setLang('en');
    expect(categoryLabel('基础容器')).toBe('Basics');
    expect(categoryLabel('未知分类')).toBe('未知分类');
    setLang('zh');
  });
});
