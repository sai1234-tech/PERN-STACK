import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import {
  getOperationsOverview,
  getPerformanceTargets,
  executeLoadTest,
  getAvailabilityStatus,
  getScalabilityMetrics,
  getSecurityVulnerabilities,
  runSecurityScan,
  getUsabilityTelemetry,
  getBackupLedger,
  triggerAutomatedRestoreTest,
  getDisasterRecoveryTiers,
  triggerDrill,
  getObservabilityLogs,
  getObservabilityAlerts,
  getMaintainabilityStatus
} from "../controllers/enterpriseOperationsController.js";

const router = express.Router();

// Enforce JWT authentication
router.use(verifyToken);

// 0. Executive Radar Overview across 9 Areas
router.get(
  "/overview",
  authorizeRoles("admin", "super_admin", "leadership", "auditor", "hr", "manager"),
  getOperationsOverview
);

// 1. Performance
router.get(
  "/performance/targets",
  authorizeRoles("admin", "super_admin", "leadership", "auditor"),
  getPerformanceTargets
);
router.post(
  "/performance/load-test",
  authorizeRoles("admin", "super_admin"),
  executeLoadTest
);

// 2. Availability
router.get(
  "/availability/status",
  authorizeRoles("admin", "super_admin", "leadership", "auditor", "hr", "manager"),
  getAvailabilityStatus
);

// 3. Scalability
router.get(
  "/scalability/metrics",
  authorizeRoles("admin", "super_admin", "leadership", "auditor"),
  getScalabilityMetrics
);

// 4. Security
router.get(
  "/security/vulnerabilities",
  authorizeRoles("admin", "super_admin", "leadership", "auditor"),
  getSecurityVulnerabilities
);
router.post(
  "/security/scan",
  authorizeRoles("admin", "super_admin"),
  runSecurityScan
);

// 5. Usability
router.get(
  "/usability/telemetry",
  authorizeRoles("admin", "super_admin", "leadership", "hr", "manager", "employee"),
  getUsabilityTelemetry
);

// 6. Backup & Automated Restoration Testing
router.get(
  "/backup/ledger",
  authorizeRoles("admin", "super_admin", "leadership", "auditor"),
  getBackupLedger
);
router.post(
  "/backup/test-restore",
  authorizeRoles("admin", "super_admin"),
  triggerAutomatedRestoreTest
);

// 7. Disaster Recovery
router.get(
  "/dr/tiers",
  authorizeRoles("admin", "super_admin", "leadership", "auditor"),
  getDisasterRecoveryTiers
);
router.post(
  "/dr/drill",
  authorizeRoles("admin", "super_admin"),
  triggerDrill
);

// 8. Observability
router.get(
  "/observability/logs",
  authorizeRoles("admin", "super_admin", "leadership", "auditor"),
  getObservabilityLogs
);
router.get(
  "/observability/alerts",
  authorizeRoles("admin", "super_admin", "leadership", "auditor"),
  getObservabilityAlerts
);

// 9. Maintainability
router.get(
  "/maintainability/status",
  authorizeRoles("admin", "super_admin", "leadership", "auditor"),
  getMaintainabilityStatus
);

export default router;
