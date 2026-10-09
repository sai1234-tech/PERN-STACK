import { findEmployeeByUserId } from "../repositories/employeeRepository.js";
import {
    createOkrRecord,
    findOkrsByEmployee,
    findAllOkrsAdmin,
    findOkrById,
    updateOkrScoreRecord,
} from "../repositories/performanceRepository.js";

const getEmployeeByUser = async (userId) => {
    return await findEmployeeByUserId(userId);
};

// =====================================================
// CREATE OKR (Employee)
// POST /api/v1/performance
// =====================================================
export const createOkr = async (req, res) => {
    try {
        const employee = await getEmployeeByUser(req.user.userId);
        if (!employee) {
            return res.status(404).json({ success: false, message: "Employee profile not found" });
        }

        const { objective } = req.body || {};
        if (!objective || !objective.trim()) {
            return res.status(400).json({ success: false, message: "Objective is required" });
        }

        const okr = await createOkrRecord({
            employeeId: employee.id,
            objective: objective.trim(),
        });

        res.status(201).json({ success: true, data: okr });
    } catch (error) {
        console.error("CREATE OKR ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// =====================================================
// GET MY OKRS (Employee)
// GET /api/v1/performance/my
// =====================================================
export const getMyOkrs = async (req, res) => {
    try {
        const employee = await getEmployeeByUser(req.user.userId);
        if (!employee) {
            return res.status(404).json({ success: false, message: "Employee profile not found" });
        }

        const okrs = await findOkrsByEmployee(employee.id);
        res.status(200).json({ success: true, data: okrs });
    } catch (error) {
        console.error("GET MY OKRS ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// =====================================================
// GET ALL OKRS (HR / Manager)
// GET /api/v1/performance/all
// =====================================================
export const getAllOkrs = async (req, res) => {
    try {
        const okrs = await findAllOkrsAdmin();
        res.status(200).json({ success: true, data: okrs });
    } catch (error) {
        console.error("GET ALL OKRS ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// =====================================================
// RATE OKR (HR / Manager)
// PUT /api/v1/performance/:id/rate
// =====================================================
export const rateOkr = async (req, res) => {
    try {
        const { id } = req.params;
        const { score, feedback } = req.body || {};

        const numScore = Number(score);
        if (!numScore || numScore < 1 || numScore > 5) {
            return res.status(400).json({ success: false, message: "Score must be between 1 and 5" });
        }

        const okr = await findOkrById(id);
        if (!okr) {
            return res.status(404).json({ success: false, message: "OKR not found" });
        }

        const updatedOkr = await updateOkrScoreRecord(id, {
            score: numScore,
            result: "Reviewed",
            reviewerId: req.user.userId,
            feedback: feedback || "",
        });

        res.status(200).json({ success: true, data: updatedOkr });
    } catch (error) {
        console.error("RATE OKR ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
