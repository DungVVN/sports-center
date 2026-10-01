import { useEffect, useState } from "react";
import { Activity, Trophy, Menu, X } from "lucide-react";
import { PublicFooter } from "../PublicFooter/PublicFooter.jsx";
import { corePages } from "../../model/core-pages.js";
import { PublicMenuLinks } from "../PublicNavigation/PublicMenuLinks.jsx";
import "./LandingPage.css";

export function LandingPage({ onLoginClick, onRegisterClick }) {
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

         <section className="section-zigzag" aria-label="Khám phá Kinetic">
            <div className="section-header center">
               <span className="section-subtitle">KHÁM PHÁ KINETIC</span>
               <h2>Tìm thông tin cho hành trình tập luyện</h2>
            </div>
            <div className="public-page-directory">
               {corePages.map((page) => <a className="public-page-directory__link" href={page.path} key={page.path}><h3>{page.label}</h3><p>{page.description}</p><span>Xem chi tiết →</span></a>)}
            </div>
         </section>
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
