import {
    initLeaveTables,
    createLeaveTypeRecord,
    findLeaveTypeById,
    findLeaveTypeByCodeOrName,
    findAllLeaveTypes,
    updateLeaveTypeRecord,
    createLeaveRecord,
    findLeaveById,
    findOverlappingLeave,
    findEmployeeLeavesForYear,
    findLeavesByEmployee,
    findAllLeaves,
    updateLeaveRecord
} from "../repositories/leaveRepository.js";
import {
    findEmployeeById,
    findEmployeeByUserId,
    findEmployeeByCodeOrEmail
} from "../repositories/employeeRepository.js";
import { findUserById } from "../repositories/userRepository.js";
import { provisionEmployeeForUser } from "./authController.js";
import { broadcastBackendChange } from "../services/sseService.js";

// Helper date calculator (excludes Saturdays & Sundays)
export const calculateLeaveDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;

    let current = new Date(start);
    let workingDays = 0;

    while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclude Sunday (0) & Saturday (6)
            workingDays++;
        }
        current.setDate(current.getDate() + 1);
    }

    return workingDays;
};

// Format leave response
const formatLeaveResponse = (leave) => {
    if (!leave) return null;
    return {
        _id: leave.id,
        id: leave.id,
        employee: {
            _id: leave.employee_id,
            id: leave.employee_id,
            employeeCode: leave.employee_code || "",
            name: `${leave.employee_first_name || ""} ${leave.employee_last_name || ""}`.trim(),
            firstName: leave.employee_first_name || "",
            lastName: leave.employee_last_name || "",
            email: leave.employee_email || "",
            reportsTo: leave.reports_to || null
        },
        leaveType: {
            _id: leave.leave_type_id,
            id: leave.leave_type_id,
            name: leave.leave_type_name || "",
            code: leave.leave_type_code || "",
            annualAllocation: Number(leave.annual_allocation || 0),
            isPaid: leave.is_paid ?? true
        },
        startDate: leave.start_date,
        endDate: leave.end_date,
        numberOfDays: Number(leave.number_of_days || 0),
        reason: leave.reason,
        status: leave.status,
        appliedAt: leave.applied_at,
        reportingManager: leave.reporting_manager_first_name ? {
            name: `${leave.reporting_manager_first_name} ${leave.reporting_manager_last_name || ""}`.trim(),
            email: leave.reporting_manager_email || ""
        } : null,
        assignedHr: {
            name: `${leave.assigned_hr_first_name || "Lakshmi"} ${leave.assigned_hr_last_name || "Ragula"}`.trim(),
            email: leave.assigned_hr_email || "lragula@quadratics.com"
        },
        managerApprovedBy: leave.manager_approved_by ? {
            id: leave.manager_approved_by,
            name: leave.manager_approved_by_name || "Manager",
            email: leave.manager_approved_by_email || ""
        } : null,
        managerApprovedAt: leave.manager_approved_at || null,
        managerRemarks: leave.manager_remarks || "",
        hrApprovedBy: leave.hr_approved_by ? {
            id: leave.hr_approved_by,
            name: leave.hr_approved_by_name || "HR Admin",
            email: leave.hr_approved_by_email || ""
        } : null,
        hrApprovedAt: leave.hr_approved_at || null,
        hrRemarks: leave.hr_remarks || "",
        approvedBy: leave.approved_by ? {
            id: leave.approved_by,
            name: leave.approved_by_name || "",
            email: leave.approved_by_email || "",
            role: leave.approved_by_role || ""
        } : null,
        rejectionReason: leave.rejection_reason || "",
        cancelledAt: leave.cancelled_at || null,
        document: leave.document || "",
        createdAt: leave.created_at,
        updatedAt: leave.updated_at
    };
};

// Helper to ensure an employee profile exists for the user
const ensureEmployeeForUser = async (userId) => {
    let employee = await findEmployeeByUserId(userId);
    if (!employee && userId) {
        const user = await findUserById(userId);
        if (user) {
            employee = await provisionEmployeeForUser(user);
        }
    }
    return employee;
};

export const applyLeave = async (req, res) => {
    try {
        const leaveType = req.body.leaveType || req.body.leaveTypeId;
        const { startDate, endDate, reason, document } = req.body;
        const userId = req.user?.userId || req.user?.id;

        if (!leaveType || !startDate || !endDate || !reason?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Leave type, start date, end date and reason are required"
            });
        }

        const startDay = new Date(startDate).getDay();
        const endDay = new Date(endDate).getDay();
        if (startDay === 0 || startDay === 6 || endDay === 0 || endDay === 6) {
            return res.status(400).json({
                success: false,
                message: "Saturdays and Sundays are non-working weekend days and cannot be selected as leave dates."
            });
        }

        let employee = await ensureEmployeeForUser(userId);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found"
            });
        }

        // Find or create leave type
        let type = !isNaN(leaveType) ? await findLeaveTypeById(Number(leaveType)) : await findLeaveTypeByCodeOrName(String(leaveType));
        if (!type) {
            const typeStr = String(leaveType || "Casual Leave").trim();
            const code = typeStr.slice(0, 3).toUpperCase();
            try {
                type = await createLeaveTypeRecord({
                    name: typeStr.toLowerCase() === "wfh" ? "Work From Home" : typeStr,
                    code: code || "LV",
                    annualAllocation: typeStr.toLowerCase() === "wfh" ? 48 : 12,
                    isPaid: true
                });
            } catch (e) {
                const types = await findAllLeaveTypes(true);
                type = types[0];
            }
        }

        if (!type) {
            return res.status(404).json({
                success: false,
                message: "Leave type not found or inactive"
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ success: false, message: "Invalid date format" });
        }

        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        if (start > end) {
            return res.status(400).json({ success: false, message: "Start date cannot be after end date" });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (start < today) {
            return res.status(400).json({ success: false, message: "Leave cannot be applied for a past date" });
        }

        const numberOfDays = calculateLeaveDays(start, end);
        if (numberOfDays <= 0) {
            return res.status(400).json({ success: false, message: "Invalid number of leave days" });
        }

        // Check overlapping leave
        const overlapping = await findOverlappingLeave(employee.id, start, end);
        if (overlapping) {
            return res.status(400).json({
                success: false,
                message: "You already have a pending or approved leave for these dates"
            });
        }

        // Check leave balance
        const currentYear = start.getFullYear();
        const previousLeaves = await findEmployeeLeavesForYear(employee.id, currentYear, type.id);
        const usedDays = previousLeaves.reduce((total, l) => total + Number(l.number_of_days || 0), 0);

        let userAnnualAllocation = Number(type.annual_allocation || 12);
        const remainingDays = userAnnualAllocation - usedDays;

        if (numberOfDays > remainingDays && remainingDays > 0) {
            return res.status(400).json({
                success: false,
                message: `Insufficient leave balance. Available: ${Math.max(remainingDays, 0)} days`
            });
        }

        const leave = await createLeaveRecord({
            employeeId: employee.id,
            leaveTypeId: type.id,
            startDate: start,
            endDate: end,
            numberOfDays,
            reason: reason.trim(),
            document: document || "",
            status: "Pending Manager"
        });

        const populatedLeave = await findLeaveById(leave.id);
        return res.status(201).json({
            success: true,
            message: "Leave applied successfully",
            data: formatLeaveResponse(populatedLeave)
        });
    } catch (error) {
        console.error("APPLY LEAVE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to apply leave",
            error: error.message
        });
    }
};

// =====================================================
// 2. GET MY LEAVES
// =====================================================
export const getMyLeaves = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const employee = await ensureEmployeeForUser(userId);

        if (!employee) {
            return res.status(200).json({
                success: true,
                count: 0,
                data: []
            });
        }

        const leaves = await findLeavesByEmployee(employee.id);
        const formatted = leaves.map(formatLeaveResponse);

        return res.status(200).json({
            success: true,
            count: formatted.length,
            data: formatted
        });
    } catch (error) {
        console.error("GET MY LEAVES ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch leaves",
            error: error.message
        });
    }
};

// =====================================================
// 3. CANCEL LEAVE
// =====================================================
export const cancelLeave = async (req, res) => {
    try {
        const leaveId = Number(req.params.leaveId);
        const userId = req.user?.userId || req.user?.id;
        const employee = await ensureEmployeeForUser(userId);

        if (!employee) {
            return res.status(404).json({ success: false, message: "Employee profile not found" });
        }

        const leave = await findLeaveById(leaveId);
        if (!leave || Number(leave.employee_id) !== Number(employee.id)) {
            return res.status(404).json({ success: false, message: "Leave not found" });
        }

        if (!["Pending", "Approved", "Pending Manager", "Pending HR"].includes(leave.status)) {
            return res.status(400).json({
                success: false,
                message: "Only pending or approved leave can be cancelled"
            });
        }

        await updateLeaveRecord(leaveId, {
            status: "Cancelled",
            cancelled_at: new Date(),
            cancelled_by: userId
        });

        const updated = await findLeaveById(leaveId);
        return res.status(200).json({
            success: true,
            message: "Leave cancelled successfully",
            data: formatLeaveResponse(updated)
        });
    } catch (error) {
        console.error("CANCEL LEAVE ERROR:", error);
        return res.status(500).json({ success: false, message: "Failed to cancel leave", error: error.message });
    }
};

// =====================================================
// 4. GET LEAVE BALANCE
// =====================================================
export const getLeaveBalance = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const employee = await ensureEmployeeForUser(userId);

        const year = Number(req.query.year) || new Date().getFullYear();
        const leaveTypes = await findAllLeaveTypes(true);
        const result = [];

        for (const type of leaveTypes) {
            const leaves = employee ? await findEmployeeLeavesForYear(employee.id, year, type.id) : [];
            let used = 0;
            let pending = 0;

            for (const l of leaves) {
                if (l.status === "Approved") used += Number(l.number_of_days || 0);
                if (l.status && l.status.includes("Pending")) pending += Number(l.number_of_days || 0);
            }

            let userAnnualAllocation = Number(type.annual_allocation || 12);
            const available = Math.max(userAnnualAllocation - used - pending, 0);

            const isSpecialPolicy = type.code === "ML" || type.code === "WFH" || String(type.name).toLowerCase().includes("maternity") || String(type.name).toLowerCase().includes("work from home");

            result.push({
                leaveType: {
                    id: type.id,
                    name: type.name,
                    code: type.code,
                    annualAllocation: userAnnualAllocation,
                    annual_allocation: userAnnualAllocation,
                    total: userAnnualAllocation,
                    isSpecial: isSpecialPolicy
                },
                annualAllocation: userAnnualAllocation,
                annual_allocation: userAnnualAllocation,
                total: userAnnualAllocation,
                remaining: available,
                used,
                pending,
                available,
                isSpecial: isSpecialPolicy
            });
        }

        return res.status(200).json({
            success: true,
            year,
            data: result
        });
    } catch (error) {
        console.error("LEAVE BALANCE ERROR:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch leave balance", error: error.message });
    }
};

// =====================================================
// 5. HR/ADMIN - GET ALL LEAVES
// =====================================================
export const getAllLeaves = async (req, res) => {
    try {
        const { status, employee, leaveType, startDate, endDate } = req.query;
        let reportingManagerId = undefined;

        if (req.user?.role === "manager") {
            const managerEmp = await findEmployeeByUserId(req.user.userId || req.user.id);
            if (!managerEmp) {
                return res.status(200).json({ success: true, count: 0, data: [] });
            }
            reportingManagerId = managerEmp.id;
        }

        const leaves = await findAllLeaves({
            status,
            employeeId: employee,
            reportingManagerId,
            leaveTypeId: leaveType,
            startDate,
            endDate
        });

        const formatted = leaves.map(formatLeaveResponse);
        return res.status(200).json({
            success: true,
            count: formatted.length,
            data: formatted
        });
    } catch (error) {
        console.error("GET ALL LEAVES ERROR:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch leaves", error: error.message });
    }
};

// =====================================================
// 6. APPROVE LEAVE - MANAGER (STAGE 1) / HR ADMIN (STAGE 2)
// =====================================================
export const approveLeave = async (req, res) => {
    try {
        const leaveId = Number(req.params.leaveId);
        const userRole = (req.user?.role || "").toLowerCase();
        const reviewerUserId = req.user?.userId || req.user?.id;
        const remarks = req.body?.remarks || req.body?.hrRemarks || req.body?.managerRemarks || "";
        const forceOverride = Boolean(req.query?.override === "true" || req.body?.override === true);
        const leave = await findLeaveById(leaveId);

        if (!leave) {
            return res.status(404).json({ success: false, message: "Leave not found" });
        }

        if (leave.status === "Approved") {
            return res.status(400).json({
                success: false,
                message: "Leave is already approved."
            });
        }

        const isManager = userRole === "manager";

        if (isManager) {
            // Stage 1: Reporting Manager review -> Forward to HR
            const managerEmp = await findEmployeeByUserId(reviewerUserId);
            const mgrEmpId = managerEmp ? managerEmp.id : null;
            if (leave.reports_to && mgrEmpId && leave.reports_to !== mgrEmpId && leave.reports_to !== reviewerUserId) {
                return res.status(403).json({ success: false, message: "Not authorized to manage this employee's leave" });
            }

            await updateLeaveRecord(leaveId, {
                status: "Pending HR",
                manager_approved_by: reviewerUserId,
                manager_approved_at: new Date(),
                manager_remarks: remarks.trim() || "Approved by Manager, forwarded to HR for final approval",
                rejection_reason: ""
            });

            const updatedLeave = await findLeaveById(leaveId);
            broadcastBackendChange("leaves", {
                action: "manager_approved",
                leaveId,
                employeeId: leave.employee_id,
                status: "Pending HR",
                message: "Leave approved by Manager and forwarded to HR for final approval",
                leaveType: updatedLeave?.leave_type_name || "Leave"
            });

            return res.status(200).json({
                success: true,
                message: "Leave approved by Manager and forwarded to HR for final approval",
                data: formatLeaveResponse(updatedLeave)
            });
        }

        // Stage 2: HR / Admin Final Approval
        const isPendingManager = ["pending manager", "pending_manager"].includes(
            String(leave.status || "").toLowerCase()
        );

        // If employee has a reporting manager and status is still Pending Manager, require manager approval first unless force override
        if (isPendingManager && leave.reports_to && !forceOverride) {
            const mgrName = leave.reporting_manager_first_name
                ? `${leave.reporting_manager_first_name} ${leave.reporting_manager_last_name || ""}`.trim()
                : "Reporting Manager";
            return res.status(400).json({
                success: false,
                requiresManagerApproval: true,
                message: `This leave is currently pending review by Reporting Manager (${mgrName}). The manager must approve it first before HR final approval.`
            });
        }

        const overlapping = await findOverlappingLeave(leave.employee_id, leave.start_date, leave.end_date, leaveId);
        if (overlapping && overlapping.status === "Approved") {
            return res.status(400).json({
                success: false,
                message: "Employee already has an approved leave for these dates"
            });
        }

        await updateLeaveRecord(leaveId, {
            status: "Approved",
            hr_approved_by: reviewerUserId,
            hr_approved_at: new Date(),
            hr_remarks: remarks.trim() || "Final approved by HR",
            approved_by: reviewerUserId,
            approved_at: new Date(),
            rejection_reason: ""
        });

        const updatedLeave = await findLeaveById(leaveId);
        broadcastBackendChange("leaves", {
            action: "approved",
            leaveId,
            employeeId: leave.employee_id,
            status: "Approved",
            message: "Leave final approved by HR",
            leaveType: updatedLeave?.leave_type_name || "Leave"
        });
        return res.status(200).json({
            success: true,
            message: "Leave final approved by HR",
            data: formatLeaveResponse(updatedLeave)
        });
    } catch (error) {
        console.error("APPROVE LEAVE ERROR:", error);
        return res.status(500).json({ success: false, message: "Failed to approve leave", error: error.message });
    }
};

// =====================================================
// 7. REJECT LEAVE - MANAGER / HR ADMIN
// =====================================================
export const rejectLeave = async (req, res) => {
    try {
        const leaveId = Number(req.params.leaveId);
        const userRole = (req.user?.role || "").toLowerCase();
        const reviewerUserId = req.user?.userId || req.user?.id;
        const rejectionReason = req.body?.rejectionReason || req.body?.reason || req.query?.rejectionReason || (userRole === "manager" ? "Rejected by Manager" : "Rejected by HR Admin");

        const leave = await findLeaveById(leaveId);
        if (!leave) {
            return res.status(404).json({ success: false, message: "Leave not found" });
        }

        const isManager = userRole === "manager";
        const updateData = {
            status: "Rejected",
            rejection_reason: rejectionReason.trim(),
        };

        if (isManager) {
            updateData.manager_remarks = rejectionReason.trim();
        } else {
            updateData.hr_remarks = rejectionReason.trim();
            updateData.approved_by = reviewerUserId;
            updateData.approved_at = new Date();
        }

        await updateLeaveRecord(leaveId, updateData);

        const updatedLeave = await findLeaveById(leaveId);
        broadcastBackendChange("leaves", {
            action: "rejected",
            leaveId,
            employeeId: leave.employee_id,
            status: "Rejected",
            message: isManager ? "Leave request declined by Manager" : "Leave request declined by HR",
            rejectionReason: rejectionReason.trim(),
            leaveType: updatedLeave?.leave_type_name || "Leave"
        });
        return res.status(200).json({
            success: true,
            message: isManager ? "Leave declined by Manager" : "Leave rejected by HR",
            data: formatLeaveResponse(updatedLeave)
        });
    } catch (error) {
        console.error("REJECT LEAVE ERROR:", error);
        return res.status(500).json({ success: false, message: "Failed to reject leave", error: error.message });
    }
};

// =====================================================
// 8. HR/ADMIN - REVERT LEAVE DECISION
// =====================================================
export const revertLeaveDecision = async (req, res) => {
    try {
        const leaveId = Number(req.params.leaveId);
        const leave = await findLeaveById(leaveId);

        if (!leave) {
            return res.status(404).json({ success: false, message: "Leave not found" });
        }

        if (!["Approved", "Rejected", "Cancelled"].includes(leave.status)) {
            return res.status(400).json({ success: false, message: "Only approved, rejected, or cancelled leave can be reverted" });
        }


        await updateLeaveRecord(leaveId, {
            status: "Pending Manager",
            approved_by: null,
            approved_at: null,
            rejection_reason: ""
        });

        const updatedLeave = await findLeaveById(leaveId);
        return res.status(200).json({
            success: true,
            message: "Leave decision reverted",
            data: formatLeaveResponse(updatedLeave)
        });
    } catch (error) {
        console.error("REVERT LEAVE DECISION ERROR:", error);
        return res.status(500).json({ success: false, message: "Failed to revert leave decision", error: error.message });
    }
};

// =====================================================
// 9. GET LEAVE TYPES
// =====================================================
export const getLeaveTypes = async (_req, res) => {
    try {
        const leaveTypes = await findAllLeaveTypes(true);
        return res.status(200).json({
            success: true,
            count: leaveTypes.length,
            data: leaveTypes.map(t => ({
                id: t.id,
                name: t.name,
                code: t.code,
                annualAllocation: Number(t.annual_allocation),
                isPaid: t.is_paid,
                isActive: t.is_active,
                description: t.description || ""
            }))
        });
    } catch (error) {
        console.error("GET LEAVE TYPES ERROR:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch leave types", error: error.message });
    }
};

// =====================================================
// 10. HR/ADMIN - CREATE LEAVE TYPE
// =====================================================
export const createLeaveType = async (req, res) => {
    try {
        let { name, code, annualAllocation, isPaid, description } = req.body;
        name = name?.trim();
        code = code?.trim().toUpperCase();

        if (!name || !code || annualAllocation === undefined) {
            return res.status(400).json({
                success: false,
                message: "Name, code and annual allocation are required"
            });
        }

        const allocation = Number(annualAllocation);
        if (isNaN(allocation) || allocation < 0) {
            return res.status(400).json({
                success: false,
                message: "Annual allocation must be a valid non-negative number"
            });
        }

        const existing = await findLeaveTypeByCodeOrName(code) || await findLeaveTypeByCodeOrName(name);
        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Leave type name or code already exists"
            });
        }

        const leaveType = await createLeaveTypeRecord({
            name,
            code,
            annualAllocation: allocation,
            isPaid: isPaid !== undefined ? Boolean(isPaid) : true,
            description: description?.trim() || ""
        });

        return res.status(201).json({
            success: true,
            message: "Leave type created successfully",
            data: leaveType
        });
    } catch (error) {
        console.error("CREATE LEAVE TYPE ERROR:", error);
        return res.status(500).json({ success: false, message: "Failed to create leave type", error: error.message });
    }
};

// =====================================================
// 11. HR/ADMIN - UPDATE LEAVE TYPE
// =====================================================
export const updateLeaveType = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { name, code, annualAllocation, isPaid, isActive, description } = req.body;

        const leaveType = await findLeaveTypeById(id);
        if (!leaveType) {
            return res.status(404).json({ success: false, message: "Leave type not found" });
        }

        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (code !== undefined) updates.code = code.trim().toUpperCase();
        if (annualAllocation !== undefined) updates.annual_allocation = Number(annualAllocation);
        if (isPaid !== undefined) updates.is_paid = Boolean(isPaid);
        if (isActive !== undefined) updates.is_active = Boolean(isActive);
        if (description !== undefined) updates.description = description.trim();

        const updated = await updateLeaveTypeRecord(id, updates);
        return res.status(200).json({
            success: true,
            message: "Leave type updated successfully",
            data: updated
        });
    } catch (error) {
        console.error("UPDATE LEAVE TYPE ERROR:", error);
        return res.status(500).json({ success: false, message: "Failed to update leave type", error: error.message });
    }
};
