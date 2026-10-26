// 右栏 · v0 占位：显示选中节点信息 + 导出 JSON（ST-05 简化版）
import type * as React from 'react';
import { useStore } from '../store';

function exportJson() {
  const { project } = useStore.getState();
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pages.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

export function RightPanel() {
  const selection = useStore(s => s.editor.selection);
  const device = useStore(s => s.editor.currentDevice);
  const page = useStore(s => {
    const pid = s.editor.currentPageId;
    return s.project.pages.find(pg => pg.id === pid) ?? s.project.pages[0];
  });
  const board = page.boards[device];
  const count = Object.keys(board.nodes).length - 1;

  const sel = selection.length === 1 ? board.nodes[selection[0]] : undefined;

  return (
    <aside style={panel}>
      <div style={head}>检查器</div>
      <div style={{ padding: 12, fontSize: 13, color: '#374151', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>当前画板</div>
          <div>{page.name} · {device}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{count} 个模块</div>
        </div>

        {sel ? (
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>选中模块</div>
            <div>{sel.name}</div>
            <pre style={{
              margin: '6px 0 0', fontSize: 11, background: '#f7f5f1',
              padding: 8, borderRadius: 6, overflow: 'auto',
            }}>
{JSON.stringify({ id: sel.id, type: sel.type, frame: sel.frame, events: sel.events }, null, 2)}
            </pre>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#9ca3af' }}>
            未选中模块。画布上点击模块查看信息。
          </div>
        )}

        <button onClick={exportJson} style={btn}>
          导出 JSON
        </button>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>
          已开启自动保存（1s 防抖），刷新页面自动还原。
        </div>
      </div>
    </aside>
  );
}

const panel: React.CSSProperties = {
  width: 280, flexShrink: 0, background: '#ffffff',
  borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column',
};
const head: React.CSSProperties = {
  padding: '10px 12px', fontSize: 12, letterSpacing: 2,
  color: '#6b7280', borderBottom: '1px solid #e5e7eb',
};
const btn: React.CSSProperties = {
  border: 'none', background: '#f97316', color: '#fff',
  borderRadius: 8, padding: '8px 0', fontSize: 13, cursor: 'pointer',
};
