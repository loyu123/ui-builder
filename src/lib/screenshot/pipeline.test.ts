// SS-08 · 流水线：不可信 JSON → 可用节点（端到端）
import { describe, it, expect } from 'vitest';
import { runPipeline } from './pipeline';
import { REGISTRY_MAP } from '../../modules/registry';

const board = { w: 390, h: 844 };

describe('screenshot · 流水线', () => {
  it('0-1000 网格坐标能整批转成画板像素', () => {
    const r = runPipeline({
      modules: [
        { type: 'text', confidence: 0.9, box: { x: 50, y: 100, w: 300, h: 40 }, text: '欢迎回来' },
        { type: 'button', confidence: 0.92, box: { x: 50, y: 700, w: 800, h: 60 }, text: '登 录' },
      ],
    }, board);
    expect(r.space).toBe('grid1000');
    expect(r.items).toHaveLength(2);
    for (const it of r.items) {
      expect(it.frame.x).toBeGreaterThanOrEqual(0);
      expect(it.frame.x + it.frame.w).toBeLessThanOrEqual(board.w);
      expect(it.frame.y + it.frame.h).toBeLessThanOrEqual(board.h);
    }
    const types = r.items.map(i => i.type);
    expect(types).toContain('heading');          // 40/1000 * 844 ≈ 34px 高 → 标题
    expect(types).toContain('button-primary');
  });

  it('未知类型落地为占位块，但仍产出可用节点', () => {
    const r = runPipeline({ modules: [{ type: 'chart', confidence: 0.8, box: { x: 0.1, y: 0.1, w: 0.5, h: 0.2 } }] }, board);
    expect(r.items[0].placeholder).toBe(true);
    expect(REGISTRY_MAP[r.items[0].type]).toBeTruthy();
  });

  it('图片尺寸参与像素坐标归一化', () => {
    const r = runPipeline({ modules: [{ type: 'image', confidence: 0.9, box: { x: 108, y: 384, w: 432, h: 384 } }] },
      board, { image: { w: 1080, h: 1920 } });
    expect(r.space).toBe('pixels');
    expect(r.items[0].frame.x).toBe(40);   // 0.1 * 390 = 39 → 吸附 40
  });

  it('空 / 坏输入返回空结果且不抛错', () => {
    expect(runPipeline(null, board).items).toEqual([]);
    expect(runPipeline({ modules: [null, { type: 'x' }] }, board).items).toEqual([]);
  });

  it('样式脏值不会流进节点', () => {
    const r = runPipeline({
      modules: [{ type: 'button', confidence: 0.9, box: { x: 0.1, y: 0.2, w: 0.8, h: 0.06 }, style: { bg: 'javascript:1', radius: 999 } }],
    }, board);
    expect(r.items[0].style).toEqual({ radius: 48 });
  });
});
