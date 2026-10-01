import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SiteMenuTree } from "./SiteMenuTree.jsx";

afterEach(cleanup);

it("lays out nested groups without mutating the menu saved to the API", () => {
  const child = Object.freeze({ id: "gallery", label: "Thư viện ảnh", kind: "link", href: "/gallery", active: true, children: Object.freeze([]) });
  const items = Object.freeze([Object.freeze({ id: "discover", label: "Khám phá", kind: "group", active: true, children: Object.freeze([child]) })]);
  render(<SiteMenuTree items={items} location="header" onSelect={() => {}} onAddRoot={() => {}} />);
  expect(screen.getByRole("button", { name: "Chỉnh sửa Thư viện ảnh" })).toBeInTheDocument();
  expect(child).not.toHaveProperty("treeWidth");
});
