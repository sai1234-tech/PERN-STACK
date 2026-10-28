import express from "express";
import {
    getTeamOverview,
    getTeamLeaves,
    updateTeamLeave,
    getTeamTimesheets,
    updateTeamTimesheet,
    getActiveProjects
} from "../controllers/managerController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// All manager routes require authentication and manager/admin/hr/employee access
router.use(verifyToken);
router.use(authorizeRoles("manager", "admin", "hr", "super_admin", "leadership", "employee"));

// Dashboard Overview
router.get("/overview", getTeamOverview);
router.get("/team", getTeamOverview);

// Team Leaves
router.get("/team-leaves", getTeamLeaves);
router.put("/team-leaves/:id", updateTeamLeave);

// Team Timesheets
router.get("/team-timesheets", getTeamTimesheets);
router.put("/team-timesheets/:id", updateTeamTimesheet);

// Active Projects
router.get("/projects", getActiveProjects);

export default router;
