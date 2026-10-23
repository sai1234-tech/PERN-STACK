import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import {
  startPreboarding, getPreboarding, updatePreboardingTask, onboardingGate, completeOnboarding,
  submitRegularization, getMyRegularizations, listRegularizations, decideRegularization,
  generatePayrollInputs, listPayrollInputs,
  generateExitDocuments, listExitDocuments, downloadExitDocument
} from "../controllers/lifecycleOpsController.js";

const router = express.Router();
router.use(verifyToken);

// Preboarding and guarded onboarding
router.post("/preboarding/:id", authorizeRoles("hr", "admin"), startPreboarding);
router.get("/preboarding/:id", authorizeRoles("hr", "admin", "manager"), getPreboarding);
router.patch("/preboarding/tasks/:taskId", authorizeRoles("hr", "admin", "it_admin"), updatePreboardingTask);
router.post("/onboarding/complete/:id", authorizeRoles("hr", "admin"), onboardingGate, completeOnboarding);

// Attendance regularization
router.post("/regularizations", authorizeRoles("employee"), submitRegularization);
router.get("/regularizations/my", authorizeRoles("employee"), getMyRegularizations);
router.get("/regularizations", authorizeRoles("hr", "admin", "manager"), listRegularizations);
router.patch("/regularizations/:id/decision", authorizeRoles("hr", "admin", "manager"), decideRegularization);

// Payroll inputs
router.post("/payroll-inputs/generate", authorizeRoles("hr", "admin", "payroll"), generatePayrollInputs);
router.get("/payroll-inputs", authorizeRoles("hr", "admin", "payroll", "finance", "auditor"), listPayrollInputs);

// Exit documents
router.post("/exit-documents/generate", authorizeRoles("hr", "admin"), generateExitDocuments);
router.get("/exit-documents/employee/:employeeId", authorizeRoles("employee"), listExitDocuments);
router.get("/exit-documents/:id/download", authorizeRoles("employee"), downloadExitDocument);

export default router;
