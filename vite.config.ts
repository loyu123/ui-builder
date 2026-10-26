import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages 项目页部署时使用 /ui-builder/ 子路径（CI 设置 GITHUB_PAGES=1）
const base = process.env.GITHUB_PAGES ? '/ui-builder/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
})
