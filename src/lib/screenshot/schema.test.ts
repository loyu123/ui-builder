// SS-02 · 契约校验：坏数据降级而非抛错
import { describe, it, expect } from 'vitest';
import { parseRecognition, MAX_MODULES, MAX_TEXT } from './schema';

const box = { x: 0.1, y: 0.2, w: 0.3, h: 0.1 };

describe('screenshot · 契约校验', () => {
  it('接受 {modules:[...]} 与裸数组两种形态', () => {
    expect(parseRecognition({ modules: [{ type: 'button', box }] }).modules).toHaveLength(1);
    expect(parseRecognition([{ type: 'button', box }]).modules).toHaveLength(1);
  });

  it('非对象 / 缺 box / 非数值 box 一律跳过并记录原因', () => {
    const r = parseRecognition({ modules: [null, { type: 'x' }, { type: 'y', box: { x: 1, y: 2, w: 0, h: 3 } }, { type: 'ok', box }] });
    expect(r.modules).toHaveLength(1);
    expect(r.dropped).toBe(3);
    expect(r.issues.map(i => i.reason)).toEqual(['not-object', 'bad-box', 'bad-box']);
  });

  it('置信度夹到 0-1，缺失时 0.5；text 去空白并截断', () => {
    const r = parseRecognition({ modules: [
      { type: 'a', box, confidence: 1.7, text: '  ' + 'x'.repeat(300) },
      { type: 'b', box, confidence: -1 },
      { type: 'c', box },
    ] });
    expect(r.modules[0].confidence).toBe(1);
    expect(r.modules[0].text).toHaveLength(MAX_TEXT);
    expect(r.modules[1].confidence).toBe(0);
    expect(r.modules[2].confidence).toBe(0.5);
  });

  it('type 缺失记为 bad-type 并降级为 unknown；style 非对象 → {}', () => {
    const r = parseRecognition({ modules: [{ box, style: [1, 2] }, { type: '  ', box }] });
    expect(r.modules[0].type).toBe('unknown');
    expect(r.modules[0].style).toEqual({});
    expect(r.issues.filter(i => i.reason === 'bad-type')).toHaveLength(2);
  });

  it('超过上限截断（over-limit）', () => {
    const many = Array.from({ length: MAX_MODULES + 5 }, () => ({ type: 'text', box }));
    const r = parseRecognition({ modules: many });
    expect(r.modules).toHaveLength(MAX_MODULES);
    expect(r.dropped).toBe(5);
    expect(r.issues.every(i => i.reason === 'over-limit')).toBe(true);
  });

  it('完全无法识别的输入返回空结果，不抛错', () => {
    expect(parseRecognition(null).modules).toEqual([]);
    expect(parseRecognition('nope').modules).toEqual([]);
    expect(parseRecognition({ foo: 1 }).modules).toEqual([]);
  });
});
