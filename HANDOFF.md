# HANDOFF · ui-builder 交接说明

> 面向接手者：先读这份，再读 `README.zh-CN.md`（功能清单/测试清单）与 `DEMO.md`（演示路径）。
> 最后更新：2026-10-29（v1.2.1 发布）

## 1. 现在是什么状态

- 版本线：v1.1.0 已发布；v1.2.0 功能全部落地（多项目 / 模板 / 对齐 / 图层树 / 画板导图 / 导出范围 / 间距标注），版本号与 CHANGELOG 已更新，剩 Pages 部署线上回归。
- 质量门：**162 条单测全绿**、`oxlint` 0 warning、`tsc --noEmit` 干净、`vite build` 绿。CI（lint + test + build）为合并前提。
- 纯前端单机应用：无后端、无账号、数据全在浏览器 IndexedDB。

## 2. 怎么跑起来

开发环境在 **WSL distro `UIBuilder`**，仓库路径 `/home/dev/ui-builder`（Windows 侧可见为 `\\wsl$\UIBuilder\home\dev\ui-builder`）。

```bash
cd /home/dev/ui-builder
npm install          # 首次
npm run dev          # http://localhost:5173
npm test             # vitest run（162 条）
npm run lint         # oxlint
npm run build        # tsc -b && vite build
```

后台常驻启动（本机习惯）：

```bash
setsid nohup npm run dev > /tmp/dev.log 2>&1 &
```

Windows 侧直接改文件再跑命令：`wsl -d UIBuilder -- bash -lc "cd /home/dev/ui-builder && npx vitest run"`。

## 3. 代码地图

```
src/
├─ types.ts                 数据模型（Project / Page / Board 扁平 nodes 字典 / Node）
├─ store/
│  ├─ index.ts              组装 zustand store；DEVICES 常量与设备尺寸
│  ├─ project.ts            当前项目的增删改（immer）
│  ├─ editor.ts             选中、缩放、平移、当前页/设备、编辑态
│  ├─ history.ts            分级快照撤销栈（50 步，full/light）
│  ├─ actions.ts            对外 action 集合（组件只调这里）
│  ├─ projects.ts           F1 多项目切片（列表 + 切换/改名/删除 + 落盘 flush）
│  └─ demo.ts               ?demo=login 示例项目
├─ editor/
│  ├─ AppShell.tsx          顶栏 + 三栏 + 弹层（项目 / 导出范围）+ toast
│  ├─ Canvas.tsx            画板、手势、参考线、框选、拖入落位
│  ├─ ExportModal.tsx       F8 导出范围弹层（页面 / 设备勾选）
│  ├─ SettingsModal.tsx     SET-01 设置弹层（AI 网关 / Embedding / Reranker / 测试连接）
│  ├─ canvas/NodeView.tsx   单节点渲染（memo）
│  ├─ canvas/gesture.ts     缩放/框选纯函数（可单测）
│  ├─ canvas/SpacingMarks.tsx  F10 间距标注渲染（纯展示）
│  ├─ LeftPanel.tsx         页面列表 + 图层树 + 模块库
│  ├─ RightPanel.tsx        右栏容器
│  └─ right/                AiPanel / PropsPanel / shared（样式与 JSON 导入导出）
├─ modules/                 30 个模块的注册表（registry）与渲染器
├─ templates/               5 套内置模板（registry 驱动，手机 + 电脑两套布局）
├─ ai/engine.ts             规则版建议引擎（对齐/栅格/对比度/字号/溢出）
├─ lib/
│  ├─ coords.ts             屏幕坐标 → 画板坐标（zoom/嵌套/滚动）
│  ├─ tree.ts               树遍历、最深命中、图层树扁平化
│  ├─ snap.ts               吸附候选匹配
│  ├─ align.ts              6 向对齐 + 等距分布
│  ├─ spacing.ts            F10 间距标注纯函数（四方向最近间距）
│  ├─ persist.ts            IndexedDB 读写（按项目分键 + 迁移 + 备份）
│  ├─ projectIndex.ts       多项目索引纯函数
│  ├─ png.ts                F3 画板导图（DOM → SVG foreignObject → canvas）
│  ├─ aiSettings.ts         SET-01 AI 网关设置（localStorage 读写 + 归一化/校验/脱敏）
│  └─ i18n.ts               zh/en 字典（键必须两边同步，有单测兜底）
└─ exporter/
   ├─ exporter.ts           React 工程 zip 生成（组件裁剪 + hash 路由 + 事件接口位）
   ├─ scope.ts              F8 导出范围纯函数（页面裁剪 / 设备归一化）
   └─ templates.ts          组件模板
```

## 4. 数据与持久化

- 模型：`Project{ pages[] }`，每页 3 块画板（desktop/mobile/watch），每块画板 `nodes` 是**扁平字典** + `rootId`，父子靠 `parentId/children`。
- IndexedDB 键：索引 `ui-builder:index`，项目体 `ui-builder:project:<id>`；1s 防抖落盘，切项目前强制 flush。
- 迁移：v1.1 单 key → v1.2 分键，迁移前留备份；索引自愈（数据缺失条目自动剔除）。
- 导入：JSON 深校验（父子断裂/根节点缺失会拒绝并保持当前项目不变）。
- 应用级设置（非项目数据）：AI 网关配置存 `localStorage` 的 `ui-builder:ai-settings`（`{ baseUrl, apiKey, embedModel, rerankModel }`），随浏览器走、清缓存即失效；`.env` / `VITE_AI_*` 已全部移除，仓库不再保存任何网关地址或密钥。

## 5. 关键决策与取舍

| 决策 | 原因 | 代价 |
|---|---|---|
| 扁平 nodes 字典 | 移动/改父子关系 O(1)，撤销快照小 | 读代码要同时看 `children` 与字典 |
| 拖动用本地预览态，抬手才落库 | 避免每帧进撤销栈 | 画布与 store 短暂不同步 |
| 导出 `data/pages.json` 为事实源 | 导出产物可再导入，双向不漂移 | 生成器要保证与 TSX 一致（有测试守） |
| 组件按需裁剪 | zip 干净、构建快 | 需遍历可见节点收集类型 |
| PNG 零依赖（foreignObject） | 不引入 html2canvas 的体积与版本风险 | 受跨域图片、字体、CSS 特性限制 |
| 范围裁剪写成纯函数 | 空选=全部、未知 id 忽略等规则可单测 | 多一层抽象 |
| 隐藏节点不导出、不入组件裁剪集合 | 与编辑器语义一致 | 想导出隐藏内容需先取消隐藏 |

## 6. 测试策略

- 纯逻辑（坐标/树/吸附/对齐/索引/范围/PNG 命名）走纯函数单测，不依赖 DOM。
- store 走 `useStore.setState` + actions 的黑盒流程测试（撤销合并、重挂载、导入校验）。
- exporter 直接解 zip 断言内容（规格文件、组件裁剪、pages.json 回读、范围收窄、路由）。
- i18n 有键一致性测试：**新增文案必须 zh/en 同时加**，否则测试红。
- 已知坑：`idb-keyval` 测试用 `clearAll()` 造空库 + `new IDBFactory()` 注入；`currentDevice` 默认是 `mobile`，断言 pages 文件时注意。
- 覆盖率门禁：`npm run test:coverage` 会校验 `vite.config.ts` 的 `test.coverage.thresholds`（语句 80 / 分支 75 / 函数 79 / 行 82，统计范围 lib + store + ai + exporter + types）；低于下限直接失败，PR 的 `ci.yml` 跑的就是这一条。降覆盖率的大改动需要同 PR 补测，不要靠调阈值绕过。

## 7. 已知限制

- 画板 PNG：跨域图片会污染 canvas（`toBlob` 抛错 → toast 提示）；缩放钳制 1~3 倍；抓取前会清空选中，避免选中框入画（间距标注同样随选中清空而消失）。
- 间距标注：只标「同容器兄弟节点」之间，不含容器内边距 / 跨层级元素；多选、拖拽、缩放、框选、就地编辑时不显示；数值取整展示（内部保留小数）。
- 导出工程每页 `index.tsx` 默认导出一个设备组件（移动端优先，范围内无移动端则取第一个）；导出产物不做响应式自适应。
- 旋转是视觉变换，吸附/框选/AI 对齐按未旋转外接矩形近似。
- 远端 AI 网关（Embedding / Reranker）在顶栏 **齿轮 → 设置** 里运行时配置：写 `localStorage` 的 `ui-builder:ai-settings`，不写库、不随导出、无需重新构建；未配置或调用失败时回退纯规则引擎。https 页面访问 http 网关会被浏览器拦截（混合内容）。
- 预览模式只读编辑手势，表单交互与 `navigate` 跳转可用。
- 截图转界面：顶栏入口**不因未配置模型而禁用**，始终可打开——「识别」按钮置灰并提示去设置，弹层内「粘贴 JSON」离线路径照常可用；识别率取决于使用者自配的视觉模型，不做兜底承诺。

## 8. 剩余待办

- v1.2.0 已上线：版本号 / CHANGELOG / README 徽标已同步，GitHub Pages（`GITHUB_PAGES=1` → base `/ui-builder/`）产物已确认包含视觉自检与离线入口新文案。
- **v1.3 候选 · 截图转界面**：规划见 `docs/screenshot-to-interface.md`（不做后端、模型由使用者自配、本地端点免密钥）。
  - M0a（契约 + 映射 + 后处理 + 落画布，数据源用本地 JSON 粘贴）✅ 已合入，不依赖任何 API Key。
  - M0b（`multimodalClient` + 设置里的「视觉模型」+ 超时/取消/本地端点免 key）✅ 已合入。
  - M1（可用）**功能项已完成**：低置信度「核对」与「只选高置信度」、行内改类型/复制/删除、叠加框拖动与缩放微调、列对齐（含右边缘聚类）、占位块降级。**唯一未闭环项是 M1 验收里的「识别率 ≥60%」**——需要使用者用自己的模型跑 5 张真实截图自验，本仓库不内置任何网关或密钥，因此不在 CI 内。
- coverage 已纳入 PR 门禁（2026-10-29），无剩余可选待办。

## 9. 提交与协作约定

- 提交格式：`<type>(<scope>): <摘要>`；type = feat | fix | refactor | perf | test | docs | chore | ci；scope = canvas | store | exporter | ai | editor | docs | ci。
- 一次改动配一次验证：`oxlint` + `vitest run`（+ `npm run test:coverage` 看阈值是否还稳） + `tsc --noEmit` / `vite build`，都过再提交。
- 新增 UI 文案必须 zh/en 同步；新增纯函数优先补单测（本项目测试成本低、收益高）。
- 编辑器 chrome 的图标统一走 `src/editor/icons.tsx` 的线性 SVG（24 格视框 / 1.7px 描边 / `currentColor`），不要再引入彩色 emoji；画布内的模块占位内容（🖼 🔔 📶 🔋 等）属于设计稿素材，保持原样。
- PowerShell → WSL 传参时括号/管道易被吞：复杂命令用 `wsl -d UIBuilder -- bash -lc "..."`，或把脚本写到 `/mnt/c` 下再执行。

## 10. 安全加固状态（对应 `ui-builder-安全评估报告.md`）

威胁模型：本地原型工具 + 可选自配网关，**不是**多租户服务。

| 编号 | 项 | 状态 |
|---|---|---|
| SEC-01 | 密钥生命周期（脱敏展示 / 重置时一并清除） | ✅ `clearAll()` 调 `clearAiSettings()`；面板只显示 `sk-••••cd` |
| SEC-02 | 导入体积上限（5 MB，双重判定） | ✅ `lib/importGuard.ts` + `File.size` 前置 + `importProject` 解析前 |
| SEC-03 | 图片协议白名单 + 导出字符串转义 | ✅ `lib/sanitize.ts`（渲染层与导出器共用；页名/项目名压成单行安全文本） |
| SEC-04 | 「记住密钥」开关（不勾选 → `sessionStorage`，关页即失效） | ✅ `aiSettings.remember` 分流存储；切换时清掉另一侧副本 |
| SEC-05 | 生产构建注入 CSP | ✅ `vite.config.ts` 的 `ub-csp-meta` 插件（仅 `apply: 'build'`；开发环境不注入以免打断 HMR） |
| SEC-06 | 密钥加密存储 | ⏸ 不做：本地单用户工具，加密密钥无处安放（无后端），收益低 |
| SEC-07 | 同源后端代理（key 只留服务端） | ⏸ 未做：需要后端，超出 v1.2「纯前端单机」范围 |

残余风险（已知可控）：本地存储明文、CORS/混合内容限制、共享电脑滥用。**不要把生产密钥填进公共电脑。**
