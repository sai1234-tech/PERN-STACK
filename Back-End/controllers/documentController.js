import fs from "fs";
import path from "path";
import multer from "multer";
import {
    DOCUMENT_TYPES,
    createDocumentRecord,
    findDocumentById,
    findDocumentsByEmployeeId,
    updateDocumentRecord,
    deleteDocumentRecord
} from "../repositories/documentRepository.js";
import {
    findEmployeeById,
    findEmployeeByUserId,
    findEmployeeByCodeOrEmail
} from "../repositories/employeeRepository.js";
import { findUserById } from "../repositories/userRepository.js";
import { broadcastBackendChange } from "../services/sseService.js";

// Ensure uploads/documents directory exists
const uploadDirectory = path.join(process.cwd(), "uploads", "documents");
if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDirectory),
    filename: (_req, file, cb) => {
        const safeName = file.originalname.replace(/\s+/g, "_");
        const extension = path.extname(safeName) || "";
        const baseName = path.basename(safeName, extension);
        const uniqueName = `${Date.now()}-${baseName}${extension}`;
        cb(null, uniqueName);
    }
});

export const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (_req, file, cb) => {
        const allowedMimeTypes = [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/jpg"
        ];
        if (allowedMimeTypes.includes(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error("Only PDF, JPG, and PNG files are allowed"));
    }
});

// Helper to format document response
const formatDocumentResponse = (doc) => {
    if (!doc) return null;
    return {
        id: doc.id,
        employee: {
            id: doc.employee_id,
            employeeCode: doc.employee_code || "",
            name: `${doc.employee_first_name || ""} ${doc.employee_last_name || ""}`.trim(),
            email: doc.employee_email || ""
        },
        uploadedBy: doc.uploaded_by ? {
            id: doc.uploaded_by,
            name: doc.uploaded_by_name || "",
            email: doc.uploaded_by_email || "",
            role: doc.uploaded_by_role || ""
        } : null,
        verifiedBy: doc.verified_by ? {
            id: doc.verified_by,
            name: doc.verified_by_name || "",
            email: doc.verified_by_email || "",
            role: doc.verified_by_role || ""
        } : null,
        documentType: doc.document_type,
        documentName: doc.document_name,
        originalName: doc.original_name,
        fileName: doc.file_name,
        filePath: doc.file_path,
        fileUrl: doc.file_url,
        mimeType: doc.mime_type,
        size: Number(doc.size || 0),
        status: doc.status,
        expiryDate: doc.expiry_date,
        verificationNotes: doc.verification_notes || "",
        requestNote: doc.request_note || "",
        isRequired: doc.is_required || false,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at
    };
};

// =====================================================
// 1. LIST DOCUMENT TYPES
// =====================================================
export const listDocumentTypes = async (_req, res) => {
    return res.status(200).json({
        success: true,
        data: DOCUMENT_TYPES
    });
};

// =====================================================
// 2. UPLOAD EMPLOYEE DOCUMENT
// =====================================================
export const uploadEmployeeDocument = async (req, res, next) => {
    try {
        const uploadedFile = req.file || (req.files && req.files[0]);

        if (!uploadedFile) {
            return res.status(400).json({
                success: false,
                message: "Please upload a valid document file (PDF, PNG, JPG, JPEG). In Postman, select Body -> form-data -> Key type 'File'."
            });
        }


        const userId = req.user?.userId || req.user?.id;
        let employeeId = req.body.employeeId || null;

        if (req.user.role === "employee") {
            const employee = await findEmployeeByUserId(userId);
            if (!employee) {
                return res.status(404).json({
                    success: false,
                    message: "Employee profile not found"
                });
            }
            employeeId = employee.id;
        }

        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID is required"
            });
        }

        const employeeExists = !isNaN(employeeId) 
            ? await findEmployeeById(Number(employeeId)) 
            : await findEmployeeByCodeOrEmail(employeeId);

        if (!employeeExists) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        const sanitizeDocumentType = (type) => {
            if (type && DOCUMENT_TYPES.includes(type)) return type;
            return "General Document";
        };

        const documentType = sanitizeDocumentType(req.body.documentType);
        const expiryDate = req.body.expiryDate ? new Date(req.body.expiryDate) : null;
        const fileUrl = `/api/documents/${uploadedFile.filename}/download`;

        let createdDocument;
        const reqDocId = req.body.documentId || req.body.requestId;

        let requestedDocument = null;
        if (reqDocId) {
            const numericRequestId = Number(reqDocId);
            if (!Number.isInteger(numericRequestId) || numericRequestId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid document request ID"
                });
            }

            requestedDocument = await findDocumentById(numericRequestId);
            if (!requestedDocument || requestedDocument.employee_id !== employeeExists.id) {
                return res.status(404).json({
                    success: false,
                    message: "Document request not found for this employee"
                });
            }
            if (!["requested", "rejected"].includes(requestedDocument.status)) {
                return res.status(400).json({
                    success: false,
                    message: "This document request has already been fulfilled"
                });
            }
        }

        const newDoc = await createDocumentRecord({
            employeeId: employeeExists.id,
            uploadedBy: userId,
            documentType,
            documentName: req.body.documentName || uploadedFile.originalname,
            originalName: uploadedFile.originalname,
            fileName: uploadedFile.filename,
            filePath: uploadedFile.path,
            fileUrl,
            mimeType: uploadedFile.mimetype,
            size: uploadedFile.size,
            expiryDate,
            isRequired: req.body.isRequired === "true" || req.body.isRequired === true,
            status: "pending"
        });
        createdDocument = await findDocumentById(newDoc.id);

        if (requestedDocument) {
            await updateDocumentRecord(requestedDocument.id, { status: "fulfilled" });
        }


        return res.status(201).json({
            success: true,
            message: "Document uploaded successfully",
            data: formatDocumentResponse(createdDocument)
        });
    } catch (error) {
        return next(error);
    }
};

// =====================================================
// 3. GET MY DOCUMENTS
// =====================================================
export const getMyDocuments = async (req, res, next) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const employee = await findEmployeeByUserId(userId);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found"
            });
        }

        const documents = await findDocumentsByEmployeeId(employee.id);
        const formatted = documents.map(formatDocumentResponse);

        return res.status(200).json({
            success: true,
            data: formatted
        });
    } catch (error) {
        return next(error);
    }
};

// =====================================================
// 4. GET EMPLOYEE DOCUMENTS (HR/Admin)
// =====================================================
export const getEmployeeDocuments = async (req, res, next) => {
    try {
        const employeeParam = req.params.employeeId;
        const employee = !isNaN(employeeParam) 
            ? await findEmployeeById(Number(employeeParam)) 
            : await findEmployeeByCodeOrEmail(employeeParam);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        if (req.user.role === "employee") {
            const currentEmployee = await findEmployeeByUserId(req.user.userId);
            if (!currentEmployee || currentEmployee.id !== employee.id) {
                return res.status(403).json({
                    success: false,
                    message: "You can only access your own documents"
                });
            }
        }

        const documents = await findDocumentsByEmployeeId(employee.id);
        const formatted = documents.map(formatDocumentResponse);

        return res.status(200).json({
            success: true,
            data: formatted
        });
    } catch (error) {
        return next(error);
    }
};

// =====================================================
// 5. GET DOCUMENT BY ID
// =====================================================
export const getDocumentById = async (req, res, next) => {
    try {
        const docId = Number(req.params.id);
        const document = await findDocumentById(docId);

        if (!document) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            });
        }

        if (req.user.role === "employee") {
            const employee = await findEmployeeByUserId(req.user.userId);
            if (!employee || Number(document.employee_id) !== Number(employee.id)) {
                return res.status(403).json({
                    success: false,
                    message: "You can only access your own documents"
                });
            }
        }

        return res.status(200).json({
            success: true,
            data: formatDocumentResponse(document)
        });
    } catch (error) {
        return next(error);
    }
};

// =====================================================
// 6. DOWNLOAD DOCUMENT
// =====================================================
export const downloadDocument = async (req, res, next) => {
    try {
        let docId = req.params.id;
        let document = null;

        if (!isNaN(docId)) {
            document = await findDocumentById(Number(docId));
        }

        if (!document) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            });
        }

        if (req.user.role === "employee") {
            const employee = await findEmployeeByUserId(req.user.userId);
            if (!employee || Number(document.employee_id) !== Number(employee.id)) {
                return res.status(403).json({
                    success: false,
                    message: "You can only download your own documents"
                });
            }
        }

        let filePath = document.file_path;
        if (!filePath || !fs.existsSync(filePath)) {
            if (document.file_name) {
                const altPath = path.join(uploadDirectory, document.file_name);
                if (fs.existsSync(altPath)) {
                    filePath = altPath;
                }
            }
        }

        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: "Physical document file is missing on server"
            });
        }

        res.setHeader("Content-Type", document.mime_type || "application/octet-stream");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${document.original_name || document.document_name || "document"}"`
        );

        return fs.createReadStream(filePath).pipe(res);
    } catch (error) {
        return next(error);
    }
};

// =====================================================
// 7. REQUEST DOCUMENT (HR Action)
// =====================================================
export const RequestDocument = async (req, res, next) => {
    try {
        const employeeParam = req.body.employeeId;
        if (!employeeParam) {
            return res.status(400).json({
                success: false,
                message: "Employee ID is required"
            });
        }

        const employeeExists = !isNaN(employeeParam) 
            ? await findEmployeeById(Number(employeeParam)) 
            : await findEmployeeByCodeOrEmail(employeeParam);

        if (!employeeExists) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        const documentType = req.body.documentType && DOCUMENT_TYPES.includes(req.body.documentType) 
            ? req.body.documentType 
            : "General Document";

        const requestRecord = await createDocumentRecord({
            employeeId: employeeExists.id,
            uploadedBy: req.user.userId,
            documentType,
            documentName: req.body.documentName || documentType,
            requestNote: req.body.requestNote || "Requested by HR",
            status: "requested",
            isRequired: req.body.isRequired === "true" || req.body.isRequired === true
        });

        const populated = await findDocumentById(requestRecord.id);

        return res.status(201).json({
            success: true,
            message: "Document request created successfully",
            data: formatDocumentResponse(populated)
        });
    } catch (error) {
        return next(error);
    }
};

// =====================================================
// 8. UPDATE DOCUMENT STATUS (HR Verification)
// =====================================================
export const updateDocumentStatus = async (req, res, next) => {
    try {
        const docId = Number(req.params.id);
        const { status, verificationNotes, expiryDate } = req.body;

        if (!status || !["pending", "verified", "rejected"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be pending, verified, or rejected"
            });
        }

        const document = await findDocumentById(docId);
        if (!document) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            });
        }

        await updateDocumentRecord(docId, {
            status,
            verification_notes: verificationNotes || document.verification_notes || "",
            expiry_date: expiryDate ? new Date(expiryDate) : document.expiry_date,
            verified_by: req.user.userId
        });

        const updated = await findDocumentById(docId);

        broadcastBackendChange("documents", {
            action: status,
            status,
            docId,
            documentName: updated?.document_name || "Document",
            employeeId: updated?.employee_id
        });

        return res.status(200).json({
            success: true,
            message: `Document ${status}`,
            data: formatDocumentResponse(updated)
        });
    } catch (error) {
        return next(error);
    }
};

// =====================================================
// 9. DELETE DOCUMENT
// =====================================================
export const deleteDocument = async (req, res, next) => {
    try {
        const docId = Number(req.params.id);
        const document = await findDocumentById(docId);

        if (!document) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            });
        }

        if (req.user.role === "employee") {
            const employee = await findEmployeeByUserId(req.user.userId);
            if (!employee || Number(document.employee_id) !== Number(employee.id)) {
                return res.status(403).json({
                    success: false,
                    message: "You can only delete your own documents"
                });
            }
        }

        if (document.file_path && fs.existsSync(document.file_path)) {
            try {
                fs.unlinkSync(document.file_path);
            } catch (err) {
                console.error("Failed to delete physical file:", err.message);
            }
        }

        await deleteDocumentRecord(docId);

        return res.status(200).json({
            success: true,
            message: "Document deleted successfully"
        });
    } catch (error) {
        return next(error);
    }
};
