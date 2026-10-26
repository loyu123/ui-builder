// 左栏 · 页面管理（WS-04） + 模块库（注册表驱动：分类/搜索/设备过滤，LB-01）
import { useState } from 'react';
import type * as React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useStore } from '../store';
import { REGISTRY, REGISTRY_MAP } from '../modules/registry';

function ModuleItem({ type }: { type: string }) {
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
      style={{
        border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px',
        background: isDragging ? '#fff7ed' : '#ffffff', cursor: 'grab',
        fontSize: 12, color: '#1f2328', userSelect: 'none',
        touchAction: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}
    >
      <span>
        <b style={{ fontSize: 12 }}>{meta.label}</b>
        {meta.isContainer && <span style={{ fontSize: 9, color: '#f97316', marginLeft: 4 }}>容器</span>}
      </span>
      <span style={{ color: '#c0c4cc', fontSize: 10 }}>{meta.w}×{meta.h}</span>
    </div>
  );
}

const PALETTE = REGISTRY.filter(m => m.palette !== false);

export function LeftPanel() {
  const pages = useStore(s => s.project.pages);
  const currentPageId = useStore(s => s.editor.currentPageId);
  const [kw, setKw] = useState('');
  const { setPage, addPage, renamePage, deletePage } = useStore(s => s.actions);

  const filtered = PALETTE.filter(m => !kw || m.label.includes(kw) || m.type.includes(kw));
  const categories = [...new Set(filtered.map(m => m.category))];

  return (
    <aside style={panel}>
      {/* WS-04 · 页面列表 */}
      <div style={{ ...head, display: 'flex', alignItems: 'center' }}>
        页面
        <span title="新建页面" onClick={() => addPage()}
          style={{ marginLeft: 'auto', cursor: 'pointer', color: '#f97316', fontWeight: 700, padding: '0 4px' }}>＋</span>
      </div>
      <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}>
        {pages.map(pg => (
          <div
            key={pg.id}
            onClick={() => setPage(pg.id)}
            onDoubleClick={() => {
              const name = window.prompt('重命名页面', pg.name);
              if (name) renamePage(pg.id, name);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', fontSize: 12, cursor: 'pointer',
              background: pg.id === currentPageId ? '#fff7ed' : 'transparent',
              color: pg.id === currentPageId ? '#c2410c' : '#374151',
              borderLeft: pg.id === currentPageId ? '2px solid #f97316' : '2px solid transparent',
            }}
          >
            <span style={{ fontSize: 10 }}>📄</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pg.name}</span>
            {pages.length > 1 && (
              <span title="删除页面"
                onClick={e => { e.stopPropagation(); if (window.confirm(`删除「${pg.name}」？`)) deletePage(pg.id); }}
                style={{ color: '#d1d5db', fontSize: 11, padding: '0 2px' }}>✕</span>
            )}
          </div>
        ))}
      </div>

      {/* 模块库（LB-01 驱动） */}
      <div style={{ ...head, marginTop: 4 }}>模块库（{PALETTE.length}）</div>
      <div style={{ padding: '0 10px 6px' }}>
        <input
          placeholder="搜索模块…"
          value={kw}
          onChange={e => setKw(e.target.value)}
          style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ padding: '0 10px 10px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {categories.map(cat => (
          <div key={cat}>
            <div style={{ fontSize: 10, color: '#9ca3af', margin: '8px 2px 4px' }}>{cat}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filtered.filter(m => m.category === cat).map(m => <ModuleItem key={m.type} type={m.type} />)}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ fontSize: 11, color: '#c0c4cc', padding: 8 }}>无匹配模块</div>}
      </div>
    </aside>
  );
}

const panel: React.CSSProperties = {
  width: 240, flexShrink: 0, background: '#ffffff',
  borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column',
  minHeight: 0,
};
const head: React.CSSProperties = {
  padding: '10px 12px 6px', fontSize: 12, letterSpacing: 2,
  color: '#6b7280', userSelect: 'none', flexShrink: 0,
};
