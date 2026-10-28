import express from "express";
import {
    submitResignation,
    getMyResignation,
    cancelResignation,
    getAllResignations,
    reviewResignation,
    getTeamResignations,
    managerReviewResignation,
} from "../controllers/resignationController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Employee routes
router.post("/", submitResignation);
router.get("/my", getMyResignation);
router.delete("/my", cancelResignation);

// HR / Admin routes
router.get("/", authorizeRoles("hr", "admin"), getAllResignations);
router.get("/all", authorizeRoles("hr", "admin"), getAllResignations);
router.patch("/:resignationId/review", authorizeRoles("hr", "admin"), reviewResignation);

// Manager routes
router.get("/team", authorizeRoles("manager", "admin", "hr", "super_admin", "leadership"), getTeamResignations);
router.patch("/:resignationId/manager-review", authorizeRoles("manager", "admin", "hr"), managerReviewResignation);

export default router;
