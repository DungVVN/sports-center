import { Button } from "../../../../shared/ui/Button.jsx";
import "./NotFoundPage.css";

export function NotFoundPage({ onHome, onLogin }) {
  return <main className="not-found-page">
    <section aria-labelledby="not-found-title" className="not-found-page__card">
      <p className="not-found-page__code">404</p>
      <h1 id="not-found-title">Không tìm thấy trang</h1>
      <p>Đường dẫn bạn nhập không tồn tại hoặc đã được thay đổi.</p>
      <div className="not-found-page__actions">
        <Button onClick={onHome}>Về trang chủ</Button>
        <Button onClick={onLogin} variant="secondary">Đăng nhập</Button>
      </div>
    </section>
  </main>;
}
