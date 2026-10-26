// 远程 AI 网关客户端（可选增强，S3 默认不依赖）
// 密钥只存在于本地 .env（已 gitignore）；所有调用失败均返回 null，上层回退到规则引擎
const BASE = import.meta.env.VITE_AI_GATEWAY_BASE_URL as string | undefined;
const KEY = import.meta.env.VITE_AI_GATEWAY_KEY as string | undefined;

export const EMBED_MODEL = (import.meta.env.VITE_AI_EMBEDDING_MODEL as string | undefined) ?? 'catinfo-Embedding';
export const RERANK_MODEL = (import.meta.env.VITE_AI_RERANK_MODEL as string | undefined) ?? 'catinfo-Reranker';

export function hasRemoteAi(): boolean {
  return Boolean(BASE && KEY);
}

/** OpenAI 兼容 /v1/embeddings；失败返回 null */
export async function embed(input: string): Promise<number[] | null> {
  if (!hasRemoteAi()) return null;
  try {
    const res = await fetch(`${BASE}/v1/embeddings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, input }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const vec = data?.data?.[0]?.embedding;
    return Array.isArray(vec) ? vec : null;
  } catch {
    return null;
  }
}

/** OpenAI 兼容 /v1/rerank；失败返回 null */
export async function rerank(
  query: string,
  documents: string[],
  topN = 3,
): Promise<Array<{ index: number; score: number }> | null> {
  if (!hasRemoteAi()) return null;
  try {
    const res = await fetch(`${BASE}/v1/rerank`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: RERANK_MODEL, query, documents, top_n: topN }),
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
