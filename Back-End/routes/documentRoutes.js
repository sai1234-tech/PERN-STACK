import express from "express";
import {
    upload,
    listDocumentTypes,
    uploadEmployeeDocument,
    getMyDocuments,
    getEmployeeDocuments,
    getDocumentById,
    downloadDocument,
    RequestDocument,
    updateDocumentStatus,
    deleteDocument,
    bulkDeleteDocuments,
    getAllDocuments
} from "../controllers/documentController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Apply authentication middleware to all document routes
router.use(verifyToken);

// ==========================================
// PUBLIC / GENERAL ROUTES
// ==========================================
// Get allowed document types list
router.get("/types", listDocumentTypes);

// ==========================================
// EMPLOYEE SELF DOCUMENT ROUTES
// ==========================================
router.get("/my-documents", authorizeRoles("employee", "manager", "hr", "admin"), getMyDocuments);
router.get("/me", authorizeRoles("employee", "manager", "hr", "admin"), getMyDocuments);
router.get("/my", authorizeRoles("employee", "manager", "hr", "admin"), getMyDocuments);

// Employee Upload Document
router.post(
    "/upload",
    authorizeRoles("employee", "manager", "hr", "admin"),
    upload.any(),
    uploadEmployeeDocument
);


// ==========================================
// HR / ADMIN MANAGEMENT ROUTES
// ==========================================
// Get all documents across workforce (Company Vault for HR/Admin)
router.get(
    "/all",
    authorizeRoles("hr", "admin"),
    getAllDocuments
);
router.get(
    "/",
    authorizeRoles("hr", "admin"),
    getAllDocuments
);

// Get documents of a specific employee
router.get(
    "/employee/:employeeId",
    authorizeRoles("hr", "admin"),
    getEmployeeDocuments
);

// HR Request Document from employee
router.post(
    "/request",
    authorizeRoles("hr", "admin"),
    RequestDocument
);

// Download document file
router.get(
    "/:id/download",
    authorizeRoles("employee", "manager", "hr", "admin"),
    downloadDocument
);

// Get single document metadata by ID
router.get(
    "/:id",
    authorizeRoles("employee", "manager", "hr", "admin"),
    getDocumentById
);

// HR Verification (Approve / Reject document status)
router.patch(
    "/:id/status",
    authorizeRoles("hr", "admin"),
    updateDocumentStatus
);

// Bulk delete documents
router.post(
    "/bulk-delete",
    authorizeRoles("employee", "manager", "hr", "admin"),
    bulkDeleteDocuments
);
router.delete(
    "/bulk",
    authorizeRoles("employee", "manager", "hr", "admin"),
    bulkDeleteDocuments
);

// Delete document
router.delete(
    "/:id",
    authorizeRoles("employee", "manager", "hr", "admin"),
    deleteDocument
);

export default router;
