import {
  createSessionExercise,
  createSessionForm,
} from "../domain/training-form.js";
import { Button } from "../../../shared/ui/Button.jsx";
import { trainingApi } from "../api/training-api.js";
export function TrainingSessionForm({
  moveSession,
  moveSessionExercise,
  plans,
  sessionForm,
  sessions,
  setSessionForm,
  submit,
  submitting,
  updateSessionExercise,
}) {
  return (
    <form
      className="members-form training-action-form training-session-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(async () => {
          await trainingApi.createSession(sessionForm.planId, {
            position: Number(sessionForm.position),
            title: sessionForm.title,
            scheduledOn: sessionForm.scheduledOn || undefined,
            exercises: sessionForm.exercises.map((exercise) => ({
              name: exercise.name,
              sets: Number(exercise.sets),
              reps: Number(exercise.reps),
              rest_seconds: Number(exercise.restSeconds),
            })),
          });
          const selectedPlanId = sessionForm.planId;
          setSessionForm({
            ...createSessionForm(),
            planId: selectedPlanId,
          });
        }, "Đã thêm buổi tập vào lộ trình.");
      }}
    >
      <div className="training-form-heading">
        <span>03 · Lịch buổi tập</span>
        <h2>Thêm và ghi nhận buổi tập</h2>
      </div>
      <label>
        Giáo án
        <select
          onChange={(event) =>
            setSessionForm({
              ...sessionForm,
              planId: event.target.value,
            })
          }
          required
          value={sessionForm.planId}
        >
          <option value="">Chọn giáo án</option>
          {plans
            .filter((item) => item.status === "active")
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Thứ tự buổi
        <input
          min="1"
          onChange={(event) =>
            setSessionForm({
              ...sessionForm,
              position: event.target.value,
            })
          }
          required
          type="number"
          value={sessionForm.position}
        />
      </label>
      <label>
        Nội dung
        <input
          onChange={(event) =>
            setSessionForm({
              ...sessionForm,
              title: event.target.value,
            })
          }
          required
          value={sessionForm.title}
        />
      </label>
      <label>
        Ngày dự kiến
        <input
          onChange={(event) =>
            setSessionForm({
              ...sessionForm,
              scheduledOn: event.target.value,
            })
          }
          type="date"
          value={sessionForm.scheduledOn}
        />
      </label>
      <div className="training-field-group">
        <h3>Bài tập theo thứ tự</h3>
        {sessionForm.exercises.map((exercise, index) => (
          <fieldset key={index}>
            <legend>Bài tập {index + 1}</legend>
            <label>
              Tên bài tập
              <input
                onChange={(event) =>
                  updateSessionExercise(index, "name", event.target.value)
                }
                required
                value={exercise.name}
              />
            </label>
            <label>
              Số hiệp
              <input
                min="1"
                onChange={(event) =>
                  updateSessionExercise(index, "sets", event.target.value)
                }
                required
                type="number"
                value={exercise.sets}
              />
            </label>
            <label>
              Số lần
              <input
                min="1"
                onChange={(event) =>
                  updateSessionExercise(index, "reps", event.target.value)
                }
                required
                type="number"
                value={exercise.reps}
              />
            </label>
            <label>
              Nghỉ (giây)
              <input
                min="0"
                onChange={(event) =>
                  updateSessionExercise(
                    index,
                    "restSeconds",
                    event.target.value,
                  )
                }
                required
                type="number"
                value={exercise.restSeconds}
              />
            </label>
            {sessionForm.exercises.length > 1 && (
              <Button
                onClick={() =>
                  setSessionForm((current) => ({
                    ...current,
                    exercises: current.exercises.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  }))
                }
                size="sm"
                type="button"
                variant="ghost"
              >
                Xóa bài tập
              </Button>
            )}
          </fieldset>
        ))}
        <Button
          onClick={() =>
            setSessionForm((current) => ({
              ...current,
              exercises: [...current.exercises, createSessionExercise()],
            }))
          }
          size="sm"
          type="button"
          variant="secondary"
        >
          Thêm bài tập
        </Button>
      </div>
      <Button loading={submitting} type="submit">
        Thêm buổi
      </Button>
      {sessions.length > 0 && (
        <div className="training-field-group">
          <h3>Buổi đã lên lịch</h3>
          {sessions.map((item, index) => (
            <article key={item.id}>
              <strong>
                Buổi {item.position}: {item.title}
              </strong>
              <p>
                {item.status === "completed"
                  ? "Đã hoàn thành"
                  : item.status === "skipped"
                    ? "Bỏ buổi"
                    : "Chờ tập"}{" "}
                ·{" "}
                {item.scheduled_on
                  ? new Date(item.scheduled_on).toLocaleDateString("vi-VN")
                  : "Chưa đặt ngày"}
              </p>
              <ol>
                {item.exercises.map((exercise, exerciseIndex) => (
                  <li key={exercise.id}>
                    {exercise.name} · {exercise.sets} hiệp ×{" "}
                    {exercise.reps ?? "—"} lần{" "}
                    <Button
                      disabled={submitting || exerciseIndex === 0}
                      onClick={() =>
                        void moveSessionExercise(item, exerciseIndex, -1)
                      }
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Lên
                    </Button>{" "}
                    <Button
                      disabled={
                        submitting ||
                        exerciseIndex === item.exercises.length - 1
                      }
                      onClick={() =>
                        void moveSessionExercise(item, exerciseIndex, 1)
                      }
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Xuống
                    </Button>
                  </li>
                ))}
              </ol>
              <Button
                disabled={submitting || index === 0}
                onClick={() => void moveSession(index, -1)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Lên buổi
              </Button>{" "}
              <Button
                disabled={submitting || index === sessions.length - 1}
                onClick={() => void moveSession(index, 1)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Xuống buổi
              </Button>{" "}
              <Button
                disabled={submitting || item.status !== "pending"}
                onClick={() =>
                  void submit(
                    () =>
                      trainingApi.updateSession(item.id, {
                        status: "completed",
                        coachComment: "Đã hoàn thành buổi tập",
                      }),
                    "Đã ghi nhận buổi tập hoàn thành.",
                  )
                }
                size="sm"
                type="button"
                variant="secondary"
              >
                Hoàn thành
              </Button>{" "}
              <Button
                disabled={submitting || item.status !== "pending"}
                onClick={() =>
                  void submit(
                    () =>
                      trainingApi.updateSession(item.id, {
                        status: "skipped",
                        coachComment: "Coach ghi nhận bỏ buổi",
                      }),
                    "Đã ghi nhận bỏ buổi tập.",
                  )
                }
                size="sm"
                type="button"
                variant="ghost"
              >
                Bỏ buổi
              </Button>
            </article>
          ))}
        </div>
      )}
    </form>
  );
}
