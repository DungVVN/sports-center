export const blockNames = {
  hero: "Mở đầu trang",
  richText: "Nội dung văn bản",
  imageText: "Ảnh và nội dung",
  cta: "Kêu gọi hành động",
  faq: "Câu hỏi thường gặp",
};

export const blockDescriptions = {
  hero: "Tiêu đề lớn, lời giới thiệu, ảnh và một hành động chính.",
  richText: "Một phần nội dung dài có tiêu đề riêng.",
  imageText: "Đặt hình ảnh cạnh nội dung giới thiệu dịch vụ.",
  cta: "Thông điệp ngắn và nút dẫn đến bước tiếp theo.",
  faq: "Danh sách câu hỏi và câu trả lời có thể mở rộng.",
};

const blockDefaults = {
  hero: { eyebrow: "", title: "Tiêu đề mới", description: "", imageUrl: "", imageAlt: "", buttonLabel: "", buttonHref: "" },
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
