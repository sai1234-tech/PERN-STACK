export function getAuthToken() {
  return sessionStorage.getItem("hrms_token");
}

export function isAuthenticated() {
  return Boolean(getAuthToken());
}

export function normalizeRole(user) {
  const rawRole = user?.role?.name || user?.role?.key || user?.role || user?.userRole?.name || user?.userRole || user?.permissions?.role?.name || user?.permissions?.role || "employee";
  const role = String(rawRole).trim().toLowerCase();
  
  if (["admin", "administrator", "system admin", "superadmin"].includes(role) || role.includes("admin")) {
    return "admin";
  }
  
  if (
    ["hr", "human resources", "hr manager", "hr_manager", "hr-manager", "hr admin", "human resource manager", "people operations", "people ops"].includes(role) ||
    role === "hr" ||
    role.startsWith("hr ") ||
    role.endsWith(" hr") ||
    role.includes("hr ") ||
    role.includes(" hr") ||
    role.includes("human resource") ||
    role.includes("people ops") ||
    role.includes("people operations")
  ) {
    return "hr";
  }

  if (["manager", "team manager", "project manager", "lead", "team lead"].includes(role) || role.includes("manager") || role.includes("lead")) {
    return "manager";
  }

  return "employee";
}
