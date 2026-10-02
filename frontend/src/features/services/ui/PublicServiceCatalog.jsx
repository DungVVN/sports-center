import { useQuery } from "@tanstack/react-query";
import { courseApi } from "../../courses/index.js";
import { ptApi } from "../../pt/index.js";
import { errorMessageFor } from "../../../shared/api/error-message.js";
import "./services.css";

const money = (value) => `${Number(value).toLocaleString("vi-VN")} đ`;
const date = (value) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
function CatalogGroup({ title, query, children }) {
  return <section className="my-services__group"><h3>{title}</h3>
    {query.isPending && <p role="status">Đang tải dịch vụ...</p>}
    {query.isError && <p role="alert">{errorMessageFor(query.error, "Không tải được danh mục dịch vụ.")} <button type="button" onClick={() => query.refetch()}>Thử lại</button></p>}
    {query.data?.length === 0 && <p>Trung tâm chưa mở bán dịch vụ này.</p>}
    {(query.data ?? []).map(children)}
  </section>;
}
export function PublicServiceCatalog({ onLoginClick }) {
  const courses = useQuery({ queryKey: ["public-courses"], queryFn: courseApi.publicCatalog });
  const pt = useQuery({ queryKey: ["public-pt-packages"], queryFn: ptApi.publicCatalog });
  return <section className="section-zigzag" aria-label="Khóa học và huấn luyện cá nhân">
    <h2>Khóa học và huấn luyện cá nhân</h2>
    <p>Đăng ký khóa hoặc mua số buổi PT độc lập với gói hội viên. Cùng một tài khoản, nhiều dịch vụ tập luyện.</p>
    <div className="my-services__groups">
      <CatalogGroup title="Khóa có hướng dẫn" query={courses}>{(course) => <article key={course.id}><h4>{course.name}</h4><p>{course.description}</p><p>{money(course.priceVnd)} · {course.sessions.length} buổi · Còn {course.availableSeats} chỗ</p><p>Bắt đầu: {date(course.sessions[0].startsAt)}</p><details><summary>Xem toàn bộ lịch học</summary><ul>{course.sessions.map((session, index) => <li key={`${session.startsAt}-${index}`}>{session.name} · {date(session.startsAt)}–{date(session.endsAt)}</li>)}</ul></details><button type="button" disabled={course.availableSeats === 0} onClick={onLoginClick}>Đăng nhập để đăng ký khóa</button></article>}</CatalogGroup>
      <CatalogGroup title="Gói PT" query={pt}>{(pack) => <article key={pack.id}><h4>{pack.name}</h4><p>{pack.description}</p><p>{money(pack.priceVnd)} · {pack.sessionCount} buổi · {pack.sessionMinutes} phút/buổi</p><p>{pack.durationDays} ngày từ khi kích hoạt · Hủy trước {pack.cancellationHours} giờ. Trung tâm phân công coach sau khi thanh toán.</p><button type="button" onClick={onLoginClick}>Đăng nhập để mua PT</button></article>}</CatalogGroup>
    </div>
  </section>;
}
