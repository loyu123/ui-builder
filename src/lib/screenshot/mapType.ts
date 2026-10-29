// SS-05 · 类型映射：模型给的字符串 → 注册表里真实存在的 type
// 约束：绝不凭空造 type（导出器不认识会直接崩），映射不了就标记 known=false，由上层降级为占位块
import { REGISTRY_MAP } from '../../modules/registry';
import type { PxBox, Size } from './coords';

export interface TypeMapping {
  type: string;
  known: boolean;
}

/** 占位块用的真实类型（注册表里没有 unknown，分组容器最接近"空壳"） */
export const PLACEHOLDER_TYPE = 'group';

type Dynamic = (frame: PxBox, board: Size) => string;

const pickButton: Dynamic = (f, b) => (f.w >= b.w * 0.6 && f.h >= 40 ? 'button-primary' : 'button-secondary');
const pickText: Dynamic = f => (f.h >= 24 ? 'heading' : 'paragraph');
const pickNav: Dynamic = (f, b) => {
  if (f.y + f.h >= b.h * 0.88) return 'tabbar';
  return 'topnav';   // 默认贴顶
};

const ALIASES: Record<string, string | Dynamic> = {
  button: pickButton, btn: pickButton, cta: pickButton, submit: pickButton, 按钮: pickButton,

  text: pickText, label: pickText, title: pickText, heading: pickText, 标题: pickText, 文案: pickText,
  paragraph: 'paragraph', desc: 'paragraph', description: 'paragraph', 正文: 'paragraph', 描述: 'paragraph', 说明: 'paragraph',

  input: 'input', textfield: 'input', 'text-field': 'input', 'text-input': 'input',
  search: 'input', searchbar: 'input', 'search-bar': 'input', 输入框: 'input', 搜索: 'input',
  password: 'password', 密码: 'password',
  textarea: 'textarea', 多行: 'textarea',
  select: 'select', dropdown: 'select', 下拉: 'select',
  switch: 'switch', toggle: 'switch', 开关: 'switch', 拨杆: 'switch',

  image: 'image', img: 'image', photo: 'image', picture: 'image', 图片: 'image', 配图: 'image', 缩略图: 'image',
  video: 'image', 视频: 'image',          // 无视频模块 → 用图片占位更实用
  banner: 'image', hero: 'image', carousel: 'image', 轮播: 'image', 横幅: 'image',
  icon: 'icon', 图标: 'icon',
  avatar: 'avatar', 头像: 'avatar',

  list: 'list-item', item: 'list-item', cell: 'list-item', row: 'list-item', 列表: 'list-item', 条目: 'list-item', 行: 'list-item',
  card: 'card', panel: 'card', section: 'card', container: 'card', box: 'card', 卡片: 'card', 容器: 'card', 区块: 'card',
  modal: 'card', dialog: 'card', sheet: 'card', 弹窗: 'card', 对话框: 'card',
  table: 'table', 表格: 'table',
  nav: pickNav, navbar: pickNav, 'nav-bar': pickNav, header: pickNav, menu: pickNav, 导航: pickNav, 顶栏: pickNav, appbar: pickNav,
  tabbar: 'tabbar', tabs: 'tabbar', 'tab-bar': 'tabbar', bottomnav: 'tabbar', 'bottom-nav': 'tabbar',
  'bottom-bar': 'tabbar', 标签栏: 'tabbar', 底部: 'tabbar',
  link: 'link', 链接: 'link',
  stat: 'stat', metric: 'stat', kpi: 'stat', 数值: 'stat', 指标: 'stat',
  progress: 'progress', 进度: 'progress',
  divider: 'divider', hr: 'divider', separator: 'divider', 分割线: 'divider',
  message: 'message-bubble', bubble: 'message-bubble', 气泡: 'message-bubble',
  comment: 'comment', review: 'comment', 评论: 'comment',
  notification: 'notification', notice: 'notification', toast: 'notification', alert: 'notification', 通知: 'notification',
  statusbar: 'mobile-statusbar', 'status-bar': 'mobile-statusbar', 状态栏: 'mobile-statusbar',
  'home-indicator': 'home-indicator', homebar: 'home-indicator', 指示条: 'home-indicator',
  'watch-face': 'watch-face', 表盘: 'watch-face',
  'watch-row': 'watch-list-row', 'watch-list': 'watch-list-row',
};

/** 归一化别名键：小写、去下划线、空格转连字符 */
export function normalizeTypeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
}

export function mapType(rawType: string, frame: PxBox, board: Size): TypeMapping {
  const key = normalizeTypeKey(rawType);
  if (!key) return { type: PLACEHOLDER_TYPE, known: false };

  // 模型直接给了我们的 type（例如按提示词输出的 button-primary）—— 精确命中优先
  if (REGISTRY_MAP[key]) return { type: key, known: true };

  const hit = ALIASES[key];
  if (typeof hit === 'function') return { type: hit(frame, board), known: true };
  if (typeof hit === 'string') return { type: hit, known: true };

  return { type: PLACEHOLDER_TYPE, known: false };
}
