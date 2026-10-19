import express from "express";
import {
    createTimesheet,
    createBulkTimesheets,
    getMyTimesheets,
    getMyWeek,
    getMySummary,
    getAttendanceReconciliation,
    updateTimesheet,
    deleteTimesheet,
    submitTimesheet,
    submitWeek,
    getAllTimesheets,
    reviewTimesheet,
} from "../controllers/timesheetController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();
const ALL_ROLES = ["employee", "manager", "hr", "admin"];

// =====================================================
// EMPLOYEE ROUTES
// =====================================================

// Create timesheet
router.post("/", verifyToken, authorizeRoles(...ALL_ROLES), createTimesheet);

// Create multiple manual entries for a week or month
router.post("/bulk", verifyToken, authorizeRoles(...ALL_ROLES), createBulkTimesheets);

// My timesheets
router.get("/my-timesheets", verifyToken, authorizeRoles(...ALL_ROLES), getMyTimesheets);
router.get("/my", verifyToken, authorizeRoles(...ALL_ROLES), getMyTimesheets);

// My weekly timesheet
router.get("/my/week", verifyToken, authorizeRoles(...ALL_ROLES), getMyWeek);

// Attendance Reconciliation
router.get("/reconciliation", verifyToken, authorizeRoles(...ALL_ROLES), getAttendanceReconciliation);

// My dashboard summary
router.get("/my/summary", verifyToken, authorizeRoles(...ALL_ROLES), getMySummary);

// Update draft/rejected entry
router.put("/:timesheetId", verifyToken, authorizeRoles(...ALL_ROLES), updateTimesheet);

// Delete draft entry
router.delete("/:timesheetId", verifyToken, authorizeRoles(...ALL_ROLES), deleteTimesheet);

// Submit individual entry
router.patch("/:timesheetId/submit", verifyToken, authorizeRoles(...ALL_ROLES), submitTimesheet);

// Submit complete week
router.post("/submit-week", verifyToken, authorizeRoles(...ALL_ROLES), submitWeek);

// =====================================================
// HR / ADMIN ROUTES
// =====================================================

// Get all timesheets
router.get("/all", verifyToken, authorizeRoles("manager", "hr", "admin"), getAllTimesheets);

// Approve / reject
router.patch("/:timesheetId/review", verifyToken, authorizeRoles("manager", "hr", "admin"), reviewTimesheet);

export default router;
