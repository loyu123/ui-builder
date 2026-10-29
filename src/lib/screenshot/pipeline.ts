// SS-08 · 流水线编排：不可信 JSON → 可用节点（唯一入口，UI 只调这一个函数）
import { detectCoordSpace, normalizeBox, toBoardFrame, type CoordSpace, type Size } from './coords';
import { mapType } from './mapType';
import { processModules, type MappedModule, type ProcessOptions, type ProcessedModule } from './postprocess';
import { parseRecognition, type ParseIssue } from './schema';
import { mapStyle } from './styleAlias';

export interface PipelineOptions extends ProcessOptions {
  /** 原图尺寸：用于判定像素坐标系；缺失时按 0-1000 网格兜底 */
  image?: Size | null;
}

export interface PipelineResult {
  items: ProcessedModule[];
  space: CoordSpace;
  issues: ParseIssue[];
  dropped: number;
  rawCount: number;
}

export function runPipeline(raw: unknown, board: Size, opts: PipelineOptions = {}): PipelineResult {
  const parsed = parseRecognition(raw);
  if (!parsed.modules.length) {
    return { items: [], space: 'ratio', issues: parsed.issues, dropped: parsed.dropped, rawCount: 0 };
  }

  const space = detectCoordSpace(parsed.modules.map(m => m.box), opts.image ?? null);

  const mapped: MappedModule[] = parsed.modules.map((m, i) => {
    const box = normalizeBox(m.box, space, opts.image ?? null);
    const frame = toBoardFrame(box, board);
    const mapping = mapType(m.type, frame, board);
    return {
      id: `m${i}`,
      rawType: m.type,
      type: mapping.type,
      known: mapping.known,
      confidence: m.confidence,
      box,
      text: m.text,
      style: mapStyle(m.style),
    };
  });

  return {
    items: processModules(mapped, board, opts),
    space,
    issues: parsed.issues,
    dropped: parsed.dropped,
    rawCount: parsed.modules.length,
  };
}
