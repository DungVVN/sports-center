import { newResult } from "../domain/training-form.js";
import { Button } from "../../../shared/ui/Button.jsx";
import { trainingApi } from "../api/training-api.js";
export function TrainingResultForm({
  plans,
  result,
  setResult,
  submit,
  submitting,
}) {
  return (
    <form
      className="members-form training-action-form training-result-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(async () => {
          await trainingApi.recordResult({
            ...result,
            valueNumeric: result.valueNumeric
              ? Number(result.valueNumeric)
              : undefined,
            valueText: result.valueText || undefined,
            coachComment: result.coachComment || undefined,
          });
          setResult(newResult);
        }, "Đã ghi nhận kết quả tập luyện.");
      }}
    >
      <div className="training-form-heading">
        <span>02 · Theo dõi tiến độ</span>
        <h2>Ghi nhận kết quả</h2>
      </div>
      <label>
        Giáo án
        <select
          onChange={(e) =>
            setResult({
              ...result,
              planId: e.target.value,
            })
          }
          required
          value={result.planId}
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
        Ngày ghi nhận
        <input
          onChange={(e) =>
            setResult({
              ...result,
              recordedOn: e.target.value,
            })
          }
          required
          type="date"
          value={result.recordedOn}
        />
      </label>
      <label>
        Chỉ số
        <input
          onChange={(e) =>
            setResult({
              ...result,
              metric: e.target.value,
            })
          }
          required
          value={result.metric}
        />
      </label>
      <label>
        Giá trị số
        <input
          onChange={(e) =>
            setResult({
              ...result,
              valueNumeric: e.target.value,
            })
          }
          type="number"
          value={result.valueNumeric}
        />
      </label>
      <label>
        Ghi nhận
        <textarea
          onChange={(e) =>
            setResult({
              ...result,
              valueText: e.target.value,
            })
          }
          value={result.valueText}
        />
      </label>
      <label>
        Nhận xét của Coach
        <textarea
          onChange={(e) =>
            setResult({
              ...result,
              coachComment: e.target.value,
            })
          }
          value={result.coachComment}
        />
      </label>
      <Button loading={submitting} type="submit">
        Lưu kết quả
      </Button>
    </form>
  );
}
