export function hasSessionPermission(session, permission) {
  return session?.user?.role === "admin" || Boolean(session?.permissions?.includes(permission));
}
