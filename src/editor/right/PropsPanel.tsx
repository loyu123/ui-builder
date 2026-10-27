// 属性页签（P1-13 拆分自 RightPanel）：
// 当前画板信息 + 单选属性表单（位置/旋转/备注/属性/事件） + 多选批量对齐删除 + 空态
// P1-17 · 重复内联样式改用 index.css 的 .ub-* 类（.ub-field/.ub-btn/...），色值走 CSS 变量
import { useState } from 'react';
import type * as React from 'react';
import { useStore } from '../../store';
import { REGISTRY_MAP, type FieldDef } from '../../modules/registry';
import { EVENT_ACTIONS } from './shared';

type NodeT = NonNullable<ReturnType<typeof getSelNode>>;

function getSelNode() {
  const s = useStore.getState();
  const page = s.project.pages.find(pg => pg.id === s.editor.currentPageId) ?? s.project.pages[0];
  const board = page.boards[s.editor.currentDevice];
  return s.editor.selection.length === 1 ? board.nodes[s.editor.selection[0]] : undefined;
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
      <span style={{ width: 64, fontSize: 11, color: 'var(--ink-faint)', flexShrink: 0 }}>{def.label}</span>
      {def.type === 'text' && <input className="ub-field" value={String(value)} onChange={e => commit(e.target.value)} />}
      {def.type === 'textarea' && (
        <textarea className="ub-field" style={{ height: 44, resize: 'vertical', fontFamily: 'inherit' }}
          value={String(value)} onChange={e => commit(e.target.value)} />
      )}
      {def.type === 'number' && (
        <input type="number" className="ub-field" value={Number(value) || 0}
          min={def.min} max={def.max} onChange={e => commit(Number(e.target.value))} />
      )}
      {def.type === 'color' && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="color" style={{ width: 28, height: 24, border: '1px solid var(--line)', borderRadius: 4, background: 'none', padding: 0 }}
            value={String(value || '#ffffff')} onChange={e => commit(e.target.value)} />
          <input className="ub-field" style={{ width: 88 }} value={String(value)} onChange={e => commit(e.target.value)} />
        </span>
      )}
      {def.type === 'select' && (
        <select className="ub-field" value={String(value)} onChange={e => commit(e.target.value)}>
          {def.options?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
    </div>
  );
}

export function PropsPanel(): React.ReactNode {
  const selection = useStore(s => s.editor.selection);
  const device = useStore(s => s.editor.currentDevice);
  const page = useStore(s => {
    const pid = s.editor.currentPageId;
    return s.project.pages.find(pg => pg.id === pid) ?? s.project.pages[0];
  });
  const [, force] = useState(0);
  const board = page.boards[device];
  const sel = selection.length === 1 ? board.nodes[selection[0]] : undefined;
  const meta = sel ? REGISTRY_MAP[sel.type] : undefined;
  const { setFrameField, copyBoardFrom, setNodeFlag, setNodeName, reorderNode, setNodeNote, setNodePos, setNodeEvent, setNodeRotation, deleteNode, alignSelection } = useStore(s => s.actions);
  const pages = useStore(s => s.project.pages);

  return (
    <div style={{ padding: 12, fontSize: 13, color: 'var(--ink-2)', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', flex: 1 }}>
      <div>
        <div className="ub-label">当前画板</div>
        <div>{page.name} · {device}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{Object.keys(board.nodes).length - 1} 个模块</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="ub-label-sm">复制自:</span>
          {(['desktop', 'mobile', 'watch'] as const).filter(d => d !== device).map(d => (
            <button key={d} onClick={() => copyBoardFrom(d)} className="ub-btn"
              style={{ flex: 'none', borderRadius: 5, fontSize: 10, padding: '2px 7px' }}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {sel && meta ? (
        <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <span className="ub-label">选中：</span>
            <span className="ub-label-sm" style={{ color: 'var(--faint-3)' }}>{sel.type}</span>
            <input className="ub-field" style={{ marginTop: 4, fontWeight: 600 }} value={sel.name}
              onChange={e => { setNodeName(sel.id, e.target.value); force(n => n + 1); }} />
          </div>

          <div style={{ display: 'flex', gap: 14, fontSize: 12, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={Boolean(sel.hidden)} onChange={e => setNodeFlag(sel.id, 'hidden', e.target.checked)} />
              隐藏
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={Boolean(sel.locked)} onChange={e => setNodeFlag(sel.id, 'locked', e.target.checked)} />
              锁定
            </label>
            <button onClick={() => deleteNode(sel.id)} className="ub-btn ub-btn-danger"
              style={{ marginLeft: 'auto', flex: 'none', fontSize: 11, padding: '4px 10px' }}>
              删除模块（Delete）
            </button>
          </div>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)', width: 64 }}>图层顺序</span>
            {([['front', '置顶'], ['forward', '上移'], ['backward', '下移'], ['back', '置底']] as const).map(([dir, label]) => (
              <button key={dir} onClick={() => reorderNode(sel.id, dir)} className="ub-btn ub-btn-sm">{label}</button>
            ))}
          </div>

          <div className="ub-label">位置与尺寸</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {(['x', 'y', 'w', 'h'] as const).map(k => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--ink-faint)', width: 14 }}>{k.toUpperCase()}</span>
                <input type="number" className="ub-field" style={{ padding: '5px 6px' }}
                  value={sel.frame[k]} onChange={e => setFrameField(sel.id, k, Number(e.target.value))} />
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-faint)', width: 14 }}>↻</span>
              <input type="number" min={0} max={359} className="ub-field" style={{ padding: '5px 6px' }}
                value={sel.rotation ?? 0} onChange={e => setNodeRotation(sel.id, Number(e.target.value))} />
              <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>度</span>
            </div>
            <button onClick={() => setNodeRotation(sel.id, 0)} className="ub-btn ub-btn-sm">归零</button>
          </div>

          {/* 功能备注（核心需求：描述该模块在最终成果中的功能） */}
          <div className="ub-label" style={{ marginTop: 4 }}>功能备注</div>
          <textarea
            placeholder="描述该模块在最终成果中所代表的功能，如：此按钮用于提交登录表单"
            value={sel.note ?? ''}
            onChange={e => setNodeNote(sel.id, e.target.value)}
            className="ub-field" style={{ height: 52, resize: 'vertical', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 64, fontSize: 11, color: 'var(--ink-faint)', flexShrink: 0 }}>拖入位置</span>
            <select className="ub-field" value={sel.pos ?? '自动'} onChange={e => setNodePos(sel.id, e.target.value)}>
              {['自动', '页面顶部', '页面中部', '页面底部'].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>

          {meta.fields.length > 0 && (
            <>
              <div className="ub-label" style={{ marginTop: 4 }}>模块属性</div>
              {meta.fields.map(f => <Field key={f.key + f.target} def={f} node={sel} />)}
            </>
          )}

          <div className="ub-label" style={{ marginTop: 4 }}>events（事件绑定）</div>
          {Object.entries(sel.events).map(([ev, spec]) => (
            <div key={ev} className="ub-card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>{ev}</div>
              <select className="ub-field" value={spec.action}
                onChange={e => setNodeEvent(sel.id, ev, { ...spec, action: e.target.value as typeof spec.action })}>
                {EVENT_ACTIONS.map(a => <option key={a.v} value={a.v}>{a.label}</option>)}
              </select>
              {spec.action === 'navigate' && (
                <select className="ub-field" value={spec.target ?? ''}
                  onChange={e => setNodeEvent(sel.id, ev, { ...spec, target: e.target.value || null })}>
                  <option value="">选择目标页面…</option>
                  {pages.map(pg => <option key={pg.id} value={pg.id}>{pg.name}</option>)}
                </select>
              )}
              {spec.action !== 'none' && spec.action !== 'navigate' && (
                <input className="ub-field" placeholder="目标 / 参数"
                  value={spec.target ?? ''}
                  onChange={e => setNodeEvent(sel.id, ev, { ...spec, target: e.target.value || null })} />
              )}
              {spec.action !== 'none' && (
                <input className="ub-field" placeholder="备注（可选）"
                  value={spec.note ?? ''}
                  onChange={e => setNodeEvent(sel.id, ev, { ...spec, note: e.target.value })} />
              )}
            </div>
          ))}

          <button onClick={() => useStore.getState().actions.clearBoard()} className="ub-btn ub-btn-danger">
            清空当前画板
          </button>
          <div className="ub-label">
            自动保存已开启；Ctrl+Z 撤销 / Ctrl+Shift+Z 重做
          </div>
        </div>
      ) : selection.length > 1 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>已选 {selection.length} 个模块</div>
          <div className="ub-label">批量对齐（对齐到选中集公共边界）</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {([['left', '左对齐'], ['top', '顶对齐'], ['right', '右对齐'], ['bottom', '底对齐']] as const).map(([dir, label]) => (
              <button key={dir} onClick={() => alignSelection(dir)} className="ub-btn">{label}</button>
            ))}
          </div>
          <button onClick={() => { for (const id of selection) deleteNode(id); }} className="ub-btn ub-btn-danger">
            删除全部（{selection.length} 个，可撤销）
          </button>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--faint)' }}>
          未选中模块。点击画布中的模块查看与编辑属性。
        </div>
      )}
    </div>
  );
}
