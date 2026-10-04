import { describe, expect, it } from "vitest";
import { checkProfessionalAuthorization, checkPopulation, recordedInputs, evaluateRecordedRules, validatePrescription } from "../src/modules/training/domain/personalization-policy.js";
import { createPersonalizationService } from "../src/modules/training/index.js";

const now = new Date("2026-10-04T02:00:00Z");
const authorization = { user_id: "coach", discipline: "gym", verified_at: "2026-10-01", expires_at: "2026-11-01" };
const assessment = { population: { age_years: 31, pregnant: false, breastfeeding: false, clinical_restrictions: false }, minutes_per_session: 30 };
const scope = { population_scope: { minimum_age_years: 18, pregnancy_allowed: false, breastfeeding_allowed: false, clinical_restrictions_allowed: false } };
const template = { discipline: "gym", name: "Fixture", variant: "Fixture", sets: 2, reps: 8, load_kg: { input: "measurement.load" } };
const rule = { required_inputs: ["assessment.minutes_per_session", "measurement.load"], conditions: [{ input: "assessment.minutes_per_session", op: "gte", value: 30 }], recommendation: { prescriptions: [template] } };

describe("recorded-fact personalization policy", () => {
  it.each([null, { ...authorization, user_id: "other" }, { ...authorization, discipline: "yoga" }, { ...authorization, revoked_at: now }, { ...authorization, expires_at: now }, { ...authorization, verified_at: "2026-10-05" }, { ...authorization, user_status: "inactive" }])("rejects unavailable or mismatched professional authority %j", (value) => {
    expect(() => checkProfessionalAuthorization(value, { id: "coach" }, "gym", now)).toThrow();
  });
  it("accepts only own unexpired authority in the exact discipline", () => {
    expect(() => checkProfessionalAuthorization(authorization, { id: "coach" }, "gym", now)).not.toThrow();
  });
  it.each([{}, { population: { ...assessment.population, pregnant: true } }, { population: { ...assessment.population, clinical_restrictions: true } }, { population: { ...assessment.population, age_years: 17 } }])("rejects unknown/outside-scope population %j", (value) => expect(() => checkPopulation(value, scope)).toThrow());
  it("uses the newest recorded measurement and excludes estimates", () => {
    const inputs = recordedInputs(assessment, [{ id: "estimate", metric_code: "load", value_numeric: 50, data_kind: "estimated" }, { id: "new", metric_code: "load", value_numeric: "6", data_kind: "observed" }, { id: "old", metric_code: "load", value_numeric: 2, data_kind: "observed" }], []);
    expect(evaluateRecordedRules([rule], inputs).prescriptions[0].load_kg).toBe(6);
    expect(inputs.get("measurement.load").measurement_id).toBe("new");
    expect(() => evaluateRecordedRules([rule], recordedInputs(assessment, [], []))).toThrow();
    expect(() => evaluateRecordedRules([rule], recordedInputs({ ...assessment, minutes_per_session: 20 }, [{ metric_code: "load", value_numeric: 6 }], []))).toThrow();
  });
  it.each([{ discipline: "gym", sets: 0 }, { discipline: "gym", sets: 2.5 }, { discipline: "gym", sets: 2, hold_seconds: 3 }, { discipline: "yoga", hold_seconds: 10, load_kg: 3 }, { discipline: "yoga" }, { discipline: "gym", sets: 2, target_rpe: 11 }])("rejects invalid or cross-discipline doses %j", (item) => expect(() => validatePrescription(item)).toThrow());
  it("blocks coach access to another member before reading sensitive data", async () => {
    const service = createPersonalizationService({ directory: { assigned: async () => false }, repository: { profile: () => { throw new Error("must not read"); } } });
    await expect(service.profile("other", { id: "coach", role: "coach" })).rejects.toMatchObject({ statusCode: 403 });
  });
});
