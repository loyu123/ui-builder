// 左栏 · 页面管理（WS-04） + 模块库（CV-02 拖拽源）
import type * as React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useStore, NODE_DEFAULTS } from '../store';

function ModuleItem({ type }: { type: string }) {
  const meta = NODE_DEFAULTS[type];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib-${type}`,
    data: { fromLibrary: true, type },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px',
        background: isDragging ? '#fff7ed' : '#ffffff', cursor: 'grab',
        fontSize: 13, color: '#1f2328', userSelect: 'none',
        touchAction: 'none',
      }}
    >
      {meta.label}
      <span style={{ float: 'right', color: '#9ca3af', fontSize: 11 }}>
        {meta.w}×{meta.h}
      </span>
    </div>
  );
}

const ORDER = ['button-primary', 'heading', 'paragraph', 'input', 'card'];

export function LeftPanel() {
  const pages = useStore(s => s.project.pages);
  const currentPageId = useStore(s => s.editor.currentPageId);
  const { setPage, addPage, renamePage, deletePage } = useStore(s => s.actions);

  return (
    <aside style={panel}>
      {/* WS-04 · 页面列表 */}
      <div style={{ ...head, display: 'flex', alignItems: 'center' }}>
        页面
        <span
          title="新建页面"
          onClick={() => addPage()}
          style={{ marginLeft: 'auto', cursor: 'pointer', color: '#f97316', fontWeight: 700, padding: '0 4px' }}
        >＋</span>
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
              padding: '6px 12px', fontSize: 13, cursor: 'pointer',
              background: pg.id === currentPageId ? '#fff7ed' : 'transparent',
              color: pg.id === currentPageId ? '#c2410c' : '#374151',
              borderLeft: pg.id === currentPageId ? '2px solid #f97316' : '2px solid transparent',
            }}
          >
            <span style={{ fontSize: 11 }}>📄</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pg.name}
            </span>
            {pages.length > 1 && (
              <span
                title="删除页面"
                onClick={e => { e.stopPropagation(); if (window.confirm(`删除「${pg.name}」？`)) deletePage(pg.id); }}
                style={{ color: '#d1d5db', fontSize: 11, padding: '0 2px' }}
              >✕</span>
            )}
          </div>
        ))}
        <div style={{ padding: '2px 12px', fontSize: 10, color: '#c0c4cc' }}>双击重命名</div>
      </div>

      {/* 模块库 */}
      <div style={{ ...head, marginTop: 4 }}>模块库</div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
        {ORDER.map(t => <ModuleItem key={t} type={t} />)}
      </div>
      <div style={{ padding: 12, fontSize: 11, color: '#9ca3af', borderTop: '1px solid #e5e7eb' }}>
        拖到中间画布即可创建
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
  color: '#6b7280', userSelect: 'none',
};
