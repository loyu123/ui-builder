// F1 · 项目管理弹层：项目列表（最近使用倒序）+ 切换 / 重命名 / 删除 / 新建
// 样式走 index.css 的 .ub-* 类；文案走 i18n
import { useEffect } from 'react';
import { useStore } from '../store';
import { useT, useLang } from '../lib/i18n';
import { TEMPLATES } from '../templates';

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() === 0) return '—';
  return d.toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function ProjectModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const list = useStore(s => s.projects.list);
  const currentId = useStore(s => s.project.id);
  const busy = useStore(s => s.projects.busy);
  const refreshProjects = useStore(s => s.actions.refreshProjects);
  const createProject = useStore(s => s.actions.createProject);
  const switchProject = useStore(s => s.actions.switchProject);
  const renameProject = useStore(s => s.actions.renameProject);
  const deleteProject = useStore(s => s.actions.deleteProject);

  // 打开即刷新（右侧改名等改动可能未反映到索引）
  useEffect(() => { void refreshProjects(); }, [refreshProjects]);

  // Esc 关闭（不抢画布快捷键：弹层关闭后才生效）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="ub-mask" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ub-modal" role="dialog" aria-label={t('projects_title')}>
        <div className="ub-modal-head">
          {t('projects_title')}
          <span className="ub-label-sm" style={{ fontWeight: 400 }}>{list.length}</span>
          <button className="ub-icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose} title={t('sc_esc')}>✕</button>
        </div>

        <div className="ub-modal-list">
          {list.map(e => (
            <div
              key={e.id}
              className={`ub-row ub-row-page${e.id === currentId ? ' active' : ''}`}
              aria-selected={e.id === currentId}
              style={{ padding: '7px 8px' }}
              onClick={() => {
                if (busy || e.id === currentId) return;
                void switchProject(e.id).then(onClose);
              }}
            >
              <span className="ub-row-label" title={e.name}>{e.name}</span>
              {e.id === currentId && (
                <span className="ub-label-sm" style={{ color: 'var(--accent-ink)', flexShrink: 0 }}>{t('current_badge')}</span>
              )}
              <span className="ub-label-sm" style={{ flexShrink: 0 }}>{fmt(e.updatedAt)}</span>
              <button
                className="ub-icon-btn"
                title={t('rename_project')}
                onClick={ev => {
                  ev.stopPropagation();
                  const name = window.prompt(t('rename_project'), e.name);
                  if (name) void renameProject(e.id, name);
                }}
              >✎</button>
              {list.length > 1 && (
                <button
                  className="ub-icon-btn"
                  title={t('delete')}
                  onClick={ev => {
                    ev.stopPropagation();
                    if (window.confirm(t('delete_project_confirm', { name: e.name }))) void deleteProject(e.id);
                  }}
                >✕</button>
              )}
            </div>
          ))}
        </div>

        <button
          className="ub-btn ub-btn-accent"
          disabled={busy}
          onClick={() => { void createProject().then(onClose); }}
        >
          ＋ {t('new_blank')}
        </button>

        <div className="ub-label-sm">{t('templates_title')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {TEMPLATES.map(tpl => (
            <button
              key={tpl.id}
              className="ub-btn"
              disabled={busy}
              onClick={() => { void createProject({ from: tpl.build() }).then(onClose); }}
            >
              {lang === 'en' ? tpl.labelEn : tpl.label}
            </button>
          ))}
        </div>

        <div className="ub-label-sm">{t('templates_devices')}</div>
        <div className="ub-label-sm">{t('projects_hint')}</div>
      </div>
    </div>
  );
}
