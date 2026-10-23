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
        let allocations = await findAllAllocations();

        // If no allocations exist yet, sync default active employees as available/bench
        if (allocations.length === 0) {
            try {
                const employees = await findAllEmployees();
                for (const emp of employees.slice(0, 8)) {
                    await upsertAllocationRecord({
                        empId: String(emp.id),
                        employeeName: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.name || "Employee",
                        employeeCode: emp.employeeCode || "",
                        department: emp.department || emp.employment?.department || "Engineering",
                        role: emp.designation || emp.role || "Developer",
                        projectName: emp.id % 2 === 0 ? "Project Titan" : "Project Phoenix",
                        clientName: "Enterprise Global Client",
                        status: emp.id % 2 === 0 ? "Allocated" : "Bench",
                        billability: emp.id % 2 === 0 ? "Billable" : "Internal",
                        allocationPercentage: 100
                    });
                }
                allocations = await findAllAllocations();
            } catch (seedErr) {
                console.warn("Notice: Initial allocation seed fallback:", seedErr.message);
            }
        }

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
