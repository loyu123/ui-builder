// F10 · 间距标注纯函数：四方向最近间距 / 重叠判定 / 几何位置
import { describe, it, expect } from 'vitest';
import { spacingGaps } from './spacing';

const sel = { x: 100, y: 100, w: 50, h: 50 };   // 100~150 × 100~150

describe('F10 · 间距标注', () => {
  it('无候选 → 空', () => {
    expect(spacingGaps(sel, [])).toEqual([]);
  });

  it('右侧相邻：只标水平线，长度为间距，落在重叠区中点', () => {
    const gaps = spacingGaps(sel, [{ x: 180, y: 100, w: 40, h: 50 }]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ side: 'right', gap: 30, axis: 'h', x: 150, y: 125, length: 30 });
  });

  it('左侧 / 上方 / 下方各自取最近边', () => {
    const left = spacingGaps(sel, [{ x: 40, y: 110, w: 40, h: 10 }]);
    expect(left[0]).toMatchObject({ side: 'left', gap: 20, x: 80, y: 115 });

    const top = spacingGaps(sel, [{ x: 110, y: 20, w: 10, h: 40 }]);
    expect(top[0]).toMatchObject({ side: 'top', gap: 40, axis: 'v', x: 115, y: 60 });

    const bottom = spacingGaps(sel, [{ x: 110, y: 200, w: 10, h: 40 }]);
    expect(bottom[0]).toMatchObject({ side: 'bottom', gap: 50, x: 115, y: 150 });
  });

  it('另一轴无重叠时不标注', () => {
    // 右边但纵向完全错开
    expect(spacingGaps(sel, [{ x: 180, y: 300, w: 40, h: 40 }])).toEqual([]);
  });

  it('同方向多候选取最小间距', () => {
    const gaps = spacingGaps(sel, [
      { x: 400, y: 120, w: 40, h: 10 },
      { x: 170, y: 100, w: 40, h: 50 },
      { x: 200, y: 140, w: 40, h: 10 },
    ]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].gap).toBe(20);
  });

  it('重叠 / 贴边（间距 <= 0）不标注', () => {
    expect(spacingGaps(sel, [{ x: 120, y: 120, w: 60, h: 60 }])).toEqual([]);   // 完全包含
    expect(spacingGaps(sel, [{ x: 150, y: 100, w: 40, h: 50 }])).toEqual([]);   // 贴边 gap=0
  });

  it('四个方向可同时给出（顺序 left/right/top/bottom）', () => {
    const gaps = spacingGaps(sel, [
      { x: 10, y: 100, w: 20, h: 50 },
      { x: 200, y: 100, w: 20, h: 50 },
      { x: 100, y: 10, w: 50, h: 20 },
      { x: 100, y: 200, w: 50, h: 20 },
    ]);
    expect(gaps.map(g => g.side)).toEqual(['left', 'right', 'top', 'bottom']);
    expect(gaps.map(g => g.gap)).toEqual([70, 50, 70, 50]);
  });
});
