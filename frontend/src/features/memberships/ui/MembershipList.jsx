import {
  membershipStatus,
  membershipGraceLabel,
} from "../domain/membership-form.js";
import { Button } from "../../../shared/ui/Button.jsx";
import { Pagination } from "../../../shared/ui/Pagination.jsx";
import { TableSkeleton } from "../../../shared/ui/TableSkeleton.jsx";
import { usePagination } from "../../../shared/ui/usePagination.js";
import "./membership-layout.css";
export function MembershipList({
  embedded = false,
  items,
  loading,
  onCancel,
  submitting,
}) {
  const membershipPagination = usePagination(items);
  const content = (
    <>
      {embedded ? <h3>Gói đã đăng ký</h3> : <h2>Gói đã đăng ký</h2>}
      {loading ? (
        <TableSkeleton columns={5} />
      ) : items.length === 0 ? (
        <p>Chưa có gói tập.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Mã đăng ký</th>
                <th>Tên gói</th>
                <th>Hiệu lực</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {membershipPagination.pageItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <code>{item.id}</code>
                  </td>
                  <td>
                    <strong>{item.package_name_snapshot}</strong>
                    <small>
                      {Number(item.priceVnd).toLocaleString("vi-VN")} ₫
                    </small>
                  </td>
                  <td>
                    {new Date(item.starts_on).toLocaleDateString("vi-VN")} –{" "}
                    {new Date(item.expires_on).toLocaleDateString("vi-VN")}
                  </td>
                  <td>
                    <strong>
                      {membershipStatus[item.status] ?? item.status}
                    </strong>
                    {membershipGraceLabel(item) && (
                      <small>{membershipGraceLabel(item)}</small>
                    )}
                  </td>
                  <td>
                    {onCancel && item.status === "pending_payment" && (
                      <Button
                        disabled={submitting}
                        onClick={() => onCancel(item.id)}
                        size="sm"
                        variant="danger"
                      >
                        Hủy yêu cầu
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination {...membershipPagination} />
    </>
  );
  return embedded ? (
    <div className="membership-list-content">{content}</div>
  ) : (
    <section className="members-list">{content}</section>
  );
}
