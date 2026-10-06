export async function invalidateLoginChallenges(transaction, userId, now = new Date()) {
  await transaction.auth_mfa_enrollments.updateMany({
    where: { user_id: userId, consumed_at: null, expires_at: { gt: now } },
    data: { expires_at: now },
  });
  // Expire consumed challenges too: an in-flight verifier may not have issued its session yet.
  await transaction.auth_mfa_login_challenges.updateMany({
    where: { user_id: userId, expires_at: { gt: now } }, data: { expires_at: now },
  });
  await transaction.account_verifications.updateMany({
    where: { user_id: userId, purpose: "staff_login", expires_at: { gt: now } }, data: { expires_at: now },
  });
}
