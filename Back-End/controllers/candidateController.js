import bcrypt from "bcryptjs";
import {
    findAllCandidates,
    findCandidateByCandidateId,
    createCandidateRecord,
    updateCandidateStatusRecord,
    updateCandidateBgvRecord,
    markCandidateOnboarded,
    seedDefaultCandidates
} from "../repositories/candidateRepository.js";
import {
    createEmployeeRecord,
    findEmployeeByEmail,
    countEmployees
} from "../repositories/employeeRepository.js";
import { createUser, findUserByEmail } from "../repositories/userRepository.js";
import { logAuditRecord } from "../repositories/auditRepository.js";

export const getCandidates = async (req, res) => {
    try {
        await seedDefaultCandidates();
        const candidates = await findAllCandidates();
        return res.status(200).json({
            success: true,
            data: candidates,
            count: candidates.length
        });
    } catch (err) {
        console.error("Error fetching candidates:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch candidate pipeline." });
    }
};

export const createCandidate = async (req, res) => {
    try {
        const { name, email, phone, skills, experience, department, designation } = req.body;
        if (!name || !email) {
            return res.status(400).json({ success: false, message: "Candidate name and email are required." });
        }

        const candidate = await createCandidateRecord({
            name,
            email,
            phone,
            skills,
            experience,
            department,
            designation
        });

        // Audit log
        await logAuditRecord({
            action: "CANDIDATE_CREATED",
            entityType: "Candidate",
            entityId: candidate.candidateId,
            details: `Candidate profile created for ${name} (${email})`,
            userName: req.user?.name || "HR Admin",
            userRole: req.user?.role || "hr"
        });

        return res.status(201).json({
            success: true,
            message: "Candidate registered in recruitment pipeline.",
            data: candidate
        });
    } catch (err) {
        console.error("Error creating candidate:", err);
        return res.status(500).json({ success: false, message: "Failed to register candidate." });
    }
};

export const updateCandidateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const status = req.body.status || req.body.stage;
        if (!status) {
            return res.status(400).json({ success: false, message: "Status is required." });
        }

        const updated = await updateCandidateStatusRecord(id, status);

        // Audit log
        await logAuditRecord({
            action: "CANDIDATE_STATUS_CHANGED",
            entityType: "Candidate",
            entityId: id,
            details: `Candidate status updated to ${status}`,
            userName: req.user?.name || "HR Admin",
            userRole: req.user?.role || "hr"
        });

        return res.status(200).json({
            success: true,
            message: `Candidate stage updated to ${status}.`,
            data: updated
        });
    } catch (err) {
        console.error("Error updating candidate status:", err);
        return res.status(500).json({ success: false, message: "Failed to update candidate status." });
    }
};

export const updateCandidateBgv = async (req, res) => {
    try {
        const { id } = req.params;
        const bgvStatus = req.body.bgvStatus || req.body.bgv_status || req.body.status;
        const bgvNotes = req.body.bgvNotes || req.body.bgv_notes || req.body.notes || "";
        if (!bgvStatus) {
            return res.status(400).json({ success: false, message: "BGV Status is required." });
        }

        const updated = await updateCandidateBgvRecord(id, bgvStatus, bgvNotes);

        // Audit log
        await logAuditRecord({
            action: "BGV_STATUS_UPDATED",
            entityType: "Candidate",
            entityId: id,
            details: `Background Verification status set to ${bgvStatus}. Notes: ${bgvNotes || "None"}`,
            userName: req.user?.name || "HR Admin",
            userRole: req.user?.role || "hr"
        });

        return res.status(200).json({
            success: true,
            message: `Candidate BGV status updated to ${bgvStatus}.`,
            data: updated
        });
    } catch (err) {
        console.error("Error updating candidate BGV:", err);
        return res.status(500).json({ success: false, message: "Failed to update candidate BGV status." });
    }
};

/**
 * Onboard Candidate:
 * 1. Converts candidate into active permanent employee record in PostgreSQL
 * 2. Creates a user login account if one doesn't exist
 * 3. Updates candidate table status to 'Hired' with permanent employee code
 * 4. Logs to persistent audit trail
 */
export const onboardCandidate = async (req, res) => {
    try {
        const { id } = req.params;
        const onboardData = req.body || {};

        const candidate = await findCandidateByCandidateId(id);
        if (!candidate) {
            return res.status(404).json({ success: false, message: "Candidate not found." });
        }

        if (candidate.onboardedEmployeeId) {
            return res.status(400).json({
                success: false,
                message: `Candidate already onboarded with Employee ID ${candidate.onboardedEmployeeId}.`
            });
        }

        // Check if an employee with this email already exists
        let existingEmp = await findEmployeeByEmail(candidate.email);
        let employeeCode = "";
        let employeeRecord = null;

        if (existingEmp) {
            employeeCode = existingEmp.employeeCode;
            employeeRecord = existingEmp;
        } else {
            // Generate clean sequential employee code
            const empCount = await countEmployees();
            employeeCode = `EMP-${String(empCount + 101).padStart(3, "0")}`;

            // 1. Create or find User record
            let user = await findUserByEmail(candidate.email);
            if (!user) {
                const defaultPasswordHash = await bcrypt.hash("Welcome@2026", 10);
                user = await createUser({
                    name: candidate.name,
                    email: candidate.email,
                    password: defaultPasswordHash,
                    role: "employee",
                    isActive: true
                });
            }

            // 2. Parse name
            const nameParts = candidate.name.trim().split(" ");
            const firstName = nameParts[0] || candidate.name;
            const lastName = nameParts.slice(1).join(" ") || "";

            // 3. Create permanent employee record in database
            employeeRecord = await createEmployeeRecord({
                userId: user.id,
                employeeCode,
                firstName,
                lastName,
                email: candidate.email,
                phone: candidate.phone || "",
                workLocation: "Quadratic HQ - Bangalore",
                employment: {
                    department: onboardData.department || candidate.department || "Engineering",
                    designation: onboardData.designation || candidate.designation || "Software Engineer",
                    status: "Active",
                    joiningDate: onboardData.joiningDate || new Date().toISOString().split("T")[0],
                    employmentType: "Full Time",
                    reportingManager: onboardData.manager || candidate.manager || "Executive Management"
                },
                personal: {
                    bloodGroup: "A+ Positive",
                    skills: candidate.skills ? candidate.skills.split(",").map(s => s.trim()) : []
                }
            });
        }

        // 4. Update candidate status to Hired and store permanent Employee ID
        const updatedCandidate = await markCandidateOnboarded(candidate.candidateId, employeeCode, onboardData);

        // 5. Audit log
        await logAuditRecord({
            action: "CANDIDATE_ONBOARDED",
            entityType: "Employee",
            entityId: employeeCode,
            details: `Candidate ${candidate.name} (${candidate.candidateId}) successfully onboarded as permanent employee ${employeeCode}. Initial login generated.`,
            userName: req.user?.name || "HR Admin",
            userRole: req.user?.role || "hr"
        });

        return res.status(200).json({
            success: true,
            message: `Candidate successfully onboarded as ${employeeCode}!`,
            data: {
                candidate: updatedCandidate,
                employee: employeeRecord,
                employeeCode
            }
        });
    } catch (err) {
        console.error("Error onboarding candidate:", err);
        return res.status(500).json({ success: false, message: "Onboarding workflow execution failed." });
    }
};
