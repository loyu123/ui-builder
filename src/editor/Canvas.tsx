// 中间画布 · DV-01 设备画板 + CV-01 节点渲染 + CV-02 落点创建 + 画布内拖动
import type * as React from 'react';
import { useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { DEVICES, useStore } from '../store';
import { screenToBoard } from '../lib/coords';
import { ModuleRenderer } from '../modules/renderers';
import type { DeviceId, Node } from '../types';

export function Canvas() {
  const device = useStore(s => s.editor.currentDevice);
  const page = useStore(s => {
    const pid = s.editor.currentPageId;
    return s.project.pages.find(pg => pg.id === pid) ?? s.project.pages[0];
  });
  const board = page.boards[device];
  const dev = DEVICES[device];

  const boardRef = useRef<HTMLDivElement>(null);
  const { setNodeRef, isOver } = useDroppable({ id: 'board' });

  // 画布内拖动（原生 pointer events；CV-04 完整版 W2 做）
  const [dragId, setDragId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const startRef = useRef<{ cx: number; cy: number; fx: number; fy: number } | null>(null);

  function onNodePointerDown(e: React.PointerEvent, node: Node) {
    if (!boardRef.current || node.parentId === null) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const zoom = useStore.getState().editor.zoom;
    const p = screenToBoard(e.clientX, e.clientY, boardRef.current, zoom);
    startRef.current = { cx: p.x, cy: p.y, fx: node.frame.x, fy: node.frame.y };
    setDragId(node.id);
    useStore.getState().actions.select([node.id]);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragId || !startRef.current || !boardRef.current) return;
    const zoom = useStore.getState().editor.zoom;
    const p = screenToBoard(e.clientX, e.clientY, boardRef.current, zoom);
    setGhost({
      x: startRef.current.fx + (p.x - startRef.current.cx),
      y: startRef.current.fy + (p.y - startRef.current.cy),
    });
  }
  function onPointerUp() {
    if (dragId && ghost) useStore.getState().actions.moveNode(dragId, ghost.x, ghost.y);
    setDragId(null);
    setGhost(null);
    startRef.current = null;
  }

  const root = board.nodes[board.rootId];
  const children = root.children.map(id => board.nodes[id]).filter(Boolean);

  return (
    <main style={wrap} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      {/* 设备页签（DV-01） */}
      <div style={tabs}>
        {(Object.keys(DEVICES) as DeviceId[]).map(d => (
          <button
            key={d}
            onClick={() => useStore.getState().actions.setDevice(d)}
            style={{
              ...tab, ...(d === device ? tabActive : {}),
            }}
          >
            {DEVICES[d].label}
            <span style={{ fontSize: 10, color: d === device ? '#fff' : '#9ca3af', marginLeft: 6 }}>
              {DEVICES[d].w}×{DEVICES[d].h}
            </span>
          </button>
        ))}
      </div>

      {/* 画板区域（灰色台面 + 居中画板） */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', padding: 24, background: '#f0f1f3' }}>
        <div
          data-board
          ref={el => { setNodeRef(el); boardRef.current = el; }}
          onPointerDown={() => useStore.getState().actions.select([])}
          style={{
            position: 'relative',
            width: dev.w, height: dev.h,
            flexShrink: 0,
            margin: '0 auto',
            background: '#ffffff',
            border: isOver ? '2px solid #f97316' : '1px solid #d1d5db',
            borderRadius: device === 'desktop' ? 8 : 24,
            boxShadow: '0 4px 24px rgba(0,0,0,.08)',
            overflow: 'hidden',
          }}
        >
          {children.map(n => {
            const pos = dragId === n.id && ghost ? ghost : n.frame;
            const selected = useStore.getState().editor.selection.includes(n.id);
            return (
              <div
                key={n.id}
                onPointerDown={e => onNodePointerDown(e, n)}
                style={{
                  position: 'absolute',
                  left: pos.x, top: pos.y, width: n.frame.w, height: n.frame.h,
                  outline: selected ? '2px solid #f97316' : 'none',
                  outlineOffset: 1,
                  opacity: dragId === n.id ? 0.85 : 1,
                  cursor: dragId === n.id ? 'grabbing' : 'grab',
                }}
              >
                <ModuleRenderer node={n} />
              </div>
            );
          })}
          {children.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: '#c0c4cc', fontSize: 13,
              border: '2px dashed #e5e7eb', margin: 24, borderRadius: 12,
            }}>
              从左侧拖入模块
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

const wrap: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 };
const tabs: React.CSSProperties = {
  display: 'flex', gap: 8, padding: '10px 16px',
  background: '#ffffff', borderBottom: '1px solid #e5e7eb',
};
const tab: React.CSSProperties = {
  border: '1px solid #e5e7eb', background: '#ffffff', borderRadius: 8,
  padding: '6px 14px', fontSize: 13, color: '#374151', cursor: 'pointer',
};
const tabActive: React.CSSProperties = {
  background: '#f97316', borderColor: '#f97316', color: '#ffffff',
};
