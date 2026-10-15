import { findUserById } from "../repositories/userRepository.js";
import {
    findAttendanceByEmployeeAndDate,
    findAttendanceById,
    createAttendanceRecord,
    updateAttendanceRecord,
    autoCloseUnclosedPastRecords,
    findAttendanceHistoryByEmployee,
    findAllAttendanceRecords,
    findMonthlyAttendanceReport,
    getEmployeeAttendanceSummary,
    getMonthlyAttendanceSummary,
    autoCloseMissingClockoutsPolicy
} from "../repositories/attendanceRepository.js";

import {
    getFormattedDate,
    calculateWorkingHours,
    calculateLateMinutes,
    calculateOvertime,
    getLiveAttendanceStatus
} from "../utils/attendanceUtils.js";

// =====================================================
// HELPER RESPONSES
// =====================================================
const formatEmployee = (user) => {
    if (!user) return null;
    return {
        id: user.id,
        employeeId: `EMP${String(user.id).padStart(3, "0")}`,
        name: user.name || "Employee",
        email: user.email,
        role: user.role || "employee"
    };
};

const formatAttendance = (attendance) => {
    if (!attendance) return null;
    return {
        id: attendance.id,
        employee: attendance.employee_id,
        date: attendance.date,
        checkIn: attendance.check_in || null,
        checkOut: attendance.check_out || null,
        workingHours: attendance.working_hours ? Number(attendance.working_hours) : 0,
        status: attendance.status,
        isLate: attendance.is_late || false,
        lateMinutes: attendance.late_minutes || 0,
        overtimeHours: attendance.overtime_hours ? Number(attendance.overtime_hours) : 0,
        remarks: attendance.remarks || ""
    };
};

// =====================================================
// 1. CHECK-IN
// =====================================================
export const checkIn = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const user = await findUserById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Employee account not found"
            });
        }

        if (user.is_active === false) {
            return res.status(403).json({
                success: false,
                message: "Inactive employees cannot check in"
            });
        }

        const today = getFormattedDate();

        // Check if attendance record already exists today
        const existingAttendance = await findAttendanceByEmployeeAndDate(user.id, today);
        if (existingAttendance) {
            // If already clocked in and shift is currently active
            if (!existingAttendance.check_out) {
                return res.status(400).json({
                    success: false,
                    message: "Already checked in today (shift active)",
                    data: {
                        employee: formatEmployee(user),
                        attendance: formatAttendance(existingAttendance)
                    }
                });
            }

            // If previously clocked out, allow resuming work / re-clocking in for today
            const updatedAttendance = await updateAttendanceRecord(existingAttendance.id, {
                check_out: null,
                status: existingAttendance.status === "half-day" ? "present" : (existingAttendance.status || "present")
            });

            return res.status(200).json({
                success: true,
                message: "Shift resumed successfully. Clocked back in.",
                data: {
                    employee: formatEmployee(user),
                    attendance: formatAttendance(updatedAttendance)
                }
            });
        }

        const currentTime = new Date();
        const lateMinutes = calculateLateMinutes(currentTime, 9, 30); // Late after 9:30 AM
        const isLate = lateMinutes > 0;
        const status = isLate ? "late" : "present";

        const attendance = await createAttendanceRecord({
            employeeId: user.id,
            date: today,
            checkIn: currentTime,
            status,
            isLate,
            lateMinutes
        });

        return res.status(201).json({
            success: true,
            message: isLate ? "Check-in successful. You are late." : "Check-in successful",
            data: {
                employee: formatEmployee(user),
                attendance: formatAttendance(attendance)
            }
        });
    } catch (error) {
        console.error("CHECK-IN ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Check-in failed",
            error: error.message
        });
    }
};

// =====================================================
// 2. CHECK-OUT
// =====================================================
export const checkOut = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const user = await findUserById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Employee account not found"
            });
        }

        if (user.is_active === false) {
            return res.status(403).json({
                success: false,
                message: "Inactive employees cannot check out"
            });
        }

        const today = getFormattedDate();
        const attendance = await findAttendanceByEmployeeAndDate(user.id, today);

        if (!attendance) {
            return res.status(404).json({
                success: false,
                message: "Please check in first"
            });
        }

        if (attendance.check_out) {
            return res.status(400).json({
                success: false,
                message: "Already checked out today",
                data: {
                    employee: formatEmployee(user),
                    attendance: formatAttendance(attendance)
                }
            });
        }

        const checkOutTime = new Date();
        const workingHours = calculateWorkingHours(attendance.check_in, checkOutTime);
        const overtimeHours = calculateOvertime(workingHours, 8);

        let status = attendance.status;
        if (workingHours < 4) {
            status = "half-day";
        }

        const updatedAttendance = await updateAttendanceRecord(attendance.id, {
            check_out: checkOutTime,
            working_hours: workingHours,
            overtime_hours: overtimeHours,
            status
        });

        return res.status(200).json({
            success: true,
            message: "Check-out successful",
            data: {
                employee: formatEmployee(user),
                attendance: formatAttendance(updatedAttendance)
            }
        });
    } catch (error) {
        console.error("CHECK-OUT ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Check-out failed",
            error: error.message
        });
    }
};

// =====================================================
// 3. EMPLOYEE - TODAY ATTENDANCE
// =====================================================
export const getMyTodayAttendance = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const user = await findUserById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found"
            });
        }

        const today = getFormattedDate();
        const attendance = await findAttendanceByEmployeeAndDate(user.id, today);

        if (!attendance) {
            const liveStatus = getLiveAttendanceStatus(null, new Date());
            const status = liveStatus === "Absent" ? "absent" : "not_checked_in";

            return res.status(200).json({
                success: true,
                message: liveStatus === "Not Checked In" ? "Employee has not checked in yet today" : "Workday ended without check-in",
                data: {
                    employee: formatEmployee(user),
                    attendance: null,
                    liveStatus,
                    status,
                    checkedIn: false,
                    checkOut: null
                }
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                employee: formatEmployee(user),
                attendance: formatAttendance(attendance)
            }
        });
    } catch (error) {
        console.error("TODAY ATTENDANCE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch today's attendance",
            error: error.message
        });
    }
};

// =====================================================
// 4. EMPLOYEE - ATTENDANCE HISTORY
// =====================================================
export const getMyAttendance = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const user = await findUserById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found"
            });
        }

        const today = getFormattedDate();
        await autoCloseUnclosedPastRecords(user.id, today);

        const attendanceList = await findAttendanceHistoryByEmployee(user.id);

        return res.status(200).json({
            success: true,
            employee: formatEmployee(user),
            count: attendanceList.length,
            data: attendanceList.map(formatAttendance)
        });
    } catch (error) {
        console.error("ATTENDANCE HISTORY ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch attendance history",
            error: error.message
        });
    }
};

// =====================================================
// 5. HR / ADMIN - ALL ATTENDANCE
// =====================================================
export const getAllAttendance = async (req, res) => {
    try {
        const records = await findAllAttendanceRecords();

        const data = records.map((item) => {
            const fullName = `${item.first_name || ""} ${item.last_name || ""}`.trim() || item.employee_name || "Employee";
            const code = item.employee_code || `EMP${String(item.user_id).padStart(3, "0")}`;
            return {
                id: item.id,
                employee: {
                    id: item.user_id,
                    employeeId: code,
                    employeeCode: code,
                    name: fullName,
                    email: item.employee_email,
                    role: item.employee_role,
                    department: item.department || "General",
                    designation: item.designation || "-",
                    profilePhoto: item.profile_photo || ""
                },
                date: item.date,
                checkIn: item.check_in,
                checkOut: item.check_out,
                workingHours: Number(item.working_hours || 0),
                status: item.status,
                isLate: item.is_late,
                lateMinutes: item.late_minutes,
                overtimeHours: Number(item.overtime_hours || 0)
            };
        });

        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });
    } catch (error) {
        console.error("ALL ATTENDANCE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch all attendance",
            error: error.message
        });
    }
};

// =====================================================
// 6. HR - MONTHLY ATTENDANCE REPORT
// =====================================================
export const getMonthlyReport = async (req, res) => {
    try {
        const now = new Date();
        const year = req.query.year || now.getFullYear();
        const month = req.query.month || (now.getMonth() + 1);

        const numericYear = Number(year);
        const numericMonth = Number(month);

        if (!Number.isInteger(numericYear) || !Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 12) {
            return res.status(400).json({
                success: false,
                message: "Invalid year or month"
            });
        }

        const startDate = `${numericYear}-${String(numericMonth).padStart(2, "0")}-01`;
        const lastDay = new Date(numericYear, numericMonth, 0).getDate();
        const endDate = `${numericYear}-${String(numericMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

        const records = await findMonthlyAttendanceReport(startDate, endDate);

        const data = records.map((item) => {
            const fullName = `${item.first_name || ""} ${item.last_name || ""}`.trim() || item.employee_name || "Employee";
            const code = item.employee_code || `EMP${String(item.user_id).padStart(3, "0")}`;
            return {
                id: item.id,
                employee: {
                    id: item.user_id,
                    employeeId: code,
                    employeeCode: code,
                    name: fullName,
                    email: item.employee_email,
                    role: item.employee_role,
                    department: item.department || "General",
                    designation: item.designation || "-",
                    profilePhoto: item.profile_photo || ""
                },
                date: item.date,
                checkIn: item.check_in,
                checkOut: item.check_out,
                workingHours: Number(item.working_hours || 0),
                status: item.status,
                isLate: item.is_late,
                lateMinutes: item.late_minutes,
                overtimeHours: Number(item.overtime_hours || 0)
            };
        });

        return res.status(200).json({
            success: true,
            year: numericYear,
            month: numericMonth,
            count: data.length,
            data
        });
    } catch (error) {
        console.error("MONTHLY REPORT ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate monthly report",
            error: error.message
        });
    }
};

// =====================================================
// 7. EMPLOYEE - ATTENDANCE SUMMARY
// =====================================================
export const getAttendanceSummary = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const user = await findUserById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found"
            });
        }

        const summary = await getEmployeeAttendanceSummary(user.id);

        return res.status(200).json({
            success: true,
            employee: formatEmployee(user),
            data: summary
        });
    } catch (error) {
        console.error("ATTENDANCE SUMMARY ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate attendance summary",
            error: error.message
        });
    }
};

// =====================================================
// 8. HR - MONTHLY SUMMARY
// =====================================================
export const getMonthlySummary = async (req, res) => {
    try {
        const now = new Date();
        const year = req.query.year || now.getFullYear();
        const month = req.query.month || (now.getMonth() + 1);

        const numericYear = Number(year);
        const numericMonth = Number(month);

        if (!Number.isInteger(numericYear) || !Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 12) {
            return res.status(400).json({
                success: false,
                message: "Invalid year or month"
            });
        }

        const startDate = `${numericYear}-${String(numericMonth).padStart(2, "0")}-01`;
        const lastDay = new Date(numericYear, numericMonth, 0).getDate();
        const endDate = `${numericYear}-${String(numericMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

        const summaryRows = await getMonthlyAttendanceSummary(startDate, endDate);

        const data = summaryRows.map((row) => ({
            employee: {
                id: row.employee_id,
                employeeId: `EMP${String(row.employee_id).padStart(3, "0")}`,
                name: row.employee_name,
                email: row.employee_email,
                role: row.employee_role
            },
            totalDays: row.totalDays,
            presentDays: row.presentDays,
            absentDays: row.absentDays,
            lateDays: row.lateDays,
            halfDays: row.halfDays,
            totalWorkingHours: row.totalWorkingHours,
            totalOvertimeHours: row.totalOvertimeHours,
            totalLateMinutes: row.totalLateMinutes
        }));

        return res.status(200).json({
            success: true,
            year: numericYear,
            month: numericMonth,
            count: data.length,
            data
        });
    } catch (error) {
        console.error("MONTHLY SUMMARY ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate monthly summary",
            error: error.message
        });
    }
};

// =====================================================
// 9. HR ACTION 1: CORRECT CLOCK-OUT TIME
// =====================================================
export const correctClockOut = async (req, res) => {
    try {
        const { attendanceId } = req.params;
        const newCheckOut = req.body?.checkOut || req.body?.check_out || req.body?.checkout || req.body?.checkOutTime || req.query?.checkOut || new Date().toISOString();
        const remarks = req.body?.remarks || req.query?.remarks || "Corrected by Admin";

        const attendance = await findAttendanceById(attendanceId);
        if (!attendance) {
            return res.status(404).json({
                success: false,
                message: `Attendance record with ID ${attendanceId} not found.`
            });
        }


        const checkOutTime = new Date(newCheckOut);
        if (Number.isNaN(checkOutTime.getTime()) || checkOutTime <= new Date(attendance.check_in)) {
            return res.status(400).json({
                success: false,
                message: "Check-out time must be after check-in time"
            });
        }

        const workingHours = calculateWorkingHours(attendance.check_in, checkOutTime);
        const overtimeHours = calculateOvertime(workingHours, 8);
        let status = attendance.status;
        if (workingHours < 4) status = "half-day";
        else if (status === "absent") status = "present";

        const updatedAttendance = await updateAttendanceRecord(attendanceId, {
            check_out: checkOutTime,
            working_hours: workingHours,
            overtime_hours: overtimeHours,
            status,
            remarks: remarks || `HR Clock-out Correction by Admin on ${new Date().toISOString().slice(0, 10)}`
        });

        return res.status(200).json({
            success: true,
            message: "Attendance clock-out corrected successfully",
            data: formatAttendance(updatedAttendance)
        });
    } catch (error) {
        console.error("CORRECT CLOCKOUT ERROR:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// =====================================================
// 10. HR ACTION 2: APPROVE MANUAL ADJUSTMENT
// =====================================================
export const approveManualAdjustment = async (req, res) => {
    try {
        const { attendanceId } = req.params;
        const { workingHours, status = "present", remarks } = req.body;

        const parsedHours = Number(workingHours);
        if (!Number.isFinite(parsedHours) || parsedHours < 0 || parsedHours > 24) {
            return res.status(400).json({
                success: false,
                message: "Valid working hours between 0 and 24 required"
            });
        }

        const attendance = await findAttendanceById(attendanceId);
        if (!attendance) {
            return res.status(404).json({
                success: false,
                message: "Attendance record not found"
            });
        }

        const updatedAttendance = await updateAttendanceRecord(attendanceId, {
            working_hours: parsedHours,
            status,
            remarks: remarks || `Manual Adjustment Approved: ${parsedHours} hrs`
        });

        return res.status(200).json({
            success: true,
            message: "Manual attendance adjustment approved",
            data: formatAttendance(updatedAttendance)
        });
    } catch (error) {
        console.error("MANUAL ADJUSTMENT ERROR:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// =====================================================
// 11. HR ACTION 3: REJECT ATTENDANCE
// =====================================================
export const rejectAttendance = async (req, res) => {
    try {
        const { attendanceId } = req.params;
        const { status = "absent", remarks } = req.body;

        if (!["absent", "half-day"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Rejection status must be absent or half-day"
            });
        }

        const attendance = await findAttendanceById(attendanceId);
        if (!attendance) {
            return res.status(404).json({
                success: false,
                message: "Attendance record not found"
            });
        }

        const updatedAttendance = await updateAttendanceRecord(attendanceId, {
            status,
            working_hours: status === "half-day" ? 4.0 : 0,
            remarks: remarks || `Attendance rejected by HR: Marked as ${status}`
        });

        return res.status(200).json({
            success: true,
            message: `Attendance rejected and marked as ${status}`,
            data: formatAttendance(updatedAttendance)
        });
    } catch (error) {
        console.error("REJECT ATTENDANCE ERROR:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// =====================================================
// 12. HR ACTION 4: AUTO-CLOSE MISSING CLOCK-OUTS POLICY
// =====================================================
export const autoCloseMissingClockouts = async (req, res) => {
    try {
        const today = getFormattedDate();
        const closedCount = await autoCloseMissingClockoutsPolicy(today);

        return res.status(200).json({
            success: true,
            message: `Successfully auto-closed ${closedCount} missing clock-out records using End-of-Day policy.`,
            closedCount
        });
    } catch (error) {
        console.error("AUTO CLOSE ERROR:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
