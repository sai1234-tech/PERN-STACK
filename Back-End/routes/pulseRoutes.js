import express from "express";
import {
    submitPulse,
    getTodayPulse,
    getPulseAnalytics,
} from "../controllers/pulseController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();
const ALL_ROLES = ["employee", "manager", "hr", "admin"];

// Employee submit or get today's pulse
router.post("/", verifyToken, authorizeRoles(...ALL_ROLES), submitPulse);
router.get("/today", verifyToken, authorizeRoles(...ALL_ROLES), getTodayPulse);

// HR / Manager engagement analytics
router.get("/analytics", verifyToken, authorizeRoles(...ALL_ROLES), getPulseAnalytics);

export default router;
