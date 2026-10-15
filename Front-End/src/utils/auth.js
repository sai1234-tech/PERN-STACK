export function getAuthToken() {
  return sessionStorage.getItem("hrms_token");
}

export function isAuthenticated() {
  return Boolean(getAuthToken());
}

export function normalizeRole(user, extra = null) {
  let resolvedUser = user;
  if (!resolvedUser && !extra) {
    try {
      const stored = sessionStorage.getItem("hrms_user") || localStorage.getItem("hrms_user");
      if (stored) resolvedUser = JSON.parse(stored);
    } catch (e) {}
  }
  
  const target = resolvedUser || extra || {};
  const email = String(
    target.email || target.user_email || target.user?.email || extra?.email || extra?.user?.email || ""
  ).toLowerCase().trim();
  
  const name = String(
    target.name || target.user_name || target.user?.name || `${target.firstName || ""} ${target.lastName || ""}` ||
    extra?.name || extra?.user?.name || `${extra?.firstName || ""} ${extra?.lastName || ""}`
  ).toLowerCase().trim();

  // 1. Explicit known identities: Vikas Guru is the manager across the organization
  if (
    email === "vikasguru@gmail.com" ||
    email === "gvikas@quadratics.com" ||
    email.includes("vikas") ||
    name.includes("vikas guru") ||
    name.includes("vikas")
  ) {
    return "manager";
  }

  // 2. Check designation and job titles
  const designation = String(
    target.employment?.designation ||
    target.designation ||
    target.jobTitle ||
    extra?.employment?.designation ||
    extra?.designation ||
    extra?.jobTitle ||
    ""
  ).toLowerCase().trim();

  if (designation.includes("hr") || designation.includes("people ops") || designation.includes("human resource")) {
    return "hr";
  }

  if (designation.includes("manager") || designation.includes("team lead") || designation.includes("project manager") || designation.includes("engineering manager")) {
    return "manager";
  }

  // 3. Check explicit role properties
  const rawRole =
    target?.role?.name ||
    target?.role?.key ||
    target?.role ||
    target?.userRole?.name ||
    target?.userRole ||
    target?.user_role ||
    target?.user?.role ||
    extra?.role?.name ||
    extra?.role ||
    extra?.user?.role ||
    target?.permissions?.role?.name ||
    target?.permissions?.role ||
    "employee";
    
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

export function getDefaultDashboard(user, extra = null) {
  const role = normalizeRole(user, extra);
  if (role === "admin") return "/admin/dashboard";
  if (role === "hr") return "/hr/dashboard";
  if (role === "manager") return "/manager/dashboard";
  return "/employee/dashboard";
}

