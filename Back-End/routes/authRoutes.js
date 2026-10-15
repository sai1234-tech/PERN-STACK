import express from "express";
import {
    signup,
    login,
    getMe,
    getFirstAdminSetupStatus,
    setupFirstAdmin,
    getAdminSummary
} from "../controllers/authController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Public routes
router.post("/signup", signup);
router.post("/login", login);
router.get("/setup-status", getFirstAdminSetupStatus);
router.post("/setup-admin", setupFirstAdmin);

// Protected route
router.get("/me", verifyToken, getMe);
router.get("/admin-summary", verifyToken, authorizeRoles("admin"), getAdminSummary);

export default router;
