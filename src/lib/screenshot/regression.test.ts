// SS-11 · 回归：5 类典型截图的识别 JSON → 后处理结果必须「不越界 / 类型可落地 / 稳定可复现」
// 这里不依赖任何模型：把「模型应该给出的 JSON」当夹具，锁住后处理与映射的行为，
// 将来改吸附 / 对齐 / 去重阈值时，这 5 组会第一时间报警。
import { describe, it, expect } from 'vitest';
import { runPipeline } from './pipeline';
import { REGISTRY_MAP } from '../../modules/registry';
import type { Size } from './coords';

const mobile: Size = { w: 390, h: 844 };
const desktop: Size = { w: 1440, h: 900 };
const watch: Size = { w: 200, h: 242 };

interface Case { name: string; board: Size; json: unknown }

const CASES: Case[] = [
  {
    name: '登录页（标题 + 两个输入 + 按钮 + 未知图表）',
    board: mobile,
    json: {
      modules: [
        { type: 'heading', text: '欢迎回来', confidence: 0.93, box: { x: 0.08, y: 0.06, w: 0.6, h: 0.06 } },
        { type: 'input', text: '邮箱', confidence: 0.88, box: { x: 0.08, y: 0.26, w: 0.84, h: 0.07 } },
        { type: 'input', text: '密码', confidence: 0.86, box: { x: 0.08, y: 0.38, w: 0.84, h: 0.07 } },
        { type: 'button', text: '登录', confidence: 0.91, box: { x: 0.08, y: 0.52, w: 0.84, h: 0.08 } },
        { type: 'link', text: '忘记密码', confidence: 0.62, box: { x: 0.08, y: 0.62, w: 0.4, h: 0.03 } },
        { type: 'chart', text: '', confidence: 0.55, box: { x: 0.08, y: 0.74, w: 0.84, h: 0.18 } },
      ],
    },
  },
  {
    name: '列表页（顶栏 + 5 行 + 底部标签栏）',
    board: mobile,
    json: {
      modules: [
        { type: 'nav', text: '消息', confidence: 0.9, box: { x: 0, y: 0.02, w: 1, h: 0.06 } },
        ...[0, 1, 2, 3, 4].map(n => ({
          type: 'list', text: `联系人 ${n + 1}`, confidence: 0.88,
          box: { x: 0.05, y: 0.12 + n * 0.1, w: 0.9, h: 0.08 },
        })),
        { type: 'tabbar', text: '', confidence: 0.9, box: { x: 0, y: 0.94, w: 1, h: 0.06 } },
      ],
    },
  },
  {
    name: '文章页（大图 + 标题 + 正文 + 分割线）',
    board: mobile,
    json: {
      modules: [
        { type: 'image', text: '封面', confidence: 0.9, box: { x: 0, y: 0, w: 1, h: 0.28 } },
        { type: 'heading', text: '标题', confidence: 0.92, box: { x: 0.06, y: 0.31, w: 0.88, h: 0.05 } },
        { type: 'paragraph', text: '第一段', confidence: 0.84, box: { x: 0.06, y: 0.38, w: 0.88, h: 0.1 } },
        { type: 'paragraph', text: '第二段', confidence: 0.81, box: { x: 0.06, y: 0.5, w: 0.88, h: 0.1 } },
        { type: 'divider', text: '', confidence: 0.7, box: { x: 0.06, y: 0.62, w: 0.88, h: 0.004 } },
      ],
    },
  },
  {
    name: '数据页（桌面：两块指标 + 表格 + 进度条）',
    board: desktop,
    json: {
      modules: [
        { type: 'stat', text: '访问量', confidence: 0.9, box: { x: 0.05, y: 0.08, w: 0.2, h: 0.1 } },
        { type: 'stat', text: '转化率', confidence: 0.88, box: { x: 0.27, y: 0.08, w: 0.2, h: 0.1 } },
        { type: 'table', text: '明细', confidence: 0.85, box: { x: 0.05, y: 0.24, w: 0.9, h: 0.42 } },
        { type: 'progress', text: '', confidence: 0.66, box: { x: 0.05, y: 0.72, w: 0.9, h: 0.02 } },
        { type: 'notification', text: '同步完成', confidence: 0.58, box: { x: 0.05, y: 0.8, w: 0.9, h: 0.06 } },
      ],
    },
  },
  {
    name: '手表（表盘 + 两行列表）',
    board: watch,
    json: {
      modules: [
        { type: 'watch-face', text: '', confidence: 0.9, box: { x: 0.1, y: 0.05, w: 0.8, h: 0.5 } },
        { type: 'watch-row', text: '心率', confidence: 0.86, box: { x: 0.1, y: 0.62, w: 0.8, h: 0.14 } },
        { type: 'watch-row', text: '步数', confidence: 0.84, box: { x: 0.1, y: 0.78, w: 0.8, h: 0.14 } },
      ],
    },
  },
];

describe('screenshot · 典型截图回归', () => {
  for (const c of CASES) {
    it(`${c.name}：不越界、类型可落地、结果可复现`, () => {
      const r = runPipeline(c.json, c.board);
      expect(r.items.length).toBeGreaterThan(0);

      for (const it of r.items) {
        expect(REGISTRY_MAP[it.type]).toBeTruthy();      // 绝不产出注册表里没有的 type
        expect(it.frame.w).toBeGreaterThanOrEqual(2);
        expect(it.frame.h).toBeGreaterThanOrEqual(2);
        expect(it.frame.x).toBeGreaterThanOrEqual(0);
        expect(it.frame.y).toBeGreaterThanOrEqual(0);
        expect(it.frame.x + it.frame.w).toBeLessThanOrEqual(c.board.w);
        expect(it.frame.y + it.frame.h).toBeLessThanOrEqual(c.board.h);
      }

      // id 唯一 + 同输入同输出（无随机、无时间依赖）
      const ids = r.items.map(i => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(runPipeline(c.json, c.board)).toEqual(r);
    });
  }

  it('未知类型仍保留为占位块，不会被悄悄丢掉', () => {
    const r = runPipeline(CASES[0].json, mobile);
    const chart = r.items.find(i => i.rawType === 'chart');
    expect(chart?.placeholder).toBe(true);
    expect(REGISTRY_MAP[chart!.type]).toBeTruthy();
  });

  it('低置信度（<0.4）降级为占位块', () => {
    const r = runPipeline({
      modules: [{ type: 'button', text: '提交', confidence: 0.3, box: { x: 0.1, y: 0.5, w: 0.8, h: 0.08 } }],
    }, mobile);
    expect(r.items[0].tier).toBe('low');
    expect(r.items[0].placeholder).toBe(true);
  });

  it('列表行：相邻行不会被误判为重复', () => {
    const r = runPipeline(CASES[1].json, mobile);
    const rows = r.items.filter(i => i.type === 'list-item');
    expect(rows.length).toBe(5);
  });
});
