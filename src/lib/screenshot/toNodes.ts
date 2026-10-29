// SS-07 · 识别结果 → NodeSpec（直接喂 actions.addNodesTree，落地仍用同一套 Node schema）
import type { NodeSpec } from '../../store/builders';
import { PLACEHOLDER_TYPE } from './mapType';
import type { ProcessedModule } from './postprocess';

/** 占位块外观：虚线灰框，一眼看出"这里需要人工确认" */
export const PLACEHOLDER_STYLE = {
  background: 'rgba(148,163,184,.14)',
  border: '1px dashed #94a3b8',
};

const TEXT_PROP: Record<string, string> = {
  heading: 'text', paragraph: 'text', 'message-bubble': 'text', notification: 'text',
  comment: 'text', 'button-primary': 'label', 'button-secondary': 'label', link: 'label',
  topnav: 'title', 'list-item': 'title', stat: 'label', image: 'alt', avatar: 'name', icon: 'glyph',
};

function propsFor(item: ProcessedModule): Record<string, unknown> {
  const text = item.text;
  if (!text) return {};
  const key = TEXT_PROP[item.type];
  if (key) return { [key]: text };

  switch (item.type) {
    case 'input':
    case 'password':
    case 'textarea':
      return { label: '', placeholder: text };
    case 'select':
      return { options: text.includes(',') ? text : `${text},选项二` };
    default:
      return {};
  }
}

function noteFor(item: ProcessedModule): string | undefined {
  if (item.placeholder) {
    return item.known
      ? `置信度偏低（${item.confidence.toFixed(2)}），识别为「${item.rawType}」，请确认类型`
      : `类型「${item.rawType}」无对应模块，请手动选择`;
  }
  return item.overlapWarn ? '与相邻模块可能重叠，建议核对位置' : undefined;
}

export function toNodeSpecs(items: readonly ProcessedModule[]): NodeSpec[] {
  return items.map(item => {
    const placeholder = item.placeholder;
    return {
      type: placeholder ? PLACEHOLDER_TYPE : item.type,
      frame: item.frame,
      props: placeholder ? {} : propsFor(item),
      style: placeholder ? { ...PLACEHOLDER_STYLE } : { ...item.style },
      name: placeholder ? '未知模块' : undefined,
      note: noteFor(item),
    };
  });
}
