import { useEffect, useState } from "react";
import { Activity, Star, Trophy, Users, Check, ChevronRight, Menu, X } from "lucide-react";
import { PublicFooter } from "../PublicFooter/PublicFooter.jsx";
import { PublicPricingSection } from "../Pricing/PublicPricingSection.jsx";
import { PublicMenuLinks } from "../PublicNavigation/PublicMenuLinks.jsx";
import "./LandingPage.css";

export function LandingPage({ onLoginClick, onRegisterClick, onGalleryClick, onCalendarClick }) {
   const [scrolled, setScrolled] = useState(false);
   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
               <PublicMenuLinks />
            </div>
            <div className="navbar-actions">
               <button className="btn-primary btn-sm" onClick={onLoginClick}>Đăng Nhập</button>
               <button
                  className="mobile-menu-toggle"
                  type="button"
                  aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
                  aria-expanded={mobileMenuOpen}
                  aria-controls="mobile-public-navigation"
                  onClick={() => setMobileMenuOpen((open) => !open)}
               >
                  {mobileMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
               </button>
            </div>
            <div className={`mobile-nav-menu${mobileMenuOpen ? " open" : ""}`} id="mobile-public-navigation">
               <PublicMenuLinks onNavigate={() => setMobileMenuOpen(false)} />
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
                        <img src="https://i.pravatar.cc/100?img=11" alt="" width="48" height="48" />
                        <img src="https://i.pravatar.cc/100?img=12" alt="" width="48" height="48" />
                        <img src="https://i.pravatar.cc/100?img=13" alt="" width="48" height="48" />
                        <img src="https://i.pravatar.cc/100?img=14" alt="" width="48" height="48" />
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
                  <img src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=1000&auto=format&fit=crop" alt="Huấn luyện viên hỗ trợ hội viên" className="img-main" width="1000" height="667" loading="lazy" />
                  <img src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=800&auto=format&fit=crop" alt="Trang thiết bị tập luyện hiện đại" className="img-sub" width="800" height="533" loading="lazy" />
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
                  <div className="image-wrapper bg-soccer" role="img" aria-label="Sân bóng đá cỏ nhân tạo">
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
                  <button className="btn-text mt-4" onClick={onCalendarClick}>Xem lịch trống <ChevronRight size={18} /></button>
               </div>
            </div>

            {/* Feature 2 */}
            <div className="zigzag-row reverse">
               <div className="zigzag-image">
                  <div className="image-wrapper bg-gym" role="img" aria-label="Phòng tập Gym hiện đại">
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
                  <button className="btn-text mt-4" onClick={onGalleryClick}>Tham quan phòng tập <ChevronRight size={18} /></button>
               </div>
            </div>
         </section>

         <PublicPricingSection onRegisterClick={onRegisterClick} />

         {/* CTA Banner */}
         <section className="section-cta-banner">
            <div className="cta-banner-container">
               <div className="cta-banner-content">
                  <h2>Bắt đầu hành trình của bạn ngay hôm nay!</h2>
                  <p>Tạo tài khoản, xác thực email và hoàn thiện hồ sơ để được hỗ trợ lựa chọn gói phù hợp.</p>
               </div>
               <div className="cta-banner-action">
                  <button className="btn-primary btn-large bg-white text-primary" onClick={onRegisterClick}>
                     Tạo tài khoản
                  </button>
               </div>
            </div>
         </section>

         {/* Footer */}
         <PublicFooter />
      </div>
   );
}
