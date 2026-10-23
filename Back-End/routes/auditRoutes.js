import express from "express";
import { getAuditLogs, createAuditLog } from "../controllers/auditController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(verifyToken);

// Super Admin, Admin, HR, Leadership and Auditor can view full audit telemetry
router.get("/", authorizeRoles("admin", "super_admin", "hr", "auditor", "leadership"), getAuditLogs);
router.post("/", authorizeRoles("admin", "super_admin", "hr", "manager"), createAuditLog);

export default router;
