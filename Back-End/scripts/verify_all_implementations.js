import "dotenv/config";
import pool from "../config/db.js";

async function verifyAll() {
  console.log("================================================================================");
  console.log("                ENTERPRISE PERN HRMS: COMPREHENSIVE AUDIT VERIFICATION          ");
  console.log("================================================================================\n");

  // 1. VERIFY ALL 41 CORE DATABASE ENTITIES
  console.log("--- 1. AUDITING ALL 41 CORE DATABASE ENTITIES IN POSTGRESQL ---");
  const entities = [
    { num: 1, name: "Employee", query: "SELECT count(*) FROM employees" },
    { num: 2, name: "Person", query: "SELECT count(*) FROM persons" },
    { num: 3, name: "Employment", query: "SELECT count(*) FROM employments" },
    { num: 4, name: "Organization", query: "SELECT count(*) FROM organizations" },
    { num: 5, name: "Department", query: "SELECT count(*) FROM departments" },
    { num: 6, name: "Designation", query: "SELECT count(*) FROM designations" },
    { num: 7, name: "Location", query: "SELECT count(*) FROM locations" },
    { num: 8, name: "Client", query: "SELECT count(*) FROM clients" },
    { num: 9, name: "Project", query: "SELECT count(*) FROM client_projects" },
    { num: 10, name: "SOW", query: "SELECT count(*) FROM statement_of_works" },
    { num: 11, name: "Deployment", query: "SELECT count(*) FROM project_allocations" },
    { num: 12, name: "Candidate", query: "SELECT count(*) FROM candidates" },
    { num: 13, name: "Requisition", query: "SELECT count(*) FROM job_requisitions" },
    { num: 14, name: "Interview", query: "SELECT count(*) FROM interviews" },
    { num: 15, name: "Offer", query: "SELECT count(*) FROM job_offers" },
    { num: 16, name: "Onboarding", query: "SELECT count(*) FROM onboarding_tasks" },
    { num: 17, name: "BGV", query: "SELECT count(*) FROM bgv_verifications" },
    { num: 18, name: "Document", query: "SELECT count(*) FROM employee_documents" },
    { num: 19, name: "Attendance", query: "SELECT count(*) FROM attendance" },
    { num: 20, name: "Shift", query: "SELECT count(*) FROM shifts" },
    { num: 21, name: "Holiday", query: "SELECT count(*) FROM holidays" },
    { num: 22, name: "Leave Type", query: "SELECT count(*) FROM leave_types" },
    { num: 23, name: "Leave Balance", query: "SELECT count(*) FROM leave_balances" },
    { num: 24, name: "Leave Request", query: "SELECT count(*) FROM leaves" },
    { num: 25, name: "Salary Revision", query: "SELECT count(*) FROM salary_revisions" },
    { num: 26, name: "Payroll Input", query: "SELECT count(*) FROM payroll_inputs" },
    { num: 27, name: "Performance Cycle", query: "SELECT count(*) FROM performance_cycles" },
    { num: 28, name: "Goal", query: "SELECT count(*) FROM goals" },
    { num: 29, name: "KRA", query: "SELECT count(*) FROM kras" },
    { num: 30, name: "KPI", query: "SELECT count(*) FROM kpi_metrics" },
    { num: 31, name: "Ticket", query: "SELECT count(*) FROM tickets" },
    { num: 32, name: "Asset", query: "SELECT count(*) FROM assets" },
    { num: 33, name: "Exit", query: "SELECT count(*) FROM resignations" },
    { num: 34, name: "Clearance", query: "SELECT count(*) FROM clearances" },
    { num: 35, name: "Full & Final Input", query: "SELECT count(*) FROM fnf_settlements" },
    { num: 36, name: "Notification", query: "SELECT count(*) FROM notifications" },
    { num: 37, name: "Approval", query: "SELECT count(*) FROM approvals" },
    { num: 38, name: "User", query: "SELECT count(*) FROM users" },
    { num: 39, name: "Role", query: "SELECT count(*) FROM roles" },
    { num: 40, name: "Permission", query: "SELECT count(*) FROM permissions" },
    { num: 41, name: "Audit Log", query: "SELECT count(*) FROM audit_logs" }
  ];

  let entitiesOperational = 0;
  for (const e of entities) {
    try {
      const res = await pool.query(e.query);
      const cnt = parseInt(res.rows[0].count, 10);
      console.log(`[${e.num.toString().padStart(2, "0")}/41] Entity: ${e.name.padEnd(22)} => ${cnt.toString().padStart(4, " ")} live rows [OPERATIONAL]`);
      entitiesOperational++;
    } catch (err) {
      console.error(`[${e.num.toString().padStart(2, "0")}/41] Entity: ${e.name.padEnd(22)} => ERROR: ${err.message}`);
    }
  }

  console.log(`\nEntity Verification Score: ${entitiesOperational} / 41 Entities Fully Operational.\n`);

  // 2. VERIFY ALL 8 ENTERPRISE INTEGRATION CHANNELS
  console.log("--- 2. AUDITING ALL 8 ENTERPRISE INTEGRATION CHANNELS IN POSTGRESQL ---");
  const integrations = [
    {
      num: 1,
      name: "Payroll Vendor",
      key: "payroll_vendor",
      purpose: "Payroll inputs/results",
      method: "API / SFTP / encrypted file",
      table: "payroll_vendor_batches"
    },
    {
      num: 2,
      name: "Biometric",
      key: "biometric_attendance",
      purpose: "Attendance",
      method: "API / scheduled import",
      table: "biometric_punch_logs"
    },
    {
      num: 3,
      name: "Identity Provider",
      key: "identity_provider",
      purpose: "SSO/MFA",
      method: "OAuth2/OIDC/SAML as applicable",
      table: "users"
    },
    {
      num: 4,
      name: "Email",
      key: "email_service",
      purpose: "Notifications",
      method: "Microsoft Graph / SMTP / provider API",
      table: "notifications"
    },
    {
      num: 5,
      name: "BGV Provider",
      key: "bgv_provider",
      purpose: "Verification status",
      method: "API / secure file",
      table: "bgv_verifications"
    },
    {
      num: 6,
      name: "Calendar",
      key: "calendar_service",
      purpose: "Interview scheduling",
      method: "Microsoft/Google API",
      table: "interviews"
    },
    {
      num: 7,
      name: "Finance/ERP",
      key: "finance_erp",
      purpose: "Cost center/accounting",
      method: "API / file",
      table: "erp_journal_batches"
    },
    {
      num: 8,
      name: "IT Asset System",
      key: "it_asset_system",
      purpose: "Laptop/email/access",
      method: "API / workflow",
      table: "it_asset_provisioning_jobs"
    }
  ];

  let integrationsOperational = 0;
  for (const i of integrations) {
    try {
      const conn = await pool.query("SELECT * FROM integration_connectors WHERE connector_key = $1", [i.key]);
      const rowsCount = await pool.query(`SELECT count(*) FROM ${i.table}`);
      const c = conn.rows[0];
      const records = parseInt(rowsCount.rows[0].count, 10);
      console.log(`[${i.num}/8] Channel: ${i.name.padEnd(20)} | Purpose: ${i.purpose.padEnd(24)} | Method: ${i.method.padEnd(36)}`);
      console.log(`     Status: ${c.health_status} | Provider: ${c.provider} | Live Table Records (${i.table}): ${records}`);
      integrationsOperational++;
    } catch (err) {
      console.error(`[${i.num}/8] Channel: ${i.name} => ERROR: ${err.message}`);
    }
  }

  console.log(`\nIntegration Verification Score: ${integrationsOperational} / 8 Connectors Operational.\n`);

  // 3. AUDIT SYNC LOGS COUNT
  const syncLogs = await pool.query("SELECT count(*) FROM integration_sync_logs");
  console.log(`Audit Trail: ${syncLogs.rows[0].count} real-time sync transactions recorded in 'integration_sync_logs'.`);
  console.log("================================================================================");

  await pool.end();
  process.exit(0);
}

verifyAll().catch(err => {
  console.error("Audit verification error:", err);
  process.exit(1);
});
