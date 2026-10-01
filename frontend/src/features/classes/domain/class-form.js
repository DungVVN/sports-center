export const emptyChange = {
  classId: "",
  type: "cancel",
  startsAt: "",
  endsAt: "",
  reason: "",
};

export const emptyClass = {
  name: "",
  type: "group",
  description: "",
  coachUserId: "",
  roomId: "",
  startsAt: "",
  endsAt: "",
  capacity: "",
};

export const statusLabels = {
  draft: "Nháp",
  published: "Đã công bố",
  cancelled: "Đã hủy",
  completed: "Hoàn thành",
};

export function toDateTimeInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (num) => String(num).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
