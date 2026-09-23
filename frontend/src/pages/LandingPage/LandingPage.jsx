import { useEffect, useState } from "react";
import { Activity, MapPin, Phone, Mail, Star, Trophy, Users, Check, ChevronRight } from "lucide-react";
import "./LandingPage.css";

export function LandingPage({ onLoginClick, onRegisterClick }) {
   const [scrolled, setScrolled] = useState(false);

   useEffect(() => {
      const handleScroll = () => {
         setScrolled(window.scrollY > 50);
      };
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
   }, []);

   return (
      <div className="landing-container">
         {/* Decorative Background Elements */}
         <div className="blob blob-1"></div>
         <div className="blob blob-2"></div>
         <div className="watermark">SPORTS</div>

         {/* Navbar */}
         <nav className={`landing-navbar ${scrolled ? 'scrolled' : ''}`}>
            <div className="navbar-logo">
               <div className="logo-icon-wrapper">
                  <Activity size={24} className="logo-icon" />
               </div>
               <span className="logo-text">Kinetic</span>
            </div>
            <div className="navbar-links">
               <a href="#about">Về Chúng Tôi</a>
               <a href="#facilities">Dịch Vụ</a>
               <a href="#gallery">Thư Viện</a>
               <a href="#pricing">Bảng Giá</a>
               <a href="#contact">Liên Hệ</a>
            </div>
            <div className="navbar-actions">
               <button className="btn-primary btn-sm" onClick={onLoginClick}>Đăng Nhập</button>
            </div>
         </nav>

         {/* Hero Section (Modern Split Layout) */}
         <header className="hero-section">
            <div className="hero-grid">
               <div className="hero-content-left">
                  <div className="hero-badge">
                     <span className="badge-dot"></span>
                     TRUNG TÂM THỂ THAO ĐẲNG CẤP 5 SAO
                  </div>
                  <h1 className="hero-title">
                     Đánh Thức Đam Mê <br />
                     <span className="text-gradient">Kiến Tạo Sức Khỏe</span>
                  </h1>
                  <p className="hero-subtitle">
                     Không gian tập luyện hiện đại, trang thiết bị tối tân cùng hệ sinh thái đa dạng. Nơi lý tưởng để bạn bứt phá mọi giới hạn của bản thân.
                  </p>
                  <div className="hero-social-proof">
                     <div className="avatars">
                        <img src="https://i.pravatar.cc/100?img=11" alt="user" />
                        <img src="https://i.pravatar.cc/100?img=12" alt="user" />
                        <img src="https://i.pravatar.cc/100?img=13" alt="user" />
                        <img src="https://i.pravatar.cc/100?img=14" alt="user" />
                     </div>
                     <p>Hơn <strong>10,000+</strong> hội viên đã tin tưởng và đồng hành.</p>
                  </div>
               </div>

               <div className="hero-image-right">
                  <div className="hero-image-main"></div>
                  {/* Floating UI Elements */}
                  <div className="floating-card card-top-right">
                     <div className="icon-box"><Trophy size={20} color="#F97316" /></div>
                     <div>
                        <h4>Top 1</h4>
                        <p>Trung tâm năm 2026</p>
                     </div>
                  </div>
                  <div className="floating-card card-bottom-left">
                     <div className="icon-box"><Activity size={20} color="#2563EB" /></div>
                     <div>
                        <h4>24/7</h4>
                        <p>Không giới hạn giờ</p>
                     </div>
                  </div>
               </div>
            </div>
         </header>

         {/* About Section */}
         <section id="about" className="section-about">
            <div className="about-grid">
               <div className="about-images">
                  <img src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=1000&auto=format&fit=crop" alt="Trainer helping member" className="img-main" />
                  <img src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=800&auto=format&fit=crop" alt="Modern gym equipment" className="img-sub" />
                  <div className="experience-badge">
                     <span className="years">10+</span>
                     <span className="text">Năm KInh Nghiệm</span>
                  </div>
               </div>
               <div className="about-content">
                  <span className="section-subtitle">VỀ CHÚNG TÔI</span>
                  <h2>Hành Trình Kiến Tạo <br /> Sức Khỏe Cộng Đồng</h2>
                  <p className="about-desc">
                     Kinetic Sports Center không chỉ là một trung tâm thể thao, mà là một hệ sinh thái chăm sóc sức khỏe toàn diện. Chúng tôi tin rằng một cơ thể khỏe mạnh là nền tảng cho một cuộc sống hạnh phúc và thành công.
                  </p>
                  <p className="about-desc">
                     Với sự đầu tư mạnh mẽ vào cơ sở vật chất, 100% trang thiết bị nhập khẩu từ châu Âu cùng đội ngũ huấn luyện viên đạt chuẩn quốc tế, Kinetic cam kết mang lại trải nghiệm luyện tập an toàn, chuyên nghiệp và hiệu quả nhất cho từng hội viên.
                  </p>
                  <div className="about-features">
                     <div className="feature">
                        <div className="icon-wrapper"><Star size={20} /></div>
                        <span>Chất lượng 5 sao</span>
                     </div>
                     <div className="feature">
                        <div className="icon-wrapper"><Users size={20} /></div>
                        <span>Cộng đồng tinh hoa</span>
                     </div>
                  </div>
               </div>
            </div>
         </section>

         {/* Stats Divider */}
         <div className="stats-divider">
            <div className="stat-block">
               <h3>5+</h3>
               <p>Môn Thể Thao</p>
            </div>
            <div className="stat-block">
               <h3>5,000 m²</h3>
               <p>Diện Tích Mặt Sàn</p>
            </div>
            <div className="stat-block">
               <h3>50+</h3>
               <p>HLV Quốc Tế</p>
            </div>
            <div className="stat-block">
               <h3>100%</h3>
               <p>Thiết Bị Nhập Khẩu</p>
            </div>
         </div>

         {/* Facilities - Zig Zag Layout */}
         <section id="facilities" className="section-zigzag">
            <div className="section-header center">
               <span className="section-subtitle">DỊCH VỤ NỔI BẬT</span>
               <h2>Trải Nghiệm Đỉnh Cao</h2>
               <p className="max-w-xl">Mỗi khu vực đều được thiết kế tỉ mỉ, tối ưu hóa không gian và công năng để mang lại trải nghiệm tuyệt vời nhất.</p>
            </div>

            {/* Feature 1 */}
            <div className="zigzag-row">
               <div className="zigzag-image">
                  <div className="image-wrapper bg-soccer">
                     <div className="image-overlay"></div>
                  </div>
               </div>
               <div className="zigzag-content">
                  <div className="content-badge">Premium</div>
                  <h3>Sân Bóng Đá Cỏ Nhân Tạo</h3>
                  <p>Tận hưởng cảm giác thi đấu trên mặt cỏ đạt chuẩn FIFA. Hệ thống thoát nước tối ưu và dàn đèn chiếu sáng LED chống chói giúp các trận đấu diễn ra hoàn hảo bất kể thời tiết hay ngày đêm.</p>
                  <ul className="feature-list">
                     <li><Check size={18} className="list-icon" /> Cỏ nhân tạo thế hệ mới, êm ái, chống chấn thương.</li>
                     <li><Check size={18} className="list-icon" /> Băng ghế huấn luyện viên có mái che chuẩn chuyên nghiệp.</li>
                     <li><Check size={18} className="list-icon" /> Cung cấp bóng thi đấu và nước uống miễn phí.</li>
                  </ul>
                  <button className="btn-text mt-4" onClick={onLoginClick}>Xem lịch trống <ChevronRight size={18} /></button>
               </div>
            </div>

            {/* Feature 2 */}
            <div className="zigzag-row reverse">
               <div className="zigzag-image">
                  <div className="image-wrapper bg-gym">
                     <div className="image-overlay"></div>
                  </div>
               </div>
               <div className="zigzag-content">
                  <div className="content-badge">Fitness</div>
                  <h3>Phòng Gym & Yoga 360°</h3>
                  <p>Không gian mở với vách kính cường lực nhìn toàn cảnh thành phố. Được trang bị 100% thiết bị từ Technogym, đáp ứng mọi nhu cầu từ Cardio, Free-weight đến các lớp Group X năng động.</p>
                  <ul className="feature-list">
                     <li><Check size={18} className="list-icon" /> Hơn 100 máy tập đa dạng, không phải chờ đợi.</li>
                     <li><Check size={18} className="list-icon" /> Inbody miễn phí, lên phác đồ tập luyện cá nhân hóa.</li>
                     <li><Check size={18} className="list-icon" /> Phòng Studio Yoga rộng 200m2 với thảm tập kháng khuẩn.</li>
                  </ul>
                  <button className="btn-text mt-4" onClick={onLoginClick}>Tham quan phòng tập <ChevronRight size={18} /></button>
               </div>
            </div>
         </section>

         {/* Gallery Section */}
         <section id="gallery" className="section-gallery">
            <div className="section-header center">
               <span className="section-subtitle">THƯ VIỆN HÌNH ẢNH</span>
               <h2>Không Gian Luyện Tập Thực Tế</h2>
               <p className="max-w-xl">Chiêm ngưỡng cơ sở vật chất đẳng cấp và không khí tập luyện tràn đầy năng lượng tại Kinetic Sports.</p>
            </div>
            <div className="gallery-grid">
               <div className="gallery-item large">
                  <img src="https://images.unsplash.com/photo-1540497077202-7c8a3999166f?q=80&w=2000&auto=format&fit=crop" alt="Gym weights" />
                  <div className="gallery-overlay"><span>Phòng Thể Lực</span></div>
               </div>
               <div className="gallery-item">
                  <img src="https://images.unsplash.com/photo-1504450758481-7338eba7524a?q=80&w=1000&auto=format&fit=crop" alt="Basketball court" />
                  <div className="gallery-overlay"><span>Sân Bóng Rổ</span></div>
               </div>
               <div className="gallery-item tall">
                  <img src="https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=1000&auto=format&fit=crop" alt="Yoga class" />
                  <div className="gallery-overlay"><span>Phòng Yoga</span></div>
               </div>
               <div className="gallery-item">
                  <img src="https://images.unsplash.com/photo-1530549387789-4c1017266635?q=80&w=1000&auto=format&fit=crop" alt="Swimming pool" />
                  <div className="gallery-overlay"><span>Hồ Bơi 4 Mùa</span></div>
               </div>
               <div className="gallery-item wide">
                  <img src="https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=1000&auto=format&fit=crop" alt="Running track" />
                  <div className="gallery-overlay"><span>Đường Chạy Track</span></div>
               </div>
               <div className="gallery-item wide">
                  <img src="https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=1000&auto=format&fit=crop" alt="Tennis court" />
                  <div className="gallery-overlay"><span>Sân Quần Vợt</span></div>
               </div>
            </div>
         </section>

         {/* Pricing Section */}
         <section id="pricing" className="section-pricing">
            <div className="section-header center">
               <span className="section-subtitle">ĐẦU TƯ CHO SỨC KHỎE</span>
               <h2>Gói Hội Viên Linh Hoạt</h2>
            </div>
            <div className="pricing-grid">
               <div className="price-card">
                  <div className="price-header">
                     <h4>Cơ Bản</h4>
                     <div className="price">500.000đ<span>/tháng</span></div>
                  </div>
                  <div className="price-body">
                     <ul>
                        <li><Check size={16} className="text-primary" /> Giới hạn giờ tập (8h - 16h)</li>
                        <li><Check size={16} className="text-primary" /> Miễn phí nước uống</li>
                        <li><Check size={16} className="text-primary" /> Tủ đồ sử dụng trong ngày</li>
                        <li className="disabled"><Check size={16} /> Lớp học Group X/Yoga</li>
                        <li className="disabled"><Check size={16} /> Khăn tập & Xông hơi</li>
                     </ul>
                     <button className="btn-secondary w-full" onClick={onRegisterClick}>Đăng Ký Ngay</button>
                  </div>
               </div>

               <div className="price-card popular">
                  <div className="popular-badge">Khuyên Dùng</div>
                  <div className="price-header">
                     <h4>Không Giới Hạn</h4>
                     <div className="price">890.000đ<span>/tháng</span></div>
                  </div>
                  <div className="price-body">
                     <ul>
                        <li><Check size={16} className="text-accent" /> Tập luyện 24/7 mọi chi nhánh</li>
                        <li><Check size={16} className="text-accent" /> Tham gia toàn bộ lớp Group X/Yoga</li>
                        <li><Check size={16} className="text-accent" /> Miễn phí khăn tập, nước uống</li>
                        <li><Check size={16} className="text-accent" /> Sử dụng phòng xông hơi Sauna</li>
                        <li><Check size={16} className="text-accent" /> 2 buổi HLV cá nhân miễn phí</li>
                     </ul>
                     <button className="btn-primary w-full" onClick={onRegisterClick}>Đăng Ký Ngay</button>
                  </div>
               </div>
            </div>
         </section>

         {/* CTA Banner */}
         <section className="section-cta-banner">
            <div className="cta-banner-container">
               <div className="cta-banner-content">
                  <h2>Bắt đầu hành trình của bạn ngay hôm nay!</h2>
                  <p>Nhận ngay Voucher giảm giá 30% cho khách hàng mới đăng ký lần đầu.</p>
               </div>
               <div className="cta-banner-action">
                  <button className="btn-primary btn-large bg-white text-primary" onClick={onRegisterClick}>
                     Nhận Ưu Đãi
                  </button>
               </div>
            </div>
         </section>

         {/* Footer */}
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
                     <li><a href="#facilities">Sân Bóng Đá</a></li>
                     <li><a href="#facilities">Phòng Gym</a></li>
                     <li><a href="#facilities">Yoga & Group X</a></li>
                     <li><a href="#facilities">Sân Tennis</a></li>
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
               <p>&copy; 2026 Kinetic Sports Center. All rights reserved. Tự hào mang lại sức khỏe cho mọi người.</p>
            </div>
         </footer>
      </div>
   );
}
