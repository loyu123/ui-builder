// AppShell · 三栏布局（WS-02）+ DndContext（CV-02）
import type * as React from 'react';
import { DndContext, type DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useEffect, useState } from 'react';
import { useStore, NODE_DEFAULTS, DEVICES } from '../store';
import { screenToBoard } from '../lib/coords';
import { findContainerAt, absOrigin } from '../lib/tree';
import { LeftPanel } from './LeftPanel';
import { Canvas } from './Canvas';
import { RightPanel } from './RightPanel';

export function AppShell() {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));
  const hydrate = useStore(s => s.actions.hydrate);
  const projectName = useStore(s => s.project.name);

  useEffect(() => { void hydrate(); }, [hydrate]);

  const [dragType, setDragType] = useState<string | null>(null);

  function onDragStart(e: DragEndEvent) {
    const data = e.active.data.current;
    if (data?.fromLibrary) setDragType(data.type as string);
  }
  function onDragEnd(e: DragEndEvent) {
    setDragType(null);
    const type = dragType;
    if (type && e.active.data.current?.fromLibrary && e.over?.id === 'board') {
      const el = document.querySelector('[data-board]') as HTMLElement | null;
      if (!el) return;
      // 松开位置 = 按下位置 + 拖拽位移（dnd-kit 的 delta）
      const act = e.activatorEvent as PointerEvent;
      const st = useStore.getState();
      const zoom = st.editor.zoom;
      const p = screenToBoard(act.clientX + e.delta.x, act.clientY + e.delta.y, el.getBoundingClientRect(), zoom);
      const meta = NODE_DEFAULTS[type];
      const device = st.editor.currentDevice;
      const dev = DEVICES[device];
      const page = st.project.pages.find(pg => pg.id === st.editor.currentPageId) ?? st.project.pages[0];
      const board = page.boards[device];

      // CV-06 · 命中容器则挂到容器内（坐标换算到容器左上角）
      const containerId = findContainerAt(board, p, new Set());
      if (containerId) {
        const o = absOrigin(board, containerId);
        useStore.getState().actions.addNode(type, {
          x: Math.round(p.x - o.x - meta.w / 2),
          y: Math.round(p.y - o.y - meta.h / 2),
          w: meta.w, h: meta.h,
        }, containerId);
        return;
      }
      // 根层：钳制在画板范围内
      const x = Math.min(Math.max(0, Math.round(p.x - meta.w / 2)), Math.max(0, dev.w - meta.w));
      const y = Math.min(Math.max(0, Math.round(p.y - meta.h / 2)), Math.max(0, dev.h - meta.h));
      useStore.getState().actions.addNode(type, { x, y, w: meta.w, h: meta.h });
    }
  }

  // CV-03 · 快捷键：Delete 删除选中，Esc 取消选中
  function onKeyDown(e: React.KeyboardEvent) {
    const st = useStore.getState();
    if (e.key === 'Escape') { st.actions.select([]); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && st.editor.selection.length) {
      e.preventDefault();
      st.actions.deleteNode(st.editor.selection[0]);
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#fafafa' }} onKeyDown={onKeyDown}>
        {/* 顶栏 */}
        <header style={{
          height: 44, flexShrink: 0, display: 'flex', alignItems: 'center',
          gap: 12, padding: '0 16px', background: '#ffffff', borderBottom: '1px solid #e5e7eb',
        }}>
          <b style={{ fontSize: 14 }}>界面搭建器</b>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{projectName}</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: '#9ca3af' }}>v0 Demo · W1</span>
        </header>

        {/* 三栏 */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <LeftPanel />
          <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>
            <Canvas />
          </div>
          <RightPanel />
        </div>
      </div>

      {/* 拖拽影子 */}
      <DragOverlay dropAnimation={null}>
        {dragType ? (
          <div style={{
            padding: '8px 14px', background: '#fff7ed', border: '1px dashed #f97316',
            borderRadius: 8, fontSize: 12, color: '#c2410c',
          }}>
            {NODE_DEFAULTS[dragType]?.label ?? dragType}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
