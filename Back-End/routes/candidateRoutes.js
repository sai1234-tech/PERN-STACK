import express from "express";
import {
    getCandidates,
    createCandidate,
    updateCandidateStatus,
    updateCandidateBgv,
    onboardCandidate
} from "../controllers/candidateController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Apply auth middleware
router.use(verifyToken);

// Read candidates pipeline (HR, Manager, Admin)
router.get("/", authorizeRoles("admin", "hr", "manager"), getCandidates);

// Candidate lifecycle actions (HR, Admin)
router.post("/", authorizeRoles("admin", "hr"), createCandidate);
router.patch("/:id/status", authorizeRoles("admin", "hr", "manager"), updateCandidateStatus);
router.patch("/:id/bgv", authorizeRoles("admin", "hr"), updateCandidateBgv);
router.post("/:id/onboard", authorizeRoles("admin", "hr"), onboardCandidate);

export default router;
