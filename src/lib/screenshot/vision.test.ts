// SS-10 · 视觉模型客户端：契约/抠 JSON/超时与取消/错误原因码
import { describe, it, expect } from 'vitest';
import {
  buildChatBody, buildVisionPrompt, extractJson, fitWithin, pickCompletionText,
  recognizeScreenshot, MAX_IMAGE_EDGE, type FetchLike,
} from './vision';
import { DEFAULT_AI_SETTINGS, type AiSettings } from '../aiSettings';

const cfg: AiSettings = { ...DEFAULT_AI_SETTINGS, baseUrl: 'https://gw.example.com', apiKey: 'sk-test' };
const IMG = 'data:image/png;base64,AAAA';

/** 极简 Response 替身：避免依赖 node 的 fetch 实现 */
function res(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function completion(content: string): unknown {
  return { choices: [{ message: { role: 'assistant', content } }] };
}

describe('screenshot · 视觉模型客户端', () => {
  it('提示词把 0-1 坐标与类型白名单说清楚', () => {
    const p = buildVisionPrompt();
    expect(p).toContain('0-1');
    expect(p).toContain('"modules"');
    expect(p).toContain('button');
    expect(p).toContain('Never use pixels');
  });

  it('长边超限才等比缩放', () => {
    expect(fitWithin(800, 600)).toEqual({ w: 800, h: 600 });
    expect(fitWithin(2048, 1024)).toEqual({ w: MAX_IMAGE_EDGE, h: 512 });
    expect(fitWithin(0, 100)).toEqual({ w: 0, h: 0 });
  });

  it('从围栏与废话里抠出 JSON', () => {
    expect(extractJson('```json\n{"modules":[]}\n```')).toEqual({ modules: [] });
    expect(extractJson('here you go: {"modules":[{"type":"button"}]} hope it helps')).toEqual({ modules: [{ type: 'button' }] });
    expect(extractJson('{"modules":[')).toBeNull();
    expect(extractJson('no json here')).toBeNull();
  });

  it('content 支持字符串与分片数组', () => {
    expect(pickCompletionText(completion('{"modules":[]}'))).toBe('{"modules":[]}');
    expect(pickCompletionText({ choices: [{ message: { content: [{ type: 'text', text: 'ab' }, { text: 'cd' }] } }] })).toBe('abcd');
    expect(pickCompletionText({ choices: [] })).toBeNull();
    expect(pickCompletionText(null)).toBeNull();
  });

  it('请求体走 OpenAI 兼容多模态结构', () => {
    const body = buildChatBody('qwen2.5-vl', IMG) as {
      model: string;
      messages: Array<{ content: Array<{ type: string; image_url?: { url: string } }> }>;
    };
    expect(body.model).toBe('qwen2.5-vl');
    expect(body.messages[0].content[1]).toEqual({ type: 'image_url', image_url: { url: IMG } });
  });

  it('成功路径：发到 /v1/chat/completions 且解密出模块', async () => {
    let seenUrl = '';
    let seenInit: RequestInit | undefined;
    const fetchImpl: FetchLike = (url, init) => {
      seenUrl = url;
      seenInit = init;
      return Promise.resolve(res(completion('{"modules":[{"type":"button","confidence":0.9,"box":{"x":0.1,"y":0.2,"w":0.8,"h":0.1}}]}')));
    };
    const r = await recognizeScreenshot(IMG, { cfg, fetchImpl });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(seenUrl).toBe('https://gw.example.com/v1/chat/completions');
    const headers = (seenInit?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-test');
    expect(r.data).toMatchObject({ modules: [{ type: 'button' }] });
  });

  it('本地端点不填 key 时不发 Authorization 头', async () => {
    let headers: Record<string, string> = {};
    const fetchImpl: FetchLike = (_url, init) => {
      headers = (init?.headers ?? {}) as Record<string, string>;
      return Promise.resolve(res(completion('{"modules":[]}')));
    };
    const r = await recognizeScreenshot(IMG, {
      cfg: { ...DEFAULT_AI_SETTINGS, baseUrl: 'http://127.0.0.1:11434', apiKey: '', visionModel: 'qwen2.5vl:7b' },
      fetchImpl,
    });
    expect(r.ok).toBe(true);
    expect(headers.Authorization).toBeUndefined();
  });

  it('配置不全与非法图片在发请求前就拦下', async () => {
    const fetchImpl: FetchLike = () => Promise.resolve(res(completion('{"modules":[]}')));
    expect(await recognizeScreenshot(IMG, { cfg: { ...cfg, baseUrl: '' }, fetchImpl })).toMatchObject({ kind: 'NO_CONFIG' });
    expect(await recognizeScreenshot(IMG, { cfg: { ...cfg, baseUrl: 'gw.example.com' }, fetchImpl })).toMatchObject({ kind: 'BAD_URL' });
    expect(await recognizeScreenshot(IMG, { cfg: { ...cfg, apiKey: '' }, fetchImpl })).toMatchObject({ kind: 'EMPTY_KEY' });
    expect(await recognizeScreenshot(IMG, { cfg: { ...cfg, visionModel: '  ' }, fetchImpl })).toMatchObject({ kind: 'NO_MODEL' });
    expect(await recognizeScreenshot('blob:http://x/1', { cfg, fetchImpl })).toMatchObject({ kind: 'BAD_RESPONSE' });
  });

  it('HTTP 失败带上状态码与片段', async () => {
    const fetchImpl: FetchLike = () => Promise.resolve(res({ error: 'invalid key' }, 401));
    const r = await recognizeScreenshot(IMG, { cfg, fetchImpl });
    expect(r).toMatchObject({ ok: false, kind: 'HTTP', status: 401 });
  });

  it('模型回了人话但没 JSON → BAD_JSON，保留原文供排查', async () => {
    const fetchImpl: FetchLike = () => Promise.resolve(res(completion('抱歉，我无法识别这张图片。')));
    const r = await recognizeScreenshot(IMG, { cfg, fetchImpl });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.kind).toBe('BAD_JSON');
    expect(r.raw).toContain('无法识别');
  });

  it('超时返回 TIMEOUT（不重试）', async () => {
    let calls = 0;
    const fetchImpl: FetchLike = (_url, init) => {
      calls += 1;
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        });
      });
    };
    const r = await recognizeScreenshot(IMG, { cfg, fetchImpl, timeoutMs: 5 });
    expect(r).toMatchObject({ ok: false, kind: 'TIMEOUT' });
    expect(calls).toBe(1);
  });

  it('用户取消返回 ABORTED', async () => {
    const outer = new AbortController();
    const fetchImpl: FetchLike = (_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        });
        outer.abort();
      });
    };
    const r = await recognizeScreenshot(IMG, { cfg, fetchImpl, signal: outer.signal });
    expect(r).toMatchObject({ ok: false, kind: 'ABORTED' });
  });

  it('网络异常返回 NETWORK 并带原因', async () => {
    const fetchImpl: FetchLike = () => Promise.reject(new Error('Failed to fetch'));
    const r = await recognizeScreenshot(IMG, { cfg, fetchImpl });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.kind).toBe('NETWORK');
    expect(r.raw).toContain('Failed to fetch');
  });
});
