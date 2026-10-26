// 中间画布 · DV-01 设备画板 + CV-01 节点树渲染（嵌套）+ CV-04 吸附参考线
// + CV-05 八向缩放 + CV-06 容器进出 + DV-03 缩放
import type * as React from 'react';
import { useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { DEVICES, useStore } from '../store';
import { screenToBoard, snapThreshold } from '../lib/coords';
import { absOrigin, findContainerAt, subtreeIds } from '../lib/tree';
import { ModuleRenderer } from '../modules/renderers';
import type { DeviceId, Frame, Node } from '../types';

type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const MIN = 16;
const CONTAINER_HIGHLIGHT = '#f97316';

interface Gesture {
  mode: 'move' | 'resize';
  handle?: Handle;
  nodeId: string;
  startFrame: Frame;
  startPt: { x: number; y: number };
}

export function Canvas() {
  const device = useStore(s => s.editor.currentDevice);
  const zoom = useStore(s => s.editor.zoom);
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
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [dropTarget, setDropTarget] = useState<string | null>(null); // CV-06 拖动悬停的容器

  function boardPoint(e: React.PointerEvent) {
    return screenToBoard(e.clientX, e.clientY, boardRef.current!.getBoundingClientRect(), useStore.getState().editor.zoom);
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

  // CV-04 · 吸附：把移动中的节点边缘对齐到兄弟节点/画板边缘
  function applySnap(frame: Frame, parentId: string): Frame {
    const st = useStore.getState();
    const th = snapThreshold(st.editor.zoom);
    const exclude = subtreeIds(board, gesture.current!.nodeId);
    const pOrigin = absOrigin(board, parentId);
    const myAbs = { x: pOrigin.x + frame.x, y: pOrigin.y + frame.y, w: frame.w, h: frame.h };

    const vx: number[] = [0, dev.w];                 // 画板边缘
    const hy: number[] = [0, dev.h];
    for (const n of Object.values(board.nodes)) {
      if (exclude.has(n.id) || !n.parentId) continue;
      const o = absOrigin(board, n.id);
      vx.push(o.x, o.x + n.frame.w, o.x + n.frame.w / 2);
      hy.push(o.y, o.y + n.frame.h, o.y + n.frame.h / 2);
    }

    const gv: number[] = [];
    const gh: number[] = [];
    let out = { ...frame };

    const tryAxis = (
      myEdges: number[], cands: number[],
      setFn: (adj: number) => void, pushGuide: (v: number) => void,
    ) => {
      let best: { d: number; cand: number } | null = null;
      for (const me of myEdges) {
        for (const c of cands) {
          const d = c - me;
          if (Math.abs(d) <= th && (!best || Math.abs(d) < Math.abs(best.d))) {
            best = { d, cand: c };
          }
        }
      }
      if (best) { setFn(best.d); pushGuide(best.cand); }
    };

    tryAxis(
      [myAbs.x, myAbs.x + myAbs.w / 2, myAbs.x + myAbs.w], vx,
      adj => { out.x += adj; },
      v => gv.push(v),
    );
    tryAxis(
      [myAbs.y, myAbs.y + myAbs.h / 2, myAbs.y + myAbs.h], hy,
      adj => { out.y += adj; },
      v => gh.push(v),
    );
    setGuides({ v: gv, h: gh });
    return out;
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
      // CV-06 · 移动悬停时高亮将落入的容器
      const exclude = subtreeIds(board, g.nodeId);
      const target = findContainerAt(board, p, exclude);
      setDropTarget(target);
      const snapped = applySnap(f, g.nodeId ? (board.nodes[g.nodeId]?.parentId as string) : board.rootId);
      setPreview({ id: g.nodeId, frame: snapped });
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
      setGuides({ v: [], h: [] });
      setPreview({ id: g.nodeId, frame: f });
    }
  }

  function onPointerUp() {
    const g = gesture.current;
    const a = useStore.getState().actions;
    if (g && preview) {
      if (g.mode === 'move') {
        // CV-06 · 松手时判定是否进出容器
        const exclude = subtreeIds(board, g.nodeId);
        const p = { x: preview.frame.x, y: preview.frame.y };
        const pOrigin = absOrigin(board, board.nodes[g.nodeId].parentId as string);
        const absPt = { x: pOrigin.x + p.x + preview.frame.w / 2, y: pOrigin.y + p.y + preview.frame.h / 2 };
        const target = findContainerAt(board, absPt, exclude);
        const curParent = board.nodes[g.nodeId].parentId as string;
        if (target && target !== curParent) {
          // 进容器：绝对坐标换算为新父坐标
          const tOrigin = absOrigin(board, target);
          a.moveNode(g.nodeId, pOrigin.x + preview.frame.x - tOrigin.x, pOrigin.y + preview.frame.y - tOrigin.y, target);
        } else if (!target && curParent !== board.rootId) {
          // 出容器：回到画板根层
          a.moveNode(g.nodeId, pOrigin.x + preview.frame.x, pOrigin.y + preview.frame.y, board.rootId);
        } else {
          a.moveNode(g.nodeId, preview.frame.x, preview.frame.y);
        }
      } else {
        a.resizeNode(g.nodeId, preview.frame);
      }
    }
    gesture.current = null;
    setPreview(null);
    setGuides({ v: [], h: [] });
    setDropTarget(null);
  }

  // —— 渲染 ——（嵌套递归；子节点坐标相对父容器左上角）
  function renderNode(n: Node): React.ReactNode {
    const frame = preview?.id === n.id ? preview.frame : n.frame;
    const selected = selection.includes(n.id) || preview?.id === n.id;
    const isDropTarget = dropTarget === n.id && gesture.current?.mode === 'move';
    return (
      <div
        key={n.id}
        onPointerDown={e => beginGesture(e, 'move', n)}
        style={{
          position: 'absolute',
          left: frame.x, top: frame.y, width: frame.w, height: frame.h,
          outline: selected ? `2px solid ${CONTAINER_HIGHLIGHT}` : 'none',
          outlineOffset: 1,
          opacity: preview?.id === n.id ? 0.9 : 1,
          cursor: 'grab',
        }}
      >
        <ModuleRenderer node={n} />
        {/* 容器：子节点叠加渲染（CV-06） */}
        {n.children.map(cid => board.nodes[cid] && renderNode(board.nodes[cid]))}
        {isDropTarget && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            outline: `2px dashed ${CONTAINER_HIGHLIGHT}`, outlineOffset: -2,
            background: 'rgba(249,115,22,.06)', zIndex: 5,
          }} />
        )}
        {/* 选中态：八向缩放手柄（CV-05） */}
        {selected && (['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as Handle[]).map(h => (
          <div
            key={h}
            onPointerDown={e => beginGesture(e, 'resize', n, h)}
            style={{
              position: 'absolute', width: 10, height: 10,
              background: '#ffffff', border: `2px solid ${CONTAINER_HIGHLIGHT}`,
              borderRadius: 2, zIndex: 10,
              cursor: HANDLE_CURSOR[h], touchAction: 'none',
              ...HANDLE_POS[h],
            }}
          />
        ))}
      </div>
    );
  }

  const root = board.nodes[board.rootId];
  const rootChildren = root.children.map(id => board.nodes[id]).filter(Boolean);

  return (
    <main style={wrap} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
      {/* 设备页签（DV-01）+ 缩放（DV-03） */}
      <div style={tabs}>
        {(Object.keys(DEVICES) as DeviceId[]).map(d => (
          <button key={d} onClick={() => useStore.getState().actions.setDevice(d)}
            style={{ ...tab, ...(d === device ? tabActive : {}) }}>
            {DEVICES[d].label}
            <span style={{ fontSize: 10, color: d === device ? '#fff' : '#9ca3af', marginLeft: 6 }}>
              {DEVICES[d].w}×{DEVICES[d].h}
            </span>
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#9ca3af', alignSelf: 'center' }}>
          {[0.5, 1, 1.5].map(z => (
            <button key={z} onClick={() => useStore.getState().actions.setZoom(z)}
              style={{ ...zoomBtn, ...(zoom === z ? zoomBtnActive : {}) }}>
              {z * 100}%
            </button>
          ))}
          <b style={{ marginLeft: 6, color: '#374151' }}>{Math.round(zoom * 100)}%</b>
        </span>
      </div>

      {/* 画板台面 */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', padding: 24, background: '#f0f1f3' }}>
        {/* 缩放占位盒（transform 不影响布局，用外层盒撑开滚动区域） */}
        <div style={{ width: dev.w * zoom, height: dev.h * zoom, flexShrink: 0, margin: '0 auto', position: 'relative' }}>
          <div
            data-board
            ref={el => { setNodeRef(el); boardRef.current = el; }}
            onPointerDown={() => useStore.getState().actions.select([])}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: dev.w, height: dev.h,
              transform: `scale(${zoom})`, transformOrigin: 'top left',
              background: '#ffffff',
              border: isOver ? '2px solid #f97316' : '1px solid #d1d5db',
              borderRadius: device === 'desktop' ? 8 : 24,
              boxShadow: '0 4px 24px rgba(0,0,0,.08)',
              overflow: 'hidden',
            }}
          >
            {rootChildren.map(n => renderNode(n))}

            {/* 吸附参考线（CV-04，画板绝对坐标） */}
            {guides.v.map((x, i) => (
              <div key={`v${i}`} style={{ position: 'absolute', left: x, top: 0, width: 1, height: '100%', background: '#f43f5e', zIndex: 99, pointerEvents: 'none' }} />
            ))}
            {guides.h.map((y, i) => (
              <div key={`h${i}`} style={{ position: 'absolute', top: y, left: 0, height: 1, width: '100%', background: '#f43f5e', zIndex: 99, pointerEvents: 'none' }} />
            ))}

            {root.children.length === 0 && !gesture.current && (
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
      </div>
    </main>
  );
}

const HANDLE_CURSOR: Record<Handle, string> = {
  n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize',
};
const HANDLE_POS: Record<Handle, React.CSSProperties> = {
  n:  { top: -5, left: '50%', marginLeft: -5 },
  s:  { bottom: -5, left: '50%', marginLeft: -5 },
  e:  { right: -5, top: '50%', marginTop: -5 },
  w:  { left: -5, top: '50%', marginTop: -5 },
  ne: { top: -5, right: -5 },
  nw: { top: -5, left: -5 },
  se: { bottom: -5, right: -5 },
  sw: { bottom: -5, left: -5 },
};

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
const zoomBtn: React.CSSProperties = {
  border: '1px solid #e5e7eb', background: '#ffffff', borderRadius: 6,
  padding: '3px 8px', fontSize: 11, color: '#374151', cursor: 'pointer', marginLeft: 4,
};
const zoomBtnActive: React.CSSProperties = {
  background: '#f97316', borderColor: '#f97316', color: '#ffffff',
};
