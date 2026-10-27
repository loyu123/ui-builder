// AI-01/02 · 规则引擎（W4 纯规则版，不走模型）
// 输入：画板节点集；输出：结构化 Suggestion[]（含 evidence 数字与补丁命令）
// S2 开关：封版 5 类规则；S3 不做参考图识别（未实现）
import { absOrigin } from '../lib/tree';
import type { Board, Frame, Node } from '../types';

export type Patch =
  | { kind: 'setFrame'; id: string; frame: Frame }
  | { kind: 'setStyle'; id: string; key: string; value: string | number };

export interface Suggestion {
  id: string;
  rule: 'align' | 'spacing' | 'contrast' | 'hierarchy' | 'length';
  title: string;
  message: string;                 // 一句话说明 + 数字化证据
  evidence: Record<string, number | string>;
  patches: Patch[];
}

interface SnapNode {
  node: Node;
  abs: Frame;                      // 画板绝对坐标
  depth: number;
}

function snapshot(board: Board): SnapNode[] {
  const out: SnapNode[] = [];
  for (const n of Object.values(board.nodes)) {
    if (!n.parentId) continue;    // 跳过页面根
    const o = absOrigin(board, n.id);
    out.push({ node: n, abs: { x: o.x, y: o.y, w: n.frame.w, h: n.frame.h }, depth: depthOf(board, n.id) });
  }
  return out;
}

function depthOf(board: Board, id: string): number {
  let d = 0;
  let cur: Node | undefined = board.nodes[id];
  while (cur && cur.parentId) { d++; cur = board.nodes[cur.parentId]; }
  return d;
}

const R4 = (v: number) => Math.round(v);

// R1 · 对齐（≤4px 偏差归齐，向多数值看齐）
function ruleAlign(snap: SnapNode[], board: Board): Suggestion[] {
  const out: Suggestion[] = [];
  const byParent = new Map<string, SnapNode[]>();
  for (const s of snap) {
    const pid = s.node.parentId!;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(s);
  }
  for (const [pid, group] of byParent) {
    if (group.length < 2) continue;
    for (const axis of ['x', 'y'] as const) {
      const buckets = new Map<number, SnapNode[]>();
      for (const s of group) {
        const v = s.abs[axis];
        const key = R4(v / 4) * 4;            // 4px 聚类
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(s);
      }
      if (buckets.size < 2) continue;
      const sorted = [...buckets.entries()].sort((a, b) => b[1].length - a[1].length);
      const [majorKey] = sorted[0];
      const minor = sorted.slice(1).flatMap(([, arr]) => arr)
        .filter(s => Math.abs(s.abs[axis] - majorKey) <= 4);
      if (!minor.length) continue;
      const patches: Patch[] = minor.map(s => {
        const f = { ...s.node.frame };
        // 换算回父坐标：只修正差值（同父时画板差值=父坐标差值）
        const delta = majorKey - s.abs[axis];
        if (axis === 'x') f.x = R4(f.x + delta); else f.y = R4(f.y + delta);
        return { kind: 'setFrame' as const, id: s.node.id, frame: f };
      });
      out.push({
        id: `align-${pid}-${axis}`,
        rule: 'align',
        title: '对齐',
        message: `${minor.length} 个模块的 ${axis === 'x' ? '左边' : '顶边'} 与多数模块相差 ${minor.map(s => Math.abs(Math.round((axis === 'x' ? s.abs.x : s.abs.y) - majorKey))).join('/')}px，建议对齐到 ${axis === 'x' ? 'X' : 'Y'}=${majorKey}`,
        evidence: { 目标: majorKey, 模块数: minor.length, 相差px: Math.min(...minor.map(s => Math.abs(Math.round((axis === 'x' ? s.abs.x : s.abs.y) - majorKey)))) },
        patches,
      });
      void board;
    }
  }
  return out;
}

// R2 · 间距（垂直间距不是 8 的倍数 → 建议调到最近倍数）
function ruleSpacing(snap: SnapNode[]): Suggestion[] {
  const out: Suggestion[] = [];
  const byParent = new Map<string, SnapNode[]>();
  for (const s of snap) {
    const pid = s.node.parentId!;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(s);
  }
  for (const [pid, group] of byParent) {
    if (group.length < 3) continue;
    const sorted = [...group].sort((a, b) => a.abs.y - b.abs.y);
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].abs.y - (sorted[i - 1].abs.y + sorted[i - 1].abs.h);
      if (gap <= 0 || gap % 8 === 0) continue;
      const target = Math.round(gap / 8) * 8;
      if (target <= 0) continue;
      const delta = target - gap;
      const f = { ...sorted[i].node.frame };
      f.y = R4(f.y + delta);
      out.push({
        id: `spacing-${pid}-${i}`,
        rule: 'spacing',
        title: '等距栅格',
        message: `「${sorted[i].node.name}」与上方模块间距 ${R4(gap)}px，不是 8 的倍数，建议调整为 ${target}px`,
        evidence: { 当前间距: R4(gap), 建议间距: target, 调整px: R4(delta) },
        patches: [{ kind: 'setFrame', id: sorted[i].node.id, frame: f }],
      });
      break; // 每组只报第一条，避免刷屏
    }
  }
  return out;
}

// R3 · 对比度（WCAG，与不透明背景比值 <4.5 才报）
function luminance(hex: string): number {
  const m = hex.replace('#', '');
  if (m.length !== 6) return 0.5;
  // 每通道占 2 个 hex 字符：i=0 → 'RR'，i=1 → 'GG'，i=2 → 'BB'
  const f = (i: number) => {
    const c = parseInt(m.slice(i * 2, i * 2 + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(0) + 0.7152 * f(1) + 0.0722 * f(2);
}
function contrast(fg: string, bg: string): number {
  const l1 = luminance(fg), l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function ruleContrast(snap: SnapNode[]): Suggestion[] {
  const out: Suggestion[] = [];
  for (const s of snap) {
    const n = s.node;
    if (!n.style.color || !n.style.background) continue;
    const fg = String(n.style.color), bg = String(n.style.background);
    if (!fg.startsWith('#') || !bg.startsWith('#')) continue;
    const c = contrast(fg, bg);
    if (c >= 4.5) continue;
    // 建议把文字色压深：直接换 #1f2328 或按背景反色近似
    const suggest = luminance(bg) > 0.4 ? '#1f2328' : '#f9fafb';
    out.push({
      id: `contrast-${n.id}`,
      rule: 'contrast',
      title: '对比度不足',
      message: `「${n.name}」文字与背景对比度 ${c.toFixed(2)}:1，低于 4.5:1（WCAG AA），建议改为 ${suggest}`,
      evidence: { 当前对比度: Number(c.toFixed(2)), 最低要求: 4.5, 建议色: suggest },
      patches: [{ kind: 'setStyle', id: n.id, key: 'color', value: suggest }],
    });
    if (out.length >= 3) break;
  }
  return out;
}

// R4 · 字号层级（同页文字节点字号种类 >3 → 收敛到 24/16/13）
function ruleHierarchy(snap: SnapNode[]): Suggestion[] {
  const textNodes = snap.filter(s => ['heading', 'paragraph', 'stat'].includes(s.node.type));
  const sizes = new Set(textNodes.map(s => safeNum(s.node.style.fontSize, 14)));
  if (sizes.size <= 3 || textNodes.length < 4) return [];
  const CANON = [24, 16, 13];
  const patches: Patch[] = textNodes
    .filter(s => !CANON.includes(safeNum(s.node.style.fontSize, 14)))
    .map(s => {
      const cur = safeNum(s.node.style.fontSize, 14);
      const target = CANON.reduce((a, b) => Math.abs(b - cur) < Math.abs(a - cur) ? b : a);
      return { kind: 'setStyle' as const, id: s.node.id, key: 'fontSize', value: target };
    });
  if (!patches.length) return [];
  return [{
    id: 'hierarchy-global',
    rule: 'hierarchy',
    title: '字号层级收敛',
    message: `当前页面共 ${sizes.size} 种字号（${[...sizes].sort((a, b) => a - b).join('/')}），超过 3 种，建议收敛到 24/16/13`,
    evidence: { 字号种类: sizes.size, 规范: '24/16/13', 涉及模块: patches.length },
    patches,
  }];
}

// R5 · 文案长度（估算文本宽 > 模块宽 1.15 倍 → 建议缩短/加宽）
function ruleLength(snap: SnapNode[]): Suggestion[] {
  const out: Suggestion[] = [];
  for (const s of snap) {
    const n = s.node;
    const text = typeof n.props.text === 'string' ? n.props.text : typeof n.props.label === 'string' ? n.props.label : '';
    if (!text) continue;
    const fs = safeNum(n.style.fontSize, 14);
    const est = fs * text.length;          // 中文按 1em 宽估算
    if (est <= s.abs.w * 1.15) continue;
    out.push({
      id: `length-${n.id}`,
      rule: 'length',
      title: '文案可能溢出',
      message: `「${n.name}」文案 ${text.length} 字 × ${fs}px ≈ ${R4(est)}px，超出模块宽 ${s.abs.w}px 的 15%，建议缩短文案或加宽模块`,
      evidence: { 字数: text.length, 估算宽度: R4(est), 模块宽度: s.abs.w },
      patches: [],
    });
  }
  return out;
}

const safeNum = (v: unknown, d: number): number => (typeof v === 'number' ? v : d);

export function runRules(board: Board): Suggestion[] {
  const snap = snapshot(board);
  if (!snap.length) return [];
  return [
    ...ruleAlign(snap, board),
    ...ruleSpacing(snap),
    ...ruleContrast(snap),
    ...ruleHierarchy(snap),
    ...ruleLength(snap),
  ];
}
