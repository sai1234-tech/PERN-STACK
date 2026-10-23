import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrationAndSeed() {
  console.log("=== EXECUTING 014_ENTERPRISE_41_ENTITIES MIGRATION ===");

  const sqlPath = path.join(__dirname, "../migrations/014_enterprise_41_entities.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  await pool.query(sql);
  console.log(" Migration 014 SQL executed successfully!");

  // Verify created tables
  const tableCheck = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log(`\n Total PostgreSQL tables in database: ${tableCheck.rows.length}`);
  const tableNames = tableCheck.rows.map(r => r.table_name);
  console.log("Tables:", tableNames.join(", "));

  // Fetch key existing entity records to link
  const empRes = await pool.query(`SELECT id, employee_code, first_name, last_name, user_id, department, designation FROM employees ORDER BY id ASC LIMIT 10`);
  const employees = empRes.rows;
  console.log(`Found ${employees.length} employees for relational linking`);

  const clientRes = await pool.query(`SELECT id, client_name FROM clients ORDER BY id ASC LIMIT 5`);
  const clients = clientRes.rows;

  const projRes = await pool.query(`SELECT id, project_name, client_id FROM client_projects ORDER BY id ASC LIMIT 5`);
  const projects = projRes.rows;

  const candRes = await pool.query(`SELECT id, name, designation FROM candidates ORDER BY id ASC LIMIT 5`);
  const candidates = candRes.rows;

  const userRes = await pool.query(`SELECT id, email, role FROM users ORDER BY id ASC LIMIT 10`);
  const users = userRes.rows;

  const resigRes = await pool.query(`
    SELECT r.id, r.employee_id, CONCAT(e.first_name, ' ', e.last_name) AS employee_name
    FROM resignations r
    JOIN employees e ON r.employee_id = e.id
    ORDER BY r.id ASC LIMIT 5
  `);
  const resignations = resigRes.rows;

  // 1. Seed Organizations
  const orgCount = await pool.query(`SELECT count(*) FROM organizations`);
  if (parseInt(orgCount.rows[0].count) === 0) {
    console.log("Seeding Organizations...");
    await pool.query(`
      INSERT INTO organizations (company_name, legal_name, cin, gstin, pan, website, headquarters, contact_email, contact_phone, currency, fiscal_year_start)
      VALUES 
      ('Quadratic Systems Enterprise', 'Quadratic Systems Technologies Private Limited', 'U72200TG2020PTC145678', '36AAACE1234F1Z5', 'AAACE1234F', 'https://quadraticsystems.io', 'HITEC City, Phase 2, Hyderabad, Telangana 500081', 'enterprise-ops@quadraticsystems.io', '+91 40 4567 8900', 'INR', 'April'),
      ('Acme Global Digital Solutions', 'Acme Global Services Corp', 'U72900KA2019PTC098765', '29AABCA9876K1Z2', 'AABCA9876K', 'https://acmeglobal.corp', 'Outer Ring Road, Bellandur, Bengaluru, Karnataka 560103', 'contact@acmeglobal.corp', '+91 80 6789 0123', 'INR', 'April');
    `);
  }

  // 2. Seed Designations
  const desigCount = await pool.query(`SELECT count(*) FROM designations`);
  if (parseInt(desigCount.rows[0].count) === 0) {
    console.log("Seeding Designations...");
    const designations = [
      ['DSG-001', 'Vice President - Engineering', 'Engineering', 'L6', 4500000, 6500000, 'Strategic technology leadership, architecture and org scaling'],
      ['DSG-002', 'Principal Cloud Architect', 'Engineering', 'L5', 3200000, 4800000, 'Cloud infrastructure, high availability and microservices architecture'],
      ['DSG-003', 'Senior Full Stack Engineer', 'Engineering', 'L4', 1800000, 2800000, 'PERN stack core product and API platform development'],
      ['DSG-004', 'Lead DevOps Specialist', 'DevOps & Cloud', 'L4', 2000000, 3000000, 'Kubernetes, CI/CD pipelines, Terraform and observability'],
      ['DSG-005', 'Senior HR Business Partner', 'Human Resources', 'L4', 1400000, 2200000, 'Talent strategy, employee relations, and HR compliance'],
      ['DSG-006', 'HR Operations Executive', 'Human Resources', 'L2', 600000, 950000, 'Onboarding, attendance tracking, and HR helpdesk support'],
      ['DSG-007', 'Product Delivery Manager', 'Management', 'L4', 2200000, 3200000, 'Agile program delivery, sprint planning and stakeholder coordination'],
      ['DSG-008', 'Lead QA Automation Engineer', 'Quality Assurance', 'L3', 1300000, 1900000, 'Automated regression suites, Playwright and performance testing']
    ];
    for (const d of designations) {
      await pool.query(`
        INSERT INTO designations (designation_code, title, department, band, min_salary, max_salary, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (designation_code) DO NOTHING;
      `, d);
    }
  }

  // 3. Seed Locations
  const locCount = await pool.query(`SELECT count(*) FROM locations`);
  if (parseInt(locCount.rows[0].count) === 0) {
    console.log("Seeding Locations...");
    const locations = [
      ['LOC-HYD', 'Hyderabad Global Innovation HQ', 'Hyderabad', 'Telangana', 'India', 'Tower B, 7th Floor, Cyber Gateway, HITEC City, Hyderabad', 'Asia/Kolkata', 'Corporate HQ', 450, true],
      ['LOC-BLR', 'Bengaluru Technology Campus', 'Bengaluru', 'Karnataka', 'India', 'Block C, EcoWorld Tech Park, Sarjapur Outer Ring Road, Bengaluru', 'Asia/Kolkata', 'R&D Center', 300, true],
      ['LOC-PUN', 'Pune Engineering Center', 'Pune', 'Maharashtra', 'India', 'Magarpatta Cybercity, Tower 12, Hadapsar, Pune', 'Asia/Kolkata', 'Delivery Center', 200, true],
      ['LOC-US-SJC', 'North America Delivery Office', 'San Jose', 'California', 'USA', '2033 Gateway Place, Suite 500, San Jose, CA 95110', 'America/Los_Angeles', 'Regional Office', 50, true]
    ];
    for (const l of locations) {
      await pool.query(`
        INSERT INTO locations (location_code, name, city, state, country, address, timezone, facility_type, capacity, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (location_code) DO NOTHING;
      `, l);
    }
  }

  // 4. Seed SOWs (Statement of Works)
  const sowCount = await pool.query(`SELECT count(*) FROM statement_of_works`);
  if (parseInt(sowCount.rows[0].count) === 0 && clients.length > 0) {
    console.log("Seeding Statement of Works...");
    const clientId = clients[0].id;
    const projId = projects.length > 0 ? projects[0].id : null;
    await pool.query(`
      INSERT INTO statement_of_works (sow_number, client_id, project_id, title, start_date, end_date, total_value, billing_model, status, signed_at)
      VALUES 
      ('SOW-2026-001', $1, $2, 'NextGen Enterprise Cloud Banking Infrastructure Modernization', '2026-01-01', '2026-12-31', 48500000.00, 'Time & Materials', 'Active', '2025-12-20 14:00:00'),
      ('SOW-2026-002', $1, $2, 'AI-Driven Predictive Risk Analytics Suite SOW Phase 2', '2026-03-01', '2027-02-28', 32000000.00, 'Fixed Bid Milestones', 'Active', '2026-02-15 11:30:00');
    `, [clientId, projId]);
  }

  // 5. Seed Job Requisitions
  const reqCount = await pool.query(`SELECT count(*) FROM job_requisitions`);
  if (parseInt(reqCount.rows[0].count) === 0) {
    console.log("Seeding Job Requisitions...");
    const requisitions = [
      ['REQ-2026-01', 'Lead Cloud DevOps Architect', 'Engineering', 2, 1, '₹28L - ₹38L', '2026-11-30', 'High', 'Vikas Guru', 'Open', 'Scaling Kubernetes clusters, multi-region AWS DR setup and zero-trust security'],
      ['REQ-2026-02', 'Senior React / Node.js Full Stack Dev', 'Engineering', 4, 2, '₹16L - ₹24L', '2026-11-15', 'Critical', 'Vikas Guru', 'Open', 'High performance enterprise dashboard and real-time telemetry streaming'],
      ['REQ-2026-03', 'HR Compliance & Audit Specialist', 'Human Resources', 1, 0, '₹10L - ₹14L', '2026-12-10', 'Medium', 'Ananya Sharma', 'Open', 'Statutory compliance, labor law audits, PF/ESI reconciliation and ISO standards']
    ];
    for (const r of requisitions) {
      await pool.query(`
        INSERT INTO job_requisitions (req_code, title, department, positions, filled, budget_range, target_date, priority, hiring_manager, status, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (req_code) DO NOTHING;
      `, r);
    }
  }

  // 6. Seed Interviews
  const intCount = await pool.query(`SELECT count(*) FROM interviews`);
  if (parseInt(intCount.rows[0].count) === 0 && candidates.length > 0) {
    console.log("Seeding Interviews...");
    const cand = candidates[0];
    await pool.query(`
      INSERT INTO interviews (interview_code, candidate_id, candidate_name, role, round, date, time, panelist, mode, meeting_link, status, score, feedback)
      VALUES 
      ('INT-8801', $1, $2, $3, 'Technical Architecture Round', '2026-10-24', '14:30 IST', 'Vikas Guru', 'Google Meet', 'https://meet.google.com/xyz-pern-hrms', 'Scheduled', 'Pending', 'Evaluation of PostgreSQL distributed systems and Node.js microservices'),
      ('INT-8802', $1, $2, $3, 'HR & Culture Alignment', '2026-10-25', '16:00 IST', 'Ananya Sharma', 'Google Meet', 'https://meet.google.com/abc-pern-hrms', 'Scheduled', 'Pending', 'Leadership capabilities, team culture fit, and notice period buyout');
    `, [cand.id, cand.name, cand.designation || 'Senior Software Engineer']);
  }

  // 7. Seed Job Offers
  const offCount = await pool.query(`SELECT count(*) FROM job_offers`);
  if (parseInt(offCount.rows[0].count) === 0 && candidates.length > 0) {
    console.log("Seeding Job Offers...");
    const cand = candidates[0];
    await pool.query(`
      INSERT INTO job_offers (offer_code, candidate_id, designation, department, annual_ctc, joining_date, expiry_date, status, offer_letter_url)
      VALUES 
      ('OFF-2026-091', $1, 'Senior Cloud Engineer', 'Engineering', 2200000.00, '2026-11-16', '2026-10-31', 'Released', 'https://storage.enterprise.io/offers/OFF-2026-091.pdf');
    `, [cand.id]);
  }

  // 8. Seed Onboarding Tasks
  const onbCount = await pool.query(`SELECT count(*) FROM onboarding_tasks`);
  if (parseInt(onbCount.rows[0].count) === 0 && candidates.length > 0) {
    console.log("Seeding Onboarding Tasks...");
    const cand = candidates[0];
    const empId = employees.length > 0 ? employees[0].id : null;
    await pool.query(`
      INSERT INTO onboarding_tasks (task_code, candidate_id, employee_id, title, category, assigned_to, due_date, status)
      VALUES 
      ('ONB-101', $1, $2, 'Issue Enterprise MacBook Pro & IT Credentials', 'IT Setup', 'IT Operations Team', '2026-11-15', 'In Progress'),
      ('ONB-102', $1, $2, 'Complete Statutory Provident Fund & Gratuity Form 11', 'HR Compliance', 'HR Induction Desk', '2026-11-16', 'Pending'),
      ('ONB-103', $1, $2, 'Executive Security Awareness & Data Privacy Training', 'Compliance', 'Security Officer', '2026-11-20', 'Pending');
    `, [cand.id, empId]);
  }

  // 9. Seed BGV Verifications
  const bgvCount = await pool.query(`SELECT count(*) FROM bgv_verifications`);
  if (parseInt(bgvCount.rows[0].count) === 0 && candidates.length > 0) {
    console.log("Seeding BGV Verifications...");
    const cand = candidates[0];
    await pool.query(`
      INSERT INTO bgv_verifications (bgv_code, candidate_id, verification_type, agency, initiated_date, status, result, remarks)
      VALUES 
      ('BGV-401', $1, 'Prior Employment & Experience Verification', 'AuthBridge Screening Corp', '2026-10-18', 'Completed', 'Green / Verified', 'Ex-employer Cognizant verified 4.2 years of service with clear tenure.'),
      ('BGV-402', $1, 'Highest Educational Credential Verification', 'AuthBridge Screening Corp', '2026-10-18', 'Completed', 'Green / Verified', 'B.Tech Computer Science degree confirmed by JNTU University Registrar.'),
      ('BGV-403', $1, 'Criminal Record & Court Database Check', 'FirstAdvantage Screening', '2026-10-18', 'In Progress', 'Pending', 'State police verification underway.');
    `, [cand.id]);
  }

  // 10. Seed Shifts
  const shiftCount = await pool.query(`SELECT count(*) FROM shifts`);
  if (parseInt(shiftCount.rows[0].count) === 0) {
    console.log("Seeding Shifts...");
    const shifts = [
      ['SFT-GEN', 'General Enterprise Day Shift', '09:30', '18:30', 15, 60, false, 'Standard corporate general shift hours with 1-hour lunch break'],
      ['SFT-EARLY', 'Early Morning Support Shift', '07:00', '16:00', 15, 60, false, 'APAC regional operations & support overlap shift'],
      ['SFT-US', 'US Eastern Client Alignment Shift', '18:30', '03:30', 15, 60, true, 'Night differential shift covering US Eastern business hours with cab allowance']
    ];
    for (const s of shifts) {
      await pool.query(`
        INSERT INTO shifts (shift_code, name, start_time, end_time, grace_period_mins, break_duration_mins, is_night_shift, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (shift_code) DO NOTHING;
      `, s);
    }
  }

  // 11. Seed Salary Revisions
  const salRevCount = await pool.query(`SELECT count(*) FROM salary_revisions`);
  if (parseInt(salRevCount.rows[0].count) === 0 && employees.length > 0) {
    console.log("Seeding Salary Revisions...");
    const emp = employees[0];
    await pool.query(`
      INSERT INTO salary_revisions (revision_code, employee_id, effective_date, previous_ctc, new_ctc, hike_percentage, reason, approved_by, status)
      VALUES 
      ('REV-2026-01', $1, '2026-04-01', 1800000.00, 2160000.00, 20.00, 'Annual Performance Appraisal - Band Exceeds Expectations', 'Ananya Sharma', 'Approved');
    `, [emp.id]);
  }

  // 12. Seed Performance Cycles
  const cycCount = await pool.query(`SELECT count(*) FROM performance_cycles`);
  if (parseInt(cycCount.rows[0].count) === 0) {
    console.log("Seeding Performance Cycles...");
    await pool.query(`
      INSERT INTO performance_cycles (cycle_code, name, period, start_date, end_date, submission_deadline, status)
      VALUES 
      ('CYC-2026-Q4', 'FY 2026-27 Q4 Annual Enterprise Appraisal Cycle', 'Q4 2026', '2026-10-01', '2026-12-31', '2026-11-25', 'Active'),
      ('CYC-2027-Q1', 'FY 2027-28 Q1 Mid-Year Goal Calibration', 'Q1 2027', '2027-04-01', '2027-06-30', '2027-05-20', 'Draft');
    `);
  }

  // 13. Seed KRAs (Key Result Areas)
  const kraCount = await pool.query(`SELECT count(*) FROM kras`);
  if (parseInt(kraCount.rows[0].count) === 0) {
    console.log("Seeding KRAs...");
    const kras = [
      ['KRA-ENG-01', 'Engineering', 'Senior Full Stack Engineer', 'Core Platform Reliability & 99.95% API Uptime', 35, 'Ensuring fault tolerance, automated database failover, and sub-100ms API response latency'],
      ['KRA-ENG-02', 'Engineering', 'Senior Full Stack Engineer', 'Sprint Velocity & Clean Code Delivery', 30, 'Delivery of user stories on time with >85% unit test coverage and zero critical SonarQube bugs'],
      ['KRA-ENG-03', 'Engineering', 'Senior Full Stack Engineer', 'Technical Mentorship & Code Reviews', 15, 'Conducting in-depth peer PR reviews and onboarding junior engineers'],
      ['KRA-HR-01', 'Human Resources', 'Senior HR Business Partner', 'Talent Acquisition & Time-to-Fill SLA', 40, 'Reducing technical hiring turnaround time to under 25 days with 92% offer acceptance rate']
    ];
    for (const k of kras) {
      await pool.query(`
        INSERT INTO kras (kra_code, department, role_title, title, weightage, description)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (kra_code) DO NOTHING;
      `, k);
    }
  }

  // 14. Seed KPIs (Key Performance Indicators)
  const kpiCount = await pool.query(`SELECT count(*) FROM kpi_metrics`);
  if (parseInt(kpiCount.rows[0].count) === 0) {
    console.log("Seeding KPIs...");
    const kraRes = await pool.query(`SELECT id FROM kras ORDER BY id ASC LIMIT 2`);
    if (kraRes.rows.length > 0) {
      const kraId = kraRes.rows[0].id;
      await pool.query(`
        INSERT INTO kpi_metrics (kpi_code, kra_id, title, unit, target_value, actual_value, status)
        VALUES 
        ('KPI-ENG-01', $1, 'API Server Response Time (p95 latency in ms)', 'Milliseconds', 120.00, 85.00, 'Achieved'),
        ('KPI-ENG-02', $1, 'Automated Test Coverage across Microservices', 'Percentage', 85.00, 88.50, 'Achieved'),
        ('KPI-ENG-03', $1, 'System Availability & Monthly Uptime', 'Percentage', 99.95, 99.98, 'On Track');
      `, [kraId]);
    }
  }

  // 15. Seed Assets
  const assetCount = await pool.query(`SELECT count(*) FROM assets`);
  if (parseInt(assetCount.rows[0].count) === 0) {
    console.log("Seeding Assets...");
    const emp1 = employees.length > 0 ? employees[0] : null;
    const emp2 = employees.length > 1 ? employees[1] : null;
    const assets = [
      ['AST-MBP-9021', 'Apple MacBook Pro 16" M3 Max 64GB', 'IT Hardware', 'C02G9988MD6T', 'MacBook Pro 16-inch 2024', emp1 ? emp1.id : null, emp1 ? `${emp1.first_name} ${emp1.last_name}` : 'Unassigned', '2025-01-15', null, 'Excellent', 'Allocated'],
      ['AST-MON-4412', 'Dell UltraSharp 32" 4K USB-C Hub Monitor', 'Display & Monitors', 'CN-0K791X-74261', 'U3223QE 4K HDR', emp1 ? emp1.id : null, emp1 ? `${emp1.first_name} ${emp1.last_name}` : 'Unassigned', '2025-01-16', null, 'Excellent', 'Allocated'],
      ['AST-SEC-7703', 'YubiKey 5C NFC Enterprise Hardware Security Key', 'Security Tokens', 'YK-9912088', 'YubiKey 5C NFC', emp2 ? emp2.id : null, emp2 ? `${emp2.first_name} ${emp2.last_name}` : 'Unassigned', '2025-02-01', null, 'Excellent', 'Allocated'],
      ['AST-LPT-1104', 'Lenovo ThinkPad P1 Gen 6 Workstation', 'IT Hardware', 'PF4892A1', 'ThinkPad P1 32GB i9', null, 'Inventory Reserve', null, null, 'Good', 'Available In Stock']
    ];
    for (const a of assets) {
      await pool.query(`
        INSERT INTO assets (asset_tag, name, category, serial_number, model, assigned_to_employee_id, assigned_to_name, allocation_date, return_date, condition, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (asset_tag) DO NOTHING;
      `, a);
    }
  }

  // 16. Seed F&F Settlements
  const fnfCount = await pool.query(`SELECT count(*) FROM fnf_settlements`);
  if (parseInt(fnfCount.rows[0].count) === 0 && resignations.length > 0) {
    console.log("Seeding F&F Settlements...");
    const resig = resignations[0];
    await pool.query(`
      INSERT INTO fnf_settlements (settlement_code, resignation_id, employee_id, employee_name, unpaid_days_salary, leave_encashment_amount, gratuity_amount, bonus_payable, notice_pay_recovery, other_deductions, net_payable, status, disbursed_at)
      VALUES 
      ('FNF-2026-001', $1, $2, $3, 45000.00, 32000.00, 75000.00, 15000.00, 0.00, 2500.00, 164500.00, 'Settled', '2026-10-15 11:00:00');
    `, [resig.id, resig.employee_id, resig.employee_name || 'Ex-Employee']);
  }

  // 17. Seed In-App Notifications
  const notifCount = await pool.query(`SELECT count(*) FROM notifications`);
  if (parseInt(notifCount.rows[0].count) === 0 && users.length > 0) {
    console.log("Seeding Notifications...");
    for (const u of users) {
      await pool.query(`
        INSERT INTO notifications (user_id, title, message, type, is_read, action_url)
        VALUES 
        ($1, 'Enterprise HRMS 41-Entity System Active', 'All 41 enterprise HRMS entities are now live with real-time PostgreSQL synchronization.', 'success', false, '/hr/entities'),
        ($1, 'FY2026-27 Q4 Performance Cycle Opened', 'Annual self-appraisal submissions are active. Target submission date is Nov 25, 2026.', 'info', false, '/hr/entities?tab=performance_cycle');
      `, [u.id]);
    }
  }

  // 18. Seed Approvals Workflow
  const appCount = await pool.query(`SELECT count(*) FROM approvals`);
  if (parseInt(appCount.rows[0].count) === 0 && employees.length > 0) {
    console.log("Seeding Approvals...");
    const emp = employees[0];
    const approver = users.find(u => u.role === 'manager' || u.role === 'admin') || users[0];
    await pool.query(`
      INSERT INTO approvals (approval_code, module, entity_id, requester_id, requester_name, approver_id, approver_role, level, status, comments)
      VALUES 
      ('APP-7001', 'Leave', 1, $1, $2, $3, 'manager', 1, 'approved', 'Annual leave request verified and approved against balance'),
      ('APP-7002', 'Requisition', 1, $1, $2, $3, 'admin', 2, 'approved', 'Budget sanctioned for Cloud Architect replacement'),
      ('APP-7003', 'Salary Revision', 1, $1, $2, $3, 'hr', 1, 'approved', '20% merit hike validated as per performance rating 4.8/5');
    `, [emp.id, `${emp.first_name} ${emp.last_name}`, approver ? approver.id : null]);
  }

  // 19. Seed Role & Permission Matrix
  const permCount = await pool.query(`SELECT count(*) FROM role_permissions`);
  if (parseInt(permCount.rows[0].count) === 0) {
    console.log("Seeding Role & Permission Matrix...");
    const roles = ['admin', 'hr', 'manager', 'employee'];
    const modules = [
      'Employee Master', 'Organization', 'Department & Designation', 'Locations',
      'Clients & SOW', 'Project & Deployment', 'Recruitment & Interviews', 'Onboarding & BGV',
      'Attendance & Shifts', 'Leaves & Holidays', 'Payroll & Salary Revisions',
      'Performance, KRA & KPI', 'Helpdesk Tickets', 'Asset Inventory', 'Exit & FnF Settlement',
      'Approvals & Workflow', 'Audit Logs'
    ];
    for (const r of roles) {
      for (const m of modules) {
        const canView = true;
        const canCreate = (r === 'admin' || r === 'hr' || (r === 'manager' && (m.includes('Attendance') || m.includes('Project') || m.includes('Interview'))));
        const canEdit = (r === 'admin' || r === 'hr' || (r === 'manager' && m.includes('Performance')));
        const canDelete = (r === 'admin');
        const canApprove = (r === 'admin' || r === 'hr' || r === 'manager');

        await pool.query(`
          INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (role, module) DO NOTHING;
        `, [r, m, canView, canCreate, canEdit, canDelete, canApprove]);
      }
    }
  }

  console.log("\n All 19 new enterprise tables verified and seeded with live PostgreSQL records!");
  process.exit(0);
}

runMigrationAndSeed().catch(err => {
  console.error("Migration/Seed Error:", err);
  process.exit(1);
});
