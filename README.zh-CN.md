# 界面搭建器（UI Builder）

> **v1.0.0** · [MIT License](./LICENSE) · [English](./README.md)

可视化 UI 搭建工具：空白画布 + 拖拽模块 → 多设备界面设计 → 模块功能备注/事件接口位 → 一键导出 React 工程。

**技术栈：** React 19 + TypeScript + Vite + dnd-kit + zustand/immer + IndexedDB（idb-keyval）+ JSZip。

## 快速开始

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 自动化测试（坐标 / 回归 / 导出端到端）
npm run build      # 生产构建
```

> 本地 AI 网关（可选）：复制 `.env.example` 为 `.env` 并填入地址与密钥。`.env` 已被 gitignore，密钥不入库；未配置时 AI 建议自动回退为纯规则引擎。

## 功能总览

| 能力 | 说明 |
|---|---|
| 三栏编辑器 | 左：页面管理 + 模块库（30 模块，7 类，搜索/设备过滤）；中：设备画板；右：属性面板 + AI 检查 |
| 多设备独立设计 | 电脑 1440×900 / 手机 390×844 / 手表 200×242；每页每设备独立保存；一键「复制自」其他设备 |
| 拖拽搭建 | 库拖入、画布内自由拖动、八向缩放、6px 吸附参考线、嵌套容器（卡片/分组） |
| 编辑能力 | 多选/框选/整体移动、Ctrl+C/V、Delete、显隐、锁定、图层顺序、撤销重做（快照栈 50 步） |
| 属性面板 | 注册表驱动：文案/颜色/字号/圆角等 + 位置尺寸数值输入，实时写回 |
| 事件接口位 | 每模块 events 结构（navigate/submit/...），编辑器只读展示，导出工程生成 `fire(key)` 接口位 |
| AI 建议（规则版） | 5 类规则：对齐/等距栅格/WCAG 对比度/字号层级/文案溢出，建议卡带数字证据，应用走撤销栈 |
| 数据持久化 | IndexedDB 1s 防抖自动保存；schema 迁移链 + 迁移前自动备份；JSON 导入/导出 |
| 导出工程 | 一键 zip：完整 React 工程（30 组件 + 按页面/设备生成的页面 + tokens.css + events 接口位 + CI + verify.sh），`data/pages.json` 为可再导入的事实源 |

## 目录

```
src/
├─ types.ts            # 数据模型（Node/Board/Page/Project）
├─ lib/                # coords（坐标换算，6 单测）/ tree（容器命中）/ persist（持久化+迁移）/ id / aiClient
├─ store/              # zustand：project/editor/history 切片（含回归测试）
├─ modules/            # registry.ts（30 模块唯一元数据源）+ renderers.tsx
├─ editor/             # AppShell / LeftPanel / Canvas / RightPanel / ErrorBoundary
├─ ai/engine.ts        # 规则建议引擎
└─ exporter/           # React 工程 zip 生成器（含端到端测试）
```

## 测试

共 **20 条**（`npm test`）：

- `src/lib/coords.test.ts` — 坐标换算 6 条（zoom/嵌套/滚动，硬约束）
- `src/store/store.test.ts` — 回归 9 条（30 模块增删、撤销合并、重挂载、复制粘贴、属性、页面、导入、性能冒烟）
- `src/exporter/exporter.test.ts` — 导出端到端 4 条（zip 规格/组件齐全/pages.json 回读/TSX 引用）
- `src/exporter/write-zip.test.ts` — 导出 zip 落盘 1 条（供人工解压做真实构建验收）

**导出工程真实构建验收**：已实测通过（zip → 解压 → `npm i` → `tsc + vite build` 绿 → `vite preview` HTTP 200）。

## 实现说明

- **撤销/重做**：整步快照栈（deep clone pages，上限 50 步），拖动手势 400ms 内合并为一步。未采用 immer patches（方案中的可选项），内存足够且实现简单；后续如需细粒度历史可切换 patches。
- **AI 建议**：v1 为规则引擎（5 类规则，纯本地计算）；本地 `.env` 已预留远程 AI 网关（embed/rerank）管道，未配置时自动回退，建议应用走通用撤销栈。
- **错误兜底**：`ErrorBoundary` 包裹应用，渲染异常不白屏，提供刷新/清缓存出口。

## 路线

- **v1（当前）**：纯前端单机版；AI 为规则引擎；导出为 React 静态工程
- **v1.1**：事件绑定 UI、多页路由模板、远程 AI 增强（embed/rerank 语义建议，走本地网关）
- **不做**：多人协作、响应式联动、真机预览、后端逻辑（见 S1~S3 交付开关）

## 演示脚本

见 [DEMO.md](./DEMO.md)（5 分钟演示）。

## License

[MIT](./LICENSE) © 2026 loyu123
