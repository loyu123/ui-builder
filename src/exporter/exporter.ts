// EX-01~04 · 导出 React 工程 zip
// 目录规格对齐可行性方案第 8 章；events 只生成接口位（stub），默认返回 false
import JSZip from 'jszip';
import { REGISTRY_MAP } from '../modules/registry';
import type { Board, DeviceId, Node, Page, Project } from '../types';
import { componentBody } from './templates';
import { applyExportScope, defaultDevice, type ExportScope } from './scope';
import { escapeHtml, safeImageSrc, safeInlineText } from '../lib/sanitize';

// P1-15 · 组件模板在 templates.ts；此处 re-export 供 guard 测试使用
export { componentBody };

const ROOT = 'ui-builder-export';
const pascal = (s: string) => s.replace(/[^a-zA-Z0-9]/g, ' ').split(' ').filter(Boolean)
  .map(w => w[0].toUpperCase() + w.slice(1)).join('') || 'Module';

// ---------- 事件动作收集（EX-03：接口位） ----------
export interface CollectedAction { key: string; action: string; target: string | null }

export function collectActions(project: Project): CollectedAction[] {
  const list = new Map<string, CollectedAction>();
  for (const pg of project.pages) {
    for (const b of Object.values(pg.boards)) {
      for (const n of Object.values(b.nodes)) {
        for (const [ev, spec] of Object.entries(n.events ?? {})) {
          if (spec?.action && spec.action !== 'none') {
            const key = `${ev}_${spec.action}_${spec.target ?? 'none'}`;
            if (!list.has(key)) list.set(key, { key, action: spec.action, target: spec.target ?? null });
          }
        }
      }
    }
  }
  return [...list.values()];
}

// ---------- 页面 TSX 生成（嵌套渲染树） ----------
/** 只清洗 src 这一类"会被浏览器直接解析"的字段；其余 props 原样保留 */
function sanitizeNodeProps(props: Record<string, unknown>): Record<string, unknown> {
  if (typeof props.src !== 'string') return props;
  return { ...props, src: safeImageSrc(props.src) };
}

function emitNode(node: Node, board: Board, indent: string, used: Set<string>,
  colorVars: Map<string, string>): string {
  const meta = REGISTRY_MAP[node.type];
  const comp = pascal(node.type);
  if (node.type !== 'page') used.add(node.type);
  // P2-32 · 主题 token 进组件：与主题颜色相同的样式值替换为 CSS 变量，
  // 导出工程改 tokens.css 即可全局换肤（编辑器内仍显示字面色值）
  const themedStyle: Record<string, unknown> = { ...node.style };
  for (const [k, v] of Object.entries(themedStyle)) {
    if (typeof v === 'string') {
      const varRef = colorVars.get(v.toLowerCase());
      if (varRef) themedStyle[k] = varRef;
    }
  }
  const styleJson = JSON.stringify(themedStyle);
  // SEC-03 · 导出的 props 里图片地址走协议白名单（挡 javascript: / data:text/html）
  const propsJson = JSON.stringify(sanitizeNodeProps(node.props));
  const ev = Object.entries(node.events ?? {}).find(([, s]) => s.action !== 'none');
  const onFire = ev ? ` onClick={() => fire("${ev[0]}_${ev[1].action}_${ev[1].target ?? 'none'}")}` : '';
  const childDivs = node.children
    .map(cid => board.nodes[cid])
    .filter(Boolean)
    .filter(c => !c.hidden)
    .map(c => emitNode(c, board, indent + '  ', used, colorVars))
    .join('\n');
  const rotate = node.rotation ? `, transform: "rotate(${node.rotation}deg)"` : '';
  const self = `{/* ${meta?.label ?? node.type} */}\n${indent}<div style={{ position: "absolute", left: ${node.frame.x}, top: ${node.frame.y}, width: ${node.frame.w}, height: ${node.frame.h}${rotate} }}${onFire}>\n${indent}  <${comp} props={${propsJson}} style={${styleJson}} />\n${childDivs ? childDivs + '\n' : ''}${indent}</div>`;
  return self;
}

// 页面组件名（ASCII slug）：pascal 会把纯中文页名清空，故独立回退 Page；
// 数字开头（如"页面 2"→"2"）不是合法标识符，补 Page 前缀；同名页按出现顺序追加序号
function pageSlug(name: string, used: Set<string>): string {
  const pascalName = name.replace(/[^a-zA-Z0-9]/g, ' ').split(' ').filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1)).join('');
  const base = /^[A-Za-z_$]/.test(pascalName) ? pascalName : `Page${pascalName}`;
  let out = base, i = 2;
  while (used.has(out)) out = `${base}${i++}`;
  used.add(out);
  return out;
}

function pageTsx(page: Page, device: DeviceId, slug: string, usedModules: Set<string>,
  colorVars: Map<string, string>): string {
  const board: Board = page.boards[device];
  const used = usedModules;   // P2-31 · 跨页共享：组件按需裁剪
  const root = board.nodes[board.rootId];
  const children = root.children.map(id => board.nodes[id]).filter(Boolean)
    .filter(n => !n.hidden)   // P3-42 · 隐藏模块不导出（与编辑器语义一致）
    .map(n => emitNode(n, board, '      ', used, colorVars)).join('\n');
  const imports = [...used].map(t => `import { ${pascal(t)} } from "../../components/${pascal(t)}";`).join('\n');
  const dev = device.charAt(0).toUpperCase() + device.slice(1);
  return `${imports ? imports + '\n\n' : ''}import { fire } from "../../events/actions";

// ${safeInlineText(page.name)} · ${device} 画板（由界面搭建器导出；手工修改前请先了解 data/pages.json 可再生成）
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
// F8 · scope 可限定导出哪些页面与哪些设备画板；不传则全量（与旧行为一致）
export async function exportProjectZip(input: Project, scope: ExportScope = {}): Promise<Uint8Array> {
  const { project, devices } = applyExportScope(input, scope);
  const zip = new JSZip();
  const f = (path: string, content: string) => zip.file(`${ROOT}/${path}`, content);

  // data/pages.json（可再导入编辑器的唯一事实源）
  f('data/pages.json', JSON.stringify(project, null, 2));

  // web 脚手架（P3-17 · React 版本与编辑器对齐）
  f('web/package.json', JSON.stringify({
    name: 'ui-builder-app', private: true, version: '0.1.0', type: 'module',
    scripts: { dev: 'vite', build: 'tsc -b && vite build', preview: 'vite preview' },
    dependencies: { react: '^19.3.1', 'react-dom': '^19.3.1' },
    devDependencies: {
      '@types/react': '^19.3.0', '@types/react-dom': '^19.3.0',
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
  f('web/index.html', `<!doctype html>\n<html lang="zh-CN">\n<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${escapeHtml(safeInlineText(project.name))}</title></head>\n<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>\n</html>\n`);

  // 模块组件按需裁剪（P2-31：zip 只打页面实际引用的组件，未用的不生成）
  // 树形遍历可见节点：hidden 子树不导出（P3-42），其类型也不计入裁剪集合
  const usedTypes = new Set<string>();
  for (const pg of project.pages) {
    for (const b of Object.values(pg.boards)) {
      const walk = (id: string) => {
        const n = b.nodes[id];
        if (!n || n.hidden) return;
        if (n.type !== 'page') usedTypes.add(n.type);
        for (const cid of n.children) walk(cid);
      };
      walk(b.rootId);
    }
  }
  for (const m of REGISTRY_MAP ? Object.values(REGISTRY_MAP) : []) {
    if (m.type === 'page' || !usedTypes.has(m.type)) continue;
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

  // 页面 slug 唯一化（P2-13 路由与 navigate 跳转都要用，先于事件模板计算）
  const pageNames = new Map<string, string>();
  const slugUsed = new Set<string>();
  const usedModules = usedTypes;   // P2-31 · 页面 TSX 共享同一集合

  // P2-32 · 主题色值 → CSS 变量映射（小写色值 → var(--color-*)）
  const colorVars = new Map<string, string>();
  for (const [k, v] of Object.entries(project.theme.colors)) {
    colorVars.set(v.toLowerCase(), `var(--color-${k})`);
  }
  for (const pg of project.pages) {
    pageNames.set(pg.id, pageSlug(pg.name, slugUsed));
  }

  // 事件接口位（EX-03：key 形如 onClick_submit_login）
  // navigate 且 target 是本工程页面 id 时生成真实 hash 跳转；其余保持接口位
  const actions = collectActions(project);
  f('web/src/events/types.ts',
`// 事件挂载点类型（由界面搭建器生成）
export interface EventSpec {
  action: 'none' | 'navigate' | 'submit' | 'back' | 'dismiss' | 'toggle' | 'bind' | 'external';
  target?: string | null;
  note?: string;
}
`);
  const actionCases = actions.map(a => {
    const slug = a.action === 'navigate' && a.target ? pageNames.get(a.target) : undefined;
    if (slug) {
      return `    case '${a.key}':\n      window.location.hash = '#/${slug.toLowerCase()}';\n      return true;`;
    }
    return `    case '${a.key}':\n      console.info('[action] ${a.key} — 待接入真实行为');\n      return false;`;
  }).join('\n');
  f('web/src/events/actions.ts',
`// EX-03 · 事件接口位：key 形如 onClick_submit_login
// navigate 已接多页路由；其余默认返回 false，接入真实行为时在对应 case 里实现并返回 true
export function fire(key: string): boolean {
  switch (key) {
${actionCases || '    // 当前设计未挂接任何事件'}
    default:
      console.info('[action] 未注册:', key);
      return false;
  }
}
`);

  // 页面（每页 × 范围内设备）；文件夹名 = 组件 slug（ASCII 稳定，同名页已唯一化）
  const mainDev = defaultDevice(devices);
  const mainComp = mainDev.charAt(0).toUpperCase() + mainDev.slice(1);
  for (const pg of project.pages) {
    const slug = pageNames.get(pg.id)!;
    for (const device of devices) {
      f(`web/src/pages/${slug}/${device.charAt(0).toUpperCase() + device.slice(1)}.tsx`,
        pageTsx(pg, device, slug, usedModules, colorVars));
    }
    f(`web/src/pages/${slug}/index.tsx`,
`import ${mainComp} from './${mainComp}';
export default ${mainComp};
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
  // 入口：单页直引；多页生成 hash 路由（P2-13，配合事件 action=navigate 跳转）
  if (project.pages.length <= 1) {
    f('web/src/App.tsx',
`import ${pageNames.get(project.pages[0].id)} from './pages/${pageNames.get(project.pages[0].id)}';

export default function App() {
  // v1 单页入口
  return <${pageNames.get(project.pages[0].id)} />;
}
`);
  } else {
    const imports = project.pages.map(pg => {
      const slug = pageNames.get(pg.id)!;
      return `import ${slug} from './pages/${slug}';`;
    }).join('\n');
    const routes = project.pages.map((pg, i) => {
      const slug = pageNames.get(pg.id)!;
      return `  '${i === 0 ? '/' : `/${slug.toLowerCase()}`}': ${slug},`;
    }).join('\n');
    f('web/src/App.tsx',
`import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
${imports}

// 多页 hash 路由（由界面搭建器生成；配合事件 action=navigate 跳转）
const routes: Record<string, ComponentType> = {
${routes}
};

export default function App() {
  const [path, setPath] = useState(window.location.hash.slice(1) || '/');
  useEffect(() => {
    const onHash = () => setPath(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const Route = routes[path] ?? routes['/'];
  return <Route />;
}
`);
  }
  f('web/src/main.tsx',
`import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App from './App';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
`);

  // 配套文件（EX-04）
  f('README.md',
`# ${safeInlineText(project.name)}

由「界面搭建器」导出的 React 工程。设计的事实源是 \`data/pages.json\`（可在编辑器中重新导入继续设计）。

## 快速开始
\`\`\`bash
cd web && npm install && npm run dev
\`\`\`

## 目录
- \`web/\` React 前端（页面按 页面/设备 组织，events 为接口位）
- \`data/pages.json\` 设计数据（schema v${project.schemaVersion}）
- 导出范围：${project.pages.length} 个页面 · 设备 ${devices.join(' / ')}（范围由导出时的勾选决定）
- \`backend/\` 后端占位（S1 默认不含骨架）
- \`scripts/dev.sh\` 一键启动
- \`scripts/verify.sh\` 导出回归：安装→类型检查→构建

## 多页路由与事件
- 多页设计自动生成 **hash 路由**（\`web/src/App.tsx\`）：首页 \`/#/\`，其余页 \`/#/页面slug小写\`
- 编辑器里绑定了「跳转页面」事件的模块，导出后点击会**真实切换页面**（\`window.location.hash\`）
- 其余事件动作（提交/绑定接口等）是接口位：在 \`web/src/events/actions.ts\` 对应 case 中实现真实行为并返回 \`true\`
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
  // 用 npx --no-install 调本地 tsc：干净环境里没有全局 tsc，裸调 'tsc -b' 会 command not found
  f('scripts/verify.sh', '#!/usr/bin/env bash\n# EX-05 · 导出回归（降级版：无截图比对，构建绿即通过）\nset -e\ncd "$(dirname "$0")/../web"\nnpm install\nnpx --no-install tsc -b\nnpm run build\necho "verify: OK"\n');
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
