// SS-09 · 截图转界面（M0b · 接真模型）
// 两个数据源：①「识别」调使用者自配的 OpenAI 兼容视觉端点；②直接粘贴识别 JSON（离线兜底）。
// 图片只存在于本组件内存 + objectURL，不写 project、不写 IndexedDB、不进导出；关闭弹层即释放。
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { DEVICES, useStore } from '../store';
import { moduleLabel, useT } from '../lib/i18n';
import { REGISTRY } from '../modules/registry';
import { isVisionConfigured } from '../lib/aiSettings';
import { runPipeline, type PipelineResult } from '../lib/screenshot/pipeline';
import { toNodeSpecs } from '../lib/screenshot/toNodes';
import { fileToDataUrl, recognizeScreenshot, type VisionErrorKind } from '../lib/screenshot/vision';
import { toBoardFrame, type Size } from '../lib/screenshot/coords';
import type { RatioBox } from '../lib/screenshot/schema';
import { IconCopy, IconScreenshot } from './icons';

const TIER_COLOR = { ok: '#2563eb', warn: '#d97706', low: '#dc2626' } as const;
const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function ScreenshotModal({ onClose, onLanded, onOpenSettings }: {
  onClose: () => void;
  onLanded?: (count: number) => void;
  onOpenSettings?: () => void;
}) {
  const t = useT();
  const device = useStore(s => s.editor.currentDevice);
  const addNodesTree = useStore(s => s.actions.addNodesTree);
  const ai = useStore(s => s.settings.ai);
  const dev = DEVICES[device];

  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgSize, setImgSize] = useState<Size | null>(null);
  const [json, setJson] = useState('');
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiErr, setAiErr] = useState<{ kind: VisionErrorKind; status?: number; raw?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragRef = useRef<{
    id: string; mode: 'move' | 'resize';
    sx: number; sy: number; box: RatioBox; w: number; h: number;
  } | null>(null);
  const dupSeq = useRef(0);

  const aiReady = isVisionConfigured(ai);
  const aiHost = useMemo(() => {
    try { return new URL(ai.baseUrl).host; } catch { return ai.baseUrl; }
  }, [ai.baseUrl]);

  // 释放 blob URL（换图 / 关闭弹层）；卸载时顺手取消在途识别请求
  useEffect(() => () => { if (imgSrc) URL.revokeObjectURL(imgSrc); }, [imgSrc]);
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function pickImage(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr(t('ss_image_bad')); return; }
    abortRef.current?.abort();
    if (imgSrc) URL.revokeObjectURL(imgSrc);
    setImgFile(file);
    setImgSize(null);
    setErr(null);
    setAiErr(null);
    setImgSrc(URL.createObjectURL(file));
  }

  /** 文本 → 流水线 → 预览勾选（AI 识别与手动粘贴共用同一条路径） */
  function applyParse(source: string) {
    setErr(null);
    let raw: unknown;
    try {
      raw = JSON.parse(source);
    } catch {
      setErr(t('ss_json_bad'));
      return;
    }
    const r = runPipeline(raw, { w: dev.w, h: dev.h }, { image: imgSize });
    if (!r.items.length) { setErr(t('ss_empty')); setResult(null); return; }
    scrollToResult.current = true;
    setResult(r);
    // 占位块默认不勾选（宁可少放，也不放错）
    setEnabled(Object.fromEntries(r.items.map(i => [i.id, !i.placeholder])));
  }

  function parse() { applyParse(json); }

  /** 「识别」与「取消」是同一个按钮：忙时再点即中断（不重试、不重复计费） */
  async function recognize() {
    if (busy) { abortRef.current?.abort(); return; }
    if (!imgFile) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setAiErr(null);
    setErr(null);
    try {
      const dataUrl = await fileToDataUrl(imgFile);
      const r = await recognizeScreenshot(dataUrl, { cfg: ai, signal: ctrl.signal });
      if (!r.ok) {
        if (r.kind !== 'ABORTED') setAiErr({ kind: r.kind, status: r.status, raw: r.raw });
        return;
      }
      const text = JSON.stringify(r.data, null, 2);
      setJson(text);
      applyParse(text);
    } finally {
      setBusy(false);
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }

  // 只在「新解析出结果」时滚到底；行内改类型 / 删除不动滚动位置
  const scrollToResult = useRef(false);
  useEffect(() => {
    const el = modalRef.current;
    if (result && el && scrollToResult.current) {
      scrollToResult.current = false;
      el.scrollTo({ top: el.scrollHeight });
    }
  }, [result]);

  /** 行内改类型：手动指定即视为「已确认」，不再算占位块 */
  function changeType(id: string, type: string) {
    setResult(prev => (prev
      ? { ...prev, items: prev.items.map(i => (i.id === id ? { ...i, type, placeholder: false, known: true } : i)) }
      : prev));
    setEnabled(prev => ({ ...prev, [id]: true }));
  }

  function removeRow(id: string) {
    setResult(prev => (prev ? { ...prev, items: prev.items.filter(i => i.id !== id) } : prev));
    setEnabled(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  /** 复制一行：紧贴原行下方插入（列表/输入这类重复块的最短路径） */
  function duplicateRow(id: string) {
    const src = result?.items.find(i => i.id === id);
    if (!src) return;
    const box: RatioBox = { ...src.box, y: Math.min(1 - src.box.h, src.box.y + src.box.h + 0.01) };
    dupSeq.current += 1;
    const copy = { ...src, id: `${src.id}-c${dupSeq.current}`, box, frame: toBoardFrame(box, { w: dev.w, h: dev.h }) };
    setResult(prev => {
      if (!prev) return prev;
      const items = [...prev.items];
      const at = items.findIndex(i => i.id === id);
      items.splice(at + 1, 0, copy);
      return { ...prev, items };
    });
    setEnabled(prev => ({ ...prev, [copy.id]: true }));
    setActiveId(copy.id);
  }

  /** 预览里拖框微调：像素位移 ÷ 渲染尺寸 → 0-1 位移，再重算画板 frame */
  const onDragMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / d.w;
    const dy = (e.clientY - d.sy) / d.h;
    setResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(i => {
          if (i.id !== d.id) return i;
          const box: RatioBox = d.mode === 'move'
            ? { ...i.box, x: clampN(d.box.x + dx, 0, 1 - d.box.w), y: clampN(d.box.y + dy, 0, 1 - d.box.h) }
            : { ...i.box, w: clampN(d.box.w + dx, 0.01, 1 - i.box.x), h: clampN(d.box.h + dy, 0.01, 1 - i.box.y) };
          return { ...i, box, frame: toBoardFrame(box, { w: dev.w, h: dev.h }) };
        }),
      };
    });
  }, [dev.w, dev.h]);

  function beginDrag(e: ReactPointerEvent<HTMLDivElement>, id: string, mode: 'move' | 'resize') {
    const item = result?.items.find(i => i.id === id);
    // 拖拽起点可能是框本身或它的右下角把手，统一按「图片容器」换算比例
    const wrap = e.currentTarget.closest('[data-ss-shot]');
    if (!item || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    e.preventDefault();
    e.stopPropagation();
    setActiveId(id);
    dragRef.current = { id, mode, sx: e.clientX, sy: e.clientY, box: { ...item.box }, w: rect.width, h: rect.height };
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', endDrag, { once: true });
  }

  function endDrag() {
    dragRef.current = null;
    window.removeEventListener('pointermove', onDragMove);
  }

  useEffect(() => () => window.removeEventListener('pointermove', onDragMove), [onDragMove]);

  const selected = useMemo(
    () => (result ? result.items.filter(i => enabled[i.id]) : []),
    [result, enabled],
  );

  function land() {
    const specs = toNodeSpecs(selected);
    if (!specs.length) return;
    const n = addNodesTree(specs);
    onLanded?.(n);
    onClose();
  }

  /** 只保留高置信度：一键把中等/低置信度摘出勾选，先落地能用的部分 */
  function selectOnlyOk() {
    if (!result) return;
    setEnabled(Object.fromEntries(result.items.map(i => [i.id, i.tier === 'ok' && !i.placeholder])));
  }

  const allOn = Boolean(result) && result!.items.every(i => enabled[i.id]);
  const warnCount = result ? result.items.filter(i => i.tier === 'warn').length : 0;
  const aiErrText = aiErr
    ? (aiErr.kind === 'HTTP'
      ? t('ss_ai_err_http', { status: aiErr.status ?? '', model: ai.visionModel })
      : t(`ss_ai_err_${aiErr.kind.toLowerCase()}`))
    : '';
  const spaceLabel = result
    ? (result.space === 'ratio' ? '0-1' : result.space === 'grid1000' ? '0-1000' : 'px')
    : '';
  const placeholderCount = result ? result.items.filter(i => i.placeholder).length : 0;

  return (
    <div className="ub-mask" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={modalRef} className="ub-modal" role="dialog" aria-label={t('ss_title')} style={{ width: 720, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto' }}>
        <div className="ub-modal-head">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconScreenshot size={14} />
            {t('ss_title')}
          </span>
          <button className="ub-icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose} title={t('sc_esc')}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: imgSrc ? '1fr 260px' : '1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            {!imgSrc ? (
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); pickImage(e.dataTransfer.files?.[0]); }}
                style={{
                  border: '1px dashed var(--line)', borderRadius: 10, padding: '22px 16px',
                  textAlign: 'center', fontSize: 12, color: 'var(--faint-2)', cursor: 'pointer',
                }}
              >
                {t('ss_choose_image')}
                <div style={{ fontSize: 10, marginTop: 4 }}>{t('ss_hint_image')}</div>
              </div>
            ) : (
              <div data-ss-shot style={{ position: 'relative', alignSelf: 'flex-start', maxWidth: '100%', flexShrink: 0 }}>
                <img
                  src={imgSrc}
                  alt=""
                  style={{ maxHeight: 280, maxWidth: '100%', display: 'block', borderRadius: 8, background: '#f8fafc' }}
                  onLoad={e => setImgSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                  onError={() => { setImgSize(null); setErr(t('ss_image_fail')); }}
                />
                {result && result.items.map(i => (
                  <div
                    key={i.id}
                    title={`${i.type} · ${i.confidence.toFixed(2)}`}
                    onPointerDown={e => beginDrag(e, i.id, 'move')}
                    style={{
                      position: 'absolute',
                      left: `${i.box.x * 100}%`, top: `${i.box.y * 100}%`,
                      width: `${i.box.w * 100}%`, height: `${i.box.h * 100}%`,
                      border: `${activeId === i.id ? 2 : 1}px ${i.placeholder ? 'dashed' : 'solid'} ${TIER_COLOR[i.tier]}`,
                      background: enabled[i.id] ? 'rgba(37,99,235,.10)' : 'transparent',
                      opacity: enabled[i.id] ? 1 : 0.45,
                      pointerEvents: 'auto',
                      cursor: 'move',
                      boxSizing: 'border-box',
                      touchAction: 'none',
                    }}
                  >
                    <div
                      onPointerDown={e => beginDrag(e, i.id, 'resize')}
                      title={t('ss_drag_resize')}
                      style={{
                        position: 'absolute', right: -4, bottom: -4, width: 9, height: 9,
                        background: '#fff', border: `1.5px solid ${TIER_COLOR[i.tier]}`, borderRadius: 2,
                        cursor: 'nwse-resize',
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            {imgSrc && result && (
              <div style={{ fontSize: 10, color: 'var(--faint-2)' }}>{t('ss_drag_hint')}</div>
            )}
            {imgSrc && (
              <button className="ub-btn" style={{ alignSelf: 'flex-start', fontSize: 11 }} onClick={() => {
                abortRef.current?.abort();
                URL.revokeObjectURL(imgSrc);
                setImgSrc(null);
                setImgFile(null);
                setImgSize(null);
                setAiErr(null);
                setResult(null);
              }}>
                {t('ss_remove_image')}
              </button>
            )}
            <input
              ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { pickImage(e.target.files?.[0]); e.currentTarget.value = ''; }}
            />
          </div>

          {imgSrc && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span className="ub-label-sm">{t('ss_image_size')}</span>
              <span style={{ fontSize: 11, color: 'var(--faint-2)' }}>
                {imgSize ? `${imgSize.w} × ${imgSize.h}` : '…'}
              </span>
              <span className="ub-label-sm" style={{ marginTop: 4 }}>{t('ss_target', { device: `${dev.label} ${dev.w}×${dev.h}` })}</span>
              <span style={{ fontSize: 10, color: 'var(--faint-2)' }}>
                {aiReady
                  ? t('ss_ai_target', { host: aiHost })
                  : t('ss_ai_unconfigured')}
              </span>
              {!aiReady && onOpenSettings && (
                <button className="ub-btn" style={{ alignSelf: 'flex-start', fontSize: 10, padding: '2px 8px', marginTop: 2 }}
                  onClick={onOpenSettings}>
                  {t('ss_ai_open_settings')}
                </button>
              )}
            </div>
          )}
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="ub-label-sm">{t('ss_json_label')}</span>
          <textarea
            className="ub-field"
            style={{ minHeight: 88, resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}
            placeholder={t('ss_json_ph')}
            spellCheck={false}
            value={json}
            onChange={e => { setJson(e.target.value); setErr(null); }}
          />
        </label>

        {err && <div style={{ fontSize: 11, color: '#dc2626' }}>{err}</div>}

        {aiErr && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#dc2626' }}>
            <span>{aiErrText}</span>
            {aiErr.kind === 'HTTP' && (
              <span style={{ color: 'var(--faint-2)' }}>{t('ss_ai_err_http_hint')}</span>
            )}
            {aiErr.raw && (
              <details open={aiErr.kind === 'HTTP'}>
                <summary style={{ cursor: 'pointer', color: 'var(--faint-2)' }}>{t('ss_ai_raw')}</summary>
                <pre style={{ margin: 0, maxHeight: 120, overflow: 'auto', fontSize: 10, whiteSpace: 'pre-wrap', color: 'var(--faint-2)' }}>
                  {aiErr.raw}
                </pre>
              </details>
            )}
          </div>
        )}

        {result && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="ub-label-sm">
                {t('ss_summary', { n: String(result.items.length), p: String(placeholderCount), space: spaceLabel })}
              </span>
              <button className="ub-btn" style={{ fontSize: 10, padding: '2px 8px' }}
                onClick={() => setEnabled(Object.fromEntries(result.items.map(i => [i.id, !allOn])))}>
                {allOn ? t('ss_select_none') : t('ss_select_all')}
              </button>
              <button className="ub-btn" style={{ fontSize: 10, padding: '2px 8px' }} onClick={selectOnlyOk}>
                {t('ss_only_ok')}
              </button>
              {warnCount > 0 && (
                <span style={{ fontSize: 10, color: '#d97706' }}>{t('ss_warn_count', { n: String(warnCount) })}</span>
              )}
            </div>
            <div className="ub-modal-list" style={{ maxHeight: 220, flexShrink: 0 }}>
              {result.items.map(i => (
                <div key={i.id} className={`ub-row${enabled[i.id] ? ' active' : ''}`}
                  onMouseEnter={() => setActiveId(i.id)}
                  style={{
                    padding: '3px 8px', gap: 6, fontSize: 11,
                    outline: activeId === i.id ? '1px solid rgba(37,99,235,.35)' : 'none',
                  }}>
                  <input
                    type="checkbox"
                    checked={Boolean(enabled[i.id])}
                    aria-label={t('ss_row_keep')}
                    onChange={() => setEnabled(prev => ({ ...prev, [i.id]: !prev[i.id] }))}
                  />
                  <select
                    className="ub-field"
                    aria-label={t('ss_row_type')}
                    title={t('ss_row_type')}
                    value={i.type}
                    onChange={e => changeType(i.id, e.target.value)}
                    style={{ width: 132, flexShrink: 0, fontSize: 10, padding: '2px 4px' }}
                  >
                    {/* 模型给的原始类型可能不在注册表里，先补一个临时项，避免下拉显示空白 */}
                    {!REGISTRY.some(m => m.type === i.type) && <option value={i.type}>{i.type}</option>}
                    {REGISTRY.map(m => (
                      <option key={m.type} value={m.type}>{moduleLabel(m)}</option>
                    ))}
                  </select>
                  <span className="ub-row-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {i.text || '—'}
                  </span>
                  <span style={{ color: TIER_COLOR[i.tier], fontVariantNumeric: 'tabular-nums' }}>
                    {i.confidence.toFixed(2)}
                  </span>
                  {i.placeholder && <span style={{ color: '#dc2626' }}>{t('ss_placeholder_tag')}</span>}
                  {!i.placeholder && i.tier === 'warn' && <span style={{ color: '#d97706' }}>{t('ss_check_tag')}</span>}
                  {i.overlapWarn && <span style={{ color: '#d97706' }}>{t('ss_overlap_tag')}</span>}
                  <button className="ub-icon-btn" title={t('ss_row_dup')} aria-label={t('ss_row_dup')}
                    style={{ marginLeft: 'auto', flexShrink: 0 }} onClick={() => duplicateRow(i.id)}>
                    <IconCopy size={12} />
                  </button>
                  <button className="ub-icon-btn" title={t('ss_row_remove')} aria-label={t('ss_row_remove')}
                    style={{ flexShrink: 0 }} onClick={() => removeRow(i.id)}>✕</button>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, position: 'sticky', bottom: 0, paddingTop: 4, background: 'var(--panel)' }}>
          <button className="ub-btn ub-btn-accent" style={{ flex: 1 }} disabled={!selected.length} onClick={land}>
            {t('ss_land', { n: String(selected.length) })}
          </button>
          <button className="ub-btn" style={{ flex: 1 }} disabled={!imgFile || (!busy && !aiReady)}
            title={aiReady ? undefined : t('ss_ai_unconfigured')}
            onClick={() => { void recognize(); }}>
            {busy ? t('ss_ai_cancel') : t('ss_recognize')}
          </button>
          <button className="ub-btn" onClick={parse}>{t('ss_parse')}</button>
          <button className="ub-btn ub-btn-ghost" onClick={onClose}>{t('settings_close')}</button>
        </div>
      </div>
    </div>
  );
}
