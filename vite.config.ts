/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages 项目页部署时使用 /ui-builder/ 子路径（CI 设置 GITHUB_PAGES=1）
const base = process.env.GITHUB_PAGES ? '/ui-builder/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  test: {
    // P3-35 · coverage 基线：核心逻辑目录（纯函数/切片/AI/导出），UI 组件暂不计入
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/store/**', 'src/ai/**', 'src/exporter/**', 'src/types.ts'],
      exclude: ['**/*.test.ts', 'src/store/demo.ts'],
    },
  },
})
