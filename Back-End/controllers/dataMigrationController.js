import pool from "../config/db.js";
import {
    initializeAndSecureSources,
    runTrialMigrationAndReconciliation,
    recordBusinessSignoff,
    executeFinalMigration,
    getLegacySampleDatasets,
    deduplicateAndCleanEmployees,
    maskSensitivePII
} from "../services/dataMigrationService.js";

// 1. Get Identified Legacy Sources & Security Telemetry
export const getSources = async (req, res, next) => {
    try {
        let sourcesRes = await pool.query(`SELECT * FROM migration_sources ORDER BY id ASC`);
        if (sourcesRes.rows.length === 0) {
            await initializeAndSecureSources();
            sourcesRes = await pool.query(`SELECT * FROM migration_sources ORDER BY id ASC`);
        }
        res.status(200).json({
            success: true,
            totalSources: sourcesRes.rows.length,
            sources: sourcesRes.rows.map((s) => ({
                id: s.id,
                sourceCode: s.source_code,
                name: s.source_name,
                category: s.source_category,
                fileName: s.file_name,
                fileFormat: s.file_format,
                fileChecksum: s.file_checksum,
                encryptionAlgorithm: s.encryption_algorithm,
                isEncrypted: s.is_encrypted,
                totalRecords: s.total_records,
                identifiedAt: s.identified_at,
                metadata: s.metadata
            }))
        });
    } catch (err) {
        next(err);
    }
};

// 2. Get Source-to-Target Field Mapping Registry
export const getFieldMappings = async (req, res, next) => {
    try {
        const { category } = req.query;
        let query = `SELECT * FROM migration_field_mappings`;
        const params = [];
        if (category) {
            query += ` WHERE source_category = $1`;
            params.push(category.toUpperCase());
        }
        query += ` ORDER BY source_category, id ASC`;

        const resMappings = await pool.query(query, params);
        res.status(200).json({
            success: true,
            totalMappings: resMappings.rows.length,
            mappings: resMappings.rows.map((m) => ({
                id: m.id,
                sourceCategory: m.source_category,
                sourceField: m.source_field,
                targetTable: m.target_table,
                targetColumn: m.target_column,
                dataType: m.data_type,
                isMandatory: m.is_mandatory,
                transformationRule: m.transformation_rule
            }))
        });
    } catch (err) {
        next(err);
    }
};

// 3. Preview Raw vs Cleaned/Masked Sample Data
export const getSampleData = async (req, res, next) => {
    try {
        const datasets = getLegacySampleDatasets();
        const { cleanEmployees, duplicates, validationErrors } = deduplicateAndCleanEmployees(datasets.employeeTracker);

        res.status(200).json({
            success: true,
            rawEmployeeTracker: datasets.employeeTracker.map((e) => ({
                ...e,
                National_PAN_Masked: maskSensitivePII(e.National_PAN, "PAN"),
                Aadhaar_No_Masked: maskSensitivePII(e.Aadhaar_No, "AADHAAR")
            })),
            cleanEmployees: cleanEmployees.map((e) => ({
                ...e,
                National_PAN_Masked: maskSensitivePII(e.National_PAN, "PAN"),
                Aadhaar_No_Masked: maskSensitivePII(e.Aadhaar_No, "AADHAAR")
            })),
            duplicatesDetected: duplicates,
            validationErrors,
            counts: {
                rawEmployees: datasets.employeeTracker.length,
                attendancePunches: datasets.attendanceTracker.length,
                payrollRegisters: datasets.payrollTracker.length,
                atsCandidates: datasets.atsTracker.length,
                bgvCases: datasets.bgvTracker.length,
                documentsCatalog: datasets.documentCatalog.length
            }
        });
    } catch (err) {
        next(err);
    }
};

// 4. Perform Trial Migration and Multi-Dimensional Reconciliation
export const triggerTrialMigration = async (req, res, next) => {
    try {
        const executedBy = req.user?.name || req.body?.executedBy || "System Admin";
        const trialResult = await runTrialMigrationAndReconciliation(executedBy);

        res.status(201).json({
            success: true,
            message: "Trial migration and multi-dimensional reconciliation completed successfully.",
            trial: trialResult
        });
    } catch (err) {
        next(err);
    }
};

// 5. Get All Migration Jobs
export const getJobs = async (req, res, next) => {
    try {
        const jobsRes = await pool.query(`SELECT * FROM migration_jobs ORDER BY id DESC`);
        res.status(200).json({
            success: true,
            jobs: jobsRes.rows.map((j) => ({
                id: j.id,
                jobCode: j.job_code,
                jobType: j.job_type,
                status: j.status,
                totalSourceRecords: j.total_source_records,
                validRecords: j.valid_records,
                duplicateRecords: j.duplicate_records,
                errorRecords: j.error_records,
                migratedRecords: j.migrated_records,
                reconciliationStatus: j.reconciliation_status,
                executedBy: j.executed_by,
                startedAt: j.started_at,
                completedAt: j.completed_at,
                summary: j.summary
            }))
        });
    } catch (err) {
        next(err);
    }
};

// 6. Get Migration Job Details & Reconciliation Reports
export const getJobDetails = async (req, res, next) => {
    try {
        const { jobCode } = req.params;

        const jobRes = await pool.query(
            `SELECT * FROM migration_jobs WHERE job_code = $1`,
            [jobCode]
        );

        if (jobRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: `Job ${jobCode} not found` });
        }

        const [dedupRes, errorRes, reconRes, signoffRes] = await Promise.all([
            pool.query(`SELECT * FROM migration_deduplication_logs WHERE job_code = $1 ORDER BY id ASC`, [jobCode]),
            pool.query(`SELECT * FROM migration_validation_errors WHERE job_code = $1 ORDER BY id ASC`, [jobCode]),
            pool.query(`SELECT * FROM migration_reconciliation_reports WHERE job_code = $1 ORDER BY id ASC`, [jobCode]),
            pool.query(`SELECT * FROM migration_signoffs WHERE job_code = $1 ORDER BY id ASC`, [jobCode])
        ]);

        res.status(200).json({
            success: true,
            job: jobRes.rows[0],
            deduplicationLogs: dedupRes.rows,
            validationErrors: errorRes.rows,
            reconciliationReports: reconRes.rows,
            signoffs: signoffRes.rows
        });
    } catch (err) {
        next(err);
    }
};

// 7. Record HR / Business Sign-Off
export const submitSignoff = async (req, res, next) => {
    try {
        const {
            jobCode,
            approverName = req.user?.name || "Ananya Varma",
            approverEmail = req.user?.email || "ananyavarma.hr@company.com",
            approverRole = req.user?.role || "Head of HR Operations",
            decision = "APPROVED",
            comments
        } = req.body;

        if (!jobCode) {
            return res.status(400).json({ success: false, message: "jobCode is mandatory" });
        }

        const signoffRecord = await recordBusinessSignoff({
            jobCode,
            approverName,
            approverEmail,
            approverRole,
            decision,
            comments
        });

        res.status(201).json({
            success: true,
            message: `HR/Business sign-off recorded with cryptographic signature for ${jobCode}`,
            signoff: signoffRecord
        });
    } catch (err) {
        next(err);
    }
};

// 8. Execute Final Migration Committed to Database
export const triggerFinalMigration = async (req, res, next) => {
    try {
        const { jobCode } = req.body;
        if (!jobCode) {
            return res.status(400).json({ success: false, message: "jobCode is mandatory" });
        }

        const executedBy = req.user?.name || "System Admin";
        const finalResult = await executeFinalMigration({
            jobCode,
            executedBy
        });

        res.status(200).json({
            success: true,
            message: "Final migration committed to live enterprise database.",
            result: finalResult
        });
    } catch (err) {
        next(err);
    }
};
