import { Button } from "../../../shared/ui/Button.jsx";
export function ClassChangeForm({
  changeForm,
  ownClasses,
  submitChange,
  submitting,
  updateChange,
}) {
  return (
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
                {item.name} · {new Date(item.starts_at).toLocaleString("vi-VN")}
              </option>
            ))}
        </select>
      </label>
      <label>
        Loại
        <select name="type" onChange={updateChange} value={changeForm.type}>
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
  );
}
