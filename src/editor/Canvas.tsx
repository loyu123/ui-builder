// 中间画布 · DV-01 设备画板 + CV-01 嵌套渲染 + CV-04 吸附 + CV-05 缩放手柄
// + CV-06 容器进出 + CV-03 框选/多选移动 + DV-03 缩放平移
// P1-14 · 拆分：单节点渲染 → canvas/NodeView.tsx（memo），缩放/框选纯函数 → canvas/gesture.ts（可单测）；
//          本文件保留手势状态机（begin/move/up）与台面渲染。
import type * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { DEVICES, useStore } from '../store';
import { screenToBoard, snapThreshold } from '../lib/coords';
import { matchSnap } from '../lib/snap';
import { absOrigin, findContainerAt, subtreeIds } from '../lib/tree';
import { useT } from '../lib/i18n';
import { NodeView } from './canvas/NodeView';
import { marqueeHits, resizeFrame, type Handle } from './canvas/gesture';
import type { Frame, Node } from '../types';

interface Gesture {
  mode: 'move' | 'resize' | 'marquee' | 'pan';
  handle?: Handle;
  nodeId?: string;
  multiIds?: string[];                       // 多选整体移动
  startFrames?: Record<string, Frame>;
  startFrame: Frame;
  startPt: { x: number; y: number };
  startPan?: { x: number; y: number };       // pan 手势用（屏幕像素）
  startClient?: { x: number; y: number };
}

interface EditState { id: string; key: string; value: string }

export function Canvas({ previewing }: { previewing?: boolean }) {
  const t = useT();
  const device = useStore(s => s.editor.currentDevice);
  const zoom = useStore(s => s.editor.zoom);
  const pan = useStore(s => s.editor.pan);
  const selection = useStore(s => s.editor.selection);
  const pages = useStore(s => s.project.pages);
  const [previewPageId, setPreviewPageId] = useState<string | null>(null);   // 预览内路由：navigate 跳转目标页
  const page = useStore(s => {
    const pid = previewing ? (previewPageId ?? s.editor.currentPageId) : s.editor.currentPageId;
    return s.project.pages.find(pg => pg.id === pid) ?? s.project.pages[0];
  });
  const board = page.boards[device];
  const dev = DEVICES[device];

  // 退出预览时重置预览路由
  useEffect(() => {
    if (!previewing) setPreviewPageId(null);
  }, [previewing]);

  const boardRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { setNodeRef, isOver } = useDroppable({ id: 'board' });

  const gesture = useRef<Gesture | null>(null);
  const [preview, setPreview] = useState<{ id: string; frame: Frame } | null>(null);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<Frame | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const editingRef = useRef<EditState | null>(null);
  const spaceDown = useRef(false);
  const setEdit = (e: EditState | null) => { editingRef.current = e; setEditing(e); };

  // 空格平移（DV-03）：按住空格 + 拖动台面；Esc 手势中取消（P2-21，未落库直接丢弃预览）
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') { spaceDown.current = true; return; }
      if (e.key === 'Escape' && gesture.current) {
        gesture.current = null;
        setPreview(null);
        setGuides({ v: [], h: [] });
        setMarquee(null);
        setDropTarget(null);
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDown.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

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

  // —— 传给 NodeView 的稳定回调（memo 生效的前提） ——
  const beginGesture = useCallback(function beginGesture(
    e: React.PointerEvent, mode: Gesture['mode'], node?: Node, handle?: Handle,
  ) {
    if (!boardRef.current) return;
    // 预览模式：只允许空格/触控板平移，拖动/缩放/框选/选中一律不响应
    if (previewing && !(mode === 'marquee' && spaceDown.current)) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const st = useStore.getState();
    const curBoard = (st.project.pages.find(pg => pg.id === st.editor.currentPageId) ?? st.project.pages[0])
      .boards[st.editor.currentDevice];

    function boardPoint(ev: React.PointerEvent) {
      return screenToBoard(
        ev.clientX, ev.clientY,
        boardRef.current!.getBoundingClientRect(),
        useStore.getState().editor.zoom,
      );
    }

    // 空格平移：最高优先级（在台面空白处按住空格拖动）
    if (mode === 'marquee' && spaceDown.current) {
      gesture.current = {
        mode: 'pan', startFrame: { x: 0, y: 0, w: 0, h: 0 },
        startClient: { x: e.clientX, y: e.clientY },
        startPan: { ...st.editor.pan },
        startPt: { x: 0, y: 0 },
      };
      return;
    }

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
      const group = st.editor.selection.filter(id => curBoard.nodes[id]?.parentId === parent);
      if (group.length > 1) {
        multiIds = group;
        startFrames = Object.fromEntries(group.map(id => [id, { ...curBoard.nodes[id].frame }]));
      }
    }

    gesture.current = {
      mode, handle, nodeId: node.id, multiIds, startFrames,
      startFrame: { ...node.frame },
      startPt: boardPoint(e),
    };
    st.actions.select([node.id]);
  }, [previewing]);

  const handleNavigate = useCallback((targetPageId: string) => {
    setPreviewPageId(targetPageId);
  }, []);

  const handleStartEdit = useCallback((id: string, key: string, value: string) => {
    setEdit({ id, key, value });
  }, []);

  const handleEditChange = useCallback((value: string) => {
    const e = editingRef.current;
    if (e) setEdit({ ...e, value });
  }, []);

  const handleEditEnd = useCallback((commit: boolean) => {
    const e = editingRef.current;
    if (e && commit) useStore.getState().actions.setProp(e.id, e.key, e.value);
    setEdit(null);
  }, []);

  function boardPoint(e: React.PointerEvent) {
    return screenToBoard(
      e.clientX, e.clientY,
      boardRef.current!.getBoundingClientRect(),
      useStore.getState().editor.zoom,
    );
  }

  // CV-04 · 吸附
  function applySnap(frame: Frame, movingId: string, parentId: string): Frame {
    const st = useStore.getState();
    const th = snapThreshold(st.editor.zoom);
    const exclude = subtreeIds(board, movingId);
    const pOrigin = absOrigin(board, parentId);
    const myAbs = { x: pOrigin.x + frame.x, y: pOrigin.y + frame.y, w: frame.w, h: frame.h };

    const vx: number[] = [0, dev.w, dev.w / 2];   // P2-23 · 画板中线吸附候选
    const hy: number[] = [0, dev.h, dev.h / 2];
    for (const n of Object.values(board.nodes)) {
      if (exclude.has(n.id) || !n.parentId) continue;
      const o = absOrigin(board, n.id);
      vx.push(o.x, o.x + n.frame.w, o.x + n.frame.w / 2);
      hy.push(o.y, o.y + n.frame.h, o.y + n.frame.h / 2);
    }

    const gv: number[] = [];
    const gh: number[] = [];
    const out = { ...frame };
    // P1-14 · 匹配逻辑在 lib/snap.ts（纯函数，已单测）
    const bestV = matchSnap([myAbs.x, myAbs.x + myAbs.w / 2, myAbs.x + myAbs.w], vx, th);
    if (bestV) { out.x += bestV.d; gv.push(bestV.cand); }
    const bestH = matchSnap([myAbs.y, myAbs.y + myAbs.h / 2, myAbs.y + myAbs.h], hy, th);
    if (bestH) { out.y += bestH.d; gh.push(bestH.cand); }
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
    } else if (g.mode === 'pan' && g.startPan && g.startClient) {
      // 屏幕像素直接平移（不除 zoom）
      useStore.getState().actions.setPan({
        x: g.startPan.x + (e.clientX - g.startClient.x),
        y: g.startPan.y + (e.clientY - g.startClient.y),
      });
      return;
    } else {
      // P1-14 · 缩放推框在 canvas/gesture.ts（纯函数，已单测）
      const f2 = resizeFrame(g.startFrame, g.handle!, dx, dy, e.shiftKey);
      setGuides({ v: [], h: [] });
      setPreview({ id: g.nodeId!, frame: f2 });
    }
  }

  function onPointerUp() {
    const g = gesture.current;
    const a = useStore.getState().actions;
    if (g?.mode === 'marquee' && marquee) {
      // 框选：命中根层子节点（P1-14 · 命中判定在 canvas/gesture.ts，已单测）
      const hits = marqueeHits(
        board.nodes[board.rootId].children.map(id => board.nodes[id]).filter(Boolean),
        marquee,
      );
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

  const root = board.nodes[board.rootId];
  const rootChildren = root.children.map(id => board.nodes[id]).filter(Boolean);
  const worldW = pan.x + dev.w * zoom + 80;
  const worldH = pan.y + dev.h * zoom + 80;
  const dropActive = gesture.current?.mode === 'move';

  return (
    <main style={{ ...wrap, position: 'relative' }} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
      {/* C：浮动信息条（缩放 / 对齐参考线 / 吸附） */}
      {!previewing && (
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, display: 'flex', alignItems: 'center', gap: 10,
          background: '#ffffff', border: '1px solid var(--line)', borderRadius: 999,
          padding: '5px 14px', fontSize: 11, color: 'var(--ink-faint)',
          boxShadow: '0 2px 10px rgba(31,35,40,.06)', whiteSpace: 'nowrap',
        }}>
          <span>{t('canvas_zoom_label')} <b style={{ color: 'var(--ink)' }}>{Math.round(zoom * 100)}%</b></span>
          <span style={{ color: 'var(--line)' }}>|</span>
          <span>{t('canvas_guides')}</span>
          <span style={{ color: 'var(--line)' }}>|</span>
          <span>{t('canvas_snap')}</span>
          <span style={{ color: 'var(--line)' }}>|</span>
          {[0.5, 1, 1.5].map(z => (
            <button key={z} onClick={() => useStore.getState().actions.setZoom(z)}
              style={{ ...zoomBtn, ...(zoom === z ? zoomBtnActive : {}) }}>
              {z * 100}%
            </button>
          ))}
          <span style={{ fontSize: 10, color: 'var(--faint-3)' }}>{t('canvas_ctrl_wheel')}</span>
        </div>
      )}

      {/* 预览状态条：页面指示 + 手动切换（替代编辑信息条） */}
      {previewing && (
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 30,
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#2a3548', color: '#e6ebf2', border: '1px solid var(--accent)',
          borderRadius: 999, padding: '5px 14px', fontSize: 12,
          boxShadow: '0 4px 14px rgba(0,0,0,.35)',
        }}>
          <span style={{ color: 'var(--accent)' }}>{t('preview_badge')}</span>
          <select
            value={page.id}
            onChange={e => setPreviewPageId(e.target.value)}
            style={{ background: 'transparent', color: '#e6ebf2', border: 'none', outline: 'none', fontSize: 12, cursor: 'pointer' }}
          >
            {pages.map(pg => <option key={pg.id} value={pg.id} style={{ color: 'var(--ink)' }}>{pg.name}</option>)}
          </select>
          <span style={{ fontSize: 10, color: '#9aa7b8' }}>{t('preview_hint')}</span>
        </div>
      )}

      {/* 画板台面（C：暖米色；可滚动；Ctrl+滚轮以鼠标为锚点缩放） */}
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', background: 'var(--canvas-desk)', position: 'relative' }}>
        <div style={{ width: worldW, height: worldH + 40, position: 'relative' }}>
          {/* 缩放外壳（含电脑窗口 chrome） */}
          <div style={{
            position: 'absolute', top: pan.y, left: pan.x,
            width: dev.w,
            transform: `scale(${zoom})`, transformOrigin: 'top left',
          }}>
            {/* 电脑画板：窗口 chrome（C） */}
            {device === 'desktop' && (
              <div style={{
                height: 30, background: 'var(--bg-soft)', border: '1px solid var(--line)', borderBottom: 'none',
                borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'center',
                padding: '0 12px', gap: 5, boxSizing: 'border-box',
              }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f87171' }} />
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#fbbf24' }} />
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#34d399' }} />
                <span style={{
                  marginLeft: 12, flex: 1, maxWidth: 300, background: '#ffffff',
                  border: '1px solid var(--line)', borderRadius: 5,
                  fontSize: 10, color: 'var(--faint)', padding: '2px 10px',
                }}>
                  {page.name} / 登录页
                </span>
              </div>
            )}
            <div
              data-board
              ref={el => { setNodeRef(el); boardRef.current = el; }}
              onPointerDown={e => beginGesture(e, 'marquee')}
              style={{
                width: dev.w, height: dev.h,
                background: '#ffffff',
                border: isOver ? '2px solid var(--accent)' : '1px solid var(--line)',
                borderRadius: device === 'desktop' ? '0 0 10px 10px' : 24,
                boxShadow: '0 4px 24px rgba(87,83,78,.10)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
            {rootChildren.map(n => n.hidden ? null : (   // PP-03 · 隐藏节点不渲染
              <NodeView
                key={n.id}
                node={n}
                board={board}
                previewing={previewing}
                selection={selection}
                previewId={preview?.id ?? null}
                previewFrame={preview?.frame ?? null}
                dropTargetId={dropTarget}
                dropActive={dropActive}
                editingId={editing?.id ?? null}
                editingKey={editing?.key ?? ''}
                editingValue={editing?.value ?? ''}
                beginGesture={beginGesture}
                onNavigate={handleNavigate}
                onStartEdit={handleStartEdit}
                onEditChange={handleEditChange}
                onEditEnd={handleEditEnd}
              />
            ))}

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
                border: '1px solid var(--accent)', background: 'rgba(37,99,235,.10)',
                zIndex: 98, pointerEvents: 'none',
              }} />
            )}

            {root.children.length === 0 && !gesture.current && !marquee && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: '#c0c4cc', fontSize: 13,
                border: '2px dashed var(--line)', margin: 24, borderRadius: 12,
              }}>
                {t('canvas_hint_drag')}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

const wrap: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 };
const zoomBtn: React.CSSProperties = {
  border: '1px solid var(--line)', background: '#ffffff', borderRadius: 6,
  padding: '3px 8px', fontSize: 11, color: 'var(--ink-2)', cursor: 'pointer', marginLeft: 4,
};
const zoomBtnActive: React.CSSProperties = {
  background: 'var(--accent)', borderColor: 'var(--accent)', color: '#ffffff',
};
