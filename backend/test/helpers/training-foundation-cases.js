import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";

export async function verifyTrainingFoundation(db) {
const tests = [];
let counter = 0;
const earlier = new Date(Date.now() - 120000);
const later = new Date(Date.now() + 86400000);
const q = (name) => `"${name}"`;
async function insert(table, data) {
  const columns = Object.keys(data);
  const result = await db.query(`INSERT INTO ${q(table)} (${columns.map(q).join(",")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`, Object.values(data));
  return result.rows[0];
}
async function rejects(label, action, code = "23514") {
  const point = `test_${++counter}`;
  await db.query(`SAVEPOINT ${point}`);
  try {
    await action();
    throw new Error(`${label}: invalid data was accepted`);
  } catch (error) {
    await db.query(`ROLLBACK TO SAVEPOINT ${point}`);
    assert.equal(error.code, code, label);
    tests.push({ label, passed: true });
  } finally { await db.query(`RELEASE SAVEPOINT ${point}`); }
}

try {
  await db.query("BEGIN");
  const admin = await insert("users", { email: `isolated-${randomUUID()}@example.invalid`, password_hash: "not-a-login-hash", display_name: "Isolated DB test administrator", role: "admin", status: "active" });
  const member = await insert("members", { member_code: `TEST-${randomUUID()}`, full_name: "Isolated training test", phone: randomUUID(), date_of_birth: "1995-01-01" });
  const otherMember = await insert("members", { member_code: `TEST-${randomUUID()}`, full_name: "Second isolated test", phone: randomUUID() });
  const consentData = { member_id: member.id, purpose: "assessment", policy_version: "test-v1", recorded_by: admin.id, granted_at: earlier };
  const consent = await insert("member_training_consents", consentData);
  await rejects("duplicate current consent", () => insert("member_training_consents", consentData), "23505");
  const authority = await insert("training_review_authorizations", { user_id: admin.id, discipline: "gym", credential_reference: "ISOLATED TEST ONLY; not a real qualification", verified_by: admin.id, verified_at: earlier, expires_at: later });
  const yogaAuthority = await insert("training_review_authorizations", { user_id: admin.id, discipline: "yoga", credential_reference: "ISOLATED TEST ONLY", verified_by: admin.id, verified_at: earlier, expires_at: later });
  const population = { age_years: 31, pregnant: false, breastfeeding: false, clinical_restrictions: false };
  const scope = { minimum_age_years: 18, pregnancy_allowed: false, breastfeeding_allowed: false, clinical_restrictions_allowed: false };
  const assessmentData = { member_id: member.id, consent_id: consent.id, version: 1, discipline: "gym", goal: "Demonstrate recorded movement safely under review", available_days: JSON.stringify([1, 4]), minutes_per_session: 30, experience: "new", equipment: JSON.stringify(["dumbbell"]), other_activity: "Recorded outside activity", population, assessed_by: admin.id, assessed_at: earlier, review_due_at: later };
  await rejects("consent ownership mismatch", () => insert("member_training_assessments", { ...assessmentData, member_id: otherMember.id }));
  await rejects("duplicate availability days", () => insert("member_training_assessments", { ...assessmentData, available_days: JSON.stringify([1, 1]) }));
  await rejects("invalid weekday", () => insert("member_training_assessments", { ...assessmentData, available_days: JSON.stringify([8]) }));
  const assessment = await insert("member_training_assessments", assessmentData);
  const reviewAssessment = (id, changes = {}) => {
    const values = { status: "reviewed", screening_status: "reviewed_for_scope", screening_tool: "documented-test-screening", screening_version: "test-1", reviewed_at: earlier, review_authorization_id: authority.id, ...changes };
    const columns = Object.keys(values);
    return db.query(`UPDATE member_training_assessments SET ${columns.map((c, i) => `${q(c)}=$${i + 1}`).join(",")} WHERE id=$${columns.length + 1}`, [...Object.values(values), id]);
  };
  await rejects("assessment without movement evidence", () => reviewAssessment(assessment.id));
  await insert("member_training_findings", { assessment_id: assessment.id, code: "squat_control", category: "movement", description: "Coach documented test task and control", outcome: "observed", recorded_by: admin.id });
  await rejects("screening still unknown", () => reviewAssessment(assessment.id, { screening_status: "unknown" }));
  await rejects("wrong professional discipline", () => reviewAssessment(assessment.id, { review_authorization_id: yogaAuthority.id }));
  await rejects("missing population data is not healthy", () => reviewAssessment(assessment.id, { population: {} }));
  await rejects("stale assessment", () => reviewAssessment(assessment.id, { review_due_at: earlier }));
  const measurementData = { assessment_id: assessment.id, metric_code: "load", unit: "kg", value_numeric: 6, data_kind: "observed", method: "Coach recorded actual demonstration", conditions: "Documented controlled test", recorded_by: admin.id, measured_at: earlier };
  await rejects("measurement without a value", () => insert("member_training_measurements", { ...measurementData, value_numeric: null }));
  await rejects("incompatible metric units", () => insert("member_training_measurements", { ...measurementData, unit: "lb" }));
  await rejects("non-finite measurement", () => insert("member_training_measurements", { ...measurementData, value_numeric: "NaN" }));
  await rejects("out-of-range RPE", () => insert("member_training_measurements", { ...measurementData, metric_code: "rpe", unit: "score_0_10", value_numeric: 11 }));
  await rejects("body fat must be labeled estimate", () => insert("member_training_measurements", { ...measurementData, metric_code: "body_fat", unit: "percent", value_numeric: 20 }));
  const measurement = await insert("member_training_measurements", measurementData);
  const estimated = await insert("member_training_measurements", { ...measurementData, data_kind: "estimated" });
  await rejects("estimated goal baseline", () => insert("member_training_goals", { assessment_id: assessment.id, metric_code: "load", unit: "kg", baseline_measurement_id: estimated.id, target_numeric: 8, evaluation_method: "Coach review", due_on: "2026-12-01", set_by: admin.id }));
  await reviewAssessment(assessment.id);
  tests.push({ label: "complete professionally reviewed assessment accepted", passed: true });
  await rejects("reviewed measurements cannot be rewritten", () => db.query("UPDATE member_training_measurements SET value_numeric=8 WHERE id=$1", [measurement.id]));
  await rejects("reviewed assessment cannot be rewritten", () => db.query("UPDATE member_training_assessments SET minutes_per_session=60 WHERE id=$1", [assessment.id]));

  const protocolData = { code: "ISOLATED_GYM_TEST", version: 1, name: "Database constraint test only", discipline: "gym", population_scope: scope, limitations: "Not an operative production guideline", created_by: admin.id };
  const protocol = await insert("training_protocol_versions", protocolData);
  const approveProtocol = () => db.query("UPDATE training_protocol_versions SET status='approved',review_authorization_id=$1,approved_at=CURRENT_TIMESTAMP WHERE id=$2", [authority.id, protocol.id]);
  await rejects("protocol approval without references or rules", approveProtocol);
  const source = (await db.query("SELECT id FROM training_evidence_sources WHERE code='ACSM_RESISTANCE'")).rows[0];
  const evidence = await insert("training_protocol_evidence", { protocol_id: protocol.id, source_id: source.id, section_reference: "Individualization", interpretation: "Test only", applicability: "Test adult scope" });
  const output = { discipline: "gym", name: "Test movement", variant: "Controlled", instructions: "Test fixture only", sets: 2, reps: 8, load_kg: { input: "measurement.load" }, progression_criteria: "Coach review" };
  const ruleData = { protocol_id: protocol.id, evidence_id: evidence.id, code: "TEST_RULE", required_inputs: JSON.stringify(["assessment.minutes_per_session", "measurement.load"]), conditions: JSON.stringify([{ input: "assessment.minutes_per_session", op: "gte", value: 30 }, { input: "measurement.load", op: "gte", value: 0 }]), recommendation: { prescriptions: [output] }, rationale: "Isolated deterministic rule test" };
  await rejects("empty prescription recommendations", () => insert("training_protocol_rules", { ...ruleData, recommendation: { prescriptions: [] } }));
  await rejects("undeclared condition input", () => insert("training_protocol_rules", { ...ruleData, conditions: JSON.stringify([{ input: "measurement.body_weight", op: "gte", value: 20 }]) }));
  const rule = await insert("training_protocol_rules", ruleData);
  await approveProtocol();
  tests.push({ label: "protocol with professional authorization and evidence accepted", passed: true });
  await rejects("approved rules cannot be modified", () => db.query("UPDATE training_protocol_rules SET rationale='changed' WHERE id=$1", [rule.id]));
  await rejects("referenced scientific source cannot be rewritten", () => db.query("UPDATE training_evidence_sources SET limitations='changed' WHERE id=$1", [source.id]));
  const plan = await insert("training_plans", { member_id: member.id, coach_user_id: admin.id, name: "Isolated test plan", goal: "Test", starts_on: "2026-10-04", ends_on: "2026-12-01", status: "active" });
  const otherPlan = await insert("training_plans", { member_id: otherMember.id, coach_user_id: admin.id, name: "Other test plan", goal: "Test", starts_on: "2026-10-04", ends_on: "2026-12-01", status: "active" });
  const decisionData = { member_id: member.id, assessment_id: assessment.id, protocol_id: protocol.id, plan_id: plan.id, idempotency_key: randomUUID(), revision: 1, origin: "rules", inputs_snapshot: { assessment_version: 1 }, explanation: "Explicit test rule and recorded inputs", created_by: admin.id };
  await rejects("plan member mismatch", () => insert("training_personalization_decisions", { ...decisionData, plan_id: otherPlan.id }));
  const decision = await insert("training_personalization_decisions", decisionData);
  await rejects("duplicate personalization request", () => insert("training_personalization_decisions", decisionData), "23505");
  const approveDecision = (id = decision.id) => db.query("UPDATE training_personalization_decisions SET status='approved',review_authorization_id=$1,approved_at=CURRENT_TIMESTAMP WHERE id=$2", [authority.id, id]);
  await rejects("approval without prescriptions or rule trace", () => approveDecision());
  const session = await insert("training_sessions", { plan_id: plan.id, position: 1, title: "Controlled session" });
  const otherSession = await insert("training_sessions", { plan_id: otherPlan.id, position: 1, title: "Other session" });
  const prescriptionData = { decision_id: decision.id, training_session_id: session.id, position: 1, discipline: "gym", name: "Test movement", variant: "Controlled", instructions: "Test fixture only", sets: 2, reps: 8, load_kg: 6, progression_criteria: "Coach review" };
  await rejects("prescription wrong session", () => insert("training_session_prescriptions", { ...prescriptionData, training_session_id: otherSession.id }));
  await rejects("Yoga cannot require Gym sets and reps", () => insert("training_session_prescriptions", { ...prescriptionData, discipline: "yoga", hold_seconds: 15 }));
  const prescription = await insert("training_session_prescriptions", prescriptionData);
  await insert("training_decision_rules", { decision_id: decision.id, rule_id: rule.id, evaluation: { matched: true } });
  await rejects("missing evidenced input", () => approveDecision());
  const inputData = { decision_id: decision.id, input_key: "measurement.load", kind: "measurement", measurement_id: measurement.id, value: JSON.stringify(6) };
  await rejects("fabricated input value", () => insert("training_decision_inputs", { ...inputData, value: JSON.stringify(60) }));
  await rejects("estimated input cannot be used as fact", () => insert("training_decision_inputs", { ...inputData, measurement_id: estimated.id }));
  await insert("training_decision_inputs", inputData);
  await insert("training_decision_inputs", { decision_id: decision.id, input_key: "assessment.minutes_per_session", kind: "assessment", assessment_field: "minutes_per_session", value: JSON.stringify(30) });
  await db.query("UPDATE training_session_prescriptions SET load_kg=60 WHERE id=$1", [prescription.id]);
  await rejects("automatic output cannot contradict source rule", () => approveDecision());
  await db.query("UPDATE training_session_prescriptions SET load_kg=6 WHERE id=$1", [prescription.id]);
  await db.query("SAVEPOINT authorization_reset");
  await db.query("UPDATE training_review_authorizations SET revoked_at=CURRENT_TIMESTAMP WHERE id=$1", [authority.id]);
  await rejects("revoked professional authorization blocks approval", () => approveDecision());
  await db.query("ROLLBACK TO SAVEPOINT authorization_reset");
  await db.query("RELEASE SAVEPOINT authorization_reset");
  await approveDecision();
  tests.push({ label: "complete rule-backed decision with recorded inputs accepted", passed: true });
  await rejects("approved prescription cannot be overwritten", () => db.query("UPDATE training_session_prescriptions SET load_kg=60 WHERE id=$1", [prescription.id]));
  await rejects("decision source cannot be retargeted", () => db.query("UPDATE training_personalization_decisions SET plan_id=$1 WHERE id=$2", [otherPlan.id, decision.id]));

  for (const [version, changes, label] of [
    [2, { minutes_per_session: 15 }, "source facts failing rule conditions block approval"],
    [3, { population: { ...population, age_years: 17 } }, "adult-only scope rejects minors"],
    [4, { population: { ...population, pregnant: true } }, "pregnancy outside protocol scope blocks approval"],
    [5, { population: { ...population, breastfeeding: true } }, "breastfeeding outside protocol scope blocks approval"],
    [6, { population: { ...population, clinical_restrictions: true } }, "clinical restrictions outside protocol scope block approval"],
  ]) {
    const extra = await insert("member_training_assessments", { ...assessmentData, version, ...changes });
    await insert("member_training_findings", { assessment_id: extra.id, code: "control", category: "movement", description: "Isolated documented task", outcome: "observed", recorded_by: admin.id });
    const extraMeasurement = await insert("member_training_measurements", { ...measurementData, assessment_id: extra.id });
    await reviewAssessment(extra.id);
    const extraPlan = await insert("training_plans", { member_id: member.id, coach_user_id: admin.id, name: "Scope test", goal: "Test", starts_on: "2026-10-04", ends_on: "2026-12-01", status: "active" });
    const extraDecision = await insert("training_personalization_decisions", { ...decisionData, assessment_id: extra.id, plan_id: extraPlan.id, idempotency_key: randomUUID() });
    await insert("training_session_prescriptions", { ...prescriptionData, decision_id: extraDecision.id, training_session_id: null });
    await insert("training_decision_rules", { decision_id: extraDecision.id, rule_id: rule.id, evaluation: { matched: true } });
    await insert("training_decision_inputs", { ...inputData, decision_id: extraDecision.id, measurement_id: extraMeasurement.id });
    await insert("training_decision_inputs", { decision_id: extraDecision.id, input_key: "assessment.minutes_per_session", kind: "assessment", assessment_field: "minutes_per_session", value: JSON.stringify(changes.minutes_per_session ?? 30) });
    await rejects(label, () => approveDecision(extraDecision.id));
  }

  const checkinData = { member_id: member.id, training_session_id: session.id, session_date: "2026-10-04", available_minutes: 30, new_symptoms: true, notes: "New symptom test", other_activity: "None" };
  await rejects("check-in member mismatch", () => insert("training_session_checkins", { ...checkinData, member_id: otherMember.id }));
  const checkin = await insert("training_session_checkins", checkinData);
  await rejects("symptoms cannot be marked routinely reviewed", () => db.query("UPDATE training_session_checkins SET review_status='reviewed',reviewed_by=$1,reviewed_at=CURRENT_TIMESTAMP WHERE id=$2", [admin.id, checkin.id]));
  await db.query("UPDATE training_session_checkins SET review_status='hold',reviewed_by=$1,reviewed_at=CURRENT_TIMESTAMP WHERE id=$2", [admin.id, checkin.id]);
  tests.push({ label: "new symptoms can be escalated to hold", passed: true });
  const observationData = { member_id: member.id, training_session_id: session.id, prescription_id: prescription.id, metric_code: "load", unit: "kg", value_numeric: 6, data_kind: "observed", method: "Actual recorded demonstration", recorded_by: admin.id, recorded_at: earlier };
  await rejects("observation cannot cross member boundary", () => insert("training_session_observations", { ...observationData, member_id: otherMember.id }));
  const observation = await insert("training_session_observations", observationData);
  await rejects("actual observation cannot be overwritten", () => db.query("UPDATE training_session_observations SET value_numeric=60 WHERE id=$1", [observation.id]));
  const nutritionConsent = await insert("member_training_consents", { ...consentData, purpose: "nutrition_tracking" });
  const energyData = { member_id: member.id, consent_id: nutritionConsent.id, recorded_on: "2026-10-04", energy_type: "intake", value_kcal: 2000, data_kind: "self_reported", method: "Member food journal", includes_exercise: false, inputs: {}, recorded_by: admin.id };
  await rejects("estimated calorie execution is disabled", () => insert("member_training_energy_records", { ...energyData, data_kind: "estimated", model_version: "unvalidated-test" }));
  await rejects("nutrition requires separate consent", () => insert("member_training_energy_records", { ...energyData, consent_id: consent.id }));
  await insert("member_training_energy_records", energyData);
  tests.push({ label: "self-reported energy stays labeled and needs consent", passed: true });
  await db.query("UPDATE member_training_consents SET withdrawn_at=CURRENT_TIMESTAMP WHERE id=$1", [nutritionConsent.id]);
  await rejects("withdrawn consent prevents new records", () => insert("member_training_energy_records", energyData));
  await db.query("ROLLBACK");

  return tests;
} catch (error) {
  await db.query("ROLLBACK");
  throw error;
}
}
