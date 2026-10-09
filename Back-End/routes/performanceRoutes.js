import express from "express";
import {
    createOkr,
    getMyOkrs,
    getAllOkrs,
    rateOkr
} from "../controllers/performanceController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Protect all routes
router.use(verifyToken);

// Employee / Self-Service routes (all roles)
router.post("/", authorizeRoles("employee", "manager", "hr", "admin"), createOkr);
router.get("/my", authorizeRoles("employee", "manager", "hr", "admin"), getMyOkrs);

// HR/Manager routes
router.get("/all", authorizeRoles("hr", "manager", "admin"), getAllOkrs);
router.put("/:id/rate", authorizeRoles("hr", "manager", "admin"), rateOkr);

export default router;
