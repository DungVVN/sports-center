import { Button } from "../../../shared/ui/Button.jsx";
import { Pagination } from "../../../shared/ui/Pagination.jsx";
import { usePagination } from "../../../shared/ui/usePagination.js";
import "./membership-layout.css";
export function FreezeRequestReview({
  canReview,
  items,
  onReview,
  submitting,
}) {
  const freezePagination = usePagination(items);
  if (!canReview) return null;
  return (
    <section className="members-list membership-freeze-review">
      <h2>Yêu cầu đóng băng chờ duyệt</h2>
      {items.length === 0 ? (
        <p>Không có yêu cầu chờ duyệt.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Mã yêu cầu</th>
                <th>Hội viên yêu cầu</th>
                <th>Gói áp dụng</th>
                <th>Thời gian</th>
                <th>Lý do</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {freezePagination.pageItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <code>{item.id}</code>
                  </td>
                  <td>
                    {item.member?.full_name ?? "Hội viên"}
                    <small>{item.member?.member_code}</small>
                  </td>
                  <td>{item.membership?.package_name_snapshot}</td>
                  <td>
                    {new Date(item.starts_on).toLocaleDateString("vi-VN")} –{" "}
                    {new Date(item.ends_on).toLocaleDateString("vi-VN")}
                  </td>
                  <td>{item.reason}</td>
                  <td>
                    <Button
                      disabled={submitting}
                      onClick={() => onReview(item.id, true)}
                      size="sm"
                    >
                      Duyệt
                    </Button>{" "}
                    <Button
                      disabled={submitting}
                      onClick={() => onReview(item.id, false)}
                      size="sm"
                      variant="danger"
                    >
                      Từ chối
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination {...freezePagination} />
    </section>
  );
}
