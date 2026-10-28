# 更新记录

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)；v1.2.0 之前的历史见 `git log --oneline`。

## [未发布]

### 新增

- **设置弹层（SET-01）**：顶栏齿轮打开，可配置 AI 网关地址、API Key、Embedding 模型、Reranker 模型，并提供「测试连接」「保存」「清除」。配置只写本浏览器 `localStorage`（`ui-builder:ai-settings`），不入库、不随导出，改配置无需重新构建；AI 面板的模式提示可直接点开设置。

### 变更

- 移除 `.env.example` 与全部 `VITE_AI_*` 环境变量读取（仓库不再保存任何网关地址 / 密钥）；`.gitignore` 同步去掉 `.env.example` 例外。AI 网关改为运行时设置。
- 文档（README 中英 / HANDOFF）改为描述运行时设置，不再要求复制 `.env`。

### 安全

- **SEC-01**：「清空缓存并重置」现在同时清除 AI 网关设置（此前只删 IndexedDB，`localStorage` 里的密钥会残留）；设置弹层里已保存的密钥只显示脱敏值。
- **SEC-02**：项目 JSON 导入加 5 MB 体积上限（读文件前按 `File.size`、解析前再按 UTF-8 估算各判一次），超限直接拒绝并说明原因。
- **SEC-03**：图片地址走协议白名单（`http(s)` / `blob` / `data:image/*` / 相对路径），编辑器渲染与导出产物同步清洗；导出时项目名/页名经 HTML 转义与单行压缩，防止破坏 `index.html` 与 TSX 注释。
- 新增 `src/lib/sanitize.ts`、`src/lib/importGuard.ts` 及 9 条单测；README 增加「安全边界」章节。
- **SEC-04**：设置里新增「记住密钥」开关——勾选走 `localStorage`（跨会话），不勾选只写 `sessionStorage`（关页即失效），切换时清掉另一侧副本；密钥旁标注当前存储口径。
- **SEC-05**：生产构建注入 `Content-Security-Policy`（`script-src 'self'` / `object-src 'none'` / `base-uri 'self'`，`style-src` 保留 `'unsafe-inline'` 以兼容 React 内联样式；`img-src`/`connect-src` 放开 http(s) 以支持外链图与自定义网关）。开发环境不注入，避免打断 HMR。

### 优化

- 编辑器 chrome 里的彩色 emoji 图标统一换成为 **线性 SVG 图标**（`src/editor/icons.tsx`）：顶栏设备切换（显示器 / 手机 / 手表）、右栏「主题」「快捷键」折叠块、图层树锁定状态。
- 移除顶栏右下角「方向 A · 浅色专业」标签（含 `direction_tag` 文案键）。

## [1.2.0] · 2026-10-28

### 新增

- **多项目管理（F1）**：顶栏项目名 ▾ 打开项目列表，支持新建（空白 / 模板）、切换、重命名、删除；切换前自动 flush 落盘；索引 `ui-builder:index` + 项目体 `ui-builder:project:<id>`；v1.1 单 key 数据首次启动自动迁移并留备份；索引自愈（缺失条目自动剔除）。
- **模板库（F2）**：5 套内置模板（登录页 / 消息列表 / 商品详情 / 个人中心 / 空状态），每套同时提供手机与电脑布局；由 registry 元数据构建，props 键漂移有测试拦截。
- **对齐与分布（F4）**：多选后 6 向对齐（左/右/顶/底/水平居中/垂直居中）+ 水平/垂直等距分布，同容器内生效。
- **图层树增量（F5）**：名称/类型过滤、行内一键隐藏与锁定、折叠展开、与画布双向同步并自动滚动到可视区。
- **画板导出 PNG（F3）**：零依赖链路 DOM → SVG `foreignObject` → canvas → blob；默认 2 倍图，缩放钳制 1~3；文件名 `项目-页面-设备-YYYYMMDD.png`（非法字符自动替换）；抓取前清空选中，跨域图片导致编码失败时 toast 提示。
- **导出范围（F8）**：导出工程前可勾选页面与设备，zip 只含勾选内容，`data/pages.json` 同步收窄；每页 `index.tsx` 默认导出范围内设备（移动端优先）。
- **间距标注（F10）**：单选元素时自动标注与同容器相邻元素的四向最近间距（要求另一轴有重叠，重叠/贴边不标），拖拽/缩放/框选/就地编辑时自动隐藏。

### 优化

- 浅色专业主题色板校准，按钮尺寸统一。
- 示例项目（`?demo=login`）改为复用模板并新建项目，不再覆盖用户已有项目；修复 `button-primary` 误读 `props.text` 的问题。

### 文档

- 新增 `HANDOFF.md`（现状、环境、代码地图、决策取舍、已知限制、待办）。
- `README.md` / `README.zh-CN.md`：功能表补充画板导图、导出范围、间距标注；测试清单与总数更新为 142 条。
- `DEMO.md`：演示脚本补充间距标注、导出 PNG、导出范围三步。

### 工程

- 测试 114 → **142** 条全绿；`oxlint` 0 warning；`tsc --noEmit` 干净；`vite build` 绿。
- GitHub Pages 子路径（`GITHUB_PAGES=1` → base `/ui-builder/`）构建与本地预览回归通过（首页与 JS 资源均 200）。
