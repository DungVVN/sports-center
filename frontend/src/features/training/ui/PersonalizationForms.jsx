import { useState } from "react";
import { Button } from "../../../shared/ui/Button.jsx";
import { personalizationApi } from "../api/personalization-api.js";

const read = (form) => Object.fromEntries(new FormData(form));
const isoNow = () => new Date().toISOString();
const optionalNumber = (value) => (value === "" || value === undefined ? undefined : Number(value));
export function AssessmentForm({ memberId, metrics, run, pending }) {
  const [discipline, setDiscipline] = useState("gym");
  const [metricCode, setMetricCode] = useState("");
  const [measurements, setMeasurements] = useState([]);
  const metric = metrics.find((item) => item.code === metricCode);
  const makeMeasurement = (data) => ({
    metricCode,
    unit: metric.unit,
    ...(metric.value_type === "numeric" ? { valueNumeric: Number(data.value) } : { valueText: data.value }),
    dataKind: data.kind,
    method: data.method,
    conditions: data.conditions,
    measuredAt: isoNow(),
  });
  return (
    <form
      className="members-form training-action-form"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = read(form);
        const populationKnown =
          ["pregnant", "breastfeeding", "clinical"].every((key) => data[key] !== "unknown") && data.age !== "";
        const input = {
          discipline,
          goal: data.goal,
          availableDays: new FormData(form).getAll("days").map(Number),
          minutesPerSession: Number(data.minutes),
          experience: data.experience,
          equipment: data.equipment
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          otherActivity: data.otherActivity,
          ...(populationKnown
            ? {
                population: {
                  age_years: Number(data.age),
                  pregnant: data.pregnant === "yes",
                  breastfeeding: data.breastfeeding === "yes",
                  clinical_restrictions: data.clinical === "yes",
                },
              }
            : {}),
          screeningStatus: data.screening,
          ...(data.tool ? { screeningTool: data.tool } : {}),
          ...(data.toolVersion ? { screeningVersion: data.toolVersion } : {}),
          assessedAt: isoNow(),
          reviewDueAt: new Date(`${data.reviewDue}T23:59:00+07:00`).toISOString(),
          findings: [
            { code: "movement_review", category: "movement", description: data.movement, outcome: "observed" },
          ],
          measurements: [...measurements, ...(metric ? [makeMeasurement(data)] : [])],
          ...(metric && data.target
            ? {
                goals: [
                  {
                    metricCode,
                    unit: metric.unit,
                    baselineMeasurementIndex: measurements.length,
                    ...(metric.value_type === "numeric"
                      ? { targetNumeric: Number(data.target) }
                      : { targetText: data.target }),
                    evaluationMethod: data.evaluationMethod,
                    dueOn: data.targetDue,
                  },
                ],
              }
            : {}),
        };
        void run(() => personalizationApi.assessment(memberId, input));
      }}
    >
      <h3>Đánh giá hội viên</h3>
      <p>
        Chỉ ghi kết quả đã đánh giá và thông tin hội viên cung cấp. Thông tin chưa rõ để “Chưa xác nhận”; hồ sơ đó sẽ
        chưa được tự tạo giáo án.
      </p>
      <label>
        Môn
        <select
          value={discipline}
          onChange={(e) => {
            setDiscipline(e.target.value);
            setMetricCode("");
            setMeasurements([]);
          }}
        >
          <option value="gym">Gym</option>
          <option value="yoga">Yoga</option>
        </select>
      </label>
      <label>
        Mục tiêu cá nhân
        <textarea name="goal" required maxLength={1000} />
      </label>
      <fieldset>
        <legend>Ngày thực sự có thể tập</legend>
        {["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"].map((label, i) => (
          <label key={i}>
            <input type="checkbox" name="days" value={i} />
            {label}
          </label>
        ))}
      </fieldset>
      <label>
        Thời gian mỗi buổi (phút)
        <input name="minutes" type="number" min="1" max="1440" required />
      </label>
      <label>
        Kinh nghiệm
        <select name="experience">
          <option value="new">Mới bắt đầu</option>
          <option value="returning">Quay lại sau nghỉ</option>
          <option value="experienced">Đã tập thường xuyên</option>
        </select>
      </label>
      <label>
        Dụng cụ có thể dùng, cách nhau bằng dấu phẩy
        <input name="equipment" />
      </label>
      <label>
        Hoạt động ngoài trung tâm
        <textarea name="otherActivity" maxLength={1000} />
      </label>
      <label>
        Tuổi đã xác nhận
        <input name="age" type="number" min="0" />
      </label>
      {[
        ["pregnant", "Đang mang thai"],
        ["breastfeeding", "Đang cho con bú"],
        ["clinical", "Có giới hạn do bệnh lý/chấn thương"],
      ].map(([name, label]) => (
        <label key={name}>
          {label}
          <select name={name}>
            <option value="unknown">Chưa xác nhận</option>
            <option value="no">Không</option>
            <option value="yes">Có</option>
          </select>
        </label>
      ))}
      <label>
        Trạng thái sàng lọc
        <select name="screening">
          <option value="unknown">Chưa hoàn tất</option>
          <option value="follow_up">Cần bổ sung thông tin</option>
          <option value="referred">Cần ý kiến chuyên gia</option>
          <option value="reviewed_for_scope">Đã đánh giá trong phạm vi chuyên môn</option>
        </select>
      </label>
      <label>
        Công cụ/quy trình sàng lọc
        <input name="tool" />
      </label>
      <label>
        Phiên bản công cụ
        <input name="toolVersion" />
      </label>
      <label>
        Đánh giá vận động đã thực hiện
        <textarea name="movement" required maxLength={1000} />
      </label>
      <label>
        Ngày phải review lại
        <input type="date" name="reviewDue" required />
      </label>
      <label>
        Số đo/chỉ số, nếu đã có
        <select value={metricCode} onChange={(e) => setMetricCode(e.target.value)}>
          <option value="">Không thêm số đo</option>
          {metrics
            .filter((item) => [discipline, "general"].includes(item.discipline))
            .map((item) => (
              <option key={item.code} value={item.code}>
                {item.name} ({item.unit})
              </option>
            ))}
        </select>
      </label>
      {measurements.map((item, index) => (
        <p key={index}>
          {item.metricCode}: {item.valueNumeric ?? item.valueText} {item.unit} · {item.dataKind}{" "}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMeasurements(measurements.filter((_, position) => position !== index))}
          >
            Bỏ số đo
          </Button>
        </p>
      ))}
      {metric && (
        <>
          <label>
            Giá trị ({metric.unit})
            <input name="value" type={metric.value_type === "numeric" ? "number" : "text"} step="any" required />
          </label>
          <label>
            Loại dữ liệu
            <select name="kind">
              <option value="observed">Đo/quan sát thực tế</option>
              <option value="self_reported">Hội viên tự báo</option>
              <option value="estimated">Ước tính</option>
            </select>
          </label>
          <label>
            Phương pháp
            <input name="method" required />
          </label>
          <label>
            Điều kiện đo
            <input name="conditions" required />
          </label>
          <label>
            Chỉ tiêu cá nhân, nếu đã thống nhất ({metric.unit})
            <input name="target" type={metric.value_type === "numeric" ? "number" : "text"} step="any" />
          </label>
          <label>
            Phương pháp đánh giá chỉ tiêu
            <input name="evaluationMethod" />
          </label>
          <label>
            Ngày đánh giá chỉ tiêu
            <input name="targetDue" type="date" />
          </label>
        </>
      )}
      {metric && (
        <Button
          type="button"
          variant="ghost"
          disabled={measurements.length >= 49}
          onClick={(event) => {
            const form = event.currentTarget.form;
            if (!["value", "method", "conditions"].every((name) => form.elements.namedItem(name).reportValidity()))
              return;
            setMeasurements([...measurements, makeMeasurement(read(form))]);
            setMetricCode("");
          }}
        >
          Thêm số đo khác trong cùng đánh giá
        </Button>
      )}
      <Button type="submit" loading={pending} disabled={!memberId}>
        Lưu bản đánh giá nháp
      </Button>
    </form>
  );
}

export function AuthorizationForm({ users, run, pending }) {
  return (
    <form
      className="members-form training-action-form"
      onSubmit={(e) => {
        e.preventDefault();
        const data = read(e.currentTarget);
        void run(() =>
          personalizationApi.authorize({
            userId: data.user,
            discipline: data.discipline,
            credentialReference: data.credential,
            expiresAt: new Date(`${data.expires}T23:59:00+07:00`).toISOString(),
            verificationConfirmed: true,
          }),
        );
      }}
    >
      <h3>Xác minh người duyệt chuyên môn</h3>
      <p>Quản trị viên chỉ ghi sau khi đã kiểm tra chứng chỉ và phạm vi thực tế.</p>
      <label>
        Người phụ trách
        <select name="user" required>
          <option value="">Chọn người</option>
          {users.map((user) => (
            <option value={user.id} key={user.id}>
              {user.display_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Phạm vi
        <select name="discipline">
          <option value="gym">Gym</option>
          <option value="yoga">Yoga</option>
          <option value="nutrition">Dinh dưỡng</option>
        </select>
      </label>
      <label>
        Tham chiếu chứng chỉ và kết quả xác minh
        <textarea name="credential" required />
      </label>
      <label>
        Hiệu lực đến
        <input type="date" name="expires" required />
      </label>
      <label>
        <input type="checkbox" required />
        Đã kiểm tra hồ sơ chuyên môn thực tế
      </label>
      <Button type="submit" loading={pending}>
        Lưu xác minh
      </Button>
    </form>
  );
}

export function ProtocolForm({ sources, metrics, run, pending }) {
  const [discipline, setDiscipline] = useState("gym");
  const [inputKey, setInputKey] = useState("assessment.minutes_per_session");
  const [metric, setMetric] = useState("");
  return (
    <form
      className="members-form training-action-form"
      onSubmit={(e) => {
        e.preventDefault();
        const data = read(e.currentTarget);
        const requiredInputs = [inputKey, ...(metric ? [`measurement.${metric}`] : [])];
        const numeric = inputKey === "assessment.minutes_per_session";
        const expected = numeric ? Number(data.expected) : data.expected;
        const base = {
          discipline,
          name: data.exercise,
          variant: data.variant,
          instructions: data.instructions,
          progression_criteria: data.progression,
        };
        const output =
          discipline === "gym"
            ? {
                ...base,
                sets: Number(data.sets),
                reps: Number(data.reps),
                ...(metric ? { load_kg: { input: `measurement.${metric}` } } : { load_kg: Number(data.load) }),
                rest_seconds: Number(data.rest),
              }
            : {
                ...base,
                ...(optionalNumber(data.hold) !== undefined ? { hold_seconds: Number(data.hold) } : {}),
                ...(optionalNumber(data.breaths) !== undefined ? { breath_cycles: Number(data.breaths) } : {}),
                props: data.props
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              };
        void run(() =>
          personalizationApi.protocol({
            name: data.name,
            discipline,
            populationScope: {
              minimum_age_years: Number(data.minAge),
              pregnancy_allowed: false,
              breastfeeding_allowed: false,
              clinical_restrictions_allowed: false,
            },
            limitations: data.limitations,
            evidence: [
              {
                sourceId: data.source,
                sectionReference: data.section,
                interpretation: data.interpretation,
                applicability: data.applicability,
              },
            ],
            rules: [
              {
                code: "documented_rule",
                evidenceIndex: 0,
                requiredInputs,
                conditions: [
                  { input: inputKey, op: numeric ? data.operation : "eq", value: expected },
                  ...(metric ? [{ input: `measurement.${metric}`, op: "gte", value: 0 }] : []),
                ],
                recommendation: { prescriptions: [output] },
                rationale: data.rationale,
              },
            ],
          }),
        );
      }}
    >
      <h3>Soạn một quy tắc có nguồn</h3>
      <p>
        Quy tắc chỉ là bản nháp đến khi người có xác minh chuyên môn duyệt. Biểu mẫu này hỗ trợ phạm vi người trưởng
        thành không có các giới hạn đặc biệt.
      </p>
      <label>
        Tên quy tắc
        <input name="name" required />
      </label>
      <label>
        Môn
        <select
          value={discipline}
          onChange={(e) => {
            setDiscipline(e.target.value);
            setMetric("");
          }}
        >
          <option value="gym">Gym</option>
          <option value="yoga">Yoga</option>
        </select>
      </label>
      <label>
        Tuổi tối thiểu của phạm vi bằng chứng
        <input name="minAge" type="number" min="18" required />
      </label>
      <label>
        Giới hạn áp dụng
        <textarea name="limitations" required />
      </label>
      <label>
        Nguồn khoa học
        <select name="source" required>
          <option value="">Chọn nguồn</option>
          {sources.map((item) => (
            <option key={item.id} value={item.id}>
              {item.publisher} · {item.version}
            </option>
          ))}
        </select>
      </label>
      <label>
        Mục/đoạn được viện dẫn
        <input name="section" required />
      </label>
      <label>
        Diễn giải bằng chứng
        <textarea name="interpretation" required />
      </label>
      <label>
        Vì sao nguồn áp dụng cho quy tắc này
        <textarea name="applicability" required />
      </label>
      <label>
        Điều kiện dựa trên đánh giá
        <select value={inputKey} onChange={(e) => setInputKey(e.target.value)}>
          <option value="assessment.minutes_per_session">Số phút có thể tập</option>
          <option value="assessment.experience">Kinh nghiệm</option>
          <option value="finding.movement_review">Kết quả đánh giá vận động</option>
        </select>
      </label>
      {inputKey === "assessment.minutes_per_session" && (
        <label>
          So sánh
          <select name="operation">
            <option value="gte">Từ mức này trở lên</option>
            <option value="lte">Không vượt mức này</option>
            <option value="eq">Đúng mức này</option>
          </select>
        </label>
      )}
      <label>
        Giá trị điều kiện
        <input name="expected" required type={inputKey === "assessment.minutes_per_session" ? "number" : "text"} />
      </label>
      <label>
        Tên bài/tư thế
        <input name="exercise" required />
      </label>
      <label>
        Biến thể phù hợp
        <input name="variant" required />
      </label>
      <label>
        Hướng dẫn
        <textarea name="instructions" required />
      </label>
      {discipline === "gym" ? (
        <>
          <label>
            Số hiệp
            <input name="sets" type="number" min="1" required />
          </label>
          <label>
            Số lần
            <input name="reps" type="number" min="1" required />
          </label>
          <label>
            Lấy tải từ kết quả đã đo
            <select value={metric} onChange={(e) => setMetric(e.target.value)}>
              <option value="">HLV quy định tải và giải thích ở nguồn</option>
              {metrics
                .filter((m) => m.code === "load")
                .map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name} ({m.unit})
                  </option>
                ))}
            </select>
          </label>
          {!metric && (
            <label>
              Tải (kg)
              <input name="load" type="number" min="0" step="any" required />
            </label>
          )}
          <label>
            Nghỉ (giây)
            <input name="rest" type="number" min="0" required />
          </label>
        </>
      ) : (
        <>
          <label>
            Thời gian giữ (giây)
            <input name="hold" type="number" min="1" />
          </label>
          <label>
            Số nhịp thở
            <input name="breaths" type="number" min="1" />
          </label>
          <label>
            Dụng cụ hỗ trợ, cách nhau bằng dấu phẩy
            <input name="props" />
          </label>
        </>
      )}
      <label>
        Tiêu chí giữ/đổi/tăng yêu cầu
        <textarea name="progression" required />
      </label>
      <label>
        Lý do chuyên môn cho đề xuất
        <textarea name="rationale" required />
      </label>
      <Button type="submit" loading={pending}>
        Lưu quy tắc nháp
      </Button>
    </form>
  );
}
