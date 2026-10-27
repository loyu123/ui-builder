// P1-14 · 手势纯函数单测：缩放推框（八向/最小值/Shift 锁比例）与框选命中
import { describe, it, expect } from 'vitest';
import { resizeFrame, marqueeHits, RESIZE_MIN } from './gesture';
import type { Frame, Node } from '../../types';

const F = (x: number, y: number, w: number, h: number): Frame => ({ x, y, w, h });

function mkNode(id: string, x: number, y: number, w: number, h: number): Node {
  return {
    id, type: 'card', name: id, parentId: 'root', children: [],
    frame: F(x, y, w, h), style: {}, props: {}, events: {},
  } as Node;
}

describe('canvas/gesture · resizeFrame', () => {
  it('e/s 拉伸只改宽高；小于 MIN 时钳制', () => {
    expect(resizeFrame(F(10, 10, 100, 80), 'e', 40, 0, false)).toEqual(F(10, 10, 140, 80));
    expect(resizeFrame(F(10, 10, 100, 80), 's', 0, -30, false)).toEqual(F(10, 10, 100, 50));
    expect(resizeFrame(F(10, 10, 100, 80), 's', 0, -200, false)).toEqual(F(10, 10, 100, RESIZE_MIN));
  });

  it('w/n 拉伸保持右/下边不动（x/y 补偿）', () => {
    expect(resizeFrame(F(10, 10, 100, 80), 'w', 20, 0, false)).toEqual(F(30, 10, 80, 80));
    expect(resizeFrame(F(10, 10, 100, 80), 'n', 0, 30, false)).toEqual(F(10, 40, 100, 50));
  });

  it('角点 se/ne 组合双向生效', () => {
    expect(resizeFrame(F(0, 0, 100, 100), 'se', 50, 20, false)).toEqual(F(0, 0, 150, 120));
    // ne：向右上拖 → 东边内收变窄、北边上移变高（y 补偿）
    const ne = resizeFrame(F(0, 0, 100, 100), 'ne', -30, -40, false);
    expect(ne).toEqual(F(0, -40, 70, 140));
  });

  it('Shift 仅角点锁比例：se 以宽驱动高', () => {
    const out = resizeFrame(F(0, 0, 100, 50), 'se', 100, 0, true);   // ratio 2:1
    expect(out.w).toBe(200);
    expect(out.h).toBe(100);
  });

  it('Shift 对边中点手柄（单字符）无效', () => {
    expect(resizeFrame(F(0, 0, 100, 50), 'e', 100, 999, true)).toEqual(F(0, 0, 200, 50));
  });

  it('Shift + nw：左上角补偿保持比例', () => {
    const out = resizeFrame(F(100, 100, 100, 50), 'nw', -100, 0, true);   // w 200, h 100
    expect(out).toEqual(F(0, 50, 200, 100));
  });
});

describe('canvas/gesture · marqueeHits', () => {
  const kids = [mkNode('a', 0, 0, 100, 50), mkNode('b', 120, 0, 80, 40), mkNode('c', 0, 100, 60, 60)];

  it('矩形 <3px 视为点击，不命中任何节点', () => {
    expect(marqueeHits(kids, F(0, 0, 2, 2))).toEqual([]);
  });

  it('相交判定：命中 a、b，不命中不相交的 c', () => {
    expect(marqueeHits(kids, F(50, 0, 100, 30))).toEqual(['a', 'b']);
  });

  it('边界相切（零面积交集）不算命中', () => {
    expect(marqueeHits(kids, F(100, 0, 21, 10))).toEqual(['b']);   // 右边 121 越过 b 左边 120
    expect(marqueeHits(kids, F(100, 0, 20, 10))).toEqual([]);      // 右边 120 与 b 左边 120 相切
    expect(marqueeHits(kids, F(101, 0, 19, 10))).toEqual([]);
  });

  it('完全包含所有节点时全部命中', () => {
    expect(marqueeHits(kids, F(0, 0, 500, 500))).toEqual(['a', 'b', 'c']);
  });
});
