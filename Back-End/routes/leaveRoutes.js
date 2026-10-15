import express from "express";
import {
    applyLeave,
    getMyLeaves,
    cancelLeave,
    getLeaveBalance,
    getAllLeaves,
    approveLeave,
    rejectLeave,
    revertLeaveDecision,
    getLeaveTypes,
    createLeaveType,
    updateLeaveType
} from "../controllers/leaveController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Apply auth middleware to all leave routes
router.use(verifyToken);

const ALL_ROLES = ["employee", "manager", "hr", "admin"];

// ==========================================
// EMPLOYEE LEAVE ROUTES
// ==========================================
// Apply Leave
router.post("/apply", authorizeRoles(...ALL_ROLES), applyLeave);

// View My Leaves
router.get("/my-leaves", authorizeRoles(...ALL_ROLES), getMyLeaves);
router.get("/my", authorizeRoles(...ALL_ROLES), getMyLeaves);

// View Leave Balance
router.get("/balance", authorizeRoles(...ALL_ROLES), getLeaveBalance);

// Cancel Leave
router.patch("/:leaveId/cancel", authorizeRoles(...ALL_ROLES), cancelLeave);

// ==========================================
// HR / ADMIN LEAVE MANAGEMENT
// ==========================================
// View All Leaves (scoped to direct reports for manager role)
router.get("/all", authorizeRoles("hr", "admin", "manager"), getAllLeaves);

// Approve Leave
router.patch("/:leaveId/approve", authorizeRoles("hr", "admin"), approveLeave);
router.put("/:leaveId/approve", authorizeRoles("hr", "admin"), approveLeave);

// Reject Leave
router.patch("/:leaveId/reject", authorizeRoles("hr", "admin"), rejectLeave);
router.put("/:leaveId/reject", authorizeRoles("hr", "admin"), rejectLeave);

// Revert Leave Decision
router.patch("/:leaveId/revert", authorizeRoles("hr", "admin"), revertLeaveDecision);
router.put("/:leaveId/revert", authorizeRoles("hr", "admin"), revertLeaveDecision);

// ==========================================
// LEAVE TYPES ROUTES
// ==========================================
// Get Leave Types
router.get("/leave-types", authorizeRoles(...ALL_ROLES), getLeaveTypes);
router.get("/types", authorizeRoles(...ALL_ROLES), getLeaveTypes);

// Create Leave Type
router.post("/types", authorizeRoles("hr", "admin"), createLeaveType);

// Update Leave Type
router.patch("/types/:id", authorizeRoles("hr", "admin"), updateLeaveType);

export default router;
