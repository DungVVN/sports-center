import { z } from "zod";
import { Prisma } from "@prisma/client";
import { personalizationOperations, personalizationSchemas } from "../modules/training/index.js";

export function applyTrainingPersonalizationContract(spec) {
  const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
  const array = (item) => ({ type: "array", items: item });
  const object = (properties) => ({ type: "object", required: Object.keys(properties), properties });
  // Generate scalar response fields from the same checked-in Prisma schema used
  // by the repository; retain explicit shapes for its aggregated read models.
  for (const model of Prisma.dmmf.datamodel.models.filter((item) => /^(training_|member_training_)/.test(item.name))) {
    const properties = {};
    for (const field of model.fields.filter((item) => item.kind !== "object")) {
      let scalar =
        field.type === "Json"
          ? {}
          : field.type === "DateTime"
            ? { type: "string", format: "date-time" }
            : ["Int", "Float"].includes(field.type)
              ? { type: "number" }
              : field.type === "Boolean"
                ? { type: "boolean" }
                : { type: "string" };
      if (field.isList) scalar = array(scalar);
      properties[field.name] = field.isRequired ? scalar : { anyOf: [scalar, { type: "null" }] };
    }
    spec.components.schemas[`Training_${model.name}`] = object(properties);
  }
  const extend = (name, properties) => ({ allOf: [ref(`Training_${name}`), object(properties)] });
  spec.components.schemas.TrainingAssessmentDetail = extend("member_training_assessments", {
    measurements: array(ref("Training_member_training_measurements")),
    findings: array(ref("Training_member_training_findings")),
    goals: array(ref("Training_member_training_goals")),
  });
  spec.components.schemas.TrainingProtocolDetail = extend("training_protocol_versions", {
    rules: array(ref("Training_training_protocol_rules")),
    evidence: array(extend("training_protocol_evidence", { source: ref("Training_training_evidence_sources") })),
  });
  spec.components.schemas.TrainingDecisionDetail = extend("training_personalization_decisions", {
    prescriptions: array(ref("Training_training_session_prescriptions")),
    inputs: array(ref("Training_training_decision_inputs")),
    protocol: ref("TrainingProtocolDetail"),
    sessions: array(ref("Training_training_sessions")),
    plan: ref("Training_training_plans"),
  });
  spec.components.schemas.TrainingProfile = object({
    assessments: array(ref("TrainingAssessmentDetail")),
    decisions: array(ref("TrainingDecisionDetail")),
    consents: array(ref("Training_member_training_consents")),
    checkins: array(ref("Training_training_session_checkins")),
    observations: array(ref("Training_training_session_observations")),
    energy: array(ref("Training_member_training_energy_records")),
    limit: { const: 100 },
  });
  const responses = {
    reference: object({
      sources: array(ref("Training_training_evidence_sources")),
      metrics: array(ref("Training_training_metric_definitions")),
      protocols: array(ref("TrainingProtocolDetail")),
      authorizations: array(ref("Training_training_review_authorizations")),
      users: array(
        object({
          id: { type: "string", format: "uuid" },
          display_name: { type: "string" },
          role: { enum: ["coach", "admin"] },
        }),
      ),
      energyModelEnabled: { const: false },
      consentPolicyVersion: { const: "training-privacy-v1" },
    }),
    profile: ref("TrainingProfile"),
    mine: ref("TrainingProfile"),
    createDecision: ref("TrainingDecisionDetail"),
  };
  responses.revokeAuthorization = ref("Training_training_review_authorizations");
  responses.retireProtocol = ref("Training_training_protocol_versions");
  for (const [operation, name] of Object.entries({
    createAssessment: "member_training_assessments",
    reviewAssessment: "member_training_assessments",
    authorize: "training_review_authorizations",
    createProtocol: "training_protocol_versions",
    approveProtocol: "training_protocol_versions",
    approveDecision: "training_personalization_decisions",
    checkin: "training_session_checkins",
    reviewCheckin: "training_session_checkins",
    observe: "training_session_observations",
    sessionOutcome: "training_sessions",
    energy: "member_training_energy_records",
    consent: "member_training_consents",
    withdrawConsent: "member_training_consents",
  }))
    responses[operation] = ref(`Training_${name}`);
  spec.components.securitySchemes.sessionBearer ??= { type: "http", scheme: "bearer" };
  for (const [method, path, permission, operation, body] of personalizationOperations) {
    const key = path.replace(":id", "{id}");
    spec.paths[key] ??= {};
    spec.paths[key][method] = {
      tags: ["Training personalization"],
      operationId: `training_${operation}`,
      summary: operation,
      description: `Requires ${permission}. Server enforces member ownership/Coach assignment and discipline-specific verified authorization for approvals. Facts remain distinguishable from estimates. Sources are evidence references, not guarantees of individual outcomes. Calorie model execution is disabled. Draft prescriptions are not exposed to Members. Lists return at most 100 recent records.`,
      "x-required-permission": permission,
      security: [{ sessionCookie: [] }, { sessionBearer: [] }],
      ...(path.includes(":id")
        ? { parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }] }
        : {}),
      ...(body
        ? {
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: z.toJSONSchema(personalizationSchemas[body], {
                    target: "draft-2020-12",
                    unrepresentable: "any",
                  }),
                },
              },
            },
          }
        : {}),
      responses: Object.fromEntries(
        [200, ...(method === "post" ? [201] : []), 401, 403, 404, 409, 422, 503].map((code) => [
          code,
          {
            description: {
              200: "Operation completed",
              201: "Created, or idempotently reused",
              401: "Authentication required",
              403: "Permission, member scope or professional authorization denied",
              404: "Record unavailable within the actor scope",
              409: "Duplicate request or immutable final state",
              422: "Invalid data, incomplete screening, consent, evidence, rules or protocol scope",
              503: "Database temporarily unavailable",
            }[code],
            content: {
              "application/json": {
                schema:
                  code < 300
                    ? {
                        type: "object",
                        required: ["success", "data"],
                        properties: { success: { const: true }, data: responses[operation] },
                      }
                    : {
                        type: "object",
                        required: ["success", "error"],
                        properties: {
                          success: { const: false },
                          error: {
                            type: "object",
                            required: ["code", "message"],
                            properties: {
                              code: { type: "string" },
                              message: { type: "string" },
                              details: {},
                              requestId: { type: "string" },
                            },
                          },
                        },
                      },
              },
            },
          },
        ]),
      ),
    };
  }
}
