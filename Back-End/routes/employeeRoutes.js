import express from "express";
import {
    getEmployee,
    getSingleEmployee,
    createMultipleEmployees,
    updateEmployee,
    deleteEmployee,
    getMyProfile,
    updateMyProfile,
    uploadMyProfilePhoto,
    uploadEmployeeProfilePhoto,
    deleteMyProfilePhoto
} from "../controllers/employeeController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

import uploadProfilePhoto from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Apply auth middleware for all employee routes
router.use(verifyToken);

// ==========================================
// EMPLOYEE SELF-PROFILE ROUTES (Must be before /:id)
// ==========================================
router.get("/me", getMyProfile);
router.put("/me", updateMyProfile);

router.post("/me/photo", uploadProfilePhoto.single("photo"), uploadMyProfilePhoto);
router.post("/me/profile-picture", uploadProfilePhoto.single("profilePicture"), uploadMyProfilePhoto);

router.delete("/me/photo", deleteMyProfilePhoto);
router.delete("/me/profile-picture", deleteMyProfilePhoto);

// ==========================================
// EMPLOYEE MANAGEMENT ROUTES
// ==========================================
// GET all employees (supports ?search= query)
router.get("/", getEmployee);

// GET single employee by ID or employeeCode
router.get("/:id", getSingleEmployee);

router.post(
    "/:id/profile-picture",
    authorizeRoles("hr", "admin"),
    uploadProfilePhoto.single("profilePicture"),
    uploadEmployeeProfilePhoto
);

// Create employee(s)
router.post("/", authorizeRoles("hr", "admin", "manager"), createMultipleEmployees);

// Update employee
router.put("/:id", authorizeRoles("hr", "admin", "manager"), updateEmployee);

// Delete employee
router.delete("/:id", authorizeRoles("hr", "admin"), deleteEmployee);

export default router;
