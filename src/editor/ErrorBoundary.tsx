// WS-05 · 错误边界：渲染异常不白屏，提供刷新/清缓存出口
// P1-18 · 分级：外层（App）全页 fallback；compact 模式用于右栏/画布等局部区域，
// 局部崩溃只显示占位卡 + 重试（重挂载子组件），不拖死整个编辑器。
import { Component, type ReactNode } from 'react';
import { clearAll } from '../lib/persist';

interface State { error: Error | null; resetKey: number }

export class ErrorBoundary extends Component<{ children: ReactNode; compact?: boolean; label?: string }, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): State {
    return { error, resetKey: 0 };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (this.state.error) {
      if (this.props.compact) {
        // 局部边界：轻量占位 + 重试（换 key 强制重挂载子树）
        return (
          <div style={{
            padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 8, minHeight: 120,
            background: '#eff6ff', border: '1px dashed #fdba74', borderRadius: 10,
            fontSize: 12, color: '#9a3412',
          }}>
            <span>⚠️ {this.props.label ?? '此面板'}渲染出错，其余功能不受影响</span>
            <button
              onClick={() => this.setState(s => ({ error: null, resetKey: s.resetKey + 1 }))}
              style={{ border: '1px solid #fdba74', background: '#fff', color: '#1d4ed8', borderRadius: 8, padding: '5px 16px', fontSize: 12, cursor: 'pointer' }}>
              重试
            </button>
          </div>
        );
      }
      return (
        <div style={{
          height: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14,
          fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
          background: '#faf9f7', color: '#1f2328',
        }}>
          <div style={{ fontSize: 40 }}>🛠️</div>
          <b style={{ fontSize: 17 }}>编辑器遇到错误，已停止渲染</b>
          <div style={{ fontSize: 12, color: '#6b7280', maxWidth: 480, textAlign: 'center', lineHeight: 1.7 }}>
            你的设计数据保存在浏览器本地（IndexedDB），通常不会丢失。
            请先尝试刷新；若反复出现，可在控制台查看错误详情并反馈。
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => window.location.reload()}
              style={{ border: 'none', background: 'var(--accent)', color: '#fff', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>
              刷新页面
            </button>
            <button onClick={() => { void clearAll().then(() => window.location.reload()); }}
              style={{ border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>
              清空缓存并重置
            </button>
          </div>
          <pre style={{ fontSize: 10, color: '#a8a199', background: '#f0ede8', padding: 10, borderRadius: 8, maxWidth: 560, overflow: 'auto' }}>
{this.state.error.message}
          </pre>
        </div>
      );
    }
    return <ErrorKey key={this.state.resetKey}>{this.props.children}</ErrorKey>;
  }
}

// resetKey 变化时强制重挂载子树（compact 重试用）
function ErrorKey({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
