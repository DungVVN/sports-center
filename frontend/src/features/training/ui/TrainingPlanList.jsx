import { useMemo } from "react";
import { usePagination } from "../../../shared/ui/usePagination.js";
import { formatCreatedAt, planStatusLabels } from "../domain/training-form.js";
import { Button } from "../../../shared/ui/Button.jsx";
import { Pagination } from "../../../shared/ui/Pagination.jsx";
import { trainingApi } from "../api/training-api.js";
export function TrainingPlanList({
  submit,
  submitting,
  workspace,
  members,
  plans,
}) {
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
        <table>
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
                <td>
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
    </section>
  );
}
