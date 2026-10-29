// SS-10 · 视觉模型客户端（M0b）：OpenAI 兼容 /v1/chat/completions + image_url(base64)
// 硬边界：不经过我们的后端、不托管密钥；端点与模型都由使用者在「设置」里自己填。
// 行为约束：不自动重试、不并发批量（避免重复计费）、15s 超时、可随时取消。
import { isLocalBaseUrl, isValidBaseUrl, normalizeBaseUrl, type AiSettings } from '../aiSettings';

export const VISION_TIMEOUT_MS = 15_000;
/** 长边上限：超过则等比压缩后再编码，避免把 30MB 的截图塞进请求 */
export const MAX_IMAGE_EDGE = 1024;
export const VISION_MAX_MODULES = 60;

export type VisionErrorKind =
  | 'NO_CONFIG' | 'BAD_URL' | 'EMPTY_KEY' | 'NO_MODEL'
  | 'TIMEOUT' | 'ABORTED' | 'NETWORK' | 'BAD_RESPONSE' | 'BAD_JSON' | 'HTTP';

export interface VisionOk { ok: true; text: string; data: unknown }
export interface VisionErr { ok: false; kind: VisionErrorKind; status?: number; raw?: string }
export type VisionResult = VisionOk | VisionErr;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** 提示词：把契约写死在这里，尽量让模型只吐 JSON（不依赖各家的 response_format 支持度） */
export function buildVisionPrompt(): string {
  return [
    'You are a UI reverse-engineering engine. Look at the screenshot and list the visible UI blocks.',
    'Return ONLY minified JSON, no explanation, no markdown fence:',
    '{"modules":[{"type":"button","confidence":0.9,"box":{"x":0.1,"y":0.6,"w":0.8,"h":0.06},"text":"立即购买"}]}',
    'Rules:',
    `- at most ${VISION_MAX_MODULES} modules; skip decorative pixels, background images and pure whitespace.`,
    '- box fields are NORMALIZED to 0-1 relative to the full image: x,y = top-left, w,h = size. Never use pixels or 0-1000.',
    '- type must be one of: button, link, text, heading, paragraph, input, password, textarea, select, switch, image, icon, avatar, list, card, table, nav, tabbar, stat, progress, divider, message, comment, notification, statusbar, home-indicator.',
    '- confidence is 0-1: how sure you are about BOTH the type and the box.',
    '- text is the visible label/placeholder on that block, verbatim; omit it when there is no readable text.',
    '- style is optional: {"background":"#RRGGBB","color":"#RRGGBB","borderRadius":8,"fontSize":16}.',
  ].join('\n');
}

/** 等比缩到长边 ≤ maxEdge（只算尺寸，纯函数便于单测） */
export function fitWithin(w: number, h: number, maxEdge = MAX_IMAGE_EDGE): { w: number; h: number } {
  if (!(w > 0) || !(h > 0)) return { w: 0, h: 0 };
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { w, h };
  const k = maxEdge / longest;
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result ?? ''));
    fr.onerror = () => reject(fr.error ?? new Error('READ_FAILED'));
    fr.readAsDataURL(file);
  });
}

/**
 * 图片 → data URL。长边超过 MAX_IMAGE_EDGE 时走 canvas 压缩（JPEG 0.86），
 * 图片全程只存在于内存，不落盘、不进项目数据。
 */
export async function fileToDataUrl(file: Blob, maxEdge = MAX_IMAGE_EDGE): Promise<string> {
  const raw = await readAsDataUrl(file);
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return raw;
  try {
    const bmp = await createImageBitmap(file);
    const fit = fitWithin(bmp.width, bmp.height, maxEdge);
    if (fit.w === bmp.width && fit.h === bmp.height) {
      bmp.close?.();
      return raw;   // 已经够小：保留原图精度，不做有损压缩
    }
    const cv = document.createElement('canvas');
    cv.width = fit.w;
    cv.height = fit.h;
    const ctx = cv.getContext('2d');
    if (!ctx) { bmp.close?.(); return raw; }
    ctx.drawImage(bmp, 0, 0, fit.w, fit.h);
    bmp.close?.();
    return cv.toDataURL('image/jpeg', 0.86);
  } catch {
    return raw;
  }
}

/** 从模型输出里抠 JSON：容忍 ```json 围栏与前后废话 */
export function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

/** 各家 content 形态不一：字符串 / 分片数组 / 少数返回 text */
export function pickCompletionText(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices.length) return null;
  const first = choices[0] as { message?: { content?: unknown }; text?: unknown };
  const content = first?.message?.content ?? first?.text;
  if (typeof content === 'string') return content.trim() || null;
  if (Array.isArray(content)) {
    const joined = content
      .map(part => (typeof part === 'string' ? part : typeof (part as { text?: unknown })?.text === 'string' ? String((part as { text: string }).text) : ''))
      .join('')
      .trim();
    return joined || null;
  }
  return null;
}

/** 组装 OpenAI 兼容的多模态请求体（纯函数，便于断言契约） */
export function buildChatBody(model: string, dataUrl: string, prompt = buildVisionPrompt()): Record<string, unknown> {
  return {
    model,
    temperature: 0,
    max_tokens: 1500,   // 兜底上限：省 token，也避免个别网关因为缺省值报 400
    stream: false,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
  };
}

/** 1×1 透明 PNG：只用来验证「这个模型名到底能不能收图片」 */
export const PROBE_IMAGE
  = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export interface VisionProbe {
  ok: boolean;
  model: string;
  kind?: VisionErrorKind;
  status?: number;
  detail?: string;
}

/**
 * 设置弹层的「测试视觉模型」：发一张 1×1 图，只验证通路（模型是否存在、是否收图片、鉴权是否通过）。
 * 用真实的 chat/completions 而不是 /v1/models —— 有的网关 models 列表很全但视觉模型不可用。
 */
export async function probeVision(cfg: AiSettings, fetchImpl?: FetchLike, timeoutMs = VISION_TIMEOUT_MS): Promise<VisionProbe> {
  const model = cfg.visionModel.trim();
  const r = await recognizeScreenshot(PROBE_IMAGE, {
    cfg,
    fetchImpl,
    timeoutMs,
    prompt: 'Reply with exactly {"modules":[]} and nothing else.',
  });
  if (r.ok) return { ok: true, model };
  return { ok: false, model, kind: r.kind, status: r.status, detail: r.raw };
}

function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError';
}

/**
 * 调一次视觉模型（只调一次，绝不重试）。
 * dataUrl 由 fileToDataUrl 生成；这里刻意不碰文件对象，方便单测与复用。
 */
export async function recognizeScreenshot(dataUrl: string, opts: {
  cfg: AiSettings;
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  prompt?: string;
}): Promise<VisionResult> {
  const { cfg } = opts;
  const baseUrl = normalizeBaseUrl(cfg.baseUrl);
  if (!baseUrl) return { ok: false, kind: 'NO_CONFIG' };
  if (!isValidBaseUrl(baseUrl)) return { ok: false, kind: 'BAD_URL' };
  if (!cfg.apiKey && !isLocalBaseUrl(baseUrl)) return { ok: false, kind: 'EMPTY_KEY' };
  if (!cfg.visionModel.trim()) return { ok: false, kind: 'NO_MODEL' };
  if (!dataUrl.startsWith('data:image/')) return { ok: false, kind: 'BAD_RESPONSE', raw: 'NOT_AN_IMAGE' };

  const fetchImpl: FetchLike = opts.fetchImpl ?? ((input, init) => fetch(input, init));
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;   // 本地端点不填 key 就不发这个头

  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, opts.timeoutMs ?? VISION_TIMEOUT_MS);
  const onOuterAbort = () => ctrl.abort();
  opts.signal?.addEventListener('abort', onOuterAbort);

  try {
    const res = await fetchImpl(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildChatBody(cfg.visionModel.trim(), dataUrl, opts.prompt)),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.text()).slice(0, 400); } catch { /* 忽略读取失败 */ }
      return { ok: false, kind: 'HTTP', status: res.status, raw: detail };
    }
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return { ok: false, kind: 'BAD_RESPONSE' };
    }
    const text = pickCompletionText(data);
    if (!text) return { ok: false, kind: 'BAD_RESPONSE', raw: JSON.stringify(data).slice(0, 400) };
    const parsed = extractJson(text);
    if (!parsed) return { ok: false, kind: 'BAD_JSON', raw: text.slice(0, 4000) };
    return { ok: true, text, data: parsed };
  } catch (err) {
    if (timedOut) return { ok: false, kind: 'TIMEOUT' };
    if (isAbortError(err) || opts.signal?.aborted) return { ok: false, kind: 'ABORTED' };
    return { ok: false, kind: 'NETWORK', raw: err instanceof Error ? err.message : undefined };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onOuterAbort);
  }
}
