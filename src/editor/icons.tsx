// 统一线性图标：替代原先散落的彩色 emoji（设备切换 / 主题 / 快捷键 / 图层锁定）
// 约定：24 格视框、1.7px 描边、currentColor 取色，尺寸随字号上下文微调
import type { CSSProperties, ReactNode } from 'react';

export interface IconProps {
  size?: number;
  style?: CSSProperties;
}

function Svg({ size = 14, style, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden focusable="false"
      style={{ flexShrink: 0, display: 'block', ...style }}
    >
      {children}
    </svg>
  );
}

/** 桌面显示器 */
export const IconMonitor = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="3.5" width="19" height="13" rx="2" />
    <path d="M9 20.5h6M12 16.5v4" />
  </Svg>
);

/** 手机 */
export const IconPhone = (p: IconProps) => (
  <Svg {...p}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
    <path d="M10.8 18.6h2.4" />
  </Svg>
);

/** 手表 */
export const IconWatch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="5.4" />
    <path d="M12 9.6V12l1.7 1.1M9.7 6.9 10.2 3h3.6l.5 3.9M9.7 17.1 10.2 21h3.6l.5-3.9" />
  </Svg>
);

/** 设备图标分发（顶栏设备切换用） */
export function IconDevice({ device, size = 14 }: { device: string; size?: number }) {
  if (device === 'desktop') return <IconMonitor size={size} />;
  if (device === 'watch') return <IconWatch size={size} />;
  return <IconPhone size={size} />;
}

/** 调色板（主题令牌） */
export const IconPalette = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.2a8.8 8.8 0 1 0 0 17.6h1.4a2.1 2.1 0 0 0 0-4.2h-1a1.9 1.9 0 0 1 0-3.8h3.2A5.1 5.1 0 0 0 20.8 7.6C20.8 5.1 16.8 3.2 12 3.2Z" />
    <circle cx="8.4" cy="9.4" r=".9" fill="currentColor" stroke="none" />
    <circle cx="12" cy="7.4" r=".9" fill="currentColor" stroke="none" />
    <circle cx="15.6" cy="9.4" r=".9" fill="currentColor" stroke="none" />
  </Svg>
);

/** 键盘（快捷键说明） */
export const IconKeyboard = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="5.8" width="19" height="12.4" rx="2" />
    <path d="M6.2 9.8h.01M9.6 9.8h.01M13 9.8h.01M16.4 9.8h.01M6.2 13.2h.01M9.6 13.2h.01M13 13.2h.01M16.4 13.2h.01M8.2 16.2h7.6" />
  </Svg>
);

/** 截图转界面（取景框 + 山） */
export const IconScreenshot = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5A2.5 2.5 0 0 1 18.5 21H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" />
    <circle cx="9" cy="9.5" r="1.4" />
    <path d="M4.5 17.5 9.6 12.4l3.2 3.2 2.2-2.2 4.5 4.5" />
  </Svg>
);

/** 复制（预览行复制） */
export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2.5" />
    <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-6A2.5 2.5 0 0 0 4 5.5v6A2.5 2.5 0 0 0 6.5 14" />
  </Svg>
);

/** 齿轮（设置入口） */
export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a1.9 1.9 0 1 1-3.8 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a1.9 1.9 0 1 1 0-3.8h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a1.9 1.9 0 1 1 3.8 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.2a1.9 1.9 0 1 1 0 3.8h-.2a1.6 1.6 0 0 0-1.5 1Z" />
  </Svg>
);

/** 眼睛（显示密钥） */
export const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Svg>
);

/** 眼睛带斜线（隐藏密钥） */
export const IconEyeOff = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.9 5.9A9.6 9.6 0 0 1 12 5.8c6 0 9.5 6.2 9.5 6.2a17 17 0 0 1-2.6 3.4M6.4 7.6A17.4 17.4 0 0 0 2.5 12S6 18.2 12 18.2c1.5 0 2.7-.4 3.8-.9M4 4l16 16" />
  </Svg>
);

/** 锁（open=true 为未锁定） */
export const IconLock = ({ open, size = 11 }: IconProps & { open?: boolean }) => (
  <Svg size={size}>
    <rect x="4.8" y="10.4" width="14.4" height="9.8" rx="2" />
    {open
      ? <path d="M8.2 10.4V8a4 4 0 0 1 7.4-2.1" />
      : <path d="M8.2 10.4V8a3.8 3.8 0 0 1 7.6 0v2.4" />}
  </Svg>
);
