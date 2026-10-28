// 左栏 · C 方向样式：页面（带宽标注）/ 组件分组（计数+折叠）/ 模块库（两列网格缩略）
import { useEffect, useState, type ReactNode } from 'react';
import type * as React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useStore, DEVICES } from '../store';
import { REGISTRY, REGISTRY_MAP } from '../modules/registry';
import { useT, t, moduleLabel, categoryLabel } from '../lib/i18n';
import { buildLayerRows, type LayerRow } from '../lib/tree';
import { IconLock } from './icons';
import type { Board } from '../types';

// P2-29 + F5 · 图层树行（扁平列表渲染）：点击选中、折叠/展开、行内切换隐藏与锁定
function LayerRowView({ row, board, onToggle }: {
  row: LayerRow;
  board: Board;
  onToggle: (id: string) => void;
}): ReactNode {
  const n = board.nodes[row.id];
  const selection = useStore(s => s.editor.selection);
  const select = useStore(s => s.actions.select);
  const setNodeFlag = useStore(s => s.actions.setNodeFlag);
  if (!n) return null;
  const selected = selection.includes(row.id);
  return (
    <div
      role="button"
      aria-selected={selected}
      data-layer-id={row.id}
      onClick={() => select([row.id])}
      className={`ub-row ub-row-layer${selected ? ' active' : ''}`}
      style={{
        paddingLeft: row.depth * 12 + 6,   // P1-17 · 层级缩进仍需动态内联
        color: selected ? undefined : n.hidden ? 'var(--ghost)' : undefined,
      }}>
      <span
        onClick={e => { e.stopPropagation(); if (row.hasChildren) onToggle(row.id); }}
        style={{ fontSize: 9, color: 'var(--faint-2)', width: 10, flexShrink: 0, cursor: row.hasChildren ? 'pointer' : 'default' }}>
        {row.hasChildren ? (row.collapsed ? '▸' : '▾') : '·'}
      </span>
      <span className="ub-row-label">{n.name}</span>
      <span style={{ fontSize: 9, color: 'var(--faint-2)', flexShrink: 0, marginRight: 2 }}>
        {REGISTRY_MAP[n.type] ? moduleLabel(REGISTRY_MAP[n.type]) : n.type}
      </span>
      <button
        className="ub-icon-btn"
        title={t('flag_hidden')}
        aria-label={t('flag_hidden')}
        aria-pressed={Boolean(n.hidden)}
        style={{ fontSize: 10, padding: '0 2px', lineHeight: 1.4, color: n.hidden ? 'var(--accent)' : 'var(--faint-3)' }}
        onClick={e => { e.stopPropagation(); setNodeFlag(n.id, 'hidden', !n.hidden); }}>
        {n.hidden ? '⊘' : '◉'}
      </button>
      <button
        className="ub-icon-btn"
        title={t('flag_locked')}
        aria-label={t('flag_locked')}
        aria-pressed={Boolean(n.locked)}
        style={{ padding: '0 2px', lineHeight: 1.4, color: n.locked ? 'var(--accent)' : 'var(--faint-3)' }}
        onClick={e => { e.stopPropagation(); setNodeFlag(n.id, 'locked', !n.locked); }}>
        <IconLock open={!n.locked} size={11} />
      </button>
    </div>
  );
}

// —— 模块缩略图形（C 方向：tile 内画小形状） ——
function Thumb({ type }: { type: string }): React.ReactNode {
  const line = { height: 3, borderRadius: 2, background: 'var(--ghost)' };
  switch (type) {
    case 'button-primary':
      return <div style={{ width: '100%', height: 10, borderRadius: 5, background: 'var(--accent)' }} />;
    case 'button-secondary':
      return <div style={{ width: '100%', height: 10, borderRadius: 5, border: '1px solid var(--faint-3)' }} />;
    case 'input': case 'password': case 'textarea': case 'select':
      return <div style={{ width: '100%', height: 12, border: '1px solid var(--faint-3)', borderRadius: 3, borderBottomWidth: 2 }} />;
    case 'heading':
      return <div style={{ ...line, width: '70%', height: 5, background: 'var(--ink-faint)' }} />;
    case 'paragraph':
      return <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}><div style={line} /><div style={{ ...line, width: '60%' }} /></div>;
    case 'image':
      return <div style={{ width: '100%', height: '100%', border: '1px solid var(--faint-3)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint-2)', fontSize: 9 }}>△</div>;
    case 'avatar':
      return <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#dbeafe', border: '1px solid #bfdbfe' }} />;
    case 'icon':
      return <div style={{ color: 'var(--ink-faint)', fontSize: 12 }}>★</div>;
    case 'switch':
      return <div style={{ width: 22, height: 12, borderRadius: 999, background: 'var(--accent)', position: 'relative' }}><div style={{ position: 'absolute', right: 1, top: 1, width: 10, height: 10, borderRadius: '50%', background: '#fff' }} /></div>;
    case 'divider':
      return <div style={{ width: '100%', height: 1, background: 'var(--faint-3)' }} />;
    case 'card': case 'group':
      return <div style={{ width: '100%', height: '100%', minHeight: 14, border: '1px solid var(--faint-3)', borderRadius: 4 }} />;
    case 'tabbar': case 'topnav':
      return <div style={{ width: '100%', display: 'flex', gap: 2 }}><div style={{ flex: 1, height: 8, background: 'var(--line-soft)', borderRadius: 2 }} /><div style={{ flex: 1, height: 8, background: 'var(--accent)', borderRadius: 2, opacity: .8 }} /><div style={{ flex: 1, height: 8, background: 'var(--line-soft)', borderRadius: 2 }} /></div>;
    case 'list-item':
      return <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 3 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--line-soft)' }} /><div style={{ ...line, flex: 1 }} /></div>;
    case 'table':
      return <div style={{ width: '100%', height: '100%', minHeight: 14, border: '1px solid var(--faint-3)', borderRadius: 2, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, padding: 1 }}>{[...Array(6)].map((_, i) => <div key={i} style={{ background: 'var(--line-soft)' }} />)}</div>;
    case 'stat':
      return <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}><div style={{ ...line, width: '40%' }} /><div style={{ ...line, width: '80%', height: 5, background: 'var(--ink-faint)' }} /></div>;
    case 'progress':
      return <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'var(--line-soft)', overflow: 'hidden' }}><div style={{ width: '60%', height: '100%', background: 'var(--accent)' }} /></div>;
    case 'message-bubble':
      return <div style={{ width: '80%', height: 12, borderRadius: 6, borderBottomLeftRadius: 2, background: 'var(--line-soft)' }} />;
    case 'comment':
      return <div style={{ width: '100%', display: 'flex', gap: 3, alignItems: 'center' }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--line-soft)' }} /><div style={{ ...line, flex: 1 }} /></div>;
    case 'notification':
      return <div style={{ width: '100%', height: 10, borderRadius: 3, background: 'var(--accent)', opacity: .25 }} />;
    case 'mobile-statusbar':
      return <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ ...line, width: 10 }} /><div style={{ ...line, width: 14 }} /></div>;
    case 'home-indicator':
      return <div style={{ width: 26, height: 3, borderRadius: 2, background: 'var(--ink-faint)' }} />;
    case 'watch-face':
      return <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--ink-faint)' }} />;
    case 'watch-list-row':
      return <div style={{ width: '100%', height: 10, borderRadius: 5, background: 'var(--line-soft)' }} />;
    default:
      return <div style={{ width: '100%', height: 12, border: '1px solid var(--faint-3)', borderRadius: 3 }} />;
  }
}

function ModuleTile({ type }: { type: string }) {
  const meta = REGISTRY_MAP[type];
  const device = useStore(s => s.editor.currentDevice);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib-${type}`,
    data: { fromLibrary: true, type },
  });
  if (meta.devices && !meta.devices.includes(device)) return null;
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={`${moduleLabel(meta)}（${meta.w}×${meta.h}${meta.isContainer ? '，容器' : ''}）`}
      style={{
        border: '1px solid var(--line)', borderRadius: 10, padding: '10px 6px 7px',
        background: isDragging ? 'var(--accent-soft)' : 'var(--panel)', cursor: 'grab',
        userSelect: 'none', touchAction: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        minHeight: 52, justifyContent: 'center',
      }}
    >
      <div style={{ width: 36, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <Thumb type={type} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--ink-2)', lineHeight: 1 }}>{moduleLabel(meta)}</span>
    </div>
  );
}

const PALETTE = REGISTRY.filter(m => m.palette !== false);

export function LeftPanel({ previewing }: { previewing?: boolean }) {
  const t = useT();
  const pages = useStore(s => s.project.pages);
  const currentPageId = useStore(s => s.editor.currentPageId);
  const device = useStore(s => s.editor.currentDevice);
  const [kw, setKw] = useState('');
  const [layerKw, setLayerKw] = useState('');                 // F5 · 图层名称过滤
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());   // F5 · 折叠集合
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  const { setPage, addPage, renamePage, deletePage } = useStore(s => s.actions);
  const layerRoot = useStore(s => {
    const pg = s.project.pages.find(p => p.id === s.editor.currentPageId) ?? s.project.pages[0];
    return pg.boards[s.editor.currentDevice];
  });
  const devW = DEVICES[device].w;
  const selection = useStore(s => s.editor.selection);
  const layerRows = buildLayerRows(layerRoot, layerKw, collapsed);
  const toggleCollapse = (id: string) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  // F5 · 画布选中反向同步：树内滚动到可视区
  useEffect(() => {
    const id = selection.length === 1 ? selection[0] : null;
    if (!id) return;
    document.querySelector(`[data-layer-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selection]);

  if (previewing) return null;   // hooks 之后才允许条件 return（rules-of-hooks）

  const filtered = PALETTE.filter(m => !kw || m.label.includes(kw) || m.type.includes(kw));
  const categories = [...new Set(filtered.map(m => m.category))];
  const toggleCat = (c: string) => setOpenCats(prev => {
    const n = new Set(prev);
    if (n.has(c)) n.delete(c); else n.add(c);
    return n;
  });

  return (
    <aside className="ub-panel ub-panel-left">
      {/* 页面（C：名称 + 设备宽度标注） */}
      <div className="ub-head" style={{ padding: '10px 10px 5px', fontSize: 12, letterSpacing: 1, color: 'var(--muted)', userSelect: 'none', display: 'flex', alignItems: 'center' }}>
        {t('panel_pages')}
        <span title={t('new_page')} onClick={() => addPage()}
          style={{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--accent)', fontWeight: 700, padding: '0 4px' }}>＋</span>
      </div>
      <div>
        {pages.map(pg => (
          <div key={pg.id}
            onClick={() => setPage(pg.id)}
            onDoubleClick={() => { const name = window.prompt(t('rename_page'), pg.name); if (name) renamePage(pg.id, name); }}
            className={`ub-row ub-row-page${pg.id === currentPageId ? ' active' : ''}`}>
            <span style={{ fontSize: 10, color: pg.id === currentPageId ? 'var(--accent)' : 'var(--faint-3)' }}>□</span>
            <span className="ub-row-label">{pg.name}</span>
            <span style={{ fontSize: 10, color: 'var(--faint-2)' }}>{devW}</span>
            {pages.length > 1 && (
              <span title={t('delete')} onClick={e => { e.stopPropagation(); if (window.confirm(t('confirm_delete_page', { name: pg.name }))) deletePage(pg.id); }}
                style={{ color: 'var(--ghost)', fontSize: 11 }}>✕</span>
            )}
          </div>
        ))}
        <div style={{ padding: '1px 10px 4px', fontSize: 9, color: 'var(--faint-3)' }}>{t('double_click_rename')}</div>
      </div>

      {/* P2-29 · 图层树：当前画板节点结构，点击选中深层模块 */}
      <div className="ub-head" style={{ marginTop: 2, padding: '10px 10px 5px', fontSize: 12, letterSpacing: 1, color: 'var(--muted)', userSelect: 'none' }}>{t('layers_of', { d: t('device_' + device) })}</div>
      <div style={{ padding: '0 10px 5px' }}>
        <input
          className="ub-field"
          placeholder={t('layer_filter')}
          value={layerKw}
          onChange={e => setLayerKw(e.target.value)}
          style={{ borderRadius: 8, padding: '4px 8px', background: 'var(--bg-input)' }}
        />
      </div>
      <div style={{ borderBottom: '1px solid var(--line-soft)', maxHeight: 180, overflowY: 'auto', paddingBottom: 4 }}>
        {layerRows.length === 0 ? (
          <div style={{ padding: '4px 10px 6px', fontSize: 10, color: 'var(--faint-3)' }}>
            {layerKw ? t('no_match') : t('board_empty')}
          </div>
        ) : layerRows.map(row => (
          <LayerRowView key={row.id} row={row} board={layerRoot} onToggle={toggleCollapse} />
        ))}
      </div>

      {/* 组件分组（C：分类 + 计数 + 折叠） */}
      <div className="ub-head" style={{ marginTop: 2, padding: '10px 10px 5px', fontSize: 12, letterSpacing: 1, color: 'var(--muted)', userSelect: 'none' }}>{t('panel_groups')}</div>
      <div style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: 4 }}>
        {categories.map(cat => {
          const n = filtered.filter(m => m.category === cat).length;
          const open = openCats.has(cat);
          return (
            <div key={cat}
              onClick={() => toggleCat(cat)}
              style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--ink-2)' }}>
              <span style={{ fontSize: 9, color: 'var(--faint-2)', width: 10 }}>{open ? '▾' : '▸'}</span>
              <span style={{ flex: 1 }}>{categoryLabel(cat)}</span>
              <span style={{ fontSize: 10, color: 'var(--faint-2)' }}>{n}</span>
            </div>
          );
        })}
      </div>

      {/* 模块库（C：搜索 + 两列网格缩略） */}
      <div className="ub-head" style={{ marginTop: 2, padding: '10px 10px 5px', fontSize: 12, letterSpacing: 1, color: 'var(--muted)', userSelect: 'none', display: 'flex', alignItems: 'center' }}>
        {t('panel_library')}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--faint-2)', letterSpacing: 0 }}>{t('module_count', { n: PALETTE.length })}</span>
      </div>
      <div style={{ padding: '0 10px 6px' }}>
        <input placeholder={t('search_placeholder')} value={kw} onChange={e => setKw(e.target.value)}
          className="ub-field" style={{ borderRadius: 8, padding: '6px 10px', background: 'var(--bg-input)' }} />
      </div>
      <div style={{ padding: '0 10px 10px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {(openCats.size ? categories.filter(c => openCats.has(c)) : categories).map(cat => (
          <div key={cat} style={{ marginBottom: 8 }}>
            {openCats.size > 0 && <div style={{ fontSize: 10, color: 'var(--faint-2)', margin: '4px 2px' }}>{categoryLabel(cat)}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {filtered.filter(m => m.category === cat).map(m => <ModuleTile key={m.type} type={m.type} />)}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ fontSize: 11, color: 'var(--faint-3)', padding: 8 }}>{t('no_match')}</div>}
      </div>

      <div style={{ padding: '8px 12px', fontSize: 10, color: 'var(--faint-2)', borderTop: '1px solid var(--line-soft)' }}>
        {t('drag_hint', { n: PALETTE.length })}
      </div>
    </aside>
  );
}
