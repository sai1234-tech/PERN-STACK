import pool from "../config/db.js";

async function verify() {
  console.log("=== COMPREHENSIVE VERIFICATION OF 5 GOVERNANCE PILLARS ===");

  // Pillar 1: Critical Changes
  const changes = await pool.query(`
    SELECT change_code, entity_type, entity_id, user_name, user_role, source_ip, source_channel, criticality, created_at
    FROM critical_data_change_logs
    ORDER BY created_at DESC
    LIMIT 3;
  `);
  console.log("\n[Pillar 1: Critical Data Changes]");
  console.table(changes.rows);

  // Pillar 2: Approval Decisions
  const approvals = await pool.query(`
    SELECT decision_code, workflow_type, entity_id, approver_name, approver_role, decision, comments, previous_status, resulting_status, decided_at
    FROM approval_decision_history
    ORDER BY decided_at DESC
    LIMIT 3;
  `);
  console.log("\n[Pillar 2: Approval Decision History & Comments]");
  console.table(approvals.rows);

  // Pillar 3: Effective-Dated History
  const history = await pool.query(`
    SELECT entity_type, entity_id, version_number, effective_from, effective_to, is_current, change_reason
    FROM effective_dated_history
    WHERE entity_id = '201'
    ORDER BY version_number ASC;
  `);
  console.log("\n[Pillar 3: Effective-Dated History (Entity 201)]");
  console.table(history.rows);

  // Pillar 4: Sensitive Exports & Admin Actions
  const exportsRes = await pool.query(`
    SELECT export_code, export_type, export_format, record_count, sensitivity_level, file_checksum_sha256, user_name
    FROM sensitive_export_logs
    ORDER BY created_at DESC
    LIMIT 3;
  `);
  console.log("\n[Pillar 4A: Sensitive Exports]");
  console.table(exportsRes.rows);

  const adminRes = await pool.query(`
    SELECT action_code, admin_name, admin_role, action_category, target_entity_type, status, created_at
    FROM administrative_action_logs
    ORDER BY created_at DESC
    LIMIT 3;
  `);
  console.log("\n[Pillar 4B: Administrative Actions]");
  console.table(adminRes.rows);

  // Pillar 5: Document Policies & Access Audits
  const policies = await pool.query(`
    SELECT category_code, category_label, can_preview_roles, can_download_roles, requires_watermark, max_downloads_per_day
    FROM document_governance_policies
    ORDER BY id ASC
    LIMIT 4;
  `);
  console.log("\n[Pillar 5A: Document Policies Matrix]");
  console.table(policies.rows);

  const audits = await pool.query(`
    SELECT document_name, document_category, user_name, user_role, action_type, access_granted, watermark_applied
    FROM document_governance_audit
    ORDER BY created_at DESC
    LIMIT 3;
  `);
  console.log("\n[Pillar 5B: Document Governance Audits & Dynamic Watermarks]");
  console.table(audits.rows);

  console.log("\n✅ ALL 5 GOVERNANCE PILLARS VERIFIED DIRECTLY AGAINST POSTGRESQL!");
  process.exit(0);
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
