# 界面搭建器（UI Builder）

> **v1.1.0** · [MIT License](./LICENSE) · [English](./README.md) · [交接说明 HANDOFF](./HANDOFF.md)

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

> 示例项目：访问 `http://localhost:5173/?demo=login` 可以示例登录页**新建一个项目**（不会覆盖已有项目；多项目见下方「项目管理」）。

## 功能总览

| 能力 | 说明 |
|---|---|
| 三栏编辑器 | 左：页面管理 + 模块库（30 模块，分类/搜索）；中：设备画板；右：AI 设计助手 + 属性面板 |
| 多设备独立设计 | 电脑 1440×900 / 手机 390×844 / 手表 200×242；每页每设备独立保存；一键「复制自」其他设备 |
| 拖拽搭建 | 库拖入、画布内自由拖动（本地预览态，抬手才落库）、八向缩放、Shift 锁比例、6px 吸附参考线、嵌套容器、模块旋转（0~359°，吸附/对齐按未旋转外接矩形近似） |
| 编辑能力 | 多选/框选/整体移动、Ctrl+C/V、Delete（快捷键与属性面板按钮）、显隐、锁定、图层顺序、撤销重做（快照栈 50 步）；批量对齐 6 向（左/右/顶/底/水平居中/垂直居中）+ 水平/垂直等距分布（同容器内生效） |
| 事件绑定 | 属性面板直接编辑 action/target/note（跳转页面/提交/返回/关闭弹层/切换/绑定接口/外链） |
| 主题面板 | 颜色 / 圆角 / 字体令牌可视化编辑，导出为 `tokens.css` 的 CSS 变量 |
| 预览模式 | 只读画布（编辑手势全禁用）+ 可互动表单（输入框/密码/多行/下拉可真实操作）+ navigate 事件页内真实跳转 + 页面切换条 |
| AI 建议（规则版） | 5 类规则：对齐/等距栅格/WCAG 对比度/字号层级/文案溢出，建议卡带数字证据，应用走撤销栈 |
| 多项目管理 | 顶栏项目名 ▾ 打开项目列表：新建 / 切换 / 重命名 / 删除（最近使用倒序）；切换前自动 flush 落盘；索引自愈（数据缺失条目自动剔除）；v1.1 单 key 数据首次启动自动迁移并留备份 |
| 模板库 | 5 套内置模板（登录页 / 消息列表 / 商品详情 / 个人中心 / 空状态），**每套同时含手机与电脑两套布局**，项目弹层内一键新建；模板由 registry 元数据构建，props 键名漂移由测试拦截 |
| 图层树 | 左栏当前画板节点树：层级缩进、点击选中（与画布双向同步并自动滚动到可视区）、名称/类型筛选、节点折叠展开、行内一键切换隐藏与锁定 |
| 数据持久化 | IndexedDB 1s 防抖自动保存（按项目分键）；schema 迁移链 + 迁移前自动备份；JSON 导入（含结构深校验，导入即成为独立项目）/导出；ErrorBoundary 一键真清空 IndexedDB |
| 导出工程 | 一键 zip：React 19 工程（30 组件 + 多页 hash 路由 + navigate 真实跳页 + tokens.css + events 接口位 + CI + verify.sh），`data/pages.json` 为可再导入的事实源；页面组件名为稳定 ASCII slug；导出前可选**范围**（勾选页面 / 设备，未勾选的不进 zip，pages.json 同步收窄） |
| 画板导图 | 顶栏「导出 PNG」把当前画板存成 2 倍图：零依赖链路（DOM → SVG `foreignObject` → canvas → blob），抓取前先清空选中避免选中框入画，文件名 `项目-页面-设备-日期.png`；跨域图片导致编码失败时 toast 提示 |

## 目录

```
src/
├─ types.ts            # 数据模型（Node/Board/Page/Project）+ 运行时校验（isProject/isValidProject）
├─ lib/                # coords / tree（容器命中）/ snap（吸附）/ projectIndex（多项目索引）/ persist / i18n / id / aiClient
├─ store/              # zustand 切片：index（组合）/ project / editor / history / actions / projects（多项目）/ types / demo
├─ modules/            # registry.ts（30 模块唯一元数据源 + 容器单源）+ renderers.tsx（编辑/预览双态）
├─ editor/             # AppShell / LeftPanel / Canvas / RightPanel / ProjectModal / ErrorBoundary
│  ├─ canvas/          # NodeView（memo 单节点渲染）/ gesture（缩放+框选纯函数）
│  └─ right/           # AiPanel / PropsPanel / shared（右栏拆分）
├─ ai/engine.ts        # 规则建议引擎
└─ exporter/           # React 工程 zip 生成器（slug 唯一命名 + 多页路由）
```

## 测试

共 **135 条**（`npm test`）：

- `src/lib/coords.test.ts` — 坐标换算 6 条（zoom/嵌套/滚动，硬约束）
- `src/lib/snap.test.ts` — 吸附匹配 4 条（最近候选/阈值/多边整体最优）
- `src/lib/tree.test.ts` — 树工具 12 条（最深容器命中/空白/exclude/防自嵌套/子树集合/绝对原点；图层树扁平化、折叠、名称过滤与父链保留）
- `src/lib/persist.test.ts` — IndexedDB 4 条（往返/空库/v1→v2 迁移/clearAll，fake-indexeddb）
- `src/lib/persist.projects.test.ts` — 多项目持久化 6 条（索引登记与当前项/改名排序/v1.1 单 key 迁移+备份/索引自愈/删除/清空）
- `src/lib/projectIndex.test.ts` — 多项目索引纯函数 7 条（脏数据容错/失效 currentId/排序去重/删除回退/批量剔除/旧数据升级）
- `src/store/projects.test.ts` — 多项目 store 流程 4 条（新建入库/切换前 flush 落盘/改名同步索引/删除当前项与最后一项保护）
- `src/lib/align.test.ts` — 对齐/分布 11 条（公共外接矩形、6 向对齐、只改目标轴、等距分布/幂等/四节点/重叠负间距）
- `src/lib/i18n.test.ts` — i18n 5 条（zh/en 键一致/回退链/占位/语言切换）
- `src/templates/templates.test.ts` — 模板库 13 条（清单完整性、每套模板结构合法、模块类型在注册表、props 键合法、默认事件、实例独立）
- `src/editor/canvas/gesture.test.ts` — 手势纯函数 10 条（八向缩放/最小值钳制/Shift 锁比例/框选命中与边界相切）
- `src/ai/engine.test.ts` — AI 规则 7 条（5 类规则正反例，含 WCAG 通道解析回归）
- `src/store/store.test.ts` — store 回归 18 条（30 模块增删、撤销合并、重挂载、复制粘贴、属性、页面、导入深校验、旋转、事件/主题、分级快照、边界用例、性能冒烟）
- `src/exporter/exporter.test.ts` — 导出端到端 10 条（zip 规格/组件齐全/未用组件裁剪/pages.json 回读/隐藏节点一致性/主题变量/TSX 引用/slug 唯一化与多页路由/设备范围/页面范围）
- `src/exporter/scope.test.ts` — 导出范围 6 条（设备缺省回退与固定顺序去重/页面裁剪保序/未知 id 忽略/空选兜底/默认导出设备/组合）
- `src/exporter/guard.test.ts` — 漂移守卫 4 条（模板 props ⊆ 注册表；事件 key 拼法；表驱动完整性/无陈旧键）
- `src/exporter/write-zip.test.ts` — 导出 zip 落盘 1 条（双页 + navigate 场景，供人工解压做真实构建验收）
- `src/lib/png.test.ts` — 画板导图 6 条（倍率默认 2 与 1~3 钳制、NaN/Infinity 回退、文件名非法字符替换与连字符合并、空名回退 board、月日补零）

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
基线（2026-10-27，tree/actions 补测后）：**exporter 97% · ai/engine 96% · lib 整体 71%（tree.ts/snap.ts 100% 行覆盖）· store/actions 69%**；UI 组件不计入门禁。

## 贡献约定

提交信息格式：`<type>(<scope>): <摘要>`；类型 feat | fix | refactor | perf | test | docs | chore | ci，范围 canvas | store | exporter | ai | editor | docs | ci。
PR 由 ci.yml 跑 lint + test + build；main 推送由 pages.yml 部署 GitHub Pages；coverage 仅本地 `npm run test:coverage`，不作为 CI 门禁。

## License

[MIT](./LICENSE) © 2026 loyu123
