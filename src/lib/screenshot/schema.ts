// SS-02 · 识别结果契约（宽松校验）：模型输出一律视为不可信输入
// 原则：能降级就降级、缺字段不抛错、超限截断并记录原因 —— 坏数据不该让编辑器白屏
export interface RatioBox { x: number; y: number; w: number; h: number }

export interface RawModule {
  type: string;
  confidence: number;
  box: RatioBox;
  text: string;
  style: Record<string, unknown>;
}

export interface ParseIssue {
  index: number;
  reason: 'not-object' | 'bad-type' | 'bad-box' | 'over-limit';
}

export interface ParseResult {
  modules: RawModule[];
  issues: ParseIssue[];
  dropped: number;
}

export const MAX_MODULES = 60;
export const MAX_TEXT = 200;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 接受 `{modules:[...]}` 或裸数组；逐条校验，失败即记 issue 并跳过 */
export function parseRecognition(input: unknown): ParseResult {
  const list = Array.isArray(input)
    ? input
    : (input && typeof input === 'object' && Array.isArray((input as { modules?: unknown }).modules)
      ? (input as { modules: unknown[] }).modules
      : []);

  const modules: RawModule[] = [];
  const issues: ParseIssue[] = [];
  let dropped = 0;

  list.forEach((item, index) => {
    if (modules.length >= MAX_MODULES) {
      issues.push({ index, reason: 'over-limit' });
      dropped += 1;
      return;
    }
    if (!item || typeof item !== 'object') {
      issues.push({ index, reason: 'not-object' });
      dropped += 1;
      return;
    }
    const rec = item as Record<string, unknown>;
    const box = rec.box as Record<string, unknown> | undefined;
    if (!box || !isNum(box.x) || !isNum(box.y) || !isNum(box.w) || !isNum(box.h) || box.w <= 0 || box.h <= 0) {
      issues.push({ index, reason: 'bad-box' });
      dropped += 1;
      return;
    }

    const rawType = typeof rec.type === 'string' ? rec.type.trim() : '';
    if (!rawType) issues.push({ index, reason: 'bad-type' });

    const confidence = isNum(rec.confidence) ? Math.min(1, Math.max(0, rec.confidence)) : 0.5;
    const text = typeof rec.text === 'string' ? rec.text.trim().slice(0, MAX_TEXT) : '';
    const style = rec.style && typeof rec.style === 'object' && !Array.isArray(rec.style)
      ? rec.style as Record<string, unknown>
      : {};

    modules.push({
      type: rawType || 'unknown',
      confidence,
      box: { x: box.x, y: box.y, w: box.w, h: box.h },
      text,
      style,
    });
  });

  return { modules, issues, dropped };
}
