// SS-05 · 类型映射：只产出注册表里真实存在的 type
import { describe, it, expect } from 'vitest';
import { REGISTRY_MAP } from '../../modules/registry';
import { mapType, normalizeTypeKey, PLACEHOLDER_TYPE } from './mapType';

const board = { w: 390, h: 844 };
const frame = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

describe('screenshot · 类型映射', () => {
  it('模型直接给了我们的 type 时精确命中', () => {
    expect(mapType('button-primary', frame(24, 300, 342, 48), board)).toEqual({ type: 'button-primary', known: true });
    expect(mapType('list-item', frame(0, 100, 390, 64), board).type).toBe('list-item');
  });

  it('按钮按宽度分流主/次', () => {
    expect(mapType('button', frame(24, 300, 342, 48), board).type).toBe('button-primary');
    expect(mapType('btn', frame(24, 300, 120, 36), board).type).toBe('button-secondary');
  });

  it('文字按高度分流标题/正文', () => {
    expect(mapType('text', frame(24, 60, 240, 34), board).type).toBe('heading');
    expect(mapType('label', frame(24, 100, 200, 18), board).type).toBe('paragraph');
  });

  it('导航按位置分流顶栏/标签栏', () => {
    expect(mapType('nav', frame(0, 0, 390, 44), board).type).toBe('topnav');
    expect(mapType('menu', frame(0, 790, 390, 56), board).type).toBe('tabbar');
  });

  it('无对应模块的媒体类降级到最接近的真实类型', () => {
    expect(mapType('video', frame(0, 200, 390, 220), board).type).toBe('image');
    expect(mapType('banner', frame(0, 200, 390, 160), board).type).toBe('image');
    expect(mapType('modal', frame(24, 200, 342, 300), board).type).toBe('card');
  });

  it('注册表里没有的类型 → 占位块（known=false）', () => {
    for (const t of ['chart', 'badge', 'spacer', 'weird-thing']) {
      const m = mapType(t, frame(0, 0, 100, 40), board);
      expect(m.known).toBe(false);
      expect(m.type).toBe(PLACEHOLDER_TYPE);
      expect(REGISTRY_MAP[m.type]).toBeTruthy();   // 占位类型必须真实存在
    }
  });

  it('键归一化：下划线/空格/大小写都能命中', () => {
    expect(normalizeTypeKey('  Text_Field ')).toBe('text-field');
    expect(mapType('  Search Bar ', frame(0, 0, 300, 44), board).type).toBe('input');
    expect(mapType('Bottom Bar', frame(0, 790, 390, 54), board).type).toBe('tabbar');
  });

  it('空 type → 占位块', () => {
    expect(mapType('   ', frame(0, 0, 10, 10), board)).toEqual({ type: PLACEHOLDER_TYPE, known: false });
  });
});
