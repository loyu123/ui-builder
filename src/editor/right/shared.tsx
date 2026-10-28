// 右栏共享工具（P1-13 拆分自 RightPanel）
// P1-17 · 样式对象（fieldInputStyle/cardBtn/tabStyle/panel/head）已迁往 index.css 的 .ub-* 类名体系：
//   fieldInputStyle() → className="ub-field"      cardBtn → className="ub-btn"（可叠加 .ub-btn-sm/.ub-btn-danger/.ub-btn-accent/.ub-btn-ghost）
//   tabStyle(a) → className="ub-tab" + a && " active"   panel → "ub-panel ub-panel-right"   head → "ub-head"
import { useStore } from '../../store';
import { MAX_IMPORT_BYTES } from '../../lib/importGuard';
import { t } from '../../lib/i18n';
import type { EventSpec } from '../../types';

// P2-10 · 事件动作选项（与 EventSpec.action 枚举一致）；P3-40 · 标签走 i18n
export function eventActions(): Array<{ v: EventSpec['action']; label: string }> {
  return [
    { v: 'none', label: t('ev_none') },
    { v: 'navigate', label: t('ev_navigate') },
    { v: 'submit', label: t('ev_submit') },
    { v: 'back', label: t('ev_back') },
    { v: 'dismiss', label: t('ev_dismiss') },
    { v: 'toggle', label: t('ev_toggle') },
    { v: 'bind', label: t('ev_bind') },
    { v: 'external', label: t('ev_external') },
  ];
}

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
  // SEC-02 · 读文件前先看体积，避免把超大 JSON 整个读进内存
  if (file.size > MAX_IMPORT_BYTES) {
    window.alert('导入失败：项目文件过大（上限 5 MB）');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const err = useStore.getState().actions.importProject(String(reader.result));
    window.alert(err ? `导入失败：${err}` : '导入成功');
  };
  reader.readAsText(file);
}

export function lastExportText(): string {
  // 顶栏"导出工程"与历史导出时间共用 localStorage 标记；P3-40 · 文案走 i18n
  const v = localStorage.getItem('ub-last-export');
  if (!v) return t('export_never');
  const days = Math.floor((Date.now() - Number(v)) / 86400000);
  return days === 0 ? t('export_today') : t('export_days_ago', { n: days });
}
