import express from "express";
import {
  getLifecycleStages,
  getEmployeeLifecycle,
  advanceLifecycleStage,
} from "../controllers/lifecycleController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(verifyToken);

// 1. Get complete 22-Stage Blueprint (Open to all authenticated roles)
router.get("/stages", getLifecycleStages);

// 2. Get live 22-Stage status for a specific employee
router.get(
  "/employee/:employeeId",
  authorizeRoles("hr", "hr_admin", "hr_manager", "admin", "super_admin", "manager", "leadership", "auditor", "employee"),
  getEmployeeLifecycle
);

// 3. Advance / Update a lifecycle stage (HR, Manager, Admin)
router.post(
  "/advance",
  authorizeRoles("hr", "hr_admin", "hr_manager", "admin", "super_admin", "manager"),
  advanceLifecycleStage
);

export default router;
