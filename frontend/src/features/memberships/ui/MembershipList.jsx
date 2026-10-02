import { useState } from "react";
import { RecordDetails } from "../../../shared/ui/RecordDetails.jsx";
import { recordDate } from "../../../shared/lib/record-date.js";
import { RecordHistory } from "../../../shared/ui/RecordHistory.jsx";
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
  canViewHistory = false,
  items,
  loading,
  onCancel,
  submitting,
}) {
  const [selectedRecord, setSelectedRecord] = useState(null);
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
                  <td className="record-table-actions">
                    <Button onClick={() => setSelectedRecord(item)} size="sm" variant="secondary">Xem chi tiết</Button>
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
      <RecordDetails isOpen={Boolean(selectedRecord)} onClose={() => setSelectedRecord(null)} title="Chi tiết gói đã đăng ký" fields={selectedRecord ? [
        ["Mã đăng ký", selectedRecord.id], ["Tên gói", selectedRecord.package_name_snapshot], ["Giá", Number(selectedRecord.priceVnd).toLocaleString("vi-VN") + " ₫"],
        ["Trạng thái", membershipStatus[selectedRecord.status] ?? selectedRecord.status], ["Bắt đầu", recordDate(selectedRecord.starts_on)], ["Hết hạn", recordDate(selectedRecord.expires_on)],
        ["Kích hoạt", recordDate(selectedRecord.activated_at)], ["Gia hạn thanh toán", membershipGraceLabel(selectedRecord)],
      ] : []}>
        {selectedRecord && canViewHistory && <RecordHistory key={selectedRecord.id} entityType="membership" entityId={selectedRecord.id} />}
      </RecordDetails>
    </>
  );
  return embedded ? (
    <div className="membership-list-content">{content}</div>
  ) : (
    <section className="members-list">{content}</section>
  );
}
