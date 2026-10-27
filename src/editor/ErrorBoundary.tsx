// WS-05 · 错误边界：渲染异常不白屏，提供刷新/清缓存出口
import { Component, type ReactNode } from 'react';
import { clearAll } from '../lib/persist';

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (this.state.error) {
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
              style={{ border: 'none', background: '#f97316', color: '#fff', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>
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
    return this.props.children;
  }
}
