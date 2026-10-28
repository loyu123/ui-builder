// SET-01 · 设置弹层：AI 网关地址 / API Key / Embedding 模型 / Reranker 模型
// 配置只写本浏览器 localStorage（src/lib/aiSettings.ts），不入库、不随导出；留空即纯规则引擎
import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { useT } from '../lib/i18n';
import { DEFAULT_AI_SETTINGS, isValidBaseUrl, maskApiKey, normalizeAiSettings, normalizeBaseUrl } from '../lib/aiSettings';
import { testAiConnection } from '../lib/aiClient';
import { IconEye, IconEyeOff } from './icons';

export function SettingsModal({ onClose, onSaved, onCleared }: {
  onClose: () => void;
  onSaved?: () => void;
  onCleared?: () => void;
}) {
  const t = useT();
  const ai = useStore(s => s.settings.ai);
  const setAiSettings = useStore(s => s.actions.setAiSettings);
  const resetAiSettings = useStore(s => s.actions.resetAiSettings);

  const [baseUrl, setBaseUrl] = useState(ai.baseUrl);
  const [apiKey, setApiKey] = useState(ai.apiKey);
  const [embedModel, setEmbedModel] = useState(ai.embedModel);
  const [rerankModel, setRerankModel] = useState(ai.rerankModel);
  const [remember, setRemember] = useState(ai.remember);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Esc 关闭（弹层开着时不抢画布快捷键）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const normalizedUrl = normalizeBaseUrl(baseUrl);
  const urlBad = Boolean(normalizedUrl) && !isValidBaseUrl(normalizedUrl);
  const canSave = !urlBad;

  function draft() {
    return normalizeAiSettings({ baseUrl, apiKey, embedModel, rerankModel, remember });
  }

  function save() {
    if (!canSave) return;
    setAiSettings(draft());
    onSaved?.();
    onClose();
  }

  function clearAll() {
    resetAiSettings();
    setBaseUrl(DEFAULT_AI_SETTINGS.baseUrl);
    setApiKey(DEFAULT_AI_SETTINGS.apiKey);
    setEmbedModel(DEFAULT_AI_SETTINGS.embedModel);
    setRerankModel(DEFAULT_AI_SETTINGS.rerankModel);
    setRemember(DEFAULT_AI_SETTINGS.remember);
    setMsg(null);
    onCleared?.();
  }

  async function test() {
    if (!canSave) return;
    setTesting(true);
    setMsg(null);
    const reason = await testAiConnection(draft());
    setTesting(false);
    setMsg(reason
      ? { ok: false, text: t('settings_test_fail', { reason }) }
      : { ok: true, text: t('settings_test_ok') });
  }

  return (
    <div className="ub-mask" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ub-modal" role="dialog" aria-label={t('settings_title')}>
        <div className="ub-modal-head">
          {t('settings_title')}
          <button className="ub-icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose} title={t('sc_esc')}>✕</button>
        </div>

        <div className="ub-label-sm">{t('settings_ai')}</div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="ub-label-sm">{t('settings_base_url')}</span>
          <input
            className="ub-field"
            value={baseUrl}
            placeholder={t('settings_base_url_ph')}
            spellCheck={false}
            autoComplete="off"
            style={urlBad ? { borderColor: '#dc2626' } : undefined}
            onChange={e => { setBaseUrl(e.target.value); setMsg(null); }}
          />
          {urlBad && <span style={{ fontSize: 10, color: '#dc2626' }}>{t('settings_invalid_url')}</span>}
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="ub-label-sm">{t('settings_api_key')}</span>
          <span style={{ display: 'flex', gap: 6 }}>
            <input
              className="ub-field"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              placeholder={t('settings_api_key_ph')}
              spellCheck={false}
              autoComplete="off"
              onChange={e => { setApiKey(e.target.value); setMsg(null); }}
            />
            <button
              className="ub-icon-btn"
              style={{ flexShrink: 0, padding: '0 6px', color: 'var(--ink-3)' }}
              onClick={() => setShowKey(v => !v)}
              aria-pressed={showKey}
              title={t('settings_key_toggle')}
            >
              {showKey ? <IconEyeOff size={13} /> : <IconEye size={13} />}
            </button>
          </span>
          {/* SEC-01 · 已保存的密钥只以脱敏形式提示，避免整段明文常驻界面 */}
          {ai.apiKey && !showKey && (
            <span style={{ fontSize: 10, color: 'var(--faint-2)' }}>
              {t('settings_saved_key', { key: maskApiKey(ai.apiKey) })}
              {' · '}
              {ai.remember ? t('settings_storage_persist') : t('settings_storage_session')}
            </span>
          )}
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="ub-label-sm">{t('settings_embed_model')}</span>
            <input className="ub-field" value={embedModel} spellCheck={false} autoComplete="off"
              onChange={e => setEmbedModel(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="ub-label-sm">{t('settings_rerank_model')}</span>
            <input className="ub-field" value={rerankModel} spellCheck={false} autoComplete="off"
              onChange={e => setRerankModel(e.target.value)} />
          </label>
        </div>

        {/* SEC-04 · 默认记住；不勾选则只存到本次会话（关页即失效） */}
        <label className="ub-row" style={{ gap: 6, padding: '2px 0', cursor: 'pointer', fontSize: 11 }}>
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
          <span className="ub-row-label">{t('settings_remember')}</span>
        </label>
        <div className="ub-label-sm" style={{ color: 'var(--faint-2)' }}>{t('settings_remember_hint')}</div>

        <div className="ub-label-sm">{t('settings_hint')}</div>
        <div className="ub-label-sm" style={{ color: 'var(--faint-2)' }}>{t('settings_mixed_hint')}</div>

        {msg && (
          <div style={{ fontSize: 11, color: msg.ok ? '#166534' : '#dc2626' }}>{msg.text}</div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ub-btn ub-btn-accent" style={{ flex: 1 }} disabled={!canSave} onClick={save}>
            {t('settings_save')}
          </button>
          <button className="ub-btn" disabled={testing} onClick={() => { void test(); }}>
            {testing ? t('settings_testing') : t('settings_test')}
          </button>
          <button className="ub-btn ub-btn-ghost" onClick={clearAll}>{t('settings_clear')}</button>
        </div>
      </div>
    </div>
  );
}
