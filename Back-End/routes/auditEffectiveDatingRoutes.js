import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import {
  getGovernanceOverview,
  logCriticalDataChange,
  getCriticalDataChanges,
  recordApprovalDecision,
  getApprovalDecisions,
  getApprovalChainByEntity,
  createEffectiveDatedRevision,
  getEffectiveDatedHistory,
  getAsOfDateRecord,
  logSensitiveExport,
  getSensitiveExports,
  logAdministrativeAction,
  getAdministrativeActions,
  getDocumentPolicies,
  updateDocumentPolicy,
  evaluateDocumentAccess,
  getDocumentGovernanceAudits
} from "../controllers/auditEffectiveDatingController.js";

const router = express.Router();

// Apply JWT authentication
router.use(verifyToken);

// 0. Governance & Compliance Overview KPIs
router.get(
  "/overview",
  authorizeRoles("admin", "super_admin", "hr", "finance", "manager", "auditor", "leadership"),
  getGovernanceOverview
);

// 1. Critical Data Change Logging
router.post(
  "/critical-changes",
  authorizeRoles("admin", "super_admin", "hr", "finance", "manager"),
  logCriticalDataChange
);
router.get(
  "/critical-changes",
  authorizeRoles("admin", "super_admin", "hr", "finance", "manager", "auditor", "leadership"),
  getCriticalDataChanges
);

// 2. Immutable Approval Decision History
router.post(
  "/approval-decisions",
  authorizeRoles("admin", "super_admin", "hr", "finance", "manager"),
  recordApprovalDecision
);
router.get(
  "/approval-decisions",
  authorizeRoles("admin", "super_admin", "hr", "finance", "manager", "auditor", "leadership", "employee"),
  getApprovalDecisions
);
router.get(
  "/approval-decisions/entity/:entityId",
  authorizeRoles("admin", "super_admin", "hr", "finance", "manager", "auditor", "leadership", "employee"),
  getApprovalChainByEntity
);

// 3. Effective-Dated History Ledger (Temporal Non-Overwriting)
router.post(
  "/effective-dated",
  authorizeRoles("admin", "super_admin", "hr", "finance"),
  createEffectiveDatedRevision
);
router.get(
  "/effective-dated",
  authorizeRoles("admin", "super_admin", "hr", "finance", "manager", "auditor", "leadership"),
  getEffectiveDatedHistory
);
router.get(
  "/effective-dated/as-of",
  authorizeRoles("admin", "super_admin", "hr", "finance", "manager", "auditor", "leadership"),
  getAsOfDateRecord
);

// 4. Sensitive Export & Administrative Action Logs
router.post(
  "/sensitive-exports",
  authorizeRoles("admin", "super_admin", "hr", "finance"),
  logSensitiveExport
);
router.get(
  "/sensitive-exports",
  authorizeRoles("admin", "super_admin", "hr", "finance", "auditor", "leadership"),
  getSensitiveExports
);
router.post(
  "/admin-actions",
  authorizeRoles("admin", "super_admin"),
  logAdministrativeAction
);
router.get(
  "/admin-actions",
  authorizeRoles("admin", "super_admin", "auditor", "leadership"),
  getAdministrativeActions
);

// 5. Document Preview / Download Governance & Watermarking
router.get(
  "/document-policies",
  authorizeRoles("admin", "super_admin", "hr", "finance", "manager", "auditor"),
  getDocumentPolicies
);
router.put(
  "/document-policies/:categoryCode",
  authorizeRoles("admin", "super_admin"),
  updateDocumentPolicy
);
router.post(
  "/documents/evaluate-access",
  authorizeRoles("admin", "super_admin", "hr", "finance", "manager", "auditor", "employee"),
  evaluateDocumentAccess
);
router.get(
  "/document-audit",
  authorizeRoles("admin", "super_admin", "hr", "finance", "auditor", "leadership"),
  getDocumentGovernanceAudits
);

export default router;
