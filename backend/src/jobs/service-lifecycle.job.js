import { expireCourseHolds } from "../modules/courses/index.js";

export async function runServiceLifecycleJob(now = new Date()) {
  return { expiredCourseHolds: await expireCourseHolds(now) };
}
