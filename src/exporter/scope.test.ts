// F8 · 导出范围纯函数：页面裁剪 / 设备归一化 / 默认导出设备
import { describe, it, expect } from 'vitest';
import { useStore, createEmptyProject } from '../store';
import type { Project } from '../types';
import {
  EXPORT_DEVICES, normalizeDevices, scopeProject, defaultDevice, applyExportScope,
} from './scope';

/** 两页项目：Page / Page2（addPage 会生成稳定顺序，便于断言顺序保持） */
function twoPageProject(): Project {
  useStore.setState({ project: createEmptyProject() });
  useStore.getState().actions.addPage();
  return useStore.getState().project;
}

describe('F8 · 导出范围', () => {
  it('设备缺省 / 空数组 / 全非法值都回退到全部（固定顺序）', () => {
    expect(normalizeDevices()).toEqual([...EXPORT_DEVICES]);
    expect(normalizeDevices([])).toEqual([...EXPORT_DEVICES]);
    expect(normalizeDevices(['tv', ''])).toEqual([...EXPORT_DEVICES]);
  });

  it('设备按固定顺序去重，不受勾选顺序影响', () => {
    expect(normalizeDevices(['watch', 'mobile', 'watch'])).toEqual(['mobile', 'watch']);
    expect(normalizeDevices(['watch'])).toEqual(['watch']);
  });

  it('页面缺省 → 原对象；只保留勾选页并保持项目内顺序', () => {
    const p = twoPageProject();
    expect(scopeProject(p)).toBe(p);
    expect(scopeProject(p, [])).toBe(p);

    const [first, second] = p.pages;
    // 逆序传入，输出仍按项目顺序
    const scoped = scopeProject(p, [second.id, first.id]);
    expect(scoped.pages.map(x => x.id)).toEqual([first.id, second.id]);
    expect(scopeProject(p, [second.id]).pages.map(x => x.id)).toEqual([second.id]);
  });

  it('未知页面 id 被忽略；全都无效时回退全量（不产出空工程）', () => {
    const p = twoPageProject();
    expect(scopeProject(p, ['nope'])).toBe(p);
    expect(scopeProject(p, ['nope', p.pages[1].id]).pages).toHaveLength(1);
  });

  it('默认导出设备：移动端优先，否则取范围内第一个', () => {
    expect(defaultDevice(['desktop', 'mobile', 'watch'])).toBe('mobile');
    expect(defaultDevice(['desktop', 'watch'])).toBe('desktop');
    expect(defaultDevice(['watch'])).toBe('watch');
    expect(defaultDevice([])).toBe('mobile');   // 理论不可达，兜底不炸
  });

  it('applyExportScope 同时返回裁剪后的项目与设备范围', () => {
    const p = twoPageProject();
    const r = applyExportScope(p, { pageIds: [p.pages[0].id], devices: ['mobile'] });
    expect(r.project.pages).toHaveLength(1);
    expect(r.devices).toEqual(['mobile']);
  });
});
