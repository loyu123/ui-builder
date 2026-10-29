// SS-03 · 坐标：坐标系探测 / 归一化 / 画板映射 / 设备推荐
import { describe, it, expect } from 'vitest';
import { detectCoordSpace, normalizeBox, toBoardFrame, recommendDevice } from './coords';

const mobile = { w: 390, h: 844 };
const desktop = { w: 1440, h: 900 };
const watch = { w: 200, h: 242 };

describe('screenshot · 坐标', () => {
  it('探测 0-1 比例坐标', () => {
    expect(detectCoordSpace([{ x: 0.1, y: 0.2, w: 0.3, h: 0.1 }])).toBe('ratio');
    expect(detectCoordSpace([{ x: 0, y: 0, w: 1, h: 1 }])).toBe('ratio');
  });

  it('探测 0-1000 网格（无图片尺寸时）', () => {
    expect(detectCoordSpace([{ x: 50, y: 620, w: 300, h: 60 }])).toBe('grid1000');
  });

  it('有图片尺寸且坐标落在图内 → 像素坐标', () => {
    expect(detectCoordSpace([{ x: 50, y: 900, w: 300, h: 1200 }], { w: 1080, h: 1920 })).toBe('pixels');
    // 超出图片边长但仍 ≤1000 → 网格
    expect(detectCoordSpace([{ x: 500, y: 100, w: 400, h: 100 }], { w: 600, h: 800 })).toBe('grid1000');
  });

  it('归一化：三种坐标系最终都落在 0-1 且宽高为正', () => {
    const grid = normalizeBox({ x: 50, y: 620, w: 300, h: 60 }, 'grid1000');
    expect(grid).toEqual({ x: 0.05, y: 0.62, w: 0.3, h: 0.06 });

    const px = normalizeBox({ x: 108, y: 960, w: 324, h: 96 }, 'pixels', { w: 1080, h: 1920 });
    expect(px).toEqual({ x: 0.1, y: 0.5, w: 0.3, h: 0.05 });

    const ratio = normalizeBox({ x: 1.4, y: -0.2, w: 0.5, h: 0.1 }, 'ratio');
    expect(ratio.x).toBe(1);
    expect(ratio.y).toBe(0);
    expect(ratio.w).toBeGreaterThan(0);   // 被夹到画板内仍保留最小宽度
  });

  it('映射到画板：四舍五入 + 最小边 + 不越界', () => {
    expect(toBoardFrame({ x: 0.1, y: 0.1, w: 0.5, h: 0.2 }, mobile)).toEqual({ x: 39, y: 84, w: 195, h: 169 });
    const tiny = toBoardFrame({ x: 0.999, y: 0.999, w: 0.0001, h: 0.0001 }, mobile);
    expect(tiny.w).toBeGreaterThanOrEqual(2);
    expect(tiny.x + tiny.w).toBeLessThanOrEqual(mobile.w + 2);
  });

  it('按宽高比推荐画板', () => {
    const devices = { desktop, mobile, watch };
    expect(recommendDevice(1080 / 1920, devices)).toBe('mobile');
    expect(recommendDevice(1440 / 900, devices)).toBe('desktop');
    expect(recommendDevice(200 / 242, devices)).toBe('watch');
  });
});
