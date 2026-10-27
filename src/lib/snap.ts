// P1-14 · 吸附纯函数（从 Canvas.applySnap 提取，可独立单测）：
// 拖动模块的边/中心 vs 候选线（画板边缘/中线/其他模块的边与中心），取绝对差最小的候选
export function matchSnap(
  myEdges: number[],
  cands: number[],
  th: number,
): { d: number; cand: number } | null {
  let best: { d: number; cand: number } | null = null;
  for (const me of myEdges) {
    for (const c of cands) {
      const d = c - me;
      if (Math.abs(d) <= th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, cand: c };
    }
  }
  return best;
}
