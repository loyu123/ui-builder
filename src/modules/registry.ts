// LB-01 · 模块注册表 —— 30 个模块的唯一元数据源
// 属性面板字段、模块库缩略、拖入默认值全部由此驱动；新增模块只改这里
// P3-40 · labelEn 为英文展示名（i18n），缺省回退中文 label；导出注释仍用中文 label
import type { DeviceId } from '../types';

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'color' | 'select';
  target: 'props' | 'style';
  options?: string[];
  min?: number;
  max?: number;
}

export interface ModuleDef {
  type: string;
  label: string;
  labelEn?: string;
  category: string;
  w: number;
  h: number;
  isContainer?: boolean;
  palette?: boolean;                       // false = 不出现在模块库（如页面根）
  devices?: DeviceId[];                    // 限定设备；缺省 = 全部
  props: Record<string, unknown>;
  style: Record<string, string | number>;
  fields: FieldDef[];
}

const fText = (key: string, label: string): FieldDef => ({ key, label, type: 'text', target: 'props' });
const fArea = (key: string, label: string): FieldDef => ({ key, label, type: 'textarea', target: 'props' });
const fNum = (key: string, label: string, target: 'props' | 'style' = 'style', min = 0, max = 999): FieldDef => ({ key, label, type: 'number', target, min, max });
const fColor = (key: string, label: string): FieldDef => ({ key, label, type: 'color', target: 'style' });
const fSel = (key: string, label: string, options: string[]): FieldDef => ({ key, label, type: 'select', target: 'style', options });

// 常用样式字段组
const styleCommon: FieldDef[] = [
  fColor('background', '填充'),
  fColor('color', '文字色'),
  fNum('fontSize', '字号'),
  fSel('fontWeight', '字重', ['400', '600', '700']),
  fNum('radius', '圆角'),
];

export const REGISTRY: ModuleDef[] = [
  // ---------- 基础容器（LB-02） ----------
  {
    type: 'page', label: '页面根容器', labelEn: 'Page root', category: '基础容器', w: 390, h: 844,
    palette: false, isContainer: true,
    props: {}, style: { background: '#ffffff' }, fields: [fColor('background', '背景')],
  },
  {
    type: 'group', label: '分组容器', labelEn: 'Group', category: '基础容器', w: 320, h: 200,
    isContainer: true,
    props: {}, style: { background: 'rgba(249,115,22,.05)', radius: 8 },
    fields: [fColor('background', '填充'), fNum('radius', '圆角')],
  },
  {
    type: 'card', label: '卡片', labelEn: 'Card', category: '基础容器', w: 280, h: 160,
    isContainer: true,
    props: {}, style: { background: '#ffffff', radius: 12, boxShadow: 'inset 0 0 0 1px #e5e7eb' },
    fields: [fColor('background', '填充'), fNum('radius', '圆角')],
  },
  {
    type: 'divider', label: '分割线', labelEn: 'Divider', category: '基础容器', w: 240, h: 1,
    props: {}, style: { background: '#e5e7eb' },
    fields: [fColor('background', '颜色')],
  },

  // ---------- 文字与媒体（LB-03） ----------
  {
    type: 'heading', label: '标题', labelEn: 'Heading', category: '文字与媒体', w: 200, h: 34,
    props: { text: '欢迎回来' }, style: { fontSize: 22, fontWeight: 700, color: '#1f2328' },
    fields: [fText('text', '文字'), ...styleCommon],
  },
  {
    type: 'paragraph', label: '正文段落', labelEn: 'Paragraph', category: '文字与媒体', w: 240, h: 48,
    props: { text: '这里是一段说明文字。' }, style: { fontSize: 14, color: '#6b7280' },
    fields: [fArea('text', '文字'), fColor('color', '文字色'), fNum('fontSize', '字号')],
  },
  {
    type: 'image', label: '图片', labelEn: 'Image', category: '文字与媒体', w: 200, h: 140,
    props: { src: '', alt: '图片' }, style: { radius: 8, background: '#f3f4f6' },
    fields: [fText('src', '图片地址'), fText('alt', '替代文字'), fNum('radius', '圆角'), fColor('background', '占位底色')],
  },
  {
    type: 'icon', label: '图标', labelEn: 'Icon', category: '文字与媒体', w: 32, h: 32,
    props: { glyph: '★' }, style: { color: '#1f2328', fontSize: 20 },
    fields: [fText('glyph', '符号'), fColor('color', '颜色'), fNum('fontSize', '大小')],
  },
  {
    type: 'avatar', label: '头像框', labelEn: 'Avatar', category: '文字与媒体', w: 56, h: 56,
    props: { name: '会员', src: '' }, style: { background: '#fde8d7', color: '#c2410c', fontSize: 20 },
    fields: [fText('name', '姓名（无图时显示首字）'), fText('src', '头像地址'), fColor('background', '底色')],
  },

  // ---------- 表单输入（LB-04） ----------
  {
    type: 'input', label: '单行输入框', labelEn: 'Input', category: '表单输入', w: 260, h: 48,
    props: { label: '手机号', placeholder: '请输入手机号' },
    style: { radius: 8, background: '#ffffff', fontSize: 14 },
    fields: [fText('label', '标签'), fText('placeholder', '占位文字'), fNum('radius', '圆角'), fNum('fontSize', '字号')],
  },
  {
    type: 'password', label: '密码输入框', labelEn: 'Password', category: '表单输入', w: 260, h: 48,
    props: { label: '密码', placeholder: '请输入密码' },
    style: { radius: 8, background: '#ffffff', fontSize: 14 },
    fields: [fText('label', '标签'), fText('placeholder', '占位文字'), fNum('radius', '圆角')],
  },
  {
    type: 'textarea', label: '多行文本', labelEn: 'Textarea', category: '表单输入', w: 260, h: 88,
    props: { placeholder: '请输入备注…' },
    style: { radius: 8, background: '#ffffff', fontSize: 14 },
    fields: [fText('placeholder', '占位文字'), fNum('radius', '圆角')],
  },
  {
    type: 'select', label: '下拉选择', labelEn: 'Select', category: '表单输入', w: 200, h: 44,
    props: { label: '城市', options: '北京,上海,广州' },
    style: { radius: 8, background: '#ffffff', fontSize: 14 },
    fields: [fText('label', '标签'), fText('options', '选项（逗号分隔）'), fNum('radius', '圆角')],
  },
  {
    type: 'switch', label: '开关', labelEn: 'Switch', category: '表单输入', w: 52, h: 28,
    props: { on: true }, style: {},
    fields: [],
  },

  // ---------- 操作与导航（LB-05） ----------
  {
    type: 'button-primary', label: '主按钮', labelEn: 'Primary button', category: '操作与导航', w: 200, h: 48,
    props: { label: '登录' },
    style: { background: '#f97316', color: '#ffffff', radius: 8, fontSize: 16, fontWeight: 600 },
    fields: [fText('label', '文字'), fColor('background', '填充'), fColor('color', '文字色'), fNum('radius', '圆角'), fNum('fontSize', '字号')],
  },
  {
    type: 'button-secondary', label: '次按钮', labelEn: 'Secondary button', category: '操作与导航', w: 160, h: 44,
    props: { label: '取消' },
    style: { background: '#ffffff', color: '#374151', radius: 8, fontSize: 14 },
    fields: [fText('label', '文字'), fColor('background', '填充'), fColor('color', '文字色'), fNum('radius', '圆角')],
  },
  {
    type: 'link', label: '链接框', labelEn: 'Link', category: '操作与导航', w: 200, h: 40,
    props: { label: '忘记密码？' },
    style: { color: '#f97316', fontSize: 13 },
    fields: [fText('label', '文字'), fColor('color', '颜色'), fNum('fontSize', '字号')],
  },
  {
    type: 'tabbar', label: '底部标签栏', labelEn: 'Tab bar', category: '操作与导航', w: 390, h: 56,
    props: { tabs: '首页,发现,我的' },
    style: { background: '#ffffff', color: '#6b7280', fontSize: 11 },
    fields: [fText('tabs', '标签（逗号分隔）'), fColor('background', '填充'), fColor('color', '文字色'), fNum('fontSize', '字号')],
  },
  {
    type: 'topnav', label: '顶部导航栏', labelEn: 'Top nav', category: '操作与导航', w: 390, h: 44,
    props: { title: '页面标题' },
    style: { background: '#ffffff', color: '#1f2328', fontSize: 15, fontWeight: 600 },
    fields: [fText('title', '标题'), fColor('background', '填充'), fColor('color', '文字色'), fNum('fontSize', '字号')],
  },

  // ---------- 数据展示（LB-05 部分） ----------
  {
    type: 'list-item', label: '列表项', labelEn: 'List item', category: '数据展示', w: 360, h: 64,
    props: { title: '列表标题', subtitle: '副标题说明' },
    style: { background: '#ffffff', color: '#1f2328', fontSize: 14 },
    fields: [fText('title', '标题'), fText('subtitle', '副标题'), fColor('background', '填充'), fNum('fontSize', '字号')],
  },
  {
    type: 'table', label: '数据表格', labelEn: 'Table', category: '数据展示', w: 400, h: 180,
    props: { rows: '3' }, style: { background: '#ffffff', fontSize: 12 },
    fields: [fNum('rows', '行数', 'props', 1, 8), fNum('fontSize', '字号'), fColor('background', '填充')],
  },
  {
    type: 'stat', label: '统计数值块', labelEn: 'Stat', category: '数据展示', w: 160, h: 96,
    props: { label: '本月消费', value: '1,024', unit: '元' },
    style: { background: '#ffffff', color: '#1f2328', radius: 12 },
    fields: [fText('label', '标签'), fText('value', '数值'), fText('unit', '单位'), fColor('background', '填充'), fNum('radius', '圆角')],
  },
  {
    type: 'progress', label: '进度条', labelEn: 'Progress', category: '数据展示', w: 240, h: 22,
    props: { value: 62 }, style: { background: '#e5e7eb', radius: 6 },
    fields: [fNum('value', '百分比', 'props', 0, 100), fColor('background', '轨道色'), fNum('radius', '圆角')],
  },

  // ---------- 社交与通知（LB-06） ----------
  {
    type: 'message-bubble', label: '消息气泡', labelEn: 'Message bubble', category: '社交与通知', w: 220, h: 56,
    props: { text: '这条消息来自对方。', side: 'left' },
    style: { background: '#f3f4f6', color: '#1f2328', fontSize: 13, radius: 12 },
    fields: [fArea('text', '消息'), fSel('side', '方向', ['left', 'right']), fColor('background', '气泡色'), fNum('radius', '圆角')],
  },
  {
    type: 'comment', label: '评论项', labelEn: 'Comment', category: '社交与通知', w: 340, h: 72,
    props: { name: '用户A', text: '这篇内容写得不错！' },
    style: { background: '#ffffff', color: '#374151', fontSize: 13 },
    fields: [fText('name', '昵称'), fArea('text', '内容'), fColor('background', '填充'), fNum('fontSize', '字号')],
  },
  {
    type: 'notification', label: '通知条', labelEn: 'Notification', category: '社交与通知', w: 360, h: 48,
    props: { text: '您有一条新的系统通知' },
    style: { background: '#fff7ed', color: '#9a3412', fontSize: 13, radius: 8 },
    fields: [fText('text', '通知文字'), fColor('background', '底色'), fColor('color', '文字色'), fNum('radius', '圆角')],
  },

  // ---------- 设备专用（LB-06） ----------
  {
    type: 'mobile-statusbar', label: '手机状态栏', labelEn: 'Status bar', category: '设备专用', w: 390, h: 44,
    props: { time: '9:41' }, style: { background: '#ffffff', color: '#1f2328', fontSize: 13 },
    devices: ['mobile'],
    fields: [fText('time', '时间'), fColor('background', '填充'), fColor('color', '文字色')],
  },
  {
    type: 'home-indicator', label: '底部 Home 指示条', labelEn: 'Home indicator', category: '设备专用', w: 390, h: 24,
    props: {}, style: { background: '#ffffff' },
    devices: ['mobile'],
    fields: [fColor('background', '底色')],
  },
  {
    type: 'watch-face', label: '手表表盘', labelEn: 'Watch face', category: '设备专用', w: 200, h: 200,
    props: { time: '10:08' }, style: { background: '#111827', color: '#f9fafb', fontSize: 36 },
    devices: ['watch'],
    fields: [fText('time', '时间'), fColor('background', '底色'), fColor('color', '指针色'), fNum('fontSize', '字号')],
  },
  {
    type: 'watch-list-row', label: '手表列表行', labelEn: 'Watch list row', category: '设备专用', w: 180, h: 32,
    props: { text: '条目' }, style: { background: '#1f2937', color: '#f9fafb', fontSize: 13 },
    devices: ['watch'],
    fields: [fText('text', '文字'), fColor('background', '填充'), fColor('color', '文字色')],
  },
];

export const REGISTRY_MAP: Record<string, ModuleDef> = Object.fromEntries(
  REGISTRY.map(m => [m.type, m]),
);

export const CATEGORIES = [...new Set(REGISTRY.filter(m => m.palette !== false).map(m => m.category))];

// 容器类型单源（tree.ts 命中测试用）：从注册表 isContainer 派生。
// 排除 page（画板根），根不参与"拖入哪个容器"的命中测试。
export const CONTAINER_TYPES = new Set(
  REGISTRY.filter(m => m.isContainer && m.type !== 'page').map(m => m.type),
);
