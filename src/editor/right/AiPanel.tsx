// AI 设计助手主视图（P1-13 拆分自 RightPanel）：
// 优化按钮 + 建议卡 + 统计条 + 操作记录 + JSON 导入导出 + 主题编辑 + 快捷键说明
import { useRef, useState } from 'react';
import { useStore } from '../../store';
import { hasRemoteAi } from '../../lib/aiClient';
import { runRules, type Suggestion } from '../../ai/engine';
import { cardBtn, exportJson, fieldInputStyle, importJson, lastExportText } from './shared';

export function AiPanel({ onOpenProps }: { onOpenProps: () => void }) {
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
    align: '#0ea5e9', spacing: '#8b5cf6', contrast: '#ef4444', hierarchy: '#f59e0b', length: '#10b981',
  };
  const ruleLabel: Record<Suggestion['rule'], string> = {
    align: '对齐', spacing: '等距栅格', contrast: '对比度', hierarchy: '层级', length: '文案',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, overflowY: 'auto', flex: 1 }}>
      <button onClick={optimize} style={{
        border: 'none', background: '#f97316', color: '#fff', borderRadius: 10,
        padding: '11px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer',
      }}>
        ✦ AI 优化当前画图{aiTick ? `（第 ${aiTick} 次）` : ''}
      </button>
      <div style={{ fontSize: 11, color: '#a8a199', lineHeight: 1.6 }}>
        只给建议，不会直接改动你的设计；点「应用」才生效，可随时撤销。
        <br />
        要直接改模块：点选画布中的模块，右侧会自动切到「属性」；也可以在画布上直接拖动、缩放。
      </div>

      {suggestions && suggestions.length === 0 && (
        <div style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', borderRadius: 10, padding: 10, fontSize: 12, lineHeight: 1.6 }}>
          ✓ 检查完成，当前画板没有发现可优化项。
          <div style={{ fontSize: 11, color: '#4d7c0f', marginTop: 4 }}>
            各规则触发条件：对齐需同层 ≥2 个模块 · 等距需 ≥3 个 · 对比度需模块同时设置文字色和背景色 · 字号层级需出现 4 种以上字号 · 文案溢出需文字估算宽超出模块 15%。
          </div>
        </div>
      )}
      {suggestions && suggestions.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            本次 {suggestions.length} 条建议（共检查 5 类规则）
          </div>
          {suggestions.map(s => (
            <div key={s.id} style={{ border: '1px solid #ece7dd', borderRadius: 10, padding: 10, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b style={{ fontSize: 13 }}>
                  {s.message.split('」')[0].replace('「', '')}，{s.title}
                </b>
                <span style={{ fontSize: 10, color: ruleColor[s.rule], border: `1px solid ${ruleColor[s.rule]}33`, borderRadius: 4, padding: '1px 5px' }}>
                  {ruleLabel[s.rule]}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#57534e', margin: '6px 0' }}>{s.message}</div>
              <div style={{ fontSize: 10, color: '#a8a199', marginBottom: 8 }}>
                {Object.entries(s.evidence).map(([k, v]) => `${k} ${v}`).join(' · ')}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {s.patches.length > 0 ? (
                  <>
                    <button onClick={() => apply(s)} style={{ ...cardBtn, background: '#f97316', color: '#fff', borderColor: '#f97316' }}>应用</button>
                    <button onClick={() => setSuggestions(prev => (prev ?? []).filter(x => x.id !== s.id))}
                      style={cardBtn}>忽略</button>
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: '#a8a199' }}>需人工处理（无自动补丁）</span>
                )}
              </div>
            </div>
          ))}
          {applied > 0 && (
            <div style={{ fontSize: 11, color: '#a8a199' }}>
              已应用 {applied} 条 · 可撤销（Ctrl+Z）
            </div>
          )}
        </>
      )}

      {/* 统计条（C：页面/模块/画板） */}
      <div style={{ display: 'flex', border: '1px solid #ece7dd', borderRadius: 10, overflow: 'hidden' }}>
        {[
          { v: page.name ? useStore.getState().project.pages.length : 0, label: '页面' },
          { v: moduleCount, label: '模块' },
          { v: 3, label: '画板' },
        ].map((it, i) => (
          <div key={it.label} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderLeft: i ? '1px solid #f0ebe2' : 'none' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1f2328' }}>{it.v}</div>
            <div style={{ fontSize: 10, color: '#a8a199' }}>{it.label}</div>
          </div>
        ))}
      </div>

      {/* P2-33 · AI 模式状态可见：本地规则 / 远程网关 */}
      <div style={{ fontSize: 10, color: hasRemoteAi() ? '#166534' : '#a8a199', textAlign: 'center' }}>
        {hasRemoteAi() ? '● 远程 AI 已配置（语义增强可用）' : '● 本地规则引擎模式 · 配置 .env 可启用远程 AI'}
      </div>

      {/* 操作记录 */}
      <div>
        <div style={{ fontSize: 11, color: '#a8a199', marginBottom: 4 }}>
          最近 {Math.min(undoDepth, 4)} 步可撤销 · {lastExportText()}导出
        </div>
        {historyLog.length === 0 && <div style={{ fontSize: 11, color: '#d8d2c8' }}>暂无操作</div>}
        {historyLog.slice(0, 4).map((t, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#57534e', padding: '3px 0', borderBottom: '1px dashed #f0ebe2' }}>
            <span>{t}</span>
            <span style={{ color: '#d8d2c8' }}>{i === 0 ? '刚刚' : `${i} 步前`}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onOpenProps} style={{ ...cardBtn, border: 'none', color: '#f97316', background: 'transparent' }}>
            查看属性 ›
          </button>
        </div>
      </div>

      {/* 导入导出（收纳在助手底部） */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={exportJson} style={{ ...cardBtn, flex: 1 }}>导出 JSON</button>
        <button onClick={() => fileRef.current?.click()} style={{ ...cardBtn, flex: 1 }}>导入 JSON</button>
      </div>
      <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />

      {/* P2-11 · 主题令牌编辑（导出 tokens.css 使用） */}
      <details style={{ border: '1px solid #ece7dd', borderRadius: 10, padding: '8px 10px', background: '#fff' }}>
        <summary style={{ fontSize: 12, color: '#57534e', cursor: 'pointer', userSelect: 'none' }}>🎨 主题</summary>
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 10, color: '#a8a199' }}>颜色（导出为 --color-*）</div>
          {Object.entries(theme.colors).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 52, fontSize: 11, color: '#57534e', flexShrink: 0 }}>{k}</span>
              <input type="color" value={v} style={{ width: 28, height: 24, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                onChange={e => updateTheme({ colors: { [k]: e.target.value } })} />
              <input style={fieldInputStyle()} value={v}
                onChange={e => updateTheme({ colors: { [k]: e.target.value } })} />
            </div>
          ))}
          <div style={{ fontSize: 10, color: '#a8a199', marginTop: 2 }}>圆角（导出为 --radius-*px）</div>
          {Object.entries(theme.radius).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 52, fontSize: 11, color: '#57534e', flexShrink: 0 }}>{k}</span>
              <input type="number" min={0} style={fieldInputStyle()} value={v}
                onChange={e => updateTheme({ radius: { [k]: Math.max(0, Number(e.target.value) || 0) } })} />
            </div>
          ))}
          <div style={{ fontSize: 10, color: '#a8a199', marginTop: 2 }}>字体（导出为 --font-base / --font-size-base）</div>
          <input style={fieldInputStyle()} value={theme.font.family}
            onChange={e => updateTheme({ font: { ...theme.font, family: e.target.value } })} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 52, fontSize: 11, color: '#57534e', flexShrink: 0 }}>基准字号</span>
            <input type="number" min={8} max={24} style={fieldInputStyle()} value={theme.font.base}
              onChange={e => updateTheme({ font: { ...theme.font, base: Math.max(8, Math.min(24, Number(e.target.value) || 14)) } })} />
          </div>
        </div>
      </details>

      {/* P2-14 · 快捷键说明（原生 details 折叠，不抢快捷键） */}
      <details style={{ border: '1px solid #ece7dd', borderRadius: 10, padding: '8px 10px', background: '#fff' }}>
        <summary style={{ fontSize: 12, color: '#57534e', cursor: 'pointer', userSelect: 'none' }}>⌨️ 快捷键</summary>
        <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: 11, color: '#57534e' }}>
          {[
            ['Ctrl/⌘+Z', '撤销'], ['Ctrl/⌘+Shift+Z', '重做'],
            ['Ctrl/⌘+C', '复制选中'], ['Ctrl/⌘+V', '粘贴'],
            ['Delete', '删除选中'], ['Esc', '取消选择 / 退出预览'],
            ['空格+拖动', '平移画布'], ['Ctrl+滚轮', '缩放画布'],
            ['Shift+点击', '追加多选'], ['Shift+缩放手柄', '锁定比例'],
            ['双击文字', '就地编辑文案'],
            ['方向键', '微调 1px（Shift 为 8px）'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <kbd style={{ background: '#f5f2ec', border: '1px solid #ece7dd', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontFamily: 'inherit', justifySelf: 'start' }}>{k}</kbd>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
