import {
    findAllAllocations,
    findAllocationByEmpId,
    upsertAllocationRecord,
    updateAllocationStatusRecord,
    deleteAllocationRecord
} from "../repositories/allocationRepository.js";
import { findAllEmployees } from "../repositories/employeeRepository.js";

export const getAllAllocations = async (req, res) => {
    try {
        const allocations = await findAllAllocations();

        return res.status(200).json({
            success: true,
            data: allocations,
            count: allocations.length
        });
    } catch (err) {
        console.error("Error fetching project allocations:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch project allocations." });
    }
};

export const getEmployeeAllocation = async (req, res) => {
    try {
        const { empId } = req.params;
        const allocation = await findAllocationByEmpId(empId);
        return res.status(200).json({
            success: true,
            data: allocation
        });
    } catch (err) {
        console.error("Error fetching employee allocation:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch employee allocation." });
    }
};

export const upsertAllocation = async (req, res) => {
    try {
        const {
            empId,
            employeeName,
            employeeCode,
            department,
            role,
            projectName,
            clientName,
            status,
            billability,
            allocationPercentage,
            startDate,
            endDate,
            sowNumber,
            notes
        } = req.body;

        if (!empId || !employeeName) {
            return res.status(400).json({ success: false, message: "Employee ID and Name are required." });
        }

        const allocation = await upsertAllocationRecord({
            empId,
            employeeName,
            employeeCode,
            department,
            role,
            projectName,
            clientName,
            status,
            billability,
            allocationPercentage,
            startDate,
            endDate,
            sowNumber,
            notes
        });

        return res.status(200).json({
            success: true,
            message: "Project allocation updated successfully.",
            data: allocation
        });
    } catch (err) {
        console.error("Error upserting project allocation:", err);
        return res.status(500).json({ success: false, message: "Failed to update project allocation." });
    }
};

export const updateAllocationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, projectName } = req.body;

        if (!status) {
            return res.status(400).json({ success: false, message: "Status is required." });
        }

        const updated = await updateAllocationStatusRecord(id, status, projectName);
        return res.status(200).json({
            success: true,
            message: `Resource status changed to ${status}.`,
            data: updated
        });
    } catch (err) {
        console.error("Error updating resource status:", err);
        return res.status(500).json({ success: false, message: "Failed to update resource status." });
    }
};

export const deleteAllocation = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await deleteAllocationRecord(id);
        return res.status(200).json({
            success: true,
            message: "Allocation removed successfully.",
            data: deleted
        });
    } catch (err) {
        console.error("Error deleting allocation:", err);
        return res.status(500).json({ success: false, message: "Failed to delete allocation." });
    }
};
