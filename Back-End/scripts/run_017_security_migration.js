import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import pool from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log("=== EXECUTING MIGRATION 017_SECURITY_COMPLIANCE_GOVERNANCE.SQL ===");
  const sqlPath = path.join(__dirname, "../migrations/017_security_compliance_governance.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  await pool.query(sql);
  console.log("✓ Migration 017 executed successfully in PostgreSQL!\n");

  console.log("Seeding realistic security and governance records...");

  // 1. Seed Backup Logs if empty
  const backupCheck = await pool.query("SELECT count(*) FROM system_backup_dr_logs");
  if (parseInt(backupCheck.rows[0].count, 10) === 0) {
    const backups = [
      {
        code: "BKP-FULL-2026-10-23-01",
        type: "FULL_SNAPSHOT",
        size: 348.50,
        checksum: "SHA256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
        status: "VERIFIED_RESTORE_READY",
        rpo: 15,
        rto: 30
      },
      {
        code: "BKP-INCR-2026-10-23-02",
        type: "INCREMENTAL_WAL",
        size: 42.10,
        checksum: "SHA256:c28e2448375629da76bcda29288ea5825a18a55c2f821cc6cb030adcc0f3a69a",
        status: "COMPLETED",
        rpo: 5,
        rto: 15
      }
    ];
    for (const b of backups) {
      await pool.query(`
        INSERT INTO system_backup_dr_logs (backup_code, backup_type, file_size_mb, sha256_checksum, status, rpo_minutes, rto_minutes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (backup_code) DO NOTHING;
      `, [b.code, b.type, b.size, b.checksum, b.status, b.rpo, b.rto]);
    }
    console.log("✓ Backup & DR logs seeded.");
  }

  // 2. Seed DPDP Consent records for active employees
  const consentCheck = await pool.query("SELECT count(*) FROM dpdp_consent_logs");
  if (parseInt(consentCheck.rows[0].count, 10) === 0) {
    const emps = await pool.query("SELECT id, employee_code, first_name, last_name FROM employees LIMIT 10");
    for (const emp of emps.rows) {
      const name = `${emp.first_name} ${emp.last_name}`;
      const purposes = ['EMPLOYMENT_ADMINISTRATION', 'BIOMETRIC_ATTENDANCE', 'PAYROLL_BANKING'];
      for (const p of purposes) {
        await pool.query(`
          INSERT INTO dpdp_consent_logs (employee_id, employee_code, data_principal_name, consent_purpose, notice_version, is_granted)
          VALUES ($1, $2, $3, $4, 'v2.4-DPDP-2026', true)
        `, [emp.id, emp.employee_code, name, p]);
      }
    }
    console.log("✓ DPDP Act 2023 Consent logs seeded.");
  }

  // 3. Seed Sample DPDP Rights Requests
  const rightsCheck = await pool.query("SELECT count(*) FROM dpdp_rights_requests");
  if (parseInt(rightsCheck.rows[0].count, 10) === 0) {
    const sampleEmp = await pool.query("SELECT id, first_name, last_name, email FROM employees LIMIT 2");
    if (sampleEmp.rows.length > 0) {
      const e = sampleEmp.rows[0];
      await pool.query(`
        INSERT INTO dpdp_rights_requests 
          (request_code, employee_id, employee_name, employee_email, request_type, details, status, dpo_remarks)
        VALUES 
          ('DPR-2026-10-001', $1, $2, $3, 'RIGHT_TO_ACCESS', 'Employee requested complete digital portfolio export of past attendance punches and tax TDS records under DPDP Act Sec 11.', 'COMPLETED', 'Export packet compiled, encrypted and dispatched to official email.');
      `, [e.id, `${e.first_name} ${e.last_name}`, e.email]);
    }
    console.log("✓ DPDP Rights requests seeded.");
  }

  // 4. Seed Access Review Campaign
  const reviewCheck = await pool.query("SELECT count(*) FROM access_review_campaigns");
  if (parseInt(reviewCheck.rows[0].count, 10) === 0) {
    const totalUsers = await pool.query("SELECT count(*) FROM users");
    const count = parseInt(totalUsers.rows[0].count, 10);
    await pool.query(`
      INSERT INTO access_review_campaigns 
        (campaign_code, title, period, total_accounts_reviewed, certified_count, revoked_count, status, deadline_date)
      VALUES 
        ('ARC-Q4-2026', 'Q4 2026 Quarterly Privilege & RBAC Certification', 'Q4 2026', $1, $2, 0, 'COMPLETED', CURRENT_DATE);
    `, [count, count]);
    console.log("✓ Access Review Campaign seeded.");
  }

  // 5. Seed Separation Deprovisioning Log
  const deprovCheck = await pool.query("SELECT count(*) FROM separation_deprovisioning_logs");
  if (parseInt(deprovCheck.rows[0].count, 10) === 0) {
    const exitEmp = await pool.query("SELECT r.id AS resignation_id, r.employee_id, CONCAT(e.first_name, ' ', e.last_name) AS employee_name, r.resignation_date FROM resignations r JOIN employees e ON r.employee_id = e.id LIMIT 1");
    if (exitEmp.rows.length > 0) {
      const ex = exitEmp.rows[0];
      await pool.query(`
        INSERT INTO separation_deprovisioning_logs
          (resignation_id, employee_id, employee_name, separation_date, user_account_status, active_tokens_revoked, it_assets_reclaimed, email_access_revoked, sso_identity_deprovisioned, details)
        VALUES
          ($1, $2, $3, $4, 'DEACTIVATED', true, true, true, true, 'Immediate deprovisioning completed: Intune wiped, SAML session terminated, Git/VPN revoked.');
      `, [ex.resignation_id, ex.employee_id, ex.employee_name, ex.resignation_date]);
    }
    console.log("✓ Separation deprovisioning ledger seeded.");
  }

  // 6. Seed Document Access Logs
  const docAccessCheck = await pool.query("SELECT count(*) FROM document_access_logs");
  if (parseInt(docAccessCheck.rows[0].count, 10) === 0) {
    const docs = await pool.query("SELECT id, document_name, document_type, employee_id FROM employee_documents LIMIT 5");
    for (const d of docs.rows) {
      await pool.query(`
        INSERT INTO document_access_logs 
          (document_id, document_name, document_type, employee_id, actor_name, actor_role, action_type, ip_address)
        VALUES 
          ($1, $2, $3, $4, 'Compliance Officer / HR Admin', 'hr_admin', 'DOWNLOAD', '192.168.1.105');
      `, [d.id, d.document_name || 'Statutory Filing Document', d.document_type || 'Identity', d.employee_id]);
    }
    console.log("✓ Document access logs seeded.");
  }

  console.log("\n=== ALL 11 SECURITY & GOVERNANCE MECHANISMS INITIALIZED SUCCESSFULLY ===");
  await pool.end();
  process.exit(0);
}

run().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
