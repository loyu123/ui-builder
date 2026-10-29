// AppShell · C 方向顶栏（Logo/项目名/设备切换/预览/导出工程）+ 三栏 + 预览模式
import { DndContext, type DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useEffect, useRef, useState } from 'react';
import { useStore, DEVICES } from '../store';
import { demoLoginProject } from '../store/demo';
import type { DeviceId } from '../types';
import { REGISTRY_MAP } from '../modules/registry';
import { screenToBoard } from '../lib/coords';
import { isVisionConfigured } from '../lib/aiSettings';
import { findContainerAt, absOrigin } from '../lib/tree';
import { LeftPanel } from './LeftPanel';
import { Canvas } from './Canvas';
import { RightPanel } from './RightPanel';
import { ErrorBoundary } from './ErrorBoundary';
import { ProjectModal } from './ProjectModal';
import { ExportModal } from './ExportModal';
import { SettingsModal } from './SettingsModal';
import { ScreenshotModal } from './ScreenshotModal';
import { IconDevice, IconScreenshot, IconSettings } from './icons';
import type { ExportScope } from '../exporter/scope';
import { useT, setLang, getLang, moduleLabel } from '../lib/i18n';

export function AppShell() {
  const t = useT();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));
  const hydrate = useStore(s => s.actions.hydrate);
  const projectName = useStore(s => s.project.name);
  const device = useStore(s => s.editor.currentDevice);
  const setDevice = useStore(s => s.actions.setDevice);
  const [previewing, setPreviewing] = useState(false);
  const [ready, setReady] = useState(false);   // P2-28 · IndexedDB 读取完成前显示骨架，避免闪默认空项目
  const [dragType, setDragType] = useState<string | null>(null);
  const [showProjects, setShowProjects] = useState(false);   // F1 · 项目管理弹层
  const [showExport, setShowExport] = useState(false);       // F8 · 导出范围弹层
  const [showScreenshot, setShowScreenshot] = useState(false); // SS · 截图转界面弹层
  const showSettings = useStore(s => s.settings.open);       // SET-01 · 设置弹层（AI 网关）
  const openSettings = useStore(s => s.actions.openSettings);
  const closeSettings = useStore(s => s.actions.closeSettings);
  // 未配网关/视觉模型时顶栏入口置灰（避免点进去才发现没配置）
  const visionReady = useStore(s => isVisionConfigured(s.settings.ai));
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }

  useEffect(() => {
    void hydrate().then(() => {
      // P2-34 · 示例入口：?demo=login 以示例登录页新建一个项目（F1 起不再覆盖用户已有项目）
      if (new URLSearchParams(window.location.search).get('demo') === 'login') {
        void useStore.getState().actions.createProject({ from: demoLoginProject() });
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
      if (showProjects) return;   // 弹层打开时不响应画布快捷键（Esc 由弹层自己处理）
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
        showToast(t('toast_deleted'));   // P2-26 · 删除可感知
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
    // t 为模块级稳定引用（t 内部实时读当前语言），列入依赖仅为满足 exhaustive-deps
  }, [previewing, t, showProjects]);

  // P2-28 · 加载骨架（IndexedDB 读取通常 <100ms，仅防闪现）——所有 hooks 之后
  if (!ready) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--bg)', color: 'var(--faint)' }}>
        <div style={{ width: 28, height: 28, border: '3px solid var(--line)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'ub-spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 12 }}>{t('loading')}</span>
        <style>{'@keyframes ub-spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    );
  }

  function togglePreview() {
    useStore.getState().actions.select([]);
    setPreviewing(v => !v);
  }

  // F8 · 导出工程 zip（scope 决定页面 / 设备范围；不传 = 全量）
  async function exportZip(scope?: ExportScope) {
    const { exportProjectZip } = await import('../exporter/exporter');
    const bytes = await exportProjectZip(useStore.getState().project, scope);
    localStorage.setItem('ub-last-export', String(Date.now()));
    const blob = new Blob([bytes as BlobPart], { type: 'application/zip' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ui-builder-export.zip';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // F3 · 当前画板导出 PNG（先清空选中，避免选中框进成品；等两帧让 DOM 更新完）
  async function exportPng() {
    const st = useStore.getState();
    st.actions.select([]);
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    const el = document.querySelector('[data-board]') as HTMLElement | null;
    if (!el) return;
    try {
      const { exportBoardPng, boardPngFileName, downloadBlob } = await import('../lib/png');
      const blob = await exportBoardPng(el, { scale: 2 });
      const page = st.project.pages.find(p => p.id === st.editor.currentPageId) ?? st.project.pages[0];
      downloadBlob(blob, boardPngFileName(st.project.name, page.name, st.editor.currentDevice));
    } catch (err) {
      console.error('[png] 导出失败', err);
      showToast(t('png_failed'));
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        {/* C 方向顶栏 */}
        <header style={{
          height: 46, flexShrink: 0, display: 'flex', alignItems: 'center',
          gap: 12, padding: '0 14px', background: 'var(--panel)', borderBottom: '1px solid var(--line)',
        }}>
          {/* Logo（C：橙色方块"开"） */}
          <div style={{
            width: 28, height: 28, borderRadius: 7, background: 'var(--accent)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700,
          }}>开</div>
          <b style={{ fontSize: 14, color: 'var(--ink)' }}>{t('app_title')}</b>

          {/* 项目名（可编辑，橙色圆点标记） */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--accent)' }} />
            <input
              value={projectName}
              onChange={e => useStore.getState().actions.setProjectName(e.target.value)}
              style={{ border: '1px solid transparent', background: 'transparent', borderRadius: 6, padding: '3px 8px', fontSize: 12, color: 'var(--ink-3)', width: 140, outline: 'none' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--panel)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
            />
            <button
              className="ub-icon-btn"
              title={t('open_projects')}
              onClick={() => setShowProjects(true)}
            >▾</button>
          </span>

          {/* 设备切换（C：居中，选中深色） */}
          <span style={{ display: 'flex', gap: 4, margin: '0 auto', background: 'var(--bg-soft)', borderRadius: 9, padding: 3 }}>
            {(Object.keys(DEVICES) as DeviceId[]).map(d => (
              <button key={d} onClick={() => setDevice(d)}
                style={{
                  border: 'none', borderRadius: 7, padding: '5px 16px', fontSize: 13, cursor: 'pointer',
                  background: d === device ? 'var(--ink)' : 'transparent',
                  color: d === device ? '#ffffff' : 'var(--ink-3)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                <IconDevice device={d} />
                {t('device_' + d)}
                <span style={{ fontSize: 10, color: d === device ? '#d1d5db' : 'var(--faint)' }}>{DEVICES[d].w}</span>
              </button>
            ))}
          </span>

          <span style={{ flex: 1 }} />

          {/* 截图转界面 / 预览 / 导出 PNG / 导出工程 / 设置 / 语言切换 */}
          <button
            onClick={() => setShowScreenshot(true)}
            disabled={!visionReady}
            title={visionReady ? t('ss_title') : t('ss_topbar_locked')}
            className="ub-btn ub-btn-pad"
            style={{
              flex: 'none', display: 'flex', alignItems: 'center', gap: 5,
              opacity: visionReady ? 1 : 0.45, cursor: visionReady ? 'pointer' : 'not-allowed',
            }}
          >
            <IconScreenshot size={13} />
            {t('ss_title')}
          </button>
          <button onClick={togglePreview} className="ub-btn ub-btn-pad" style={{ flex: 'none' }}>
            {previewing ? t('exit_preview') : t('preview')}
          </button>
          <button
            onClick={exportPng}
            title={t('export_png_hint')}
            className="ub-btn ub-btn-pad"
            style={{ flex: 'none' }}
          >
            {t('export_png')}
          </button>
          <button onClick={() => setShowExport(true)} className="ub-btn ub-btn-pad ub-btn-accent" style={{ flex: 'none' }}>
            {t('export_zip')}
          </button>
          <button
            onClick={openSettings}
            title={t('settings_title')}
            aria-label={t('settings_title')}
            className="ub-btn ub-btn-pad"
            style={{ flex: 'none', display: 'flex', alignItems: 'center', padding: '0 8px' }}
          >
            <IconSettings size={14} />
          </button>
          <button
            onClick={() => setLang(getLang() === 'zh' ? 'en' : 'zh')}
            title="切换界面语言 / Switch UI language"
            className="ub-btn" style={{ flex: 'none', fontSize: 10, padding: '3px 8px' }}>
            {getLang() === 'zh' ? 'EN' : '中'}
          </button>
        </header>

        {/* 三栏（预览模式只留画布） */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <LeftPanel previewing={previewing} />
          <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>
            <ErrorBoundary compact label="画布">
              <Canvas previewing={previewing} />
            </ErrorBoundary>
          </div>
          <ErrorBoundary compact label="右侧面板">
            <RightPanel previewing={previewing} />
          </ErrorBoundary>
        </div>

        {/* F1 · 项目管理弹层 */}
        {showProjects && <ProjectModal onClose={() => setShowProjects(false)} />}

        {/* F8 · 导出范围弹层 */}
        {showExport && (
          <ExportModal
            onClose={() => setShowExport(false)}
            onConfirm={scope => { setShowExport(false); void exportZip(scope); }}
          />
        )}

        {/* SS · 截图转界面（识别 / 粘贴 JSON → 预览勾选 → 落画布） */}
        {showScreenshot && (
          <ScreenshotModal
            onClose={() => setShowScreenshot(false)}
            onLanded={n => showToast(t('ss_landed', { n: String(n) }))}
            onOpenSettings={() => { setShowScreenshot(false); openSettings(); }}
          />
        )}

        {/* SET-01 · 设置弹层（AI 网关 / Embedding / Reranker） */}
        {showSettings && (
          <SettingsModal
            onClose={closeSettings}
            onSaved={() => showToast(t('settings_saved'))}
            onCleared={() => showToast(t('settings_cleared'))}
          />
        )}

        {/* P2-26 · 轻提示 */}
        {toast && (
          <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
            background: '#2a3548', color: '#e6ebf2', borderRadius: 999, padding: '7px 18px',
            fontSize: 12, boxShadow: '0 4px 14px rgba(0,0,0,.28)',
          }}>{toast}</div>
        )}
      </div>

      {/* 拖拽影子 */}
      <DragOverlay dropAnimation={null}>
        {dragType ? (
          <div style={{
            padding: '8px 14px', background: 'var(--accent-soft)', border: '1px dashed var(--accent)',
            borderRadius: 8, fontSize: 12, color: 'var(--accent-ink)',
          }}>
            {REGISTRY_MAP[dragType] ? moduleLabel(REGISTRY_MAP[dragType]) : dragType}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
