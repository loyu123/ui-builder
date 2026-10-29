// F2 · 内置模板库：全部用 registry 元数据构建（style/props 以模块定义为底，模板只覆盖需要的键），
// 保证模板与模块库不漂移（templates.test.ts 校验 props 键 ⊆ registry 字段/默认 props）。
// v1.2.1 · 每套模板同时提供 **手机（390×844）** 与 **电脑（1440×900）** 两套布局；手表画板留空待设计。
import { mk } from '../store/builders';
import type { Board, Project } from '../types';
import { emptyProject } from '../store/project';

export interface TemplateDef {
  id: string;
  label: string;
  labelEn: string;
  devices: Array<'mobile' | 'desktop'>;
  build: () => Project;
}

/** 新建一个只含单页的项目骨架，同时返回手机/电脑两块画板 */
function base(name: string): { project: Project; mobile: Board; desktop: Board } {
  const project = emptyProject();
  project.name = name;
  project.pages[0].name = '首页';
  return {
    project,
    mobile: project.pages[0].boards.mobile,
    desktop: project.pages[0].boards.desktop,
  };
}

// ======================= 模板 1：登录页 =======================
function buildLogin(): Project {
  const { project, mobile, desktop } = base('模板 · 登录页');

  // —— 手机 ——
  mk(mobile, 'mobile-statusbar', { x: 0, y: 0, w: 390, h: 44 });
  mk(mobile, 'topnav', { x: 0, y: 44, w: 390, h: 44 }, { props: { title: '欢迎回来' } });
  mk(mobile, 'heading', { x: 24, y: 120, w: 260, h: 34 }, { props: { text: '登录你的账号' } });
  mk(mobile, 'paragraph', { x: 24, y: 160, w: 320, h: 22 }, { props: { text: '输入手机号与密码继续' } });
  mk(mobile, 'input', { x: 24, y: 204, w: 342, h: 48 }, { props: { label: '手机号', placeholder: '请输入手机号' } });
  mk(mobile, 'password', { x: 24, y: 268, w: 342, h: 48 }, { props: { label: '密码', placeholder: '请输入密码' } });
  mk(mobile, 'button-primary', { x: 24, y: 344, w: 342, h: 48 }, { props: { label: '登 录' }, note: '提交登录表单' });
  mk(mobile, 'link', { x: 24, y: 404, w: 120, h: 32 }, { props: { label: '忘记密码？' } });
  mk(mobile, 'home-indicator', { x: 0, y: 820, w: 390, h: 24 });

  // —— 电脑（左品牌右表单） ——
  mk(desktop, 'group', { x: 0, y: 0, w: 720, h: 900 }, {
    style: { background: 'rgba(37,99,235,.06)', radius: 0 },
  });
  mk(desktop, 'icon', { x: 96, y: 300, w: 40, h: 40 }, { props: { glyph: '◆' }, style: { color: '#2563eb', fontSize: 26 } });
  mk(desktop, 'heading', { x: 96, y: 356, w: 420, h: 48 }, { props: { text: '把会员管理做得像样一点' }, style: { fontSize: 34, fontWeight: 700, color: '#111827' } });
  mk(desktop, 'paragraph', { x: 96, y: 420, w: 460, h: 56 }, { props: { text: '一个界面搭出来的演示项目，模块可拖、可改、可导出。' }, style: { fontSize: 15, color: '#4b5563' } });

  const card = mk(desktop, 'card', { x: 800, y: 190, w: 480, h: 460 }, {
    style: { background: '#ffffff', radius: 14, boxShadow: 'inset 0 0 0 1px #e3e6ea' },
  });
  mk(desktop, 'heading', { x: 40, y: 40, w: 320, h: 34 }, { props: { text: '欢迎回来' }, parentId: card.id, style: { fontSize: 24, fontWeight: 700, color: '#111827' } });
  mk(desktop, 'paragraph', { x: 40, y: 78, w: 360, h: 22 }, { props: { text: '登录后可查看本次会员数据概览' }, parentId: card.id, style: { fontSize: 13, color: '#6b7280' } });
  mk(desktop, 'input', { x: 40, y: 132, w: 400, h: 48 }, { props: { label: '手机号', placeholder: '请输入手机号' }, parentId: card.id });
  mk(desktop, 'password', { x: 40, y: 196, w: 400, h: 48 }, { props: { label: '密码', placeholder: '至少 8 位字符' }, parentId: card.id });
  mk(desktop, 'button-primary', { x: 40, y: 268, w: 400, h: 48 }, { props: { label: '登 录' }, parentId: card.id, note: '提交登录表单' });
  mk(desktop, 'link', { x: 40, y: 332, w: 160, h: 32 }, { props: { label: '忘记密码？' }, parentId: card.id });
  return project;
}

// ======================= 模板 2：消息列表 =======================
function buildList(): Project {
  const { project, mobile, desktop } = base('模板 · 消息列表');
  const rows: Array<[string, string]> = [
    ['系统通知', '您的账号已在新设备登录'],
    ['订单提醒', '订单已发货，预计明天送达'],
    ['好友消息', '周末一起去看展吗？'],
    ['活动推送', '新用户专享礼包已到账'],
  ];

  // —— 手机 ——
  mk(mobile, 'mobile-statusbar', { x: 0, y: 0, w: 390, h: 44 });
  mk(mobile, 'topnav', { x: 0, y: 44, w: 390, h: 44 }, { props: { title: '消息' } });
  rows.forEach(([title, subtitle], i) => {
    mk(mobile, 'list-item', { x: 0, y: 88 + i * 72, w: 390, h: 72 }, { props: { title, subtitle } });
  });
  mk(mobile, 'tabbar', { x: 0, y: 788, w: 390, h: 56 }, { props: { tabs: '消息,通讯录,我的' } });
  mk(mobile, 'home-indicator', { x: 0, y: 820, w: 390, h: 24 });

  // —— 电脑（左侧栏 + 表格） ——
  mk(desktop, 'topnav', { x: 0, y: 0, w: 1440, h: 64 }, { props: { title: '会员管理 · 消息中心' } });
  const side = mk(desktop, 'group', { x: 0, y: 64, w: 240, h: 836 }, {
    style: { background: '#f8f9fb', radius: 0 },
  });
  ['消息', '通讯录', '我的', '设置'].forEach((label, i) => {
    mk(desktop, 'list-item', { x: 12, y: 16 + i * 56, w: 216, h: 48 }, { props: { title: label, subtitle: '' }, parentId: side.id });
  });
  mk(desktop, 'heading', { x: 280, y: 96, w: 320, h: 34 }, { props: { text: '消息' } });
  mk(desktop, 'table', { x: 280, y: 148, w: 1120, h: 480 }, { props: { rows: '5' } });
  mk(desktop, 'paragraph', { x: 280, y: 648, w: 520, h: 22 }, { props: { text: '共 4 条未读消息 · 支持按关键词筛选' } });
  return project;
}

// ======================= 模板 3：商品详情 =======================
function buildDetail(): Project {
  const { project, mobile, desktop } = base('模板 · 商品详情');

  // —— 手机 ——
  mk(mobile, 'mobile-statusbar', { x: 0, y: 0, w: 390, h: 44 });
  mk(mobile, 'topnav', { x: 0, y: 44, w: 390, h: 44 }, { props: { title: '商品详情' } });
  mk(mobile, 'image', { x: 0, y: 88, w: 390, h: 240 }, { props: { alt: '商品主图' } });
  mk(mobile, 'heading', { x: 24, y: 344, w: 280, h: 34 }, { props: { text: '手工陶瓷马克杯' } });
  mk(mobile, 'paragraph', { x: 24, y: 384, w: 342, h: 60 }, { props: { text: '手工拉坯成型，每一只的釉色纹理都略有差异。' } });
  mk(mobile, 'divider', { x: 24, y: 456, w: 342, h: 1 });
  mk(mobile, 'stat', { x: 24, y: 476, w: 180, h: 96 }, { props: { label: '到手价', value: '129', unit: '元' } });
  mk(mobile, 'progress', { x: 24, y: 588, w: 342, h: 22 }, { props: { value: 68 } });
  mk(mobile, 'button-primary', { x: 24, y: 748, w: 342, h: 48 }, { props: { label: '加入购物车' }, note: '加入购物车（后续接接口）' });
  mk(mobile, 'home-indicator', { x: 0, y: 820, w: 390, h: 24 });

  // —— 电脑（左图右信息） ——
  mk(desktop, 'topnav', { x: 0, y: 0, w: 1440, h: 64 }, { props: { title: '商品详情' } });
  mk(desktop, 'image', { x: 96, y: 112, w: 560, h: 440 }, { props: { alt: '商品主图' }, style: { radius: 12 } });
  mk(desktop, 'heading', { x: 720, y: 128, w: 560, h: 44 }, { props: { text: '手工陶瓷马克杯' }, style: { fontSize: 30, fontWeight: 700, color: '#111827' } });
  mk(desktop, 'paragraph', { x: 720, y: 188, w: 560, h: 72 }, { props: { text: '手工拉坯成型，1280℃ 高温烧制。每一只的釉色纹理都略有差异，这正是手作的痕迹。' }, style: { fontSize: 15, color: '#4b5563' } });
  mk(desktop, 'divider', { x: 720, y: 292, w: 560, h: 1 });
  mk(desktop, 'stat', { x: 720, y: 316, w: 260, h: 96 }, { props: { label: '到手价', value: '129', unit: '元' } });
  mk(desktop, 'progress', { x: 1000, y: 352, w: 280, h: 22 }, { props: { value: 68 } });
  mk(desktop, 'button-primary', { x: 720, y: 456, w: 240, h: 48 }, { props: { label: '加入购物车' }, note: '加入购物车（后续接接口）' });
  mk(desktop, 'button-secondary', { x: 976, y: 456, w: 160, h: 48 }, { props: { label: '收藏' } });
  mk(desktop, 'paragraph', { x: 720, y: 524, w: 520, h: 22 }, { props: { text: '库存 32 件 · 48 小时内发货 · 支持 7 天无理由' } });
  return project;
}

// ======================= 模板 4：个人中心 =======================
function buildProfile(): Project {
  const { project, mobile, desktop } = base('模板 · 个人中心');
  const rows: Array<[string, string]> = [
    ['收货地址', '管理已保存的地址'],
    ['优惠券', '3 张即将过期'],
    ['设置', '账号与隐私'],
  ];

  // —— 手机 ——
  mk(mobile, 'mobile-statusbar', { x: 0, y: 0, w: 390, h: 44 });
  mk(mobile, 'topnav', { x: 0, y: 44, w: 390, h: 44 }, { props: { title: '我的' } });
  mk(mobile, 'avatar', { x: 24, y: 104, w: 64, h: 64 }, { props: { name: '林小满' } });
  mk(mobile, 'heading', { x: 104, y: 112, w: 200, h: 30 }, { props: { text: '林小满' } });
  mk(mobile, 'paragraph', { x: 104, y: 146, w: 200, h: 20 }, { props: { text: '普通会员 · 积分 320' } });
  mk(mobile, 'stat', { x: 24, y: 192, w: 165, h: 88 }, { props: { label: '待收货', value: '2', unit: '单' } });
  mk(mobile, 'stat', { x: 201, y: 192, w: 165, h: 88 }, { props: { label: '收藏', value: '8', unit: '个' } });
  rows.forEach(([title, subtitle], i) => {
    mk(mobile, 'list-item', { x: 0, y: 300 + i * 64, w: 390, h: 64 }, { props: { title, subtitle } });
  });
  mk(mobile, 'tabbar', { x: 0, y: 788, w: 390, h: 56 }, { props: { tabs: '首页,发现,我的' } });
  mk(mobile, 'home-indicator', { x: 0, y: 820, w: 390, h: 24 });

  // —— 电脑（左侧资料卡 + 右侧设置列表） ——
  mk(desktop, 'topnav', { x: 0, y: 0, w: 1440, h: 64 }, { props: { title: '我的账号' } });
  const card = mk(desktop, 'card', { x: 96, y: 112, w: 480, h: 260 }, {
    style: { background: '#ffffff', radius: 14, boxShadow: 'inset 0 0 0 1px #e3e6ea' },
  });
  mk(desktop, 'avatar', { x: 32, y: 36, w: 72, h: 72 }, { props: { name: '林小满' }, parentId: card.id });
  mk(desktop, 'heading', { x: 128, y: 52, w: 240, h: 30 }, { props: { text: '林小满' }, parentId: card.id });
  mk(desktop, 'paragraph', { x: 128, y: 90, w: 260, h: 20 }, { props: { text: '普通会员 · 积分 320' }, parentId: card.id });
  mk(desktop, 'button-secondary', { x: 32, y: 150, w: 160, h: 40 }, { props: { label: '编辑资料' }, parentId: card.id });
  mk(desktop, 'stat', { x: 96, y: 404, w: 232, h: 96 }, { props: { label: '待收货', value: '2', unit: '单' } });
  mk(desktop, 'stat', { x: 344, y: 404, w: 232, h: 96 }, { props: { label: '收藏', value: '8', unit: '个' } });
  rows.forEach(([title, subtitle], i) => {
    mk(desktop, 'list-item', { x: 624, y: 112 + i * 64, w: 720, h: 64 }, { props: { title, subtitle } });
  });
  return project;
}

// ======================= 模板 5：空状态 =======================
function buildEmpty(): Project {
  const { project, mobile, desktop } = base('模板 · 空状态');

  // —— 手机 ——
  mk(mobile, 'mobile-statusbar', { x: 0, y: 0, w: 390, h: 44 });
  mk(mobile, 'topnav', { x: 0, y: 44, w: 390, h: 44 }, { props: { title: '还没有内容' } });
  mk(mobile, 'icon', { x: 171, y: 260, w: 48, h: 48 }, { props: { glyph: '✧' } });
  mk(mobile, 'heading', { x: 85, y: 324, w: 220, h: 30 }, { props: { text: '这里还是空的' } });
  mk(mobile, 'paragraph', { x: 45, y: 362, w: 300, h: 44 }, { props: { text: '创建第一条内容，开始你的设计。' } });
  mk(mobile, 'button-secondary', { x: 95, y: 430, w: 200, h: 44 }, { props: { label: '创建内容' } });
  mk(mobile, 'home-indicator', { x: 0, y: 820, w: 390, h: 24 });

  // —— 电脑（居中空态） ——
  mk(desktop, 'topnav', { x: 0, y: 0, w: 1440, h: 64 }, { props: { title: '还没有内容' } });
  mk(desktop, 'icon', { x: 696, y: 280, w: 48, h: 48 }, { props: { glyph: '✧' }, style: { color: '#2563eb', fontSize: 30 } });
  mk(desktop, 'heading', { x: 610, y: 348, w: 220, h: 34 }, { props: { text: '这里还是空的' }, style: { fontSize: 22, fontWeight: 700, color: '#111827' } });
  mk(desktop, 'paragraph', { x: 570, y: 392, w: 300, h: 22 }, { props: { text: '创建第一条内容，开始你的设计。' }, style: { fontSize: 14, color: '#6b7280' } });
  mk(desktop, 'button-secondary', { x: 620, y: 440, w: 200, h: 44 }, { props: { label: '创建内容' } });
  return project;
}

export const TEMPLATES: TemplateDef[] = [
  { id: 'login', label: '登录页', labelEn: 'Login', devices: ['mobile', 'desktop'], build: buildLogin },
  { id: 'list', label: '消息列表', labelEn: 'Message list', devices: ['mobile', 'desktop'], build: buildList },
  { id: 'detail', label: '商品详情', labelEn: 'Product detail', devices: ['mobile', 'desktop'], build: buildDetail },
  { id: 'profile', label: '个人中心', labelEn: 'Profile', devices: ['mobile', 'desktop'], build: buildProfile },
  { id: 'empty', label: '空状态', labelEn: 'Empty state', devices: ['mobile', 'desktop'], build: buildEmpty },
];

export function createFromTemplate(id: string): Project | null {
  const tpl = TEMPLATES.find(x => x.id === id);
  return tpl ? tpl.build() : null;
}
