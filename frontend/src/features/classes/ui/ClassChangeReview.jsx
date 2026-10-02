import { ClassListContent } from "./ClassListContent.jsx";
import { Button } from "../../../shared/ui/Button.jsx";
export function ClassChangeReview({
  canManage,
  canReview,
  classCoachFilters,
  classRoomFilters,
  classSearch,
  classSort,
  classStatusFilters,
  coaches,
  isClassFilterOpen,
  load,
  loading,
  openEdit,
  publish,
  requests,
  review,
  role,
  rooms,
  setClassCoachFilters,
  setClassRoomFilters,
  setClassSearch,
  setClassStatusFilters,
  setIsClassFilterOpen,
  submitting,
  toggleClassFilter,
  toggleClassSort,
  visibleClassRows,
}) {
  return (
    <section className="members-list">
      <div className="list-heading">
        <h2>
          {canReview
            ? "Yêu cầu chờ duyệt"
            : role === "coach"
              ? "Lớp tôi phụ trách"
              : "Lớp học"}
        </h2>
        <Button onClick={load} size="sm" variant="ghost">
          Tải lại
        </Button>
      </div>
      {canReview ? (
        requests.length === 0 ? (
          <p>Không có yêu cầu chờ duyệt.</p>
        ) : (
          requests.map((item) => (
            <article className="change-request" key={item.id}>
              <strong>{item.type === "cancel" ? "Hủy lớp" : "Đổi lịch"}</strong>
              <p>{item.reason}</p>
              <Button
                disabled={submitting}
                onClick={() => review(item.id, true)}
                size="sm"
              >
                Duyệt
              </Button>{" "}
              <Button
                disabled={submitting}
                onClick={() => review(item.id, false)}
                size="sm"
                variant="danger"
              >
                Từ chối
              </Button>
            </article>
          ))
        )
      ) : null}
      {(!canReview || canManage) && (
        <ClassListContent
          canManage={canManage}
          classCoachFilters={classCoachFilters}
          classRoomFilters={classRoomFilters}
          classStatusFilters={classStatusFilters}
          classSearch={classSearch}
          classSort={classSort}
          coaches={coaches}
          loading={loading}
          onClear={() => {
            setClassSearch("");
            setClassStatusFilters([]);
            setClassCoachFilters([]);
            setClassRoomFilters([]);
          }}
          onEdit={openEdit}
          isClassFilterOpen={isClassFilterOpen}
          onFilterOpenChange={setIsClassFilterOpen}
          onToggleFilter={toggleClassFilter}
          onPublish={publish}
          onSearchChange={setClassSearch}
          onSort={toggleClassSort}
          rooms={rooms}
          submitting={submitting}
          visibleClassRows={visibleClassRows}
        />
      )}
    </section>
  );
}
