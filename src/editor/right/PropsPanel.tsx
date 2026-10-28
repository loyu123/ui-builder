// 属性页签（P1-13 拆分自 RightPanel）：
// 当前画板信息 + 单选属性表单（位置/旋转/备注/属性/事件） + 多选批量对齐删除 + 空态
// P1-17 · 重复内联样式改用 index.css 的 .ub-* 类（.ub-field/.ub-btn/...），色值走 CSS 变量
import { useState } from 'react';
import type * as React from 'react';
import { useStore } from '../../store';
import { REGISTRY_MAP, type FieldDef } from '../../modules/registry';
import { eventActions } from './shared';
import { useT } from '../../lib/i18n';

type NodeT = NonNullable<ReturnType<typeof getSelNode>>;

// P3-40 · 拖入位置存储值保持中文兼容（存量 pages.json），展示层走 i18n
const POS_STORE: Record<string, string> = { auto: '自动', top: '页面顶部', middle: '页面中部', bottom: '页面底部' };

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
  const t = useT();
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
  const { setFrameField, copyBoardFrom, setNodeFlag, setNodeName, reorderNode, setNodeNote, setNodePos, setNodeEvent, setNodeRotation, deleteNode, alignSelection, distributeSelection } = useStore(s => s.actions);
  const pages = useStore(s => s.project.pages);

  return (
    <div style={{ padding: 12, fontSize: 13, color: 'var(--ink-2)', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', flex: 1 }}>
      <div>
        <div className="ub-label">{t('current_board')}</div>
        <div>{page.name} · {device}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('module_count_short', { n: Object.keys(board.nodes).length - 1 })}</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="ub-label-sm">{t('copy_from')}</span>
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
            <span className="ub-label">{t('selected')}</span>
            <span className="ub-label-sm" style={{ color: 'var(--faint-3)' }}>{sel.type}</span>
            <input className="ub-field" style={{ marginTop: 4, fontWeight: 600 }} value={sel.name}
              onChange={e => { setNodeName(sel.id, e.target.value); force(n => n + 1); }} />
          </div>

          <div style={{ display: 'flex', gap: 14, fontSize: 12, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={Boolean(sel.hidden)} onChange={e => setNodeFlag(sel.id, 'hidden', e.target.checked)} />
              {t('flag_hidden')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={Boolean(sel.locked)} onChange={e => setNodeFlag(sel.id, 'locked', e.target.checked)} />
              {t('flag_locked')}
            </label>
            <button onClick={() => deleteNode(sel.id)} className="ub-btn ub-btn-danger"
              style={{ marginLeft: 'auto', flex: 'none', fontSize: 11, padding: '4px 10px' }}>
              {t('delete_module')}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)', width: 64 }}>{t('layer_order')}</span>
            {(['front', 'forward', 'backward', 'back'] as const).map(dir => (
              <button key={dir} onClick={() => reorderNode(sel.id, dir)} className="ub-btn ub-btn-sm">{t('order_' + dir)}</button>
            ))}
          </div>

          <div className="ub-label">{t('pos_size')}</div>
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
              <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{t('deg')}</span>
            </div>
            <button onClick={() => setNodeRotation(sel.id, 0)} className="ub-btn ub-btn-sm">{t('reset_rotation')}</button>
          </div>

          {/* 功能备注（核心需求：描述该模块在最终成果中的功能） */}
          <div className="ub-label" style={{ marginTop: 4 }}>{t('note_label')}</div>
          <textarea
            placeholder={t('note_placeholder')}
            value={sel.note ?? ''}
            onChange={e => setNodeNote(sel.id, e.target.value)}
            className="ub-field" style={{ height: 52, resize: 'vertical', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 64, fontSize: 11, color: 'var(--ink-faint)', flexShrink: 0 }}>{t('drop_pos')}</span>
            <select className="ub-field" value={sel.pos ?? POS_STORE.auto} onChange={e => setNodePos(sel.id, e.target.value)}>
              {Object.keys(POS_STORE).map(k => <option key={k} value={POS_STORE[k]}>{t('pos_' + k)}</option>)}
            </select>
          </div>

          {meta.fields.length > 0 && (
            <>
              <div className="ub-label" style={{ marginTop: 4 }}>{t('module_props')}</div>
              {meta.fields.map(f => <Field key={f.key + f.target} def={f} node={sel} />)}
            </>
          )}

          <div className="ub-label" style={{ marginTop: 4 }}>{t('events_label')}</div>
          {Object.entries(sel.events).map(([ev, spec]) => (
            <div key={ev} className="ub-card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>{ev}</div>
              <select className="ub-field" value={spec.action}
                onChange={e => setNodeEvent(sel.id, ev, { ...spec, action: e.target.value as typeof spec.action })}>
                {eventActions().map(a => <option key={a.v} value={a.v}>{a.label}</option>)}
              </select>
              {spec.action === 'navigate' && (
                <select className="ub-field" value={spec.target ?? ''}
                  onChange={e => setNodeEvent(sel.id, ev, { ...spec, target: e.target.value || null })}>
                  <option value="">{t('select_target_page')}</option>
                  {pages.map(pg => <option key={pg.id} value={pg.id}>{pg.name}</option>)}
                </select>
              )}
              {spec.action !== 'none' && spec.action !== 'navigate' && (
                <input className="ub-field" placeholder={t('event_target_placeholder')}
                  value={spec.target ?? ''}
                  onChange={e => setNodeEvent(sel.id, ev, { ...spec, target: e.target.value || null })} />
              )}
              {spec.action !== 'none' && (
                <input className="ub-field" placeholder={t('event_note_placeholder')}
                  value={spec.note ?? ''}
                  onChange={e => setNodeEvent(sel.id, ev, { ...spec, note: e.target.value })} />
              )}
            </div>
          ))}

          <button onClick={() => useStore.getState().actions.clearBoard()} className="ub-btn ub-btn-danger">
            {t('clear_board')}
          </button>
          <div className="ub-label">
            {t('autosave_hint')}
          </div>
        </div>
      ) : selection.length > 1 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{t('selected_count', { n: selection.length })}</div>
          <div className="ub-label">{t('batch_align_hint')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {(['left', 'right', 'top', 'bottom', 'hcenter', 'vcenter'] as const).map(dir => (
              <button key={dir} onClick={() => alignSelection(dir)} className="ub-btn">{t('align_' + dir)}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {(['h', 'v'] as const).map(axis => (
              <button key={axis} onClick={() => distributeSelection(axis)}
                disabled={selection.length < 3}
                className="ub-btn" style={{ opacity: selection.length < 3 ? 0.5 : 1 }}>
                {t('distribute_' + axis)}
              </button>
            ))}
          </div>
          <div className="ub-label-sm">{t('same_parent_hint')}</div>
          <button onClick={() => { for (const id of selection) deleteNode(id); }} className="ub-btn ub-btn-danger">
            {t('delete_all', { n: selection.length })}
          </button>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--faint)' }}>
          {t('empty_selection')}
        </div>
      )}
    </div>
  );
}
