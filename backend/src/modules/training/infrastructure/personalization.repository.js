import { prisma } from "../../../database.js";

async function detailAssessment(row) {
  if (!row) return null;
  const [measurements, findings, goals] = await Promise.all([
    prisma.member_training_measurements.findMany({ where: { assessment_id: row.id }, orderBy: [{ measured_at: "desc" }, { created_at: "desc" }] }),
    prisma.member_training_findings.findMany({ where: { assessment_id: row.id }, orderBy: { created_at: "desc" } }),
    prisma.member_training_goals.findMany({ where: { assessment_id: row.id } }),
  ]);
  return { ...row, measurements, findings, goals };
}

async function detailProtocol(row) {
  if (!row) return null;
  const [rules, evidence] = await Promise.all([
    prisma.training_protocol_rules.findMany({ where: { protocol_id: row.id }, orderBy: { code: "asc" } }),
    prisma.training_protocol_evidence.findMany({ where: { protocol_id: row.id } }),
  ]);
  const sources = await prisma.training_evidence_sources.findMany({ where: { id: { in: evidence.map((item) => item.source_id) } } });
  return { ...row, rules, evidence: evidence.map((item) => ({ ...item, source: sources.find((source) => source.id === item.source_id) })) };
}

async function detailDecision(row) {
  if (!row) return null;
  const [prescriptions, inputs, protocol, sessions, plan] = await Promise.all([
    prisma.training_session_prescriptions.findMany({ where: { decision_id: row.id }, orderBy: { position: "asc" } }),
    prisma.training_decision_inputs.findMany({ where: { decision_id: row.id } }),
    detailProtocol(await prisma.training_protocol_versions.findUnique({ where: { id: row.protocol_id } })),
    prisma.training_sessions.findMany({ where: { plan_id: row.plan_id }, orderBy: { position: "asc" } }),
    prisma.training_plans.findUnique({ where: { id: row.plan_id } }),
  ]);
  return { ...row, prescriptions, inputs, protocol, sessions, plan };
}

export const personalizationRepository = {
  sources: () => prisma.training_evidence_sources.findMany({ orderBy: { publisher: "asc" } }),
  metrics: () => prisma.training_metric_definitions.findMany({ orderBy: { name: "asc" } }),
  usersForAuthorization: () => prisma.users.findMany({ where: { status: "active", role: { in: ["admin", "coach"] } }, select: { id: true, display_name: true, role: true } }),
  authorizations: (userId) => prisma.training_review_authorizations.findMany({ where: userId ? { user_id: userId } : {}, orderBy: { verified_at: "desc" }, take: 100 }),
  authorization: async (id) => {
    const row = await prisma.training_review_authorizations.findUnique({ where: { id } });
    if (!row) return null;
    const user = await prisma.users.findUnique({ where: { id: row.user_id }, select: { status: true } });
    return { ...row, user_status: user?.status };
  },
  createAuthorization: (data) => prisma.training_review_authorizations.create({ data }),
  revokeAuthorization: (id) => prisma.training_review_authorizations.update({ where: { id }, data: { revoked_at: new Date() } }),
  protocols: async () => Promise.all((await prisma.training_protocol_versions.findMany({ orderBy: { created_at: "desc" }, take: 100 })).map(detailProtocol)),
  protocol: async (id) => detailProtocol(await prisma.training_protocol_versions.findUnique({ where: { id } })),
  approveProtocol: (id, authorizationId) => prisma.training_protocol_versions.update({ where: { id }, data: { status: "approved", review_authorization_id: authorizationId, approved_at: new Date() } }),
  retireProtocol: (id) => prisma.training_protocol_versions.update({ where: { id }, data: { status: "retired" } }),
  createProtocol: (data, evidence, rules) => prisma.$transaction(async (tx) => {
    const protocol = await tx.training_protocol_versions.create({ data });
    const refs = [];
    for (const item of evidence) refs.push(await tx.training_protocol_evidence.create({ data: { protocol_id: protocol.id, ...item } }));
    for (const item of rules) {
      const { evidenceIndex, ...fields } = item;
      await tx.training_protocol_rules.create({ data: { ...fields, protocol_id: protocol.id, evidence_id: refs[evidenceIndex].id } });
    }
    return protocol;
  }),
  activeConsent: (memberId, purpose) => prisma.member_training_consents.findFirst({ where: { member_id: memberId, purpose, withdrawn_at: null } }),
  consent: (id) => prisma.member_training_consents.findUnique({ where: { id } }),
  grantConsent: (data) => prisma.member_training_consents.create({ data }),
  withdrawConsent: (id) => prisma.member_training_consents.update({ where: { id }, data: { withdrawn_at: new Date() } }),
  assessment: async (id) => detailAssessment(await prisma.member_training_assessments.findUnique({ where: { id } })),
  nextAssessmentVersion: async (memberId, discipline) => ((await prisma.member_training_assessments.aggregate({ where: { member_id: memberId, discipline }, _max: { version: true } }))._max.version ?? 0) + 1,
  createAssessment: (data, measurements, findings, goals = []) => prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM members WHERE id=${data.member_id}::uuid FOR UPDATE`;
    const previous = await tx.member_training_assessments.aggregate({ where: { member_id: data.member_id, discipline: data.discipline }, _max: { version: true } });
    const assessment = await tx.member_training_assessments.create({ data: { ...data, version: (previous._max.version ?? 0) + 1 } });
    const recordedMeasurements = [];
    for (const item of measurements) recordedMeasurements.push(await tx.member_training_measurements.create({ data: { ...item, assessment_id: assessment.id } }));
    await tx.member_training_findings.createMany({ data: findings.map((item) => ({ ...item, assessment_id: assessment.id })) });
    for (const { baselineIndex, ...item } of goals) await tx.member_training_goals.create({ data: { ...item, assessment_id: assessment.id, baseline_measurement_id: recordedMeasurements[baselineIndex].id } });
    return assessment;
  }),
  reviewAssessment: (id, authorizationId) => prisma.member_training_assessments.update({ where: { id }, data: { status: "reviewed", reviewed_at: new Date(), review_authorization_id: authorizationId } }),
  decision: async (id) => detailDecision(await prisma.training_personalization_decisions.findUnique({ where: { id } })),
  decisionByKey: (key) => prisma.training_personalization_decisions.findUnique({ where: { idempotency_key: key } }),
  approvedDecisionForPlan: (planId) => prisma.training_personalization_decisions.findFirst({ where: { plan_id: planId, status: "approved" } }),
  createDecision: (data, inputs, rules, prescriptions, schedule) => prisma.$transaction(async (tx) => {
    const plan = await tx.training_plans.create({ data: { member_id: data.member_id, coach_user_id: data.created_by, name: schedule.name, goal: schedule.goal, starts_on: schedule.startsOn, ends_on: schedule.endsOn, status: "draft" } });
    const decision = await tx.training_personalization_decisions.create({ data: { ...data, plan_id: plan.id } });
    for (const item of inputs) await tx.training_decision_inputs.create({ data: { decision_id: decision.id, ...item } });
    for (const rule of rules) await tx.training_decision_rules.create({ data: { decision_id: decision.id, rule_id: rule.id, evaluation: { matched: true, evaluator: "recorded-facts-v1" } } });
    for (const [sessionIndex, scheduledOn] of schedule.sessionDates.entries()) {
      const session = await tx.training_sessions.create({ data: { plan_id: plan.id, position: sessionIndex + 1, title: schedule.name, scheduled_on: scheduledOn } });
      for (const [index, item] of prescriptions.entries()) await tx.training_session_prescriptions.create({ data: { ...item, decision_id: decision.id, training_session_id: session.id, position: sessionIndex * prescriptions.length + index + 1 } });
    }
    return decision;
  }),
  approveDecision: (id, planId, authorizationId) => prisma.$transaction(async (tx) => {
    const decision = await tx.training_personalization_decisions.update({ where: { id }, data: { status: "approved", approved_at: new Date(), review_authorization_id: authorizationId } });
    await tx.training_plans.update({ where: { id: planId }, data: { status: "active", coach_approved_at: new Date() } });
    return decision;
  }),
  session: async (id) => {
    const session = await prisma.training_sessions.findUnique({ where: { id } });
    return session ? { ...session, plan: await prisma.training_plans.findUnique({ where: { id: session.plan_id } }) } : null;
  },
  checkin: (id) => prisma.training_session_checkins.findUnique({ where: { id } }),
  disciplineForPlan: async (planId) => {
    const decision = await prisma.training_personalization_decisions.findFirst({ where: { plan_id: planId, status: "approved" } });
    return decision ? (await prisma.training_protocol_versions.findUnique({ where: { id: decision.protocol_id } }))?.discipline : null;
  },
  createCheckin: (data) => prisma.training_session_checkins.create({ data }),
  reviewCheckin: (id, data) => prisma.training_session_checkins.update({ where: { id }, data }),
  latestCheckin: (sessionId) => prisma.training_session_checkins.findFirst({ where: { training_session_id: sessionId }, orderBy: { created_at: "desc" } }),
  sessionOutcome: (id, data) => prisma.training_sessions.update({ where: { id }, data }),
  createObservation: (data) => prisma.training_session_observations.create({ data }),
  createEnergy: (data) => prisma.member_training_energy_records.create({ data }),
  profile: async (memberId, { self = false } = {}) => {
    const [assessments, decisions, consents, checkins, observations, energy] = await Promise.all([
      prisma.member_training_assessments.findMany({ where: { member_id: memberId }, orderBy: { assessed_at: "desc" }, take: 100 }),
      prisma.training_personalization_decisions.findMany({ where: { member_id: memberId, ...(self ? { status: "approved" } : {}) }, orderBy: { created_at: "desc" }, take: 100 }),
      prisma.member_training_consents.findMany({ where: { member_id: memberId }, orderBy: { granted_at: "desc" }, take: 100 }),
      prisma.training_session_checkins.findMany({ where: { member_id: memberId }, orderBy: { created_at: "desc" }, take: 100 }),
      prisma.training_session_observations.findMany({ where: { member_id: memberId }, orderBy: { recorded_at: "desc" }, take: 100 }),
      prisma.member_training_energy_records.findMany({ where: { member_id: memberId }, orderBy: { recorded_on: "desc" }, take: 100 }),
    ]);
    return { assessments: await Promise.all(assessments.map(detailAssessment)), decisions: await Promise.all(decisions.map(detailDecision)), consents, checkins, observations, energy, limit: 100 };
  },
};
