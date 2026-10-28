// AI 设置：地址归一化 / 模型默认值 / 可用判定 / 脱敏 / 存储往返
import { afterEach, describe, it, expect } from 'vitest';
import {
  AI_SETTINGS_STORAGE_KEY, DEFAULT_AI_SETTINGS, normalizeBaseUrl, isValidBaseUrl,
  normalizeAiSettings, isAiConfigured, isLocalBaseUrl, maskApiKey, loadAiSettings, saveAiSettings, clearAiSettings,
} from './aiSettings';

/** 极简内存 Storage 替身（node 环境没有 localStorage / sessionStorage） */
function memStorage() {
  const map = new Map<string, string>();
  return {
    map,
    st: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, v); },
      removeItem: (k: string) => { map.delete(k); },
    },
  };
}

function stubStorages() {
  const local = memStorage();
  const session = memStorage();
  const g = globalThis as { localStorage?: unknown; sessionStorage?: unknown };
  g.localStorage = local.st;
  g.sessionStorage = session.st;
  return { local: local.map, session: session.map };
}

afterEach(() => {
  const g = globalThis as { localStorage?: unknown; sessionStorage?: unknown };
  delete g.localStorage;
  delete g.sessionStorage;
});

describe('AI 设置', () => {
  it('地址归一化：去空白 / 去尾斜杠 / 去掉误填的 /v1', () => {
    expect(normalizeBaseUrl('  https://gw.example.com/  ')).toBe('https://gw.example.com');
    expect(normalizeBaseUrl('https://gw.example.com/v1/')).toBe('https://gw.example.com');
    expect(normalizeBaseUrl('http://192.168.1.9:18300/v1')).toBe('http://192.168.1.9:18300');
    expect(normalizeBaseUrl('https://gw.example.com/v1/v1')).toBe('https://gw.example.com/v1');
    expect(normalizeBaseUrl('')).toBe('');
    expect(normalizeBaseUrl(undefined)).toBe('');
  });

  it('地址校验只认 http/https 绝对地址', () => {
    expect(isValidBaseUrl('https://gw.example.com')).toBe(true);
    expect(isValidBaseUrl('http://192.168.1.9:18300')).toBe(true);
    expect(isValidBaseUrl('gw.example.com')).toBe(false);
    expect(isValidBaseUrl('ftp://gw.example.com')).toBe(false);
    expect(isValidBaseUrl('')).toBe(false);
  });

  it('模型名留空回退默认值，密钥去空白', () => {
    const s = normalizeAiSettings({ baseUrl: ' https://gw.example.com ', apiKey: '  sk-abc  ' });
    expect(s).toEqual({
      baseUrl: 'https://gw.example.com', apiKey: 'sk-abc',
      embedModel: DEFAULT_AI_SETTINGS.embedModel, rerankModel: DEFAULT_AI_SETTINGS.rerankModel,
      remember: true,           // 缺省勾选「记住密钥」
    });
    expect(normalizeAiSettings({ embedModel: '  ', rerankModel: 'my-rerank' }).rerankModel).toBe('my-rerank');
    expect(normalizeAiSettings(null)).toEqual(DEFAULT_AI_SETTINGS);
  });

  it('地址 + 密钥齐备且地址合法才算已配置', () => {
    const base = { ...DEFAULT_AI_SETTINGS, baseUrl: 'https://gw.example.com', apiKey: 'sk-1' };
    expect(isAiConfigured(base)).toBe(true);
    expect(isAiConfigured({ ...base, apiKey: '' })).toBe(false);
    expect(isAiConfigured({ ...base, baseUrl: '' })).toBe(false);
    expect(isAiConfigured({ ...base, baseUrl: 'gw.example.com' })).toBe(false);
  });

  it('本地端点识别：本机 / 局域网 .local / docker，且允许不填密钥', () => {
    expect(isLocalBaseUrl('http://127.0.0.1:11434')).toBe(true);
    expect(isLocalBaseUrl('http://localhost:1234/v1')).toBe(true);
    expect(isLocalBaseUrl('http://[::1]:8080')).toBe(true);
    expect(isLocalBaseUrl('http://ollama.local')).toBe(true);
    expect(isLocalBaseUrl('http://host.docker.internal:11434')).toBe(true);
    expect(isLocalBaseUrl('https://gw.example.com')).toBe(false);
    expect(isLocalBaseUrl('')).toBe(false);

    // 本地端点免 key；云端仍必须填
    expect(isAiConfigured({ ...DEFAULT_AI_SETTINGS, baseUrl: 'http://127.0.0.1:11434' })).toBe(true);
    expect(isAiConfigured({ ...DEFAULT_AI_SETTINGS, baseUrl: 'https://gw.example.com' })).toBe(false);
  });

  it('密钥脱敏只露前 3 后 2', () => {
    expect(maskApiKey('sk-1234567890abcd')).toBe('sk-••••cd');
    expect(maskApiKey('short')).toBe('••••••');
    expect(maskApiKey('')).toBe('');
  });

  it('存储往返：保存后读回一致，清除后回到默认', () => {
    const { local } = stubStorages();
    expect(loadAiSettings()).toEqual(DEFAULT_AI_SETTINGS);

    saveAiSettings({ baseUrl: 'https://gw.example.com/', apiKey: 'sk-x', embedModel: 'e1', rerankModel: 'r1' });
    expect(local.has(AI_SETTINGS_STORAGE_KEY)).toBe(true);
    expect(loadAiSettings()).toMatchObject({ baseUrl: 'https://gw.example.com', apiKey: 'sk-x', embedModel: 'e1', rerankModel: 'r1' });

    clearAiSettings();
    expect(local.has(AI_SETTINGS_STORAGE_KEY)).toBe(false);
    expect(loadAiSettings()).toEqual(DEFAULT_AI_SETTINGS);
  });

  it('SEC-04 · remember=false 只写会话存储，并清掉长久副本', () => {
    const { local, session } = stubStorages();
    saveAiSettings({ baseUrl: 'https://gw.example.com', apiKey: 'sk-long' });   // 先勾选记住
    expect(local.has(AI_SETTINGS_STORAGE_KEY)).toBe(true);

    saveAiSettings({ baseUrl: 'https://gw.example.com', apiKey: 'sk-session', remember: false });
    expect(local.has(AI_SETTINGS_STORAGE_KEY)).toBe(false);        // 旧的长久副本被清
    expect(session.has(AI_SETTINGS_STORAGE_KEY)).toBe(true);
    expect(loadAiSettings()).toMatchObject({ apiKey: 'sk-session', remember: false });

    // 再勾回记住：写回长久存储并清掉会话副本
    saveAiSettings({ ...loadAiSettings(), remember: true });
    expect(local.has(AI_SETTINGS_STORAGE_KEY)).toBe(true);
    expect(session.has(AI_SETTINGS_STORAGE_KEY)).toBe(false);
  });

  it('clear 同时清掉两处副本；坏 JSON 回退默认且不抛错', () => {
    const { local, session } = stubStorages();
    local.set(AI_SETTINGS_STORAGE_KEY, '{not json');
    session.set(AI_SETTINGS_STORAGE_KEY, 'also-broken');
    expect(loadAiSettings()).toEqual(DEFAULT_AI_SETTINGS);

    saveAiSettings({ baseUrl: 'https://gw.example.com', apiKey: 'sk-x', remember: false });
    clearAiSettings();
    expect(local.has(AI_SETTINGS_STORAGE_KEY)).toBe(false);
    expect(session.has(AI_SETTINGS_STORAGE_KEY)).toBe(false);
  });
});
