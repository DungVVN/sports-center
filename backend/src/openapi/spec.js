import { env } from "../config/env.js";
import { applyServiceContract } from "./service-contract.js";
import { applySiteContract } from "./site-contract.js";
import { applyTrainingPersonalizationContract } from "./training-personalization-contract.js";
import { applyOperationsContract } from "./operations-contract.js";
import { uuid, jsonBody } from "./contract-helpers.js";
import { coreSchemas } from "./core-schemas.js";
import { applyFacilityContract } from "./facility-contract.js";
import { applyAccessContract } from "./access-contract.js";
import { applyRequestContract } from "./request-contract.js";
import { facilityAuth, facilityResponse, facilityRecord, facilityReservation, facilityReservationRecord } from "./facility-schemas.js";
import { membershipPaths } from "./membership-paths.js";
import { peoplePaths } from "./people-paths.js";
import { authenticationPaths } from "./authentication-paths.js";
import { workspacePaths } from "./workspace-paths.js";
import { trainingPaths } from "./training-paths.js";
import { paymentsPaths } from "./payments-paths.js";
import { classesAttendancePaths } from "./classes-attendance-paths.js";

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Sports Center API",
    version: "0.3.0",
    description:
      "Hệ thống quản lý dịch vụ và vận hành trung tâm thể thao: gói hội viên, khóa có hướng dẫn, huấn luyện cá nhân và đặt sân/phòng. Khóa học, PT và đặt sân/phòng không yêu cầu mua membership; mỗi dịch vụ có quy tắc sử dụng riêng. Admin receives every permission code; identity-bound Member/Coach endpoints still enforce their own role scope. A temporary-password account must change password before normal API access.",
  },
  servers: [{ url: env.apiBasePath }],
  paths: {
    ...membershipPaths,
    ...peoplePaths,
    ...authenticationPaths,
    ...workspacePaths,
    ...trainingPaths,
    ...paymentsPaths,
    ...classesAttendancePaths,
  },
  components: {
    securitySchemes: { sessionCookie: { type: "apiKey", in: "cookie", name: "sports_center_session" } },
    schemas: coreSchemas,
  },
};

applyFacilityContract(openApiSpec);
applyAccessContract(openApiSpec);
applyRequestContract(openApiSpec);

applySiteContract(openApiSpec);
applyTrainingPersonalizationContract(openApiSpec);

applyServiceContract(openApiSpec, {
  uuid,
  jsonBody,
  facilityAuth,
  facilityResponse,
  facilityRecord,
  facilityReservation,
  facilityReservationRecord,
});

applyOperationsContract(openApiSpec);

for (const [path, operations] of Object.entries(openApiSpec.paths)) {
  const names = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
  for (const method of ["get", "post", "patch", "put", "delete"]) {
    const operation = operations[method];
    if (!operation) continue;
    const parameters = operation.parameters ?? [];
    for (const name of names) {
      if (!parameters.some((parameter) => parameter.in === "path" && parameter.name === name)) {
        parameters.push({
          name,
          in: "path",
          required: true,
          schema:
            name === "role" ? { type: "string", enum: ["admin", "manager", "receptionist", "coach", "member"] } : uuid,
        });
      }
    }
    if (parameters.length) operation.parameters = parameters;
  }
}
