import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { publicMembershipPackages } from "../../../memberships/index.js";

export function PublicPricingSection({ onRegisterClick }) {
  const { data: packages = [], isPending, isError, refetch } = useQuery({
    queryKey: ["public-membership-packages"], queryFn: publicMembershipPackages, retry: false,
  });
  return <section id="pricing" className="section-pricing">
    <div className="section-header center"><span className="section-subtitle">ĐẦU TƯ CHO SỨC KHỎE</span><h2>Gói Hội Viên Linh Hoạt</h2><p className="max-w-xl">Giá và quyền lợi theo từng thời hạn gói. Tạo tài khoản để bắt đầu; nhân viên sẽ hỗ trợ đăng ký và thanh toán gói sau khi tài khoản được duyệt.</p></div>
    {isPending && <p className="pricing-state" role="status">Đang tải bảng giá...</p>}
    {isError && <div className="pricing-state" role="alert"><p>Chưa tải được bảng giá. Vui lòng thử lại.</p><button className="btn-secondary" onClick={() => refetch()}>Thử lại</button></div>}
    {!isPending && !isError && packages.length === 0 && <p className="pricing-state">Hiện chưa có gói hội viên được mở bán.</p>}
    {!isPending && !isError && packages.length > 0 && <div className="pricing-grid">
      {packages.map((pkg) => <article className={`price-card${pkg.code === "STANDARD" ? " featured" : ""}`} key={pkg.code}>
        <div className="price-header"><span className="price-duration">{pkg.durationDays} ngày sử dụng</span><h3>{pkg.name}</h3><div className="price">{Number(pkg.priceVnd).toLocaleString("vi-VN")}<span> ₫ / gói</span></div></div>
        <div className="price-body"><p>Quyền lợi bao gồm</p><ul>{pkg.benefits.map((benefit) => <li key={benefit}><Check size={18} aria-hidden="true" />{benefit}</li>)}</ul><button className="btn-primary w-full" onClick={onRegisterClick}>Tạo tài khoản</button></div>
      </article>)}
    </div>}
  </section>;
}
