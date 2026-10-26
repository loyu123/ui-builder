// 左栏 · 模块库（CV-02 拖拽源）
import type * as React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { NODE_DEFAULTS } from '../store';

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
  return (
    <aside style={panel}>
      <div style={head}>模块库</div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ORDER.map(t => <ModuleItem key={t} type={t} />)}
      </div>
      <div style={{ marginTop: 'auto', padding: 12, fontSize: 11, color: '#9ca3af', borderTop: '1px solid #e5e7eb' }}>
        拖到中间画布即可创建
      </div>
    </aside>
  );
}

const panel: React.CSSProperties = {
  width: 240, flexShrink: 0, background: '#ffffff',
  borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column',
};
const head: React.CSSProperties = {
  padding: '10px 12px', fontSize: 12, letterSpacing: 2,
  color: '#6b7280', borderBottom: '1px solid #e5e7eb',
};
