// AI 网关设置（Embedding / Reranker）：运行时在「设置」里配置
// 只写本浏览器 localStorage —— 不入库、不参与导出、不上报；留空即回退纯规则引擎
export interface AiSettings {
  baseUrl: string;     // 形如 https://gateway.example.com（不含 /v1）
  apiKey: string;
  embedModel: string;
  rerankModel: string;
}

export const AI_SETTINGS_STORAGE_KEY = 'ui-builder:ai-settings';

export const DEFAULT_AI_SETTINGS: AiSettings = {
  baseUrl: '',
  apiKey: '',
  embedModel: 'text-embedding-3-small',
  rerankModel: 'rerank-v3',
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

/** 归一化：模型名留空回退默认，密钥去空白 */
export function normalizeAiSettings(input?: Partial<AiSettings> | null): AiSettings {
  const src = input ?? {};
  return {
    baseUrl: normalizeBaseUrl(src.baseUrl),
    apiKey: (src.apiKey ?? '').trim(),
    embedModel: (src.embedModel ?? '').trim() || DEFAULT_AI_SETTINGS.embedModel,
    rerankModel: (src.rerankModel ?? '').trim() || DEFAULT_AI_SETTINGS.rerankModel,
  };
}

/** 地址与密钥都齐备才算配置完成 */
export function isAiConfigured(s: AiSettings): boolean {
  return Boolean(s.baseUrl && s.apiKey) && isValidBaseUrl(s.baseUrl);
}

/** 展示用脱敏：只露前 3 后 2 */
export function maskApiKey(key: string): string {
  const k = key.trim();
  if (!k) return '';
  if (k.length <= 6) return '••••••';
  return `${k.slice(0, 3)}••••${k.slice(-2)}`;
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;   // 隐私模式 / 被禁用
  }
}

export function loadAiSettings(): AiSettings {
  const store = safeStorage();
  if (!store) return normalizeAiSettings(null);
  try {
    const raw = store.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) return normalizeAiSettings(null);
    return normalizeAiSettings(JSON.parse(raw) as Partial<AiSettings>);
  } catch {
    return normalizeAiSettings(null);
  }
}

export function saveAiSettings(input: Partial<AiSettings>): AiSettings {
  const next = normalizeAiSettings(input);
  const store = safeStorage();
  if (store) {
    try { store.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(next)); } catch { /* 配额/禁用时静默 */ }
  }
  return next;
}

export function clearAiSettings(): AiSettings {
  const store = safeStorage();
  if (store) {
    try { store.removeItem(AI_SETTINGS_STORAGE_KEY); } catch { /* 同上 */ }
  }
  return normalizeAiSettings(null);
}
