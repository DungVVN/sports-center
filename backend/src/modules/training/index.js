export { createTrainingService } from "./application/training.service.js";
export { trainingRepository } from "./infrastructure/training.repository.js";
export { createTrainingRouter } from "./presentation/training.routes.js";
export { createPersonalizationService } from "./application/personalization.service.js";
export { personalizationRepository } from "./infrastructure/personalization.repository.js";
export { createPersonalizationRouter } from "./presentation/personalization.routes.js";
export { personalizationOperations, personalizationSchemas } from "./domain/personalization-contract.js";
