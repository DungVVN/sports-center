import { Activity, MapPin, Phone, Mail } from 'lucide-react';

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
            Hệ sinh thái thể thao 5 sao, mang đến môi trường tập luyện lý tưởng. Nơi khơi nguồn năng lượng và kết nối cộng đồng yêu thể thao.
          </p>
        </div>

        <div className="footer-col">
          <h4>Dịch Vụ</h4>
          <ul className="footer-links">
            <li><a href="/#facilities">Sân Bóng Đá</a></li>
            <li><a href="/#facilities">Phòng Gym</a></li>
            <li><a href="/#facilities">Yoga & Group X</a></li>
            <li><a href="/#facilities">Sân Tennis</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Liên Hệ</h4>
          <ul className="contact-list">
            <li><MapPin size={18} /> 123 Đường Thể Thao, Quận 1, TP.HCM</li>
            <li><Phone size={18} /> 1900 1234</li>
            <li><Mail size={18} /> contact@kineticsports.io.vn</li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Kinetic Sports Center. All rights reserved. Tự hào mang lại sức khỏe cho mọi người.</p>
      </div>
    </footer>
  );
}
