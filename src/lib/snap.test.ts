// P1-14 · 吸附纯函数单测
import { describe, it, expect } from 'vitest';
import { matchSnap } from './snap';

describe('lib/snap · matchSnap', () => {
  it('在阈值内吸附到最近的候选线', () => {
    // 我的左边缘 97，候选 100（差 3 ≤ 阈值 6）→ d=+3 吸附
    expect(matchSnap([97], [0, 100, 200], 6)).toEqual({ d: 3, cand: 100 });
  });

  it('多个候选都超阈值时取绝对差最小者', () => {
    // 边 148：候选 150（差 2）与 144（差 4）→ 选 150
    expect(matchSnap([148], [150, 144], 6)).toEqual({ d: 2, cand: 150 });
  });

  it('所有候选都超出阈值时不吸附', () => {
    expect(matchSnap([130], [0, 100, 200], 6)).toBeNull();
  });

  it('检查我的每条边（左/中/右），取整体最优', () => {
    // 左边缘 198 距 200 差 2；中心 250 距 250 差 0 → 中心吸附更近
    expect(matchSnap([198, 250, 302], [200, 250], 6)).toEqual({ d: 0, cand: 250 });
  });
});
