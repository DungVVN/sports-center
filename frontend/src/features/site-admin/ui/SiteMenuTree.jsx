import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../shared/ui/Button.jsx";

const NODE_WIDTH = 184;
const NODE_HEIGHT = 56;
const SIBLING_GAP = 24;
const LEVEL_GAP = 88;
const PADDING = 42;

function buildMenuTreeLayout(items, location) {
  const root = { id: "root", label: location === "header" ? "Trang chủ · Header" : "Trang chủ · Footer", children: items.map((item) => ({ ...item, children: item.children ?? [] })) };
  function width(node) {
    const children = node.children ?? [];
    node.treeWidth = children.length ? Math.max(NODE_WIDTH, children.reduce((sum, child) => sum + width(child), 0) + SIBLING_GAP * (children.length - 1)) : NODE_WIDTH;
    return node.treeWidth;
  }
  width(root);
  const nodes = [];
  const edges = [];
  function place(node, centerX, depth, parent) {
    const x = centerX - NODE_WIDTH / 2;
    const y = PADDING + depth * (NODE_HEIGHT + LEVEL_GAP);
    nodes.push({ ...node, x, y, depth, parentId: parent?.id ?? null });
    if (parent) {
      const middle = parent.y + NODE_HEIGHT + LEVEL_GAP / 2;
      edges.push({ id: `${parent.id}-${node.id}`, path: `M ${parent.x + NODE_WIDTH / 2} ${parent.y + NODE_HEIGHT} V ${middle} H ${centerX} V ${y}` });
    }
    let cursor = centerX - node.treeWidth / 2;
    for (const child of node.children ?? []) {
      place(child, cursor + child.treeWidth / 2, depth + 1, { id: node.id, x, y });
      cursor += child.treeWidth + SIBLING_GAP;
    }
  }
  place(root, PADDING + root.treeWidth / 2, 0, null);
  const depth = Math.max(0, ...nodes.map((node) => node.depth));
  return { nodes, edges, width: root.treeWidth + PADDING * 2, height: PADDING * 2 + NODE_HEIGHT + depth * (NODE_HEIGHT + LEVEL_GAP) };
}

export function SiteMenuTree({ items, location, selectedId, onSelect, onAddRoot }) {
  const layout = useMemo(() => buildMenuTreeLayout(items, location), [items, location]);
  const viewportRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const fit = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const next = Math.min(1, (viewport.clientWidth - 32) / layout.width, (viewport.clientHeight - 32) / layout.height);
    setZoom(Math.max(.25, Number(next.toFixed(2))));
    viewport.scrollTo?.({ left: 0, top: 0 });
  }, [layout]);
  useEffect(() => { fit(); }, [fit]);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const measure = () => setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    measure();
    if (typeof ResizeObserver !== "function") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  const scaledWidth = layout.width * zoom;
  const scaledHeight = layout.height * zoom;
  const canvasWidth = Math.max(scaledWidth, viewportSize.width);
  const canvasHeight = Math.max(scaledHeight, viewportSize.height);

  return <div className="site-admin__tree-workspace">
    <div className="site-admin__tree-toolbar"><div><strong>Đồ thị cây phân cấp ({items.length} mục cấp 1)</strong><span>Chọn node để sửa; thêm mục con trong bảng chỉnh sửa.</span></div><div className="site-admin__tree-tools"><Button disabled={items.length >= 20} onClick={onAddRoot} size="sm">+ Thêm mục cấp 1</Button><button type="button" onClick={fit}>Fit toàn cảnh</button><div className="site-admin__zoom"><button type="button" aria-label="Thu nhỏ sơ đồ" onClick={() => setZoom((value) => Math.max(.25, Number((value - .1).toFixed(2))))}>−</button><output>{Math.round(zoom * 100)}%</output><button type="button" aria-label="Phóng to sơ đồ" onClick={() => setZoom((value) => Math.min(1.6, Number((value + .1).toFixed(2))))}>+</button></div></div></div>
    <div className="site-admin__tree-viewport" ref={viewportRef} aria-label="Sơ đồ cây menu"><div className="site-admin__tree-sized" style={{ width: canvasWidth, height: canvasHeight }}><div className="site-admin__tree-layer" style={{ left: (canvasWidth - scaledWidth) / 2, top: (canvasHeight - scaledHeight) / 2, width: layout.width, height: layout.height, transform: `scale(${zoom})` }}><svg className="site-admin__tree-edges" width={layout.width} height={layout.height} aria-hidden="true">{layout.edges.map((edge) => <path key={edge.id} d={edge.path} fill="none" stroke="currentColor" strokeWidth="1.6" />)}</svg>{layout.nodes.map((node) => node.id === "root" ? <div className="site-admin__tree-root" key={node.id} style={{ left: node.x, top: node.y, width: NODE_WIDTH, height: NODE_HEIGHT }}>{node.label}</div> : <button type="button" className={`site-admin__tree-node${selectedId === node.id ? " is-selected" : ""}${node.active ? "" : " is-hidden"}`} key={node.id} style={{ left: node.x, top: node.y, width: NODE_WIDTH, height: NODE_HEIGHT }} onClick={() => onSelect(node.depth === 1 ? node.id : node.parentId)} aria-label={`Chỉnh sửa ${node.label}`}><strong>{node.label}</strong><small>{node.depth === 1 && node.kind === "group" ? `${node.children.length} mục con` : node.href || "Nhóm liên kết"}</small></button>)}</div></div>{items.length === 0 && <div className="site-admin__tree-empty">Menu chưa có mục nào. Chọn “Thêm mục cấp 1” để bắt đầu.</div>}</div>
  </div>;
}
