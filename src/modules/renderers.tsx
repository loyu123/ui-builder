// 模块渲染器（纯展示；带状态模块 W3 再加本地 useState）
import type * as React from 'react';
import type { Node } from '../types';

export function ModuleRenderer({ node }: { node: Node }) {
  const s = node.style as React.CSSProperties;
  switch (node.type) {
    case 'button-primary':
      return (
        <button
          style={{ width: '100%', height: '100%', border: 'none', cursor: 'default', ...s }}
        >
          {String(node.props.label ?? '按钮')}
        </button>
      );
    case 'heading':
      return <div style={{ width: '100%', ...s }}>{String(node.props.text ?? '')}</div>;
    case 'paragraph':
      return <div style={{ width: '100%', ...s }}>{String(node.props.text ?? '')}</div>;
    case 'input':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, ...s }}>
          {node.props.label ? (
            <span style={{ fontSize: 12, color: '#6b7280' }}>{String(node.props.label)}</span>
          ) : null}
          <span style={{ color: '#9ca3af' }}>{String(node.props.placeholder ?? '')}</span>
        </div>
      );
    case 'card':
      return <div style={{ width: '100%', height: '100%', ...s }} />;
    default:
      return <div style={{ width: '100%', height: '100%', ...s }}>{node.type}</div>;
  }
}
