// AppShell · C 方向顶栏（Logo/项目名/设备切换/预览/导出工程）+ 三栏 + 预览模式
import { DndContext, type DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useEffect, useState } from 'react';
import { useStore, DEVICES } from '../store';
import { demoLoginProject } from '../store/demo';
import type { DeviceId } from '../types';
import { REGISTRY_MAP } from '../modules/registry';
import { screenToBoard } from '../lib/coords';
import { findContainerAt, absOrigin } from '../lib/tree';
import { LeftPanel } from './LeftPanel';
import { Canvas } from './Canvas';
import { RightPanel } from './RightPanel';

export function AppShell() {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));
  const hydrate = useStore(s => s.actions.hydrate);
  const projectName = useStore(s => s.project.name);
  const device = useStore(s => s.editor.currentDevice);
  const setDevice = useStore(s => s.actions.setDevice);
  const [previewing, setPreviewing] = useState(false);
  const [ready, setReady] = useState(false);   // P2-28 · IndexedDB 读取完成前显示骨架，避免闪默认空项目
  const [dragType, setDragType] = useState<string | null>(null);

  useEffect(() => {
    void hydrate().then(() => {
      // P2-34 · 示例入口：?demo=login 灌入示例登录页（覆盖当前设计，便于演示/回归）
      if (new URLSearchParams(window.location.search).get('demo') === 'login') {
        const project = demoLoginProject();
        useStore.setState({ project, editor: { ...useStore.getState().editor, currentPageId: project.pages[0].id, selection: [] } });
      }
      setReady(true);
    });
  }, [hydrate]);

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
      const meta = REGISTRY_MAP[type];
      const dev = DEVICES[st.editor.currentDevice];
      const page = st.project.pages.find(pg => pg.id === st.editor.currentPageId) ?? st.project.pages[0];
      const board = page.boards[st.editor.currentDevice];

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
      const x = Math.min(Math.max(0, Math.round(p.x - meta.w / 2)), Math.max(0, dev.w - meta.w));
      const y = Math.min(Math.max(0, Math.round(p.y - meta.h / 2)), Math.max(0, dev.h - meta.h));
      useStore.getState().actions.addNode(type, { x, y, w: meta.w, h: meta.h });
    }
  }

  // CV-03 · 快捷键（window 级监听，焦点不在编辑器内也生效）
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const st = useStore.getState();
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape' && previewing) { setPreviewing(false); return; }
      if (e.key === 'Escape') { st.actions.select([]); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') { st.actions.copySelection(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { st.actions.pasteClipboard(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.actions.redo(); else st.actions.undo();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && st.editor.selection.length) {
        e.preventDefault();
        st.actions.deleteNode(st.editor.selection[0]);
        return;
      }
      // P2-20 · 方向键微调：1px，Shift +8px（400ms 内合并为一步撤销）
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && st.editor.selection.length) {
        e.preventDefault();
        const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
        const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
        const step = e.shiftKey ? 8 : 1;
        const page = st.project.pages.find(pg => pg.id === st.editor.currentPageId) ?? st.project.pages[0];
        const board = page.boards[st.editor.currentDevice];
        for (const id of st.editor.selection) {
          const n = board.nodes[id];
          if (!n || n.parentId === null) continue;
          if (dx) st.actions.setFrameField(id, 'x', n.frame.x + dx * step);
          else st.actions.setFrameField(id, 'y', n.frame.y + dy * step);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewing]);

  // P2-28 · 加载骨架（IndexedDB 读取通常 <100ms，仅防闪现）——所有 hooks 之后
  if (!ready) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#faf9f7', color: '#a8a199' }}>
        <div style={{ width: 28, height: 28, border: '3px solid #ece7dd', borderTopColor: '#f97316', borderRadius: '50%', animation: 'ub-spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 12 }}>正在加载设计数据…</span>
        <style>{'@keyframes ub-spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    );
  }

  function togglePreview() {
    useStore.getState().actions.select([]);
    setPreviewing(v => !v);
  }

  async function exportZip() {
    const { exportProjectZip } = await import('../exporter/exporter');
    const bytes = await exportProjectZip(useStore.getState().project);
    localStorage.setItem('ub-last-export', String(Date.now()));
    const blob = new Blob([bytes as BlobPart], { type: 'application/zip' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ui-builder-export.zip';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#faf9f7' }}>
        {/* C 方向顶栏 */}
        <header style={{
          height: 46, flexShrink: 0, display: 'flex', alignItems: 'center',
          gap: 12, padding: '0 14px', background: '#ffffff', borderBottom: '1px solid #ece7dd',
        }}>
          {/* Logo（C：橙色方块"开"） */}
          <div style={{
            width: 28, height: 28, borderRadius: 7, background: '#f97316',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700,
          }}>开</div>
          <b style={{ fontSize: 14, color: '#1f2328' }}>界面搭建器</b>

          {/* 项目名（可编辑，橙色圆点标记） */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: '#f97316' }} />
            <input
              value={projectName}
              onChange={e => useStore.getState().actions.setProjectName(e.target.value)}
              style={{ border: '1px solid transparent', background: 'transparent', borderRadius: 6, padding: '3px 8px', fontSize: 12, color: '#57534e', width: 140, outline: 'none' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#ece7dd'; e.currentTarget.style.background = '#fff'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
            />
          </span>

          {/* 设备切换（C：居中，选中深色） */}
          <span style={{ display: 'flex', gap: 4, margin: '0 auto', background: '#f5f2ec', borderRadius: 9, padding: 3 }}>
            {(Object.keys(DEVICES) as DeviceId[]).map(d => (
              <button key={d} onClick={() => setDevice(d)}
                style={{
                  border: 'none', borderRadius: 7, padding: '5px 16px', fontSize: 13, cursor: 'pointer',
                  background: d === device ? '#1f2328' : 'transparent',
                  color: d === device ? '#ffffff' : '#57534e',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                {d === 'desktop' ? '🖥' : d === 'mobile' ? '📱' : '⌚'}
                {DEVICES[d].label}
                <span style={{ fontSize: 10, color: d === device ? '#d1d5db' : '#a8a199' }}>{DEVICES[d].w}</span>
              </button>
            ))}
          </span>

          <span style={{ flex: 1 }} />

          {/* 预览 / 导出工程 / 方向标签 */}
          <button onClick={togglePreview}
            style={{ border: '1px solid #ece7dd', background: '#fff', borderRadius: 8, fontSize: 13, padding: '6px 16px', cursor: 'pointer', color: '#374151' }}>
            {previewing ? '退出预览' : '预览'}
          </button>
          <button onClick={exportZip}
            style={{ border: 'none', background: '#f97316', color: '#fff', borderRadius: 8, fontSize: 13, padding: '6px 16px', cursor: 'pointer', fontWeight: 600 }}>
            导出工程
          </button>
          <span style={{ fontSize: 10, color: '#a8a199', border: '1px solid #ece7dd', borderRadius: 6, padding: '3px 8px' }}>
            方向 C · 极简中性
          </span>
        </header>

        {/* 三栏（预览模式只留画布） */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <LeftPanel previewing={previewing} />
          <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>
            <Canvas previewing={previewing} />
          </div>
          <RightPanel previewing={previewing} />
        </div>
      </div>

      {/* 拖拽影子 */}
      <DragOverlay dropAnimation={null}>
        {dragType ? (
          <div style={{
            padding: '8px 14px', background: '#fff7ed', border: '1px dashed #f97316',
            borderRadius: 8, fontSize: 12, color: '#c2410c',
          }}>
            {REGISTRY_MAP[dragType]?.label ?? dragType}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
