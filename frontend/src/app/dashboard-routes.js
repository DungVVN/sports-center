const routes = {
  dashboard: "/dashboard",
  profile: "/profile",
  rolePermissions: "/admin/permissions",
  sitePages: "/admin/site/pages",
  siteMenu: "/admin/site/menu",
  members: "/members",
  registrations: "/registrations",
  packages: "/packages",
  packageCreate: "/packages/create",
  packageCatalog: "/packages/catalog",
  memberMemberships: "/memberships/assign",
  classes: "/classes",
  bookings: "/bookings",
  "facility-calendar": "/facilities",
  attendance: "/attendance",
  payments: "/payments",
  staff: "/staff",
  training: "/training",
  reports: "/reports",
  audit: "/audit-logs",
  support: "/support",
  "my-memberships": "/my/memberships",
  "my-attendance": "/my/attendance",
  "my-training": "/my/training",
  "my-payments": "/my/payments",
};

const viewsByPath = new Map(Object.entries(routes).map(([view, path]) => [path, view]));

export function dashboardPath(view) {
  return routes[view] ?? routes.dashboard;
}

export function dashboardView(pathname) {
  return viewsByPath.get(pathname) ?? null;
}

export function isDashboardView(view) {
  return Object.hasOwn(routes, view);
}
