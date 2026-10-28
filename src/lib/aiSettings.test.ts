// AI 设置：地址归一化 / 模型默认值 / 可用判定 / 脱敏 / 存储往返
import { afterEach, describe, it, expect } from 'vitest';
import {
  AI_SETTINGS_STORAGE_KEY, DEFAULT_AI_SETTINGS, normalizeBaseUrl, isValidBaseUrl,
  normalizeAiSettings, isAiConfigured, maskApiKey, loadAiSettings, saveAiSettings, clearAiSettings,
} from './aiSettings';

/** 极简内存 Storage 替身（node 环境没有 localStorage） */
function stubStorage() {
  const map = new Map<string, string>();
  const st = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
  };
  (globalThis as { localStorage?: unknown }).localStorage = st;
  return map;
}

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
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

  it('密钥脱敏只露前 3 后 2', () => {
    expect(maskApiKey('sk-1234567890abcd')).toBe('sk-••••cd');
    expect(maskApiKey('short')).toBe('••••••');
    expect(maskApiKey('')).toBe('');
  });

  it('存储往返：保存后读回一致，清除后回到默认', () => {
    const map = stubStorage();
    expect(loadAiSettings()).toEqual(DEFAULT_AI_SETTINGS);

    saveAiSettings({ baseUrl: 'https://gw.example.com/', apiKey: 'sk-x', embedModel: 'e1', rerankModel: 'r1' });
    expect(map.has(AI_SETTINGS_STORAGE_KEY)).toBe(true);
    expect(loadAiSettings()).toMatchObject({ baseUrl: 'https://gw.example.com', apiKey: 'sk-x', embedModel: 'e1', rerankModel: 'r1' });

    clearAiSettings();
    expect(map.has(AI_SETTINGS_STORAGE_KEY)).toBe(false);
    expect(loadAiSettings()).toEqual(DEFAULT_AI_SETTINGS);
  });

  it('存储里是坏 JSON 时回退默认，不抛错', () => {
    const map = stubStorage();
    map.set(AI_SETTINGS_STORAGE_KEY, '{not json');
    expect(loadAiSettings()).toEqual(DEFAULT_AI_SETTINGS);
  });
});
