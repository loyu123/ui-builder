// 右栏共享工具（P1-13 拆分自 RightPanel）
// P1-17 · 样式对象（fieldInputStyle/cardBtn/tabStyle/panel/head）已迁往 index.css 的 .ub-* 类名体系：
//   fieldInputStyle() → className="ub-field"      cardBtn → className="ub-btn"（可叠加 .ub-btn-sm/.ub-btn-danger/.ub-btn-accent/.ub-btn-ghost）
//   tabStyle(a) → className="ub-tab" + a && " active"   panel → "ub-panel ub-panel-right"   head → "ub-head"
import { useStore } from '../../store';
import type { EventSpec } from '../../types';

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
