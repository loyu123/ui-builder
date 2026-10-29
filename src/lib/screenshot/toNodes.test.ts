// SS-07 · 结果 → NodeSpec：props 文案落到对应键，占位块带虚线外观与提示
import { describe, it, expect } from 'vitest';
import { toNodeSpecs, PLACEHOLDER_STYLE } from './toNodes';
import { PLACEHOLDER_TYPE } from './mapType';
import type { ProcessedModule } from './postprocess';

function item(patch: Partial<ProcessedModule>): ProcessedModule {
  return {
    id: 'm1', rawType: 'button', type: 'button-primary', known: true, confidence: 0.9,
    box: { x: 0.1, y: 0.2, w: 0.5, h: 0.06 }, text: '立即购买', style: { background: '#FF3B30' },
    frame: { x: 24, y: 300, w: 342, h: 48 }, tier: 'ok', placeholder: false, overlapWarn: false,
    ...patch,
  };
}

describe('screenshot · 落地规格', () => {
  it('文本落到各模块自己的 props 键', () => {
    expect(toNodeSpecs([item({ type: 'heading' })])[0].props).toEqual({ text: '立即购买' });
    expect(toNodeSpecs([item({ type: 'button-primary' })])[0].props).toEqual({ label: '立即购买' });
    expect(toNodeSpecs([item({ type: 'topnav' })])[0].props).toEqual({ title: '立即购买' });
    expect(toNodeSpecs([item({ type: 'list-item' })])[0].props).toEqual({ title: '立即购买' });
    expect(toNodeSpecs([item({ type: 'image' })])[0].props).toEqual({ alt: '立即购买' });
  });

  it('输入类没有识别文本时给占位文案，label 清空避免误导', () => {
    expect(toNodeSpecs([item({ type: 'input' })])[0].props).toEqual({ label: '', placeholder: '立即购买' });
    expect(toNodeSpecs([item({ type: 'input', text: '' })])[0].props).toEqual({});
  });

  it('识别不出文字时 props 为空，不写脏值', () => {
    expect(toNodeSpecs([item({ text: '' })])[0].props).toEqual({});
  });

  it('占位块：改用真实占位类型 + 虚线样式 + 名称 + 提示', () => {
    const spec = toNodeSpecs([item({ type: 'paragraph', known: false, rawType: 'chart', placeholder: true })])[0];
    expect(spec.type).toBe(PLACEHOLDER_TYPE);
    expect(spec.style).toEqual(PLACEHOLDER_STYLE);
    expect(spec.name).toBe('未知模块');
    expect(spec.note).toContain('chart');
  });

  it('低置信度占位块提示里带置信度；正常块保留样式', () => {
    const low = toNodeSpecs([item({ confidence: 0.32, placeholder: true })])[0];
    expect(low.note).toContain('0.32');
    const ok = toNodeSpecs([item({})])[0];
    expect(ok.style).toEqual({ background: '#FF3B30' });
    expect(ok.note).toBeUndefined();
  });

  it('重叠警告写进 note', () => {
    expect(toNodeSpecs([item({ overlapWarn: true })])[0].note).toContain('重叠');
  });
});
