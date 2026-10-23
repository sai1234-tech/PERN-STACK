export function getAuthToken() {
  return sessionStorage.getItem("hrms_token");
}

export function isAuthenticated() {
  return Boolean(getAuthToken());
}

/**
 * Enterprise 10 User Roles Specification
 */
export const ENTERPRISE_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  HR_ADMIN: "hr_admin",
  HR_OPERATIONS: "hr_operations",
  HR_MANAGER: "hr_manager",
  HR: "hr",
  RECRUITER: "recruiter",
  HIRING_MANAGER: "hiring_manager",
  MANAGER: "manager",
  PAYROLL: "payroll",
  IT_ADMIN: "it_admin",
  EMPLOYEE: "employee",
  LEADERSHIP: "leadership",
  AUDITOR: "auditor",
};

/**
 * Normalizes raw user, employee or payload role into standard role key.
 */
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

  // 1. Explicit email identity checks
  if (email === "superadmin@hrms.com" || email.includes("superadmin")) {
    return "super_admin";
  }
  if (email === "hradmin@hrms.com") {
    return "hr_admin";
  }
  if (email === "recruiter@hrms.com" || email.includes("recruiter")) {
    return "recruiter";
  }
  if (email === "payroll@hrms.com" || email.includes("payroll")) {
    return "payroll";
  }
  if (email === "itadmin@hrms.com" || email.includes("itadmin")) {
    return "it_admin";
  }
  if (email === "leadership@hrms.com" || email.includes("leadership")) {
    return "leadership";
  }
  if (email === "auditor@hrms.com" || email.includes("auditor")) {
    return "auditor";
  }
  if (
    email === "vikasguru@gmail.com" ||
    email === "gvikas@quadratics.com" ||
    email.includes("vikas") ||
    name.includes("vikas guru") ||
    name.includes("vikas")
  ) {
    return "manager";
  }

  // 2. Check explicit role properties
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
    "";
    
  const role = String(rawRole).trim().toLowerCase().replace(/[-\s]+/g, "_");
  
  if (role === "super_admin" || role === "superadmin") return "super_admin";
  if (role === "admin" || role === "administrator" || role === "system_admin") return "admin";
  if (role === "hr_admin") return "hr_admin";
  if (role === "hr_operations" || role === "hr_ops") return "hr_operations";
  if (role === "hr_manager") return "hr_manager";
  if (role === "recruiter" || role === "talent_acquisition") return "recruiter";
  if (role === "payroll" || role === "finance") return "payroll";
  if (role === "it_admin" || role === "it") return "it_admin";
  if (role === "leadership" || role === "executive") return "leadership";
  if (role === "auditor") return "auditor";
  if (role === "hiring_manager") return "hiring_manager";
  if (role === "manager" || role === "team_lead" || role === "project_manager") return "manager";
  if (role === "hr" || role.startsWith("hr_") || role.includes("human_resource")) return "hr";

  // 3. Check designation and job titles fallback
  const designation = String(
    target.employment?.designation ||
    target.designation ||
    target.jobTitle ||
    extra?.employment?.designation ||
    extra?.designation ||
    extra?.jobTitle ||
    ""
  ).toLowerCase().trim();

  if (designation.includes("super admin") || designation.includes("chief executive")) return "super_admin";
  if (designation.includes("auditor") || designation.includes("audit")) return "auditor";
  if (designation.includes("recruiter") || designation.includes("talent acquisition")) return "recruiter";
  if (designation.includes("payroll") || designation.includes("compensation")) return "payroll";
  if (designation.includes("it admin") || designation.includes("infrastructure")) return "it_admin";
  if (designation.includes("vp") || designation.includes("director") || designation.includes("leadership")) return "leadership";
  if (designation.includes("hr") || designation.includes("people ops") || designation.includes("human resource")) return "hr";
  if (designation.includes("manager") || designation.includes("team lead") || designation.includes("project manager") || designation.includes("engineering manager")) return "manager";

  return "employee";
}

/**
 * Returns human-friendly presentation title for any role
 */
export function getRoleDisplayTitle(role = "employee") {
  const r = String(role).toLowerCase();
  switch (r) {
    case "super_admin":
      return "Super Administrator";
    case "admin":
      return "System Administrator";
    case "hr_admin":
      return "HR Admin / HR Operations";
    case "hr_operations":
      return "HR Operations";
    case "hr_manager":
      return "HR Manager";
    case "hr":
      return "HR Lead";
    case "recruiter":
    case "talent_acquisition":
      return "Recruiter / TA";
    case "hiring_manager":
      return "Hiring Manager";
    case "manager":
      return "Team Manager";
    case "payroll":
    case "finance":
      return "Payroll / Finance";
    case "it_admin":
    case "it":
      return "IT / Admin";
    case "leadership":
    case "executive":
      return "Leadership Executive";
    case "auditor":
      return "Compliance Auditor";
    case "employee":
    default:
      return "Employee";
  }
}

/**
 * Verifies if userRole has authorization for allowedRoles set
 */
export function hasRoleAccess(userRole = "employee", allowedRoles = []) {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  const r = String(userRole).toLowerCase();

  // 1. Super Admin and Admin have master access
  if (r === "super_admin" || r === "admin") return true;

  // 2. Exact match
  if (allowedRoles.includes(r)) return true;

  // 3. HR family matching
  if (["hr_admin", "hr_operations", "hr_manager", "hr"].includes(r) && allowedRoles.includes("hr")) {
    return true;
  }

  // 4. Manager family matching
  if (["hiring_manager", "manager"].includes(r) && allowedRoles.includes("manager")) {
    return true;
  }

  // 5. Recruiter matching
  if (["recruiter", "talent_acquisition"].includes(r) && (allowedRoles.includes("recruiter") || allowedRoles.includes("hr"))) {
    return true;
  }

  // 6. Payroll matching
  if (["payroll", "finance"].includes(r) && (allowedRoles.includes("payroll") || allowedRoles.includes("hr"))) {
    return true;
  }

  // 7. IT Admin matching
  if (["it_admin", "it"].includes(r) && (allowedRoles.includes("it_admin") || allowedRoles.includes("admin"))) {
    return true;
  }

  // 8. Leadership matching
  if (["leadership", "executive"].includes(r) && (allowedRoles.includes("leadership") || allowedRoles.includes("admin") || allowedRoles.includes("manager"))) {
    return true;
  }

  // 9. Auditor matching
  if (r === "auditor" && (allowedRoles.includes("auditor") || allowedRoles.includes("admin") || allowedRoles.includes("hr"))) {
    return true;
  }

  // 10. Employee self-service open to all
  if (allowedRoles.includes("employee")) return true;

  return false;
}

export function getDefaultDashboard(user, extra = null) {
  const role = normalizeRole(user, extra);
  if (role === "super_admin" || role === "admin") return "/admin/dashboard";
  if (role === "hr" || role === "hr_admin" || role === "hr_operations" || role === "hr_manager") return "/hr/dashboard";
  if (role === "recruiter" || role === "talent_acquisition") return "/hr/recruitment";
  if (role === "payroll" || role === "finance") return "/hr/payroll";
  if (role === "it_admin" || role === "it") return "/admin/accounts";
  if (role === "manager" || role === "hiring_manager") return "/manager/dashboard";
  if (role === "leadership" || role === "executive") return "/admin/dashboard";
  if (role === "auditor") return "/admin/dashboard";
  return "/employee/dashboard";
}
