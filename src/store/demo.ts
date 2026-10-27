// P2-34 · 示例项目：URL 带 ?demo=login 时灌入完整登录页设计，方便演示与回归
import { uid } from '../lib/id';
import { REGISTRY_MAP } from '../modules/registry';
import type { Node, Project } from '../types';
import { emptyProject } from './project';

export function demoLoginProject(): Project {
  const p = emptyProject();
  p.name = '示例 · 登录页';
  const board = p.pages[0].boards.mobile;
  const root = board.nodes[board.rootId];

  const mk = (
    type: string,
    frame: { x: number; y: number; w: number; h: number },
    props: Record<string, unknown> = {},
    note?: string,
  ): Node => {
    const meta = REGISTRY_MAP[type];
    const n: Node = {
      id: uid('n'), type,
      name: meta?.label ?? type,
      parentId: root.id, children: [],
      frame,
      style: { ...(meta?.style ?? {}) },
      props: { ...(JSON.parse(JSON.stringify(meta?.props ?? {})) as Record<string, unknown>), ...props },
      events: {},
    };
    if (note) n.note = note;
    root.children.push(n.id);
    board.nodes[n.id] = n;
    return n;
  };

  mk('mobile-statusbar', { x: 0, y: 0, w: 390, h: 44 });
  mk('topnav', { x: 0, y: 44, w: 390, h: 44 }, { title: '欢迎回来' });
  mk('heading', { x: 24, y: 120, w: 240, h: 34 }, { text: '登录你的账号' });
  mk('paragraph', { x: 24, y: 160, w: 320, h: 22 }, { text: '输入手机号与密码继续' });
  mk('input', { x: 24, y: 204, w: 342, h: 48 }, { label: '手机号', placeholder: '请输入手机号' });
  mk('password', { x: 24, y: 268, w: 342, h: 48 }, { label: '密码', placeholder: '请输入密码' });
  mk('button-primary', { x: 24, y: 344, w: 342, h: 48 }, { text: '登 录' }, '提交登录表单');
  mk('home-indicator', { x: 0, y: 820, w: 390, h: 24 });
  return p;
}
