// W5 · 导出端到端准备：多页 + navigate 事件场景，zip 落盘 /tmp/ub-e2e.zip（随后 shell 解压构建验证）
import { describe, it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { exportProjectZip } from './exporter';
import { useStore, createEmptyProject } from '../store';

describe('EX · 导出 zip 落盘（端到端前置）', () => {
  it('生成双页（登录页→首页 navigate）设计的 zip 并写入 /tmp/ub-e2e.zip', async () => {
    useStore.setState({ project: createEmptyProject() });
    const a = useStore.getState().actions;
    // 页 1 · 登录页：状态栏 + 导航 + 标题 + 两个输入框 + 主按钮（navigate 到页 2）+ Home 条
    a.addNode('mobile-statusbar', { x: 0, y: 0, w: 390, h: 44 });
    a.addNode('topnav', { x: 0, y: 44, w: 390, h: 44 });
    a.addNode('heading', { x: 24, y: 120, w: 200, h: 34 });
    a.addNode('input', { x: 24, y: 190, w: 342, h: 48 });
    a.addNode('password', { x: 24, y: 254, w: 342, h: 48 });
    a.addNode('button-primary', { x: 24, y: 330, w: 342, h: 48 });
    a.addNode('home-indicator', { x: 0, y: 820, w: 390, h: 24 });
    const p1 = useStore.getState().project.pages[0];
    const b1 = p1.boards.mobile;
    const btnId = b1.nodes[b1.rootId].children[5];
    a.setNodeNote(btnId, '此按钮用于提交登录表单');
    // P2-13 · 按钮 navigate 到页 2（注意 addPage 会切换当前页，先切回页 1 再改按钮事件）
    a.addPage();
    const st = useStore.getState();
    const p2 = st.project.pages[1];
    a.setPage(p1.id);
    a.setNodeEvent(btnId, 'onClick', { action: 'navigate', target: p2.id, note: '登录成功进入首页' });
    a.addNode('heading', { x: 24, y: 120, w: 200, h: 34 });   // 页 2 放个标题

    const bytes = await exportProjectZip(useStore.getState().project);
    mkdirSync('/tmp', { recursive: true });
    writeFileSync('/tmp/ub-e2e.zip', bytes);
  });
});
