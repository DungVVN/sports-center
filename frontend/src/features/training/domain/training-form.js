export const newPlan = {
  memberId: "",
  templateId: "",
  name: "",
  goal: "",
  startsOn: new Date().toISOString().slice(0, 10),
  endsOn: "",
};

export const newTemplate = {
  name: "",
  targetGroup: "",
  description: "",
  exerciseName: "",
  sets: "3",
  reps: "10",
  restSeconds: "60",
};

export const newResult = {
  planId: "",
  recordedOn: new Date().toISOString().slice(0, 10),
  metric: "Tiến độ buổi tập",
  valueNumeric: "",
  valueText: "",
  coachComment: "",
};

export const createSessionExercise = () => ({
  name: "",
  sets: "3",
  reps: "10",
  restSeconds: "60",
});

export const createSessionForm = () => ({
  planId: "",
  position: "1",
  title: "",
  scheduledOn: new Date().toISOString().slice(0, 10),
  exercises: [createSessionExercise()],
});

export const planStatusLabels = {
  active: "Đang áp dụng",
  completed: "Đã hoàn thành",
};

export const formatCreatedAt = (value) =>
  value ? new Date(value).toLocaleString("vi-VN") : "—";
