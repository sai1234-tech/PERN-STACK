import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import {
    getStaffAugOverview,
    getLifecycleTrace
} from "../controllers/staffAugmentationController.js";

const router = express.Router();
router.use(verifyToken);

// 1. Staff Augmentation Overview & Metrics (All authenticated workforce members can view, commercials masked based on role)
router.get("/overview", authorizeRoles("admin", "super_admin", "hr", "manager", "employee", "finance", "leadership"), getStaffAugOverview);

// 2. 16-Stage Lifecycle Trace by Candidate/Employee Identifier
router.get("/pipeline/trace/:id", authorizeRoles("admin", "super_admin", "hr", "manager", "leadership"), getLifecycleTrace);

export default router;
