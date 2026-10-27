// 右栏共享样式与 JSON 导入导出工具（P1-13 拆分自 RightPanel）
import type * as React from 'react';
import type { EventSpec } from '../../types';
import { useStore } from '../../store';

export function fieldInputStyle(): React.CSSProperties {
  return { width: '100%', border: '1px solid #ece7dd', borderRadius: 6, padding: '5px 8px', fontSize: 12, background: '#fff' };
}

export const cardBtn: React.CSSProperties = {
  border: '1px solid #ece7dd', background: '#fff', borderRadius: 8,
  fontSize: 12, padding: '6px 0', flex: 1, cursor: 'pointer', color: '#374151',
};

export const tabStyle = (active: boolean): React.CSSProperties => ({
  cursor: 'pointer', paddingBottom: 2,
  borderBottom: active ? '2px solid #f97316' : '2px solid transparent',
  color: active ? '#1f2328' : '#a8a199',
  fontSize: 12,
});

export const panel: React.CSSProperties = {
  width: 288, flexShrink: 0, background: '#ffffff',
  borderLeft: '1px solid #ece7dd', display: 'flex', flexDirection: 'column', minHeight: 0,
};

export const head: React.CSSProperties = {
  padding: '10px 12px', fontSize: 13,
  borderBottom: '1px solid #ece7dd', flexShrink: 0,
};

// P2-10 · 事件动作选项（与 EventSpec.action 枚举一致）
export const EVENT_ACTIONS: Array<{ v: EventSpec['action']; label: string }> = [
  { v: 'none', label: '无（占位）' },
  { v: 'navigate', label: '跳转页面' },
  { v: 'submit', label: '提交表单' },
  { v: 'back', label: '返回上级' },
  { v: 'dismiss', label: '关闭弹层' },
  { v: 'toggle', label: '切换状态' },
  { v: 'bind', label: '绑定接口' },
  { v: 'external', label: '打开外链' },
];

export function exportJson() {
  const { project } = useStore.getState();
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pages.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

export function importJson(file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    const err = useStore.getState().actions.importProject(String(reader.result));
    window.alert(err ? `导入失败：${err}` : '导入成功');
  };
  reader.readAsText(file);
}

export function lastExportText(): string {
  // 顶栏"导出工程"与历史导出时间共用 localStorage 标记
  const t = localStorage.getItem('ub-last-export');
  if (!t) return '从未导出';
  const days = Math.floor((Date.now() - Number(t)) / 86400000);
  return days === 0 ? '今天' : `${days} 天前`;
}
