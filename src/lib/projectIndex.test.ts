// F1 · 多项目索引纯函数单测：容错解析 / 插入排序 / 删除回退 / 旧数据迁移 / 自愈剔除
import { describe, it, expect } from 'vitest';
import {
  emptyIndex, parseIndex, entryOf, upsertEntry, removeEntry, pruneIds, indexFromLegacy,
  type ProjectEntry,
} from './projectIndex';

const at = (iso: string) => new Date(iso);
const e = (id: string, name: string, iso: string): ProjectEntry => ({ id, name, updatedAt: iso });

describe('lib/projectIndex · 多项目索引', () => {
  it('parseIndex 对任意脏数据返回空索引（不抛错）', () => {
    for (const raw of [null, undefined, 42, 'x', {}, { list: 'nope' }, { list: [{}] }]) {
      expect(parseIndex(raw)).toEqual(emptyIndex());
    }
  });

  it('parseIndex 修正失效 currentId（指向不存在的项目时回退首个）', () => {
    const raw = {
      version: 1, currentId: 'ghost',
      list: [e('a', 'A', '2026-10-01T00:00:00.000Z'), e('b', 'B', '2026-10-02T00:00:00.000Z')],
    };
    const idx = parseIndex(raw);
    expect(idx.currentId).toBe('a');
    expect(idx.list.length).toBe(2);
  });

  it('parseIndex 补齐缺失的 updatedAt（非法时间退化为纪元）', () => {
    const idx = parseIndex({ currentId: 'a', list: [{ id: 'a', name: 'A' }] });
    expect(idx.list[0].updatedAt).toBe(new Date(0).toISOString());
  });

  it('upsertEntry：新条目插到最前，重复 id 覆盖而非重复，currentId 空时自动取该项', () => {
    let idx = emptyIndex();
    idx = upsertEntry(idx, entryOf({ id: 'a', name: 'A' }, at('2026-10-01T00:00:00.000Z')));
    expect(idx.currentId).toBe('a');

    idx = upsertEntry(idx, entryOf({ id: 'b', name: 'B' }, at('2026-10-02T00:00:00.000Z')));
    expect(idx.list.map(x => x.id)).toEqual(['b', 'a']);

    idx = upsertEntry(idx, entryOf({ id: 'a', name: 'A2' }, at('2026-10-03T00:00:00.000Z')));
    expect(idx.list.map(x => x.id)).toEqual(['a', 'b']);
    expect(idx.list[0].name).toBe('A2');
    expect(idx.currentId).toBe('a');
  });

  it('removeEntry：删除非当前项不影响 currentId；删除当前项回退列表首个', () => {
    const base = {
      version: 1 as const, currentId: 'a',
      list: [e('a', 'A', '2026-10-03T00:00:00.000Z'), e('b', 'B', '2026-10-02T00:00:00.000Z')],
    };
    expect(removeEntry(base, 'b')).toMatchObject({ currentId: 'a' });
    expect(removeEntry(base, 'b').list.map(x => x.id)).toEqual(['a']);
    expect(removeEntry(base, 'a').currentId).toBe('b');
    expect(removeEntry(removeEntry(base, 'a'), 'b').currentId).toBeNull();
  });

  it('pruneIds：批量剔除缺失数据条目并修正 currentId', () => {
    const base = {
      version: 1 as const, currentId: 'a',
      list: [
        e('a', 'A', '2026-10-03T00:00:00.000Z'),
        e('b', 'B', '2026-10-02T00:00:00.000Z'),
        e('c', 'C', '2026-10-01T00:00:00.000Z'),
      ],
    };
    const out = pruneIds(base, ['a', 'c']);
    expect(out.list.map(x => x.id)).toEqual(['b']);
    expect(out.currentId).toBe('b');
  });

  it('indexFromLegacy：旧单项目数据升级为单条目索引', () => {
    const idx = indexFromLegacy({ id: 'p1', name: '旧项目' }, at('2026-10-05T00:00:00.000Z'));
    expect(idx.currentId).toBe('p1');
    expect(idx.list).toEqual([{ id: 'p1', name: '旧项目', updatedAt: '2026-10-05T00:00:00.000Z' }]);
  });
});
