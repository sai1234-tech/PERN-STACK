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

const ALL = ["employee", "manager", "hr", "admin", "super_admin", "leadership", "auditor", "recruiter", "payroll", "it_admin"];
const MGMT = ["admin", "super_admin", "leadership", "auditor", "hr", "manager"];
const ADMINS = ["admin", "super_admin", "leadership", "auditor"];

// Delivery roadmap (Phases & Deliverables)
router.get("/roadmap", authorizeRoles(...MGMT), getRoadmap);
router.post("/roadmap/phases", authorizeRoles("admin", "super_admin", "leadership", "hr"), createPhase);
router.delete("/roadmap/phases/:phaseNo", authorizeRoles("admin", "super_admin", "leadership", "hr"), deletePhase);
router.post("/roadmap/deliverables", authorizeRoles("admin", "super_admin", "leadership", "hr"), createDeliverable);
router.delete("/roadmap/deliverables/:id", authorizeRoles("admin", "super_admin", "leadership", "hr"), deleteDeliverable);
router.post("/roadmap/phases/:phaseNo/signoff", authorizeRoles("admin", "super_admin", "leadership"), signOffPhase);

// Phase 4 – controlled AI layer
router.post("/ai/policy-assistant", authorizeRoles(...ALL), policyAssistant);
router.get("/ai/search", authorizeRoles(...ALL), intelligentSearch);
router.get("/ai/analytics", authorizeRoles(...MGMT), analytics);
router.get("/ai/workflow-assist", authorizeRoles(...MGMT), workflowAssist);
router.get("/ai/guardrails", authorizeRoles(...MGMT), getGuardrails);
router.get("/ai/logs", authorizeRoles(...ADMINS), getInteractionLogs);

export default router;
