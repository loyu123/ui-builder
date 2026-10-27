// W5 · 全量回归（自动化版 LB-06 验收 + ST/PP 关键链路）
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore, createEmptyProject } from './index';
import { REGISTRY } from '../modules/registry';

function reset() {
  useStore.setState({
    project: createEmptyProject(),
    editor: {
      currentPageId: useStore.getState().project.pages[0]?.id ?? '',
      currentDevice: 'mobile',
      selection: [], zoom: 1, pan: { x: 24, y: 24 }, clipboard: [],
    },
    history: { past: [], future: [], lastTag: '', lastAt: 0, log: [] },
  });
  const st = useStore.getState();
  useStore.setState({ editor: { ...st.editor, currentPageId: st.project.pages[0].id } });
}

function board() {
  const s = useStore.getState();
  const page = s.project.pages.find(pg => pg.id === s.editor.currentPageId)!;
  return page.boards[s.editor.currentDevice];
}

function countModules() {
  return Object.keys(board().nodes).length - 1;
}

describe('W5 回归 · 30 模块增删', () => {
  beforeEach(reset);

  it('LB-06：全部 palette 模块逐个拖入成功且类型正确', () => {
    const a = useStore.getState().actions;
    const palette = REGISTRY.filter(m => m.palette !== false);
    for (const m of palette) {
      a.addNode(m.type, { x: 10, y: 10, w: m.w, h: m.h });
    }
    expect(countModules()).toBe(palette.length);
    const root = board().nodes[board().rootId];
    const types = root.children.map(id => board().nodes[id].type);
    expect(new Set(types).size).toBe(palette.length);
  });

  it('LB-06：拖入 → 删除 → undo → redo 全链路', () => {
    const a = useStore.getState().actions;
    a.addNode('button-primary', { x: 10, y: 10, w: 200, h: 48 });
    const before = countModules();
    a.select([board().nodes[board().rootId].children[0]]);
    a.deleteNode(board().nodes[board().rootId].children[0]);
    expect(countModules()).toBe(before - 1);
    a.undo();
    expect(countModules()).toBe(before);
    a.redo();
    expect(countModules()).toBe(before - 1);
  });

  it('CV-06：按钮拖进卡片（重挂载）后父子关系正确，可再拖出', () => {
    const a = useStore.getState().actions;
    a.addNode('card', { x: 10, y: 10, w: 280, h: 160 });
    const cardId = board().nodes[board().rootId].children[0];
    a.addNode('button-primary', { x: 20, y: 20, w: 200, h: 48 }, cardId);
    expect(board().nodes[cardId].children.length).toBe(1);
    // 拖出：moveNode 到根
    const btnId = board().nodes[cardId].children[0];
    a.moveNode(btnId, 40, 40, board().rootId);
    expect(board().nodes[cardId].children.length).toBe(0);
    expect(board().nodes[board().rootId].children).toContain(btnId);
    expect(board().nodes[btnId].parentId).toBe(board().rootId);
  });

  it('ST-02：连续拖动 400ms 合并为一步（drag tag 合并）', () => {
    const a = useStore.getState().actions;
    a.addNode('heading', { x: 10, y: 10, w: 200, h: 34 });
    const id = board().nodes[board().rootId].children[0];
    // 栈里已有 add 一帧；两次 moveNode 同 tag 合并，只追加一帧
    a.moveNode(id, 20, 20);
    a.moveNode(id, 30, 30);
    expect(useStore.getState().history.past.length).toBe(2);
    a.undo();   // 回到第一次 move 前（模块在 10,10）
    const root = board().nodes[board().rootId];
    expect(root.children.length).toBe(1);
    expect(board().nodes[id].frame).toMatchObject({ x: 10, y: 10 });
  });

  it('CV-03：复制含子树的卡片 → 粘贴 → id 全新且内容一致', () => {
    const a = useStore.getState().actions;
    a.addNode('card', { x: 10, y: 10, w: 280, h: 160 });
    const cardId = board().nodes[board().rootId].children[0];
    a.addNode('button-primary', { x: 20, y: 20, w: 200, h: 48 }, cardId);
    a.select([cardId]);
    a.copySelection();
    a.pasteClipboard();
    expect(countModules()).toBe(4);
    const newCardId = useStore.getState().editor.selection[0];
    expect(newCardId).not.toBe(cardId);
    expect(board().nodes[newCardId].children.length).toBe(1);
    const childId = board().nodes[newCardId].children[0];
    expect(board().nodes[childId].parentId).toBe(newCardId);
  });

  it('PP-02/03：属性写入、显隐、锁定、图层顺序', () => {
    const a = useStore.getState().actions;
    a.addNode('heading', { x: 10, y: 10, w: 200, h: 34 });
    a.addNode('paragraph', { x: 10, y: 60, w: 240, h: 48 });
    const root = board().nodes[board().rootId];
    const [h, para] = root.children.map(id => board().nodes[id]);
    a.setProp(h.id, 'text', '新标题');
    expect(board().nodes[h.id].props.text).toBe('新标题');
    a.setStyle(h.id, 'color', '#123456');
    expect(board().nodes[h.id].style.color).toBe('#123456');
    a.setFrameField(h.id, 'x', 77);
    expect(board().nodes[h.id].frame.x).toBe(77);
    a.setNodeFlag(h.id, 'hidden', true);
    expect(board().nodes[h.id].hidden).toBe(true);
    a.setNodeFlag(para.id, 'locked', true);
    expect(board().nodes[para.id].locked).toBe(true);
    a.reorderNode(para.id, 'front');
    expect(board().nodes[board().rootId].children[board().nodes[board().rootId].children.length - 1]).toBe(para.id);
  });

  it('WS-04/DV-01：多页面与三设备画板相互独立', () => {
    const a = useStore.getState().actions;
    a.setDevice('watch');
    a.addNode('watch-face', { x: 10, y: 10, w: 200, h: 200 });
    expect(countModules()).toBe(1);
    a.setDevice('mobile');
    expect(countModules()).toBe(0);   // 手表的设计不影响手机画板
    a.addPage();
    expect(useStore.getState().project.pages.length).toBe(2);
    expect(countModules()).toBe(0);   // 新页面也是空的
  });

  it('ST-05：导入非法 JSON 返回可读原因，合法 JSON 完整替换', () => {
    const a = useStore.getState().actions;
    expect(a.importProject('not-json')).toBe('不是合法的 JSON 文本');
    a.addNode('button-primary', { x: 1, y: 1, w: 200, h: 48 });
    const exported = JSON.parse(JSON.stringify(useStore.getState().project));
    exported.name = '导入的项目';
    expect(a.importProject(JSON.stringify(exported))).toBeNull();
    expect(useStore.getState().project.name).toBe('导入的项目');
    expect(countModules()).toBe(1);
  });

  it('ST-05：结构损坏的 JSON（父子断裂）被深校验拒绝且不覆盖当前项目', () => {
    const a = useStore.getState().actions;
    a.addNode('button-primary', { x: 1, y: 1, w: 200, h: 48 });
    const nameBefore = useStore.getState().project.name;
    const broken = JSON.parse(JSON.stringify(useStore.getState().project));
    broken.name = '损坏的项目';
    // 把按钮从 root 的 children 里删掉但保留其 parentId → 双向关系断裂
    const mobile = broken.pages[0].boards.mobile;
    const btnId = Object.keys(mobile.nodes).find(id => mobile.nodes[id].type === 'button-primary')!;
    mobile.nodes[mobile.rootId].children = mobile.nodes[mobile.rootId].children.filter((c: string) => c !== btnId);
    expect(a.importProject(JSON.stringify(broken))).toBe('项目结构校验未通过：画板 root 缺失，或模块父子关系断裂');
    expect(useStore.getState().project.name).toBe(nameBefore);   // 未被覆盖
    expect(countModules()).toBe(1);
  });

  it('P1-07：分级快照——页面级操作全量可撤销，board 级操作只影响所在画板', () => {
    const a = useStore.getState().actions;
    a.addNode('heading', { x: 10, y: 10, w: 200, h: 34 });   // board 粒度快照
    const p1 = useStore.getState().project.pages[0].id;
    a.addPage();                                              // full 快照
    expect(useStore.getState().project.pages.length).toBe(2);
    a.undo();                                                 // 回到单页
    expect(useStore.getState().project.pages.length).toBe(1);
    a.undo();                                                 // 撤销拖入
    const b1 = useStore.getState().project.pages[0].boards.mobile;
    expect(b1.nodes[b1.rootId].children.length).toBe(0);
    a.redo();                                                 // 重做拖入（full/board 混合栈）
    const b1r = useStore.getState().project.pages[0].boards.mobile;
    expect(b1r.nodes[b1r.rootId].children.length).toBe(1);
    expect(useStore.getState().project.pages[0].id).toBe(p1);
  });

  it('P2-10/11：事件绑定编辑与主题令牌更新（未动字段保留）', () => {
    const a = useStore.getState().actions;
    a.addNode('button-primary', { x: 1, y: 1, w: 200, h: 48 });
    const id = board().nodes[board().rootId].children[0];
    a.setNodeEvent(id, 'onClick', { action: 'navigate', target: 'pg-x', note: '去首页' });
    expect(board().nodes[id].events.onClick).toMatchObject({ action: 'navigate', target: 'pg-x', note: '去首页' });
    a.updateTheme({ colors: { primary: '#123456' } });
    expect(useStore.getState().project.theme.colors.primary).toBe('#123456');
    expect(useStore.getState().project.theme.colors.bg).toBe('#ffffff');   // 其他颜色保留
    a.updateTheme({ font: { family: 'serif' } });
    expect(useStore.getState().project.theme.font.family).toBe('serif');
    expect(useStore.getState().project.theme.font.base).toBe(14);
  });

  it('旋转：setNodeRotation 归一化到 0~359，可撤销重做', () => {
    const a = useStore.getState().actions;
    a.addNode('heading', { x: 10, y: 10, w: 200, h: 34 });
    const id = board().nodes[board().rootId].children[0];
    a.setNodeRotation(id, 435);
    expect(board().nodes[id].rotation).toBe(75);      // 435 → 75
    a.setNodeRotation(id, -90);
    expect(board().nodes[id].rotation).toBe(270);     // -90 → 270
    a.undo();   // 两次 rotate 同 tag 合并为一步 → 回到未旋转
    expect(board().nodes[id].rotation ?? 0).toBe(0);
    a.redo();
    expect(board().nodes[id].rotation).toBe(270);
  });

  it('P1-3.2 · copyBoardFrom 同源 device 为 no-op（project 引用不变）', () => {
    const a = useStore.getState().actions;
    a.addNode('heading', { x: 1, y: 1, w: 100, h: 30 });
    const before = useStore.getState().project;
    a.copyBoardFrom('mobile');   // 当前设备即 mobile
    expect(useStore.getState().project).toBe(before);
  });

  it('P1-3.2 · deletePage 仅剩一页时拒绝', () => {
    const a = useStore.getState().actions;
    const before = useStore.getState().project;
    a.deletePage(useStore.getState().project.pages[0].id);
    expect(useStore.getState().project).toBe(before);
    expect(useStore.getState().project.pages.length).toBe(1);
  });

  it('P1-3.2 · reorderNode 已在顶端 back / 已在底端 front 均安全', () => {
    const a = useStore.getState().actions;
    a.addNode('heading', { x: 1, y: 1, w: 100, h: 30 });
    a.addNode('heading', { x: 1, y: 40, w: 100, h: 30 });
    const board0 = () => {
      const s = useStore.getState();
      const pg = s.project.pages[0];
      return pg.boards.mobile;
    };
    const root = board0().rootId;
    const kids = board0().nodes[root].children;
    a.reorderNode(kids[0], 'back');    // 已在最底
    expect(board0().nodes[root].children).toEqual(kids);
    a.reorderNode(kids[1], 'front');   // 已在最顶
    expect(board0().nodes[root].children).toEqual(kids);
  });

  it('P1-3.2 · clearBoard 后画板仅剩 root 且选择清空', () => {
    const a = useStore.getState().actions;
    a.addNode('heading', { x: 1, y: 1, w: 100, h: 30 });
    a.addNode('heading', { x: 1, y: 40, w: 100, h: 30 });
    a.clearBoard();
    const b = useStore.getState().project.pages[0].boards.mobile;
    expect(Object.keys(b.nodes)).toEqual([b.rootId]);
    expect(useStore.getState().editor.selection).toEqual([]);
  });

  it('P1-3.2 · alignSelection 单选时 no-op', () => {
    const a = useStore.getState().actions;
    a.addNode('heading', { x: 10, y: 10, w: 100, h: 30 });
    const id = useStore.getState().project.pages[0].boards.mobile.rootId;
    const kid = useStore.getState().project.pages[0].boards.mobile.nodes[id].children[0];
    a.select([kid]);
    const before = useStore.getState().project;
    a.alignSelection('left');
    expect(useStore.getState().project).toBe(before);
  });

  it('性能冒烟：200 节点增删不超时（数据层）', () => {    const a = useStore.getState().actions;
    const t0 = Date.now();
    for (let i = 0; i < 200; i++) {
      a.addNode('paragraph', { x: i % 300, y: (i * 10) % 800, w: 240, h: 48 });
    }
    expect(countModules()).toBe(200);
    for (let i = 0; i < 200; i++) {
      const root = board().nodes[board().rootId];
      a.deleteNode(root.children[0]);
    }
    expect(countModules()).toBe(0);
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});
