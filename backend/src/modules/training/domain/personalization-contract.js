import { z } from "zod";

const id = z.string().uuid();
const text = z.string().trim().min(1).max(1000);
const short = z.string().trim().min(1).max(150);
const discipline = z.enum(["gym", "yoga", "nutrition"]);
const date = z.string().date();
const timestamp = z.string().datetime();
const scalar = z.union([z.string().max(1000), z.number().finite(), z.boolean()]);
const value = z.union([scalar, z.array(scalar).max(30)]);
const inputKey = z.string().regex(/^(assessment|measurement|finding)\.[a-z_]+$/);
const scope = z.object({ minimum_age_years: z.number().int().min(18), pregnancy_allowed: z.boolean(), breastfeeding_allowed: z.boolean(), clinical_restrictions_allowed: z.boolean() }).strict();
const population = z.object({ age_years: z.number().int().nonnegative(), pregnant: z.boolean(), breastfeeding: z.boolean(), clinical_restrictions: z.boolean() }).strict();
const binding = z.object({ input: inputKey }).strict();
const doseNumber = z.union([z.number().finite().nonnegative(), binding]);
export const prescriptionSchema = z.object({
  discipline: z.enum(["gym", "yoga"]), name: short, variant: short, instructions: text,
  duration_seconds: doseNumber.optional(), sets: doseNumber.optional(), reps: doseNumber.optional(),
  load_kg: doseNumber.optional(), rest_seconds: doseNumber.optional(), target_rpe: doseNumber.optional(), target_rir: doseNumber.optional(),
  hold_seconds: doseNumber.optional(), breath_cycles: doseNumber.optional(), props: z.array(short).max(10).optional(), progression_criteria: text,
}).strict();
const measurementBase = z.object({ metricCode: short, unit: short, valueNumeric: z.number().finite().optional(), valueText: text.optional(), dataKind: z.enum(["observed", "self_reported", "estimated"]), method: text, device: short.optional(), conditions: text, measuredAt: timestamp }).strict();
const oneValue = (item) => (item.valueNumeric !== undefined) !== (item.valueText !== undefined);
const measurement = measurementBase.refine(oneValue, "Cần đúng một giá trị số hoặc mô tả.");
const finding = z.object({ code: z.string().regex(/^[a-z_]+$/).max(100), category: z.enum(["movement", "restriction", "screening", "preference"]), description: text, outcome: z.enum(["observed", "self_reported", "professional_instruction"]) }).strict();
const goal = z.object({ metricCode: short, unit: short, baselineMeasurementIndex: z.number().int().nonnegative(), targetNumeric: z.number().finite().optional(), targetText: text.optional(), evaluationMethod: text, dueOn: date }).strict().refine((item) => (item.targetNumeric !== undefined) !== (item.targetText !== undefined), "Cần đúng một giá trị mục tiêu.");

export const personalizationSchemas = {
  consent: z.object({ purpose: z.enum(["assessment", "nutrition_tracking"]), policyVersion: z.literal("training-privacy-v1"), acknowledged: z.literal(true) }).strict(),
  assessment: z.object({ discipline, goal: text, availableDays: z.array(z.number().int().min(0).max(6)).min(1).max(7), minutesPerSession: z.number().int().min(1).max(1440), experience: z.enum(["new", "returning", "experienced"]), equipment: z.array(short).max(20), otherActivity: z.string().max(1000), population: population.optional(), screeningStatus: z.enum(["unknown", "follow_up", "referred", "reviewed_for_scope"]), screeningTool: short.optional(), screeningVersion: short.optional(), assessedAt: timestamp, reviewDueAt: timestamp, measurements: z.array(measurement).max(50), findings: z.array(finding).min(1).max(50), goals: z.array(goal).max(20).optional() }).strict(),
  authorization: z.object({ userId: id, discipline, credentialReference: text, expiresAt: timestamp, verificationConfirmed: z.literal(true) }).strict(),
  protocol: z.object({ name: short, discipline: z.enum(["gym", "yoga"]), populationScope: scope, limitations: text, evidence: z.array(z.object({ sourceId: id, sectionReference: text, interpretation: text, applicability: text }).strict()).min(1).max(10), rules: z.array(z.object({ code: z.string().regex(/^[a-z_]+$/).max(100), evidenceIndex: z.number().int().nonnegative(), requiredInputs: z.array(inputKey).min(1).max(30), conditions: z.array(z.object({ input: inputKey, op: z.enum(["eq", "ne", "gte", "lte", "in", "contains"]), value }).strict()).min(1).max(30), recommendation: z.object({ prescriptions: z.array(prescriptionSchema).min(1).max(30) }).strict(), rationale: text }).strict()).min(1).max(30) }).strict(),
  approval: z.object({ authorizationId: id }).strict(),
  decision: z.object({ assessmentId: id, protocolId: id, startsOn: date, endsOn: date, sessionDates: z.array(date).min(1).max(100), idempotencyKey: id }).strict(),
  checkin: z.object({ sessionDate: date, availableMinutes: z.number().int().min(1).max(1440), sleepHours: z.number().finite().min(0).max(24).optional(), fatigueScore: z.number().int().min(0).max(10).optional(), discomfortScore: z.number().int().min(0).max(10).optional(), newSymptoms: z.boolean(), notes: z.string().max(1000), otherActivity: z.string().max(1000) }).strict(),
  checkinReview: z.object({ status: z.enum(["reviewed", "hold"]) }).strict(),
  sessionOutcome: z.object({ status: z.enum(["completed", "skipped"]), coachComment: text }).strict(),
  observation: measurementBase.omit({ conditions: true, device: true, measuredAt: true }).extend({ recordedAt: timestamp }).strict().refine(oneValue, "Cần đúng một giá trị số hoặc mô tả."),
  energy: z.object({ recordedOn: date, energyType: z.enum(["intake", "resting", "total_daily", "exercise"]), valueKcal: z.number().finite().positive(), dataKind: z.enum(["observed", "self_reported"]), method: text, includesExercise: z.boolean() }).strict(),
};

export const personalizationOperations = [
  ["get", "/training-personalization/reference", "training.assessment.read", "reference"],
  ["get", "/members/:id/training-profile", "training.assessment.read", "profile"],
  ["post", "/members/:id/training-assessments", "training.assessment.write", "createAssessment", "assessment"],
  ["post", "/training-assessments/:id/review", "training.assessment.write", "reviewAssessment", "approval"],
  ["post", "/training-review-authorizations", "training.review.authorize", "authorize", "authorization"],
  ["post", "/training-review-authorizations/:id/revoke", "training.review.authorize", "revokeAuthorization"],
  ["post", "/training-protocols", "training.protocol.manage", "createProtocol", "protocol"],
  ["post", "/training-protocols/:id/approve", "training.protocol.manage", "approveProtocol", "approval"],
  ["post", "/training-protocols/:id/retire", "training.protocol.manage", "retireProtocol"],
  ["post", "/training-personalization/decisions", "training.assessment.write", "createDecision", "decision"],
  ["post", "/training-personalization/decisions/:id/approve", "training.assessment.write", "approveDecision", "approval"],
  ["post", "/training-checkins/:id/review", "training.assessment.write", "reviewCheckin", "checkinReview"],
  ["post", "/training-sessions/:id/observations", "training.assessment.write", "observe", "observation"],
  ["post", "/training-sessions/:id/personalization-outcome", "training.assessment.write", "sessionOutcome", "sessionOutcome"],
  ["get", "/members/me/training-personalization", "training.self.read", "mine"],
  ["post", "/members/me/training-consents", "training.self.manage", "consent", "consent"],
  ["post", "/members/me/training-consents/:id/withdraw", "training.self.manage", "withdrawConsent"],
  ["post", "/members/me/training-sessions/:id/check-in", "training.self.manage", "checkin", "checkin"],
  ["post", "/members/me/training-energy", "training.self.manage", "energy", "energy"],
];
