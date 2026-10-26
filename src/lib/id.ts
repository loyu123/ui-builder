// 8 位 id（nanoid 风格），足够本项目使用
const CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';
export function uid(prefix = 'n'): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return `${prefix}_${s}`;
}
