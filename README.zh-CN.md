# 界面搭建器（UI Builder）

> **v1.1.0** · [MIT License](./LICENSE) · [English](./README.md)

可视化 UI 搭建工具：空白画布 + 拖拽模块 → 多设备界面设计 → 事件绑定 / 主题 / 功能备注 → 一键导出可交互的 React 多页工程。

**技术栈：** React 19 + TypeScript + Vite + dnd-kit + zustand/immer + IndexedDB（idb-keyval）+ JSZip。

## 快速开始

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 自动化测试（vitest run；watch 用 npm run test:watch）
npm run lint       # oxlint
npm run build      # 生产构建
```

> 本地 AI 网关（可选）：复制 `.env.example` 为 `.env` 并填入地址与密钥。`.env` 已被 gitignore，密钥不入库；未配置时 AI 建议自动回退为纯规则引擎。

> 示例项目：访问 `http://localhost:5173/?demo=login` 可一键灌入完整登录页示例设计（覆盖当前画布）。

## 功能总览

| 能力 | 说明 |
|---|---|
| 三栏编辑器 | 左：页面管理 + 模块库（30 模块，分类/搜索）；中：设备画板；右：AI 设计助手 + 属性面板 |
| 多设备独立设计 | 电脑 1440×900 / 手机 390×844 / 手表 200×242；每页每设备独立保存；一键「复制自」其他设备 |
| 拖拽搭建 | 库拖入、画布内自由拖动（本地预览态，抬手才落库）、八向缩放、Shift 锁比例、6px 吸附参考线、嵌套容器、模块旋转（0~359°，吸附/对齐按未旋转外接矩形近似） |
| 编辑能力 | 多选/框选/整体移动、Ctrl+C/V、Delete（快捷键与属性面板按钮）、显隐、锁定、图层顺序、撤销重做（快照栈 50 步） |
| 事件绑定 | 属性面板直接编辑 action/target/note（跳转页面/提交/返回/关闭弹层/切换/绑定接口/外链） |
| 主题面板 | 颜色 / 圆角 / 字体令牌可视化编辑，导出为 `tokens.css` 的 CSS 变量 |
| 预览模式 | 只读画布（编辑手势全禁用）+ 可互动表单（输入框/密码/多行/下拉可真实操作）+ navigate 事件页内真实跳转 + 页面切换条 |
| AI 建议（规则版） | 5 类规则：对齐/等距栅格/WCAG 对比度/字号层级/文案溢出，建议卡带数字证据，应用走撤销栈 |
| 数据持久化 | IndexedDB 1s 防抖自动保存；schema 迁移链 + 迁移前自动备份；JSON 导入（含结构深校验）/导出；ErrorBoundary 一键真清空 IndexedDB |
| 导出工程 | 一键 zip：React 19 工程（30 组件 + 多页 hash 路由 + navigate 真实跳页 + tokens.css + events 接口位 + CI + verify.sh），`data/pages.json` 为可再导入的事实源；页面组件名为稳定 ASCII slug |

## 目录

```
src/
├─ types.ts            # 数据模型（Node/Board/Page/Project）+ 运行时校验（isProject/isValidProject）
├─ lib/                # coords（坐标换算）/ tree（容器命中）/ persist（持久化+迁移+clearAll）/ id / aiClient
├─ store/              # zustand 切片：project / editor / history / actions（types 集中定义）
├─ modules/            # registry.ts（30 模块唯一元数据源 + 容器单源）+ renderers.tsx（编辑/预览双态）
├─ editor/             # AppShell / LeftPanel / Canvas / RightPanel / ErrorBoundary
├─ ai/engine.ts        # 规则建议引擎
└─ exporter/           # React 工程 zip 生成器（slug 唯一命名 + 多页路由）
```

## 测试

共 **34 条**（`npm test`）：

- `src/lib/coords.test.ts` — 坐标换算 6 条（zoom/嵌套/滚动，硬约束）
- `src/ai/engine.test.ts` — AI 规则 7 条（5 类规则正反例，含 WCAG 通道解析回归）
- `src/store/store.test.ts` — store 回归 12 条（30 模块增删、撤销合并、重挂载、复制粘贴、属性、页面、导入深校验、旋转、事件/主题、分级快照、性能冒烟）
- `src/exporter/exporter.test.ts` — 导出端到端 6 条（zip 规格/组件齐全/未用组件裁剪/pages.json 回读/TSX 引用/slug 唯一化与多页路由）
- `src/exporter/guard.test.ts` — 漂移守卫 2 条（模板 props ⊆ 注册表；事件 key 拼法）
- `src/exporter/write-zip.test.ts` — 导出 zip 落盘 1 条（双页 + navigate 场景，供人工解压做真实构建验收）

**导出工程真实构建验收**：已实测通过（zip → 解压 → `npm i` → `tsc + vite build` 绿）。

## 实现说明

- **撤销/重做**：整步快照栈（deep clone pages，上限 50 步），拖动手势 400ms 内合并为一步；拖拽/缩放过程只更新画布本地 state，抬手才写 store。
- **AI 建议**：规则引擎（5 类，纯本地计算）；`.env` 预留远程 AI 网关管道，未配置时自动回退，应用建议走通用撤销栈。
- **旋转**：视觉层 transform；吸附、框选命中、AI 对齐按未旋转外接矩形近似。
- **错误兜底**：ErrorBoundary 包裹应用；「清空缓存并重置」会真正删除 IndexedDB 主键与迁移备份。
- **CI**：pull_request → lint + test + build（ci.yml）；push main → Pages 部署（pages.yml）。

## 路线

- **v1.0**：纯前端单机版；AI 规则引擎；导出 React 静态工程
- **v1.1（当前）**：事件绑定 UI（导出 navigate 真实跳页）、主题令牌编辑、预览互动、PR CI、store 切片化、漂移守卫测试
- **后续**：可选远程 AI（embed/rerank 本地网关）、coverage 基线、图层树
- **不做**：多人协作、响应式联动、真机预览、后端逻辑（见 S1~S3 交付开关）

## 演示脚本

见 [DEMO.md](./DEMO.md)（5 分钟演示）。

## 覆盖率

运行 `npm run test:coverage`（v8 provider，仅统计核心逻辑：lib / store / ai / exporter / types）。
基线（2026-10-27）：**exporter 97% · ai/engine 96% · history/project/index 94~100% · persist 85% · store actions 67% · lib 整体 53%（tree.ts 容器命中路径待补）**；UI 组件不计入门禁。

## License

[MIT](./LICENSE) © 2026 loyu123
