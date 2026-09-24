import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import {
  DataTableToolbar,
  FilterMenu,
  SortableHeader,
} from "../../components/ui/DataTable.jsx";
import { Dialog } from "../../components/ui/Dialog.jsx";
import { Pagination } from "../../components/ui/Pagination.jsx";
import { usePagination } from "../../components/ui/usePagination.js";
import { sortTable } from "../../lib/table.js";
import { hasSessionPermission } from "../../utils/session-permissions.js";
import { useMutationFeedback } from "../../hooks/useMutationFeedback.js";
import { useClassesWorkspace } from "./hooks/useClassesWorkspace.js";

const emptyChange = {
  classId: "",
  type: "cancel",
  startsAt: "",
  endsAt: "",
  reason: "",
};
const emptyClass = {
  name: "",
  type: "group",
  description: "",
  coachUserId: "",
  roomId: "",
  startsAt: "",
  endsAt: "",
  capacity: "",
};
const statusLabels = {
  draft: "Nháp",
  published: "Đã công bố",
  cancelled: "Đã hủy",
  completed: "Hoàn thành",
};
function toDateTimeInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (num) => String(num).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ClassesPage({ session }) {
  const [changeForm, setChangeForm] = useState(emptyChange);
  const [classForm, setClassForm] = useState(emptyClass);
  const [editingClass, setEditingClass] = useState(null);
  const feedback = useMutationFeedback();
  const [classSearch, setClassSearch] = useState("");
  const [classStatusFilters, setClassStatusFilters] = useState([]);
  const [classCoachFilters, setClassCoachFilters] = useState([]);
  const [classRoomFilters, setClassRoomFilters] = useState([]);
  const [isClassFilterOpen, setIsClassFilterOpen] = useState(false);
  const [classSort, setClassSort] = useState({
    key: "starts_at",
    direction: "asc",
  });
  const role = session?.user?.role;
  const canManage = hasSessionPermission(session, "class.manage");
  const canReview = hasSessionPermission(session, "class.change.review");
  const canRequest = hasSessionPermission(session, "class.change.request");
  const {
    classes,
    coaches,
    createClass: createClassMutation,
    error: queryError,
    loading,
    publishClass,
    reload: load,
    requests,
    requestChange: requestChangeMutation,
    reviewChange: reviewChangeMutation,
    rooms,
    updateClass: updateClassMutation,
  } = useClassesWorkspace({ canReview });
  const submitting = createClassMutation.isPending || publishClass.isPending || updateClassMutation.isPending || requestChangeMutation.isPending || reviewChangeMutation.isPending;
  async function run(mutation, variables, success) {
    feedback.clear();
    try { await mutation.mutateAsync(variables); feedback.setNotice(success); return true; }
    catch (caught) { feedback.setError(caught.message); return false; }
  }
  const ownClasses = useMemo(
    () =>
      role === "coach"
        ? classes.filter((item) => item.coach_user_id === session?.user?.id)
        : classes,
    [classes, role, session?.user?.id],
  );
  const visibleClassRows = useMemo(() => {
    const query = classSearch.trim().toLocaleLowerCase("vi");
    const filtered = ownClasses.filter(
      (item) =>
        (!classStatusFilters.length || classStatusFilters.includes(item.status)) &&
        (!classCoachFilters.length || classCoachFilters.includes(item.coach_user_id)) &&
        (!classRoomFilters.length || classRoomFilters.includes(item.room_id)) &&
        (!query ||
          [item.id, item.name, item.type].some((value) =>
            value?.toLocaleLowerCase("vi").includes(query),
          )),
    );
    return sortTable(
      filtered,
      classSort.key,
      classSort.direction,
      (item, key) => item[key],
    );
  }, [
    classCoachFilters,
    classRoomFilters,
    classSearch,
    classSort,
    classStatusFilters,
    ownClasses,
  ]);
  function toggleClassFilter(filter, value) {
    const setter = {
      coach: setClassCoachFilters,
      room: setClassRoomFilters,
      status: setClassStatusFilters,
    }[filter];
    setter((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }
  function toggleClassSort(key) {
    setClassSort((value) => ({
      key,
      direction:
        value.key === key && value.direction === "asc" ? "desc" : "asc",
    }));
  }

  function updateChange(event) {
    setChangeForm((value) => ({
      ...value,
      [event.target.name]: event.target.value,
    }));
  }
  function updateClass(event) {
    setClassForm((value) => ({
      ...value,
      [event.target.name]: event.target.value,
    }));
  }

  async function createClass(event) {
    event.preventDefault();
    if (await run(createClassMutation, {
        ...classForm,
        capacity: Number(classForm.capacity),
        startsAt: new Date(classForm.startsAt).toISOString(),
        endsAt: new Date(classForm.endsAt).toISOString(),
      }, "Đã tạo lớp nháp. Hãy rà soát rồi công bố lớp.")) {
      setClassForm(emptyClass);
    }
  }

  async function publish(id) {
    await run(publishClass, id, "Đã công bố lớp học.");
  }

  function openEdit(item) {
    setEditingClass({
      id: item.id,
      name: item.name,
      type: item.type,
      description: item.description ?? "",
      coachUserId: item.coach_user_id,
      roomId: item.room_id,
      startsAt: toDateTimeInput(item.starts_at),
      endsAt: toDateTimeInput(item.ends_at),
      capacity: String(item.capacity),
    });
  }
  async function updateClassSession(event) {
    event.preventDefault();
    if (!editingClass) return;
    if (await run(updateClassMutation, (() => {
      const { id, ...input } = editingClass;
      return { id, input: {
        ...input,
        capacity: Number(input.capacity),
        startsAt: new Date(input.startsAt).toISOString(),
        endsAt: new Date(input.endsAt).toISOString(),
      } };
    })(), "Đã cập nhật thông tin lớp học.")) {
      setEditingClass(null);
    }
  }

  async function submitChange(event) {
    event.preventDefault();
    if (await run(requestChangeMutation, { id: changeForm.classId, input: {
        type: changeForm.type,
        reason: changeForm.reason,
        ...(changeForm.type === "reschedule"
          ? {
              startsAt: new Date(changeForm.startsAt).toISOString(),
              endsAt: new Date(changeForm.endsAt).toISOString(),
            }
          : {}),
      } }, "Đã gửi yêu cầu để Lễ tân duyệt.")) {
      setChangeForm(emptyChange);
    }
  }

  async function review(id, approved) {
    await run(reviewChangeMutation, { id, approved },
        approved
          ? "Đã duyệt thay đổi lớp và gửi thông báo cho hội viên."
          : "Đã từ chối yêu cầu thay đổi lớp.",
      );
  }

  return (
    <main className="members-page">
      <header>
        <p>Lớp học</p>
        <h1>Lịch lớp</h1>
      </header>
        {(feedback.error || queryError) && (
          <p className="auth-alert" role="alert">
            {feedback.error || queryError}
        </p>
      )}
      {feedback.notice && (
        <p className="auth-success" role="status">
          {feedback.notice}
        </p>
      )}
      {!canManage && canReview && !canRequest ? (
        <ReceptionistClassesWorkspace
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
          isClassFilterOpen={isClassFilterOpen}
          onFilterOpenChange={setIsClassFilterOpen}
          onToggleFilter={toggleClassFilter}
          onReview={review}
          onSearchChange={setClassSearch}
          onSort={toggleClassSort}
          onReload={load}
          requests={requests}
          rooms={rooms}
          submitting={submitting}
          visibleClassRows={visibleClassRows}
        />
      ) : (
      <div className="members-workspace-stacked classes-workspace">
        {canManage ? (
          <form className="members-form classes-create-form" onSubmit={createClass}>
            <h2>Tạo lớp học</h2>
            <label>
              Tên lớp
              <input
                name="name"
                onChange={updateClass}
                required
                value={classForm.name}
              />
            </label>
            <label>
              Mô tả
              <textarea
                name="description"
                onChange={updateClass}
                value={classForm.description}
              />
            </label>
            <label>
              Loại lớp
              <input
                name="type"
                onChange={updateClass}
                required
                value={classForm.type}
              />
            </label>
            <label>
              Coach
              <select
                name="coachUserId"
                onChange={updateClass}
                required
                value={classForm.coachUserId}
              >
                <option value="">Chọn Coach</option>
                {coaches.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Phòng
              <select
                name="roomId"
                onChange={updateClass}
                required
                value={classForm.roomId}
              >
                <option value="">Chọn phòng</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} · {room.capacity} chỗ
                  </option>
                ))}
              </select>
            </label>
            <label>
              Bắt đầu
              <input
                name="startsAt"
                onChange={updateClass}
                required
                type="datetime-local"
                value={classForm.startsAt}
              />
            </label>
            <label>
              Kết thúc
              <input
                name="endsAt"
                onChange={updateClass}
                required
                type="datetime-local"
                value={classForm.endsAt}
              />
            </label>
            <label>
              Sức chứa
              <input
                min="1"
                name="capacity"
                onChange={updateClass}
                required
                type="number"
                value={classForm.capacity}
              />
            </label>
            <Button loading={submitting} type="submit">
              Tạo lớp nháp
            </Button>
          </form>
        ) : canRequest ? (
          <form className="members-form" onSubmit={submitChange}>
            <h2>Đề xuất thay đổi</h2>
            <label>
              Lớp phụ trách
              <select
                name="classId"
                onChange={updateChange}
                required
                value={changeForm.classId}
              >
                <option value="">Chọn lớp</option>
                {ownClasses
                  .filter((item) => item.status === "published")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ·{" "}
                      {new Date(item.starts_at).toLocaleString("vi-VN")}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Loại
              <select
                name="type"
                onChange={updateChange}
                value={changeForm.type}
              >
                <option value="cancel">Hủy lớp</option>
                <option value="reschedule">Đổi lịch</option>
              </select>
            </label>
            {changeForm.type === "reschedule" && (
              <>
                <label>
                  Bắt đầu mới
                  <input
                    name="startsAt"
                    onChange={updateChange}
                    required
                    type="datetime-local"
                    value={changeForm.startsAt}
                  />
                </label>
                <label>
                  Kết thúc mới
                  <input
                    name="endsAt"
                    onChange={updateChange}
                    required
                    type="datetime-local"
                    value={changeForm.endsAt}
                  />
                </label>
              </>
            )}
            <label>
              Lý do
              <textarea
                minLength="3"
                name="reason"
                onChange={updateChange}
                required
                value={changeForm.reason}
              />
            </label>
            <Button loading={submitting} type="submit">
              Gửi yêu cầu duyệt
            </Button>
          </form>
        ) : null}
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
                  <strong>
                    {item.type === "cancel" ? "Hủy lớp" : "Đổi lịch"}
                  </strong>
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
          ) : (
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
      </div>
      )}
      <Dialog
        isOpen={Boolean(editingClass)}
        onClose={() => setEditingClass(null)}
        title="Chỉnh sửa lớp học"
      >
        {editingClass && (
          <form className="members-form" onSubmit={updateClassSession}>
            <label>
              Tên lớp
              <input
                name="name"
                onChange={(event) =>
                  setEditingClass({
                    ...editingClass,
                    [event.target.name]: event.target.value,
                  })
                }
                required
                value={editingClass.name}
              />
            </label>
            <label>
              Loại lớp
              <input
                name="type"
                onChange={(event) =>
                  setEditingClass({
                    ...editingClass,
                    [event.target.name]: event.target.value,
                  })
                }
                required
                value={editingClass.type}
              />
            </label>
            <label>
              Coach
              <select
                name="coachUserId"
                onChange={(event) =>
                  setEditingClass({
                    ...editingClass,
                    [event.target.name]: event.target.value,
                  })
                }
                required
                value={editingClass.coachUserId}
              >
                <option value="">Chọn Coach</option>
                {coaches.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Phòng
              <select
                name="roomId"
                onChange={(event) =>
                  setEditingClass({
                    ...editingClass,
                    [event.target.name]: event.target.value,
                  })
                }
                required
                value={editingClass.roomId}
              >
                <option value="">Chọn phòng</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Bắt đầu
              <input
                name="startsAt"
                onChange={(event) =>
                  setEditingClass({
                    ...editingClass,
                    [event.target.name]: event.target.value,
                  })
                }
                required
                type="datetime-local"
                value={editingClass.startsAt}
              />
            </label>
            <label>
              Kết thúc
              <input
                name="endsAt"
                onChange={(event) =>
                  setEditingClass({
                    ...editingClass,
                    [event.target.name]: event.target.value,
                  })
                }
                required
                type="datetime-local"
                value={editingClass.endsAt}
              />
            </label>
            <label>
              Sức chứa
              <input
                min="1"
                name="capacity"
                onChange={(event) =>
                  setEditingClass({
                    ...editingClass,
                    [event.target.name]: event.target.value,
                  })
                }
                required
                type="number"
                value={editingClass.capacity}
              />
            </label>
            <label>
              Mô tả
              <textarea
                name="description"
                onChange={(event) =>
                  setEditingClass({
                    ...editingClass,
                    [event.target.name]: event.target.value,
                  })
                }
                value={editingClass.description}
              />
            </label>
            <Button loading={submitting} type="submit">
              Lưu thay đổi
            </Button>
          </form>
        )}
      </Dialog>
    </main>
  );
}

function ClassListContent({
  canManage,
  classCoachFilters,
  classRoomFilters,
  classStatusFilters,
  classSearch,
  classSort,
  coaches,
  loading,
  onClear,
  onEdit,
  isClassFilterOpen,
  onFilterOpenChange,
  onPublish,
  onSearchChange,
  onSort,
  onToggleFilter,
  rooms,
  submitting,
  visibleClassRows,
}) {
  const coachNameById = useMemo(
    () => new Map(coaches.map((coach) => [coach.id, coach.display_name])),
    [coaches],
  );
  const roomNameById = useMemo(
    () => new Map(rooms.map((room) => [room.id, room.name])),
    [rooms],
  );
  const classPagination = usePagination(visibleClassRows);
  return loading ? (
    <p>Đang tải…</p>
  ) : (
    <>
      <DataTableToolbar
        onClear={onClear}
        resultCount={visibleClassRows.length}
        search={classSearch}
        searchPlaceholder="Tìm ID, tên hoặc loại lớp..."
        setSearch={onSearchChange}
      >
        <FilterMenu
          activeCount={
            classStatusFilters.length +
            classCoachFilters.length +
            classRoomFilters.length
          }
          isOpen={isClassFilterOpen}
          onToggle={() => onFilterOpenChange(!isClassFilterOpen)}
        >
          <fieldset className="payment-filter-group">
            <legend>Trạng thái</legend>
            {Object.entries(statusLabels).map(([value, label]) => (
              <label key={value}>
                <input
                  checked={classStatusFilters.includes(value)}
                  onChange={() => onToggleFilter("status", value)}
                  type="checkbox"
                />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset className="payment-filter-group">
            <legend>Coach phụ trách</legend>
            {coaches.map((coach) => (
              <label key={coach.id}>
                <input
                  checked={classCoachFilters.includes(coach.id)}
                  onChange={() => onToggleFilter("coach", coach.id)}
                  type="checkbox"
                />
                {coach.display_name}
              </label>
            ))}
          </fieldset>
          <fieldset className="payment-filter-group">
            <legend>Phòng</legend>
            {rooms.map((room) => (
              <label key={room.id}>
                <input
                  checked={classRoomFilters.includes(room.id)}
                  onChange={() => onToggleFilter("room", room.id)}
                  type="checkbox"
                />
                {room.name}
              </label>
            ))}
          </fieldset>
        </FilterMenu>
      </DataTableToolbar>
      {visibleClassRows.length === 0 ? (
        <p>Không có lớp học phù hợp với bộ lọc.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <SortableHeader
                  activeSort={classSort.key}
                  column="id"
                  direction={classSort.direction}
                  onSort={onSort}
                >
                  Mã lớp học
                </SortableHeader>
                <SortableHeader
                  activeSort={classSort.key}
                  column="name"
                  direction={classSort.direction}
                  onSort={onSort}
                >
                  Tên lớp
                </SortableHeader>
                <SortableHeader
                  activeSort={classSort.key}
                  column="starts_at"
                  direction={classSort.direction}
                  onSort={onSort}
                >
                  Bắt đầu
                </SortableHeader>
                <th>Coach phụ trách</th>
                <th>Phòng</th>
                <SortableHeader
                  activeSort={classSort.key}
                  className="classes-capacity-cell"
                  column="capacity"
                  direction={classSort.direction}
                  onSort={onSort}
                >
                  Sức chứa
                </SortableHeader>
                <th>Trạng thái</th>
                {canManage && <th>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {classPagination.pageItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <code>{item.id}</code>
                  </td>
                  <td>
                    <strong>{item.name}</strong>
                    <small>{item.type}</small>
                  </td>
                  <td>{new Date(item.starts_at).toLocaleString("vi-VN")}</td>
                  <td>{coachNameById.get(item.coach_user_id) ?? "Chưa phân công"}</td>
                  <td>{roomNameById.get(item.room_id) ?? "Chưa có phòng"}</td>
                  <td className="classes-capacity-cell">{item.capacity}</td>
                  <td>{statusLabels[item.status] ?? item.status}</td>
                  {canManage && (
                    <td>
                      <>
                        <Button
                          disabled={submitting}
                          onClick={() => onEdit(item)}
                          size="sm"
                          variant="primary"
                        >
                          Sửa
                        </Button>
                        {item.status === "draft" && (
                          <Button
                            disabled={submitting}
                            onClick={() => onPublish(item.id)}
                            size="sm"
                            variant="secondary"
                          >
                            Công bố
                          </Button>
                        )}
                      </>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination {...classPagination} />
    </>
  );
}

function ReceptionistClassesWorkspace({
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
