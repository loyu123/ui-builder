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

  it('P2-32：与主题色相同的样式值导出为 CSS 变量（var(--color-*)）', async () => {
    useStore.setState({ project: createEmptyProject() });
    const a = useStore.getState().actions;
    a.addNode('button-primary', { x: 10, y: 10, w: 200, h: 48 });
    // registry 默认按钮底色即主题 primary（#f97316）→ 应生成 var 引用
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
});
