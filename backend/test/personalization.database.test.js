import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createDatabaseClient } from "../src/database.js";
import { withRuntime } from "../src/shared/runtime/request-context.js";
import { createPersonalizationService, personalizationRepository, trainingRepository } from "../src/modules/training/index.js";
import { createApp } from "../src/app.js";

const configuredUrl = process.env.TRAINING_FOUNDATION_TEST_DATABASE_URL;
describe.skipIf(!configuredUrl)("personalization actual HTTP/service/Prisma/PostgreSQL integration", () => {
  it("creates Gym and Yoga schedules using recorded facts, publishes only after review, and records check-in/outcomes with rollback", async () => {
    const target = new URL(configuredUrl);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) || !/training_(test|verify)/.test(target.pathname)) throw new Error("Only explicitly configured local training verification databases are allowed.");
    const client = createDatabaseClient(configuredUrl);
    const rollback = new Error("ROLLBACK_ISOLATED_TRAINING_FIXTURES");
    try {
      await expect(client.$transaction(async (tx) => {
        const database = new Proxy(tx, { get: (obj, key) => key === "$transaction" ? (operation) => operation(database) : typeof obj[key] === "function" ? obj[key].bind(obj) : obj[key] });
        await withRuntime({ database }, async () => {
          const admin = await tx.users.create({ data: { email: `${randomUUID()}@example.invalid`, password_hash: "NOT_A_LOGIN_HASH", display_name: "ISOLATED TEST ONLY", role: "admin", status: "active" } });
          const memberUser = await tx.users.create({ data: { email: `${randomUUID()}@example.invalid`, password_hash: "NOT_A_LOGIN_HASH", display_name: "ISOLATED TEST ONLY", role: "member", status: "active" } });
          const member = await tx.members.create({ data: { member_code: `TEST-${randomUUID()}`, full_name: "ISOLATED TEST ONLY", phone: randomUUID(), user_id: memberUser.id } });
          const actor = { id: admin.id, role: "admin" };
          const self = { id: memberUser.id, role: "member" };
          const service = createPersonalizationService({ repository: personalizationRepository, directory: trainingRepository, auditService: { record: async () => {} } });
          const app = express();
          app.use((_req, _res, next) => withRuntime({ database }, next));
          app.use(createApp({ personalizationService: service, authService: { getAuthentication: async (token) => ({ user: token === "member-fixture" ? self : actor, permissions: ["training.self.read", "training.self.manage"] }) } }));
          const post = async (path, body, token = "admin-fixture", status = 201) => {
            const response = await request(app).post(`/api/v1${path}`).set("Authorization", `Bearer ${token}`).send(body);
            expect(response.body.error, `${path} HTTP ${response.status}`).toBeUndefined();
            expect(response.status, path).toBe(status); return response.body.data;
          };
          await post("/members/me/training-consents", { purpose: "assessment", policyVersion: "training-privacy-v1", acknowledged: true }, "member-fixture");
          const today = new Date().toISOString().slice(0, 10);
          const nextDay = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
          const secondDay = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
          const ref = await service.reference(actor);
          for (const discipline of ["gym", "yoga"]) {
            const authority = await post("/training-review-authorizations", { userId: admin.id, discipline, credentialReference: "ISOLATED TEST ONLY, not an actual qualification", expiresAt: new Date(Date.now() + 60 * 86400000).toISOString(), verificationConfirmed: true });
            const assessment = await post(`/members/${member.id}/training-assessments`, { discipline, goal: "Isolated fixture", availableDays: [0, 1, 2, 3, 4, 5, 6], minutesPerSession: 30, experience: "new", equipment: [], otherActivity: "Recorded", population: { age_years: 31, pregnant: false, breastfeeding: false, clinical_restrictions: false }, screeningStatus: "reviewed_for_scope", screeningTool: "ISOLATED TOOL", screeningVersion: "test-v1", assessedAt: new Date(Date.now() - 120000).toISOString(), reviewDueAt: new Date(Date.now() + 30 * 86400000).toISOString(), measurements: discipline === "gym" ? [{ metricCode: "load", unit: "kg", valueNumeric: 6, dataKind: "observed", method: "Fixture recorded measurement", conditions: "Fixture", measuredAt: new Date(Date.now() - 120000).toISOString() }] : [], findings: [{ code: "movement_review", category: "movement", description: "Recorded fixture", outcome: "observed" }], ...(discipline === "gym" ? { goals: [{ metricCode: "load", unit: "kg", baselineMeasurementIndex: 0, targetNumeric: 8, evaluationMethod: "Fixture repeat measurement", dueOn: nextDay }] } : {}) });
            await post(`/training-assessments/${assessment.id}/review`, { authorizationId: authority.id }, "admin-fixture", 200);
            const prescription = { discipline, name: "Fixture only", variant: "Fixture", instructions: "Fixture", progression_criteria: "Review before change", ...(discipline === "gym" ? { sets: 2, reps: 8, load_kg: { input: "measurement.load" } } : { hold_seconds: 10, breath_cycles: 3, props: ["block"] }) };
            const source = ref.sources.find((item) => item.code === (discipline === "gym" ? "ACSM_RESISTANCE" : "NCCIH_YOGA_SAFETY"));
            const protocol = await post("/training-protocols", { name: "ISOLATED TEST, NOT OPERATIVE GUIDELINE", discipline, populationScope: { minimum_age_years: 18, pregnancy_allowed: false, breastfeeding_allowed: false, clinical_restrictions_allowed: false }, limitations: "Fixture only", evidence: [{ sourceId: source.id, sectionReference: "Test only", interpretation: "Test only", applicability: "Test only" }], rules: [{ code: "fixture", evidenceIndex: 0, requiredInputs: ["assessment.minutes_per_session", ...(discipline === "gym" ? ["measurement.load"] : [])], conditions: [{ input: "assessment.minutes_per_session", op: "gte", value: 30 }], recommendation: { prescriptions: [prescription] }, rationale: "Fixture only" }] });
            await post(`/training-protocols/${protocol.id}/approve`, { authorizationId: authority.id }, "admin-fixture", 200);
            const body = { assessmentId: assessment.id, protocolId: protocol.id, startsOn: nextDay, endsOn: secondDay, sessionDates: [nextDay, secondDay], idempotencyKey: randomUUID() };
            const decision = await post("/training-personalization/decisions", body);
            expect((await service.mine(self)).decisions.find((item) => item.id === decision.id)).toBeUndefined();
            expect((await post("/training-personalization/decisions", body)).id).toBe(decision.id);
            await post(`/training-personalization/decisions/${decision.id}/approve`, { authorizationId: authority.id }, "admin-fixture", 200);
            const visible = (await service.mine(self)).decisions.find((item) => item.id === decision.id);
            expect(visible.prescriptions[0].discipline).toBe(discipline);
            if (discipline === "gym") expect(Number(visible.prescriptions[0].load_kg)).toBe(6);
            const sessionId = visible.prescriptions[0].training_session_id;
            const checkin = await post(`/members/me/training-sessions/${sessionId}/check-in`, { sessionDate: today, availableMinutes: 25, newSymptoms: true, notes: "Fixture symptom", otherActivity: "Recorded" }, "member-fixture");
            await expect(service.reviewCheckin(checkin.id, { status: "reviewed" }, actor)).rejects.toMatchObject({ code: "TRAINING_SYMPTOMS_REQUIRE_FOLLOW_UP" });
            await post(`/training-checkins/${checkin.id}/review`, { status: "hold" }, "admin-fixture", 200);
            const observation = await post(`/training-sessions/${sessionId}/observations`, { metricCode: "session_duration", unit: "minutes", valueNumeric: 25, dataKind: "observed", method: "Fixture timing", recordedAt: new Date().toISOString() });
            expect(Number(observation.value_numeric)).toBe(25);
            await expect(service.sessionOutcome(sessionId, { status: "completed", coachComment: "Fixture" }, actor)).rejects.toMatchObject({ code: "TRAINING_CHECKIN_REVIEW_REQUIRED" });
            const routineSessionId = visible.sessions[1].id;
            const routine = await post(`/members/me/training-sessions/${routineSessionId}/check-in`, { sessionDate: today, availableMinutes: 25, newSymptoms: false, notes: "New fixture review", otherActivity: "Recorded" }, "member-fixture");
            await post(`/training-checkins/${routine.id}/review`, { status: "reviewed" }, "admin-fixture", 200);
            await post(`/training-sessions/${routineSessionId}/personalization-outcome`, { status: "completed", coachComment: "Fixture reviewed session" });
            await post(`/training-protocols/${protocol.id}/retire`, {}, "admin-fixture", 200);
            await expect(service.checkin(sessionId, { sessionDate: today }, self)).rejects.toMatchObject({ code: "TRAINING_PLAN_REVIEW_EXPIRED" });
            await post(`/training-review-authorizations/${authority.id}/revoke`, {}, "admin-fixture", 200);
          }
          await post("/members/me/training-consents", { purpose: "nutrition_tracking", policyVersion: "training-privacy-v1", acknowledged: true }, "member-fixture");
          await post("/members/me/training-energy", { recordedOn: today, energyType: "intake", valueKcal: 1800, dataKind: "self_reported", method: "Fixture diary", includesExercise: false }, "member-fixture");
          expect((await service.mine(self)).decisions).toHaveLength(2);
          expect((await service.mine(self)).energy).toHaveLength(1);
          expect((await service.mine(self)).assessments.flatMap((item) => item.goals)).toHaveLength(1);
        });
        throw rollback;
      }, { timeout: 30000 })).rejects.toBe(rollback);
    } finally { await client.$disconnect(); }
  }, 45000);
});
