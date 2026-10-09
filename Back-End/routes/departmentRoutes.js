import express from "express";
import {
    createMultipleDepartments,
    getDepartments,
    getSingleDepartment,
    updateDepartment,
    deleteDepartment,
} from "../controllers/departmentController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(verifyToken, authorizeRoles("hr", "admin"));

// Get all departments
router.get("/", getDepartments);

// Create multiple departments
router.post("/", createMultipleDepartments);

// Get single department
router.get("/:id", getSingleDepartment);

// Update department
router.put("/:id", updateDepartment);

// Delete department
router.delete("/:id", deleteDepartment);

export default router;
