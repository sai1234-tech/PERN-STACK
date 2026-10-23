import pool from '../config/db.js';
import {
    initializeAndSecureSources,
    runTrialMigrationAndReconciliation,
    recordBusinessSignoff,
    executeFinalMigration,
    getLegacySampleDatasets,
    deduplicateAndCleanEmployees,
    calculateChecksum,
    decryptPayload
} from '../services/dataMigrationService.js';
import fs from 'fs';

async function verifyDataMigrationEngine() {
    console.log("================================================================================");
    console.log("       ENTERPRISE DATA MIGRATION & INGESTION ENGINE: FULL VERIFICATION           ");
    console.log("================================================================================");

    const scorecard = {};

    try {
        // ---------------------------------------------------------------------
        // STEP 1: IDENTIFY EXISTING EXCEL TRACKERS, ATTENDANCE, PAYROLL, ATS, BGV & DOCS
        // ---------------------------------------------------------------------
        console.log("\n>>> STEP 1: Identify existing Excel trackers, attendance, payroll, ATS, BGV and document sources");
        const securedSources = await initializeAndSecureSources();
        console.log(`✓ Initialized and secured ${securedSources.length} legacy data sources:`);
        
        const expectedSources = [
            'SRC-EMP-EXCEL',
            'SRC-ATT-BIOMETRIC',
            'SRC-PAY-REGISTER',
            'SRC-ATS-CANDIDATES',
            'SRC-BGV-TRACKER',
            'SRC-DOC-CATALOG'
        ];

        let allSourcesPresent = true;
        for (const s of securedSources) {
            console.log(`   - [${s.source_code}] ${s.source_name} (${s.source_category} - ${s.file_format}) | Records: ${s.total_records} | SHA256: ${s.file_checksum.slice(0, 16)}...`);
            if (!expectedSources.includes(s.source_code)) allSourcesPresent = false;
        }

        if (allSourcesPresent && securedSources.length >= 6) {
            scorecard['Step 01: Identify 6 Legacy Trackers & Sources'] = 'PASSED ✓';
            console.log("✓ Step 1: PASSED");
        } else {
            throw new Error("Missing expected legacy sources.");
        }

        // ---------------------------------------------------------------------
        // STEP 2: CREATE SOURCE-TO-TARGET FIELD MAPPING
        // ---------------------------------------------------------------------
        console.log("\n>>> STEP 2: Create source-to-target field mapping");
        const mappingsRes = await pool.query(`SELECT * FROM migration_field_mappings ORDER BY source_category, id`);
        console.log(`✓ Retrieved ${mappingsRes.rows.length} source-to-target field mapping rules:`);
        
        const categories = [...new Set(mappingsRes.rows.map(m => m.source_category))];
        for (const cat of categories) {
            const catMappings = mappingsRes.rows.filter(m => m.source_category === cat);
            console.log(`   - Category [${cat}]: ${catMappings.length} mappings (Target Tables: ${[...new Set(catMappings.map(m => m.target_table))].join(', ')})`);
        }

        if (mappingsRes.rows.length >= 25 && categories.length >= 6) {
            scorecard['Step 02: Source-to-Target Field Mapping Registry'] = 'PASSED ✓';
            console.log("✓ Step 2: PASSED");
        } else {
            throw new Error("Field mappings count lower than expected.");
        }

        // ---------------------------------------------------------------------
        // STEP 3: CLEAN DUPLICATE EMPLOYEE RECORDS
        // ---------------------------------------------------------------------
        console.log("\n>>> STEP 3: Clean duplicate employee records");
        const datasets = getLegacySampleDatasets();
        const { cleanEmployees, duplicates, validationErrors } = deduplicateAndCleanEmployees(datasets.employeeTracker);

        console.log(`   - Raw Employee Records Evaluated: ${datasets.employeeTracker.length}`);
        console.log(`   - Unique Cleaned Master Records:   ${cleanEmployees.length}`);
        console.log(`   - Duplicates Identified & Merged:  ${duplicates.length}`);
        duplicates.forEach((d, idx) => {
            console.log(`     * Dup #${idx + 1}: Match [${d.matchKey}: ${d.matchValue}] -> Master: ${d.retainedRecordId} merged with ${d.duplicateRecordId}`);
        });

        if (duplicates.length >= 2 && cleanEmployees.length === 5) {
            scorecard['Step 03: Clean Duplicate Employee Records (Deduplication)'] = 'PASSED ✓';
            console.log("✓ Step 3: PASSED");
        } else {
            throw new Error(`Deduplication did not yield expected results. Duplicates: ${duplicates.length}, Clean: ${cleanEmployees.length}`);
        }

        // ---------------------------------------------------------------------
        // STEP 4: VALIDATE MANDATORY FIELDS
        // ---------------------------------------------------------------------
        console.log("\n>>> STEP 4: Validate mandatory fields");
        console.log(`✓ Detected ${validationErrors.length} validation errors/anomalies in sample data:`);
        validationErrors.forEach((e) => {
            console.log(`   - Row ${e.row} [${e.field}]: Rejected val "${e.val}" -> ${e.code} (${e.tip})`);
        });

        const hasMandatoryFieldCheck = validationErrors.some(e => e.code === 'MISSING_MANDATORY_FIELD');
        const hasPanValidation = validationErrors.some(e => e.code === 'INVALID_PAN_FORMAT');
        const hasEmailValidation = validationErrors.some(e => e.code === 'INVALID_EMAIL_FORMAT');

        if (hasMandatoryFieldCheck && hasPanValidation && hasEmailValidation) {
            scorecard['Step 04: Validate Mandatory Fields & Formatting'] = 'PASSED ✓';
            console.log("✓ Step 4: PASSED");
        } else {
            throw new Error("Mandatory field validation rules incomplete.");
        }

        // ---------------------------------------------------------------------
        // STEP 5: SECURE MIGRATION FILES
        // ---------------------------------------------------------------------
        console.log("\n>>> STEP 5: Secure migration files");
        // Verify disk files are encrypted with AES-256-GCM and hashes match
        let secureFilesVerified = true;
        for (const s of securedSources) {
            if (!fs.existsSync(s.file_path)) {
                secureFilesVerified = false;
                console.error(`File missing: ${s.file_path}`);
                break;
            }
            const encContent = JSON.parse(fs.readFileSync(s.file_path, 'utf8'));
            if (!encContent.iv || !encContent.encryptedData || !encContent.authTag) {
                secureFilesVerified = false;
                console.error(`Invalid AES-GCM envelope in: ${s.file_path}`);
                break;
            }
            // Decrypt and verify SHA-256 hash
            const decrypted = decryptPayload(encContent);
            const decryptedChecksum = calculateChecksum(decrypted);
            if (decryptedChecksum !== s.file_checksum) {
                secureFilesVerified = false;
                console.error(`Checksum mismatch for ${s.source_code}: ${decryptedChecksum} vs ${s.file_checksum}`);
                break;
            }
            console.log(`   - Verified AES-256-GCM envelope & SHA256 integrity for [${s.source_code}]: VALID`);
        }

        if (secureFilesVerified) {
            scorecard['Step 05: Secure Migration Files (AES-256-GCM & SHA-256)'] = 'PASSED ✓';
            console.log("✓ Step 5: PASSED");
        } else {
            throw new Error("File security verification failed.");
        }

        // ---------------------------------------------------------------------
        // STEP 6: PERFORM TRIAL MIGRATION AND RECONCILIATION
        // ---------------------------------------------------------------------
        console.log("\n>>> STEP 6: Perform trial migration and reconciliation");
        const trialResult = await runTrialMigrationAndReconciliation("Lead Migration Architect");
        console.log(`✓ Trial Job Executed: ${trialResult.jobCode} (Status: ${trialResult.status})`);
        console.log(`✓ Overall Reconciliation Status: ${trialResult.reconciliationStatus}`);
        console.log("✓ Multi-Dimensional Reconciliation Matrix:");
        
        const reconReports = await pool.query(
            `SELECT * FROM migration_reconciliation_reports WHERE job_code = $1 ORDER BY id ASC`,
            [trialResult.jobCode]
        );

        let allBalanced = true;
        for (const r of reconReports.rows) {
            console.log(`   - [${r.metric_category.padEnd(30)}] Source: ${String(r.source_value).padStart(10)} | Target: ${String(r.target_value).padStart(10)} | Variance: ${String(r.variance).padStart(5)} [${r.reconciliation_status}]`);
            if (r.reconciliation_status !== 'BALANCED' || Number(r.variance) !== 0) {
                allBalanced = false;
            }
        }

        if (allBalanced && reconReports.rows.length >= 7) {
            scorecard['Step 06: Perform Trial Migration & Balanced Reconciliation'] = 'PASSED ✓';
            console.log("✓ Step 6: PASSED");
        } else {
            throw new Error("Reconciliation variance detected in trial migration.");
        }

        // ---------------------------------------------------------------------
        // STEP 7: COMPLETE FINAL MIGRATION WITH HR/BUSINESS SIGN-OFF
        // ---------------------------------------------------------------------
        console.log("\n>>> STEP 7: Complete final migration with HR/business sign-off");
        
        // 7a. Submit Business Sign-off
        const signoff = await recordBusinessSignoff({
            jobCode: trialResult.jobCode,
            approverName: "Ananya Varma",
            approverEmail: "ananyavarma.hr@company.com",
            approverRole: "Head of HR Operations",
            decision: "APPROVED",
            comments: "Verified all 7 reconciliation dimensions. Headcounts, attendance punches, and financial CTC match perfectly with zero variance. Final migration approved."
        });

        console.log(`✓ HR / Business Sign-Off Recorded:`);
        console.log(`   - Approver: ${signoff.approver_name} (${signoff.approver_role})`);
        console.log(`   - Decision: ${signoff.decision}`);
        console.log(`   - HMAC-SHA256 Digital Signature: ${signoff.signature_hash}`);
        console.log(`   - Timestamp: ${signoff.signed_at}`);

        // 7b. Execute Final Migration Ingestion into Production Tables
        const finalResult = await executeFinalMigration({
            jobCode: trialResult.jobCode,
            executedBy: "Ananya Varma (HR Operations)"
        });

        console.log(`✓ Final Production Migration Committed to PERN Database:`);
        console.log(`   - Job Code: ${finalResult.jobCode}`);
        console.log(`   - Status: ${finalResult.status}`);
        console.log(`   - Migrated Employee Master Records: ${finalResult.migratedEmployeesCount}`);

        // 7c. Verify Live Database Entities
        const [empCheck, userCheck, payCheck, attCheck, auditCheck] = await Promise.all([
            pool.query(`SELECT COUNT(*) FROM employees WHERE employee_code LIKE 'LEG-EMP-%'`),
            pool.query(`SELECT COUNT(*) FROM users WHERE email LIKE '%@legacycorp.in'`),
            pool.query(`SELECT COUNT(*) FROM payrolls WHERE month = '2026-10-01'`),
            pool.query(`SELECT COUNT(*) FROM attendance WHERE date = '2026-10-19'`),
            pool.query(`SELECT COUNT(*) FROM audit_logs WHERE action = 'DATA_MIGRATION_FINAL_COMPLETED'`)
        ]);

        console.log(`✓ Live PERN Database Verification:`);
        console.log(`   - Active Migrated Employees in DB: ${empCheck.rows[0].count}`);
        console.log(`   - Active User Accounts in DB:     ${userCheck.rows[0].count}`);
        console.log(`   - Payroll Input Records in DB:    ${payCheck.rows[0].count}`);
        console.log(`   - Attendance Punches in DB:       ${attCheck.rows[0].count}`);
        console.log(`   - Final Migration Audit Logs:     ${auditCheck.rows[0].count}`);

        if (Number(empCheck.rows[0].count) >= 5 && Number(userCheck.rows[0].count) >= 5 && Number(auditCheck.rows[0].count) >= 1) {
            scorecard['Step 07: Final Migration Ingestion with HR Sign-Off'] = 'PASSED ✓';
            console.log("✓ Step 7: PASSED");
        } else {
            throw new Error("Live database ingestion verification failed.");
        }

        // ---------------------------------------------------------------------
        // FINAL SUMMARY SCORECARD
        // ---------------------------------------------------------------------
        console.log("\n================================================================================");
        console.log("                        MIGRATION ENGINE SCORECARD                              ");
        console.log("================================================================================");
        for (const [key, val] of Object.entries(scorecard)) {
            console.log(`${key.padEnd(65)}: ${val}`);
        }
        console.log("================================================================================");
        console.log("ALL 7 DATA MIGRATION LIFECYCLE WORKFLOWS SUCCESSFULLY IMPLEMENTED & VERIFIED!");
        console.log("================================================================================\n");

        process.exit(0);
    } catch (err) {
        console.error("\n❌ VERIFICATION FAILED:", err);
        process.exit(1);
    }
}

verifyDataMigrationEngine();
