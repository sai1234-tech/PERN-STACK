import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log("=== EXECUTING MIGRATION 018_ENTERPRISE_AUTOMATIONS_AND_SLAS.SQL ===");
  const sqlPath = path.join(__dirname, "../migrations/018_enterprise_automations_and_slas.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  await pool.query(sql);
  console.log("✓ Migration 018 tables created successfully in PostgreSQL!\n");

  console.log("Seeding real-time automation and SLA records...");

  // 1. Seed Onboarding Checklist Templates
  const templateCheck = await pool.query("SELECT count(*) FROM onboarding_checklist_templates");
  if (parseInt(templateCheck.rows[0].count, 10) === 0) {
    const templates = [
      {
        code: "ONB-ENG-STD",
        role: "Engineering",
        title: "Standard Engineering Onboarding Protocol",
        items: [
          { title: "GitHub & Gitlab Enterprise Repository Access", category: "IT", due_day: 1 },
          { title: "Docker & Local Microservice Stack Setup", category: "Engineering", due_day: 2 },
          { title: "Architecture & System Design Briefing with Tech Lead", category: "Engineering", due_day: 3 },
          { title: "Secure Coding Guidelines & OWASP Briefing", category: "Security", due_day: 5 },
          { title: "First PR / Good First Issue Walkthrough", category: "Engineering", due_day: 7 },
        ],
      },
      {
        code: "ONB-SALES-STD",
        role: "Sales",
        title: "Sales & Client Acquisition Induction",
        items: [
          { title: "Salesforce / CRM User Provisioning", category: "IT", due_day: 1 },
          { title: "Product Catalog & Pricing Tier Certification", category: "Sales", due_day: 3 },
          { title: "Territory Allocation & Target Goal Review", category: "Sales", due_day: 5 },
        ],
      },
      {
        code: "ONB-CLIENT-DEPLOY",
        role: "Client Deployment",
        title: "Client-Specific Deployment & Security Checklist",
        items: [
          { title: "Client Data Privacy & NDA Countersigned", category: "Legal", due_day: 1 },
          { title: "Dedicated Client VPN & SecurID Token Issued", category: "IT", due_day: 2 },
          { title: "Client Network Security Clearance & Whitelist", category: "Security", due_day: 3 },
          { title: "Dedicated Client Workstation / VDI Provisioning", category: "IT", due_day: 4 },
        ],
      },
      {
        code: "ONB-HR-FINANCE",
        role: "Finance",
        title: "Finance & Accounting Operational Setup",
        items: [
          { title: "ERP & Accounting Ledger Access", category: "Finance", due_day: 1 },
          { title: "Expense & Travel Reimbursement Policy Briefing", category: "Finance", due_day: 2 },
          { title: "Statutory Payroll & Tax Filing Calendar Review", category: "Compliance", due_day: 4 },
        ],
      },
    ];

    for (const t of templates) {
      await pool.query(
        `
        INSERT INTO onboarding_checklist_templates (template_code, target_role, title, items)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (template_code) DO NOTHING;
      `,
        [t.code, t.role, t.title, JSON.stringify(t.items)]
      );
    }
    console.log("✓ Onboarding checklist templates seeded.");
  }

  // 1.1 Seed Onboarding Checklist Instances for recent employees
  const instanceCheck = await pool.query("SELECT count(*) FROM onboarding_checklist_instances");
  if (parseInt(instanceCheck.rows[0].count, 10) === 0) {
    const emps = await pool.query("SELECT id, first_name, last_name, department FROM employees LIMIT 3");
    for (const emp of emps.rows) {
      const name = `${emp.first_name} ${emp.last_name}`;
      const sampleTasks = [
        { task: "Identity & Bank Details Verification", cat: "HR", days: 1, status: "Completed" },
        { task: "Development Machine & Repository Provisioning", cat: "IT", days: 2, status: "Completed" },
        { task: "Client NDA & Security Policy Sign-off", cat: "Legal", days: 3, status: "In Progress" },
        { task: "Manager 1-on-1 & 30-Day Goal Alignment", cat: "Department", days: 7, status: "Pending" },
      ];

      for (const st of sampleTasks) {
        await pool.query(
          `
          INSERT INTO onboarding_checklist_instances (
            employee_id, employee_name, role, task_title, category, due_date, status, completed_at
          ) VALUES ($1, $2, $3, $4, $5, (CURRENT_DATE + ($6 || ' days')::interval)::date, $7, $8)
        `,
          [
            emp.id,
            name,
            emp.department || "Engineering",
            st.task,
            st.cat,
            st.days,
            st.status,
            st.status === "Completed" ? new Date() : null,
          ]
        );
      }
    }
    console.log("✓ Onboarding checklist instances seeded.");
  }

  // 2. Seed Missing Document Reminders
  const missingDocCheck = await pool.query("SELECT count(*) FROM missing_document_reminders");
  if (parseInt(missingDocCheck.rows[0].count, 10) === 0) {
    const emps = await pool.query("SELECT id, employee_code, first_name, last_name FROM employees LIMIT 4");
    const docVariants = [
      ["Relieving Letter from Previous Employer", "Form 16 / Tax Certificate"],
      ["Highest Degree Certificate / Marksheet", "Permanent Account Number (PAN Card) Copy"],
      ["Signed Code of Conduct & Client NDA Docket"],
      ["Cancelled Bank Cheque / Passbook Copy", "Aadhaar Card Copy"],
    ];

    let idx = 0;
    for (const emp of emps.rows) {
      const name = `${emp.first_name} ${emp.last_name}`;
      const missingList = docVariants[idx % docVariants.length];
      await pool.query(
        `
        INSERT INTO missing_document_reminders (
          employee_id, employee_code, employee_name, missing_documents, reminder_channel, reminder_count, due_date, status
        ) VALUES ($1, $2, $3, $4, 'IN_APP_AND_EMAIL', 1, CURRENT_DATE + INTERVAL '5 days', 'SENT')
      `,
        [emp.id, emp.employee_code, name, JSON.stringify(missingList)]
      );
      idx++;
    }
    console.log("✓ Missing document reminders seeded.");
  }

  // 3. Seed BGV SLA Escalations
  const bgvCheck = await pool.query("SELECT count(*) FROM bgv_sla_escalations");
  if (parseInt(bgvCheck.rows[0].count, 10) === 0) {
    const bgvs = await pool.query(`
      SELECT b.id, b.bgv_code, b.candidate_id, b.verification_type, b.agency, b.initiated_date,
             COALESCE(c.name, 'Candidate Candidate') AS candidate_name
      FROM bgv_verifications b
      LEFT JOIN candidates c ON b.candidate_id = c.id
      LIMIT 4;
    `);

    let i = 0;
    for (const b of bgvs.rows) {
      const slaDays = 7;
      const daysElapsed = i === 0 ? 9 : i === 1 ? 6 : 3;
      const status = daysElapsed > slaDays ? "BREACHED" : daysElapsed >= 5 ? "AT_RISK" : "ON_TRACK";
      const escLevel = status === "BREACHED" ? "L2_DIRECTOR" : status === "AT_RISK" ? "L1_LEAD" : "NONE";
      const escTo = status === "BREACHED" ? "Talent Acquisition Director" : status === "AT_RISK" ? "BGV Operations Lead" : "";
      const action = status === "BREACHED" ? "Escalated to vendor account manager for urgent expedite" : "";

      await pool.query(
        `
        INSERT INTO bgv_sla_escalations (
          bgv_id, bgv_code, candidate_id, candidate_name, verification_type, agency,
          sla_days, days_elapsed, sla_status, escalation_level, escalated_to, action_taken, escalated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `,
        [
          b.id,
          b.bgv_code,
          b.candidate_id,
          b.candidate_name,
          b.verification_type,
          b.agency || "AuthBridge Screening Corp",
          slaDays,
          daysElapsed,
          status,
          escLevel,
          escTo,
          action,
          status !== "ON_TRACK" ? new Date() : null,
        ]
      );
      i++;
    }
    console.log("✓ BGV SLA escalations seeded.");
  }

  // 4. Seed Monthly Cut-Off Batches
  const cutoffCheck = await pool.query("SELECT count(*) FROM monthly_cutoff_batches");
  if (parseInt(cutoffCheck.rows[0].count, 10) === 0) {
    const totalEmps = await pool.query("SELECT count(*) FROM employees");
    const count = parseInt(totalEmps.rows[0].count, 10) || 12;

    await pool.query(`
      INSERT INTO monthly_cutoff_batches (
        batch_code, month, year, cutoff_day, total_employees_processed,
        total_lop_days, total_overtime_hours, total_gross_payable, status, executed_by
      ) VALUES (
        'CUTOFF-2026-10-AUTO', 'October', 2026, 25, $1,
        4.5, 38.0, 842500.00, 'CUTOFF_REACHED_GENERATED', 'Automated Payroll Cut-off Engine'
      )
    `, [count]);
    console.log("✓ Monthly payroll cut-off batch seeded.");
  }

  // 5. Seed Probation / Confirmation Reminders
  const probationCheck = await pool.query("SELECT count(*) FROM probation_confirmation_alerts");
  if (parseInt(probationCheck.rows[0].count, 10) === 0) {
    const emps = await pool.query("SELECT id, employee_code, first_name, last_name, department, joining_date FROM employees LIMIT 3");
    let pIdx = 0;
    for (const emp of emps.rows) {
      const name = `${emp.first_name} ${emp.last_name}`;
      const joining = emp.joining_date ? new Date(emp.joining_date) : new Date(Date.now() - 75 * 24 * 3600 * 1000);
      const probationEnd = new Date(joining.getTime() + 90 * 24 * 3600 * 1000);
      const daysRem = pIdx === 0 ? 7 : pIdx === 1 ? 15 : 28;
      const stage = daysRem <= 7 ? "7_DAYS_PRIOR" : daysRem <= 15 ? "15_DAYS_PRIOR" : "30_DAYS_PRIOR";

      await pool.query(
        `
        INSERT INTO probation_confirmation_alerts (
          employee_id, employee_code, employee_name, department, manager_name,
          joining_date, probation_end_date, days_remaining, alert_stage, recommendation_status
        ) VALUES ($1, $2, $3, $4, 'Vikas Guru (Engineering Lead)', $5, $6, $7, $8, 'PENDING_REVIEW')
      `,
        [emp.id, emp.employee_code, name, emp.department || "Engineering", joining, probationEnd, daysRem, stage]
      );
      pIdx++;
    }
    console.log("✓ Probation confirmation reminders seeded.");
  }

  // 6. Seed Performance Cycle Reminders
  const perfCycleCheck = await pool.query("SELECT count(*) FROM performance_cycle_alerts");
  if (parseInt(perfCycleCheck.rows[0].count, 10) === 0) {
    const cycles = await pool.query("SELECT id, cycle_code, name, submission_deadline FROM performance_cycles LIMIT 1");
    if (cycles.rows.length > 0) {
      const c = cycles.rows[0];
      await pool.query(
        `
        INSERT INTO performance_cycle_alerts (
          cycle_id, cycle_code, cycle_name, stage, deadline_date,
          days_remaining, recipient_role, total_pending_submissions, alert_message
        ) VALUES (
          $1, $2, $3, 'SELF_APPRAISAL', $4,
          5, 'All Employees', 8,
          'Reminder: Q4 2026 Self-Appraisal submissions close in 5 days. Please submit your KRA/KPI ratings.'
        )
      `,
        [c.id, c.cycle_code, c.name, c.submission_deadline || new Date(Date.now() + 5 * 24 * 3600 * 1000)]
      );
      console.log("✓ Performance cycle reminders seeded.");
    }
  }

  // 7. Seed Exit Clearance Tasks (5 Departments)
  const exitTasksCheck = await pool.query("SELECT count(*) FROM exit_clearance_tasks");
  if (parseInt(exitTasksCheck.rows[0].count, 10) === 0) {
    const resignations = await pool.query(`
      SELECT r.id, r.employee_id, CONCAT(e.first_name, ' ', e.last_name) AS employee_name
      FROM resignations r
      JOIN employees e ON r.employee_id = e.id
      LIMIT 1;
    `);

    if (resignations.rows.length > 0) {
      const r = resignations.rows[0];
      const deptTasks = [
        { dept: "IT", task: "Laptop & Peripheral Recovery, VPN/Git Access Revocation", req: "Verify MacBook Pro serial tag, wipe company credentials, disable Slack/Intune" },
        { dept: "Finance", task: "Travel Advance & Corporate Credit Card Reconciliation", req: "Audit pending expense reports, cancel corporate AMEX, verify nil dues" },
        { dept: "Admin", task: "Access Badge, Physical Locker & Parking Tag Handover", req: "Collect physical biometric access card, clear locker, cancel biometric parking pass" },
        { dept: "Reporting Manager", task: "Knowledge Transfer (KT) & Git Repo Handover", req: "Sign off documentation dockets, reassign active SOW tickets, ensure no blockers" },
        { dept: "HR", task: "Exit Interview & Non-Compete Reaffirmation", req: "Conduct exit survey, explain PF/Gratuity settlement, issue relieving letter" },
      ];

      for (const dt of deptTasks) {
        await pool.query(
          `
          INSERT INTO exit_clearance_tasks (
            resignation_id, employee_id, employee_name, department, task_name, required_action, status
          ) VALUES ($1, $2, $3, $4, $5, $6, 'Pending')
        `,
          [r.id, r.employee_id, r.employee_name, dt.dept, dt.task, dt.req]
        );
      }
      console.log("✓ Exit clearance 5-department tasks seeded.");
    }
  }

  // 8. Seed Helpdesk SLA Escalations
  const ticketSlaCheck = await pool.query("SELECT count(*) FROM ticket_sla_escalations");
  if (parseInt(ticketSlaCheck.rows[0].count, 10) === 0) {
    const tickets = await pool.query("SELECT ticket_id, emp_id, query, created_at FROM tickets LIMIT 3");
    let tIdx = 0;
    for (const t of tickets.rows) {
      const priority = tIdx === 0 ? "Critical" : tIdx === 1 ? "High" : "Medium";
      const targetHours = priority === "Critical" ? 4 : priority === "High" ? 8 : 24;
      const hoursElapsed = priority === "Critical" ? 5.5 : priority === "High" ? 7.2 : 12.0;
      const slaStatus = hoursElapsed > targetHours ? "BREACHED" : hoursElapsed >= targetHours * 0.8 ? "APPROACHING_SLA" : "WITHIN_SLA";
      const escLevel = slaStatus === "BREACHED" ? "L2_LEAD" : "L1";
      const escTo = slaStatus === "BREACHED" ? "IT Helpdesk Operations Manager" : "Tier-1 Support Team";

      await pool.query(
        `
        INSERT INTO ticket_sla_escalations (
          ticket_id, emp_id, category, priority, sla_target_hours, hours_elapsed,
          sla_status, escalation_level, escalated_to, status
        ) VALUES ($1, $2, 'IT Infrastructure & Access', $3, $4, $5, $6, $7, $8, 'OPEN')
      `,
        [t.ticket_id, t.emp_id, priority, targetHours, hoursElapsed, slaStatus, escLevel, escTo]
      );
      tIdx++;
    }
    console.log("✓ Helpdesk ticket SLA escalations seeded.");
  }

  // 9. Seed Scheduled Authorized Dashboards & Reports
  const reportCheck = await pool.query("SELECT count(*) FROM scheduled_reports");
  if (parseInt(reportCheck.rows[0].count, 10) === 0) {
    const reports = [
      {
        code: "REP-ATTENDANCE-DAILY",
        title: "Daily Workforce Attendance & Punch Telemetry",
        category: "ATTENDANCE",
        frequency: "DAILY",
        roles: ["admin", "hr", "manager"],
        format: "PDF / CSV",
      },
      {
        code: "REP-HEADCOUNT-WEEKLY",
        title: "Weekly Headcount, Attrition & Department Pod Distribution",
        category: "WORKFORCE",
        frequency: "WEEKLY",
        roles: ["admin", "leadership"],
        format: "PDF / Excel",
      },
      {
        code: "REP-PAYROLL-MONTHLY",
        title: "Monthly Payroll Disbursal, LOP Deductions & Tax Audit",
        category: "PAYROLL",
        frequency: "MONTHLY",
        roles: ["admin", "payroll", "finance"],
        format: "Encrypted CSV / PDF",
      },
      {
        code: "REP-DPDP-COMPLIANCE-QTR",
        title: "Quarterly Indian DPDP Act 2023 Consent & Rights Audit Docket",
        category: "COMPLIANCE",
        frequency: "QUARTERLY",
        roles: ["admin", "auditor", "leadership"],
        format: "Cryptographically Signed PDF",
      },
      {
        code: "REP-HELPDESK-SLA-WEEKLY",
        title: "Weekly Helpdesk Resolution & SLA Escalation Scorecard",
        category: "HELPDESK",
        frequency: "WEEKLY",
        roles: ["admin", "hr", "it_admin"],
        format: "PDF",
      },
    ];

    for (const r of reports) {
      await pool.query(
        `
        INSERT INTO scheduled_reports (
          report_code, title, category, frequency, authorized_roles, format, last_run_at, next_run_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day')
        ON CONFLICT (report_code) DO NOTHING;
      `,
        [r.code, r.title, r.category, r.frequency, JSON.stringify(r.roles), r.format]
      );

      // Seed an execution record
      await pool.query(
        `
        INSERT INTO scheduled_report_executions (
          report_code, report_title, records_count, file_size_kb, status
        ) VALUES ($1, $2, 42, 128.5, 'SUCCESS')
      `,
        [r.code, r.title]
      );
    }
    console.log("✓ Scheduled authorized reports seeded.");
  }

  console.log("\n=== ALL 9 AUTOMATION & SLA ENGINES SUCCESSFULLY INITIALIZED ===");
  await pool.end();
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
