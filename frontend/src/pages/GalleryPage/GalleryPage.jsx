import { PublicPageLayout } from '../../components/PublicPageLayout/PublicPageLayout.jsx';
import './GalleryPage.css';

export function GalleryPage({ onLoginClick, onHomeClick }) {
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
              <img src="/assets/images/gym.jpg" alt="Gym" />
              <div className="gallery-overlay"><span>Phòng Thể Lực</span></div>
            </div>
            <div className="gallery-item">
              <img src="/images/basketball_court.jpg" alt="Basketball court" />
              <div className="gallery-overlay"><span>Sân Bóng Rổ</span></div>
            </div>
            <div className="gallery-item tall">
              <img src="/images/yoga.jpg" alt="Hình minh họa các tư thế yoga" />
              <div className="gallery-overlay"><span>Phòng Yoga</span></div>
            </div>
            <div className="gallery-item">
              <img src="/images/pool.jpg" alt="Swimming pool" />
              <div className="gallery-overlay"><span>Hồ Bơi 4 Mùa</span></div>
            </div>
            <div className="gallery-item wide">
              <img src="/images/soccer_field.jpg" alt="Soccer field" />
              <div className="gallery-overlay"><span>Sân Bóng Đá</span></div>
            </div>
            <div className="gallery-item wide">
              <img src="/images/track.jpg" alt="Cận cảnh mặt đường chạy" />
              <div className="gallery-overlay"><span>Đường Chạy Track</span></div>
            </div>
            <div className="gallery-item wide">
              <img src="/images/tennis.jpg" alt="Tennis court" />
              <div className="gallery-overlay"><span>Sân Quần Vợt</span></div>
            </div>
            <div className="gallery-item wide">
              <img src="/images/volleyball.jpg" alt="Hình minh họa trận bóng chuyền" />
              <div className="gallery-overlay"><span>Sân Bóng Chuyền</span></div>
            </div>
        </div>
      </section>
    </PublicPageLayout>
  );
}
