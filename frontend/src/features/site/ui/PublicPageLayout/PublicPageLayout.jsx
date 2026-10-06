import { useEffect, useState } from "react";
import { Activity, ArrowLeft, Menu, X } from "lucide-react";
import { PublicFooter } from "../PublicFooter/PublicFooter.jsx";
import { PublicMenuLinks } from "../PublicNavigation/PublicMenuLinks.jsx";
import "./PublicPageLayout.css";

export function PublicPageLayout({ children, onHomeClick, onLoginClick, showBack = true }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="landing-container">
      <div className="blob blob-1" aria-hidden="true" />
      <div className="blob blob-2" aria-hidden="true" />
      <div className="watermark" aria-hidden="true">SPORTS</div>

      <nav className="landing-navbar scrolled" aria-label="Điều hướng trang công khai">
        <a className="navbar-logo public-page-logo" href="/" onClick={(event) => { event.preventDefault(); onHomeClick(); }} aria-label="Kinetic - Trang chủ">
          <span className="logo-icon-wrapper"><Activity size={24} className="logo-icon" /></span>
          <span className="logo-text">Kinetic</span>
        </a>
        <div className="navbar-links"><PublicMenuLinks /></div>
        <div className="navbar-actions">
          <button className="btn-primary btn-sm" type="button" onClick={onLoginClick}>Đăng Nhập</button>
          <button className="mobile-menu-toggle" type="button" aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"} aria-expanded={mobileMenuOpen} aria-controls="mobile-public-navigation" onClick={() => setMobileMenuOpen((open) => !open)}>{mobileMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}</button>
        </div>
        <div className={`mobile-nav-menu${mobileMenuOpen ? " open" : ""}`} id="mobile-public-navigation"><PublicMenuLinks onNavigate={() => setMobileMenuOpen(false)} /></div>
      </nav>

      <main className="public-page-body" id="main-content">
        {showBack && <div className="public-page-back-row">
          <button className="public-page-back" type="button" onClick={onHomeClick}>
            <ArrowLeft size={18} aria-hidden="true" /> Quay lại
          </button>
        </div>}
        {children}
      </main>

      <PublicFooter />
    </div>
  );
}
