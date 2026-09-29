import { useEffect } from "react";
import { Activity, ArrowLeft } from "lucide-react";
import { PublicFooter } from "../PublicFooter/PublicFooter.jsx";
import "./PublicPageLayout.css";

export function PublicPageLayout({ children, onHomeClick, onLoginClick }) {
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
        <div className="navbar-actions">
          <button className="btn-primary btn-sm" type="button" onClick={onLoginClick}>Đăng Nhập</button>
        </div>
      </nav>

      <main className="public-page-body" id="main-content">
        <div className="public-page-back-row">
          <button className="public-page-back" type="button" onClick={onHomeClick}>
            <ArrowLeft size={18} aria-hidden="true" /> Quay lại
          </button>
        </div>
        {children}
      </main>

      <PublicFooter />
    </div>
  );
}
