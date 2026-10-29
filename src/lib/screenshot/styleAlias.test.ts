// SS-04 · 样式白名单：只保留我们会渲染的键，值必须合法
import { describe, it, expect } from 'vitest';
import { mapStyle } from './styleAlias';

describe('screenshot · 样式白名单', () => {
  it('键名别名归一（backgroundColor / bg / text-color …）', () => {
    const s = mapStyle({ backgroundColor: '#FF3B30', textColor: '#ffffff', borderRadius: 8, 'font-size': 16 });
    expect(s).toEqual({ background: '#FF3B30', color: '#ffffff', radius: 8, fontSize: 16 });
  });

  it('非法颜色 / 未知键 / 非对象一律丢弃', () => {
    expect(mapStyle({ background: 'red; drop table', color: 'url(javascript:1)' })).toEqual({});
    expect(mapStyle({ unknownKey: 1, gap: '4px' })).toEqual({});
    expect(mapStyle(null)).toEqual({});
    expect(mapStyle([1, 2])).toEqual({});
  });

  it('数值夹到安全区间并取整', () => {
    expect(mapStyle({ fontSize: 200 })).toEqual({ fontSize: 48 });
    expect(mapStyle({ fontSize: 2 })).toEqual({ fontSize: 8 });
    expect(mapStyle({ borderRadius: -5 })).toEqual({ radius: 0 });
    expect(mapStyle({ fontWeight: 650.4 })).toEqual({ fontWeight: 650 });
    expect(mapStyle({ fontSize: 'abc' })).toEqual({});
  });

  it('border / boxShadow 只接受安全形状', () => {
    expect(mapStyle({ border: '1px dashed #94a3b8' })).toEqual({ border: '1px dashed #94a3b8' });
    expect(mapStyle({ border: 'expression(alert(1))' })).toEqual({});
    expect(mapStyle({ boxShadow: '0 4px 12px rgba(0,0,0,.1)' })).toEqual({ boxShadow: '0 4px 12px rgba(0,0,0,.1)' });
    expect(mapStyle({ boxShadow: 'x;} body{display:none' })).toEqual({});
  });

  it('rgba / hsla / 透明色可用', () => {
    expect(mapStyle({ background: 'rgba(37,99,235,.06)' })).toEqual({ background: 'rgba(37,99,235,.06)' });
    expect(mapStyle({ background: 'transparent' })).toEqual({ background: 'transparent' });
  });
});
