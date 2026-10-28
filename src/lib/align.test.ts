// F4 · 对齐/分布纯函数单测：6 向对齐、等距分布（不等距/已等距/恰好 3 个/不足 3 个）、外接矩形
import { describe, it, expect } from 'vitest';
import { alignFrames, bounds, distributeFrames, type AlignItem } from './align';

const it0 = (id: string, x: number, y: number, w: number, h: number): AlignItem => ({ id, frame: { x, y, w, h } });
const byId = (patches: Array<{ id: string; frame: { x: number; y: number } }>, id: string) =>
  patches.find(p => p.id === id)!.frame;

// 三个不等大小、不同位置的节点
const items: AlignItem[] = [it0('a', 10, 20, 100, 40), it0('b', 200, 100, 60, 20), it0('c', 300, 60, 40, 80)];

describe('lib/align · bounds', () => {
  it('公共外接矩形覆盖全部节点', () => {
    expect(bounds(items)).toEqual({ x: 10, y: 20, w: 330, h: 120 });   // x 10..340, y 20..140
  });
});

describe('lib/align · alignFrames', () => {
  it('<2 个节点不产生补丁', () => {
    expect(alignFrames([items[0]], 'left')).toEqual([]);
    expect(alignFrames([], 'left')).toEqual([]);
  });

  it('左右上下四向对齐到公共边界', () => {
    expect(byId(alignFrames(items, 'left'), 'b')).toMatchObject({ x: 10 });
    expect(byId(alignFrames(items, 'right'), 'b')).toMatchObject({ x: 340 - 60 });
    expect(byId(alignFrames(items, 'top'), 'c')).toMatchObject({ y: 20 });
    expect(byId(alignFrames(items, 'bottom'), 'b')).toMatchObject({ y: 140 - 20 });
  });

  it('水平/垂直居中对齐到公共中心（取整）', () => {
    const hc = alignFrames(items, 'hcenter');
    expect(byId(hc, 'a')).toMatchObject({ x: Math.round(10 + (330 - 100) / 2) });
    expect(byId(hc, 'c')).toMatchObject({ x: Math.round(10 + (330 - 40) / 2) });

    const vc = alignFrames(items, 'vcenter');
    expect(byId(vc, 'a')).toMatchObject({ y: Math.round(20 + (120 - 40) / 2) });
    expect(byId(vc, 'b')).toMatchObject({ y: Math.round(20 + (120 - 20) / 2) });
  });

  it('对齐只改目标轴（另一轴保持不变）', () => {
    const patches = alignFrames(items, 'left');
    expect(byId(patches, 'b')).toMatchObject({ x: 10, y: 100 });
  });
});

describe('lib/align · distributeFrames', () => {
  it('<3 个节点不产生补丁（首尾固定无意义）', () => {
    expect(distributeFrames(items.slice(0, 2), 'h')).toEqual([]);
  });

  it('水平等距：首尾固定，中间节点等分净间距', () => {
    // a: 0..100, c: 300..400（首尾固定），b 宽 50 → 净间距 (300-100-50)/2 = 75
    const list = [it0('a', 0, 0, 100, 20), it0('b', 120, 0, 50, 20), it0('c', 300, 0, 100, 20)];
    const out = distributeFrames(list, 'h');
    expect(out).toEqual([{ id: 'b', frame: { x: 175, y: 0, w: 50, h: 20 } }]);
  });

  it('垂直等距：按 y 排序后等分，输入顺序不影响结果', () => {
    const list = [it0('c', 0, 400, 20, 100), it0('a', 0, 0, 20, 80), it0('b', 0, 150, 20, 40)];
    const out = distributeFrames(list, 'v');
    // a 0..80，c 400..500，b 高 40 → 净间距 (400-80-40)/2 = 140 → b.y = 80+140 = 220
    expect(out).toEqual([{ id: 'b', frame: { x: 0, y: 220, w: 20, h: 40 } }]);
  });

  it('已等距时位置不变（幂等）', () => {
    const list = [it0('a', 0, 0, 100, 20), it0('b', 200, 0, 100, 20), it0('c', 400, 0, 100, 20)];
    expect(distributeFrames(list, 'h')[0].frame.x).toBe(200);
  });

  it('四个节点：中间两个等距', () => {
    const list = [
      it0('a', 0, 0, 100, 10), it0('b', 110, 0, 20, 10),
      it0('c', 200, 0, 20, 10), it0('d', 400, 0, 100, 10),
    ];
    const out = distributeFrames(list, 'h');
    // 净宽 = 400-100-40 = 260，/3 ≈ 86.67
    const gap = 260 / 3;
    expect(out.map(p => p.id)).toEqual(['b', 'c']);
    expect(out[0].frame.x).toBe(Math.round(100 + gap));
    expect(out[1].frame.x).toBe(Math.round(100 + gap + 20 + gap));
  });

  it('重叠时净间距为负也不崩（数学值等分）', () => {
    const list = [it0('a', 0, 0, 100, 10), it0('b', 10, 0, 100, 10), it0('c', 40, 0, 100, 10)];
    const out = distributeFrames(list, 'h');
    expect(out.length).toBe(1);
    expect(Number.isFinite(out[0].frame.x)).toBe(true);
  });
});
