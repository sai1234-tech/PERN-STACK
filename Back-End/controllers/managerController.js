import {
    getTeamOverviewRepo,
    getTeamLeavesRepo,
    updateTeamLeaveRepo,
    getTeamTimesheetsRepo,
    updateTeamTimesheetRepo,
    getActiveProjectsRepo
} from "../repositories/managerRepository.js";

const getUserId = (req) => req.user?.userId || req.user?.id || req.user?._id;

// ==========================================
// 1. GET TEAM OVERVIEW
// ==========================================
export const getTeamOverview = async (req, res) => {
    try {
        const userId = getUserId(req);
        const email = req.user?.email || "";

        const data = await getTeamOverviewRepo(userId, email);

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error("getTeamOverview error:", error);
        return res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ==========================================
// 2. GET TEAM LEAVES
// ==========================================
export const getTeamLeaves = async (req, res) => {
    try {
        const userId = getUserId(req);
        const email = req.user?.email || "";
        const statusQuery = req.query.status;

        const leaves = await getTeamLeavesRepo(userId, email, statusQuery);

        return res.status(200).json({
            success: true,
            data: leaves
        });
    } catch (error) {
        console.error("getTeamLeaves error:", error);
        return res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ==========================================
// 3. APPROVE / REJECT TEAM LEAVE
// ==========================================
export const updateTeamLeave = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body;
        const userId = getUserId(req);

        if (!["approved", "rejected", "Approved", "Rejected", "Pending HR", "pending hr"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        const result = await updateTeamLeaveRepo(id, status, remarks, userId);

        if (result.error === "NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Leave not found" });
        }

        return res.status(200).json({
            success: true,
            data: result.data,
            message: result.isApproveAction
                ? "Leave approved by Manager and forwarded to HR for final approval"
                : "Leave rejected by Manager"
        });
    } catch (error) {
        console.error("updateTeamLeave error:", error);
        return res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ==========================================
// 4. GET TEAM TIMESHEETS
// ==========================================
export const getTeamTimesheets = async (req, res) => {
    try {
        const userId = getUserId(req);
        const email = req.user?.email || "";

        const timesheets = await getTeamTimesheetsRepo(userId, email);

        return res.status(200).json({
            success: true,
            data: timesheets
        });
    } catch (error) {
        console.error("getTeamTimesheets error:", error);
        return res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ==========================================
// 5. APPROVE / REJECT TEAM TIMESHEET
// ==========================================
export const updateTeamTimesheet = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reviewComment } = req.body;
        const userId = getUserId(req);
        const email = req.user?.email || "";

        if (!["approved", "rejected", "Approved", "Rejected"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        const normStatus = status.toLowerCase();
        const result = await updateTeamTimesheetRepo(id, normStatus, reviewComment, userId, email);

        if (result.error === "NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Timesheet not found" });
        }
        if (result.error === "FORBIDDEN") {
            return res.status(403).json({ success: false, message: "Not authorized to manage this employee's timesheet" });
        }

        return res.status(200).json({
            success: true,
            data: result.data,
            message: `Timesheet successfully ${normStatus}`
        });
    } catch (error) {
        console.error("updateTeamTimesheet error:", error);
        return res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ==========================================
// 6. GET ACTIVE PROJECTS
// ==========================================
export const getActiveProjects = async (req, res) => {
    try {
        const userId = getUserId(req);
        const email = req.user?.email || "";

        const projects = await getActiveProjectsRepo(userId, email);

        return res.status(200).json({
            success: true,
            data: projects
        });
    } catch (error) {
        console.error("getActiveProjects error:", error);
        return res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};
