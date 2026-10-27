// editor 切片（B1 拆分）：编辑态初始值（hydrate/页面切换后会覆盖 currentPageId）
import type { EditorSlice } from './types';

export const initialEditor: EditorSlice = {
  currentPageId: '',
  currentDevice: 'mobile',
  selection: [],
  zoom: 1,
  pan: { x: 24, y: 24 },
  clipboard: [],
};
