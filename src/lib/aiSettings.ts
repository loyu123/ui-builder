// AI 网关设置（Embedding / Reranker）：运行时在「设置」里配置
// 只写本浏览器存储：remember=true 走 localStorage（跨会话），false 走 sessionStorage（关页即失效）
// 不入库、不参与导出、不上报；留空即回退纯规则引擎
export interface AiSettings {
  baseUrl: string;     // 形如 https://gateway.example.com（不含 /v1）
  apiKey: string;
  embedModel: string;
  rerankModel: string;
  remember: boolean;   // SEC-04 · 是否记住密钥（false = 只保留到本次会话结束）
}

export const AI_SETTINGS_STORAGE_KEY = 'ui-builder:ai-settings';

export const DEFAULT_AI_SETTINGS: AiSettings = {
  baseUrl: '',
  apiKey: '',
  embedModel: 'text-embedding-3-small',
  rerankModel: 'rerank-v3',
  remember: true,
};

/** 去空白、去尾部斜杠、去掉误填的 /v1（接口路径自己会拼 /v1/embeddings） */
export function normalizeBaseUrl(raw?: string | null): string {
  let v = (raw ?? '').trim().replace(/\s+/g, '');
  if (!v) return '';
  v = v.replace(/\/+$/, '');
  v = v.replace(/\/v1$/i, '');
  return v;
}

/** 只接受 http/https 的绝对地址 */
export function isValidBaseUrl(baseUrl: string): boolean {
  if (!baseUrl) return false;
  try {
    const u = new URL(baseUrl);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 本地端点判定（Ollama / LM Studio / vLLM 等）：这类地址视为使用者自己的机器，
 * 允许不填 API Key —— 开源工具不应逼本地用户造一个假密钥
 */
export function isLocalBaseUrl(baseUrl: string): boolean {
  if (!baseUrl) return false;
  try {
    const host = new URL(baseUrl).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return host === 'localhost'
      || host === '127.0.0.1'
      || host === '0.0.0.0'
      || host === '::1'
      || host === 'host.docker.internal'
      || host.endsWith('.local')
      || host.endsWith('.localhost');
  } catch {
    return false;
  }
}

/** 归一化：模型名留空回退默认，密钥去空白 */
export function normalizeAiSettings(input?: Partial<AiSettings> | null): AiSettings {
  const src = input ?? {};
  return {
    baseUrl: normalizeBaseUrl(src.baseUrl),
    apiKey: (src.apiKey ?? '').trim(),
    embedModel: (src.embedModel ?? '').trim() || DEFAULT_AI_SETTINGS.embedModel,
    rerankModel: (src.rerankModel ?? '').trim() || DEFAULT_AI_SETTINGS.rerankModel,
    remember: src.remember !== false,
  };
}

/** 地址合法 +（本机端点 或 有密钥）才算配置完成 */
export function isAiConfigured(s: AiSettings): boolean {
  if (!s.baseUrl || !isValidBaseUrl(s.baseUrl)) return false;
  return Boolean(s.apiKey) || isLocalBaseUrl(s.baseUrl);
}

/** 展示用脱敏：只露前 3 后 2 */
export function maskApiKey(key: string): string {
  const k = key.trim();
  if (!k) return '';
  if (k.length <= 6) return '••••••';
  return `${k.slice(0, 3)}••••${k.slice(-2)}`;
}

function safeStorage(kind: 'local' | 'session'): Storage | null {
  try {
    const s = kind === 'local' ? localStorage : sessionStorage;
    return s ?? null;
  } catch {
    return null;   // 隐私模式 / 被禁用
  }
}

function readFrom(store: Storage | null): AiSettings | null {
  if (!store) return null;
  try {
    const raw = store.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    return normalizeAiSettings(JSON.parse(raw) as Partial<AiSettings>);
  } catch {
    return null;
  }
}

function writeTo(store: Storage | null, value: AiSettings | null): void {
  if (!store) return;
  try {
    if (value) store.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(value));
    else store.removeItem(AI_SETTINGS_STORAGE_KEY);
  } catch {
    /* 配额 / 被禁用时静默 */
  }
}

/** 会话副本优先（remember=false 刚保存过），其次跨会话副本，最后默认值 */
export function loadAiSettings(): AiSettings {
  return readFrom(safeStorage('session')) ?? readFrom(safeStorage('local')) ?? normalizeAiSettings(null);
}

/** 按 remember 分流存储：勾选 → localStorage；不勾选 → sessionStorage（并清掉长期副本） */
export function saveAiSettings(input: Partial<AiSettings>): AiSettings {
  const next = normalizeAiSettings(input);
  if (next.remember) {
    writeTo(safeStorage('local'), next);
    writeTo(safeStorage('session'), null);
  } else {
    writeTo(safeStorage('session'), next);
    writeTo(safeStorage('local'), null);   // 取消勾选后旧的长久副本不能留
  }
  return next;
}

/** 清除两处副本（「清除」按钮与「清空缓存并重置」都走这里） */
export function clearAiSettings(): AiSettings {
  writeTo(safeStorage('local'), null);
  writeTo(safeStorage('session'), null);
  return normalizeAiSettings(null);
}
