import { newPlan } from "../domain/training-form.js";
import { Button } from "../../../shared/ui/Button.jsx";
import { trainingApi } from "../api/training-api.js";
export function TrainingPlanForm({
  members,
  plan,
  planCreatorName,
  setPlan,
  submit,
  submitting,
  templates,
}) {
  return (
    <form
      className="members-form training-action-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(async () => {
          await trainingApi.createPlan(plan);
          setPlan(newPlan);
        }, "Đã tạo giáo án cá nhân.");
      }}
    >
      <div className="training-form-heading">
        <span>01 · Lập kế hoạch</span>
        <h2>Tạo giáo án cá nhân</h2>
      </div>
      <div
        className="training-creation-metadata"
        aria-label="Thông tin tạo giáo án"
      >
        <div>
          <span>Người tạo</span>
          <strong>{planCreatorName}</strong>
        </div>
        <div>
          <span>Thời gian tạo</span>
          <strong>Hệ thống ghi nhận khi lưu</strong>
        </div>
      </div>
      <section className="training-field-group">
        <h3>Chọn đầu vào</h3>
        <label>
          Hội viên
          <select
            onChange={(e) =>
              setPlan({
                ...plan,
                memberId: e.target.value,
              })
            }
            required
            value={plan.memberId}
          >
            <option value="">Chọn hội viên</option>
            {members.map((item) => (
              <option key={item.id} value={item.id}>
                {item.full_name} — {item.member_code}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mẫu giáo án
          <select
            onChange={(e) =>
              setPlan({
                ...plan,
                templateId: e.target.value,
              })
            }
            required
            value={plan.templateId}
          >
            <option value="">Chọn mẫu</option>
            {templates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="training-field-group">
        <h3>Thiết lập kế hoạch</h3>
        <label>
          Tên giáo án
          <input
            onChange={(e) =>
              setPlan({
                ...plan,
                name: e.target.value,
              })
            }
            required
            value={plan.name}
          />
        </label>
        <label>
          Mục tiêu
          <input
            onChange={(e) =>
              setPlan({
                ...plan,
                goal: e.target.value,
              })
            }
            required
            value={plan.goal}
          />
        </label>
        <label>
          Bắt đầu
          <input
            onChange={(e) =>
              setPlan({
                ...plan,
                startsOn: e.target.value,
              })
            }
            required
            type="date"
            value={plan.startsOn}
          />
        </label>
        <label>
          Kết thúc
          <input
            onChange={(e) =>
              setPlan({
                ...plan,
                endsOn: e.target.value,
              })
            }
            required
            type="date"
            value={plan.endsOn}
          />
        </label>
      </section>
      <Button loading={submitting} type="submit">
        Tạo từ mẫu
      </Button>
    </form>
  );
}
