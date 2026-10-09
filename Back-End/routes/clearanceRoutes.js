import express from "express";
import {
    initiateClearance,
    getAllClearances,
    getMyClearance,
    updateClearanceCategory,
    processFinalSettlement,
    completeExit
} from "../controllers/clearanceController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(verifyToken);

// Employee route
router.get("/my", getMyClearance);

// HR / Admin routes
router.post("/initiate", authorizeRoles("hr", "admin"), initiateClearance);
router.get("/all", authorizeRoles("hr", "admin"), getAllClearances);
router.patch("/:id/category/:category", authorizeRoles("hr", "admin"), updateClearanceCategory);
router.patch("/:id/settlement", authorizeRoles("hr", "admin", "finance"), processFinalSettlement);
router.patch("/:id/complete", authorizeRoles("hr", "admin"), completeExit);

export default router;
