# HANDOFF · ui-builder 交接说明

> 面向接手者：先读这份，再读 `README.zh-CN.md`（功能清单/测试清单）与 `DEMO.md`（演示路径）。
> 最后更新：2026-10-28（v1.2.0 发布）

## 1. 现在是什么状态

- 版本线：v1.1.0 已发布；v1.2.0 功能全部落地（多项目 / 模板 / 对齐 / 图层树 / 画板导图 / 导出范围 / 间距标注），版本号与 CHANGELOG 已更新，剩 Pages 部署线上回归。
- 质量门：**142 条单测全绿**、`oxlint` 0 warning、`tsc --noEmit` 干净、`vite build` 绿。CI（lint + test + build）为合并前提。
- 纯前端单机应用：无后端、无账号、数据全在浏览器 IndexedDB。

## 2. 怎么跑起来

开发环境在 **WSL distro `UIBuilder`**，仓库路径 `/home/dev/ui-builder`（Windows 侧可见为 `\\wsl$\UIBuilder\home\dev\ui-builder`）。

```bash
cd /home/dev/ui-builder
npm install          # 首次
npm run dev          # http://localhost:5173
npm test             # vitest run（142 条）
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

## 7. 已知限制

- 画板 PNG：跨域图片会污染 canvas（`toBlob` 抛错 → toast 提示）；缩放钳制 1~3 倍；抓取前会清空选中，避免选中框入画（间距标注同样随选中清空而消失）。
- 间距标注：只标「同容器兄弟节点」之间，不含容器内边距 / 跨层级元素；多选、拖拽、缩放、框选、就地编辑时不显示；数值取整展示（内部保留小数）。
- 导出工程每页 `index.tsx` 默认导出一个设备组件（移动端优先，范围内无移动端则取第一个）；导出产物不做响应式自适应。
- 旋转是视觉变换，吸附/框选/AI 对齐按未旋转外接矩形近似。
- 远端 AI 网关只在 `.env` 预留；无配置时纯规则引擎。
- 预览模式只读编辑手势，表单交互与 `navigate` 跳转可用。

## 8. 剩余待办

- v1.2.0 已发布（版本号 / CHANGELOG / README 徽标均已更新）；本地已按 `GITHUB_PAGES=1` 构建并 `vite preview` 验证 `/ui-builder/` 首页与 JS 资源 200，剩 push 后看线上 actions 结果。
- 可选：coverage 基线纳入 CI（现为本地 `npm run test:coverage`，门禁仅 lint+test+build）。

## 9. 提交与协作约定

- 提交格式：`<type>(<scope>): <摘要>`；type = feat | fix | refactor | perf | test | docs | chore | ci；scope = canvas | store | exporter | ai | editor | docs | ci。
- 一次改动配一次验证：`oxlint` + `vitest run` + `tsc --noEmit` / `vite build`，三项都过再提交。
- 新增 UI 文案必须 zh/en 同步；新增纯函数优先补单测（本项目测试成本低、收益高）。
- 编辑器 chrome 的图标统一走 `src/editor/icons.tsx` 的线性 SVG（24 格视框 / 1.7px 描边 / `currentColor`），不要再引入彩色 emoji；画布内的模块占位内容（🖼 🔔 📶 🔋 等）属于设计稿素材，保持原样。
- PowerShell → WSL 传参时括号/管道易被吞：复杂命令用 `wsl -d UIBuilder -- bash -lc "..."`，或把脚本写到 `/mnt/c` 下再执行。
