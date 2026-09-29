export function isolatedQaPassword() {
  const password = process.env.E2E_QA_PASSWORD;
  if (!password) throw new Error("E2E_QA_PASSWORD is required for the isolated QA stack.");
  return password;
}
