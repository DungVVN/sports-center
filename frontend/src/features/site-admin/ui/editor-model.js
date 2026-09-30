export const blockNames = {
  hero: "Hero",
  richText: "Nội dung",
  imageText: "Ảnh và nội dung",
  cta: "Kêu gọi hành động",
  faq: "Câu hỏi thường gặp",
};

const blockDefaults = {
  hero: { eyebrow: "", title: "Tiêu đề mới", description: "", imageUrl: "", buttonLabel: "", buttonHref: "" },
  richText: { title: "Tiêu đề mới", body: "" },
  imageText: { title: "Tiêu đề mới", body: "", imageUrl: "", imageAlt: "" },
  cta: { title: "Tiêu đề mới", body: "", buttonLabel: "", buttonHref: "" },
  faq: { title: "Câu hỏi thường gặp", items: [{ question: "Câu hỏi", answer: "Câu trả lời" }] },
};

export function newBlock(type) {
  return { id: crypto.randomUUID(), type, active: true, ...blockDefaults[type] };
}

export function newMenuItem(kind = "link") {
  return { id: crypto.randomUUID(), label: "Mục mới", kind, href: kind === "link" ? "/" : "", active: true, children: [] };
}
