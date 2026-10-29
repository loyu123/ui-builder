/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// GitHub Pages 项目页部署时使用 /ui-builder/ 子路径（CI 设置 GITHUB_PAGES=1）
const base = process.env.GITHUB_PAGES ? '/ui-builder/' : '/'

/**
 * SEC-05 · 只在生产构建里注入 CSP（开发环境不注入：Vite HMR 需要内联脚本与 ws 连接）
 * - style-src 必须允许 'unsafe-inline'：React 大量使用 style 属性
 * - connect-src 放开 http(s)：AI 网关地址由用户在设置里自定义
 * - img-src 放开 http(s)/data/blob：画板可引用外链图，PNG 导出走 blob URL
 */
function cspMeta(): Plugin {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data:",
    "connect-src 'self' https: http:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ')
  return {
    name: 'ub-csp-meta',
    apply: 'build',
    transformIndexHtml: html => ({
      html,
      tags: [{
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: csp },
        injectTo: 'head-prepend',
      }],
    }),
  }
}

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), cspMeta()],
  test: {
    // P3-35 · coverage 基线：核心逻辑目录（纯函数/切片/AI/导出），UI 组件暂不计入
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/store/**', 'src/ai/**', 'src/exporter/**', 'src/types.ts'],
      exclude: ['**/*.test.ts', 'src/store/demo.ts'],
      // CI 门禁：比当前实测基线（stmts 82 / branch 78 / funcs 81 / lines 84）低约 2 个点，
      // 留出重构与新增未测代码的余量；只做回归下限，不追高。
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 79,
        lines: 82,
      },
    },
  },
})
