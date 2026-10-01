import { ClassListContent } from "./ClassListContent.jsx";
import { Button } from "../../../shared/ui/Button.jsx";
export function ReceptionistClassesWorkspace({
  classCoachFilters,
  classRoomFilters,
  classStatusFilters,
  classSearch,
  classSort,
  coaches,
  loading,
  onClear,
  isClassFilterOpen,
  onFilterOpenChange,
  onReload,
  onReview,
  onSearchChange,
  onSort,
  onToggleFilter,
  requests,
  rooms,
  submitting,
  visibleClassRows,
}) {
  return (
    <div className="classes-reception-workspace">
      {requests.length > 0 && (
        <section className="members-list class-approval-panel">
          <div className="list-heading">
            <h2>Yêu cầu chờ duyệt ({requests.length})</h2>
            <Button onClick={onReload} size="sm" variant="ghost">
              Tải lại
            </Button>
          </div>
          <div className="class-approval-list">
            {requests.map((item) => (
              <article className="change-request" key={item.id}>
                <div>
                  <strong>
                    {item.type === "cancel" ? "Hủy lớp" : "Đổi lịch"}
                  </strong>
                  <p>{item.reason}</p>
                </div>
                <div className="class-approval-actions">
                  <Button
                    disabled={submitting}
                    onClick={() => onReview(item.id, true)}
                    size="sm"
                  >
                    Duyệt
                  </Button>
                  <Button
                    disabled={submitting}
                    onClick={() => onReview(item.id, false)}
                    size="sm"
                    variant="danger"
                  >
                    Từ chối
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      <section className="members-list classes-reception-schedule">
        <div className="list-heading">
          <h2>Lịch lớp</h2>
          <Button onClick={onReload} size="sm" variant="ghost">
            Tải lại
          </Button>
        </div>
        <ClassListContent
          canManage={false}
          classCoachFilters={classCoachFilters}
          classRoomFilters={classRoomFilters}
          classStatusFilters={classStatusFilters}
          classSearch={classSearch}
          classSort={classSort}
          coaches={coaches}
          loading={loading}
          onClear={onClear}
          onEdit={() => {}}
          isClassFilterOpen={isClassFilterOpen}
          onFilterOpenChange={onFilterOpenChange}
          onPublish={() => {}}
          onSearchChange={onSearchChange}
          onSort={onSort}
          onToggleFilter={onToggleFilter}
          rooms={rooms}
          submitting={submitting}
          visibleClassRows={visibleClassRows}
        />
      </section>
    </div>
  );
}
