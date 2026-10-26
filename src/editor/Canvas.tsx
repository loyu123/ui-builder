// 中间画布 · DV-01 设备画板 + CV-01 嵌套渲染 + CV-04 吸附 + CV-05 缩放手柄
// + CV-06 容器进出 + CV-03 框选/多选移动 + DV-03 缩放平移
import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { DEVICES, useStore } from '../store';
import { screenToBoard, snapThreshold } from '../lib/coords';
import { absOrigin, findContainerAt, subtreeIds } from '../lib/tree';
import { ModuleRenderer } from '../modules/renderers';
import type { DeviceId, Frame, Node } from '../types';

type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const MIN = 16;
const ACCENT = '#f97316';

interface Gesture {
  mode: 'move' | 'resize' | 'marquee';
  handle?: Handle;
  nodeId?: string;
  multiIds?: string[];                       // 多选整体移动
  startFrames?: Record<string, Frame>;
  startFrame: Frame;
  startPt: { x: number; y: number };
}

export function Canvas() {
  const device = useStore(s => s.editor.currentDevice);
  const zoom = useStore(s => s.editor.zoom);
  const pan = useStore(s => s.editor.pan);
  const selection = useStore(s => s.editor.selection);
  const page = useStore(s => {
    const pid = s.editor.currentPageId;
    return s.project.pages.find(pg => pg.id === pid) ?? s.project.pages[0];
  });
  const board = page.boards[device];
  const dev = DEVICES[device];

  const boardRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { setNodeRef, isOver } = useDroppable({ id: 'board' });

  const gesture = useRef<Gesture | null>(null);
  const [preview, setPreview] = useState<{ id: string; frame: Frame } | null>(null);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<Frame | null>(null);

  // DV-03 · 切设备时把画板居中
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    useStore.getState().actions.setPan({
      x: Math.max(24, (el.clientWidth - dev.w * zoom) / 2),
      y: Math.max(24, (el.clientHeight - dev.h * zoom) / 2),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device, zoom]);

  // DV-03 · Ctrl+滚轮缩放（锚点在鼠标处）
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const st = useStore.getState();
      const oldZoom = st.editor.zoom;
      const newZoom = Math.min(2, Math.max(0.25, oldZoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
      // 画板左上角在视口中的位置
      const tlx = el.getBoundingClientRect().left - el.scrollLeft + st.editor.pan.x;
      const tly = el.getBoundingClientRect().top - el.scrollTop + st.editor.pan.y;
      // 鼠标下的画板坐标
      const bx = (e.clientX - tlx) / oldZoom;
      const by = (e.clientY - tly) / oldZoom;
      // 缩放后让同一画板点仍处于鼠标下
      st.actions.setPan({
        x: e.clientX - tlx + st.editor.pan.x - bx * newZoom,
        y: e.clientY - tly + st.editor.pan.y - by * newZoom,
      });
      st.actions.setZoom(newZoom);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  function boardPoint(e: React.PointerEvent) {
    return screenToBoard(
      e.clientX, e.clientY,
      boardRef.current!.getBoundingClientRect(),
      useStore.getState().editor.zoom,
    );
  }

  function beginGesture(e: React.PointerEvent, mode: Gesture['mode'], node?: Node, handle?: Handle) {
    if (!boardRef.current) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const st = useStore.getState();

    if (mode === 'marquee') {
      gesture.current = {
        mode, startFrame: { x: 0, y: 0, w: 0, h: 0 },
        startPt: boardPoint(e),
      };
      setMarquee({ x: gesture.current.startPt.x, y: gesture.current.startPt.y, w: 0, h: 0 });
      if (!e.shiftKey) st.actions.select([]);
      return;
    }
    if (!node) return;

    // PP-03 · 锁定节点：仅选中查看，不可拖动/缩放
    if (node.locked) {
      st.actions.select([node.id]);
      return;
    }

    // Shift 点击 → 加入/移出多选
    if (e.shiftKey) {
      const sel = st.editor.selection.includes(node.id)
        ? st.editor.selection.filter(id => id !== node.id)
        : [...st.editor.selection, node.id];
      st.actions.select(sel);
      return;
    }

    // 已在多选内 → 整组移动（仅同父节点的兄弟）
    let multiIds: string[] | undefined;
    let startFrames: Record<string, Frame> | undefined;
    if (st.editor.selection.includes(node.id) && st.editor.selection.length > 1) {
      const parent = node.parentId;
      const group = st.editor.selection.filter(id => board.nodes[id]?.parentId === parent);
      if (group.length > 1) {
        multiIds = group;
        startFrames = Object.fromEntries(group.map(id => [id, { ...board.nodes[id].frame }]));
      }
    }

    gesture.current = {
      mode, handle, nodeId: node.id, multiIds, startFrames,
      startFrame: { ...node.frame },
      startPt: boardPoint(e),
    };
    st.actions.select([node.id]);
  }

  // CV-04 · 吸附
  function applySnap(frame: Frame, movingId: string, parentId: string): Frame {
    const st = useStore.getState();
    const th = snapThreshold(st.editor.zoom);
    const exclude = subtreeIds(board, movingId);
    const pOrigin = absOrigin(board, parentId);
    const myAbs = { x: pOrigin.x + frame.x, y: pOrigin.y + frame.y, w: frame.w, h: frame.h };

    const vx: number[] = [0, dev.w];
    const hy: number[] = [0, dev.h];
    for (const n of Object.values(board.nodes)) {
      if (exclude.has(n.id) || !n.parentId) continue;
      const o = absOrigin(board, n.id);
      vx.push(o.x, o.x + n.frame.w, o.x + n.frame.w / 2);
      hy.push(o.y, o.y + n.frame.h, o.y + n.frame.h / 2);
    }

    const gv: number[] = [];
    const gh: number[] = [];
    const out = { ...frame };
    const tryAxis = (myEdges: number[], cands: number[], apply: (d: number) => void, guide: (v: number) => void) => {
      let best: { d: number; cand: number } | null = null;
      for (const me of myEdges) {
        for (const c of cands) {
          const d = c - me;
          if (Math.abs(d) <= th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, cand: c };
        }
      }
      if (best) { apply(best.d); guide(best.cand); }
    };
    tryAxis([myAbs.x, myAbs.x + myAbs.w / 2, myAbs.x + myAbs.w], vx, d => { out.x += d; }, v => gv.push(v));
    tryAxis([myAbs.y, myAbs.y + myAbs.h / 2, myAbs.y + myAbs.h], hy, d => { out.y += d; }, v => gh.push(v));
    setGuides({ v: gv, h: gh });
    return out;
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g || !boardRef.current) return;
    const p = boardPoint(e);
    const dx = p.x - g.startPt.x;
    const dy = p.y - g.startPt.y;

    if (g.mode === 'marquee') {
      setMarquee({
        x: Math.min(g.startPt.x, p.x), y: Math.min(g.startPt.y, p.y),
        w: Math.abs(dx), h: Math.abs(dy),
      });
      return;
    }

    const f = { ...g.startFrame };
    if (g.mode === 'move') {
      f.x = g.startFrame.x + dx;
      f.y = g.startFrame.y + dy;
      const parentId = board.nodes[g.nodeId!]?.parentId as string;
      const exclude = subtreeIds(board, g.nodeId!);
      setDropTarget(findContainerAt(board, p, exclude));
      const snapped = applySnap(f, g.nodeId!, parentId);
      setPreview({ id: g.nodeId!, frame: snapped });
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
      setPreview({ id: g.nodeId!, frame: f });
    }
  }

  function onPointerUp() {
    const g = gesture.current;
    const a = useStore.getState().actions;
    if (g?.mode === 'marquee' && marquee) {
      // 框选：命中根层子节点（abs = frame）
      const hits = board.nodes[board.rootId].children
        .map(id => board.nodes[id])
        .filter(n => {
          if (marquee.w < 3 && marquee.h < 3) return false;
          return n.frame.x < marquee.x + marquee.w && n.frame.x + n.frame.w > marquee.x
            && n.frame.y < marquee.y + marquee.h && n.frame.y + n.frame.h > marquee.y;
        })
        .map(n => n.id);
      a.select(hits);
    } else if (g && preview && g.mode === 'move' && g.nodeId) {
      const dxA = preview.frame.x - g.startFrame.x;
      const dyA = preview.frame.y - g.startFrame.y;
      // CV-06 · 进出容器判定（以拖动主节点为准）
      const exclude = subtreeIds(board, g.nodeId);
      const pOrigin = absOrigin(board, board.nodes[g.nodeId].parentId as string);
      const absCenter = {
        x: pOrigin.x + preview.frame.x + preview.frame.w / 2,
        y: pOrigin.y + preview.frame.y + preview.frame.h / 2,
      };
      const target = findContainerAt(board, absCenter, exclude);
      const curParent = board.nodes[g.nodeId].parentId as string;
      const finalParent = target ?? board.rootId;
      const tOrigin = absOrigin(board, finalParent);

      // 多选整体移动（同组应用同一吸附增量）
      const ids = g.multiIds ?? [g.nodeId];
      for (const id of ids) {
        const f0 = g.multiIds ? g.startFrames![id] : g.startFrame;
        const isMain = id === g.nodeId;
        const nx = isMain ? pOrigin.x + preview.frame.x - (finalParent !== curParent ? tOrigin.x : 0) : f0.x + dxA;
        const ny = isMain ? pOrigin.y + preview.frame.y - (finalParent !== curParent ? tOrigin.y : 0) : f0.y + dyA;
        a.moveNode(
          id, nx, ny,
          isMain && finalParent !== curParent ? finalParent : undefined,
        );
      }
    } else if (g && preview && g.mode === 'resize' && g.nodeId) {
      a.resizeNode(g.nodeId, preview.frame);
    }
    gesture.current = null;
    setPreview(null);
    setGuides({ v: [], h: [] });
    setDropTarget(null);
    setMarquee(null);
  }

  // —— 渲染 ——（嵌套递归；子节点坐标相对父容器左上角）
  function renderNode(n: Node): React.ReactNode {
    if (n.hidden) return null;   // PP-03 · 隐藏节点不渲染
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
          outline: selected ? `2px solid ${ACCENT}` : 'none',
          outlineOffset: 1,
          opacity: preview?.id === n.id ? 0.9 : 1,
          cursor: 'grab',
        }}
      >
        <ModuleRenderer node={n} />
        {n.children.map(cid => board.nodes[cid] && renderNode(board.nodes[cid]))}
        {isDropTarget && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            outline: '2px dashed #f97316', outlineOffset: -2,
            background: 'rgba(249,115,22,.06)', zIndex: 5,
          }} />
        )}
        {selected && (['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as Handle[]).map(h => (
          <div
            key={h}
            onPointerDown={e => beginGesture(e, 'resize', n, h)}
            style={{
              position: 'absolute', width: 10, height: 10,
              background: '#ffffff', border: `2px solid ${ACCENT}`,
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
  const worldW = pan.x + dev.w * zoom + 80;
  const worldH = pan.y + dev.h * zoom + 80;

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
        <span style={{ fontSize: 11, color: '#9ca3af', alignSelf: 'center', display: 'flex', alignItems: 'center' }}>
          <span style={{ marginRight: 6 }}>Ctrl+滚轮缩放</span>
          {[0.5, 1, 1.5].map(z => (
            <button key={z} onClick={() => useStore.getState().actions.setZoom(z)}
              style={{ ...zoomBtn, ...(zoom === z ? zoomBtnActive : {}) }}>
              {z * 100}%
            </button>
          ))}
          <b style={{ marginLeft: 6, color: '#374151' }}>{Math.round(zoom * 100)}%</b>
        </span>
      </div>

      {/* 画板台面（可滚动；Ctrl+滚轮以鼠标为锚点缩放） */}
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', background: '#f0f1f3', position: 'relative' }}>
        <div style={{ width: worldW, height: worldH, position: 'relative' }}>
          <div
            data-board
            ref={el => { setNodeRef(el); boardRef.current = el; }}
            onPointerDown={e => beginGesture(e, 'marquee')}
            style={{
              position: 'absolute', top: pan.y, left: pan.x,
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

            {guides.v.map((x, i) => (
              <div key={`v${i}`} style={{ position: 'absolute', left: x, top: 0, width: 1, height: '100%', background: '#f43f5e', zIndex: 99, pointerEvents: 'none' }} />
            ))}
            {guides.h.map((y, i) => (
              <div key={`h${i}`} style={{ position: 'absolute', top: y, left: 0, height: 1, width: '100%', background: '#f43f5e', zIndex: 99, pointerEvents: 'none' }} />
            ))}

            {/* 框选矩形（CV-03） */}
            {marquee && (
              <div style={{
                position: 'absolute', left: marquee.x, top: marquee.y,
                width: marquee.w, height: marquee.h,
                border: '1px solid #f97316', background: 'rgba(249,115,22,.08)',
                zIndex: 98, pointerEvents: 'none',
              }} />
            )}

            {root.children.length === 0 && !gesture.current && !marquee && (
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
