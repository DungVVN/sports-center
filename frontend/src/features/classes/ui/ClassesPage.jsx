import { ReceptionistClassesWorkspace } from "./ReceptionistClassesWorkspace.jsx";
import {
  emptyChange,
  emptyClass,
  toDateTimeInput,
} from "../domain/class-form.js";
import { ClassCreateForm } from "./ClassCreateForm.jsx";
import { ClassChangeForm } from "./ClassChangeForm.jsx";
import { ClassChangeReview } from "./ClassChangeReview.jsx";
import { ClassEditDialog } from "./ClassEditDialog.jsx";
import { useMemo, useState } from "react";
import { sortTable } from "../../../shared/lib/table.js";
import { hasSessionPermission } from "../../auth/index.js";
import { useMutationFeedback } from "../../../shared/lib/useMutationFeedback.js";
import { errorMessageFor } from "../../../shared/api/error-message.js";
import { useClassesWorkspace } from "../api/useClassesWorkspace.js";
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
  } = useClassesWorkspace({
    canReview,
  });
  const submitting =
    createClassMutation.isPending ||
    publishClass.isPending ||
    updateClassMutation.isPending ||
    requestChangeMutation.isPending ||
    reviewChangeMutation.isPending;
  async function run(mutation, variables, success) {
    if (mutation.isPending) return false;
    feedback.clear();
    try {
      await mutation.mutateAsync(variables);
      feedback.setNotice(success);
      return true;
    } catch (caught) {
      feedback.setError(errorMessageFor(caught, "Không thể cập nhật lớp học."));
      return false;
    }
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
        (!classStatusFilters.length ||
          classStatusFilters.includes(item.status)) &&
        (!classCoachFilters.length ||
          classCoachFilters.includes(item.coach_user_id)) &&
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
    if (
      await run(
        createClassMutation,
        {
          ...classForm,
          capacity: Number(classForm.capacity),
          startsAt: new Date(classForm.startsAt).toISOString(),
          endsAt: new Date(classForm.endsAt).toISOString(),
        },
        "Đã tạo lớp nháp. Hãy rà soát rồi công bố lớp.",
      )
    ) {
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
    if (
      await run(
        updateClassMutation,
        (() => {
          const { id, ...input } = editingClass;
          return {
            id,
            input: {
              ...input,
              capacity: Number(input.capacity),
              startsAt: new Date(input.startsAt).toISOString(),
              endsAt: new Date(input.endsAt).toISOString(),
            },
          };
        })(),
        "Đã cập nhật thông tin lớp học.",
      )
    ) {
      setEditingClass(null);
    }
  }
  async function submitChange(event) {
    event.preventDefault();
    if (
      await run(
        requestChangeMutation,
        {
          id: changeForm.classId,
          input: {
            type: changeForm.type,
            reason: changeForm.reason,
            ...(changeForm.type === "reschedule"
              ? {
                  startsAt: new Date(changeForm.startsAt).toISOString(),
                  endsAt: new Date(changeForm.endsAt).toISOString(),
                }
              : {}),
          },
        },
        "Đã gửi yêu cầu để Lễ tân duyệt.",
      )
    ) {
      setChangeForm(emptyChange);
    }
  }
  async function review(id, approved) {
    await run(
      reviewChangeMutation,
      {
        id,
        approved,
      },
      approved
        ? "Đã duyệt thay đổi lớp; các booking còn hiệu lực đã được xử lý."
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
            <ClassCreateForm
              classForm={classForm}
              coaches={coaches}
              createClass={createClass}
              rooms={rooms}
              submitting={submitting}
              updateClass={updateClass}
            />
          ) : canRequest ? (
            <ClassChangeForm
              changeForm={changeForm}
              ownClasses={ownClasses}
              submitChange={submitChange}
              submitting={submitting}
              updateChange={updateChange}
            />
          ) : null}
          <ClassChangeReview
            canManage={canManage}
            canReview={canReview}
            classCoachFilters={classCoachFilters}
            classRoomFilters={classRoomFilters}
            classSearch={classSearch}
            classSort={classSort}
            classStatusFilters={classStatusFilters}
            coaches={coaches}
            isClassFilterOpen={isClassFilterOpen}
            load={load}
            loading={loading}
            openEdit={openEdit}
            publish={publish}
            requests={requests}
            review={review}
            role={role}
            rooms={rooms}
            setClassCoachFilters={setClassCoachFilters}
            setClassRoomFilters={setClassRoomFilters}
            setClassSearch={setClassSearch}
            setClassStatusFilters={setClassStatusFilters}
            setIsClassFilterOpen={setIsClassFilterOpen}
            submitting={submitting}
            toggleClassFilter={toggleClassFilter}
            toggleClassSort={toggleClassSort}
            visibleClassRows={visibleClassRows}
          />
        </div>
      )}
      <ClassEditDialog
        coaches={coaches}
        editingClass={editingClass}
        rooms={rooms}
        setEditingClass={setEditingClass}
        submitting={submitting}
        updateClassSession={updateClassSession}
      />
    </main>
  );
}
