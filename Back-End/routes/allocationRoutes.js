import express from "express";
import {
    getAllAllocations,
    getEmployeeAllocation,
    upsertAllocation,
    updateAllocationStatus,
    deleteAllocation
} from "../controllers/allocationController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Apply auth to all allocation routes
router.use(verifyToken);

// Read allocations (All authenticated roles)
router.get("/", authorizeRoles("admin", "hr", "manager", "employee"), getAllAllocations);
router.get("/employee/:empId", authorizeRoles("admin", "hr", "manager", "employee"), getEmployeeAllocation);

// Manage allocations (HR, Manager, Admin)
router.post("/", authorizeRoles("admin", "hr", "manager"), upsertAllocation);
router.patch("/:id/status", authorizeRoles("admin", "hr", "manager"), updateAllocationStatus);
router.delete("/:id", authorizeRoles("admin", "hr", "manager"), deleteAllocation);

export default router;
