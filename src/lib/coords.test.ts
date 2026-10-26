// DV-02 · 6 条坐标换算单测（对应落地实施方案 5.3 节验收表）
// 全绿之前不允许动 CV-04/CV-06（硬约束）
import { describe, it, expect } from 'vitest';
import { screenToBoard, boardToParent, deltaToBoard } from './coords';

describe('DV-02 坐标换算', () => {
  it('用例1 · zoom=1：画板(100,50) 拖动(+30,+20) → frame(130,70)', () => {
    const rect = { left: 0, top: 0 };
    const start = screenToBoard(100, 50, rect, 1);
    const d = deltaToBoard(30, 20, 1);
    expect(start.x + d.x).toBe(130);
    expect(start.y + d.y).toBe(70);
  });

  it('用例2 · zoom=0.5：屏幕位移(+30,+20) → 画板位移(+60,+40)', () => {
    const d = deltaToBoard(30, 20, 0.5);
    expect(d.x).toBeCloseTo(60);
    expect(d.y).toBeCloseTo(40);
  });

  it('用例3 · zoom=1.5：屏幕位移(+30,+20) → 画板位移(+20,+13.33)', () => {
    const d = deltaToBoard(30, 20, 1.5);
    expect(d.x).toBeCloseTo(20);
    expect(d.y).toBeCloseTo(13.333, 2);
  });

  it('用例4 · 节点在容器内（容器画板原点偏移12,12）：画板点(20,20) → 父坐标(8,8)', () => {
    const boardPt = screenToBoard(20, 20, { left: 0, top: 0 }, 1);
    const parentPt = boardToParent(boardPt, { x: 12, y: 12 });
    expect(parentPt.x).toBe(8);
    expect(parentPt.y).toBe(8);
  });

  it('用例5 · 嵌套两层：偏移正确累加，最终落点 = 鼠标位置', () => {
    // 分组容器在画板 (100,80)，卡片在分组内 (12,12)，画板 zoom=1
    // 鼠标屏幕点 = 画板(140,120)（rect.left=0）
    const boardPt = screenToBoard(140, 120, { left: 0, top: 0 }, 1);
    const inGroup = boardToParent(boardPt, { x: 100, y: 80 });   // 分组内 (40,40)
    const inCard = boardToParent(inGroup, { x: 12, y: 12 });      // 卡片内 (28,28)
    // 反向验证：卡片内坐标 + 两层原点 = 屏幕落点
    const back = boardToParent(inCard, { x: -(100 + 12), y: -(80 + 12) });
    expect(inCard.x).toBe(28);
    expect(inCard.y).toBe(28);
    expect(back.x).toBe(140);
    expect(back.y).toBe(120);
  });

  it('用例6 · 画板滚动到视口外后再拖：rect 已含滚动，落点仍准确', () => {
    // 滚动后画板左上角移出视口（rect.left = -50, top = -80）
    const rect = { left: -50, top: -80 };
    const p = screenToBoard(50, 100, rect, 1);
    expect(p.x).toBe(100);
    expect(p.y).toBe(180);
  });
});
