// 导入体积护栏：ASCII / 多字节估算与上限判定
import { describe, it, expect } from 'vitest';
import { MAX_IMPORT_BYTES, isOversizedImport } from './importGuard';

describe('importGuard · 导入体积上限', () => {
  it('小文件放行', () => {
    expect(isOversizedImport('{}')).toBe(false);
    expect(isOversizedImport('x'.repeat(1024))).toBe(false);
  });

  it('ASCII 恰好到上限仍放行，多 1 字节即拒', () => {
    expect(isOversizedImport('x'.repeat(MAX_IMPORT_BYTES))).toBe(false);
    expect(isOversizedImport('x'.repeat(MAX_IMPORT_BYTES + 1))).toBe(true);
  });

  it('中文按 3 字节估算，字符数没超也可能超限', () => {
    const chars = Math.floor(MAX_IMPORT_BYTES / 3);
    expect(isOversizedImport('中'.repeat(chars))).toBe(false);
    expect(isOversizedImport('中'.repeat(chars + 1))).toBe(true);
  });

  it('支持自定义上限（便于测试与将来调参）', () => {
    expect(isOversizedImport('abcd', 3)).toBe(true);
    expect(isOversizedImport('abc', 3)).toBe(false);
  });
});
