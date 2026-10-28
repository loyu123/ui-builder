// F8 · 导出范围弹层：勾选页面 / 设备后生成 zip
// 空选在范围函数里是兜底成全量的，所以这里直接禁用确认按钮，避免"看起来什么都没选却导出了全部"
import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { useT } from '../lib/i18n';
import { EXPORT_DEVICES, type ExportScope } from '../exporter/scope';
import type { DeviceId } from '../types';

export function ExportModal({ onClose, onConfirm }: {
  onClose: () => void;
  onConfirm: (scope: ExportScope) => void;
}) {
  const t = useT();
  const pages = useStore(s => s.project.pages);
  const [pageIds, setPageIds] = useState<string[]>(() => pages.map(p => p.id));
  const [devices, setDevices] = useState<DeviceId[]>(() => [...EXPORT_DEVICES]);

  // Esc 关闭（弹层开着时不抢画布快捷键）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const togglePage = (id: string) =>
    setPageIds(list => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]));
  const toggleDevice = (d: DeviceId) =>
    setDevices(list => (list.includes(d) ? list.filter(x => x !== d) : [...list, d]));

  const ok = pageIds.length > 0 && devices.length > 0;

  return (
    <div className="ub-mask" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ub-modal" role="dialog" aria-label={t('export_scope_title')}>
        <div className="ub-modal-head">
          {t('export_scope_title')}
          <span className="ub-label-sm" style={{ fontWeight: 400 }}>
            {pageIds.length}/{pages.length} · {devices.length}/{EXPORT_DEVICES.length}
          </span>
          <button className="ub-icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose} title={t('sc_esc')}>✕</button>
        </div>

        <div className="ub-label-sm">{t('export_scope_pages')}</div>
        <div className="ub-modal-list">
          {pages.map(p => (
            <label key={p.id} className={`ub-row${pageIds.includes(p.id) ? ' active' : ''}`} style={{ padding: '6px 8px', gap: 6, fontSize: 12 }}>
              <input type="checkbox" checked={pageIds.includes(p.id)} onChange={() => togglePage(p.id)} />
              <span className="ub-row-label" title={p.name}>{p.name}</span>
            </label>
          ))}
        </div>

        <div className="ub-label-sm">{t('export_scope_devices')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {EXPORT_DEVICES.map(d => (
            <label
              key={d}
              className={`ub-row${devices.includes(d) ? ' active' : ''}`}
              style={{ padding: '6px 8px', gap: 6, fontSize: 12 }}
            >
              <input type="checkbox" checked={devices.includes(d)} onChange={() => toggleDevice(d)} />
              <span className="ub-row-label">{t('device_' + d)}</span>
            </label>
          ))}
        </div>

        <div className="ub-label-sm">{t('export_scope_hint')}</div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ub-btn ub-btn-accent" style={{ flex: 1 }} disabled={!ok}
            onClick={() => onConfirm({ pageIds, devices })}>
            {t('export_scope_confirm')}
          </button>
          <button className="ub-btn" onClick={onClose}>{t('export_scope_cancel')}</button>
        </div>
      </div>
    </div>
  );
}
