import { newTemplate } from "../domain/training-form.js";
import { Button } from "../../../shared/ui/Button.jsx";
import { trainingApi } from "../api/training-api.js";
export function TrainingTemplateForm({
  setTemplate,
  submit,
  submitting,
  template,
}) {
  return (
    <form
      className="members-form training-template-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(async () => {
          await trainingApi.createTemplate({
            name: template.name,
            targetGroup: template.targetGroup,
            description: template.description || undefined,
            exercises: [
              {
                name: template.exerciseName,
                sets: Number(template.sets),
                reps: Number(template.reps),
                rest_seconds: Number(template.restSeconds),
              },
            ],
          });
          setTemplate(newTemplate);
        }, "Đã tạo mẫu giáo án chung.");
      }}
    >
      <h2>Tạo mẫu giáo án</h2>
      <label>
        Tên mẫu
        <input
          onChange={(e) =>
            setTemplate({
              ...template,
              name: e.target.value,
            })
          }
          required
          value={template.name}
        />
      </label>
      <label>
        Đối tượng
        <input
          onChange={(e) =>
            setTemplate({
              ...template,
              targetGroup: e.target.value,
            })
          }
          required
          value={template.targetGroup}
        />
      </label>
      <label>
        Bài tập đầu tiên
        <input
          onChange={(e) =>
            setTemplate({
              ...template,
              exerciseName: e.target.value,
            })
          }
          required
          value={template.exerciseName}
        />
      </label>
      <label>
        Số hiệp
        <input
          min="1"
          onChange={(e) =>
            setTemplate({
              ...template,
              sets: e.target.value,
            })
          }
          required
          type="number"
          value={template.sets}
        />
      </label>
      <label>
        Số lần
        <input
          min="1"
          onChange={(e) =>
            setTemplate({
              ...template,
              reps: e.target.value,
            })
          }
          required
          type="number"
          value={template.reps}
        />
      </label>
      <label>
        Nghỉ giữa hiệp (giây)
        <input
          min="0"
          onChange={(e) =>
            setTemplate({
              ...template,
              restSeconds: e.target.value,
            })
          }
          required
          type="number"
          value={template.restSeconds}
        />
      </label>
      <Button loading={submitting} type="submit">
        Tạo mẫu
      </Button>
    </form>
  );
}
