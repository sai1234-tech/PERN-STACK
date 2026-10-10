export function getAuthToken() {
  return sessionStorage.getItem("hrms_token");
}

export function isAuthenticated() {
  return Boolean(getAuthToken());
}

export function normalizeRole(user) {
  const rawRole = user?.role?.name || user?.role?.key || user?.role || user?.userRole?.name || user?.userRole || user?.permissions?.role?.name || user?.permissions?.role || "employee";
  const role = String(rawRole).trim().toLowerCase();
  if (["admin", "administrator", "system admin"].includes(role)) return "admin";
  if (["hr", "human resources", "hr manager", "hr_manager", "hr-manager", "hr admin", "human resource manager", "people operations"].includes(role)) return "hr";
  if (["manager", "team manager", "project manager", "lead", "team lead"].includes(role)) return "manager";
  return "employee";
}
