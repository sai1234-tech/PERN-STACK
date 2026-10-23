import { findResignationById } from "../repositories/resignationRepository.js";
import { findEmployeeByUserId, updateEmployeeRecord, findEmployeeById } from "../repositories/employeeRepository.js";
import {
    findClearanceByResignationId,
    findClearanceByEmployeeId,
    findClearanceById,
    createClearanceRecord,
    findAllClearancesRepo,
    updateClearanceCategoryRepo,
    updateFinalSettlementRepo,
    updateRelievingLetterRepo
} from "../repositories/clearanceRepository.js";

const getUserId = (req) => req.user?.userId || req.user?.id || req.user?._id;

// Initialize clearance when HR approves resignation
export const initiateClearance = async (req, res) => {
    try {
        const { resignationId } = req.body;
        if (!resignationId) {
            return res.status(400).json({ success: false, message: "resignationId is required" });
        }

        const resignation = await findResignationById(resignationId);
        if (!resignation) {
            return res.status(404).json({ success: false, message: "Resignation not found" });
        }

        // Check if clearance already exists
        let clearance = await findClearanceByResignationId(resignationId);
        if (!clearance) {
            const empId = typeof resignation.employee === "object" ? resignation.employee.id : resignation.employee;
            clearance = await createClearanceRecord(empId, resignationId);
        }

        return res.status(201).json({ success: true, data: clearance });
    } catch (error) {
        console.error("initiateClearance error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Get all clearances for HR Dashboard
export const getAllClearances = async (req, res) => {
    try {
        const clearances = await findAllClearancesRepo();
        return res.status(200).json({ success: true, data: clearances });
    } catch (error) {
        console.error("getAllClearances error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Get employee's own clearance
export const getMyClearance = async (req, res) => {
    try {
        const userId = getUserId(req);
        const employee = await findEmployeeByUserId(userId);
        if (!employee) {
            return res.status(404).json({ success: false, message: "Employee not found" });
        }

        const clearance = await findClearanceByEmployeeId(employee.id);
        return res.status(200).json({ success: true, data: clearance });
    } catch (error) {
        console.error("getMyClearance error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Update a specific clearance category
export const updateClearanceCategory = async (req, res) => {
    try {
        const { id, category } = req.params;
        const { status, comments } = req.body;
        const userId = getUserId(req);

        const validCategories = ["assets", "itAccess", "it_access", "finance", "leaveAttendance", "leave_attendance", "documents"];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ success: false, message: "Invalid category" });
        }

        const clearance = await findClearanceById(id);
        if (!clearance) {
            return res.status(404).json({ success: false, message: "Clearance record not found" });
        }

        const currentCategory = clearance[category] || {};
        const categoryData = {
            status: status || currentCategory.status || "pending",
            comments: comments !== undefined ? comments : (currentCategory.comments || ""),
            clearedBy: userId,
            clearedAt: status === "cleared" ? new Date().toISOString() : null
        };

        const updatedClearance = await updateClearanceCategoryRepo(id, category, categoryData);
        return res.status(200).json({ success: true, data: updatedClearance });
    } catch (error) {
        console.error("updateClearanceCategory error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Final Settlement Process
export const processFinalSettlement = async (req, res) => {
    try {
        const { id } = req.params;
        const { details } = req.body;

        const clearance = await findClearanceById(id);
        if (!clearance) {
            return res.status(404).json({ success: false, message: "Clearance record not found" });
        }

        const settlementData = {
            status: "processed",
            processedAt: new Date().toISOString(),
            details: details || ""
        };

        const updatedClearance = await updateFinalSettlementRepo(id, settlementData);
        return res.status(200).json({ success: true, data: updatedClearance });
    } catch (error) {
        console.error("processFinalSettlement error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Issue Relieving Letter & Complete Exit
export const completeExit = async (req, res) => {
    try {
        const { id } = req.params;
        const clearance = await findClearanceById(id);

        if (!clearance) {
            return res.status(404).json({ success: false, message: "Clearance record not found" });
        }

        const relievingLetterData = {
            issued: true,
            issuedAt: new Date().toISOString(),
            documentUrl: "/docs/relieving-letter-temp.pdf"
        };

        const updatedClearance = await updateRelievingLetterRepo(id, relievingLetterData);

        // Update global employee status to Resigned
        const empId = typeof clearance.employee === "object" ? clearance.employee.id : clearance.employee;
        if (empId) {
            const emp = await findEmployeeById(empId);
            if (emp) {
                const employmentData = { ...(emp.employment || {}), status: "Resigned" };
                await updateEmployeeRecord(empId, { employment: employmentData });
            }
        }

        return res.status(200).json({
            success: true,
            message: "Exit process fully completed. Employee status is now RESIGNED.",
            data: updatedClearance
        });
    } catch (error) {
        console.error("completeExit error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
