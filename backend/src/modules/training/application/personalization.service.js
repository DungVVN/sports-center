import { createPersonalizationContext } from "./personalization-context.js";
import { createProfileOperations } from "./personalization-profile.js";
import { createAssessmentOperations } from "./personalization-assessment.js";
import { createProtocolOperations } from "./personalization-protocol.js";
import { createDecisionOperations } from "./personalization-decision.js";
import { createSessionOperations } from "./personalization-session.js";

export function createPersonalizationService(dependencies) {
  const context = createPersonalizationContext(dependencies);
  return {
    ...createProfileOperations(context),
    ...createAssessmentOperations(context),
    ...createProtocolOperations(context),
    ...createDecisionOperations(context),
    ...createSessionOperations(context),
  };
}
