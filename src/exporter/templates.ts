// P1-15 · 导出组件模板独立文件：与 modules/registry.ts 邻接对照；
// 与编辑器渲染器（modules/renderers.tsx）为双份实现，字段一致性由 guard.test.ts 守护。
// 生成代码统一使用 st（样式）/ p / t（属性字符串化）辅助，保证 TS 严格模式可编译。
// 生成代码统一使用 st（样式）/ p（属性字符串化）辅助，保证 TS 严格模式可编译
// （componentBody/collectActions 导出供 guard 测试做字段一致性校验）
export function componentBody(type: string): string {
  switch (type) {
    case 'page': case 'group': case 'card':
      return '<div style={{ width: "100%", height: "100%", ...st }} />';
    case 'divider':
      return '<div style={{ width: "100%", height: "100%", minHeight: 1, ...st }} />';
    case 'heading': case 'paragraph':
      return '<div style={{ width: "100%", overflow: "hidden", ...st }}>{p("text")}</div>';
    case 'image':
      return `<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", ...st }}>{t("src") ? <img src={t("src")} alt={t("alt")} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : '🖼 ' + t("alt")}</div>`;
    case 'icon':
      return '<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", ...st }}>{p("glyph")}</div>';
    case 'avatar':
      return `<div style={{ width: "100%", height: "100%", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", ...st }}>{t("src") ? <img src={t("src")} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (t("name") || "?").charAt(0)}</div>`;
    case 'input':
      return `<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, border: "1px solid #e5e7eb", padding: "0 10px", boxSizing: "border-box", ...st }}>{t("label") ? <span style={{ fontSize: 11, color: "#6b7280" }}>{t("label")}</span> : null}<span style={{ color: "#9ca3af" }}>{t("placeholder")}</span></div>`;
    case 'password':
      return `<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, border: "1px solid #e5e7eb", padding: "0 10px", boxSizing: "border-box", ...st }}>{t("label") ? <span style={{ fontSize: 11, color: "#6b7280" }}>{t("label")}</span> : null}<span style={{ color: "#9ca3af", letterSpacing: 2 }}>••••••</span></div>`;
    case 'textarea':
      return '<div style={{ width: "100%", height: "100%", border: "1px solid #e5e7eb", padding: 8, boxSizing: "border-box", color: "#9ca3af", ...st }}>{t("placeholder")}</div>';
    case 'select': {
      return `<div style={{ width: "100%", height: "100%", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", boxSizing: "border-box", ...st }}><span style={{ color: "#374151" }}>{t("options").split(",")[0] || "请选择"}</span><span style={{ color: "#9ca3af" }}>▾</span></div>`;
    }
    case 'switch':
      return `<div style={{ width: "100%", height: "100%", maxWidth: 52, borderRadius: 999, background: props.on ? "#f97316" : "#d1d5db", position: "relative" }}><div style={{ position: "absolute", top: 2, left: props.on ? "calc(100% - 24px)" : 2, width: 24, height: 24, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} /></div>`;
    case 'button-primary': case 'button-secondary':
      return '<button style={{ width: "100%", height: "100%", border: "none", cursor: "pointer", ...st }} onClick={() => fire("onClick")}>{p("label")}</button>';
    case 'link':
      return '<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", ...st }}><span style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>{p("label")}</span><span style={{ marginLeft: 4 }}>›</span></div>';
    case 'tabbar': {
      return `<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", borderTop: "1px solid #e5e7eb", ...st }}>{t("tabs").split(",").filter(Boolean).map((tab, i) => <div key={i} style={{ flex: 1, textAlign: "center", color: i === 0 ? "#f97316" : st.color, fontWeight: i === 0 ? 700 : 400 }}>{tab}</div>)}</div>`;
    }
    case 'topnav':
      return '<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", padding: "0 12px", boxSizing: "border-box", gap: 10, borderBottom: "1px solid #e5e7eb", ...st }}><span style={{ fontSize: 16 }}>‹</span><span style={{ flex: 1, textAlign: "center" }}>{p("title")}</span><span style={{ width: 16 }} /></div>';
    case 'list-item':
      return `<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 10, padding: "0 12px", boxSizing: "border-box", borderBottom: "1px solid #f3f4f6", ...st }}><div style={{ width: 40, height: 40, borderRadius: 8, background: "#f3f4f6", flexShrink: 0 }} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{p("title")}</div><div style={{ fontSize: 12, color: "#9ca3af" }}>{p("subtitle")}</div></div><span style={{ color: "#d1d5db" }}>›</span></div>`;
    case 'table':
      return `<div style={{ width: "100%", height: "100%", border: "1px solid #e5e7eb", display: "flex", flexDirection: "column", overflow: "hidden", boxSizing: "border-box", ...st }}><div style={{ display: "flex", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>{["列A", "列B", "列C"].map(h => <div key={h} style={{ flex: 1, padding: "6px 8px", fontWeight: 600 }}>{h}</div>)}</div>{Array.from({ length: Math.max(1, Number(props.rows) || 3) }).map((_, i) => <div key={i} style={{ display: "flex", flex: 1, alignItems: "center", borderBottom: "1px solid #f3f4f6" }}>{["—", "—", "—"].map((c, j) => <div key={j} style={{ flex: 1, padding: "4px 8px", color: "#9ca3af" }}>{c}</div>)}</div>)}</div>`;
    case 'stat':
      return `<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 14px", boxSizing: "border-box", gap: 4, boxShadow: "inset 0 0 0 1px #e5e7eb", ...st }}><span style={{ fontSize: 12, color: "#6b7280" }}>{p("label")}</span><span style={{ fontSize: 26, fontWeight: 700 }}>{p("value")}<span style={{ fontSize: 13, fontWeight: 400, color: "#6b7280", marginLeft: 3 }}>{p("unit")}</span></span></div>`;
    case 'progress': {
      return `<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 8 }}><div style={{ flex: 1, height: 10, borderRadius: 999, background: st.background, overflow: "hidden" }}><div style={{ width: "${'${'}Number(props.value) || 0}%", height: "100%", background: "#f97316", borderRadius: 999 }} /></div><span style={{ fontSize: 11, color: "#6b7280" }}>{p("value")}%</span></div>`;
    }
    case 'message-bubble': {
      return `<div style={{ width: "100%", height: "100%", display: "flex", justifyContent: props.side === "right" ? "flex-end" : "flex-start", alignItems: "center" }}><div style={{ maxWidth: "85%", padding: "8px 12px", borderRadius: 12, background: props.side === "right" ? "#f97316" : st.background, color: props.side === "right" ? "#fff" : st.color, fontSize: st.fontSize, boxSizing: "border-box" }}>{p("text")}</div></div>`;
    }
    case 'comment':
      return `<div style={{ width: "100%", height: "100%", display: "flex", gap: 8, padding: 8, boxSizing: "border-box", ...st }}><div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f3f4f6", flexShrink: 0 }} /><div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 12 }}>{p("name")}</b><div>{p("text")}</div><span style={{ fontSize: 11, color: "#9ca3af" }}>回复</span></div></div>`;
    case 'notification':
      return `<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 8, padding: "0 12px", boxSizing: "border-box", ...st }}><span>🔔</span><span style={{ flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{p("text")}</span><span style={{ opacity: .6 }}>✕</span></div>`;
    case 'mobile-statusbar':
      return '<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", boxSizing: "border-box", ...st }}><b>{p("time")}</b><span style={{ fontSize: 11 }}>📶 🔋</span></div>';
    case 'home-indicator':
      return '<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", ...st }}><div style={{ width: 134, height: 5, borderRadius: 999, background: "#111827", opacity: .85 }} /></div>';
    case 'watch-face':
      return '<div style={{ width: "100%", height: "100%", borderRadius: "50%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", ...st }}><div style={{ fontWeight: 700 }}>{p("time")}</div><div style={{ fontSize: 10, opacity: .6 }}>♡ 72</div></div>';
    case 'watch-list-row':
      return `<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", padding: "0 10px", boxSizing: "border-box", borderRadius: 8, gap: 6, ...st }}><span style={{ width: 6, height: 6, borderRadius: 3, background: "#f97316" }} /><span>{p("text")}</span></div>`;
    default:
      return '<div style={{ width: "100%", height: "100%", ...st }} />';
  }
}
