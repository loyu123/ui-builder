// 右栏壳（P1-13 拆分后）：页签切换 + 选中自动跳属性 + 预览隐藏
// 主体在 right/AiPanel.tsx（AI 助手）与 right/PropsPanel.tsx（属性表单），共享样式在 right/shared.tsx
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useT } from '../lib/i18n';
import { AiPanel } from './right/AiPanel';
import { PropsPanel } from './right/PropsPanel';

// P1-17 · 面板/页签样式走 index.css 的 .ub-* 类
const tabCls = (active: boolean) => `ub-tab${active ? ' active' : ''}`;

export function RightPanel({ previewing }: { previewing?: boolean }) {
  const t = useT();
  const selection = useStore(s => s.editor.selection);
  const [tab, setTab] = useState<'ai' | 'props'>('ai');

  // 选中即编辑：点选画布模块时自动切到属性页签（手动切回助手后，选中新模块才会再切换）
  const selId = selection.length === 1 ? selection[0] : null;
  const lastSelRef = useRef<string | null>(null);
  useEffect(() => {
    if (selId && selId !== lastSelRef.current) setTab('props');
    lastSelRef.current = selId;
  }, [selId]);

  if (previewing) return null;

  return (
    <aside className="ub-panel ub-panel-right">
      {/* C：AI 设计助手标题 + 属性入口 */}
      <div className="ub-head ub-head-line" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--accent)' }}>✦</span>
        <b style={{ color: 'var(--ink)', letterSpacing: 0 }}>{t('panel_ai_title')}</b>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <span onClick={() => setTab('ai')} className={tabCls(tab === 'ai')}>{t('tab_ai')}</span>
          <span onClick={() => setTab('props')} className={tabCls(tab === 'props')}>{t('tab_props')}</span>
        </span>
      </div>

      {tab === 'ai' ? <AiPanel onOpenProps={() => setTab('props')} /> : <PropsPanel />}
    </aside>
  );
}
