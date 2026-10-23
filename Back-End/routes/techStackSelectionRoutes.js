import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import {
  getTechStackOverview,
  getStackSelectionMatrix,
  evaluateCustomScoring,
  getCloudProfiles,
  getStorageProviders,
  testStorageOperation,
  getIdpConfigurations,
  simulateIdpHandshake,
  getTcoComparison
} from "../controllers/techStackSelectionController.js";

const router = express.Router();

// Enforce JWT authentication
router.use(verifyToken);

// 0. Executive Stack Decision Overview
router.get(
  "/overview",
  authorizeRoles("admin", "super_admin", "leadership", "auditor", "hr", "manager", "employee"),
  getTechStackOverview
);

// 1. Comprehensive Technology Selection Matrix
router.get(
  "/matrix",
  authorizeRoles("admin", "super_admin", "leadership", "auditor", "hr", "manager"),
  getStackSelectionMatrix
);

// 2. Interactive Custom Weights Scoring Evaluator
router.post(
  "/evaluate",
  authorizeRoles("admin", "super_admin", "leadership", "auditor"),
  evaluateCustomScoring
);

// 3. Multi-Cloud Infrastructure Profiles (AWS, Azure, GCP, On-Prem)
router.get(
  "/cloud-profiles",
  authorizeRoles("admin", "super_admin", "leadership", "auditor", "hr"),
  getCloudProfiles
);

// 4. Cloud Object Storage Providers & Signed URL Engine
router.get(
  "/storage-providers",
  authorizeRoles("admin", "super_admin", "leadership", "auditor", "hr"),
  getStorageProviders
);

router.post(
  "/storage/test",
  authorizeRoles("admin", "super_admin", "hr"),
  testStorageOperation
);

// 5. Enterprise Identity Provider (IdP) SSO/MFA Configurations
router.get(
  "/idp/configurations",
  authorizeRoles("admin", "super_admin", "leadership", "auditor"),
  getIdpConfigurations
);

router.post(
  "/idp/simulate",
  authorizeRoles("admin", "super_admin"),
  simulateIdpHandshake
);

// 6. Total Cost of Ownership (TCO) 3-Year Comparative Financials
router.get(
  "/tco/comparison",
  authorizeRoles("admin", "super_admin", "leadership", "auditor", "hr"),
  getTcoComparison
);

export default router;
