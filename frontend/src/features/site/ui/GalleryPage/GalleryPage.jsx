import { PublicPageLayout } from '../PublicPageLayout/PublicPageLayout.jsx';
import './GalleryPage.css';
import { ManagedPublicPage } from '../SiteRoute/SiteRoute.jsx';

export function GalleryPage({ onLoginClick, onHomeClick }) {
  return <ManagedPublicPage path="/gallery" onLoginClick={onLoginClick} onHomeClick={onHomeClick} fallback={<LegacyGalleryPage onLoginClick={onLoginClick} onHomeClick={onHomeClick} />} />;
}

function LegacyGalleryPage({ onLoginClick, onHomeClick }) {
  return (
    <PublicPageLayout onHomeClick={onHomeClick} onLoginClick={onLoginClick}>
      <section id="gallery" className="section-gallery">
        <header className="public-gallery-header">
          <p className="public-gallery-eyebrow">THƯ VIỆN HÌNH ẢNH</p>
          <h2>Khám Phá Không Gian Thể Thao</h2>
          <p>Hình ảnh minh họa các khu vực và hoạt động thể thao, không phải ảnh chụp cơ sở Kinetic Sports.</p>
        </header>
        <div className="gallery-grid">
            <div className="gallery-item large">
              <img src="/assets/images/gym.jpg" alt="Phòng Gym" width="800" height="600" loading="lazy" />
              <div className="gallery-overlay"><span>Phòng Thể Lực</span></div>
            </div>
            <div className="gallery-item">
              <img src="/images/basketball_court.jpg" alt="Sân bóng rổ" width="800" height="600" loading="lazy" />
              <div className="gallery-overlay"><span>Sân Bóng Rổ</span></div>
            </div>
            <div className="gallery-item tall">
              <img src="/images/yoga.jpg" alt="Các tư thế yoga" width="800" height="600" loading="lazy" />
              <div className="gallery-overlay"><span>Phòng Yoga</span></div>
            </div>
            <div className="gallery-item">
              <img src="/images/pool.jpg" alt="Hồ bơi" width="800" height="600" loading="lazy" />
              <div className="gallery-overlay"><span>Hồ Bơi 4 Mùa</span></div>
            </div>
            <div className="gallery-item wide">
              <img src="/images/soccer_field.jpg" alt="Sân bóng đá" width="800" height="600" loading="lazy" />
              <div className="gallery-overlay"><span>Sân Bóng Đá</span></div>
            </div>
            <div className="gallery-item wide">
              <img src="/images/track.jpg" alt="Đường chạy điền kinh" width="800" height="600" loading="lazy" />
              <div className="gallery-overlay"><span>Đường Chạy Track</span></div>
            </div>
            <div className="gallery-item wide">
              <img src="/images/tennis.jpg" alt="Sân Tennis" width="800" height="600" loading="lazy" />
              <div className="gallery-overlay"><span>Sân Quần Vợt</span></div>
            </div>
            <div className="gallery-item wide">
              <img src="/images/volleyball.jpg" alt="Trận bóng chuyền" width="800" height="600" loading="lazy" />
              <div className="gallery-overlay"><span>Sân Bóng Chuyền</span></div>
            </div>
        </div>
      </section>
    </PublicPageLayout>
  );
}
