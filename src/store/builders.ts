// 节点构建器（模板库与截图导入共用）
// 纪律：props/style 一律以 registry 默认值为底，调用方只覆盖需要的键 —— 避免第二套默认值导致漂移
import { uid } from '../lib/id';
import { REGISTRY_MAP } from '../modules/registry';
import type { Board, Node } from '../types';

export interface Frame { x: number; y: number; w: number; h: number }

/** 一次"落地"的最小描述，可直接喂给 actions.addNodesTree */
export interface NodeSpec {
  type: string;
  frame: Frame;
  props?: Record<string, unknown>;
  style?: Record<string, string | number>;
  name?: string;
  note?: string;
}

export interface MkOpts extends Omit<NodeSpec, 'type' | 'frame'> {
  parentId?: string;
}

/** 在画板里追加一个模块（默认挂根） */
export function mk(board: Board, type: string, frame: Frame, opts: MkOpts = {}): Node {
  const meta = REGISTRY_MAP[type];
  const root = board.nodes[board.rootId];
  const parentId = opts.parentId ?? root.id;
  const n: Node = {
    id: uid('n'),
    type,
    name: opts.name ?? meta?.label ?? type,
    parentId,
    children: [],
    frame,
    style: { ...(meta?.style ?? {}), ...(opts.style ?? {}) },
    props: {
      ...(JSON.parse(JSON.stringify(meta?.props ?? {})) as Record<string, unknown>),
      ...(opts.props ?? {}),
    },
    events: { onClick: { action: 'none', note: '占位，后续接真实行为' } },
  };
  if (opts.note) n.note = opts.note;
  board.nodes[parentId].children.push(n.id);
  board.nodes[n.id] = n;
  return n;
}

/** 批量追加（同一父级、按顺序入栈），返回落地的节点 */
export function insertSpecs(board: Board, specs: readonly NodeSpec[], parentId?: string): Node[] {
  return specs.map(spec => mk(board, spec.type, spec.frame, {
    props: spec.props, style: spec.style, name: spec.name, note: spec.note, parentId,
  }));
}
