// 右栏 · PP-01~04 属性面板（注册表驱动字段组）+ events 只读 + 导出
import type * as React from 'react';
import { useStore } from '../store';
import { REGISTRY_MAP, type FieldDef } from '../modules/registry';

function exportJson() {
  const { project } = useStore.getState();
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pages.json';
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

function labelStyle(): React.CSSProperties {
  return { width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 8px', fontSize: 12, background: '#fff' };
}

function Field({ def, node }: { def: FieldDef; node: NonNullable<ReturnType<typeof getSelNode>> }) {
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
      {def.type === 'text' && (
        <input style={labelStyle()} value={String(value)} onChange={e => commit(e.target.value)} />
      )}
      {def.type === 'textarea' && (
        <textarea
          style={{ ...labelStyle(), height: 44, resize: 'vertical', fontFamily: 'inherit' }}
          value={String(value)}
          onChange={e => commit(e.target.value)}
        />
      )}
      {def.type === 'number' && (
        <input
          type="number"
          style={labelStyle()}
          value={Number(value) || 0}
          min={def.min} max={def.max}
          onChange={e => commit(Number(e.target.value))}
        />
      )}
      {def.type === 'color' && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="color"
            style={{ width: 28, height: 24, border: '1px solid #e5e7eb', borderRadius: 4, background: 'none', padding: 0 }}
            value={String(value || '#ffffff')}
            onChange={e => commit(e.target.value)}
          />
          <input style={{ ...labelStyle(), width: 90 }} value={String(value)} onChange={e => commit(e.target.value)} />
        </span>
      )}
      {def.type === 'select' && (
        <select style={labelStyle()} value={String(value)} onChange={e => commit(e.target.value)}>
          {def.options?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
    </div>
  );
}

function getSelNode() {
  const s = useStore.getState();
  const page = s.project.pages.find(pg => pg.id === s.editor.currentPageId) ?? s.project.pages[0];
  const board = page.boards[s.editor.currentDevice];
  return s.editor.selection.length === 1 ? board.nodes[s.editor.selection[0]] : undefined;
}

export function RightPanel() {
  const selection = useStore(s => s.editor.selection);
  const device = useStore(s => s.editor.currentDevice);
  const page = useStore(s => {
    const pid = s.editor.currentPageId;
    return s.project.pages.find(pg => pg.id === pid) ?? s.project.pages[0];
  });
  const board = page.boards[device];
  const count = Object.keys(board.nodes).length - 1;
  const sel = selection.length === 1 ? board.nodes[selection[0]] : undefined;
  const meta = sel ? REGISTRY_MAP[sel.type] : undefined;
  const { setFrameField, copyBoardFrom } = useStore(s => s.actions);

  return (
    <aside style={panel}>
      <div style={head}>检查器</div>
      <div style={{ padding: 12, fontSize: 13, color: '#374151', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', flex: 1 }}>
        {/* 画板信息 + DV-04 复制入口 */}
        <div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>当前画板</div>
          <div>{page.name} · {device}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{count} 个模块</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: '#9ca3af', alignSelf: 'center' }}>复制自:</span>
            {['desktop', 'mobile', 'watch'].filter(d => d !== device).map(d => (
              <button key={d} onClick={() => copyBoardFrom(d as never)}
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
              <b>{sel.name}</b>
              <span style={{ fontSize: 10, color: '#c0c4cc', marginLeft: 6 }}>{sel.type}</span>
            </div>

            {/* 位置尺寸（PP-02） */}
            <div style={{ fontSize: 11, color: '#9ca3af' }}>位置与尺寸</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {(['x', 'y', 'w', 'h'] as const).map(k => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11, color: '#6b7280', width: 14 }}>{k.toUpperCase()}</span>
                  <input
                    type="number"
                    style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 6px', fontSize: 12 }}
                    value={sel.frame[k]}
                    onChange={e => setFrameField(sel.id, k, Number(e.target.value))}
                  />
                </div>
              ))}
            </div>

            {/* 模块字段（PP-03，注册表驱动） */}
            {meta.fields.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>模块属性</div>
                {meta.fields.map(f => <Field key={f.key + f.target} def={f} node={sel} />)}
              </>
            )}

            {/* events 只读（PP-04） */}
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>events（接口挂载点，只读）</div>
            <pre style={{
              margin: 0, fontSize: 10, background: '#f7f5f1', padding: 8,
              borderRadius: 6, overflow: 'auto', maxHeight: 120,
            }}>
{JSON.stringify(sel.events, null, 2)}
            </pre>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#9ca3af' }}>
            未选中模块。点击画布中的模块查看与编辑属性。
          </div>
        )}
      </div>

      <div style={{ padding: 12, borderTop: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={exportJson} style={btn}>导出 JSON</button>
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
  padding: '10px 12px', fontSize: 12, letterSpacing: 2,
  color: '#6b7280', borderBottom: '1px solid #e5e7eb', flexShrink: 0,
};
const btn: React.CSSProperties = {
  border: 'none', background: '#f97316', color: '#fff',
  borderRadius: 8, padding: '8px 0', fontSize: 13, cursor: 'pointer',
};
