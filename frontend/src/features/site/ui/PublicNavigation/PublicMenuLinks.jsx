import { useQuery } from "@tanstack/react-query";
import { publicSiteApi, siteCmsPublicEnabled } from "../../api/site-public-api.js";
import { corePages } from "../../model/core-pages.js";
import "./public-menu.css";

const fallbackHeader = corePages.map((page) => ({ id: page.path, label: page.label, kind: "link", href: page.path, active: true, children: [] }));
const fallbackFooter = [
  { id: "football", label: "Sân Bóng Đá", kind: "link", href: "/dich-vu", active: true, children: [] },
  { id: "gym", label: "Phòng Gym", kind: "link", href: "/dich-vu", active: true, children: [] },
  { id: "yoga", label: "Yoga & Group X", kind: "link", href: "/dich-vu", active: true, children: [] },
  { id: "pricing", label: "Bảng Giá", kind: "link", href: "/bang-gia", active: true, children: [] },
];
const cmsFallbackHeader = fallbackHeader;
const cmsFallbackFooter = [
  { id: "home", label: "Trang Chủ", kind: "link", href: "/", active: true, children: [] },
  { id: "gallery", label: "Thư Viện", kind: "link", href: "/gallery", active: true, children: [] },
  { id: "calendar", label: "Lịch Hoạt Động", kind: "link", href: "/calendar", active: true, children: [] },
];

function MenuLinks({ items, location, onNavigate }) {
  return <div className={location === "header" ? "public-menu-links" : "public-menu-links public-menu-links--footer"}>{items.map((item) => item.kind === "group" ? <details className="public-menu-links__group" key={item.id}><summary>{item.label}</summary><div className="public-menu-links__children">{item.children.filter((child) => child.active).map((child) => <a href={child.href} key={child.id} onClick={onNavigate}>{child.label}</a>)}</div></details> : <a href={item.href} key={item.id} onClick={onNavigate}>{item.label}</a>)}</div>;
}

function PublishedMenuLinks({ location, onNavigate }) {
  const query = useQuery({ queryKey: ["public-site-menu", location], queryFn: () => publicSiteApi.menu(location), retry: false, staleTime: 300_000 });
  const items = query.data?.items ?? (location === "header" ? cmsFallbackHeader : cmsFallbackFooter);
  return <MenuLinks items={items} location={location} onNavigate={onNavigate} />;
}

export function PublicMenuLinks({ location = "header", onNavigate }) {
  if (siteCmsPublicEnabled) return <PublishedMenuLinks location={location} onNavigate={onNavigate} />;
  return <MenuLinks items={location === "header" ? fallbackHeader : fallbackFooter} location={location} onNavigate={onNavigate} />;
}
