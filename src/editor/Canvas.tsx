// 中间画布 · DV-01 设备画板 + CV-01 节点渲染 + CV-02 落点创建
// + CV-04 简版拖动 + CV-05 八向缩放（W2 再加吸附/嵌套/zoom 单测）
import type * as React from 'react';
import { useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { DEVICES, useStore } from '../store';
import { screenToBoard } from '../lib/coords';
import { ModuleRenderer } from '../modules/renderers';
import type { DeviceId, Frame, Node } from '../types';

type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const MIN = 16; // 最小尺寸（CV-05 验收标准）

interface Gesture {
  mode: 'move' | 'resize';
  handle?: Handle;
  nodeId: string;
  startFrame: Frame;
  startPt: { x: number; y: number };
}

export function Canvas() {
  const device = useStore(s => s.editor.currentDevice);
  const selection = useStore(s => s.editor.selection);
  const page = useStore(s => {
    const pid = s.editor.currentPageId;
    return s.project.pages.find(pg => pg.id === pid) ?? s.project.pages[0];
  });
  const board = page.boards[device];
  const dev = DEVICES[device];

  const boardRef = useRef<HTMLDivElement>(null);
  const { setNodeRef, isOver } = useDroppable({ id: 'board' });

  const gesture = useRef<Gesture | null>(null);
  const [preview, setPreview] = useState<{ id: string; frame: Frame } | null>(null);

  function boardPoint(e: React.PointerEvent) {
    return screenToBoard(e.clientX, e.clientY, boardRef.current!, useStore.getState().editor.zoom);
  }

  function beginGesture(e: React.PointerEvent, mode: Gesture['mode'], node: Node, handle?: Handle) {
    if (!boardRef.current) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gesture.current = {
      mode, handle, nodeId: node.id,
      startFrame: { ...node.frame },
      startPt: boardPoint(e),
    };
    useStore.getState().actions.select([node.id]);
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g || !boardRef.current) return;
    const p = boardPoint(e);
    const dx = p.x - g.startPt.x;
    const dy = p.y - g.startPt.y;
    const f = { ...g.startFrame };

    if (g.mode === 'move') {
      f.x = g.startFrame.x + dx;
      f.y = g.startFrame.y + dy;
    } else {
      const h = g.handle!;
      if (h.includes('e')) f.w = Math.max(MIN, g.startFrame.w + dx);
      if (h.includes('s')) f.h = Math.max(MIN, g.startFrame.h + dy);
      if (h.includes('w')) {
        const w = Math.max(MIN, g.startFrame.w - dx);
        f.x = g.startFrame.x + (g.startFrame.w - w);
        f.w = w;
      }
      if (h.includes('n')) {
        const hgt = Math.max(MIN, g.startFrame.h - dy);
        f.y = g.startFrame.y + (g.startFrame.h - hgt);
        f.h = hgt;
      }
    }
    setPreview({ id: g.nodeId, frame: f });
  }

  function onPointerUp() {
    const g = gesture.current;
    const a = useStore.getState().actions;
    if (g && preview) {
      if (g.mode === 'move') a.moveNode(g.nodeId, preview.frame.x, preview.frame.y);
      else a.resizeNode(g.nodeId, preview.frame);
    }
    gesture.current = null;
    setPreview(null);
  }

  const root = board.nodes[board.rootId];
  const children = root.children.map(id => board.nodes[id]).filter(Boolean);

  const cursorOf: Record<Handle, string> = {
    n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
    ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize',
  };
  const handlePos: Record<Handle, React.CSSProperties> = {
    n:  { top: -5, left: '50%', marginLeft: -5 },
    s:  { bottom: -5, left: '50%', marginLeft: -5 },
    e:  { right: -5, top: '50%', marginTop: -5 },
    w:  { left: -5, top: '50%', marginTop: -5 },
    ne: { top: -5, right: -5 },
    nw: { top: -5, left: -5 },
    se: { bottom: -5, right: -5 },
    sw: { bottom: -5, left: -5 },
  };

  return (
    <main style={wrap} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
      {/* 设备页签（DV-01） */}
      <div style={tabs}>
        {(Object.keys(DEVICES) as DeviceId[]).map(d => (
          <button
            key={d}
            onClick={() => useStore.getState().actions.setDevice(d)}
            style={{ ...tab, ...(d === device ? tabActive : {}) }}
          >
            {DEVICES[d].label}
            <span style={{ fontSize: 10, color: d === device ? '#fff' : '#9ca3af', marginLeft: 6 }}>
              {DEVICES[d].w}×{DEVICES[d].h}
            </span>
          </button>
        ))}
      </div>

      {/* 画板区域 */}
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
            const frame = preview?.id === n.id ? preview.frame : n.frame;
            const selected = selection.includes(n.id) || preview?.id === n.id;
            return (
              <div
                key={n.id}
                onPointerDown={e => beginGesture(e, 'move', n)}
                style={{
                  position: 'absolute',
                  left: frame.x, top: frame.y, width: frame.w, height: frame.h,
                  outline: selected ? '2px solid #f97316' : 'none',
                  outlineOffset: 1,
                  opacity: preview?.id === n.id ? 0.9 : 1,
                  cursor: 'grab',
                }}
              >
                <ModuleRenderer node={n} />
                {/* 选中态：八向缩放手柄（CV-05） */}
                {selected && (Object.keys(handlePos) as Handle[]).map(h => (
                  <div
                    key={h}
                    onPointerDown={e => beginGesture(e, 'resize', n, h)}
                    style={{
                      position: 'absolute', width: 10, height: 10,
                      background: '#ffffff', border: '2px solid #f97316',
                      borderRadius: 2, zIndex: 10,
                      cursor: cursorOf[h], touchAction: 'none',
                      ...handlePos[h],
                    }}
                  />
                ))}
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
