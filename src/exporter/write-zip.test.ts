// W5 · 导出端到端准备：把 zip 落盘到 /tmp/ub-e2e.zip（随后用 shell 解压构建验证）
import { describe, it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { exportProjectZip } from './exporter';
import { useStore, createEmptyProject } from '../store';

describe('EX · 导出 zip 落盘（端到端前置）', () => {
  it('生成含登录页设计的 zip 并写入 /tmp/ub-e2e.zip', async () => {
    useStore.setState({ project: createEmptyProject() });
    const a = useStore.getState().actions;
    // 一个典型登录页：状态栏 + 导航 + 标题 + 两个输入框 + 主按钮 + Home 条
    a.addNode('mobile-statusbar', { x: 0, y: 0, w: 390, h: 44 });
    a.addNode('topnav', { x: 0, y: 44, w: 390, h: 44 });
    a.addNode('heading', { x: 24, y: 120, w: 200, h: 34 });
    a.addNode('input', { x: 24, y: 190, w: 342, h: 48 });
    a.addNode('password', { x: 24, y: 254, w: 342, h: 48 });
    a.addNode('button-primary', { x: 24, y: 330, w: 342, h: 48 });
    a.addNode('home-indicator', { x: 0, y: 820, w: 390, h: 24 });
    // 备注示例
    const root = useStore.getState().project.pages[0].boards.mobile.nodes[useStore.getState().project.pages[0].boards.mobile.rootId];
    const btnId = root.children[5];
    a.setNodeNote(btnId, '此按钮用于提交登录表单');

    const bytes = await exportProjectZip(useStore.getState().project);
    mkdirSync('/tmp', { recursive: true });
    writeFileSync('/tmp/ub-e2e.zip', bytes);
  });
});
