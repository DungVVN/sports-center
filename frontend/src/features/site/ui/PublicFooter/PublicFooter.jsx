import { Activity, ArrowRight } from 'lucide-react';
import { PublicMenuLinks } from "../PublicNavigation/PublicMenuLinks.jsx";

export function PublicFooter() {
  return (
    <footer id="contact" className="landing-footer">
      <div className="footer-grid">
        <div className="footer-col brand-col">
          <div className="navbar-logo">
            <div className="logo-icon-wrapper">
              <Activity size={24} className="logo-icon" />
            </div>
            <span className="logo-text">Kinetic Sports</span>
          </div>
          <p className="footer-desc mt-4">
            Khám phá Gym, Yoga và bóng đá. Lựa chọn hoạt động phù hợp với lịch tập của bạn và kết nối cộng đồng yêu thể thao.
          </p>
        </div>

        <div className="footer-col">
          <h4>Dịch Vụ</h4>
          <PublicMenuLinks location="footer" />
        </div>

        <div className="footer-col">
          <h4>Hỗ Trợ</h4>
          <ul className="contact-list">
            <li><ArrowRight size={18} /><a href="/lien-he">Tư vấn dịch vụ và gói hội viên</a></li>
            <li><ArrowRight size={18} /><a href="/huong-dan-dang-ky-tap-luyen">Hướng dẫn đăng ký tập luyện</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Kinetic Sports Center. All rights reserved. Tự hào mang lại sức khỏe cho mọi người.</p>
      </div>
    </footer>
  );
}
