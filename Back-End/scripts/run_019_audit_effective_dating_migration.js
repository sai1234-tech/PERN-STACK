import "dotenv/config";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log("=== EXECUTING MIGRATION 019_AUDIT_EFFECTIVE_DATING_DOCUMENT_GOVERNANCE.SQL ===");
  const sqlPath = path.join(__dirname, "../migrations/019_audit_effective_dating_document_governance.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  await pool.query(sql);
  console.log("✓ Migration 019 tables & policies created successfully in PostgreSQL!\n");

  console.log("Seeding realistic enterprise audit & governance records...");

  // Fetch real users and employees to link
  const usersRes = await pool.query("SELECT id, email, role FROM users LIMIT 10");
  const employeesRes = await pool.query("SELECT id, first_name, last_name, employee_code, email FROM employees LIMIT 10");

  const adminUser = usersRes.rows.find(u => u.role === 'admin' || u.role === 'super_admin') || usersRes.rows[0];
  const hrUser = usersRes.rows.find(u => u.role === 'hr') || usersRes.rows[0];
  const managerUser = usersRes.rows.find(u => u.role === 'manager') || usersRes.rows[0];
  const emp1 = employeesRes.rows[0] || { id: 1, first_name: "Sarah", last_name: "Smith", employee_code: "EMP-001", email: "sarah@company.com" };
  const emp2 = employeesRes.rows[1] || { id: 2, first_name: "Lakshmi", last_name: "Ragula", employee_code: "EMP-002", email: "lragula@company.com" };

  // 1. Seed Critical Data Change Logs
  const changeCount = await pool.query("SELECT count(*) FROM critical_data_change_logs");
  if (parseInt(changeCount.rows[0].count, 10) === 0) {
    const criticalChanges = [
      {
        code: "CHG-202610-001",
        entity_type: "EMPLOYEE_COMPENSATION",
        entity_id: String(emp1.id),
        entity_name: `${emp1.first_name} ${emp1.last_name} (${emp1.employee_code})`,
        action_type: "UPDATE",
        user_id: adminUser?.id || null,
        user_name: "System Security Officer",
        user_email: adminUser?.email || "admin@hrms.com",
        user_role: adminUser?.role || "super_admin",
        source_ip: "192.168.1.104",
        source_channel: "ADMIN_CONSOLE",
        source_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0",
        old_values: { basic_salary: 85000, hra: 34000, special_allowance: 21000, ctc_annual: 1680000 },
        new_values: { basic_salary: 105000, hra: 42000, special_allowance: 28000, ctc_annual: 2100000 },
        changed_fields: ["basic_salary", "hra", "special_allowance", "ctc_annual"],
        business_justification: "Annual Executive Performance Appraisal Merit Increment (Band 4 to Band 5)",
        criticality: "CRITICAL"
      },
      {
        code: "CHG-202610-002",
        entity_type: "BANK_ACCOUNT",
        entity_id: String(emp2.id),
        entity_name: `${emp2.first_name} ${emp2.last_name} (${emp2.employee_code})`,
        action_type: "UPDATE",
        user_id: hrUser?.id || null,
        user_name: "Ananya Varma (HR Ops)",
        user_email: hrUser?.email || "hr@hrms.com",
        user_role: hrUser?.role || "hr",
        source_ip: "10.0.4.15",
        source_channel: "WEB_APPLICATION",
        source_user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        old_values: { bank_name: "HDFC Bank", account_number_masked: "XXXXXXXX9012", ifsc: "HDFC0001234" },
        new_values: { bank_name: "ICICI Bank", account_number_masked: "XXXXXXXX4481", ifsc: "ICIC0005678" },
        changed_fields: ["bank_name", "account_number", "ifsc_code"],
        business_justification: "Employee requested salary account migration verified with cancelled cheque",
        criticality: "CRITICAL"
      },
      {
        code: "CHG-202610-003",
        entity_type: "SECURITY_ROLE_PERMISSION",
        entity_id: "ROLE-FINANCE-DISBURSE",
        entity_name: "Finance Controller Role Permissions",
        action_type: "STATUS_OVERRIDE",
        user_id: adminUser?.id || null,
        user_name: "System Security Officer",
        user_email: adminUser?.email || "admin@hrms.com",
        user_role: adminUser?.role || "super_admin",
        source_ip: "127.0.0.1",
        source_channel: "ADMIN_CONSOLE",
        source_user_agent: "Enterprise PERN Admin Gateway",
        old_values: { can_disburse_payroll: false, requires_mfa: false },
        new_values: { can_disburse_payroll: true, requires_mfa: true },
        changed_fields: ["can_disburse_payroll", "requires_mfa"],
        business_justification: "Statutory segregation of duties: Finance disbursement access enabled with mandatory MFA",
        criticality: "CRITICAL"
      },
      {
        code: "CHG-202610-004",
        entity_type: "SOW_BILLING_RATE",
        entity_id: "SOW-2026-08",
        entity_name: "Enterprise Cloud Migration SOW (Acme Corp)",
        action_type: "UPDATE",
        user_id: managerUser?.id || null,
        user_name: "Vikas Guru (Delivery Head)",
        user_email: managerUser?.email || "manager@hrms.com",
        user_role: managerUser?.role || "manager",
        source_ip: "192.168.1.18",
        source_channel: "WEB_APPLICATION",
        source_user_agent: "Mozilla/5.0 Chrome/128.0",
        old_values: { hourly_rate_usd: 85, budget_cap_usd: 250000 },
        new_values: { hourly_rate_usd: 98, budget_cap_usd: 310000 },
        changed_fields: ["hourly_rate_usd", "budget_cap_usd"],
        business_justification: "Client signed Addendum 2 for scope expansion and senior DevOps engineering resource",
        criticality: "HIGH"
      }
    ];

    for (const c of criticalChanges) {
      await pool.query(`
        INSERT INTO critical_data_change_logs (
          change_code, entity_type, entity_id, entity_name, action_type,
          user_id, user_name, user_email, user_role, source_ip, source_channel, source_user_agent,
          old_values, new_values, changed_fields, business_justification, criticality
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `, [
        c.code, c.entity_type, c.entity_id, c.entity_name, c.action_type,
        c.user_id, c.user_name, c.user_email, c.user_role, c.source_ip, c.source_channel, c.source_user_agent,
        JSON.stringify(c.old_values), JSON.stringify(c.new_values), JSON.stringify(c.changed_fields),
        c.business_justification, c.criticality
      ]);
    }
    console.log("✓ Seeded critical data change logs");
  }

  // 2. Seed Immutable Approval Decision History
  const approvalCount = await pool.query("SELECT count(*) FROM approval_decision_history");
  if (parseInt(approvalCount.rows[0].count, 10) === 0) {
    const approvals = [
      {
        decision_code: "DEC-202610-001",
        workflow_type: "LEAVE_REQUEST",
        entity_id: "LV-2026-102",
        entity_title: `Privilege Leave (5 Days) - ${emp1.first_name} ${emp1.last_name}`,
        requester_id: emp1.id,
        requester_name: `${emp1.first_name} ${emp1.last_name}`,
        step_number: 1,
        step_name: "Level 1 - Line Manager Approval",
        decision: "APPROVED",
        approver_id: managerUser?.id || null,
        approver_name: "Vikas Guru (Engineering Manager)",
        approver_email: managerUser?.email || "manager@hrms.com",
        approver_role: "manager",
        comments: "Sprint deliverables are well-covered by peer rotation. Approved without blocker.",
        previous_status: "SUBMITTED",
        resulting_status: "PENDING_HR_VERIFICATION",
        ip_address: "192.168.1.18",
        source_channel: "WEB_PORTAL"
      },
      {
        decision_code: "DEC-202610-002",
        workflow_type: "LEAVE_REQUEST",
        entity_id: "LV-2026-102",
        entity_title: `Privilege Leave (5 Days) - ${emp1.first_name} ${emp1.last_name}`,
        requester_id: emp1.id,
        requester_name: `${emp1.first_name} ${emp1.last_name}`,
        step_number: 2,
        step_name: "Level 2 - HR Operational Clearance",
        decision: "APPROVED",
        approver_id: hrUser?.id || null,
        approver_name: "Ananya Varma (HR Ops)",
        approver_email: hrUser?.email || "hr@hrms.com",
        approver_role: "hr",
        comments: "Leave balance verified: 18 days available. Deduction applied to October payroll.",
        previous_status: "PENDING_HR_VERIFICATION",
        resulting_status: "APPROVED_FINAL",
        ip_address: "10.0.4.15",
        source_channel: "WEB_PORTAL"
      },
      {
        decision_code: "DEC-202610-003",
        workflow_type: "MONTHLY_PAYROLL_CUTOFF",
        entity_id: "PAY-2026-10",
        entity_title: "October 2026 Monthly Payroll Batch Cut-off Authorization",
        requester_id: null,
        requester_name: "Automated Payroll Cutoff Engine",
        step_number: 1,
        step_name: "Finance Controller Sign-off",
        decision: "APPROVED",
        approver_id: adminUser?.id || null,
        approver_name: "System Security Officer",
        approver_email: adminUser?.email || "admin@hrms.com",
        approver_role: "super_admin",
        comments: "Attendance lock, LOP deductions, and tax withholdings validated across 142 active headcount. Disbursal approved.",
        previous_status: "PENDING_FINANCE_APPROVAL",
        resulting_status: "LOCKED_FOR_DISBURSAL",
        ip_address: "127.0.0.1",
        source_channel: "WEB_PORTAL"
      },
      {
        decision_code: "DEC-202610-004",
        workflow_type: "SALARY_REVISION",
        entity_id: "SAL-REV-2026-44",
        entity_title: `Band 5 Compensation Revision for ${emp2.first_name} ${emp2.last_name}`,
        requester_id: emp2.id,
        requester_name: `${emp2.first_name} ${emp2.last_name}`,
        step_number: 1,
        step_name: "HOD Recommendation",
        decision: "APPROVED",
        approver_id: managerUser?.id || null,
        approver_name: "Vikas Guru (Engineering Manager)",
        approver_email: managerUser?.email || "manager@hrms.com",
        approver_role: "manager",
        comments: "Top 5% contributor across Q1-Q3. Exceptional architecture leadership on distributed data pipeline.",
        previous_status: "SUBMITTED",
        resulting_status: "PENDING_COMPENSATION_COMMITTEE",
        ip_address: "192.168.1.18",
        source_channel: "WEB_PORTAL"
      },
      {
        decision_code: "DEC-202610-005",
        workflow_type: "EXPENSE_REIMBURSEMENT",
        entity_id: "EXP-2026-904",
        entity_title: "Client Onsite Travel & Accommodation Expenses (INR 34,500)",
        requester_id: emp1.id,
        requester_name: `${emp1.first_name} ${emp1.last_name}`,
        step_number: 1,
        step_name: "Finance Audit",
        decision: "REJECTED",
        approver_id: hrUser?.id || null,
        approver_name: "Ananya Varma (HR Ops)",
        approver_email: hrUser?.email || "hr@hrms.com",
        approver_role: "hr",
        comments: "GST tax invoice is missing for hotel stay receipt on 2026-10-12. Please upload valid GSTIN invoice for reimbursement resubmission.",
        previous_status: "SUBMITTED",
        resulting_status: "REJECTED_NEEDS_RESUBMISSION",
        ip_address: "10.0.4.15",
        source_channel: "WEB_PORTAL"
      }
    ];

    for (const a of approvals) {
      await pool.query(`
        INSERT INTO approval_decision_history (
          decision_code, workflow_type, entity_id, entity_title,
          requester_id, requester_name, step_number, step_name, decision,
          approver_id, approver_name, approver_email, approver_role, comments,
          previous_status, resulting_status, ip_address, source_channel
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `, [
        a.decision_code, a.workflow_type, a.entity_id, a.entity_title,
        a.requester_id, a.requester_name, a.step_number, a.step_name, a.decision,
        a.approver_id, a.approver_name, a.approver_email, a.approver_role, a.comments,
        a.previous_status, a.resulting_status, a.ip_address, a.source_channel
      ]);
    }
    console.log("✓ Seeded immutable approval decision history");
  }

  // 3. Seed Effective-Dated History Ledger (Temporal Non-Overwriting)
  const effCount = await pool.query("SELECT count(*) FROM effective_dated_history");
  if (parseInt(effCount.rows[0].count, 10) === 0) {
    const effectiveHistory = [
      {
        entity_type: "EMPLOYEE_COMPENSATION",
        entity_id: String(emp1.id),
        entity_name: `${emp1.first_name} ${emp1.last_name} (${emp1.employee_code})`,
        version_number: 1,
        effective_from: "2024-04-01",
        effective_to: "2025-03-31",
        is_current: false,
        change_reason: "INITIAL_HIRE_OFFER_COMPENSATION",
        record_payload: {
          designation: "Software Engineer",
          department: "Engineering",
          grade: "L2",
          basic: 65000,
          hra: 26000,
          special_allowance: 15000,
          ctc_annual: 1272000,
          currency: "INR"
        },
        diff_summary: { note: "Initial employment onboarding compensation structure" },
        created_by_id: adminUser?.id || null,
        created_by_name: "HR Operations Admin"
      },
      {
        entity_type: "EMPLOYEE_COMPENSATION",
        entity_id: String(emp1.id),
        entity_name: `${emp1.first_name} ${emp1.last_name} (${emp1.employee_code})`,
        version_number: 2,
        effective_from: "2025-04-01",
        effective_to: "2026-03-31",
        is_current: false,
        change_reason: "ANNUAL_PERFORMANCE_MERIT",
        record_payload: {
          designation: "Senior Software Engineer",
          department: "Engineering",
          grade: "L3",
          basic: 85000,
          hra: 34000,
          special_allowance: 21000,
          ctc_annual: 1680000,
          currency: "INR"
        },
        diff_summary: {
          promotion: "Software Engineer -> Senior Software Engineer",
          ctc_increment_pct: "32.08%",
          delta_annual: "+408,000 INR"
        },
        created_by_id: adminUser?.id || null,
        created_by_name: "Compensation Review Board"
      },
      {
        entity_type: "EMPLOYEE_COMPENSATION",
        entity_id: String(emp1.id),
        entity_name: `${emp1.first_name} ${emp1.last_name} (${emp1.employee_code})`,
        version_number: 3,
        effective_from: "2026-04-01",
        effective_to: "9999-12-31",
        is_current: true,
        change_reason: "MARKET_CORRECTION_AND_LEAD_PROMOTION",
        record_payload: {
          designation: "Technical Lead & Principal Architect",
          department: "Engineering",
          grade: "L4",
          basic: 105000,
          hra: 42000,
          special_allowance: 28000,
          ctc_annual: 2100000,
          currency: "INR"
        },
        diff_summary: {
          promotion: "Senior Software Engineer -> Technical Lead & Principal Architect",
          ctc_increment_pct: "25.00%",
          delta_annual: "+420,000 INR"
        },
        created_by_id: adminUser?.id || null,
        created_by_name: "Leadership Executive Committee"
      },
      {
        entity_type: "JOB_DESIGNATION",
        entity_id: String(emp2.id),
        entity_name: `${emp2.first_name} ${emp2.last_name} (${emp2.employee_code})`,
        version_number: 1,
        effective_from: "2025-01-01",
        effective_to: "2026-06-30",
        is_current: false,
        change_reason: "INITIAL_JOINING_POSITION",
        record_payload: {
          title: "HR Specialist - Talent Acquisition",
          department: "Human Resources",
          reporting_to: "Head of People Operations"
        },
        diff_summary: { initial: true },
        created_by_id: adminUser?.id || null,
        created_by_name: "HR Operations"
      },
      {
        entity_type: "JOB_DESIGNATION",
        entity_id: String(emp2.id),
        entity_name: `${emp2.first_name} ${emp2.last_name} (${emp2.employee_code})`,
        version_number: 2,
        effective_from: "2026-07-01",
        effective_to: "9999-12-31",
        is_current: true,
        change_reason: "DEPARTMENT_REORGANIZATION_PROMOTION",
        record_payload: {
          title: "Lead HR Business Partner & Statutory Compliance Head",
          department: "Human Resources & Governance",
          reporting_to: "VP of People & Culture"
        },
        diff_summary: {
          title_change: "Talent Acquisition -> Lead HRBP & Statutory Compliance Head",
          department_change: "Human Resources -> Human Resources & Governance"
        },
        created_by_id: adminUser?.id || null,
        created_by_name: "CHRO & Managing Director"
      }
    ];

    for (const h of effectiveHistory) {
      await pool.query(`
        INSERT INTO effective_dated_history (
          entity_type, entity_id, entity_name, version_number,
          effective_from, effective_to, is_current, change_reason,
          record_payload, diff_summary, created_by_id, created_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        h.entity_type, h.entity_id, h.entity_name, h.version_number,
        h.effective_from, h.effective_to, h.is_current, h.change_reason,
        JSON.stringify(h.record_payload), JSON.stringify(h.diff_summary),
        h.created_by_id, h.created_by_name
      ]);
    }
    console.log("✓ Seeded effective-dated history ledger");
  }

  // 4. Seed Sensitive Export Logs & Administrative Action Logs
  const exportCount = await pool.query("SELECT count(*) FROM sensitive_export_logs");
  if (parseInt(exportCount.rows[0].count, 10) === 0) {
    const exports = [
      {
        export_code: "EXP-202610-001",
        export_type: "SALARY_REGISTER_EXCEL",
        export_format: "XLSX",
        record_count: 142,
        sensitivity_level: "FINANCIAL_CONFIDENTIAL",
        filter_criteria: { month: "2026-10", status: "Active", entity: "Quadratic Systems India Pvt Ltd" },
        file_checksum_sha256: crypto.createHash("sha256").update("SALARY_REGISTER_OCT_2026_DISBURSAL").digest("hex"),
        user_id: adminUser?.id || null,
        user_name: "System Security Officer",
        user_email: adminUser?.email || "admin@hrms.com",
        user_role: adminUser?.role || "super_admin",
        ip_address: "192.168.1.104",
        user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0",
        export_purpose: "Monthly Corporate Bank Net Disbursal Upload to ICICI E-Banking"
      },
      {
        export_code: "EXP-202610-002",
        export_type: "AADHAAR_PAN_COMPLIANCE_DOCKET",
        export_format: "ZIP",
        record_count: 28,
        sensitivity_level: "RESTRICTED_PII",
        filter_criteria: { onboarding_period: "2026-Q3", statutory_status: "Verified" },
        file_checksum_sha256: crypto.createHash("sha256").update("STATUTORY_ID_DOCKET_Q3_2026").digest("hex"),
        user_id: hrUser?.id || null,
        user_name: "Ananya Varma (HR Ops)",
        user_email: hrUser?.email || "hr@hrms.com",
        user_role: hrUser?.role || "hr",
        ip_address: "10.0.4.15",
        user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        export_purpose: "Statutory EPFO Unified Portal Aadhaar E-KYC Seeding Audit"
      },
      {
        export_code: "EXP-202610-003",
        export_type: "PF_ESI_ECR_REPORT",
        export_format: "CSV",
        record_count: 142,
        sensitivity_level: "STATUTORY_RESTRICTED",
        filter_criteria: { wage_month: "2026-09", return_type: "Electronic Challan cum Return (ECR)" },
        file_checksum_sha256: crypto.createHash("sha256").update("PF_ECR_SEPTEMBER_2026_RETURN").digest("hex"),
        user_id: adminUser?.id || null,
        user_name: "System Security Officer",
        user_email: adminUser?.email || "admin@hrms.com",
        user_role: adminUser?.role || "super_admin",
        ip_address: "127.0.0.1",
        user_agent: "PERN Enterprise Statutory Gateway",
        export_purpose: "Monthly EPFO Unified Shram Suvidha Portal Return Filing"
      }
    ];

    for (const e of exports) {
      await pool.query(`
        INSERT INTO sensitive_export_logs (
          export_code, export_type, export_format, record_count, sensitivity_level,
          filter_criteria, file_checksum_sha256, user_id, user_name, user_email,
          user_role, ip_address, user_agent, export_purpose
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        e.export_code, e.export_type, e.export_format, e.record_count, e.sensitivity_level,
        JSON.stringify(e.filter_criteria), e.file_checksum_sha256, e.user_id, e.user_name, e.user_email,
        e.user_role, e.ip_address, e.user_agent, e.export_purpose
      ]);
    }
    console.log("✓ Seeded sensitive export logs");
  }

  // Seed Administrative Action Logs
  const adminActionCount = await pool.query("SELECT count(*) FROM administrative_action_logs");
  if (parseInt(adminActionCount.rows[0].count, 10) === 0) {
    const adminActions = [
      {
        action_code: "ADM-202610-001",
        admin_id: adminUser?.id || null,
        admin_name: "System Security Officer",
        admin_email: adminUser?.email || "admin@hrms.com",
        admin_role: "super_admin",
        action_category: "ROLE_PRIVILEGE_MODIFIED",
        target_entity_type: "ROLE_PERMISSIONS",
        target_entity_id: "ROLE-AUDITOR",
        action_details: "Restricted Auditor role to Read-Only access across all compensation tables; disabled direct download",
        before_state: { can_download: true, can_view: true },
        after_state: { can_download: false, can_view: true, requires_watermark: true },
        status: "SUCCESS",
        ip_address: "127.0.0.1"
      },
      {
        action_code: "ADM-202610-002",
        admin_id: adminUser?.id || null,
        admin_name: "System Security Officer",
        admin_email: adminUser?.email || "admin@hrms.com",
        admin_role: "super_admin",
        action_category: "ENCRYPTION_KEY_ROTATED",
        target_entity_type: "SECURITY_VAULT",
        target_entity_id: "AES_256_GCM_PRIMARY_KEK",
        action_details: "Scheduled bi-annual Key Encryption Key (KEK) rotation executed with zero downtime across encrypted PII store",
        before_state: { key_version: "v3-2026-Q1" },
        after_state: { key_version: "v4-2026-Q4", rotated_at: new Date().toISOString() },
        status: "SUCCESS",
        ip_address: "127.0.0.1"
      },
      {
        action_code: "ADM-202610-003",
        admin_id: adminUser?.id || null,
        admin_name: "System Security Officer",
        admin_email: adminUser?.email || "admin@hrms.com",
        admin_role: "super_admin",
        action_category: "RETENTION_RULE_EXECUTED",
        target_entity_type: "DATA_RETENTION_RULE",
        target_entity_id: "RET-BIOMETRIC-04",
        action_details: "Automated cleanup rule executed: 4,210 raw biometric punch logs older than 90 days anonymized under DPDP Act 2023",
        before_state: { retention_period_days: 90, action: "ANONYMIZE" },
        after_state: { records_anonymized: 4210, execution_status: "SUCCESS" },
        status: "SUCCESS",
        ip_address: "127.0.0.1"
      }
    ];

    for (const a of adminActions) {
      await pool.query(`
        INSERT INTO administrative_action_logs (
          action_code, admin_id, admin_name, admin_email, admin_role,
          action_category, target_entity_type, target_entity_id,
          action_details, before_state, after_state, status, ip_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        a.action_code, a.admin_id, a.admin_name, a.admin_email, a.admin_role,
        a.action_category, a.target_entity_type, a.target_entity_id,
        a.action_details, JSON.stringify(a.before_state), JSON.stringify(a.after_state),
        a.status, a.ip_address
      ]);
    }
    console.log("✓ Seeded administrative action logs");
  }

  // 5. Seed Document Governance Audit Logs
  const docAuditCount = await pool.query("SELECT count(*) FROM document_governance_audit");
  if (parseInt(docAuditCount.rows[0].count, 10) === 0) {
    const docAudits = [
      {
        document_id: 3,
        document_name: "1791965898391-Sai_Kiran_Kushangala_AADHAR.pdf",
        document_category: "GOVERNMENT_IDS_AADHAAR_PAN",
        employee_id: 14,
        user_id: hrUser?.id || null,
        user_name: "Ananya Varma (HR Ops)",
        user_role: "hr",
        action_type: "PREVIEW_REQUESTED",
        access_granted: true,
        denial_reason: "",
        watermark_applied: "STATUTORY IDENTIFIER - hr@hrms.com - IP:10.0.4.15",
        ip_address: "10.0.4.15"
      },
      {
        document_id: 3,
        document_name: "1791965898391-Sai_Kiran_Kushangala_AADHAR.pdf",
        document_category: "GOVERNMENT_IDS_AADHAAR_PAN",
        employee_id: 14,
        user_id: managerUser?.id || null,
        user_name: "Vikas Guru (Manager)",
        user_role: "manager",
        action_type: "DOWNLOAD_REQUESTED",
        access_granted: false,
        denial_reason: "Role 'manager' does not have statutory download authorization for category GOVERNMENT_IDS_AADHAAR_PAN",
        watermark_applied: "",
        ip_address: "192.168.1.18"
      },
      {
        document_id: 5,
        document_name: "1791966700552-amma_aadhar.pdf",
        document_category: "COMPANY_POLICIES_PUBLIC",
        employee_id: 14,
        user_id: adminUser?.id || null,
        user_name: "System Security Officer",
        user_role: "super_admin",
        action_type: "ACCESS_GRANTED",
        access_granted: true,
        denial_reason: "",
        watermark_applied: "CONFIDENTIAL - admin@hrms.com - IP:127.0.0.1",
        ip_address: "127.0.0.1"
      }
    ];

    for (const d of docAudits) {
      await pool.query(`
        INSERT INTO document_governance_audit (
          document_id, document_name, document_category, employee_id,
          user_id, user_name, user_role, action_type, access_granted,
          denial_reason, watermark_applied, ip_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        d.document_id, d.document_name, d.document_category, d.employee_id,
        d.user_id, d.user_name, d.user_role, d.action_type, d.access_granted,
        d.denial_reason, d.watermark_applied, d.ip_address
      ]);
    }
    console.log("✓ Seeded document governance audit records");
  }

  console.log("\n========================================================");
  console.log("✅ 019 MIGRATION & SEEDING COMPLETED SUCCESSFULLY!");
  console.log("========================================================");
  process.exit(0);
}

run().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
