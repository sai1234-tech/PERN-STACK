import bcrypt from "bcryptjs";
import pool from "../config/db.js";
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
        const status = req.body.status || req.body.stage || "Applied";
        if (!name || !email) {
            return res.status(400).json({ success: false, message: "Candidate name and email are required." });
        }

        const candidate = await createCandidateRecord({
            name,
            email,
            phone,
            skills,
            experience,
            status,
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
        if (!updated) {
            return res.status(404).json({ success: false, message: "Candidate not found." });
        }

        // Upsert into bgv_verifications table for full 41-entity audit compliance
        const candIntId = updated.id;
        const isDiscrepancy = /discrepancy|failed|red/i.test(bgvStatus);
        const isClear = /clear|verified|green|pass/i.test(bgvStatus);
        const resultLabel = isDiscrepancy ? "Discrepancy Flagged" : (isClear ? "Clear / Verified" : "In Progress");

        const bgvCode = `BGV-${updated.candidate_id || updated.id}`;
        let bgvRecordId = null;

        try {
            const existingBgv = await pool.query(
                "SELECT id FROM bgv_verifications WHERE candidate_id = $1 OR bgv_code = $2 LIMIT 1",
                [candIntId, bgvCode]
            );

            if (existingBgv.rows.length > 0) {
                bgvRecordId = existingBgv.rows[0].id;
                await pool.query(
                    "UPDATE bgv_verifications SET status = $1, result = $2, remarks = $3 WHERE id = $4",
                    [bgvStatus, resultLabel, bgvNotes, bgvRecordId]
                );
            } else {
                const insRes = await pool.query(
                    `INSERT INTO bgv_verifications (bgv_code, candidate_id, verification_type, agency, status, result, remarks)
                     VALUES ($1, $2, 'Comprehensive Background Check', 'AuthBridge Screening Corp', $3, $4, $5)
                     RETURNING id`,
                    [bgvCode, candIntId, bgvStatus, resultLabel, bgvNotes]
                );
                bgvRecordId = insRes.rows[0]?.id;
            }

            // Handle BGV SLA / Discrepancy Escalation
            if (isDiscrepancy && bgvRecordId) {
                const existingEsc = await pool.query(
                    "SELECT id FROM bgv_sla_escalations WHERE bgv_id = $1 LIMIT 1",
                    [bgvRecordId]
                );
                if (existingEsc.rows.length > 0) {
                    await pool.query(
                        `UPDATE bgv_sla_escalations
                         SET sla_status = 'BREACHED', escalation_level = 'L1_LEAD', escalated_to = 'Talent Acquisition & Compliance Lead', action_taken = $1, escalated_at = NOW()
                         WHERE id = $2`,
                        [`Discrepancy detected: ${bgvNotes}`, existingEsc.rows[0].id]
                    );
                } else {
                    await pool.query(
                        `INSERT INTO bgv_sla_escalations (bgv_id, bgv_code, candidate_id, candidate_name, verification_type, agency, sla_status, escalation_level, escalated_to, action_taken, escalated_at)
                         VALUES ($1, $2, $3, $4, 'Comprehensive Background Check', 'AuthBridge Screening Corp', 'BREACHED', 'L1_LEAD', 'Talent Acquisition & Compliance Lead', $5, NOW())`,
                        [bgvRecordId, bgvCode, candIntId, updated.name, `Discrepancy detected: ${bgvNotes}`]
                    );
                }
            } else if (isClear && bgvRecordId) {
                await pool.query(
                    `UPDATE bgv_sla_escalations SET sla_status = 'ON_TRACK', action_taken = 'Discrepancy cleared and verified by compliance' WHERE bgv_id = $1`,
                    [bgvRecordId]
                );
            }
        } catch (dbErr) {
            console.error("Notice: BGV entity synchronization error:", dbErr);
        }

        // Audit log
        await logAuditRecord({
            action: isDiscrepancy ? "BGV_DISCREPANCY_FLAGGED" : "BGV_STATUS_UPDATED",
            entityType: "Candidate",
            entityId: id,
            details: `Background Verification status set to ${bgvStatus}. Result: ${resultLabel}. Notes: ${bgvNotes || "None"}`,
            userName: req.user?.name || "HR Admin",
            userRole: req.user?.role || "hr"
        });

        return res.status(200).json({
            success: true,
            message: `Candidate BGV status updated to ${bgvStatus}.`,
            data: updated,
            bgvRecord: {
                id: bgvRecordId,
                bgvCode,
                result: resultLabel,
                status: bgvStatus,
                isDiscrepancy
            }
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
                    salary: Number(onboardData.salary || candidate.salary || 3200000),
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
