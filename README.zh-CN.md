# 界面搭建器（UI Builder）

> **v1.2.0** · [MIT License](./LICENSE) · [English](./README.md) · [更新记录](./CHANGELOG.md) · [交接说明 HANDOFF](./HANDOFF.md)

> **私人自用说明（重要）**
> - 本项目是**个人自用的原型搭建工具**，不是生产级多人协作产品，不承诺 SLA、安全审计或多人同时编辑。
> - 所有 API Key 只保存在**访问者本机的浏览器**（`localStorage` / `sessionStorage`），不经过任何服务器；请在自己的设备上填写，不要在公用电脑上勾选「记住密钥」。
> - 编辑器**前端直连**模型服务商、没有后端代理——这是有意设计（不托管密钥、不做配额中心），不是遗漏。

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

> 远程 AI 网关（可选）：点顶栏 **齿轮 → 设置**，填网关地址、API Key、Embedding / Reranker 模型，可一键「测试连接」。配置只存本浏览器 `localStorage`（`ui-builder:ai-settings`），**不入库、不随导出、改配置无需重新构建**；留空则 AI 建议自动回退为纯规则引擎。注意：编辑器以 https 打开时，浏览器会拦截 http 网关（混合内容）。

> 示例项目：访问 `http://localhost:5173/?demo=login` 可以示例登录页**新建一个项目**（不会覆盖已有项目；多项目见下方「项目管理」）。

## 功能总览

| 能力 | 说明 |
|---|---|
| 三栏编辑器 | 左：页面管理 + 模块库（30 模块，分类/搜索）；中：设备画板；右：AI 设计助手 + 属性面板 |
| 多设备独立设计 | 电脑 1440×900 / 手机 390×844 / 手表 200×242；每页每设备独立保存；一键「复制自」其他设备 |
| 拖拽搭建 | 库拖入、画布内自由拖动（本地预览态，抬手才落库）、八向缩放、Shift 锁比例、6px 吸附参考线、嵌套容器、模块旋转（0~359°，吸附/对齐按未旋转外接矩形近似） |
| 编辑能力 | 多选/框选/整体移动、Ctrl+C/V、Delete（快捷键与属性面板按钮）、显隐、锁定、图层顺序、撤销重做（快照栈 50 步）；批量对齐 6 向（左/右/顶/底/水平居中/垂直居中）+ 水平/垂直等距分布（同容器内生效） |
| 间距标注 | 单选元素时自动标注与同容器内相邻元素的最近间距（上下左右各取最近一条，水平/垂直重叠才标，间距 0 或重叠不标）；标注线只画在最贴近的两条边之间，拖拽/缩放/框选时自动隐藏 |
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
├─ lib/                # coords / tree（容器命中）/ snap（吸附）/ spacing（间距标注）/ projectIndex / persist / png / aiSettings（AI 设置）/ aiClient / i18n / id
├─ store/              # zustand 切片：index（组合）/ project / editor / history / actions / projects（多项目）/ types / demo
├─ modules/            # registry.ts（30 模块唯一元数据源 + 容器单源）+ renderers.tsx（编辑/预览双态）
├─ editor/             # AppShell / LeftPanel / Canvas / RightPanel / ProjectModal / ExportModal / ErrorBoundary
│  ├─ canvas/          # NodeView（memo）/ gesture（缩放+框选纯函数）/ SpacingMarks（间距标注）
│  └─ right/           # AiPanel / PropsPanel / shared（右栏拆分）
├─ ai/engine.ts        # 规则建议引擎
└─ exporter/           # React 工程 zip 生成器（slug 唯一命名 + 多页路由 + 范围裁剪）
```

## 测试

共 **162 条**（`npm test`）：

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
- `src/exporter/exporter.test.ts` — 导出端到端 12 条（zip 规格/组件齐全/未用组件裁剪/pages.json 回读/隐藏节点一致性/主题变量/TSX 引用/slug 唯一化与多页路由/设备范围/页面范围/名称转义/图片协议清洗）
- `src/exporter/scope.test.ts` — 导出范围 6 条（设备缺省回退与固定顺序去重/页面裁剪保序/未知 id 忽略/空选兜底/默认导出设备/组合）
- `src/exporter/guard.test.ts` — 漂移守卫 4 条（模板 props ⊆ 注册表；事件 key 拼法；表驱动完整性/无陈旧键）
- `src/exporter/write-zip.test.ts` — 导出 zip 落盘 1 条（双页 + navigate 场景，供人工解压做真实构建验收）
- `src/lib/png.test.ts` — 画板导图 6 条（倍率默认 2 与 1~3 钳制、NaN/Infinity 回退、文件名非法字符替换与连字符合并、空名回退 board、月日补零）
- `src/lib/spacing.test.ts` — 间距标注 7 条（四方向最近间距、重叠区中点定位、另一轴无重叠不标、同方向取最小、重叠/贴边不标、四向同时给出）
- `src/lib/sanitize.test.ts` — 输入净化 5 条（图片协议白名单与危险协议拒绝、HTML 转义、单行压缩与截断）
- `src/lib/importGuard.test.ts` — 导入体积护栏 4 条（ASCII 边界、UTF-8 多字节估算、自定义上限）
- `src/lib/aiSettings.test.ts` — AI 设置 8 条（地址归一化 / 校验 / 默认模型 / 脱敏 / 存储往返 / 记住开关双存储 / 坏 JSON 回退）

**导出工程真实构建验收**：已实测通过（zip → 解压 → `npm i` → `tsc + vite build` 绿）。

## 实现说明

- **撤销/重做**：整步快照栈（deep clone pages，上限 50 步），拖动手势 400ms 内合并为一步；拖拽/缩放过程只更新画布本地 state，抬手才写 store。
- **AI 建议**：规则引擎（5 类，纯本地计算）；远程 AI 网关（Embedding / Reranker）在「设置」里运行时配置，未配置时自动回退，应用建议走通用撤销栈。
- **旋转**：视觉层 transform；吸附、框选命中、AI 对齐按未旋转外接矩形近似。
- **错误兜底**：ErrorBoundary 包裹应用；「清空缓存并重置」会真正删除 IndexedDB 主键、迁移备份**与 AI 设置**。
- **CI**：pull_request → lint + test + build（ci.yml）；push main → Pages 部署（pages.yml）。

## 安全边界

本项目按「**本机原型工具 + 可选自配网关**」的威胁模型设计，不是多租户在线服务：

| 面 | 现状 |
|---|---|
| 密钥 | 只存本浏览器：默认 `localStorage`（`ui-builder:ai-settings`，跨会话）；取消「记住密钥」则改存 `sessionStorage`，关页即失效。不入库、不随导出；界面只显示脱敏值。**本地端点（localhost / 127.0.0.1 / *.local）可留空密钥**。公共电脑请勿填真实密钥 |
| CSP | 生产构建由 `vite.config.ts` 注入 `Content-Security-Policy`（`script-src 'self'`、`object-src 'none'`、`base-uri 'self'`，`style-src` 需 `'unsafe-inline'` 以兼容 React 内联样式）；开发环境不注入，避免打断 HMR |
| 构建参数 | 不使用 `VITE_*` 传密钥——那会被打进公开产物；仓库内不含任何网关地址/密钥（`.env*` 全部忽略） |
| 清空数据 | 「清空缓存并重置」一并清除 AI 设置，避免误以为已重置 |
| 导入 | 体积上限 5 MB（前置按字节估算 + 解析前再判一次），超限直接拒绝并给出原因 |
| 图片/外链 | 协议白名单：`http(s)` / `blob` / `data:image/*` / 相对路径；`javascript:`、`data:text/html` 等一律置空 |
| 导出产物 | 项目名/页名进 HTML 与 TSX 注释前做转义与单行压缩；props 里的 `src` 同样过协议白名单 |
| 已知残余风险 | 本地存储未加密（物理访问可读）；浏览器端请求受同源/CORS 与混合内容限制；真正的多用户隔离需要后端代理 |

## 路线

- **v1.0**：纯前端单机版；AI 规则引擎；导出 React 静态工程
- **v1.1**：事件绑定 UI（导出 navigate 真实跳页）、主题令牌编辑、预览互动、PR CI、store 切片化、漂移守卫测试
- **v1.2（当前）**：多项目管理、模板库、6 向对齐/等距分布、图层树增量、画板导出 PNG、导出范围（页面/设备）、间距标注
- **v1.3 候选**：截图转界面（上传截图 → 模型识别 → 后处理 → 勾选落画布），规划见 [docs/screenshot-to-interface.md](./docs/screenshot-to-interface.md)；模型由使用者自配（云端网关或本地 Ollama / LM Studio，本地端点免密钥）
- **已完成**：coverage 纳入 PR 门禁（阈值写在 `vite.config.ts` 的 `test.coverage.thresholds`）
- **不做**：多人协作、响应式联动、真机预览、后端逻辑（见 S1~S3 交付开关）

## 演示脚本

见 [DEMO.md](./DEMO.md)（5 分钟演示）。

## 覆盖率

运行 `npm run test:coverage`（v8 provider，仅统计核心逻辑：lib / store / ai / exporter / types）。
当前基线（2026-10-29）：**总体 语句 82% · 分支 78% · 函数 81% · 行 84%**（exporter 97% · ai/engine 96% · store/actions 69% · lib 77%，其中 png.ts 与 aiClient.ts 是 UI/网络侧、覆盖偏低）；UI 组件不计入门禁。
CI 门禁阈值为 **语句 80 / 分支 75 / 函数 79 / 行 82**（低约 2 个点留余量），低于下限 `npm run test:coverage` 直接失败。

## 贡献约定

提交信息格式：`<type>(<scope>): <摘要>`；类型 feat | fix | refactor | perf | test | docs | chore | ci，范围 canvas | store | exporter | ai | editor | docs | ci。
PR 由 ci.yml 跑 lint + `test:coverage`（含覆盖率门禁）+ build；main 推送由 pages.yml 跑 test + build 并部署 GitHub Pages。

## License

[MIT](./LICENSE) © 2026 loyu123
