// F2 · 内置模板库：全部用 registry 元数据构建（style/props 以模块定义为底，模板只覆盖需要的键），
// 保证模板与模块库不漂移（templates.test.ts 校验 props 键 ⊆ registry 字段/默认 props）。
import { uid } from '../lib/id';
import { REGISTRY_MAP } from '../modules/registry';
import type { Board, Node, Project } from '../types';
import { emptyProject } from '../store/project';

export interface TemplateDef {
  id: string;
  label: string;
  labelEn: string;
  build: () => Project;
}

type Frame = { x: number; y: number; w: number; h: number };

// 在画板根下追加一个模块（props 以 registry 默认值为底）
function mk(
  board: Board,
  type: string,
  frame: Frame,
  props: Record<string, unknown> = {},
  note?: string,
): Node {
  const meta = REGISTRY_MAP[type];
  const root = board.nodes[board.rootId];
  const n: Node = {
    id: uid('n'),
    type,
    name: meta?.label ?? type,
    parentId: root.id,
    children: [],
    frame,
    style: { ...(meta?.style ?? {}) },
    props: {
      ...(JSON.parse(JSON.stringify(meta?.props ?? {})) as Record<string, unknown>),
      ...props,
    },
    events: { onClick: { action: 'none', note: '占位，后续接真实行为' } },
  };
  if (note) n.note = note;
  root.children.push(n.id);
  board.nodes[n.id] = n;
  return n;
}

/** 新建一个只含单页、面向手机画板的项目骨架 */
function base(name: string): { project: Project; board: Board } {
  const project = emptyProject();
  project.name = name;
  project.pages[0].name = '首页';
  return { project, board: project.pages[0].boards.mobile };
}

// ---------- 模板 1：登录页 ----------
function buildLogin(): Project {
  const { project, board } = base('模板 · 登录页');
  mk(board, 'mobile-statusbar', { x: 0, y: 0, w: 390, h: 44 });
  mk(board, 'topnav', { x: 0, y: 44, w: 390, h: 44 }, { title: '欢迎回来' });
  mk(board, 'heading', { x: 24, y: 120, w: 260, h: 34 }, { text: '登录你的账号' });
  mk(board, 'paragraph', { x: 24, y: 160, w: 320, h: 22 }, { text: '输入手机号与密码继续' });
  mk(board, 'input', { x: 24, y: 204, w: 342, h: 48 }, { label: '手机号', placeholder: '请输入手机号' });
  mk(board, 'password', { x: 24, y: 268, w: 342, h: 48 }, { label: '密码', placeholder: '请输入密码' });
  mk(board, 'button-primary', { x: 24, y: 344, w: 342, h: 48 }, { label: '登 录' }, '提交登录表单');
  mk(board, 'link', { x: 24, y: 404, w: 120, h: 32 }, { label: '忘记密码？' });
  mk(board, 'home-indicator', { x: 0, y: 820, w: 390, h: 24 });
  return project;
}

// ---------- 模板 2：消息列表 ----------
function buildList(): Project {
  const { project, board } = base('模板 · 消息列表');
  mk(board, 'mobile-statusbar', { x: 0, y: 0, w: 390, h: 44 });
  mk(board, 'topnav', { x: 0, y: 44, w: 390, h: 44 }, { title: '消息' });
  const rows: Array<[string, string]> = [
    ['系统通知', '您的账号已在新设备登录'],
    ['订单提醒', '订单已发货，预计明天送达'],
    ['好友消息', '周末一起去看展吗？'],
    ['活动推送', '新用户专享礼包已到账'],
  ];
  rows.forEach(([title, subtitle], i) => {
    mk(board, 'list-item', { x: 0, y: 88 + i * 72, w: 390, h: 72 }, { title, subtitle });
  });
  mk(board, 'tabbar', { x: 0, y: 788, w: 390, h: 56 }, { tabs: '消息,通讯录,我的' });
  mk(board, 'home-indicator', { x: 0, y: 820, w: 390, h: 24 });
  return project;
}

// ---------- 模板 3：商品详情 ----------
function buildDetail(): Project {
  const { project, board } = base('模板 · 商品详情');
  mk(board, 'mobile-statusbar', { x: 0, y: 0, w: 390, h: 44 });
  mk(board, 'topnav', { x: 0, y: 44, w: 390, h: 44 }, { title: '商品详情' });
  mk(board, 'image', { x: 0, y: 88, w: 390, h: 240 }, { alt: '商品主图' });
  mk(board, 'heading', { x: 24, y: 344, w: 280, h: 34 }, { text: '手工陶瓷马克杯' });
  mk(board, 'paragraph', { x: 24, y: 384, w: 342, h: 60 }, { text: '手工拉坯成型，每一只的釉色纹理都略有差异。' });
  mk(board, 'divider', { x: 24, y: 456, w: 342, h: 1 });
  mk(board, 'stat', { x: 24, y: 476, w: 180, h: 96 }, { label: '到手价', value: '129', unit: '元' });
  mk(board, 'progress', { x: 24, y: 588, w: 342, h: 22 }, { value: 68 });
  mk(board, 'button-primary', { x: 24, y: 748, w: 342, h: 48 }, { label: '加入购物车' }, '加入购物车（后续接接口）');
  mk(board, 'home-indicator', { x: 0, y: 820, w: 390, h: 24 });
  return project;
}

// ---------- 模板 4：个人中心 ----------
function buildProfile(): Project {
  const { project, board } = base('模板 · 个人中心');
  mk(board, 'mobile-statusbar', { x: 0, y: 0, w: 390, h: 44 });
  mk(board, 'topnav', { x: 0, y: 44, w: 390, h: 44 }, { title: '我的' });
  mk(board, 'avatar', { x: 24, y: 104, w: 64, h: 64 }, { name: '林小满' });
  mk(board, 'heading', { x: 104, y: 112, w: 200, h: 30 }, { text: '林小满' });
  mk(board, 'paragraph', { x: 104, y: 146, w: 200, h: 20 }, { text: '普通会员 · 积分 320' });
  mk(board, 'stat', { x: 24, y: 192, w: 165, h: 88 }, { label: '待收货', value: '2', unit: '单' });
  mk(board, 'stat', { x: 201, y: 192, w: 165, h: 88 }, { label: '收藏', value: '8', unit: '个' });
  const rows: Array<[string, string]> = [
    ['收货地址', '管理已保存的地址'],
    ['优惠券', '3 张即将过期'],
    ['设置', '账号与隐私'],
  ];
  rows.forEach(([title, subtitle], i) => {
    mk(board, 'list-item', { x: 0, y: 300 + i * 64, w: 390, h: 64 }, { title, subtitle });
  });
  mk(board, 'tabbar', { x: 0, y: 788, w: 390, h: 56 }, { tabs: '首页,发现,我的' });
  mk(board, 'home-indicator', { x: 0, y: 820, w: 390, h: 24 });
  return project;
}

// ---------- 模板 5：空状态 ----------
function buildEmpty(): Project {
  const { project, board } = base('模板 · 空状态');
  mk(board, 'mobile-statusbar', { x: 0, y: 0, w: 390, h: 44 });
  mk(board, 'topnav', { x: 0, y: 44, w: 390, h: 44 }, { title: '还没有内容' });
  mk(board, 'icon', { x: 171, y: 260, w: 48, h: 48 }, { glyph: '✧' });
  mk(board, 'heading', { x: 85, y: 324, w: 220, h: 30 }, { text: '这里还是空的' });
  mk(board, 'paragraph', { x: 45, y: 362, w: 300, h: 44 }, { text: '创建第一条内容，开始你的设计。' });
  mk(board, 'button-secondary', { x: 95, y: 430, w: 200, h: 44 }, { label: '创建内容' });
  mk(board, 'home-indicator', { x: 0, y: 820, w: 390, h: 24 });
  return project;
}

export const TEMPLATES: TemplateDef[] = [
  { id: 'login', label: '登录页', labelEn: 'Login', build: buildLogin },
  { id: 'list', label: '消息列表', labelEn: 'Message list', build: buildList },
  { id: 'detail', label: '商品详情', labelEn: 'Product detail', build: buildDetail },
  { id: 'profile', label: '个人中心', labelEn: 'Profile', build: buildProfile },
  { id: 'empty', label: '空状态', labelEn: 'Empty state', build: buildEmpty },
];

export function createFromTemplate(id: string): Project | null {
  const tpl = TEMPLATES.find(x => x.id === id);
  return tpl ? tpl.build() : null;
}
