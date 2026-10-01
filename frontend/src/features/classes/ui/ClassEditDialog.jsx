import { Button } from "../../../shared/ui/Button.jsx";
import { Dialog } from "../../../shared/ui/Dialog.jsx";
export function ClassEditDialog({
  coaches,
  editingClass,
  rooms,
  setEditingClass,
  submitting,
  updateClassSession,
}) {
  return (
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
  );
}
