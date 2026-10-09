import express from "express";
import {
    checkIn,
    checkOut,
    getMyTodayAttendance,
    getMyAttendance,
    getAllAttendance,
    getMonthlyReport,
    getAttendanceSummary,
    getMonthlySummary,
    correctClockOut,
    approveManualAdjustment,
    rejectAttendance,
    autoCloseMissingClockouts
} from "../controllers/attendanceController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// ==========================================
// EMPLOYEE ROUTES
// ==========================================
// Employee Check-In
router.post("/check-in", verifyToken, checkIn);

// Employee Check-Out
router.post("/check-out", verifyToken, checkOut);

// Employee Today's Attendance Status
router.get("/today", verifyToken, getMyTodayAttendance);

// Employee Attendance History
router.get("/my", verifyToken, getMyAttendance);

// Employee Attendance Summary
router.get("/my/summary", verifyToken, getAttendanceSummary);

// ==========================================
// HR / ADMIN ROUTES
// ==========================================
// HR - View all attendance
router.get("/all", verifyToken, authorizeRoles("hr", "admin"), getAllAttendance);

// HR - Monthly report
router.get("/monthly", verifyToken, authorizeRoles("hr", "admin"), getMonthlyReport);

// HR - Monthly summary
router.get("/summary", verifyToken, authorizeRoles("hr", "admin"), getMonthlySummary);

// HR - Correct clock-out timestamp
router.patch("/:attendanceId/correct-clockout", verifyToken, authorizeRoles("hr", "admin", "manager"), correctClockOut);

// HR - Approve manual working hours adjustment
router.patch("/:attendanceId/manual-adjustment", verifyToken, authorizeRoles("hr", "admin", "manager"), approveManualAdjustment);

// HR - Reject attendance record
router.patch("/:attendanceId/reject", verifyToken, authorizeRoles("hr", "admin", "manager"), rejectAttendance);

// HR - Auto-close missing clock-outs policy
router.post("/auto-close", verifyToken, authorizeRoles("hr", "admin"), autoCloseMissingClockouts);

export default router;
