/**
 * Enterprise Role-Based Access Control (RBAC) Engine
 * Implements the 10 User Roles & Permission Matrices specified:
 * 1. Super Admin        - Configuration, masters, roles, workflows, audit
 * 2. HR Admin / HR Ops  - Employee lifecycle, onboarding, documents, leave, attendance, tickets
 * 3. HR Manager         - Approvals, escalations, dashboards
 * 4. Recruiter / TA     - Requisitions, candidates, interviews, offers
 * 5. Hiring/Reporting Mgr - Requisition, candidate feedback, leave, attendance, onboarding, performance
 * 6. Payroll / Finance  - Restricted payroll and compensation data
 * 7. IT / Admin         - Provisioning and assets with minimum necessary employee data
 * 8. Employee           - Self-service profile, leave, attendance, documents, tickets, performance
 * 9. Leadership         - Controlled dashboards/reports
 * 10. Auditor           - Read-only approved records and audit trails
 */

export const STANDARD_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  HR_ADMIN: "hr_admin",
  HR_OPERATIONS: "hr_operations",
  HR_MANAGER: "hr_manager",
  HR: "hr", // Legacy alias
  RECRUITER: "recruiter",
  TALENT_ACQUISITION: "talent_acquisition",
  HIRING_MANAGER: "hiring_manager",
  MANAGER: "manager", // Legacy alias
  PAYROLL: "payroll",
  FINANCE: "finance",
  IT_ADMIN: "it_admin",
  IT: "it",
  EMPLOYEE: "employee",
  LEADERSHIP: "leadership",
  EXECUTIVE: "executive",
  AUDITOR: "auditor",
};

/**
 * Normalizes any role string into standardized snake_case format.
 */
export const normalizeRole = (rawRole = "") => {
  const r = String(rawRole).trim().toLowerCase().replace(/[-\s]+/g, "_");
  if (r === "superadmin") return "super_admin";
  if (r === "hr_lead" || r === "human_resources") return "hr";
  if (r === "team_manager" || r === "team_lead") return "manager";
  if (r === "it_administrator") return "it_admin";
  return r || "employee";
};

/**
 * Maps each role to the effective permission sets / roles it satisfies.
 */
const ROLE_CAPABILITY_MAP = {
  super_admin: ["*"], // Universal master access
  admin: [
    "admin",
    "super_admin",
    "hr",
    "hr_admin",
    "hr_operations",
    "hr_manager",
    "manager",
    "hiring_manager",
    "recruiter",
    "talent_acquisition",
    "payroll",
    "finance",
    "it_admin",
    "it",
    "leadership",
    "executive",
    "auditor",
    "employee",
  ],
  hr_admin: ["hr", "hr_admin", "hr_operations", "hr_manager", "recruiter", "employee"],
  hr_operations: ["hr", "hr_admin", "hr_operations", "employee"],
  hr_manager: ["hr", "hr_admin", "hr_manager", "manager", "hiring_manager", "recruiter", "employee"],
  hr: ["hr", "hr_admin", "hr_operations", "hr_manager", "recruiter", "employee"], // legacy
  recruiter: ["recruiter", "talent_acquisition", "employee"],
  talent_acquisition: ["recruiter", "talent_acquisition", "employee"],
  hiring_manager: ["manager", "hiring_manager", "employee"],
  manager: ["manager", "hiring_manager", "employee"], // legacy
  payroll: ["payroll", "finance", "employee"],
  finance: ["payroll", "finance", "employee"],
  it_admin: ["it_admin", "it", "admin", "employee"],
  it: ["it_admin", "it", "employee"],
  leadership: ["leadership", "executive", "auditor", "employee"],
  executive: ["leadership", "executive", "auditor", "employee"],
  auditor: ["auditor", "employee"],
  employee: ["employee"],
};

/**
 * Middleware factory that enforces role-based access.
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. No user token present.",
      });
    }

    const userRole = normalizeRole(req.user.role);

    // 1. Super Admin bypasses all checks
    if (userRole === "super_admin") {
      return next();
    }

    // 2. Auditor Enforcement: Strictly READ-ONLY
    if (userRole === "auditor") {
      if (req.method !== "GET") {
        return res.status(403).json({
          success: false,
          message: "Access Denied: Auditor role is restricted to read-only inspection.",
        });
      }
      // Allow Auditor to read audit logs, reports, leaves, attendance, documents
      const isAuditorAllowedEndpoint =
        req.baseUrl.includes("/audit") ||
        req.baseUrl.includes("/payroll") ||
        req.baseUrl.includes("/leave") ||
        req.baseUrl.includes("/attendance") ||
        req.baseUrl.includes("/document") ||
        allowedRoles.includes("auditor");
      if (isAuditorAllowedEndpoint) {
        return next();
      }
    }

    // 3. Normalized allowed roles
    const normalizedAllowed = allowedRoles.map(normalizeRole);

    // 4. Role capabilities check
    const userCapabilities = ROLE_CAPABILITY_MAP[userRole] || ["employee"];

    const isAuthorized =
      userCapabilities.includes("*") ||
      userCapabilities.some((cap) => normalizedAllowed.includes(cap)) ||
      normalizedAllowed.includes(userRole);

    // Special context checks
    // A. Recruiter on candidate routes
    if (!isAuthorized && (userRole === "recruiter" || userRole === "talent_acquisition")) {
      if (req.baseUrl.includes("/candidate") || req.baseUrl.includes("/recruitment")) {
        return next();
      }
    }

    // B. Payroll / Finance on payroll routes
    if (!isAuthorized && (userRole === "payroll" || userRole === "finance")) {
      if (req.baseUrl.includes("/payroll")) {
        return next();
      }
    }

    // C. IT Admin on accounts & provisioning
    if (!isAuthorized && (userRole === "it_admin" || userRole === "it")) {
      if (req.baseUrl.includes("/admin/accounts") || req.baseUrl.includes("/users")) {
        return next();
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Role '${req.user.role || "Guest"}' is not authorized to access this resource.`,
        requiredRoles: allowedRoles,
      });
    }

    next();
  };
};
