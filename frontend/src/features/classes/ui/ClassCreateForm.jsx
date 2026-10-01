import { Button } from "../../../shared/ui/Button.jsx";
export function ClassCreateForm({
  classForm,
  coaches,
  createClass,
  rooms,
  submitting,
  updateClass,
}) {
  return (
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
  );
}
