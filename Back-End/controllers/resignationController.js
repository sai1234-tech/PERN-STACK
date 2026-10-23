import { findEmployeeById, findEmployeeByUserId, updateEmployeeRecord } from "../repositories/employeeRepository.js";
import {
    findActiveResignationByEmployee,
    createResignationRecord,
    findResignationByEmployee,
    findResignationById,
    findAllResignationsAdmin,
    updateResignationRecord,
} from "../repositories/resignationRepository.js";

const getEmployeeByUser = async (userId) => {
    return await findEmployeeByUserId(userId);
};

// =====================================================
// EMPLOYEE: SUBMIT RESIGNATION
// POST /api/v1/resignations
// =====================================================
export const submitResignation = async (req, res) => {
    try {
        const employee = await getEmployeeByUser(req.user.userId);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found",
            });
        }

        const existing = await findActiveResignationByEmployee(employee.id);
        if (existing) {
            return res.status(400).json({
                success: false,
                message: `You already have an active resignation request with status '${existing.status}'.`,
                data: existing,
            });
        }

        const requestedLastWorkingDay = req.body?.requestedLastWorkingDay || req.body?.lastWorkingDay;
        const reasonCategory = req.body?.reasonCategory || "Career Growth";
        const reasonDetails = req.body?.reasonDetails || req.body?.reason || req.body?.comments || "";

        if (!requestedLastWorkingDay || !reasonDetails.trim()) {
            return res.status(400).json({
                success: false,
                message: "Requested last working day and detailed reason notes are required.",
            });
        }

        const lwdDate = new Date(requestedLastWorkingDay);
        if (Number.isNaN(lwdDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid requested last working day date",
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const timeDiff = lwdDate.getTime() - today.getTime();
        const diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));

        if (diffDays < 90) {
            return res.status(400).json({
                success: false,
                message: "A minimum of 90 days notice period is required.",
            });
        }

        const initialStatus = req.user.role === "manager" ? "manager_approved" : "pending";
        const managerReviewComment = req.user.role === "manager" ? "Auto-approved (Submitter is a Manager)" : "";

        const resignation = await createResignationRecord({
            employeeId: employee.id,
            resignationDate: new Date(),
            noticePeriodDays: 90,
            requestedLastWorkingDay: lwdDate,
            reasonCategory,
            reasonDetails: reasonDetails.trim(),
            status: initialStatus,
            managerReviewComment,
        });

        return res.status(201).json({
            success: true,
            message: "Resignation submitted successfully. Your HR manager will review your request.",
            data: resignation,
        });
    } catch (error) {
        console.error("SUBMIT RESIGNATION ERROR:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// =====================================================
// EMPLOYEE: GET MY RESIGNATION
// GET /api/v1/resignations/my
// =====================================================
export const getMyResignation = async (req, res) => {
    try {
        const employee = await getEmployeeByUser(req.user.userId);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found",
            });
        }

        const resignation = await findResignationByEmployee(employee.id);

        return res.status(200).json({
            success: true,
            data: resignation || null,
        });
    } catch (error) {
        console.error("GET MY RESIGNATION ERROR:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// =====================================================
// EMPLOYEE: WITHDRAW RESIGNATION
// DELETE /api/v1/resignations/my
// =====================================================
export const cancelResignation = async (req, res) => {
    try {
        const employee = await getEmployeeByUser(req.user.userId);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found",
            });
        }

        const resignation = await findActiveResignationByEmployee(employee.id, ["pending", "manager_approved", "under_review"]);

        if (!resignation) {
            return res.status(400).json({
                success: false,
                message: "No pending or under-review resignation request found to withdraw.",
            });
        }

        const updated = await updateResignationRecord(resignation.id, { status: "cancelled" });

        return res.status(200).json({
            success: true,
            message: "Resignation request withdrawn successfully.",
            data: updated,
        });
    } catch (error) {
        console.error("CANCEL RESIGNATION ERROR:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// =====================================================
// HR / ADMIN: GET ALL RESIGNATIONS
// GET /api/v1/resignations/all
// =====================================================
export const getAllResignations = async (req, res) => {
    try {
        const { status, page = 1, limit = 50 } = req.query;
        const filter = {};
        if (status) filter.status = status;

        const pageNumber = Math.max(Number(page), 1);
        const limitNumber = Math.min(Math.max(Number(limit), 1), 100);
        const skip = (pageNumber - 1) * limitNumber;

        const { resignations, total } = await findAllResignationsAdmin(filter, { limit: limitNumber, skip });

        return res.status(200).json({
            success: true,
            data: resignations,
            pagination: {
                total,
                page: pageNumber,
                pages: Math.ceil(total / limitNumber),
            },
        });
    } catch (error) {
        console.error("GET ALL RESIGNATIONS ERROR:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// =====================================================
// HR / ADMIN: REVIEW RESIGNATION (APPROVE / REJECT)
// PATCH /api/v1/resignations/:resignationId/review
// =====================================================
export const reviewResignation = async (req, res) => {
    try {
        const { resignationId } = req.params;
        const { status, approvedLastWorkingDay, hrReviewComment } = req.body || {};

        const normalizedStatus = String(status || "").toLowerCase();
        if (!["approved", "rejected", "under_review"].includes(normalizedStatus)) {
            return res.status(400).json({
                success: false,
                message: "Status must be approved, rejected, or under_review",
            });
        }

        const resignation = await findResignationById(resignationId);
        if (!resignation) {
            return res.status(404).json({
                success: false,
                message: "Resignation request not found",
            });
        }

        const updateData = {
            status: normalizedStatus,
            hrReviewComment: hrReviewComment?.trim() || "",
            reviewedBy: req.user.userId,
            reviewedAt: new Date(),
        };

        if (normalizedStatus === "approved") {
            const finalLwd = approvedLastWorkingDay
                ? new Date(approvedLastWorkingDay)
                : resignation.requestedLastWorkingDay;

            updateData.approvedLastWorkingDay = finalLwd;

            if (resignation.employee) {
                const empId = typeof resignation.employee === "object" ? (resignation.employee.id || resignation.employee._id) : resignation.employee;
                const empObj = await findEmployeeById(empId);
                const employment = empObj?.employment || {};
                employment.status = "Notice Period";
                await updateEmployeeRecord(empId, { employment });
            }
        }

        const updated = await updateResignationRecord(resignation.id, updateData);

        return res.status(200).json({
            success: true,
            message: `Resignation request ${status} successfully.`,
            data: updated,
        });
    } catch (error) {
        console.error("REVIEW RESIGNATION ERROR:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// =====================================================
// MANAGER: GET TEAM RESIGNATIONS
// GET /api/v1/resignations/team
// =====================================================
export const getTeamResignations = async (req, res) => {
    try {
        const { resignations } = await findAllResignationsAdmin({ status: "pending" });
        return res.status(200).json({
            success: true,
            data: resignations,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// =====================================================
// MANAGER: REVIEW RESIGNATION
// PATCH /api/v1/resignations/:resignationId/manager-review
// =====================================================
export const managerReviewResignation = async (req, res) => {
    try {
        const { resignationId } = req.params;
        const { status, managerReviewComment } = req.body || {};

        if (!["manager_approved", "manager_rejected"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        const resignation = await findResignationById(resignationId);
        if (!resignation) return res.status(404).json({ success: false, message: "Not found" });

        const updated = await updateResignationRecord(resignation.id, {
            status,
            managerReviewComment: managerReviewComment || "",
            managerReviewedBy: req.user.userId,
        });

        return res.status(200).json({ success: true, message: `Resignation marked as ${status.replace("_", " ")}`, data: updated });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
