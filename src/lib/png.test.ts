// F3 · PNG 导出纯函数单测：倍率钳制、文件名规范化（非法字符/空白/空串/日期）
import { describe, it, expect } from 'vitest';
import { boardPngFileName, normalizeScale, PNG_SCALE_MAX, PNG_SCALE_MIN } from './png';

describe('lib/png · normalizeScale', () => {
  it('默认 2 倍；越界钳制到 1~3', () => {
    expect(normalizeScale()).toBe(2);
    expect(normalizeScale(0.5)).toBe(PNG_SCALE_MIN);
    expect(normalizeScale(10)).toBe(PNG_SCALE_MAX);
    expect(normalizeScale(1.5)).toBe(1.5);
  });

  it('非法数值回退 2 倍', () => {
    expect(normalizeScale(Number.NaN)).toBe(2);
    expect(normalizeScale(Number.POSITIVE_INFINITY)).toBe(2);
  });
});

describe('lib/png · boardPngFileName', () => {
  const at = new Date(2026, 9, 28);   // 2026-10-28

  it('项目-页面-设备-日期.png', () => {
    expect(boardPngFileName('我的原型', '首页', 'mobile', at)).toBe('我的原型-首页-mobile-20261028.png');
  });

  it('文件系统非法字符与空白被替换为连字符', () => {
    expect(boardPngFileName('a/b:c*d?e"f<g>h|i', '登 录 页', 'desktop', at))
      .toBe('a-b-c-d-e-f-g-h-i-登-录-页-desktop-20261028.png');
  });

  it('空名回退 board；首尾连字符合并', () => {
    expect(boardPngFileName('   ', '  /首页/  ', 'watch', at)).toBe('board-首页-watch-20261028.png');
  });

  it('月份/日期补零', () => {
    expect(boardPngFileName('p', 'pg', 'mobile', new Date(2026, 0, 5))).toBe('p-pg-mobile-20260105.png');
  });
});
