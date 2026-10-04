import { AppError } from "../../../shared/errors/app-error.js";

export function trainingFailure(code, message, statusCode = 422) {
  return new AppError({ statusCode, code, message });
}

export function checkProfessionalAuthorization(authorization, actor, discipline, now = new Date()) {
  if (!authorization || authorization.user_id !== actor.id || authorization.discipline !== discipline || authorization.revoked_at || (authorization.user_status && authorization.user_status !== "active")
    || new Date(authorization.verified_at) > now || new Date(authorization.expires_at) <= now) {
    throw trainingFailure("TRAINING_REVIEW_AUTHORIZATION_REQUIRED", "Cần xác minh chuyên môn còn hiệu lực cho đúng môn trước khi duyệt.", 403);
  }
}

export function checkPopulation(assessment, protocol) {
  const p = assessment.population;
  const scope = protocol.population_scope;
  if (!p || !Number.isInteger(p.age_years) || [p.pregnant, p.breastfeeding, p.clinical_restrictions].some((item) => typeof item !== "boolean")) {
    throw trainingFailure("TRAINING_POPULATION_UNKNOWN", "Cần xác nhận tuổi và các thông tin phạm vi; chưa biết không có nghĩa là bình thường.");
  }
  if (p.age_years < scope.minimum_age_years || (p.pregnant && !scope.pregnancy_allowed)
    || (p.breastfeeding && !scope.breastfeeding_allowed) || (p.clinical_restrictions && !scope.clinical_restrictions_allowed)) {
    throw trainingFailure("TRAINING_OUTSIDE_PROTOCOL_SCOPE", "Hồ sơ nằm ngoài phạm vi được duyệt của quy tắc này.");
  }
}

function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
export function matchesCondition(actual, { op, value }) {
  if (actual === undefined || actual === null) return false;
  switch (op) {
    case "eq": return same(actual, value);
    case "ne": return !same(actual, value);
    case "gte": return typeof actual === "number" && typeof value === "number" && actual >= value;
    case "lte": return typeof actual === "number" && typeof value === "number" && actual <= value;
    case "in": return Array.isArray(value) && value.some((item) => same(actual, item));
    case "contains": return Array.isArray(actual) && actual.some((item) => same(item, value));
    default: return false;
  }
}

export function recordedInputs(assessment, measurements, findings) {
  const inputs = new Map();
  for (const field of ["goal", "available_days", "minutes_per_session", "experience", "equipment", "other_activity", "population"]) {
    if (assessment[field] !== undefined && assessment[field] !== null) inputs.set(`assessment.${field}`, { input_key: `assessment.${field}`, kind: "assessment", assessment_field: field, value: assessment[field] });
  }
  // Measurements arrive newest first: never let older observations overwrite newer ones.
  for (const item of measurements) {
    if (item.data_kind === "estimated") continue;
    const key = `measurement.${item.metric_code}`;
    if (!inputs.has(key)) inputs.set(key, { input_key: key, kind: "measurement", measurement_id: item.id, value: item.value_numeric != null ? Number(item.value_numeric) : item.value_text });
  }
  for (const item of findings) {
    const key = `finding.${item.code}`;
    if (!inputs.has(key)) inputs.set(key, { input_key: key, kind: "finding", finding_id: item.id, value: item.description });
  }
  return inputs;
}

export function evaluateRecordedRules(rules, inputs) {
  const matched = [];
  const missing = new Set();
  const prescriptions = [];
  for (const rule of rules) {
    const absent = rule.required_inputs.filter((key) => !inputs.has(key));
    absent.forEach((key) => missing.add(key));
    if (absent.length || !rule.conditions.every((condition) => matchesCondition(inputs.get(condition.input)?.value, condition))) continue;
    const resolved = rule.recommendation.prescriptions.map((template) => Object.fromEntries(Object.entries(template).map(([key, item]) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        if (Object.keys(item).length !== 1 || typeof item.input !== "string" || !inputs.has(item.input)) throw trainingFailure("TRAINING_RULE_OUTPUT_INPUT_MISSING", "Quy tắc thiếu dữ liệu nguồn cho nội dung giáo án.");
        return [key, inputs.get(item.input).value];
      }
      return [key, item];
    })));
    for (const item of resolved) validatePrescription(item);
    matched.push(rule);
    prescriptions.push(...resolved);
  }
  if (!matched.length) throw trainingFailure("TRAINING_NO_EVIDENCED_RULE", missing.size ? "Thiếu dữ liệu thực tế cần cho quy tắc. Hãy bổ sung đánh giá." : "Chưa có quy tắc được duyệt phù hợp với kết quả đánh giá.");
  return { matched, prescriptions };
}

export function validatePrescription(item, allowBindings = false) {
  const numeric = ["duration_seconds", "sets", "reps", "load_kg", "rest_seconds", "target_rpe", "target_rir", "hold_seconds", "breath_cycles"];
  for (const key of numeric) {
    const value = item[key];
    if (value === undefined || (allowBindings && value && typeof value === "object")) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (["sets", "reps", "breath_cycles", "hold_seconds", "duration_seconds", "rest_seconds", "target_rir"].includes(key) && !Number.isInteger(value)) || (["sets", "reps", "breath_cycles", "hold_seconds", "duration_seconds"].includes(key) && value <= 0) || (key === "target_rpe" && value > 10)) throw trainingFailure("TRAINING_DOSE_INVALID", "Liều tập phải đúng kiểu, đơn vị và giới hạn của chỉ số.");
  }
  const isGym = item.discipline === "gym";
  if ((isGym && ["hold_seconds", "breath_cycles", "props"].some((key) => item[key] !== undefined)) || (!isGym && ["sets", "reps", "load_kg", "rest_seconds", "target_rpe", "target_rir"].some((key) => item[key] !== undefined)) || (isGym && (!item.sets || (!item.reps && !item.duration_seconds))) || (!isGym && !item.hold_seconds && !item.breath_cycles && !item.duration_seconds)) throw trainingFailure("TRAINING_DOSE_DISCIPLINE_INVALID", "Cần liều tập rõ ràng và đúng môn Gym/Yoga.");
}

export function checkMetric(metric, input, discipline) {
  if (!metric || metric.unit !== input.unit || (metric.discipline !== "general" && metric.discipline !== discipline)) throw trainingFailure("TRAINING_METRIC_INVALID", "Chỉ số hoặc đơn vị không phù hợp với môn đang đánh giá.");
  const numeric = input.valueNumeric;
  if ((metric.value_type === "numeric") !== (numeric !== undefined)) throw trainingFailure("TRAINING_METRIC_TYPE_INVALID", "Giá trị phải đúng loại dữ liệu của chỉ số.");
  if (numeric !== undefined && (!Number.isFinite(numeric) || (metric.minimum != null && numeric < Number(metric.minimum)) || (metric.maximum != null && numeric > Number(metric.maximum)))) throw trainingFailure("TRAINING_METRIC_RANGE_INVALID", "Giá trị nằm ngoài phạm vi dữ liệu của chỉ số.");
  if (["body_fat", "rir"].includes(metric.code) && input.dataKind !== "estimated") throw trainingFailure("TRAINING_ESTIMATE_LABEL_REQUIRED", "Chỉ số này phải được ghi rõ là ước tính.");
}
