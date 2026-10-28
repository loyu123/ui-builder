// F10 · 间距标注渲染（纯展示）：线段 + 两端刻度 + 数值气泡
// 坐标系就是画板坐标（父级 div 铺满画板并绝对定位），所以不受 zoom / pan 影响
import type { SpacingGap } from '../../lib/spacing';

const COLOR = '#f43f5e';

export function SpacingMarks({ gaps }: { gaps: SpacingGap[] }) {
  if (!gaps.length) return null;
  return (
    <div
      aria-hidden
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 98 }}
    >
      {gaps.map(g => {
        const horizontal = g.axis === 'h';
        const x2 = g.x + (horizontal ? g.length : 0);
        const y2 = g.y + (horizontal ? 0 : g.length);
        return (
          <div key={g.side}>
            {/* 主线段 */}
            <div style={{
              position: 'absolute', background: COLOR,
              left: g.x, top: g.y,
              width: horizontal ? g.length : 1, height: horizontal ? 1 : g.length,
            }} />
            {/* 两端刻度（垂直线的刻度是横线，反之亦然） */}
            {[{ x: g.x, y: g.y }, { x: x2, y: y2 }].map((p, i) => (
              <div key={i} style={{
                position: 'absolute', background: COLOR,
                left: p.x - (horizontal ? 0 : 3), top: p.y - (horizontal ? 3 : 0),
                width: horizontal ? 1 : 7, height: horizontal ? 7 : 1,
              }} />
            ))}
            {/* 数值 */}
            <div style={{
              position: 'absolute',
              left: horizontal ? g.x + g.length / 2 : g.x,
              top: horizontal ? g.y : g.y + g.length / 2,
              transform: 'translate(-50%, -50%)',
              background: '#ffffff', border: `1px solid ${COLOR}`, borderRadius: 4,
              color: COLOR, fontSize: 10, lineHeight: 1, padding: '2px 4px',
              fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
            }}>
              {Math.round(g.gap)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
