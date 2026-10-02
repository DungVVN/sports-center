import { RecordDetails } from "../../../shared/ui/RecordDetails.jsx";
import { recordDate } from "../../../shared/lib/record-date.js";
import { RecordHistory } from "../../../shared/ui/RecordHistory.jsx";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { usePagination } from "../../../shared/ui/usePagination.js";
import { formatCreatedAt, planStatusLabels } from "../domain/training-form.js";
import { Button } from "../../../shared/ui/Button.jsx";
import { Pagination } from "../../../shared/ui/Pagination.jsx";
import { trainingApi } from "../api/training-api.js";
export function TrainingPlanList({
  canViewHistory = false,
  submit,
  submitting,
  workspace,
  members,
  plans,
}) {
  const [selectedRecord, setSelectedRecord] = useState(null);
  const sessionsQuery = useQuery({ queryKey: ["training", "record-sessions", selectedRecord?.id], queryFn: () => trainingApi.sessions(selectedRecord.id), enabled: Boolean(selectedRecord) });
  const membersById = useMemo(
    () => new Map(members.map((item) => [item.id, item])),
    [members],
  );
  const plansPagination = usePagination(plans);
  function memberName(memberId) {
    const member = membersById.get(memberId);
    return member ? (
      <>
        {member.full_name}
        <small>{member.member_code}</small>
      </>
    ) : (
      "Hội viên không còn khả dụng"
    );
  }
  return (
    <section className="members-list">
      <div className="list-heading">
        <h2>Giáo án</h2>
        <Button onClick={workspace.reload} size="sm" variant="ghost">
          Tải lại
        </Button>
      </div>
      <div className="table-scroll">
        <table className="training-plan-table">
          <thead>
            <tr>
              <th>Mã giáo án</th>
              <th>Tên giáo án</th>
              <th>Hội viên</th>
              <th>Người tạo</th>
              <th>Thời gian tạo</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {plansPagination.pageItems.map((item) => (
              <tr key={item.id}>
                <td>
                  <code>{item.id}</code>
                </td>
                <td>{item.name}</td>
                <td>{memberName(item.member_id)}</td>
                <td>{item.creatorName ?? "—"}</td>
                <td>{formatCreatedAt(item.createdAt)}</td>
                <td>{planStatusLabels[item.status] ?? item.status}</td>
                <td className="record-table-actions">
                  <Button onClick={() => setSelectedRecord(item)} size="sm" variant="secondary">Xem chi tiết</Button>
                  {item.status === "active" && (
                    <Button
                      disabled={submitting}
                      onClick={() =>
                        void submit(
                          () =>
                            trainingApi.updatePlan(item.id, {
                              status: "completed",
                            }),
                          "Đã hoàn thành giáo án.",
                        )
                      }
                      size="sm"
                      variant="secondary"
                    >
                      Hoàn thành
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination {...plansPagination} />
      <RecordDetails isOpen={Boolean(selectedRecord)} onClose={() => setSelectedRecord(null)} title="Chi tiết giáo án" fields={selectedRecord ? [
        ["Tên giáo án", selectedRecord.name], ["Hội viên", memberName(selectedRecord.member_id)], ["Mục tiêu", selectedRecord.goal],
        ["Người tạo", selectedRecord.creatorName], ["Ngày tạo", recordDate(selectedRecord.createdAt)], ["Trạng thái", planStatusLabels[selectedRecord.status] ?? selectedRecord.status],
        ["Bắt đầu", recordDate(selectedRecord.starts_on)], ["Kết thúc", recordDate(selectedRecord.ends_on)],
      ] : []}>
        <section className="record-details__history"><h3>Buổi tập và bài tập</h3>
          {sessionsQuery.isLoading && <p role="status">Đang tải buổi tập…</p>}
          {sessionsQuery.isError && <><p role="alert">Không thể tải buổi tập.</p><Button onClick={() => sessionsQuery.refetch()} size="sm" variant="secondary">Thử lại</Button></>}
          {sessionsQuery.data?.length === 0 && <p>Chưa có buổi tập.</p>}
          {sessionsQuery.data?.map((item) => <article key={item.id}><strong>{item.name ?? item.title ?? "Buổi tập"}</strong><span>{recordDate(item.scheduled_on)}</span>{item.coach_comment && <p>{item.coach_comment}</p>}{item.exercises?.map((exercise) => <p key={exercise.id}>{exercise.name} · {exercise.sets ?? "—"} hiệp · {exercise.reps ?? "—"} lần{exercise.instructions ? " · " + exercise.instructions : ""}</p>)}</article>)}
        </section>
        {selectedRecord && canViewHistory && <RecordHistory key={selectedRecord.id} entityType="training_plan" entityId={selectedRecord.id} />}
      </RecordDetails>
    </section>
  );
}
