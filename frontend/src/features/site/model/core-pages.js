export const corePages = [
  { path: "/ve-chung-toi", label: "Về Chúng Tôi", description: "Tìm hiểu Kinetic và cộng đồng yêu thể thao." },
  { path: "/dich-vu", label: "Dịch Vụ", description: "Khám phá Gym, Yoga và sân bóng đá." },
  { path: "/bang-gia", label: "Bảng Giá", description: "Xem giá, thời hạn và quyền lợi gói đang mở bán." },
  { path: "/lien-he", label: "Liên Hệ", description: "Thông tin liên hệ và hỗ trợ đăng ký tập luyện." },
];

export const isCorePage = (path) => corePages.some((page) => page.path === path);
export const publicSiteOrigin = "https://kineticsports.io.vn";
export const homeSeo = {
  title: "Kinetic Sports Center",
  seoTitle: "Kinetic Sports Center | Gym, Yoga & Sân bóng đá",
  seoDescription: "Khám phá Gym, Yoga và sân bóng đá tại Kinetic Sports Center. Xem dịch vụ, bảng giá gói hội viên và thông tin liên hệ để bắt đầu tập luyện.",
};
