// LB-02~06 · 30 个模块渲染器（纯展示 + 局部交互态）
// 纪律：交互态（开关/页签/眼睛）用本地 useState，不写 store；store 只存设计
import { useState } from 'react';
import type { Node } from '../types';

function safeNum(v: unknown, d = 0): number { return typeof v === 'number' ? v : d; }

export function ModuleRenderer({ node, interactive = false }: { node: Node; interactive?: boolean }) {
  const s = node.style as React.CSSProperties;
  const p = node.props;

  switch (node.type) {
    // —— 基础容器 ——
    case 'page':
    case 'group':
    case 'card':
      return <div style={{ width: '100%', height: '100%', ...s }} />;
    case 'divider':
      return <div style={{ width: '100%', height: '100%', minHeight: 1, ...s }} />;

    // —— 文字与媒体 ——
    case 'heading':
      return <div style={{ width: '100%', overflow: 'hidden', ...s }}>{String(p.text ?? '')}</div>;
    case 'paragraph':
      return <div style={{ width: '100%', overflow: 'hidden', ...s }}>{String(p.text ?? '')}</div>;
    case 'image':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 12, ...s }}>
          {p.src ? <img src={String(p.src)} alt={String(p.alt ?? '')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `🖼 ${String(p.alt ?? '图片')}`}
        </div>
      );
    case 'icon':
      return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', ...s }}>{String(p.glyph ?? '★')}</div>;
    case 'avatar': {
      const name = String(p.name ?? '');
      return (
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...s }}>
          {p.src ? <img src={String(p.src)} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : name.charAt(0) || '?'}
        </div>
      );
    }

    // —— 表单输入（interactive：预览模式渲染真表单控件，可输入/可选） ——
    case 'input':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, border: '1px solid #e5e7eb', padding: '0 10px', boxSizing: 'border-box', ...s }}>
          {p.label ? <span style={{ fontSize: 11, color: '#6b7280' }}>{String(p.label)}</span> : null}
          {interactive ? (
            <input
              placeholder={String(p.placeholder ?? '')}
              onPointerDown={e => e.stopPropagation()}
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: '#374151', width: '100%', padding: 0 }}
            />
          ) : (
            <span style={{ color: '#9ca3af' }}>{String(p.placeholder ?? '')}</span>
          )}
        </div>
      );
    case 'password':
      return <PasswordModule node={node} style={s} interactive={interactive} />;
    case 'textarea':
      return interactive ? (
        <textarea
          placeholder={String(p.placeholder ?? '')}
          onPointerDown={e => e.stopPropagation()}
          style={{ width: '100%', height: '100%', border: '1px solid #e5e7eb', padding: 8, boxSizing: 'border-box', color: '#374151', fontSize: 13, resize: 'none', outline: 'none', ...s }}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', border: '1px solid #e5e7eb', padding: 8, boxSizing: 'border-box', color: '#9ca3af', overflow: 'hidden', ...s }}>
          {String(p.placeholder ?? '')}
        </div>
      );
    case 'select': {
      const opts = String(p.options ?? '').split(',').filter(Boolean);
      return interactive ? (
        <select
          defaultValue=""
          onPointerDown={e => e.stopPropagation()}
          style={{ width: '100%', height: '100%', border: '1px solid #e5e7eb', padding: '0 8px', boxSizing: 'border-box', color: '#374151', fontSize: 13, background: '#fff', outline: 'none', ...s }}
        >
          <option value="" disabled>{opts[0] || '请选择'}</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <div style={{ width: '100%', height: '100%', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', boxSizing: 'border-box', ...s }}>
          <span style={{ color: '#374151' }}>{opts[0] || '请选择'}</span>
          <span style={{ color: '#9ca3af' }}>▾</span>
        </div>
      );
    }
    case 'switch':
      return <SwitchModule node={node} />;

    // —— 操作与导航 ——
    case 'button-primary':
    case 'button-secondary':
      return (
        <button style={{ width: '100%', height: '100%', border: 'none', cursor: 'default', ...s }}>
          {String(p.label ?? '按钮')}
        </button>
      );
    case 'link':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', ...s }}>
          <span style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>{String(p.label ?? '')}</span>
          <span style={{ marginLeft: 4 }}>›</span>
        </div>
      );
    case 'tabbar':
      return <TabbarModule node={node} style={s} />;
    case 'topnav':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: '0 12px', boxSizing: 'border-box', gap: 10, borderBottom: '1px solid #e5e7eb', ...s }}>
          <span style={{ fontSize: 16 }}>‹</span>
          <span style={{ flex: 1, textAlign: 'center' }}>{String(p.title ?? '')}</span>
          <span style={{ width: 16 }} />
        </div>
      );

    // —— 数据展示 ——
    case 'list-item':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', boxSizing: 'border-box', borderBottom: '1px solid #f3f4f6', ...s }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f3f4f6', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{String(p.title ?? '')}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(p.subtitle ?? '')}</div>
          </div>
          <span style={{ color: '#d1d5db' }}>›</span>
        </div>
      );
    case 'table': {
      const rows = Math.max(1, safeNum(p.rows, 3));
      return (
        <div style={{ width: '100%', height: '100%', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box', ...s }}>
          <div style={{ display: 'flex', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            {['列A', '列B', '列C'].map(h => <div key={h} style={{ flex: 1, padding: '6px 8px', fontWeight: 600 }}>{h}</div>)}
          </div>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} style={{ display: 'flex', borderBottom: '1px solid #f3f4f6', flex: 1, alignItems: 'center' }}>
              {['—', '—', '—'].map((c, j) => <div key={j} style={{ flex: 1, padding: '4px 8px', color: '#9ca3af' }}>{c}</div>)}
            </div>
          ))}
        </div>
      );
    }
    case 'stat':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 14px', boxSizing: 'border-box', gap: 4, boxShadow: 'inset 0 0 0 1px #e5e7eb', ...s }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{String(p.label ?? '')}</span>
          <span style={{ fontSize: 26, fontWeight: 700 }}>
            {String(p.value ?? '')}<span style={{ fontSize: 13, fontWeight: 400, color: '#6b7280', marginLeft: 3 }}>{String(p.unit ?? '')}</span>
          </span>
        </div>
      );
    case 'progress': {
      const v = Math.min(100, Math.max(0, safeNum(p.value, 0)));
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 10, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }}>
            <div style={{ width: `${v}%`, height: '100%', background: '#2563eb', borderRadius: 999 }} />
          </div>
          <span style={{ fontSize: 11, color: '#6b7280' }}>{v}%</span>
        </div>
      );
    }

    // —— 社交与通知 ——
    case 'message-bubble': {
      const right = p.side === 'right';
      const radius = safeNum(node.style.radius, 12);
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: right ? 'flex-end' : 'flex-start', alignItems: 'center' }}>
          <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: radius, background: right ? '#2563eb' : (s.background as string), color: right ? '#fff' : (s.color as string), fontSize: s.fontSize, boxSizing: 'border-box' }}>
            {String(p.text ?? '')}
          </div>
        </div>
      );
    }
    case 'comment':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', gap: 8, padding: 8, boxSizing: 'border-box', ...s }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f3f4f6', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ fontSize: 12 }}>{String(p.name ?? '')}</b>
            <div style={{ overflow: 'hidden' }}>{String(p.text ?? '')}</div>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>回复</span>
          </div>
        </div>
      );
    case 'notification':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', boxSizing: 'border-box', ...s }}>
          <span>🔔</span>
          <span style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{String(p.text ?? '')}</span>
          <span style={{ opacity: .6 }}>✕</span>
        </div>
      );

    // —— 设备专用 ——
    case 'mobile-statusbar':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', boxSizing: 'border-box', ...s }}>
          <b>{String(p.time ?? '9:41')}</b>
          <span style={{ fontSize: 11 }}>📶 🔋</span>
        </div>
      );
    case 'home-indicator':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', ...s }}>
          <div style={{ width: 134, height: 5, borderRadius: 999, background: '#111827', opacity: .85 }} />
        </div>
      );
    case 'watch-face':
      return (
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', ...s }}>
          <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{String(p.time ?? '10:08')}</div>
          <div style={{ fontSize: 10, opacity: .6, marginTop: 2 }}>♡ 72</div>
        </div>
      );
    case 'watch-list-row':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: '0 10px', boxSizing: 'border-box', borderRadius: 8, gap: 6, ...s }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: '#2563eb' }} />
          <span style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>{String(p.text ?? '')}</span>
        </div>
      );

    default:
      return <div style={{ width: '100%', height: '100%', ...s }}>{node.type}</div>;
  }
}

// —— 带局部交互态的模块 ——

function PasswordModule({ node, style, interactive = false }: { node: Node; style: React.CSSProperties; interactive?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, border: '1px solid #e5e7eb', padding: '0 10px', boxSizing: 'border-box', ...style }}>
      {node.props.label ? <span style={{ fontSize: 11, color: '#6b7280' }}>{String(node.props.label)}</span> : null}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {interactive ? (
          <input
            type={show ? 'text' : 'password'}
            placeholder={String(node.props.placeholder ?? '')}
            onPointerDown={e => e.stopPropagation()}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: '#374151', width: '100%', padding: 0, letterSpacing: show ? 0 : 2 }}
          />
        ) : (
          <span style={{ color: '#9ca3af', letterSpacing: show ? 0 : 2 }}>
            {show ? String(node.props.placeholder ?? '') : '••••••'}
          </span>
        )}
        <span
          onClick={e => { e.stopPropagation(); setShow(v => !v); }}
          style={{ cursor: 'pointer', fontSize: 12, flexShrink: 0, marginLeft: 4 }}
        >👁</span>
      </div>
    </div>
  );
}

function SwitchModule({ node }: { node: Node }) {
  const [on, setOn] = useState(Boolean(node.props.on ?? true));
  return (
    <div
      onClick={e => { e.stopPropagation(); setOn(v => !v); }}
      style={{
        width: '100%', height: '100%', maxWidth: 52, borderRadius: 999,
        background: on ? '#2563eb' : '#d1d5db', position: 'relative',
        cursor: 'pointer', transition: 'background .15s',
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: on ? 'calc(100% - 24px)' : 2,
        width: 24, height: 24, borderRadius: '50%', background: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .15s',
      }} />
    </div>
  );
}

function TabbarModule({ node, style }: { node: Node; style: React.CSSProperties }) {
  const tabs = String(node.props.tabs ?? '首页,发现,我的').split(',').filter(Boolean);
  const [active, setActive] = useState(0);
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', borderTop: '1px solid #e5e7eb', ...style }}>
      {tabs.map((t, i) => (
        <div
          key={i}
          onClick={e => { e.stopPropagation(); setActive(i); }}
          style={{
            flex: 1, textAlign: 'center', cursor: 'pointer',
            color: i === active ? '#2563eb' : (style.color as string),
            fontWeight: i === active ? 700 : 400,
          }}
        >
          {t}
        </div>
      ))}
    </div>
  );
}
