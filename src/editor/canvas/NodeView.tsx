// P1-14 · 单节点渲染（自 Canvas.tsx 抽出）：memo 化，递归渲染子级
// memo 收益场景：改一个节点的 props/选中态时，无关节点跳过重渲染（4.3 验收）。
// 拖拽预览期间 previewFrame 引用逐帧变化，整树重渲染（与抽分前一致）；
// 但 MemoModuleRenderer 层 node 引用不变（手势过程不写 store），重模块渲染仍被跳过。
import { memo, type ReactNode } from 'react';
import type * as React from 'react';
import type { Board, Frame, Node } from '../../types';
import type { Handle } from './gesture';
import { ModuleRenderer } from '../../modules/renderers';

const MemoModuleRenderer = memo(ModuleRenderer);   // P1-08 · node 引用不变即跳过重渲染（immer 结构共享）

// 双击可改文字的模块：type → 文案所在 props 字段
const EDITABLE_TEXT: Record<string, string> = {
  heading: 'text', paragraph: 'text', 'button-primary': 'label', 'button-secondary': 'label',
  link: 'label', topnav: 'title', 'list-item': 'title', notification: 'text', 'message-bubble': 'text',
  'watch-list-row': 'text', 'watch-face': 'time', 'mobile-statusbar': 'time', stat: 'value',
};

const HANDLE_CURSOR: Record<Handle, string> = {
  n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize',
};
const HANDLE_POS: Record<Handle, React.CSSProperties> = {
  n:  { top: -5, left: '50%', marginLeft: -5 },
  s:  { bottom: -5, left: '50%', marginLeft: -5 },
  e:  { right: -5, top: '50%', marginTop: -5 },
  w:  { left: -5, top: '50%', marginTop: -5 },
  ne: { top: -5, right: -5 },
  nw: { top: -5, left: -5 },
  se: { bottom: -5, right: -5 },
  sw: { bottom: -5, left: -5 },
};

const ACCENT = '#f97316';

export interface NodeViewProps {
  node: Node;
  board: Board;
  previewing?: boolean;
  selection: string[];            // store 选中数组（引用稳定，选中变化才更新）
  previewId: string | null;       // 拖拽/缩放预览节点 id
  previewFrame: Frame | null;     // 预览帧（previewId 匹配时使用）
  dropTargetId: string | null;
  dropActive: boolean;            // gesture.mode === 'move'（拖动中才显示落点高亮）
  editingId: string | null;
  editingKey: string;
  editingValue: string;
  beginGesture: (e: React.PointerEvent, mode: 'move' | 'resize', node: Node, handle?: Handle) => void;
  onNavigate: (targetPageId: string) => void;
  onStartEdit: (id: string, key: string, value: string) => void;
  onEditChange: (value: string) => void;
  onEditEnd: (commit: boolean) => void;
}

function NodeViewImpl(p: NodeViewProps): ReactNode {
  const n = p.node;
  const dragged = p.previewId === n.id;
  const selected = p.selection.includes(n.id) || dragged;
  const frame = dragged && p.previewFrame ? p.previewFrame : n.frame;
  const dropHighlighted = p.dropActive && p.dropTargetId === n.id;
  const editing = p.editingId === n.id;
  return (
    <div
      aria-selected={selected}
      onPointerDown={e => p.beginGesture(e, 'move', n)}
      onClick={e => {
        // 预览互动：navigate 事件真实切换预览页
        if (!p.previewing) return;
        const ev = Object.values(n.events ?? {}).find(s => s.action !== 'none');
        if (ev?.action === 'navigate' && ev.target) {
          e.stopPropagation();
          p.onNavigate(ev.target);
        }
      }}
      onDoubleClick={e => {
        e.stopPropagation();
        if (p.previewing) return;   // 预览模式下不允许就地编辑
        const key = EDITABLE_TEXT[n.type];
        if (key) p.onStartEdit(n.id, key, String(n.props[key] ?? ''));
      }}
      style={{
        position: 'absolute',
        left: frame.x, top: frame.y, width: frame.w, height: frame.h,
        transform: n.rotation ? `rotate(${n.rotation}deg)` : undefined,
        outline: selected ? `2px solid ${ACCENT}` : 'none',
        outlineOffset: 1,
        opacity: dragged ? 0.9 : 1,
        cursor: 'grab',
      }}
    >
      <MemoModuleRenderer node={n} interactive={p.previewing} />
      {/* 功能备注气泡（PP-03） */}
      {n.note && !p.previewing && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 4px)', left: 0,
          maxWidth: 240, background: '#2a3548', color: '#e6ebf2',
          border: `1px solid ${ACCENT}`, borderRadius: 8, padding: '4px 8px',
          fontSize: 10, lineHeight: 1.5, zIndex: 20, pointerEvents: 'none',
          boxShadow: '0 4px 14px rgba(0,0,0,.35)', whiteSpace: 'normal',
        }}>
          <b style={{ color: ACCENT }}>备注：</b>{n.note}
        </div>
      )}
      {/* 双击就地编辑文字（CV-03 补充） */}
      {editing && (
        <input
          autoFocus
          value={p.editingValue}
          onPointerDown={e => e.stopPropagation()}
          onChange={e => p.onEditChange(e.target.value)}
          onBlur={() => p.onEditEnd(true)}
          onKeyDown={e => {
            if (e.key === 'Enter') p.onEditEnd(true);
            if (e.key === 'Escape') p.onEditEnd(false);
          }}
          style={{
            position: 'absolute', inset: 0, width: '100%', zIndex: 30,
            border: `2px solid ${ACCENT}`, borderRadius: 4, padding: '0 8px',
            fontSize: 13, boxSizing: 'border-box', outline: 'none',
          }}
        />
      )}
      {n.children.map(cid => {
        const child = p.board.nodes[cid];
        if (!child || child.hidden) return null;   // PP-03 · 隐藏节点不渲染
        return (
          <NodeView
            key={cid}
            node={child}
            board={p.board}
            previewing={p.previewing}
            selection={p.selection}
            previewId={p.previewId}
            previewFrame={p.previewFrame}
            dropTargetId={p.dropTargetId}
            dropActive={p.dropActive}
            editingId={p.editingId}
            editingKey={p.editingKey}
            editingValue={p.editingValue}
            beginGesture={p.beginGesture}
            onNavigate={p.onNavigate}
            onStartEdit={p.onStartEdit}
            onEditChange={p.onEditChange}
            onEditEnd={p.onEditEnd}
          />
        );
      })}
      {dropHighlighted && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          outline: `2px dashed ${ACCENT}`, outlineOffset: -2,
          background: 'rgba(249,115,22,.06)', zIndex: 5,
        }} />
      )}
      {selected && (['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as Handle[]).map(h => (
        <div
          key={h}
          onPointerDown={e => p.beginGesture(e, 'resize', n, h)}
          style={{
            position: 'absolute', width: 10, height: 10,
            background: '#ffffff', border: `2px solid ${ACCENT}`,
            borderRadius: 2, zIndex: 10,
            cursor: HANDLE_CURSOR[h], touchAction: 'none',
            ...HANDLE_POS[h],
          }}
        />
      ))}
    </div>
  );
}

export const NodeView = memo(NodeViewImpl);
