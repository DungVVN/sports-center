import { prisma } from "../../database.js";

export const membershipRepository = {
  packages: () => prisma.membership_packages.findMany({ orderBy: { tier_rank: "asc" } }),
  packageById: (id) => prisma.membership_packages.findUnique({ where: { id } }),
  entitlements: (packageId) => prisma.membership_package_entitlements.findMany({ where: { package_id: packageId } }),
  memberExists: (id) => prisma.members.findUnique({ where: { id } }),
  createPackage: (data) => prisma.membership_packages.create({ data }),
  updatePackage: (id, data) => prisma.membership_packages.update({ where: { id }, data }),
  replaceEntitlements: async (packageId, entitlements) => prisma.$transaction(async (tx) => { await tx.membership_package_entitlements.deleteMany({ where: { package_id: packageId } }); if (entitlements.length) await tx.membership_package_entitlements.createMany({ data: entitlements.map((item) => ({ package_id: packageId, entitlement: item.code, usage_limit: item.usageLimit ?? null, limit_period: item.limitPeriod ?? null })) }); }),
  createMembership: (data) => prisma.member_memberships.create({ data }), membership: (id) => prisma.member_memberships.findUnique({ where: { id } }),
  memberships: (memberId) => prisma.member_memberships.findMany({ where: { member_id: memberId }, orderBy: { created_at: "desc" } }),
  createFreeze: (data) => prisma.membership_freeze_requests.create({ data }), freezeRequests: (membershipId) => prisma.membership_freeze_requests.findMany({ where: { membership_id: membershipId }, orderBy: { created_at: "desc" } }), freezeRequest: (id) => prisma.membership_freeze_requests.findUnique({ where: { id } }),
  approveFreeze: (id, reviewer) => prisma.membership_freeze_requests.update({ where: { id }, data: { status: "approved", reviewed_by: reviewer, reviewed_at: new Date() } }), rejectFreeze: (id, reviewer) => prisma.membership_freeze_requests.update({ where: { id }, data: { status: "rejected", reviewed_by: reviewer, reviewed_at: new Date() } }),
  extendForFreeze: (id, expiresOn, days) => prisma.member_memberships.update({ where: { id }, data: { frozen_days: { increment: days }, expires_on: expiresOn } }), cancelPendingRenewal: (id) => prisma.member_memberships.update({ where: { id }, data: { status: "cancelled" } }),
};
