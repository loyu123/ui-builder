# 截图转界面（Screenshot → Interface）规划

> 状态：M0a + M0b 已实现（M1 未开始）· 版本线：v1.3 候选 · 最后更新：2026-10-29
> 前置阅读：`HANDOFF.md`（架构）、`README.zh-CN.md` 的「安全边界」

## 1. 定位与硬边界（先定这些，再谈功能）

ui-builder 是**纯前端单机工具**，开源分发、无服务端、无账号。据此，本功能遵守三条硬边界：

| 边界 | 规则 |
|---|---|
| 不引入后端 | 不新增 `/api/*` 代理、不托管密钥、不做配额中心。客户端直接调用「使用者自己填的」模型网关 |
| 模型选择权归使用者 | 设置里支持 云厂商 OpenAI 兼容端点 / 自建网关 / 本地运行时（Ollama、LM Studio、vLLM…）。**本地端点允许不填 API Key** |
| 图片不落盘 | 截图只存在于组件内存与 `blob:` URL，不进 `project`、不进 IndexedDB、不进导出；关闭弹层即释放 |

推论（与原方案不同的地方）：
- 原方案的「必须走后端代理，key 绝不进前端」在此不成立——**我们不承诺托管密钥**，只保证「密钥跟项目数据分离、只存在使用者本机、可选择不长期保存」。设置弹层已具备该能力（`remember` 开关 → `sessionStorage`）。
- 数据是否出本机，由使用者选择的端点决定：连本地模型则完全不出机；连云端则**界面必须明确告知图片会被发往该地址**。

## 2. 接入路径（三种，同一套代码）

统一按 **OpenAI 兼容的多模态 chat 协议**实现（`POST {baseUrl}/v1/chat/completions`，`messages[].content` 里放 `image_url` + base64 data URL），这样一套适配层覆盖全部场景：

| 路径 | baseUrl 示例 | 是否需要 Key | 备注 |
|---|---|---|---|
| 云厂商（兼容端点） | `https://dashscope.aliyuncs.com/compatible-mode`、`https://open.bigmodel.cn/api/paas`、`https://api.openai.com` | 需要 | 各家模型名不同，由使用者填 |
| 自建网关 | `https://gateway.example.com` | 通常需要 | 复用现有网关设置 |
| **本地运行时** | `http://127.0.0.1:11434`（Ollama）、`http://127.0.0.1:1234`（LM Studio） | **可留空** | 本地地址视为可信端点 |

实现要点：
- `aiSettings` 增加 `visionModel`（与 embed/rerank 并列），并新增 `isLocalBaseUrl()`：`localhost` / `127.0.0.1` / `::1` / `0.0.0.0` / `*.local` / `host.docker.internal` → **key 可空**。
- 本地运行时需自行开启 CORS：Ollama 设 `OLLAMA_ORIGINS=*`；LM Studio 默认允许。界面给一行排障提示（含「Mixed content / Private Network Access 可能拦截」）。
- 云端请求受 CORS 约束：不支持浏览器直连的厂商需要使用者自行用自建网关转发——**这是使用者的选择，不是我们的默认要求**。
- 不自动重试、不并发批量（避免重复计费）；超时 15s，提供「取消」。

## 3. 数据契约（只保留我们真正会用的字段）

模型输出被视为**不可信输入**，先校验再映射。落地不产生第二套数据模型：最终仍写入 `Project/Node`。

```jsonc
{
  "modules": [{
    "type": "button-primary",          // 客户端的映射表负责，不信任模型给的原始字符串
    "confidence": 0.92,
    "box": { "x": 0.05, "y": 0.62, "w": 0.30, "h": 0.06 },  // 0-1 归一化
    "text": "立即购买",
    "style": { "background": "#FF3B30", "color": "#FFFFFF", "borderRadius": 8, "fontSize": 16 }
  }]
}
```

- **坐标**：先做「坐标系探测」（≤1.5 → 比例；≤1000 且整数感强 → 0-1000 网格，除以 1000；否则按绝对像素除以图片边长），再统一到 0-1。Qwen-VL 系返回 0-1000，这一步不做整批会错。
- **落画板换算**（`DEVICES`：mobile 390×844 / desktop 1440×900 / watch 200×242）：
  `x = round(bx * W)`、`w = max(2, round(bw * W))`，y/h 同理；截图与画板比例不一致时**按宽度对齐 + 纵向裁剪**，并在预览顶部提示。
- **style** 走白名单键别名（`background`/`color`/`borderRadius`/`fontSize`/`padding`…），未知键丢弃，值再经类型与取值范围校验。
- **text** 经 `safeInlineText()` 压缩（去换行/反引号/`$`），防注入我们自己的导出模板。
- 上限：模块数 ≤60、嵌套深度 0（v1 全扁平）、单图长边 ≤1024。

## 4. 类型映射（按真实注册表）

`src/modules/registry.ts` 现有 30 个 type，7 个分类。映射只允许产出这些值，其余 → `unknown` 占位块：

- 按钮系：`button`/`btn` → `button-primary`（宽 ≥ 60% 板宽且高 ≥ 44）否则 `button-secondary`；纯文字带下划线 → `link`
- 文本系：`text` → 字号 ≥ 24 → `heading`，否则 `paragraph`
- 输入系：`input`/`search` → `input`；密码点阵 → `password`；多行 → `textarea`；收起箭头 → `select`；拨杆 → `switch`
- 媒体系：小方框（aspect≈1 且 ≤48px）→ `icon`；圆形 → `avatar`；其余 → `image`
- 导航系：贴顶（y<8%）→ `topnav`；贴底（y+h>92%）→ `tabbar`
- 列表/表格：`list`/`item` → `list-item`（**按行高推断复制 N 行**）；`table` → `table`
- 数据展示：`stat`/`progress` 仅在文字/条形特征明确时映射，否则 `paragraph`/`divider`
- 设备专用：顶部状态栏特征 → `mobile-statusbar`；底部横条 → `home-indicator`；圆表盘 → `watch-face`
- 模型给的 `chart` / `video` / `carousel` / `badge` / `modal` / `spacer`：**注册表里不存在** → `unknown`（不要凭空造 type，否则导出器认不出）

## 5. 后处理（纯函数，可单测）

顺序固定，每步都可单独关闭（便于定位是「模型差」还是「后处理错」）：

1. **坐标系探测 + 归一化**（见 §3）
2. **栅格吸附**：4px 网格（可配 4/8/12/16），复用 `lib/snap.ts` 的阈值口径
3. **越界裁剪**：夹到画板内，最小 2×2；裁完面积 <0.1% 的直接丢弃
4. **列聚类对齐**：按 x 中心聚类（容差 8px）→ 簇内统一左/居中/右；比两两相吸稳定，不会链式漂移
5. **去重（IoU，不用重叠率）**：`IoU ≥0.6` 合并（保留置信度高者）；`0.3–0.6` 标黄让用户决定
6. **置信度分级**：`<0.4` 降级为占位块（不进勾选列表）；`0.4–0.7` 标警告；`>0.7` 正常

> 原则沿用原方案：「修到能用 + 明确标记修不好」。宁可降级为 `unknown` 占位块，也不用错坐标污染画布。

## 6. 交互流程（一个弹层搞定）

```
上传/粘贴 → 选目标画板（按图片比例推荐 mobile/desktop/watch，可改）→ 可选裁剪区域
        → 「解析」（云端/本地由设置决定）→ 预览：参考图 + 半透明框 + 类型/置信度 + 勾选框
        → 局部修正：改类型 / 删除 / 拖动微调（复用 canvas 的 resize 几何）
        → 「落到画布」：一次事务写入，**一步撤销**
```

- 参考图层：`pointerEvents:none`，zIndex 低于选中框；**导出 PNG / zip / 预览模式时自动隐藏**（沿用 `SpacingMarks` 的隔离思路）。
- 失败路径：空图 / 超大图 / 超时 / 非法 JSON / 0 个模块 → toast + 可展开原始响应，不白屏。
- 无网络兜底：设置里关闭「联网识别」后，仅保留「参考图 + 手动框选 + 网格吸附」，不做自动对齐推断（v1 不做，避免维护两套体验）。

## 7. 里程碑（单人 + 无后端 + 保留测试门禁）

| 里程碑 | 内容 | 人日 | 完成判据 |
|---|---|---|---|
| **M0a · 无网络闭环** ✅ | 契约校验 + 类型映射 + 坐标归一化 + 后处理 + `toNodes` + 参考图层 + 预览勾选 + 落画布（数据源：粘贴一段样例 JSON） | 2–3 | 粘 JSON → 画板出现可用节点；一次撤销全撤；纯函数单测 ≥25 条 |
| **M0b · 接真模型** ✅ | `multimodalClient`（OpenAI 兼容）+ 设置新增「视觉模型」+ 提示词 + 超时/取消 + 本地端点免 key | 1.5–2 | 本地 Ollama 与任一云端点各跑通一张；失败路径全部有提示 |
| **M1 · 可用**（进行中） | 低置信度 UI、改类型/删除/微调、列表行复制、去重与列对齐打磨、占位块 | 4–6 | 端到端 ≤30s；识别率 ≥60%（类型正确 + IoU≥0.5），不承诺 70% |
| **M2 · 稳定** | 大图降采样、批量写性能、5 张截图回归、演示数据与文档 | 3–4 | 回归清单全绿；CSP 下上传/预览/导出均无异常 |

合计 **11–15 人日**。M0a 不依赖任何 API Key，可先合入主干。

## 8. 文件落点

```
docs/screenshot-to-interface.md        # 本文
src/lib/screenshot/schema.ts           # 识别结果类型 + 宽松校验
src/lib/screenshot/coords.ts           # 坐标系探测 / 归一化 / 画板映射
src/lib/screenshot/mapType.ts          # 别名 → registry type
src/lib/screenshot/styleAlias.ts       # 模型 style 键 → 我们的 style（白名单）
src/lib/screenshot/postprocess.ts      # 吸附 / 裁剪 / 列聚类 / IoU 去重 / 置信度
src/lib/screenshot/toNodes.ts          # 结果 → Node[]（复用 store/builders）
src/lib/multimodalClient.ts            # 视觉网关（复用 aiSettings）
src/editor/ScreenshotModal.tsx         # 上传 → 预览 → 勾选 → 落地
src/editor/canvas/RefLayer.tsx         # 参考图层（导出时自动隐藏）
```

配套改动：`aiSettings` 增 `visionModel` + `isLocalBaseUrl`；`store/builders.ts` 抽出模板里的 `mk`；`actions.addNodesTree`（事务 + 单条历史）；i18n 中英各 ~20 键。

## 9. 验收

| # | 标准 | 测量 |
|---|---|---|
| A1 | 端到端不崩 | 空图 / 损坏图 / 超时 / 非法 JSON / 0 模块 五种输入均有提示 |
| A2 | 数据一致性 | 落地节点与手动拖入字段一致（同一 `Node` schema），可正常导出 zip / PNG |
| A3 | 撤销粒度 | 「落到画布」= 一次撤销 |
| A4 | 隐私 | 关闭弹层后 `project` 与 IndexedDB 中无图片残留（DevTools 抽查） |
| A5 | 本地可用 | 只连本地端点（无 key）可完整跑通 |
| A6 | 识别质量 | 5 张典型截图，类型正确 + IoU≥0.5 → ≥60%（M1） |

## 10. 已知风险

- **坐标不可靠**是主要风险，靠后处理 + 降级策略兜；不要试图靠调 prompt 一次到位。
- **CORS / Mixed content / Private Network Access**：云端直连与本地端点各有拦截场景，只能给提示，不能替使用者绕过。
- **成本**由使用者承担：界面不做自动重试与批量解析。
- 模型厂商返回格式漂移：契约校验层保持「宽松降级」，不因一家改版而整体失败。
