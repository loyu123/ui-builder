// 左栏 · C 方向样式：页面（带宽标注）/ 组件分组（计数+折叠）/ 模块库（两列网格缩略）
import { useState } from 'react';
import type * as React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useStore, DEVICES } from '../store';
import { REGISTRY, REGISTRY_MAP } from '../modules/registry';

// —— 模块缩略图形（C 方向：tile 内画小形状） ——
function Thumb({ type }: { type: string }): React.ReactNode {
  const line = { height: 3, borderRadius: 2, background: '#d8d2c8' };
  switch (type) {
    case 'button-primary':
      return <div style={{ width: '100%', height: 10, borderRadius: 5, background: '#f97316' }} />;
    case 'button-secondary':
      return <div style={{ width: '100%', height: 10, borderRadius: 5, border: '1px solid #c9c2b6' }} />;
    case 'input': case 'password': case 'textarea': case 'select':
      return <div style={{ width: '100%', height: 12, border: '1px solid #c9c2b6', borderRadius: 3, borderBottomWidth: 2 }} />;
    case 'heading':
      return <div style={{ ...line, width: '70%', height: 5, background: '#8a8378' }} />;
    case 'paragraph':
      return <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}><div style={line} /><div style={{ ...line, width: '60%' }} /></div>;
    case 'image':
      return <div style={{ width: '100%', height: '100%', border: '1px solid #c9c2b6', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b9b2a6', fontSize: 9 }}>△</div>;
    case 'avatar':
      return <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#f6c8a8', border: '1px solid #eeb083' }} />;
    case 'icon':
      return <div style={{ color: '#8a8378', fontSize: 12 }}>★</div>;
    case 'switch':
      return <div style={{ width: 22, height: 12, borderRadius: 999, background: '#f97316', position: 'relative' }}><div style={{ position: 'absolute', right: 1, top: 1, width: 10, height: 10, borderRadius: '50%', background: '#fff' }} /></div>;
    case 'divider':
      return <div style={{ width: '100%', height: 1, background: '#c9c2b6' }} />;
    case 'card': case 'group':
      return <div style={{ width: '100%', height: '100%', minHeight: 14, border: '1px solid #c9c2b6', borderRadius: 4 }} />;
    case 'tabbar': case 'topnav':
      return <div style={{ width: '100%', display: 'flex', gap: 2 }}><div style={{ flex: 1, height: 8, background: '#efe9e0', borderRadius: 2 }} /><div style={{ flex: 1, height: 8, background: '#f97316', borderRadius: 2, opacity: .8 }} /><div style={{ flex: 1, height: 8, background: '#efe9e0', borderRadius: 2 }} /></div>;
    case 'list-item':
      return <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 3 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: '#e6dfd4' }} /><div style={{ ...line, flex: 1 }} /></div>;
    case 'table':
      return <div style={{ width: '100%', height: '100%', minHeight: 14, border: '1px solid #c9c2b6', borderRadius: 2, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, padding: 1 }}>{[...Array(6)].map((_, i) => <div key={i} style={{ background: '#efe9e0' }} />)}</div>;
    case 'stat':
      return <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}><div style={{ ...line, width: '40%' }} /><div style={{ ...line, width: '80%', height: 5, background: '#8a8378' }} /></div>;
    case 'progress':
      return <div style={{ width: '100%', height: 6, borderRadius: 3, background: '#e6dfd4', overflow: 'hidden' }}><div style={{ width: '60%', height: '100%', background: '#f97316' }} /></div>;
    case 'message-bubble':
      return <div style={{ width: '80%', height: 12, borderRadius: 6, borderBottomLeftRadius: 2, background: '#efe9e0' }} />;
    case 'comment':
      return <div style={{ width: '100%', display: 'flex', gap: 3, alignItems: 'center' }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e6dfd4' }} /><div style={{ ...line, flex: 1 }} /></div>;
    case 'notification':
      return <div style={{ width: '100%', height: 10, borderRadius: 3, background: '#f97316', opacity: .25 }} />;
    case 'mobile-statusbar':
      return <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ ...line, width: 10 }} /><div style={{ ...line, width: 14 }} /></div>;
    case 'home-indicator':
      return <div style={{ width: 26, height: 3, borderRadius: 2, background: '#8a8378' }} />;
    case 'watch-face':
      return <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #8a8378' }} />;
    case 'watch-list-row':
      return <div style={{ width: '100%', height: 10, borderRadius: 5, background: '#efe9e0' }} />;
    default:
      return <div style={{ width: '100%', height: 12, border: '1px solid #c9c2b6', borderRadius: 3 }} />;
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
      title={`${meta.label}（${meta.w}×${meta.h}${meta.isContainer ? '，容器' : ''}）`}
      style={{
        border: '1px solid #ece7dd', borderRadius: 10, padding: '10px 6px 7px',
        background: isDragging ? '#fff7ed' : '#ffffff', cursor: 'grab',
        userSelect: 'none', touchAction: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        minHeight: 52, justifyContent: 'center',
      }}
    >
      <div style={{ width: 36, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <Thumb type={type} />
      </div>
      <span style={{ fontSize: 11, color: '#374151', lineHeight: 1 }}>{meta.label}</span>
    </div>
  );
}

const PALETTE = REGISTRY.filter(m => m.palette !== false);

export function LeftPanel({ previewing }: { previewing?: boolean }) {
  const pages = useStore(s => s.project.pages);
  const currentPageId = useStore(s => s.editor.currentPageId);
  const device = useStore(s => s.editor.currentDevice);
  const [kw, setKw] = useState('');
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  const { setPage, addPage, renamePage, deletePage } = useStore(s => s.actions);
  const devW = DEVICES[device].w;

  if (previewing) return null;   // hooks 之后才允许条件 return（rules-of-hooks）

  const filtered = PALETTE.filter(m => !kw || m.label.includes(kw) || m.type.includes(kw));
  const categories = [...new Set(filtered.map(m => m.category))];
  const toggleCat = (c: string) => setOpenCats(prev => {
    const n = new Set(prev);
    if (n.has(c)) n.delete(c); else n.add(c);
    return n;
  });

  return (
    <aside style={panel}>
      {/* 页面（C：名称 + 设备宽度标注） */}
      <div style={{ ...head, display: 'flex', alignItems: 'center' }}>
        页面
        <span title="新建页面" onClick={() => addPage()}
          style={{ marginLeft: 'auto', cursor: 'pointer', color: '#f97316', fontWeight: 700, padding: '0 4px' }}>＋</span>
      </div>
      <div>
        {pages.map(pg => (
          <div key={pg.id}
            onClick={() => setPage(pg.id)}
            onDoubleClick={() => { const name = window.prompt('重命名页面', pg.name); if (name) renamePage(pg.id, name); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', fontSize: 12, cursor: 'pointer',
              background: pg.id === currentPageId ? '#fff1e6' : 'transparent',
              color: pg.id === currentPageId ? '#c2410c' : '#374151',
              borderLeft: pg.id === currentPageId ? '2px solid #f97316' : '2px solid transparent',
            }}>
            <span style={{ fontSize: 10, color: pg.id === currentPageId ? '#f97316' : '#c9c2b6' }}>□</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pg.name}</span>
            <span style={{ fontSize: 10, color: '#b9b2a6' }}>{devW}</span>
            {pages.length > 1 && (
              <span title="删除" onClick={e => { e.stopPropagation(); if (window.confirm(`删除「${pg.name}」？`)) deletePage(pg.id); }}
                style={{ color: '#d8d2c8', fontSize: 11 }}>✕</span>
            )}
          </div>
        ))}
        <div style={{ padding: '1px 10px 4px', fontSize: 9, color: '#c9c2b6' }}>双击重命名</div>
      </div>

      {/* 组件分组（C：分类 + 计数 + 折叠） */}
      <div style={{ ...head, marginTop: 2 }}>组件分组</div>
      <div style={{ borderBottom: '1px solid #f0ebe2', paddingBottom: 4 }}>
        {categories.map(cat => {
          const n = filtered.filter(m => m.category === cat).length;
          const open = openCats.has(cat);
          return (
            <div key={cat}
              onClick={() => toggleCat(cat)}
              style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#374151' }}>
              <span style={{ fontSize: 9, color: '#b9b2a6', width: 10 }}>{open ? '▾' : '▸'}</span>
              <span style={{ flex: 1 }}>{cat}</span>
              <span style={{ fontSize: 10, color: '#b9b2a6' }}>{n}</span>
            </div>
          );
        })}
      </div>

      {/* 模块库（C：搜索 + 两列网格缩略） */}
      <div style={{ ...head, marginTop: 2, display: 'flex', alignItems: 'center' }}>
        模块库
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#b9b2a6', letterSpacing: 0 }}>{PALETTE.length} 个</span>
      </div>
      <div style={{ padding: '0 10px 6px' }}>
        <input placeholder="搜索模块，如「头像」" value={kw} onChange={e => setKw(e.target.value)}
          style={{ width: '100%', border: '1px solid #ece7dd', borderRadius: 8, padding: '6px 10px', fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fbf9f5' }} />
      </div>
      <div style={{ padding: '0 10px 10px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {(openCats.size ? categories.filter(c => openCats.has(c)) : categories).map(cat => (
          <div key={cat} style={{ marginBottom: 8 }}>
            {openCats.size > 0 && <div style={{ fontSize: 10, color: '#b9b2a6', margin: '4px 2px' }}>{cat}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {filtered.filter(m => m.category === cat).map(m => <ModuleTile key={m.type} type={m.type} />)}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ fontSize: 11, color: '#c9c2b6', padding: 8 }}>无匹配模块</div>}
      </div>

      <div style={{ padding: '8px 12px', fontSize: 10, color: '#b9b2a6', borderTop: '1px solid #f0ebe2' }}>
        拖动模块到画布即可创建 · 当前 {PALETTE.length} 个模块
      </div>
    </aside>
  );
}

const panel: React.CSSProperties = {
  width: 232, flexShrink: 0, background: '#ffffff',
  borderRight: '1px solid #ece7dd', display: 'flex', flexDirection: 'column', minHeight: 0,
};
const head: React.CSSProperties = {
  padding: '10px 10px 5px', fontSize: 12, letterSpacing: 1,
  color: '#6b7280', userSelect: 'none', flexShrink: 0,
};
