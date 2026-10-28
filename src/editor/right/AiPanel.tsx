// AI 设计助手主视图（P1-13 拆分自 RightPanel）：
// 优化按钮 + 建议卡 + 统计条 + 操作记录 + JSON 导入导出 + 主题编辑 + 快捷键说明
// P1-17 · 重复内联样式改用 index.css 的 .ub-* 类（.ub-btn/.ub-card/.ub-field/...），色值走 CSS 变量
import { useRef, useState } from 'react';
import { useStore } from '../../store';
import { hasRemoteAi } from '../../lib/aiClient';
import { runRules, type Suggestion } from '../../ai/engine';
import { exportJson, importJson, lastExportText } from './shared';
import { useT } from '../../lib/i18n';

export function AiPanel({ onOpenProps }: { onOpenProps: () => void }) {
  const t = useT();
  const device = useStore(s => s.editor.currentDevice);
  const page = useStore(s => {
    const pid = s.editor.currentPageId;
    return s.project.pages.find(pg => pg.id === pid) ?? s.project.pages[0];
  });
  const undoDepth = useStore(s => s.history.past.length);   // 细粒度：拖动合并（lastAt）不触发重渲染
  const historyLog = useStore(s => s.history.log);
  const theme = useStore(s => s.project.theme);
  const updateTheme = useStore(s => s.actions.updateTheme);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [applied, setApplied] = useState(0);
  const [aiTick, setAiTick] = useState(0);
  const { pushHistory, setStyle } = useStore(s => s.actions);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const board = page.boards[device];
  const moduleCount = Object.keys(board.nodes).length - 1;

  function optimize() {
    setAiTick(t => t + 1);
    setSuggestions(runRules(board));
  }

  function apply(s: Suggestion) {
    pushHistory('ai-apply');
    for (const p of s.patches) {
      if (p.kind === 'setFrame') {
        const b = useStore.getState().project.pages
          .find(pg => pg.id === useStore.getState().editor.currentPageId)!
          .boards[device];
        const node = b.nodes[p.id];
        if (node) {
          useStore.getState().actions.moveNode(p.id, p.frame.x, p.frame.y);
          if (p.frame.w !== node.frame.w || p.frame.h !== node.frame.h) {
            useStore.getState().actions.resizeNode(p.id, p.frame);
          }
        }
      } else {
        setStyle(p.id, p.key, p.value);
      }
    }
    setSuggestions(prev => (prev ?? []).filter(x => x.id !== s.id));
    setApplied(n => n + 1);
  }

  const ruleColor: Record<Suggestion['rule'], string> = {
    align: '#2563eb', spacing: '#8b5cf6', contrast: '#ef4444', hierarchy: '#f59e0b', length: '#10b981',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, overflowY: 'auto', flex: 1 }}>
      <button onClick={optimize} className="ub-btn ub-btn-accent" style={{ padding: '11px 0', fontSize: 14 }}>
        {t('ai_optimize')}{aiTick ? t('ai_run', { n: aiTick }) : ''}
      </button>
      <div className="ub-label" style={{ lineHeight: 1.6 }}>
        {t('ai_hint_1')}
        <br />
        {t('ai_hint_2')}
      </div>

      {suggestions && suggestions.length === 0 && (
        <div style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', borderRadius: 10, padding: 10, fontSize: 12, lineHeight: 1.6 }}>
          {t('ai_all_good')}
          <div className="ub-label" style={{ color: '#4d7c0f', marginTop: 4 }}>
            {t('ai_rules_note')}
          </div>
        </div>
      )}
      {suggestions && suggestions.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {t('ai_summary', { n: suggestions.length })}
          </div>
          {suggestions.map(s => (
            <div key={s.id} className="ub-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b style={{ fontSize: 13 }}>
                  {s.message.split('」')[0].replace('「', '')}，{s.title}
                </b>
                <span style={{ fontSize: 10, color: ruleColor[s.rule], border: `1px solid ${ruleColor[s.rule]}33`, borderRadius: 4, padding: '1px 5px' }}>
                  {t('rule_' + s.rule)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', margin: '6px 0' }}>{s.message}</div>
              <div className="ub-label-sm" style={{ marginBottom: 8 }}>
                {Object.entries(s.evidence).map(([k, v]) => `${k} ${v}`).join(' · ')}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {s.patches.length > 0 ? (
                  <>
                    <button onClick={() => apply(s)} className="ub-btn ub-btn-accent ub-btn-flex">{t('ai_apply')}</button>
                    <button onClick={() => setSuggestions(prev => (prev ?? []).filter(x => x.id !== s.id))}
                      className="ub-btn ub-btn-flex">{t('ai_ignore')}</button>
                  </>
                ) : (
                  <span className="ub-label">{t('ai_manual')}</span>
                )}
              </div>
            </div>
          ))}
          {applied > 0 && (
            <div className="ub-label">
              {t('ai_applied', { n: applied })}
            </div>
          )}
        </>
      )}

      {/* 统计条（C：页面/模块/画板） */}
      <div style={{ display: 'flex', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
        {[
          { v: page.name ? useStore.getState().project.pages.length : 0, label: t('stat_pages') },
          { v: moduleCount, label: t('stat_modules') },
          { v: 3, label: t('stat_boards') },
        ].map((it, i) => (
          <div key={it.label} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderLeft: i ? '1px solid var(--line-soft)' : 'none' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{it.v}</div>
            <div className="ub-label-sm">{it.label}</div>
          </div>
        ))}
      </div>

      {/* P2-33 · AI 模式状态可见：本地规则 / 远程网关 */}
      <div className="ub-label-sm" style={{ color: hasRemoteAi() ? '#166534' : undefined, textAlign: 'center' }}>
        {hasRemoteAi() ? t('ai_remote_mode') : t('ai_local_mode')}
      </div>

      {/* 操作记录 */}
      <div>
        <div className="ub-label" style={{ marginBottom: 4 }}>
          {t('undo_hint', { n: Math.min(undoDepth, 4), e: lastExportText() })}
        </div>
        {historyLog.length === 0 && <div className="ub-label" style={{ color: 'var(--ghost)' }}>{t('history_empty')}</div>}
        {historyLog.slice(0, 4).map((h, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', padding: '3px 0', borderBottom: '1px dashed var(--line-soft)' }}>
            <span>{h}</span>
            <span style={{ color: 'var(--ghost)' }}>{i === 0 ? t('just_now') : t('steps_ago', { n: i })}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onOpenProps} className="ub-btn ub-btn-ghost">
            {t('view_props')}
          </button>
        </div>
      </div>

      {/* 导入导出（收纳在助手底部） */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={exportJson} className="ub-btn ub-btn-flex">{t('export_json')}</button>
        <button onClick={() => fileRef.current?.click()} className="ub-btn ub-btn-flex">{t('import_json')}</button>
      </div>
      <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />

      {/* P2-11 · 主题令牌编辑（导出 tokens.css 使用） */}
      <details className="ub-details">
        <summary>{t('theme_title')}</summary>
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div className="ub-label-sm">{t('theme_colors')}</div>
          {Object.entries(theme.colors).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 52, fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>{k}</span>
              <input type="color" value={v} style={{ width: 28, height: 24, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                onChange={e => updateTheme({ colors: { [k]: e.target.value } })} />
              <input className="ub-field" value={v}
                onChange={e => updateTheme({ colors: { [k]: e.target.value } })} />
            </div>
          ))}
          <div className="ub-label-sm" style={{ marginTop: 2 }}>{t('theme_radius')}</div>
          {Object.entries(theme.radius).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 52, fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>{k}</span>
              <input type="number" min={0} className="ub-field" value={v}
                onChange={e => updateTheme({ radius: { [k]: Math.max(0, Number(e.target.value) || 0) } })} />
            </div>
          ))}
          <div className="ub-label-sm" style={{ marginTop: 2 }}>{t('theme_font')}</div>
          <input className="ub-field" value={theme.font.family}
            onChange={e => updateTheme({ font: { ...theme.font, family: e.target.value } })} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 52, fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>{t('theme_font_base')}</span>
            <input type="number" min={8} max={24} className="ub-field" value={theme.font.base}
              onChange={e => updateTheme({ font: { ...theme.font, base: Math.max(8, Math.min(24, Number(e.target.value) || 14)) } })} />
          </div>
        </div>
      </details>

      {/* P2-14 · 快捷键说明（原生 details 折叠，不抢快捷键） */}
      <details className="ub-details">
        <summary>{t('shortcuts_title')}</summary>
        <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: 11, color: 'var(--ink-3)' }}>
          {([
            ['Ctrl/⌘+Z', 'sc_undo'], ['Ctrl/⌘+Shift+Z', 'sc_redo'],
            ['Ctrl/⌘+C', 'sc_copy'], ['Ctrl/⌘+V', 'sc_paste'],
            ['Delete', 'sc_delete'], ['Esc', 'sc_esc'],
            ['空格+拖动', 'sc_pan'], ['Ctrl+滚轮', 'sc_zoom'],
            ['Shift+点击', 'sc_add_select'], ['Shift+缩放手柄', 'sc_ratio'],
            ['双击文字', 'sc_dblclick'],
            ['方向键', 'sc_arrows'],
          ] as const).map(([k, key]) => (
            <div key={k} style={{ display: 'contents' }}>
              <kbd className="ub-kbd">{k}</kbd>
              <span>{t(key)}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
