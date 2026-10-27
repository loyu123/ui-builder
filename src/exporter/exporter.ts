// EX-01~04 · 导出 React 工程 zip
// 目录规格对齐可行性方案第 8 章；events 只生成接口位（stub），默认返回 false
import JSZip from 'jszip';
import { REGISTRY_MAP } from '../modules/registry';
import type { Board, DeviceId, Node, Page, Project } from '../types';

const ROOT = 'ui-builder-export';
const pascal = (s: string) => s.replace(/[^a-zA-Z0-9]/g, ' ').split(' ').filter(Boolean)
  .map(w => w[0].toUpperCase() + w.slice(1)).join('') || 'Module';

// ---------- 组件模板（与编辑器渲染器视觉一致；静态快照） ----------
// 生成代码统一使用 st（样式）/ p（属性字符串化）辅助，保证 TS 严格模式可编译
// （componentBody/collectActions 导出供 guard 测试做字段一致性校验）
export function componentBody(type: string): string {
  switch (type) {
    case 'page': case 'group': case 'card':
      return '<div style={{ width: "100%", height: "100%", ...st }} />';
    case 'divider':
      return '<div style={{ width: "100%", height: "100%", minHeight: 1, ...st }} />';
    case 'heading': case 'paragraph':
      return '<div style={{ width: "100%", overflow: "hidden", ...st }}>{p("text")}</div>';
    case 'image':
      return `<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", ...st }}>{t("src") ? <img src={t("src")} alt={t("alt")} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : '🖼 ' + t("alt")}</div>`;
    case 'icon':
      return '<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", ...st }}>{p("glyph")}</div>';
    case 'avatar':
      return `<div style={{ width: "100%", height: "100%", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", ...st }}>{t("src") ? <img src={t("src")} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (t("name") || "?").charAt(0)}</div>`;
    case 'input':
      return `<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, border: "1px solid #e5e7eb", padding: "0 10px", boxSizing: "border-box", ...st }}>{t("label") ? <span style={{ fontSize: 11, color: "#6b7280" }}>{t("label")}</span> : null}<span style={{ color: "#9ca3af" }}>{t("placeholder")}</span></div>`;
    case 'password':
      return `<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, border: "1px solid #e5e7eb", padding: "0 10px", boxSizing: "border-box", ...st }}>{t("label") ? <span style={{ fontSize: 11, color: "#6b7280" }}>{t("label")}</span> : null}<span style={{ color: "#9ca3af", letterSpacing: 2 }}>••••••</span></div>`;
    case 'textarea':
      return '<div style={{ width: "100%", height: "100%", border: "1px solid #e5e7eb", padding: 8, boxSizing: "border-box", color: "#9ca3af", ...st }}>{t("placeholder")}</div>';
    case 'select': {
      return `<div style={{ width: "100%", height: "100%", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", boxSizing: "border-box", ...st }}><span style={{ color: "#374151" }}>{t("options").split(",")[0] || "请选择"}</span><span style={{ color: "#9ca3af" }}>▾</span></div>`;
    }
    case 'switch':
      return `<div style={{ width: "100%", height: "100%", maxWidth: 52, borderRadius: 999, background: props.on ? "#f97316" : "#d1d5db", position: "relative" }}><div style={{ position: "absolute", top: 2, left: props.on ? "calc(100% - 24px)" : 2, width: 24, height: 24, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} /></div>`;
    case 'button-primary': case 'button-secondary':
      return '<button style={{ width: "100%", height: "100%", border: "none", cursor: "pointer", ...st }} onClick={() => fire("onClick")}>{p("label")}</button>';
    case 'link':
      return '<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", ...st }}><span style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>{p("label")}</span><span style={{ marginLeft: 4 }}>›</span></div>';
    case 'tabbar': {
      return `<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", borderTop: "1px solid #e5e7eb", ...st }}>{t("tabs").split(",").filter(Boolean).map((tab, i) => <div key={i} style={{ flex: 1, textAlign: "center", color: i === 0 ? "#f97316" : st.color, fontWeight: i === 0 ? 700 : 400 }}>{tab}</div>)}</div>`;
    }
    case 'topnav':
      return '<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", padding: "0 12px", boxSizing: "border-box", gap: 10, borderBottom: "1px solid #e5e7eb", ...st }}><span style={{ fontSize: 16 }}>‹</span><span style={{ flex: 1, textAlign: "center" }}>{p("title")}</span><span style={{ width: 16 }} /></div>';
    case 'list-item':
      return `<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 10, padding: "0 12px", boxSizing: "border-box", borderBottom: "1px solid #f3f4f6", ...st }}><div style={{ width: 40, height: 40, borderRadius: 8, background: "#f3f4f6", flexShrink: 0 }} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{p("title")}</div><div style={{ fontSize: 12, color: "#9ca3af" }}>{p("subtitle")}</div></div><span style={{ color: "#d1d5db" }}>›</span></div>`;
    case 'table':
      return `<div style={{ width: "100%", height: "100%", border: "1px solid #e5e7eb", display: "flex", flexDirection: "column", overflow: "hidden", boxSizing: "border-box", ...st }}><div style={{ display: "flex", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>{["列A", "列B", "列C"].map(h => <div key={h} style={{ flex: 1, padding: "6px 8px", fontWeight: 600 }}>{h}</div>)}</div>{Array.from({ length: Math.max(1, Number(props.rows) || 3) }).map((_, i) => <div key={i} style={{ display: "flex", flex: 1, alignItems: "center", borderBottom: "1px solid #f3f4f6" }}>{["—", "—", "—"].map((c, j) => <div key={j} style={{ flex: 1, padding: "4px 8px", color: "#9ca3af" }}>{c}</div>)}</div>)}</div>`;
    case 'stat':
      return `<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 14px", boxSizing: "border-box", gap: 4, boxShadow: "inset 0 0 0 1px #e5e7eb", ...st }}><span style={{ fontSize: 12, color: "#6b7280" }}>{p("label")}</span><span style={{ fontSize: 26, fontWeight: 700 }}>{p("value")}<span style={{ fontSize: 13, fontWeight: 400, color: "#6b7280", marginLeft: 3 }}>{p("unit")}</span></span></div>`;
    case 'progress': {
      return `<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 8 }}><div style={{ flex: 1, height: 10, borderRadius: 999, background: st.background, overflow: "hidden" }}><div style={{ width: "${'${'}Number(props.value) || 0}%", height: "100%", background: "#f97316", borderRadius: 999 }} /></div><span style={{ fontSize: 11, color: "#6b7280" }}>{p("value")}%</span></div>`;
    }
    case 'message-bubble': {
      return `<div style={{ width: "100%", height: "100%", display: "flex", justifyContent: props.side === "right" ? "flex-end" : "flex-start", alignItems: "center" }}><div style={{ maxWidth: "85%", padding: "8px 12px", borderRadius: 12, background: props.side === "right" ? "#f97316" : st.background, color: props.side === "right" ? "#fff" : st.color, fontSize: st.fontSize, boxSizing: "border-box" }}>{p("text")}</div></div>`;
    }
    case 'comment':
      return `<div style={{ width: "100%", height: "100%", display: "flex", gap: 8, padding: 8, boxSizing: "border-box", ...st }}><div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f3f4f6", flexShrink: 0 }} /><div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 12 }}>{p("name")}</b><div>{p("text")}</div><span style={{ fontSize: 11, color: "#9ca3af" }}>回复</span></div></div>`;
    case 'notification':
      return `<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 8, padding: "0 12px", boxSizing: "border-box", ...st }}><span>🔔</span><span style={{ flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{p("text")}</span><span style={{ opacity: .6 }}>✕</span></div>`;
    case 'mobile-statusbar':
      return '<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", boxSizing: "border-box", ...st }}><b>{p("time")}</b><span style={{ fontSize: 11 }}>📶 🔋</span></div>';
    case 'home-indicator':
      return '<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", ...st }}><div style={{ width: 134, height: 5, borderRadius: 999, background: "#111827", opacity: .85 }} /></div>';
    case 'watch-face':
      return '<div style={{ width: "100%", height: "100%", borderRadius: "50%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", ...st }}><div style={{ fontWeight: 700 }}>{p("time")}</div><div style={{ fontSize: 10, opacity: .6 }}>♡ 72</div></div>';
    case 'watch-list-row':
      return `<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", padding: "0 10px", boxSizing: "border-box", borderRadius: 8, gap: 6, ...st }}><span style={{ width: 6, height: 6, borderRadius: 3, background: "#f97316" }} /><span>{p("text")}</span></div>`;
    default:
      return '<div style={{ width: "100%", height: "100%", ...st }} />';
  }
}

// ---------- 事件动作收集（EX-03：接口位） ----------
export function collectActions(project: Project): string[] {
  const keys = new Set<string>();
  for (const pg of project.pages) {
    for (const b of Object.values(pg.boards)) {
      for (const n of Object.values(b.nodes)) {
        for (const [ev, spec] of Object.entries(n.events ?? {})) {
          if (spec?.action && spec.action !== 'none') keys.add(`${ev}_${spec.action}_${spec.target ?? 'none'}`);
        }
      }
    }
  }
  return [...keys];
}

// ---------- 页面 TSX 生成（嵌套渲染树） ----------
function emitNode(node: Node, board: Board, indent: string, used: Set<string>): string {
  const meta = REGISTRY_MAP[node.type];
  const comp = pascal(node.type);
  if (node.type !== 'page') used.add(node.type);
  const styleJson = JSON.stringify(node.style);
  const propsJson = JSON.stringify(node.props);
  const ev = Object.entries(node.events ?? {}).find(([, s]) => s.action !== 'none');
  const onFire = ev ? ` onClick={() => fire("${ev[0]}_${ev[1].action}_${ev[1].target ?? 'none'}")}` : '';
  const childDivs = node.children
    .map(cid => board.nodes[cid])
    .filter(Boolean)
    .map(c => emitNode(c, board, indent + '  ', used))
    .join('\n');
  const self = `{/* ${meta?.label ?? node.type} */}\n${indent}<div style={{ position: "absolute", left: ${node.frame.x}, top: ${node.frame.y}, width: ${node.frame.w}, height: ${node.frame.h} }}${onFire}>\n${indent}  <${comp} props={${propsJson}} style={${styleJson}} />\n${childDivs ? childDivs + '\n' : ''}${indent}</div>`;
  return self;
}

// 页面组件名（ASCII slug）：pascal 会把纯中文页名清空，故独立回退 Page；
// 同名页按出现顺序追加序号，保证组件名/文件夹名全局唯一
function pageSlug(name: string, used: Set<string>): string {
  const base = name.replace(/[^a-zA-Z0-9]/g, ' ').split(' ').filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1)).join('') || 'Page';
  let out = base, i = 2;
  while (used.has(out)) out = `${base}${i++}`;
  used.add(out);
  return out;
}

function pageTsx(page: Page, device: DeviceId, slug: string): string {
  const board: Board = page.boards[device];
  const used = new Set<string>();
  const root = board.nodes[board.rootId];
  const children = root.children.map(id => board.nodes[id]).filter(Boolean)
    .map(n => emitNode(n, board, '      ', used)).join('\n');
  const imports = [...used].map(t => `import { ${pascal(t)} } from "../../components/${pascal(t)}";`).join('\n');
  const dev = device.charAt(0).toUpperCase() + device.slice(1);
  return `${imports ? imports + '\n\n' : ''}import { fire } from "../../events/actions";

// ${page.name} · ${device} 画板（由界面搭建器导出；手工修改前请先了解 data/pages.json 可再生成）
export default function ${slug}${dev}() {
  return (
    <div style={{ position: "relative", width: ${board.frame.w}, height: ${board.frame.h}, background: "${root.style.background ?? '#ffffff'}", overflow: "hidden" }}>
${children}
    </div>
  );
}
`;
}

// ---------- 主流程 ----------
export async function exportProjectZip(project: Project): Promise<Uint8Array> {
  const zip = new JSZip();
  const f = (path: string, content: string) => zip.file(`${ROOT}/${path}`, content);

  // data/pages.json（可再导入编辑器的唯一事实源）
  f('data/pages.json', JSON.stringify(project, null, 2));

  // web 脚手架
  f('web/package.json', JSON.stringify({
    name: 'ui-builder-app', private: true, version: '0.1.0', type: 'module',
    scripts: { dev: 'vite', build: 'tsc -b && vite build', preview: 'vite preview' },
    dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
    devDependencies: {
      '@types/react': '^18.3.12', '@types/react-dom': '^18.3.1',
      '@vitejs/plugin-react': '^4.3.4', typescript: '^5.6.3', vite: '^5.4.11',
    },
  }, null, 2));
  f('web/tsconfig.json', JSON.stringify({
    compilerOptions: {
      target: 'ES2020', lib: ['ES2020', 'DOM'], module: 'ESNext',
      moduleResolution: 'bundler', jsx: 'react-jsx', strict: true,
      noEmit: true, skipLibCheck: true, isolatedModules: true,
    }, include: ['src'],
  }, null, 2));
  f('web/vite.config.ts', `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });\n`);
  f('web/index.html', `<!doctype html>\n<html lang="zh-CN">\n<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${project.name}</title></head>\n<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>\n</html>\n`);

  // 全部模块组件（EX-02：每个模块一个组件文件；st/p 辅助保证 TS 严格模式可编译）
  for (const m of REGISTRY_MAP ? Object.values(REGISTRY_MAP) : []) {
    if (m.type === 'page') continue;
    const name = pascal(m.type);
    const needFire = m.type === 'button-primary' || m.type === 'button-secondary';
    f(`web/src/components/${name}.tsx`,
`${needFire ? 'import { fire } from "../events/actions";\n\n' : ''}import type * as React from "react";

interface Props {
  props: Record<string, unknown>;
  style: Record<string, string | number>;
}

export function ${name}({ props, style }: Props) {
  const st = style as React.CSSProperties;
  const p = (k: string): string => (props[k] === undefined || props[k] === null ? "" : String(props[k]));
  const t = p;
  return (
    ${componentBody(m.type)}
  );
}
`);
  }

  // 事件接口位（EX-03：只生成 key，不实现逻辑）
  const actions = collectActions(project);
  f('web/src/events/types.ts',
`// 事件挂载点类型（由界面搭建器生成）
export interface EventSpec {
  action: 'none' | 'navigate' | 'submit' | 'back' | 'dismiss' | 'toggle' | 'bind' | 'external';
  target?: string | null;
  note?: string;
}
`);
  f('web/src/events/actions.ts',
`// EX-03 · 事件接口位：key 形如 onClick_submit_login
// 默认全部返回 false；接入真实行为时在对应 case 里实现并返回 true
export function fire(key: string): boolean {
  switch (key) {
${actions.map(k => `    case '${k}':\n      console.info('[action] ${k} — 待接入真实行为');\n      return false;`).join('\n') || '    // 当前设计未挂接任何事件'}
    default:
      console.info('[action] 未注册:', key);
      return false;
  }
}
`);

  // 页面（每页 × 每设备）；文件夹名 = 组件 slug（ASCII 稳定，同名页已唯一化）
  const pageNames = new Map<string, string>();
  const slugUsed = new Set<string>();
  for (const pg of project.pages) {
    pageNames.set(pg.id, pageSlug(pg.name, slugUsed));
  }
  for (const pg of project.pages) {
    const slug = pageNames.get(pg.id)!;
    for (const device of ['desktop', 'mobile', 'watch'] as DeviceId[]) {
      f(`web/src/pages/${slug}/${device.charAt(0).toUpperCase() + device.slice(1)}.tsx`, pageTsx(pg, device, slug));
    }
    f(`web/src/pages/${slug}/index.tsx`,
`import Mobile from './Mobile';
export default Mobile;
`);
  }

  f('web/src/styles/tokens.css',
`:root {
${Object.entries(project.theme.colors).map(([k, v]) => `  --color-${k}: ${v};`).join('\n')}
${Object.entries(project.theme.radius).map(([k, v]) => `  --radius-${k}: ${v}px;`).join('\n')}
  --font-base: ${project.theme.font.family};
  --font-size-base: ${project.theme.font.base}px;
}
`);
  f('web/src/styles/global.css',
`@import './tokens.css';
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body { font-family: var(--font-base); font-size: var(--font-size-base); }
`);
  f('web/src/App.tsx',
`import ${pageNames.get(project.pages[0].id)} from './pages/${pageNames.get(project.pages[0].id)}';

export default function App() {
  // v1 单页入口；多页路由在接口位（fire('onClick_navigate_xxx')）接入后扩展
  return <${pageNames.get(project.pages[0].id)} />;
}
`);
  f('web/src/main.tsx',
`import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App from './App';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
`);

  // 配套文件（EX-04）
  f('README.md',
`# ${project.name}

由「界面搭建器」导出的 React 工程。设计的事实源是 \`data/pages.json\`（可在编辑器中重新导入继续设计）。

## 快速开始
\`\`\`bash
cd web && npm install && npm run dev
\`\`\`

## 目录
- \`web/\` React 前端（页面按 页面/设备 组织，events 为接口位）
- \`data/pages.json\` 设计数据（schema v${project.schemaVersion}）
- \`backend/\` 后端占位（S1 默认不含骨架）
- \`scripts/dev.sh\` 一键启动
- \`scripts/verify.sh\` 导出回归：安装→类型检查→构建
`);
  f('.gitignore', 'node_modules/\ndist/\n*.local\n');
  f('docker-compose.yml',
`# 静态托管占位（S1 默认不含后端）
version: "3"
services:
  web:
    image: nginx:alpine
    ports: ["8088:80"]
    volumes: ["./web/dist:/usr/share/nginx/html:ro"]
`);
  f('backend/README.md', '# backend（占位）\n\nS1 交付范围不含后端骨架。events 中 action=bind/submit 的接口位即未来的对接点。\n');
  f('scripts/dev.sh', '#!/usr/bin/env bash\nset -e\ncd "$(dirname "$0")/../web"\nnpm install\nnpm run dev\n');
  f('scripts/verify.sh', '#!/usr/bin/env bash\n# EX-05 · 导出回归（降级版：无截图比对，构建绿即通过）\nset -e\ncd "$(dirname "$0")/../web"\nnpm install\ntsc -b\nnpm run build\necho "verify: OK"\n');
  f('.github/workflows/ci.yml',
`name: ci
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd web && npm install && npm run build
`);

  return zip.generateAsync({ type: 'uint8array' });
}
