// 右栏 · PP-01~04 属性面板（注册表驱动）+ AI 检查页签（AI-01~05）+ 导入/导出
import { useRef, useState } from 'react';
import type * as React from 'react';
import { useStore } from '../store';
import { REGISTRY_MAP, type FieldDef } from '../modules/registry';
import { runRules, type Suggestion } from '../ai/engine';
import { exportProjectZip } from '../exporter/exporter';

function exportJson() {
  const { project } = useStore.getState();
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pages.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJson(file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    const ok = useStore.getState().actions.importProject(String(reader.result));
    window.alert(ok ? '导入成功' : '导入失败：文件不是合法的项目 JSON');
  };
  reader.readAsText(file);
}

async function exportZip() {
  const { project } = useStore.getState();
  const bytes = await exportProjectZip(project);
  const blob = new Blob([bytes as BlobPart], { type: 'application/zip' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ui-builder-export.zip';
  a.click();
  URL.revokeObjectURL(a.href);
}

function clearBoard() {
  const s = useStore.getState();
  s.actions.pushHistory('clear');
  const p = structuredClone(s.project);
  const page = p.pages.find(pg => pg.id === s.editor.currentPageId) ?? p.pages[0];
  const board = page.boards[s.editor.currentDevice];
  const root = board.nodes[board.rootId];
  root.children = [];
  for (const id of Object.keys(board.nodes)) {
    if (id !== board.rootId) delete board.nodes[id];
  }
  useStore.setState({ project: p, editor: { ...s.editor, selection: [] } });
}

function fieldInputStyle(): React.CSSProperties {
  return { width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 8px', fontSize: 12, background: '#fff' };
}

function Field({ def, node }: { def: FieldDef; node: NodeT }) {
  const { setProp, setStyle } = useStore(s => s.actions);
  const raw = def.target === 'props' ? node.props[def.key] : node.style[def.key];
  const value = raw ?? '';
  const commit = (v: unknown) => {
    if (def.target === 'props') setProp(node.id, def.key, v);
    else setStyle(node.id, def.key, v as string | number);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 64, fontSize: 11, color: '#6b7280', flexShrink: 0 }}>{def.label}</span>
      {def.type === 'text' && <input style={fieldInputStyle()} value={String(value)} onChange={e => commit(e.target.value)} />}
      {def.type === 'textarea' && (
        <textarea style={{ ...fieldInputStyle(), height: 44, resize: 'vertical', fontFamily: 'inherit' }}
          value={String(value)} onChange={e => commit(e.target.value)} />
      )}
      {def.type === 'number' && (
        <input type="number" style={fieldInputStyle()} value={Number(value) || 0}
          min={def.min} max={def.max} onChange={e => commit(Number(e.target.value))} />
      )}
      {def.type === 'color' && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="color" style={{ width: 28, height: 24, border: '1px solid #e5e7eb', borderRadius: 4, background: 'none', padding: 0 }}
            value={String(value || '#ffffff')} onChange={e => commit(e.target.value)} />
          <input style={{ ...fieldInputStyle(), width: 90 }} value={String(value)} onChange={e => commit(e.target.value)} />
        </span>
      )}
      {def.type === 'select' && (
        <select style={fieldInputStyle()} value={String(value)} onChange={e => commit(e.target.value)}>
          {def.options?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
    </div>
  );
}

type NodeT = ReturnType<typeof getSelNode> & {};

function getSelNode() {
  const s = useStore.getState();
  const page = s.project.pages.find(pg => pg.id === s.editor.currentPageId) ?? s.project.pages[0];
  const board = page.boards[s.editor.currentDevice];
  return s.editor.selection.length === 1 ? board.nodes[s.editor.selection[0]] : undefined;
}

// —— AI 检查页签（AI-03/04/05） ——
function CheckTab() {
  const device = useStore(s => s.editor.currentDevice);
  const page = useStore(s => {
    const pid = s.editor.currentPageId;
    return s.project.pages.find(pg => pg.id === pid) ?? s.project.pages[0];
  });
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const [metrics, setMetrics] = useState({ shown: 0, applied: 0, undone: 0 });   // AI-05

  const { pushHistory, setStyle } = useStore(s => s.actions);

  function run() {
    const board = page.boards[device];
    const list = runRules(board).filter(s => !ignored.has(s.id));
    setSuggestions(list);
    setMetrics(m => ({ ...m, shown: m.shown + list.length }));
  }

  function apply(s: Suggestion) {
    pushHistory('ai-apply');
    for (const p of s.patches) {
      if (p.kind === 'setFrame') {
        const board = useStore.getState().project.pages
          .find(pg => pg.id === useStore.getState().editor.currentPageId)!
          .boards[device];
        const node = board.nodes[p.id];
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
    setMetrics(m => ({ ...m, applied: m.applied + 1 }));
  }

  const ruleColor: Record<Suggestion['rule'], string> = {
    align: '#0ea5e9', spacing: '#8b5cf6', contrast: '#ef4444', hierarchy: '#f59e0b', length: '#10b981',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button onClick={run} style={btn}>检查当前画板</button>
      {suggestions && (
        <div style={{ fontSize: 11, color: '#9ca3af' }}>
          {suggestions.length === 0 ? '未发现可优化项' : `${suggestions.length} 条建议`}
          {' · '}本次会话：展示 {metrics.shown} / 应用 {metrics.applied} / 撤销可用 Ctrl+Z
        </div>
      )}
      {suggestions?.map(s => (
        <div key={s.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: 13, color: ruleColor[s.rule] }}>{s.title}</b>
            <span style={{ fontSize: 10, color: '#c0c4cc' }}>{s.rule}</span>
          </div>
          <div style={{ fontSize: 12, color: '#374151', margin: '6px 0' }}>{s.message}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {s.patches.length > 0 && (
              <button onClick={() => apply(s)} style={{ ...smallBtn, background: '#f97316', color: '#fff', borderColor: '#f97316' }}>应用</button>
            )}
            <button onClick={() => { setIgnored(v => new Set(v).add(s.id)); setSuggestions(prev => (prev ?? []).filter(x => x.id !== s.id)); }}
              style={smallBtn}>忽略</button>
          </div>
        </div>
      ))}
      <div style={{ fontSize: 10, color: '#c0c4cc' }}>
        规则版引擎 v1：对齐 / 间距 / 对比度 / 层级 / 文案长度（S2 封版 5 类）
      </div>
    </div>
  );
}

const smallBtn: React.CSSProperties = {
  border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6,
  fontSize: 12, padding: '4px 12px', cursor: 'pointer',
};

export function RightPanel() {
  const selection = useStore(s => s.editor.selection);
  const device = useStore(s => s.editor.currentDevice);
  const page = useStore(s => {
    const pid = s.editor.currentPageId;
    return s.project.pages.find(pg => pg.id === pid) ?? s.project.pages[0];
  });
  const [tab, setTab] = useState<'props' | 'check'>('props');
  const fileRef = useRef<HTMLInputElement>(null);

  const board = page.boards[device];
  const count = Object.keys(board.nodes).length - 1;
  const sel = selection.length === 1 ? board.nodes[selection[0]] : undefined;
  const meta = sel ? REGISTRY_MAP[sel.type] : undefined;
  const { setFrameField, copyBoardFrom, setNodeFlag, setNodeName, reorderNode } = useStore(s => s.actions);

  return (
    <aside style={panel}>
      <div style={{ ...head, display: 'flex', gap: 12 }}>
        {(['props', 'check'] as const).map(t => (
          <span key={t} onClick={() => setTab(t)}
            style={{ cursor: 'pointer', paddingBottom: 2, borderBottom: tab === t ? '2px solid #f97316' : '2px solid transparent', color: tab === t ? '#1f2328' : '#9ca3af' }}>
            {t === 'props' ? '属性' : 'AI 检查'}
          </span>
        ))}
      </div>

      {tab === 'props' ? (
        <div style={{ padding: 12, fontSize: 13, color: '#374151', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', flex: 1 }}>
          {/* 画板信息 + DV-04 复制入口 */}
          <div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>当前画板</div>
            <div>{page.name} · {device}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{count} 个模块</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#9ca3af' }}>复制自:</span>
              {(['desktop', 'mobile', 'watch'] as const).filter(d => d !== device).map(d => (
                <button key={d} onClick={() => copyBoardFrom(d)}
                  style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 5, fontSize: 10, padding: '2px 7px', cursor: 'pointer' }}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {sel && meta ? (
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>选中：</span>
                <span style={{ fontSize: 10, color: '#c0c4cc' }}>{sel.type}</span>
                <input
                  value={sel.name}
                  onChange={e => setNodeName(sel.id, e.target.value)}
                  style={{ ...fieldInputStyle(), marginTop: 4, fontWeight: 600 }}
                />
              </div>

              {/* 图层顺序（PP-02） */}
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#9ca3af', width: 64 }}>图层顺序</span>
                {([['front', '置顶'], ['forward', '上移'], ['backward', '下移'], ['back', '置底']] as const).map(([dir, label]) => (
                  <button key={dir} onClick={() => reorderNode(sel.id, dir)} style={{ ...smallBtn, padding: '3px 7px', fontSize: 11 }}>{label}</button>
                ))}
              </div>

              {/* 显隐 / 锁定（PP-03） */}
              <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={Boolean(sel.hidden)} onChange={e => setNodeFlag(sel.id, 'hidden', e.target.checked)} />
                  隐藏
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={Boolean(sel.locked)} onChange={e => setNodeFlag(sel.id, 'locked', e.target.checked)} />
                  锁定
                </label>
              </div>

              {/* 位置尺寸 */}
              <div style={{ fontSize: 11, color: '#9ca3af' }}>位置与尺寸</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {(['x', 'y', 'w', 'h'] as const).map(k => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: '#6b7280', width: 14 }}>{k.toUpperCase()}</span>
                    <input type="number" style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 6px', fontSize: 12 }}
                      value={sel.frame[k]} onChange={e => setFrameField(sel.id, k, Number(e.target.value))} />
                  </div>
                ))}
              </div>

              {meta.fields.length > 0 && (
                <>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>模块属性</div>
                  {meta.fields.map(f => <Field key={f.key + f.target} def={f} node={sel} />)}
                </>
              )}

              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>events（接口挂载点，只读）</div>
              <pre style={{ margin: 0, fontSize: 10, background: '#f7f5f1', padding: 8, borderRadius: 6, overflow: 'auto', maxHeight: 120 }}>
{JSON.stringify(sel.events, null, 2)}
              </pre>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              未选中模块。点击画布中的模块查看与编辑属性。
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
          <CheckTab />
        </div>
      )}

      <div style={{ padding: 12, borderTop: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={exportZip} style={btn}>导出工程（zip）</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportJson} style={{ ...btn, flex: 1, background: '#fff', color: '#374151', border: '1px solid #e5e7eb' }}>导出 JSON</button>
          <button onClick={() => fileRef.current?.click()} style={{ ...btn, flex: 1, background: '#fff', color: '#374151', border: '1px solid #e5e7eb' }}>导入 JSON</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
        <button onClick={clearBoard} style={{ ...btn, background: '#ffffff', color: '#b91c1c', border: '1px solid #fecaca' }}>
          清空当前画板
        </button>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>
          自动保存已开启；Ctrl+Z 撤销 / Ctrl+Shift+Z 重做
        </div>
      </div>
    </aside>
  );
}

const panel: React.CSSProperties = {
  width: 280, flexShrink: 0, background: '#ffffff',
  borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', minHeight: 0,
};
const head: React.CSSProperties = {
  padding: '10px 12px', fontSize: 12, letterSpacing: 1,
  color: '#6b7280', borderBottom: '1px solid #e5e7eb', flexShrink: 0,
};
const btn: React.CSSProperties = {
  border: 'none', background: '#f97316', color: '#fff',
  borderRadius: 8, padding: '8px 0', fontSize: 13, cursor: 'pointer',
};
