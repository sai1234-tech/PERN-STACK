import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import {
  getRoadmap,
  signOffPhase,
  createPhase,
  createDeliverable,
  deletePhase,
  deleteDeliverable
} from "../controllers/deliveryRoadmapController.js";
import {
  policyAssistant,
  intelligentSearch,
  analytics,
  workflowAssist,
  getGuardrails,
  getInteractionLogs
} from "../controllers/aiLayerController.js";

const router = express.Router();
router.use(verifyToken);

const ALL = ["employee", "manager", "hr", "hr_admin", "hr_manager", "hr_operations", "admin", "super_admin", "leadership", "executive", "auditor", "recruiter", "payroll", "it_admin"];
const MGMT = ["admin", "super_admin", "leadership", "executive", "auditor", "hr", "hr_admin", "hr_manager", "hr_operations", "manager"];
const ADMINS = ["admin", "super_admin", "leadership", "executive", "auditor"];
const HR_CREATORS = ["admin", "super_admin", "leadership", "executive", "hr", "hr_admin", "hr_manager", "hr_operations"];

// Delivery roadmap (Phases & Deliverables)
router.get("/roadmap", authorizeRoles(...MGMT), getRoadmap);
router.post("/roadmap/phases", authorizeRoles(...HR_CREATORS), createPhase);
router.delete("/roadmap/phases/:phaseNo", authorizeRoles(...HR_CREATORS), deletePhase);
router.post("/roadmap/deliverables", authorizeRoles(...HR_CREATORS), createDeliverable);
router.delete("/roadmap/deliverables/:id", authorizeRoles(...HR_CREATORS), deleteDeliverable);
router.post("/roadmap/phases/:phaseNo/signoff", authorizeRoles("admin", "super_admin", "leadership", "executive"), signOffPhase);

// Phase 4 – controlled AI layer
router.post("/ai/policy-assistant", authorizeRoles(...ALL), policyAssistant);
router.get("/ai/search", authorizeRoles(...ALL), intelligentSearch);
router.get("/ai/analytics", authorizeRoles(...MGMT), analytics);
router.get("/ai/workflow-assist", authorizeRoles(...MGMT), workflowAssist);
router.get("/ai/guardrails", authorizeRoles(...MGMT), getGuardrails);
router.get("/ai/logs", authorizeRoles(...ADMINS), getInteractionLogs);

export default router;
