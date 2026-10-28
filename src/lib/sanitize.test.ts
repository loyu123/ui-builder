// 安全净化纯函数：图片协议白名单 / HTML 转义 / 单行安全文本
import { describe, it, expect } from 'vitest';
import { isSafeImageUrl, safeImageSrc, escapeHtml, safeInlineText } from './sanitize';

describe('sanitize · 输入净化', () => {
  it('图片地址只放行 http(s) / blob / data:image / 相对路径', () => {
    expect(isSafeImageUrl('https://cdn.example.com/a.png')).toBe(true);
    expect(isSafeImageUrl('http://192.168.1.9/a.png')).toBe(true);
    expect(isSafeImageUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isSafeImageUrl('data:image/svg+xml;utf8,<svg/>')).toBe(true);
    expect(isSafeImageUrl('/assets/a.png')).toBe(true);
    expect(isSafeImageUrl('blob:https://x/1')).toBe(true);
  });

  it('危险协议一律拒绝', () => {
    expect(isSafeImageUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeImageUrl('JavaScript:alert(1)')).toBe(false);
    expect(isSafeImageUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeImageUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeImageUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeImageUrl('')).toBe(false);
    expect(isSafeImageUrl(undefined)).toBe(false);
    expect(isSafeImageUrl(123)).toBe(false);
  });

  it('safeImageSrc 不安全时回退空串', () => {
    expect(safeImageSrc(' https://a/b.png ')).toBe('https://a/b.png');
    expect(safeImageSrc('javascript:alert(1)')).toBe('');
  });

  it('HTML 转义挡掉标签注入', () => {
    expect(escapeHtml('</title><script>alert(1)</script>'))
      .toBe('&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escapeHtml('a & "b" \'c\'')).toBe('a &amp; &quot;b&quot; &#39;c&#39;');
  });

  it('safeInlineText 去换行与模板字符串元字符，并截断超长', () => {
    expect(safeInlineText('登\n录\t页')).toBe('登 录 页');
    // 反引号与 $ 被剥掉（${ 不再成立），花括号本身无害
    expect(safeInlineText('a`b${c}')).toBe('ab{c}');
    expect(safeInlineText('x'.repeat(200)).length).toBe(120);
    expect(safeInlineText('  a   b  ')).toBe('a b');
  });
});
