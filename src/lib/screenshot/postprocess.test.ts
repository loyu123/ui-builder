// SS-06 · 后处理：吸附 / 裁剪 / 列对齐 / IoU 去重 / 置信度分级
import { describe, it, expect } from 'vitest';
import { alignColumns, iou, processModules, snapToGrid, type MappedModule } from './postprocess';

const board = { w: 390, h: 844 };

function mod(patch: Partial<MappedModule> & Pick<MappedModule, 'id' | 'box'>): MappedModule {
  return { rawType: 'text', type: 'paragraph', known: true, confidence: 0.9, text: '', style: {}, ...patch };
}

const rbox = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

describe('screenshot · 后处理', () => {
  it('栅格吸附', () => {
    expect(snapToGrid(23, 4)).toBe(24);
    expect(snapToGrid(22, 4)).toBe(24);
    expect(snapToGrid(21, 4)).toBe(20);
  });

  it('IoU 计算（相交 / 相离 / 包含）', () => {
    expect(iou({ x: 0, y: 0, w: 100, h: 100 }, { x: 0, y: 0, w: 100, h: 100 })).toBe(1);
    expect(iou({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 10, h: 10 })).toBe(0);
    const inside = iou({ x: 0, y: 0, w: 100, h: 100 }, { x: 25, y: 25, w: 50, h: 50 });
    expect(inside).toBeCloseTo(0.25, 5);
  });

  it('列对齐：左边缘与中心线都收敛', () => {
    const frames = [
      { x: 24, y: 100, w: 200, h: 20 },
      { x: 27, y: 140, w: 100, h: 20 },
      { x: 300, y: 180, w: 60, h: 20 },
    ];
    const out = alignColumns(frames, 8);
    expect(out[0].x).toBe(24);
    expect(out[1].x).toBe(24);          // 27 与 24 差 3 → 归到 24
    expect(out[2].x).toBe(300);         // 独立列不受影响
  });

  it('列对齐：右边缘也能收敛（卡片/按钮的右对齐）', () => {
    const frames = [
      { x: 24, y: 100, w: 342, h: 40 },   // right = 366
      { x: 66, y: 160, w: 303, h: 40 },   // right = 369 → 归到 366
    ];
    const out = alignColumns(frames, 8);
    expect(out[0].x + out[0].w).toBe(366);
    expect(out[1].x + out[1].w).toBe(366);
  });

  it('列对齐不会把框推出画板', () => {
    const frames = [
      { x: 0, y: 0, w: 100, h: 20 },
      { x: 4, y: 40, w: 100, h: 20 },
    ];
    const out = alignColumns(frames, 8);
    for (const f of out) expect(f.x).toBeGreaterThanOrEqual(0);
  });

  it('流水线：像素映射 + 吸附 + 不越界', () => {
    const items = processModules([mod({ id: 'a', box: rbox(0.1, 0.1, 0.5, 0.02) })], board, { grid: 4 });
    expect(items).toHaveLength(1);
    expect(items[0].frame.x).toBe(40);   // 39 → 吸附到 40
    expect(items[0].frame.x + items[0].frame.w).toBeLessThanOrEqual(board.w);
  });

  it('IoU ≥0.6 只保留置信度高的那条', () => {
    const items = processModules([
      mod({ id: 'low', box: rbox(0.1, 0.1, 0.5, 0.1), confidence: 0.5 }),
      mod({ id: 'high', box: rbox(0.1, 0.1, 0.5, 0.1), confidence: 0.95 }),
    ], board);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('high');
  });

  it('IoU 0.3-0.6 保留但标记 overlapWarn', () => {
    const items = processModules([
      mod({ id: 'a', box: rbox(0.1, 0.1, 0.5, 0.1), confidence: 0.9 }),
      mod({ id: 'b', box: rbox(0.25, 0.1, 0.5, 0.1), confidence: 0.8 }),
    ], board, { flagIou: 0.3, mergeIou: 0.75 });
    expect(items).toHaveLength(2);
    expect(items.some(i => i.overlapWarn)).toBe(true);
  });

  it('置信度分级：<0.4 占位；0.4-0.7 警告；>0.7 正常', () => {
    const items = processModules([
      mod({ id: 'low', box: rbox(0.05, 0.05, 0.3, 0.05), confidence: 0.2 }),
      mod({ id: 'mid', box: rbox(0.05, 0.2, 0.3, 0.05), confidence: 0.5 }),
      mod({ id: 'ok', box: rbox(0.05, 0.35, 0.3, 0.05), confidence: 0.9 }),
    ], board);
    const byId = Object.fromEntries(items.map(i => [i.id, i]));
    expect(byId.low.placeholder).toBe(true);
    expect(byId.low.tier).toBe('low');
    expect(byId.mid.tier).toBe('warn');
    expect(byId.mid.placeholder).toBe(false);
    expect(byId.ok.tier).toBe('ok');
  });

  it('类型未知 → 占位（即使置信度很高）', () => {
    const items = processModules([mod({ id: 'x', type: 'group', known: false, confidence: 0.99, box: rbox(0.1, 0.1, 0.4, 0.1) })], board);
    expect(items[0].placeholder).toBe(true);
    expect(items[0].tier).toBe('ok');
  });

  it('绘制顺序：面积大的在前', () => {
    const items = processModules([
      mod({ id: 'small', box: rbox(0.1, 0.1, 0.2, 0.02) }),
      mod({ id: 'big', box: rbox(0.05, 0.3, 0.9, 0.2) }),
    ], board);
    expect(items.map(i => i.id)).toEqual(['big', 'small']);
  });
});
