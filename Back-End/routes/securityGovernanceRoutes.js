import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import {
  getSecurityOverview,
  generateMfaChallenge,
  verifyMfaChallenge,
  listMfaChallenges,
  getDataMaskingPolicies,
  updateDataMaskingPolicy,
  testDataMaskingPreview,
  getImmutableAuditTrail,
  verifyAuditTrailChain,
  recordProtectedTransaction,
  getDocumentAccessLogs,
  logDocumentAccess,
  getBackupDrLogs,
  triggerBackupSnapshot,
  getDataRetentionRules,
  updateDataRetentionRule,
  executeRetentionPurge,
  getDpdpConsentLogs,
  recordDpdpConsent,
  getDpdpRightsRequests,
  createDpdpRightsRequest,
  updateDpdpRightsRequest,
  getAccessReviewCampaigns,
  createOrCertifyAccessReview,
  getSeparationDeprovisioningLogs,
  triggerImmediateDeprovisioning,
} from "../controllers/securityGovernanceController.js";

const router = express.Router();

// Enforce JWT token verification across all governance & security endpoints
router.use(verifyToken);

// 1. Executive Security & Compliance Overview
router.get("/overview", authorizeRoles("admin", "super_admin", "auditor", "leadership", "hr_admin"), getSecurityOverview);

// 2. Step-Up Privileged MFA
router.post("/mfa/challenge", generateMfaChallenge);
router.post("/mfa/verify", verifyMfaChallenge);
router.get("/mfa/challenges", authorizeRoles("admin", "super_admin", "auditor"), listMfaChallenges);

// 3. Field-Level Masking Policies & Preview
router.get("/masking/policies", authorizeRoles("admin", "super_admin", "auditor", "hr_admin", "payroll"), getDataMaskingPolicies);
router.put("/masking/policies/:id", authorizeRoles("admin", "super_admin"), updateDataMaskingPolicy);
router.get("/masking/preview", authorizeRoles("admin", "super_admin", "auditor", "hr_admin"), testDataMaskingPreview);

// 4. Protected Cryptographic Audit Trail
router.get("/audit/chain", authorizeRoles("admin", "super_admin", "auditor", "leadership"), getImmutableAuditTrail);
router.get("/audit/verify", authorizeRoles("admin", "super_admin", "auditor", "leadership"), verifyAuditTrailChain);
router.post("/audit/record", authorizeRoles("admin", "super_admin", "hr_admin"), recordProtectedTransaction);

// 5. Document Access & Download Logs
router.get("/documents/logs", authorizeRoles("admin", "super_admin", "auditor", "hr_admin"), getDocumentAccessLogs);
router.post("/documents/logs", logDocumentAccess);

// 6. Backup & Disaster Recovery (DR)
router.get("/backup/logs", authorizeRoles("admin", "super_admin", "auditor", "it_admin"), getBackupDrLogs);
router.post("/backup/snapshot", authorizeRoles("admin", "super_admin", "it_admin"), triggerBackupSnapshot);

// 7. Configurable Data Retention Rules & Scheduled Purge
router.get("/retention/rules", authorizeRoles("admin", "super_admin", "auditor", "hr_admin"), getDataRetentionRules);
router.put("/retention/rules/:id", authorizeRoles("admin", "super_admin"), updateDataRetentionRule);
router.post("/retention/purge", authorizeRoles("admin", "super_admin"), executeRetentionPurge);

// 8. Indian DPDP Act 2023 Consent & Rights Management
router.get("/dpdp/consents", authorizeRoles("admin", "super_admin", "auditor", "hr_admin"), getDpdpConsentLogs);
router.post("/dpdp/consents", authorizeRoles("admin", "super_admin", "hr_admin", "employee"), recordDpdpConsent);
router.get("/dpdp/rights", authorizeRoles("admin", "super_admin", "auditor", "hr_admin"), getDpdpRightsRequests);
router.post("/dpdp/rights", createDpdpRightsRequest);
router.patch("/dpdp/rights/:id", authorizeRoles("admin", "super_admin", "hr_admin"), updateDpdpRightsRequest);

// 9. Periodic Access Reviews & Separation Deprovisioning
router.get("/access-reviews", authorizeRoles("admin", "super_admin", "auditor", "it_admin"), getAccessReviewCampaigns);
router.post("/access-reviews/certify", authorizeRoles("admin", "super_admin", "it_admin"), createOrCertifyAccessReview);
router.get("/separation/deprovisioning-logs", authorizeRoles("admin", "super_admin", "auditor", "hr_admin", "it_admin"), getSeparationDeprovisioningLogs);
router.post("/separation/immediate-deprovision", authorizeRoles("admin", "super_admin", "hr_admin", "it_admin"), triggerImmediateDeprovisioning);

export default router;
