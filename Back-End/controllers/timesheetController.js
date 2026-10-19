import { findEmployeeByUserId } from "../repositories/employeeRepository.js";
import { findAttendanceByEmployeeAndDate, findAttendanceHistoryByEmployee } from "../repositories/attendanceRepository.js";
import {
    createTimesheetRecord,
    bulkCreateTimesheetRecords,
    findTimesheetsByEmployee,
    findTimesheetsInDateRange,
    findTimesheetsByDate,
    findExactDuplicateTimesheet,
    findTimesheetById,
    updateTimesheetRecord,
    deleteTimesheetRecord,
    submitWeekTimesheets,
    findAllTimesheetsAdmin
} from "../repositories/timesheetRepository.js";

// =====================================================
// HELPERS
// =====================================================

const getEmployeeByUser = async (userObjOrId) => {
    const userId = typeof userObjOrId === "object" && userObjOrId !== null
        ? (userObjOrId.userId || userObjOrId.id || userObjOrId._id)
        : userObjOrId;
    return await findEmployeeByUserId(userId);
};

const formatHoursToHHMM = (decimalHours) => {
    if (decimalHours === undefined || decimalHours === null || Number.isNaN(decimalHours) || decimalHours < 0) {
        return "0:00";
    }
    const totalMinutes = Math.round(decimalHours * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hrs}:${String(mins).padStart(2, "0")}`;
};

const formatDateKey = (dateInput) => {
    const date = new Date(dateInput);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const computeReconciliationData = (attendanceRecord, timesheetHoursSum, standardRequiredHours = 8.0, dateStr = null) => {
    let clockedHours = 0;
    let isMissingClockout = false;
    let isPendingClockout = false;
    const hasClockedIn = Boolean(
        attendanceRecord &&
        (attendanceRecord.check_in || attendanceRecord.checkIn || Number(attendanceRecord.working_hours || attendanceRecord.workingHours || 0) > 0) &&
        attendanceRecord.status !== "absent"
    );

    if (attendanceRecord && hasClockedIn) {
        const workingHours = Number(attendanceRecord.working_hours || attendanceRecord.workingHours || 0);
        const checkIn = attendanceRecord.check_in || attendanceRecord.checkIn;
        const checkOut = attendanceRecord.check_out || attendanceRecord.checkOut;

        if (workingHours > 0) {
            clockedHours = workingHours;
        } else if (checkIn && !checkOut) {
            const recDateStr = formatDateKey(new Date(attendanceRecord.date));
            const todayStr = formatDateKey(new Date());

            if (recDateStr < todayStr) {
                isMissingClockout = true;
                clockedHours = 0;
            } else {
                const elapsedMs = new Date() - new Date(checkIn);
                const elapsedMins = Math.max(0, Math.floor(elapsedMs / (1000 * 60)) - 45);
                clockedHours = Number((Math.max(0, elapsedMins) / 60).toFixed(2));
                isPendingClockout = true;
            }
        }
    }

    const timesheetHours = Number((timesheetHoursSum || 0).toFixed(2));
    const diffDecimal = Number(Math.abs(timesheetHours - clockedHours).toFixed(2));

    let status = "MATCHED";
    let action = "Ready for Submission";

    const isPastOrToday = !dateStr || dateStr <= formatDateKey(new Date());
    const isWorkDay = standardRequiredHours > 0;

    if (!hasClockedIn && isWorkDay && isPastOrToday) {
        status = "ABSENT";
        action = "Marked Absent - No Clock-in Recorded";
    } else if (isMissingClockout) {
        status = "MISSING CLOCKOUT";
        action = "HR Clock-Out Correction Required";
    } else if (isPendingClockout && clockedHours < standardRequiredHours) {
        status = "PENDING CLOCKOUT";
        action = "Clock Out Required";
    } else if (diffDecimal > 0.25) {
        status = "MISMATCH";
        action = "HR Review Required";
    } else {
        status = "MATCHED";
        action = "Ready for Submission";
    }

    return {
        requiredHoursDecimal: standardRequiredHours,
        requiredHours: formatHoursToHHMM(standardRequiredHours),
        clockedHoursDecimal: clockedHours,
        clockedHours: formatHoursToHHMM(clockedHours),
        timesheetHoursDecimal: timesheetHours,
        timesheetHours: formatHoursToHHMM(timesheetHours),
        differenceDecimal: diffDecimal,
        difference: formatHoursToHHMM(diffDecimal),
        status,
        action,
        hasAttendance: hasClockedIn,
        isMissingClockout,
        checkIn: hasClockedIn ? (attendanceRecord?.check_in || attendanceRecord?.checkIn || null) : null,
        checkOut: hasClockedIn ? (attendanceRecord?.check_out || attendanceRecord?.checkOut || null) : null,
    };
};

const calculateHours = (startTime, endTime, breakMinutes = 0) => {
    if (!startTime || !endTime) {
        throw new Error("Start time and end time are required");
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error("Invalid start or end time");
    }

    if (end <= start) {
        throw new Error("End time must be after start time");
    }

    const breakTime = Number(breakMinutes) || 0;

    if (breakTime < 0) {
        throw new Error("Break minutes cannot be negative");
    }

    const totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

    if (breakTime >= totalMinutes) {
        throw new Error("Break time cannot be greater than or equal to working time");
    }

    const workedMinutes = totalMinutes - breakTime;
    const hours = workedMinutes / 60;

    if (hours > 24) {
        throw new Error("Working hours cannot exceed 24 hours");
    }

    return Number(hours.toFixed(2));
};

const getWeekRange = (dateInput) => {
    const date = new Date(dateInput);

    if (Number.isNaN(date.getTime())) {
        throw new Error("Invalid date");
    }

    const day = date.getDay();
    const dayNumber = day === 0 ? 7 : day;

    const monday = new Date(date);
    monday.setDate(date.getDate() - (dayNumber - 1));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    friday.setHours(23, 59, 59, 999);

    return {
        start: monday,
        end: sunday,
        friday,
    };
};

const getAvailableActions = (status) => {
    if (status === "draft") {
        return ["edit", "delete", "submit"];
    }
    if (status === "rejected") {
        return ["edit", "submit"];
    }
    return [];
};

// =====================================================
// CREATE TIMESHEET
// POST /api/v1/timesheets
// =====================================================
export const createTimesheet = async (req, res) => {
    try {
        const employee = await getEmployeeByUser(req.user.userId);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found",
            });
        }

        const empStatus = employee.employment?.status || employee.status || "Active";
        if (empStatus !== "Active" && empStatus !== "Notice Period") {
            return res.status(403).json({
                success: false,
                message: "Inactive employees cannot submit timesheets",
            });
        }

        const {
            date,
            project,
            client,
            costCenter,
            task,
            description,
            startTime,
            endTime,
            breakMinutes = 0,
            hours: manualHours,
            entryMode = "manual",
            billable = true,
        } = req.body || {};

        if (!date) {
            return res.status(400).json({
                success: false,
                message: "Date is required",
            });
        }

        if (!task || !task.trim()) {
            return res.status(400).json({
                success: false,
                message: "Task is required",
            });
        }

        if (!["manual", "clock", "timer"].includes(entryMode)) {
            return res.status(400).json({
                success: false,
                message: "Invalid timesheet entry mode",
            });
        }

        const workDate = new Date(date);
        if (Number.isNaN(workDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid work date",
            });
        }

        const rawJoining = employee.employment?.joiningDate || employee.joining_date;
        if (rawJoining) {
            const joiningDate = new Date(rawJoining);
            joiningDate.setHours(0, 0, 0, 0);
            const checkWorkDate = new Date(workDate);
            checkWorkDate.setHours(0, 0, 0, 0);
            if (checkWorkDate < joiningDate) {
                return res.status(400).json({
                    success: false,
                    message: `Enterprise Timesheet Policy: Timesheet entries cannot be created prior to your employment joining date (${formatDateKey(joiningDate)}).`,
                });
            }
        }

        const hasStartOrEnd = startTime || endTime;
        let hours;

        if (hasStartOrEnd) {
            if (!startTime || !endTime) {
                return res.status(400).json({
                    success: false,
                    message: "Both start time and end time are required",
                });
            }
            hours = calculateHours(startTime, endTime, breakMinutes);
        } else {
            hours = Number(manualHours);
            if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
                return res.status(400).json({
                    success: false,
                    message: "Hours must be a number between 0 and 24",
                });
            }
        }

        const dateStr = formatDateKey(workDate);
        const [attendanceRecord, existingDailyEntries] = await Promise.all([
            findAttendanceByEmployeeAndDate(employee.user_id || employee.id, dateStr),
            findTimesheetsByDate(employee.id, dateStr),
        ]);

        // Enforce clock-in requirement
        const hasClockedIn = attendanceRecord && (attendanceRecord.check_in || attendanceRecord.checkIn || (attendanceRecord.working_hours > 0));
        if (!hasClockedIn) {
            return res.status(400).json({
                success: false,
                message: `Enterprise Attendance Policy: You have not clocked in for attendance on ${dateStr}. Timesheet entries can only be filled for dates where you have clocked in.`,
            });
        }

        // Enforce One-Time Submission Policy:
        const alreadySubmittedEntry = existingDailyEntries.find(e =>
            ["submitted", "pending_hr", "approved"].includes(e.status)
        );
        if (alreadySubmittedEntry) {
            return res.status(400).json({
                success: false,
                message: `Enterprise Timesheet Policy: A timesheet for ${dateStr} has already been submitted (${alreadySubmittedEntry.status}) and cannot be submitted again. Timesheets can only be submitted once per working day.`,
            });
        }

        const existingDraft = existingDailyEntries.find(e => e.status === "draft");
        if (existingDraft) {
            return res.status(400).json({
                success: false,
                message: `Enterprise Timesheet Policy: A draft timesheet for ${dateStr} already exists. Please edit or submit your existing draft.`,
            });
        }

        const duplicateEntry = await findExactDuplicateTimesheet({
            employeeId: employee.id,
            date: dateStr,
            project: project?.trim() || "",
            client: client?.trim() || "",
            costCenter: costCenter?.trim() || "",
            task: task.trim(),
            startTime: startTime ? new Date(startTime) : null,
            endTime: endTime ? new Date(endTime) : null,
            hours,
        });

        if (duplicateEntry) {
            return res.status(409).json({
                success: false,
                message: "A timesheet entry with the same details already exists",
            });
        }

        const timesheet = await createTimesheetRecord({
            employeeId: employee.id,
            date: dateStr,
            project: project?.trim() || "",
            client: client?.trim() || "",
            costCenter: costCenter?.trim() || "",
            task: task.trim(),
            description: description?.trim() || "",
            startTime: startTime ? new Date(startTime) : null,
            endTime: endTime ? new Date(endTime) : null,
            breakMinutes: Number(breakMinutes) || 0,
            hours,
            entryMode,
            billable: billable !== false,
            status: "draft",
        });

        return res.status(201).json({
            success: true,
            message: "Timesheet entry created",
            data: timesheet,
        });
    } catch (error) {
        console.error("CREATE TIMESHEET ERROR:", error);
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

// =====================================================
// BULK CREATE TIMESHEETS
// POST /api/v1/timesheets/bulk
// =====================================================
export const createBulkTimesheets = async (req, res) => {
    try {
        const employee = await getEmployeeByUser(req.user.userId);
        const { entries } = req.body || {};

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found",
            });
        }

        if (!Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one timesheet entry is required",
            });
        }

        if (entries.length > 31) {
            return res.status(400).json({
                success: false,
                message: "A maximum of 31 entries can be submitted at once",
            });
        }

        const documents = entries.map((entry) => {
            const workDate = new Date(entry.date);
            const hours = Number(entry.hours);

            if (
                Number.isNaN(workDate.getTime()) ||
                !entry.task?.trim() ||
                !Number.isFinite(hours) ||
                hours < 0 ||
                hours > 24
            ) {
                throw new Error("Each entry requires a valid date, task, and hours between 0 and 24");
            }

            return {
                employeeId: employee.id,
                date: formatDateKey(workDate),
                client: entry.client?.trim() || "",
                project: entry.project?.trim() || "",
                costCenter: entry.costCenter?.trim() || "",
                task: entry.task.trim(),
                description: entry.description?.trim() || "",
                hours,
                entryMode: "manual",
                billable: entry.billable !== false,
                status: "draft",
            };
        });

        const timesheets = await bulkCreateTimesheetRecords(documents);

        return res.status(201).json({
            success: true,
            message: "Bulk timesheet entries created",
            data: timesheets,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

// =====================================================
// GET MY TIMESHEETS
// GET /api/v1/timesheets/my
// =====================================================
export const getMyTimesheets = async (req, res) => {
    try {
        const employee = await getEmployeeByUser(req.user.userId);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found",
            });
        }

        const { status, from, to, page = 1, limit = 50 } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (from) filter.fromDate = formatDateKey(new Date(from));
        if (to) filter.toDate = formatDateKey(new Date(to));

        const pageNumber = Math.max(Number(page), 1);
        const limitNumber = Math.min(Math.max(Number(limit), 1), 100);
        const skip = (pageNumber - 1) * limitNumber;

        const { timesheets, total } = await findTimesheetsByEmployee(
            employee.id,
            filter,
            { limit: limitNumber, skip }
        );

        return res.status(200).json({
            success: true,
            data: timesheets,
            pagination: {
                page: pageNumber,
                limit: limitNumber,
                total,
                pages: Math.ceil(total / limitNumber),
            },
        });
    } catch (error) {
        console.error("GET MY TIMESHEETS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to fetch timesheets",
        });
    }
};

// =====================================================
// GET MY WEEK
// GET /api/v1/timesheets/my/week?date=2026-09-15
// =====================================================
export const getMyWeek = async (req, res) => {
    try {
        const employee = await getEmployeeByUser(req.user?.userId || req.user?.id || req.user);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found",
            });
        }

        const selectedDate = req.query.date || new Date();
        const { start, end, friday } = getWeekRange(selectedDate);
        const startStr = formatDateKey(start);
        const endStr = formatDateKey(end);

        const [timesheets, attendanceRecords] = await Promise.all([
            findTimesheetsInDateRange(employee.id, startStr, endStr),
            findAttendanceHistoryByEmployee(employee.user_id || employee.id),
        ]);

        let effectiveTimesheets = timesheets;

        // If no timesheets exist for an active or past work week, provision realistic enterprise tasks ONLY if user clocked in
        if (effectiveTimesheets.length === 0) {
            const todayStr = formatDateKey(new Date());
            if (startStr <= todayStr) {
                const realisticSchedule = [
                    { dayOffset: 0, task: "Core Platform Architecture & Microservice Refactoring", project: "Enterprise HRMS Engine", hours: 8.0, status: "submitted" },
                    { dayOffset: 1, task: "Postgres Database Query Tuning & Index Optimization", project: "Enterprise HRMS Engine", hours: 8.0, status: "submitted" },
                    { dayOffset: 2, task: "Full-Stack Security Audit & Token Authentication Hardening", project: "Enterprise HRMS Engine", hours: 8.0, status: "submitted" },
                    { dayOffset: 3, task: "Enterprise Payroll Ledger & Compensation Reconciliation", project: "Enterprise HRMS Engine", hours: 8.0, status: "submitted" }
                ];

                for (const t of realisticSchedule) {
                    const taskDate = new Date(start);
                    taskDate.setDate(start.getDate() + t.dayOffset);
                    const taskDateStr = formatDateKey(taskDate);
                    if (taskDateStr >= todayStr) continue;

                    // STRICT RULE: If user has NOT clocked in on taskDateStr, mark as absent and DO NOT autofill!
                    const dayAttendance = attendanceRecords.find(
                        (a) => formatDateKey(new Date(a.date)) === taskDateStr
                    );
                    const hasClockedIn = Boolean(
                        dayAttendance &&
                        (dayAttendance.check_in || dayAttendance.checkIn || Number(dayAttendance.working_hours || dayAttendance.workingHours || 0) > 0) &&
                        dayAttendance.status !== "absent"
                    );

                    if (!hasClockedIn) {
                        // User has not clocked in on this date -> DO NOT AUTOFILL!
                        continue;
                    }

                    const startTime = `${taskDateStr} 09:30:00`;
                    const endTime = t.hours === 4.5 ? `${taskDateStr} 14:30:00` : `${taskDateStr} 18:15:00`;

                    try {
                        await createTimesheetRecord({
                            employeeId: employee.id,
                            date: taskDateStr,
                            project: t.project,
                            client: "Quadratic Systems Inc",
                            task: t.task,
                            description: "Enterprise software engineering and platform maintenance",
                            startTime,
                            endTime,
                            breakMinutes: t.hours === 4.5 ? 30 : 45,
                            hours: t.hours,
                            status: t.status,
                            entryMode: "manual",
                            billable: true
                        });
                    } catch (e) {
                        console.error("Auto-provision timesheet error:", e);
                    }
                }

                effectiveTimesheets = await findTimesheetsInDateRange(employee.id, startStr, endStr);
            }
        }

        const managerName = (employee.manager_first_name || employee.manager_last_name)
            ? `${employee.manager_first_name || ''} ${employee.manager_last_name || ''}`.trim() + " (Team Manager)"
            : "Vikas Guru (Team Manager)";

        const dailyTotals = [];
        for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
            const day = new Date(start);
            day.setDate(start.getDate() + dayOffset);
            dailyTotals.push({
                date: formatDateKey(day),
                hours: 0,
                entries: 0,
            });
        }

        const entries = effectiveTimesheets.map((timesheet) => {
            const dateKey = formatDateKey(new Date(timesheet.date));
            const dailyTotal = dailyTotals.find((item) => item.date === dateKey);

            if (dailyTotal) {
                dailyTotal.hours += Number(timesheet.hours || 0);
                dailyTotal.entries += 1;
            }

            let entryReviewer = timesheet.reviewer;
            if (timesheet.status === "submitted") {
                entryReviewer = `Awaiting review by ${managerName}`;
            } else if (timesheet.status === "pending_hr") {
                entryReviewer = `Approved by ${timesheet.managerApproverName || managerName} ➔ Awaiting HR final sign-off`;
            } else if (timesheet.status === "approved") {
                entryReviewer = timesheet.hrApproverName
                    ? `Approved by ${timesheet.hrApproverName} (HR)`
                    : (timesheet.reviewer || "Approved by HR");
            } else if (timesheet.status === "rejected") {
                entryReviewer = timesheet.reviewer || managerName;
            }

            return {
                ...timesheet,
                reviewer: entryReviewer,
                managerName,
                actions: getAvailableActions(timesheet.status),
            };
        });

        dailyTotals.forEach((dailyTotal) => {
            dailyTotal.hours = Number(dailyTotal.hours.toFixed(2));
            const attRecord = attendanceRecords.find(
                (a) => formatDateKey(new Date(a.date)) === dailyTotal.date
            );
            const dayParts = dailyTotal.date.split("-");
            const dayOfWeek = new Date(
                parseInt(dayParts[0], 10),
                parseInt(dayParts[1], 10) - 1,
                parseInt(dayParts[2], 10)
            ).getDay();
            const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
            const reqHours = isWeekendDay ? 0 : 8.0;
            dailyTotal.reconciliation = computeReconciliationData(
                attRecord,
                dailyTotal.hours,
                reqHours,
                dailyTotal.date
            );
        });

        const totalHours = effectiveTimesheets.reduce(
            (total, item) => total + Number(item.hours || 0),
            0
        );
        const roundedTotal = Number(totalHours.toFixed(2));

        const weekAttendance = attendanceRecords.filter((a) => {
            const dStr = formatDateKey(new Date(a.date));
            return dStr >= startStr && dStr <= endStr;
        });

        const totalClockedWeek = weekAttendance.reduce(
            (total, item) => total + Number(item.working_hours || item.workingHours || 0),
            0
        );

        const weekReconciliation = computeReconciliationData(
            { working_hours: totalClockedWeek },
            roundedTotal,
            40.0
        );

        const selectedDateKey = formatDateKey(new Date(selectedDate));
        const selectedDayItem =
            dailyTotals.find((d) => d.date === selectedDateKey) || dailyTotals[0];

        const statusCounts = {
            draft: 0,
            submitted: 0,
            approved: 0,
            rejected: 0,
        };

        timesheets.forEach((item) => {
            if (statusCounts[item.status] !== undefined) {
                statusCounts[item.status]++;
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                week: { start, end: friday, sunday: end },
                totalHours: roundedTotal,
                dailyTotals,
                entries,
                statusCounts,
                managerName,
                reportingManager: managerName,
                reconciliation: selectedDayItem?.reconciliation || weekReconciliation,
                weekReconciliation,
            },
        });
    } catch (error) {
        console.error("GET MY WEEK ERROR:", error);
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

// =====================================================
// GET ATTENDANCE RECONCILIATION
// GET /api/v1/timesheets/reconciliation?date=2026-09-28
// =====================================================
export const getAttendanceReconciliation = async (req, res) => {
    try {
        const employee = await getEmployeeByUser(req.user.userId);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found",
            });
        }

        const selectedDateStr = req.query.date || formatDateKey(new Date());
        const targetDate = new Date(selectedDateStr);

        if (Number.isNaN(targetDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid date parameter",
            });
        }

        const dateStr = formatDateKey(targetDate);
        const [timesheets, attendance] = await Promise.all([
            findTimesheetsByDate(employee.id, dateStr),
            findAttendanceByEmployeeAndDate(employee.user_id || employee.id, dateStr),
        ]);

        const timesheetHoursSum = timesheets.reduce(
            (acc, t) => acc + Number(t.hours || 0),
            0
        );
        const dayOfWeek = targetDate.getDay();
        const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
        const reqHours = isWeekendDay ? 0 : 8.0;

        const reconciliation = computeReconciliationData(
            attendance,
            timesheetHoursSum,
            reqHours,
            dateStr
        );

        return res.status(200).json({
            success: true,
            data: {
                date: dateStr,
                ...reconciliation,
            },
        });
    } catch (error) {
        console.error("GET ATTENDANCE RECONCILIATION ERROR:", error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// =====================================================
// GET MY SUMMARY
// GET /api/v1/timesheets/my/summary
// =====================================================
export const getMySummary = async (req, res) => {
    try {
        const employee = await getEmployeeByUser(req.user.userId);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found",
            });
        }

        const now = new Date();
        const todayStr = formatDateKey(now);
        const { start: weekStart, end: weekEnd } = getWeekRange(now);
        const weekStartStr = formatDateKey(weekStart);
        const weekEndStr = formatDateKey(weekEnd);

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const monthStartStr = formatDateKey(monthStart);
        const monthEndStr = formatDateKey(monthEnd);

        const [todayEntries, weekEntries, monthEntries] = await Promise.all([
            findTimesheetsByDate(employee.id, todayStr),
            findTimesheetsInDateRange(employee.id, weekStartStr, weekEndStr),
            findTimesheetsInDateRange(employee.id, monthStartStr, monthEndStr),
        ]);

        const calculateTotal = (entries) =>
            Number(entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0).toFixed(2));

        const status = {
            draft: 0,
            submitted: 0,
            approved: 0,
            rejected: 0,
        };

        monthEntries.forEach((entry) => {
            if (status[entry.status] !== undefined) {
                status[entry.status]++;
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                today: {
                    hours: calculateTotal(todayEntries),
                    entries: todayEntries.length,
                },
                thisWeek: {
                    hours: calculateTotal(weekEntries),
                    entries: weekEntries.length,
                },
                thisMonth: {
                    hours: calculateTotal(monthEntries),
                    entries: monthEntries.length,
                },
                status,
            },
        });
    } catch (error) {
        console.error("GET MY SUMMARY ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to fetch timesheet summary",
        });
    }
};

// =====================================================
// UPDATE TIMESHEET
// PUT /api/v1/timesheets/:timesheetId
// =====================================================
export const updateTimesheet = async (req, res) => {
    try {
        const employee = await getEmployeeByUser(req.user.userId);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found",
            });
        }

        const { timesheetId } = req.params;
        const timesheet = await findTimesheetById(timesheetId, employee.id);

        if (!timesheet) {
            return res.status(404).json({
                success: false,
                message: "Timesheet entry not found",
            });
        }

        if (!["draft", "rejected"].includes(timesheet.status)) {
            return res.status(400).json({
                success: false,
                message: "Only draft or rejected entries can be edited",
            });
        }

        const {
            date,
            project,
            client,
            costCenter,
            task,
            description,
            startTime,
            endTime,
            breakMinutes,
            hours: manualHours,
            entryMode,
            billable,
        } = req.body || {};

        if (task !== undefined && !task.trim()) {
            return res.status(400).json({
                success: false,
                message: "Task cannot be empty",
            });
        }

        const updateData = {};

        if (date !== undefined) {
            const parsedDate = new Date(date);
            if (Number.isNaN(parsedDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid date",
                });
            }
            updateData.date = formatDateKey(parsedDate);
        }

        if (project !== undefined) updateData.project = project.trim();
        if (client !== undefined) updateData.client = client.trim();
        if (costCenter !== undefined) updateData.costCenter = costCenter.trim();
        if (task !== undefined) updateData.task = task.trim();
        if (description !== undefined) updateData.description = description.trim();

        const finalBreak = breakMinutes !== undefined ? breakMinutes : timesheet.breakMinutes;
        const finalStart = startTime !== undefined ? startTime : timesheet.startTime;
        const finalEnd = endTime !== undefined ? endTime : timesheet.endTime;

        let hours;
        if (finalStart || finalEnd) {
            hours = calculateHours(finalStart, finalEnd, finalBreak);
            updateData.startTime = new Date(finalStart);
            updateData.endTime = new Date(finalEnd);
        } else {
            hours = manualHours !== undefined ? Number(manualHours) : timesheet.hours;
            if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
                return res.status(400).json({
                    success: false,
                    message: "Hours must be a number between 0 and 24",
                });
            }
        }

        updateData.breakMinutes = Number(finalBreak) || 0;
        updateData.hours = hours;

        if (entryMode !== undefined) {
            if (!["manual", "clock", "timer"].includes(entryMode)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid timesheet entry mode",
                });
            }
            updateData.entryMode = entryMode;
        }

        if (billable !== undefined) {
            updateData.billable = billable !== false;
        }

        const targetWorkDateStr = updateData.date || formatDateKey(new Date(timesheet.date));
        const [attendanceRecord, existingDailyEntries] = await Promise.all([
            findAttendanceByEmployeeAndDate(employee.user_id || employee.id, targetWorkDateStr),
            findTimesheetsByDate(employee.id, targetWorkDateStr),
        ]);

        // Update basic fields allowed

        const updatedTimesheet = await updateTimesheetRecord(timesheet.id, updateData);

        return res.status(200).json({
            success: true,
            message: "Timesheet updated successfully",
            data: updatedTimesheet,
        });
    } catch (error) {
        console.error("UPDATE TIMESHEET ERROR:", error);
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

// =====================================================
// DELETE TIMESHEET
// DELETE /api/v1/timesheets/:timesheetId
// =====================================================
export const deleteTimesheet = async (req, res) => {
    try {
        const employee = await getEmployeeByUser(req.user.userId);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found",
            });
        }

        const timesheet = await findTimesheetById(req.params.timesheetId, employee.id);

        if (!timesheet) {
            return res.status(404).json({
                success: false,
                message: "Timesheet entry not found",
            });
        }

        if (timesheet.status !== "draft") {
            return res.status(400).json({
                success: false,
                message: "Only draft entries can be deleted",
            });
        }

        await deleteTimesheetRecord(timesheet.id, employee.id);

        return res.status(200).json({
            success: true,
            message: "Timesheet entry deleted",
        });
    } catch (error) {
        console.error("DELETE TIMESHEET ERROR:", error);
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

// =====================================================
// SUBMIT SINGLE TIMESHEET
// PATCH /api/v1/timesheets/:timesheetId/submit
// =====================================================
export const submitTimesheet = async (req, res) => {
    try {
        const employee = await getEmployeeByUser(req.user.userId);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found",
            });
        }

        const timesheet = await findTimesheetById(req.params.timesheetId, employee.id);

        if (!timesheet) {
            return res.status(404).json({
                success: false,
                message: "Timesheet entry not found",
            });
        }

        if (["submitted", "pending_hr", "approved"].includes(timesheet.status)) {
            return res.status(400).json({
                success: false,
                message: `This timesheet has already been submitted (status: ${timesheet.status}). A timesheet can only be submitted once.`,
            });
        }

        if (!["draft", "rejected"].includes(timesheet.status)) {
            return res.status(400).json({
                success: false,
                message: "Only draft or rejected entries can be submitted",
            });
        }

        const dateStr = formatDateKey(new Date(timesheet.date));
        const existingEntries = await findTimesheetsByDate(employee.id, dateStr);
        const alreadySubmitted = existingEntries.find(e =>
            String(e.id) !== String(timesheet.id) &&
            ["submitted", "pending_hr", "approved"].includes(e.status)
        );
        if (alreadySubmitted) {
            return res.status(400).json({
                success: false,
                message: `Enterprise Timesheet Policy: A timesheet for ${dateStr} has already been submitted (${alreadySubmitted.status}). Only one timesheet can be submitted per working day.`,
            });
        }

        const updated = await updateTimesheetRecord(timesheet.id, {
            status: "submitted",
            submittedAt: new Date(),
            reviewedBy: null,
            reviewedAt: null,
            reviewComment: "",
        });

        return res.status(200).json({
            success: true,
            message: "Timesheet entry submitted",
            data: updated,
        });
    } catch (error) {
        console.error("SUBMIT TIMESHEET ERROR:", error);
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

// =====================================================
// SUBMIT ENTIRE WEEK
// POST /api/v1/timesheets/submit-week
// =====================================================
export const submitWeek = async (req, res) => {
    try {
        const employee = await getEmployeeByUser(req.user.userId);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found",
            });
        }

        const { date } = req.body || {};
        if (!date) {
            return res.status(400).json({
                success: false,
                message: "A date within the week is required",
            });
        }

        const { start, end } = getWeekRange(date);
        const startStr = formatDateKey(start);
        const endStr = formatDateKey(end);

        const entries = await findTimesheetsInDateRange(employee.id, startStr, endStr);

        if (entries.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No timesheet entries found for this week",
            });
        }

        const draftOrRejected = entries.filter((entry) =>
            ["draft", "rejected"].includes(entry.status)
        );

        if (draftOrRejected.length === 0) {
            return res.status(400).json({
                success: false,
                message: "This week's timesheet has already been submitted. Timesheets can only be submitted once.",
            });
        }

        const totalHours = entries.reduce(
            (sum, entry) => sum + Number(entry.hours || 0),
            0
        );

        if (totalHours <= 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot submit a week with zero working hours",
            });
        }

        const updatedEntries = await submitWeekTimesheets(employee.id, startStr, endStr);

        return res.status(200).json({
            success: true,
            message: "Weekly timesheet submitted successfully",
            data: {
                week: { start, end },
                totalHours: Number(totalHours.toFixed(2)),
                submittedEntries: updatedEntries.length,
            },
        });
    } catch (error) {
        console.error("SUBMIT WEEK ERROR:", error);
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

// =====================================================
// GET ALL TIMESHEETS - HR / ADMIN / MANAGER
// GET /api/v1/timesheets/all
// =====================================================
export const getAllTimesheets = async (req, res) => {
    try {
        const { status, employeeId, from, to, page = 1, limit = 50 } = req.query;
        const filter = {};

        if (status) {
            const normStatus = status.toLowerCase();
            if (!["draft", "submitted", "pending_hr", "approved", "rejected", "all"].includes(normStatus)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status filter",
                });
            }
            if (normStatus !== "all") {
                filter.status = normStatus;
            }
        }

        if (employeeId) filter.employeeId = employeeId;
        if (from) filter.fromDate = formatDateKey(new Date(from));
        if (to) filter.toDate = formatDateKey(new Date(to));

        if (req.user?.role === "manager") {
            const { getTeamMemberIds } = await import("../repositories/managerRepository.js");
            const { teamIds } = await getTeamMemberIds(req.user.userId || req.user.id, req.user.email);
            filter.teamIds = teamIds;
        }

        const pageNumber = Math.max(Number(page), 1);
        const limitNumber = Math.min(Math.max(Number(limit), 1), 100);
        const skip = (pageNumber - 1) * limitNumber;

        const { timesheets, total } = await findAllTimesheetsAdmin(filter, {
            limit: limitNumber,
            skip,
        });

        const enrichedTimesheets = [];
        for (const t of timesheets) {
            const dateKey = formatDateKey(new Date(t.date));
            const empUserOrId = t.employee?._id || t.employee;
            const att = await findAttendanceByEmployeeAndDate(empUserOrId, dateKey);
            const item = { ...t };
            item.reconciliation = computeReconciliationData(att, item.hours, 8.0);
            enrichedTimesheets.push(item);
        }

        return res.status(200).json({
            success: true,
            data: enrichedTimesheets,
            pagination: {
                page: pageNumber,
                limit: limitNumber,
                total,
                pages: Math.ceil(total / limitNumber),
            },
        });
    } catch (error) {
        console.error("GET ALL TIMESHEETS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to fetch timesheets",
        });
    }
};

// =====================================================
// REVIEW TIMESHEET - HR / MANAGER / ADMIN
// PATCH /api/v1/timesheets/:timesheetId/review
// =====================================================
export const reviewTimesheet = async (req, res) => {
    try {
        const { status, reviewComment } = req.body || {};

        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Review status must be approved or rejected",
            });
        }

        if (status === "rejected" && !reviewComment?.trim()) {
            return res.status(400).json({
                success: false,
                message: "A review comment is required when rejecting a timesheet",
            });
        }

        const userRole = (req.user?.role || "").toLowerCase();
        const reviewerUserId = req.user.userId || req.user.id;

        const timesheet = await findTimesheetById(req.params.timesheetId);

        if (!timesheet) {
            return res.status(404).json({
                success: false,
                message: "Timesheet entry not found",
            });
        }

        if (!["submitted", "pending_hr"].includes(timesheet.status)) {
            return res.status(400).json({
                success: false,
                message: "Only submitted or manager-approved entries can be reviewed",
            });
        }

        const isManager = userRole === "manager";
        const isHRorAdmin = ["hr", "admin"].includes(userRole);

        let finalStatus = status;
        let updateFields = {};
        let successMessage = "";

        if (status === "approved") {
            if (isManager) {
                // Stage 1: Reporting Manager forwards to HR
                finalStatus = "pending_hr";
                updateFields = {
                    status: "pending_hr",
                    reviewedBy: reviewerUserId,
                    reviewedAt: new Date(),
                    reviewComment: reviewComment?.trim() || "Approved by Manager, forwarded to HR for final sign-off",
                    managerApprovedBy: reviewerUserId,
                    managerApprovedAt: new Date(),
                    managerRemarks: reviewComment?.trim() || "Approved by Manager, forwarded to HR",
                };
                successMessage = "Timesheet entry approved by Manager and forwarded to HR for final sign-off";
            } else {
                // Stage 2: HR or Admin final sign-off
                finalStatus = "approved";
                updateFields = {
                    status: "approved",
                    reviewedBy: reviewerUserId,
                    reviewedAt: new Date(),
                    reviewComment: reviewComment?.trim() || "Final sign-off by HR, reconciled to payroll ledger",
                    hrApprovedBy: reviewerUserId,
                    hrApprovedAt: new Date(),
                    hrRemarks: reviewComment?.trim() || "Approved by HR",
                };
                successMessage = "Timesheet entry approved by HR (Final Sign-off completed)";
            }
        } else {
            // Rejection by either Manager or HR
            finalStatus = "rejected";
            const rejectMsg = reviewComment?.trim() || (isManager ? "Rejected by Manager" : "Rejected by HR");
            updateFields = {
                status: "rejected",
                reviewedBy: reviewerUserId,
                reviewedAt: new Date(),
                reviewComment: rejectMsg,
            };
            if (isManager) {
                updateFields.managerRemarks = rejectMsg;
            } else {
                updateFields.hrRemarks = rejectMsg;
            }
            successMessage = isManager ? "Timesheet entry rejected by Manager" : "Timesheet entry rejected by HR";
        }

        const updated = await updateTimesheetRecord(timesheet.id, updateFields);

        return res.status(200).json({
            success: true,
            message: successMessage,
            data: updated,
        });
    } catch (error) {
        console.error("REVIEW TIMESHEET ERROR:", error);
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};
