// SS-04 · 样式白名单：模型给的 style 键名五花八门，只翻译我们真正会渲染的那几个，
// 其余丢弃（否则脏键会一路进导出产物）
export type StyleValue = string | number;

const KEY_ALIAS: Record<string, string> = {
  background: 'background',
  bg: 'background',
  backgroundColor: 'background',
  'background-color': 'background',
  color: 'color',
  textColor: 'color',
  'text-color': 'color',
  foreground: 'color',
  radius: 'radius',
  borderRadius: 'radius',
  'border-radius': 'radius',
  fontSize: 'fontSize',
  'font-size': 'fontSize',
  fontWeight: 'fontWeight',
  'font-weight': 'fontWeight',
  boxShadow: 'boxShadow',
  'box-shadow': 'boxShadow',
  border: 'border',
};

const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\)|hsla?\([\d.,\s%]+\)|transparent|currentColor)$/i;
const BORDER_RE = /^\d{1,2}px (solid|dashed|dotted) (#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\)|[a-z]+)$/i;

const NUM_RANGE: Record<string, [number, number]> = {
  radius: [0, 48],
  fontSize: [8, 48],
  fontWeight: [100, 900],
};

function normalizeValue(key: string, raw: unknown): StyleValue | null {
  if (key === 'background' || key === 'color') {
    return typeof raw === 'string' && COLOR_RE.test(raw.trim()) ? raw.trim() : null;
  }
  if (key === 'boxShadow') {
    return typeof raw === 'string' && raw.trim().length <= 80 && !/[;{}]/.test(raw) ? raw.trim() : null;
  }
  if (key === 'border') {
    return typeof raw === 'string' && BORDER_RE.test(raw.trim()) ? raw.trim() : null;
  }
  const range = NUM_RANGE[key];
  if (!range) return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  const [lo, hi] = range;
  return Math.round(Math.min(hi, Math.max(lo, n)));
}

/** 白名单翻译 + 取值校验；识别不了的键直接丢 */
export function mapStyle(raw: unknown): Record<string, StyleValue> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, StyleValue> = {};
  for (const [rawKey, rawVal] of Object.entries(raw as Record<string, unknown>)) {
    const key = KEY_ALIAS[rawKey.trim()];
    if (!key) continue;
    const val = normalizeValue(key, rawVal);
    if (val === null) continue;
    out[key] = val;
  }
  return out;
}
