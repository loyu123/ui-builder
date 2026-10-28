// 远程 AI 网关客户端（可选增强）
// 配置来自「设置」里的运行时设置（src/lib/aiSettings.ts，只存本浏览器 localStorage），
// 不再从 .env 读取：改配置不需要重新构建。所有调用失败均返回 null，上层回退到规则引擎。
import { isAiConfigured, isLocalBaseUrl, isValidBaseUrl, loadAiSettings, type AiSettings } from './aiSettings';

/** 本地端点可以不填 key，此时不发送 Authorization 头 */
function authHeaders(cfg: AiSettings): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) h.Authorization = `Bearer ${cfg.apiKey}`;
  return h;
}

/** OpenAI 兼容 /v1/embeddings；未配置或失败返回 null */
export async function embed(input: string, cfg: AiSettings = loadAiSettings()): Promise<number[] | null> {
  if (!isAiConfigured(cfg)) return null;
  try {
    const res = await fetch(`${cfg.baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: authHeaders(cfg),
      body: JSON.stringify({ model: cfg.embedModel, input }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const vec = data?.data?.[0]?.embedding;
    return Array.isArray(vec) ? vec : null;
  } catch {
    return null;
  }
}

/** OpenAI 兼容 /v1/rerank；未配置或失败返回 null */
export async function rerank(
  query: string,
  documents: string[],
  topN = 3,
  cfg: AiSettings = loadAiSettings(),
): Promise<Array<{ index: number; score: number }> | null> {
  if (!isAiConfigured(cfg)) return null;
  try {
    const res = await fetch(`${cfg.baseUrl}/v1/rerank`, {
      method: 'POST',
      headers: authHeaders(cfg),
      body: JSON.stringify({ model: cfg.rerankModel, query, documents, top_n: topN }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const list = data?.results ?? data?.data;
    return Array.isArray(list)
      ? list.map((r: { index: number; score: number }) => ({ index: r.index, score: r.score }))
      : null;
  } catch {
    return null;
  }
}

/** 设置弹层的「测试连接」：成功返回 null，失败返回可读原因（不回传密钥） */
export async function testAiConnection(cfg: AiSettings): Promise<string | null> {
  if (!cfg.baseUrl) return 'EMPTY_URL';
  if (!isValidBaseUrl(cfg.baseUrl)) return 'BAD_URL';
  if (!cfg.apiKey && !isLocalBaseUrl(cfg.baseUrl)) return 'EMPTY_KEY';
  try {
    const res = await fetch(`${cfg.baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: authHeaders(cfg),
      body: JSON.stringify({ model: cfg.embedModel, input: 'ping' }),
    });
    if (!res.ok) return `HTTP ${res.status}`;
    const data = await res.json();
    const vec = data?.data?.[0]?.embedding;
    return Array.isArray(vec) && vec.length > 0 ? null : 'NO_EMBEDDING';
  } catch (err) {
    return err instanceof Error && err.message ? err.message : 'NETWORK';
  }
}
