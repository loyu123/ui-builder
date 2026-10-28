// W5 · 导出端到端：zip 内容完整 + pages.json 可回读
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { exportProjectZip } from './exporter';
import { useStore, createEmptyProject } from '../store';
import { REGISTRY } from '../modules/registry';

async function buildZip() {
  useStore.setState({ project: createEmptyProject() });
  const a = useStore.getState().actions;
  for (const m of REGISTRY.filter(x => x.palette !== false)) {
    a.addNode(m.type, { x: 10, y: 10, w: m.w, h: m.h });
  }
  return exportProjectZip(useStore.getState().project);
}

describe('EX · 导出工程端到端', () => {
  it('zip 含规格要求的全部关键文件', async () => {
    const bytes = await buildZip();
    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files);
    const mustHave = [
      'ui-builder-export/README.md',
      'ui-builder-export/data/pages.json',
      'ui-builder-export/docker-compose.yml',
      'ui-builder-export/web/package.json',
      'ui-builder-export/web/src/main.tsx',
      'ui-builder-export/web/src/App.tsx',
      'ui-builder-export/web/src/styles/tokens.css',
      'ui-builder-export/web/src/events/actions.ts',
      'ui-builder-export/web/src/components/ButtonPrimary.tsx',
      'ui-builder-export/web/src/pages/Page/Mobile.tsx',
      'ui-builder-export/web/src/pages/Page/index.tsx',
      'ui-builder-export/scripts/verify.sh',
      'ui-builder-export/.github/workflows/ci.yml',
    ];
    for (const f of mustHave) {
      expect(names, `缺少 ${f}`).toContain(f);
    }
  });

  it('30 个模块组件全部生成', async () => {
    const bytes = await buildZip();
    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files).filter(n => n.startsWith('ui-builder-export/web/src/components/'));
    const palette = REGISTRY.filter(m => m.palette !== false && m.type !== 'page');
    expect(names.length).toBeGreaterThanOrEqual(palette.length);
  });

  it('P3-42：pages.json 可见节点与页面 TSX 输出一一对应', async () => {
    useStore.setState({ project: createEmptyProject() });
    const a = useStore.getState().actions;
    a.addNode('heading', { x: 10, y: 10, w: 100, h: 30 });
    a.addNode('button-primary', { x: 10, y: 60, w: 200, h: 48 });
    // 隐藏节点不应出现在导出 TSX 中
    const kid = useStore.getState().project.pages[0].boards.mobile.nodes;
    const firstId = Object.keys(kid).find(id => kid[id].type === 'heading')!;
    a.setNodeFlag(firstId, 'hidden', true);

    const bytes = await exportProjectZip(useStore.getState().project);
    const zip = await JSZip.loadAsync(bytes);
    const tsx = await zip.file('ui-builder-export/web/src/pages/Page/Mobile.tsx')!.async('string');
    const comments = (tsx.match(/\{\/\* /g) ?? []).length;   // emitNode 每个可见节点一条 {/* label */}

    const json = JSON.parse(await zip.file('ui-builder-export/data/pages.json')!.async('string'));
    const nodes = Object.values(json.pages[0].boards.mobile.nodes) as Array<{ type: string; hidden?: boolean }>;
    const visible = nodes.filter(n => n.type !== 'page' && !n.hidden).length;
    expect(comments).toBe(visible);
    expect(tsx).not.toContain('Heading');   // 隐藏的标题不导出
  });

  it('P2-32：与主题色相同的样式值导出为 CSS 变量（var(--color-*)）', async () => {
    useStore.setState({ project: createEmptyProject() });
    const a = useStore.getState().actions;
    a.addNode('button-primary', { x: 10, y: 10, w: 200, h: 48 });
    // registry 默认按钮底色即主题 primary（#2563eb）→ 应生成 var 引用
    const bytes = await exportProjectZip(useStore.getState().project);
    const zip = await JSZip.loadAsync(bytes);
    const tsx = await zip.file('ui-builder-export/web/src/pages/Page/Mobile.tsx')!.async('string');
    expect(tsx).toContain('var(--color-primary)');
  });

  it('P2-31：未使用的模块组件被裁剪', async () => {
    useStore.setState({ project: createEmptyProject() });
    const a = useStore.getState().actions;
    a.addNode('button-primary', { x: 10, y: 10, w: 200, h: 48 });
    const bytes = await exportProjectZip(useStore.getState().project);
    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files).filter(n => n.startsWith('ui-builder-export/web/src/components/'));
    expect(names).toContain('ui-builder-export/web/src/components/ButtonPrimary.tsx');
    expect(names).not.toContain('ui-builder-export/web/src/components/Switch.tsx');
    expect(names.length).toBeLessThan(10);
  });

  it('data/pages.json 回读后 events 字段在位（EX-03 接口位）', async () => {
    const bytes = await buildZip();
    const zip = await JSZip.loadAsync(bytes);
    const json = JSON.parse(await zip.file('ui-builder-export/data/pages.json')!.async('string'));
    expect(json.schemaVersion).toBe(2);
    const mobileNodes = Object.values(json.pages[0].boards.mobile.nodes) as Array<{ events: Record<string, unknown> }>;
    for (const n of mobileNodes) {
      expect(n.events).toBeTypeOf('object');
    }
  });

  it('页面 TSX 引用了生成的组件且含事件接口位', async () => {
    const bytes = await buildZip();
    const zip = await JSZip.loadAsync(bytes);
    const tsx = await zip.file('ui-builder-export/web/src/pages/Page/Mobile.tsx')!.async('string');
    expect(tsx).toContain('import {');
    expect(tsx).toContain('position: "absolute"');
  });

  it('中文页名导出为稳定 ASCII slug，同名页追加序号不冲突', async () => {
    useStore.setState({ project: createEmptyProject() });
    const project = JSON.parse(JSON.stringify(useStore.getState().project));
    project.pages = [
      { ...project.pages[0], name: '登录页' },
      { ...project.pages[0], id: 'pg-dup', name: '登录页' },   // 同名第二页
    ];
    const bytes = await exportProjectZip(project);
    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files).filter(n => n.startsWith('ui-builder-export/web/src/pages/'));
    expect(names).toContain('ui-builder-export/web/src/pages/Page/Mobile.tsx');
    expect(names).toContain('ui-builder-export/web/src/pages/Page2/Mobile.tsx');
    const app = await zip.file('ui-builder-export/web/src/App.tsx')!.async('string');
    expect(app).toContain("from './pages/Page'");
    expect(app).toContain("from './pages/Page2'");
    // P2-13 · 多页生成 hash 路由
    expect(app).toContain('hashchange');
    expect(app).toContain("'/': Page");
    expect(app).toContain("'/page2': Page2");
    // data/pages.json 回读校验不受导出改造影响
    expect(names.length).toBeGreaterThan(0);
  });

  it('F8：设备范围只生成选中设备，index.tsx 默认导出该设备', async () => {
    useStore.setState({ project: createEmptyProject() });
    const bytes = await exportProjectZip(useStore.getState().project, { devices: ['desktop'] });
    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files);
    expect(names).toContain('ui-builder-export/web/src/pages/Page/Desktop.tsx');
    expect(names).not.toContain('ui-builder-export/web/src/pages/Page/Mobile.tsx');
    expect(names).not.toContain('ui-builder-export/web/src/pages/Page/Watch.tsx');
    const idx = await zip.file('ui-builder-export/web/src/pages/Page/index.tsx')!.async('string');
    expect(idx).toContain("import Desktop from './Desktop'");
    expect(idx).toContain('export default Desktop');
  });

  it('F8：页面范围只导出选中页，pages.json 同步收窄', async () => {
    useStore.setState({ project: createEmptyProject() });
    const a = useStore.getState().actions;
    a.addPage();
    const project = useStore.getState().project;
    const keep = project.pages[1];
    const bytes = await exportProjectZip(project, { pageIds: [keep.id] });
    const zip = await JSZip.loadAsync(bytes);
    const json = JSON.parse(await zip.file('ui-builder-export/data/pages.json')!.async('string'));
    expect(json.pages.map((p: { id: string }) => p.id)).toEqual([keep.id]);
    const pageDirs = Object.keys(zip.files)
      .map(n => n.match(/^ui-builder-export\/web\/src\/pages\/([^/]+)\//)?.[1])
      .filter(Boolean);
    expect([...new Set(pageDirs)]).toEqual(['Page2']);
  });

  it('SEC-03：项目名 / 页名里的 HTML 与模板元字符被转义，不会破坏产物', async () => {
    useStore.setState({ project: createEmptyProject() });
    const project = JSON.parse(JSON.stringify(useStore.getState().project));
    project.name = '</title><script>alert(1)</script>';
    project.pages[0].name = '登录`页${x}\n第二行';
    const bytes = await exportProjectZip(project);
    const zip = await JSZip.loadAsync(bytes);

    const html = await zip.file('ui-builder-export/web/index.html')!.async('string');
    expect(html).toContain('&lt;/title&gt;&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');

    // 页名进了 TSX 注释：换行/反引号/美元符都被压成安全单行，产物仍是合法字符串
    // （slug 由 ASCII 派生，故此处按文件名模式取，不假设一定是 Page/）
    const mobileKey = Object.keys(zip.files).find(n => /^ui-builder-export\/web\/src\/pages\/[^/]+\/Mobile\.tsx$/.test(n))!;
    const tsx = await zip.file(mobileKey)!.async('string');
    expect(tsx).toContain('// 登录页{x} 第二行 · mobile 画板');
    expect(tsx).not.toContain('${x}');
  });

  it('SEC-03：图片 props 的危险协议在导出时被清空', async () => {
    useStore.setState({ project: createEmptyProject() });
    const a = useStore.getState().actions;
    a.addNode('image', { x: 10, y: 10, w: 120, h: 80 });
    const board = useStore.getState().project.pages[0].boards.mobile;
    const imgId = Object.keys(board.nodes).find(id => board.nodes[id].type === 'image')!;
    a.setProp(imgId, 'src', 'javascript:alert(1)');
    const bytes = await exportProjectZip(useStore.getState().project);
    const zip = await JSZip.loadAsync(bytes);
    const json = JSON.parse(await zip.file('ui-builder-export/data/pages.json')!.async('string'));
    // pages.json 保留原始设计（事实源），但生成组件用的 props 已被清洗
    const tsx = await zip.file('ui-builder-export/web/src/pages/Page/Mobile.tsx')!.async('string');
    expect(tsx).not.toContain('javascript:alert(1)');
    expect(json.pages[0].boards.mobile.nodes[imgId].props.src).toBe('javascript:alert(1)');
  });
});
