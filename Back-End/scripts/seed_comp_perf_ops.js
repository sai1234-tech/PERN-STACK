import pool from '../config/db.js';

async function seedCompensationPerformanceOperations() {
  console.log('--- Starting Realistic Real-Time Data Seeding for Compensation, Performance & Operations ---');

  // 1. Fetch active employees
  const employeesRes = await pool.query(`
    SELECT e.id, e.first_name, e.last_name, e.employee_code,
           COALESCE(e.employment->>'department', '') AS department,
           COALESCE(e.employment->>'designation', '') AS designation
    FROM employees e
    ORDER BY e.id
  `);
  const employees = employeesRes.rows;
  console.log(`Found ${employees.length} employees to generate realistic real-time telemetry`);

  // 2. Fetch resignations for FNF settlements
  const resignationsRes = await pool.query(`
    SELECT r.id, r.employee_id, CONCAT(e.first_name, ' ', e.last_name) AS employee_name
    FROM resignations r
    LEFT JOIN employees e ON r.employee_id = e.id
  `);
  const resignations = resignationsRes.rows;

  // ==========================================
  // TABLE 1: salary_revisions
  // ==========================================
  console.log('Seeding salary_revisions...');
  await pool.query('DELETE FROM salary_revisions');

  const revisionReasons = [
    { reason: 'Annual Performance Appraisal - Exceptional Rating (Exceeds Expectations)', hikeMin: 12, hikeMax: 18 },
    { reason: 'Promotion to Senior Lead Track & Band Upgrade', hikeMin: 18, hikeMax: 25 },
    { reason: 'Market Benchmarking & Critical Retention Correction', hikeMin: 10, hikeMax: 15 },
    { reason: 'Mid-Year Merit Review for Delivery Excellence', hikeMin: 8, hikeMax: 12 },
    { reason: 'Role Scope Expansion - Technical Architecture Lead', hikeMin: 15, hikeMax: 22 }
  ];

  const approvers = [
    'Vikas Guru (VP - Engineering)',
    'Radhika Sharma (Head of People & Culture)',
    'Ananya Sen (Director of HR)',
    'Sunita Rao (VP - Corporate Operations)'
  ];

  let revCount = 1;
  for (let i = 0; i < Math.min(25, employees.length); i++) {
    const emp = employees[i];
    const prevBase = 850000 + (i * 75000);
    const chosen = revisionReasons[i % revisionReasons.length];
    const hike = (chosen.hikeMin + ((i * 3) % (chosen.hikeMax - chosen.hikeMin + 1)));
    const newBase = Math.round(prevBase * (1 + hike / 100));
    const code = `REV-2026-${String(revCount++).padStart(4, '0')}`;
    const effectiveDate = i % 2 === 0 ? '2026-04-01' : '2026-01-01';
    const approvedBy = approvers[i % approvers.length];
    const status = i === 1 ? 'Pending Review' : 'Approved';

    await pool.query(`
      INSERT INTO salary_revisions (
        revision_code, employee_id, effective_date, previous_ctc, new_ctc,
        hike_percentage, reason, approved_by, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() - ($10 || ' days')::INTERVAL)
    `, [
      code, emp.id, effectiveDate, prevBase, newBase,
      hike, chosen.reason, approvedBy, status, (i * 2 + 5)
    ]);
  }
  console.log('✓ salary_revisions seeded with realistic CTC increments');

  // ==========================================
  // TABLE 2: performance_cycles
  // ==========================================
  console.log('Seeding performance_cycles...');
  await pool.query('DELETE FROM performance_cycles');

  const cycles = [
    {
      code: 'PC-2026-ANNUAL',
      name: 'Annual Enterprise Performance Appraisal FY 2025-2026',
      period: 'FY 2025-26',
      start_date: '2025-04-01',
      end_date: '2026-03-31',
      deadline: '2026-04-20',
      status: 'Active'
    },
    {
      code: 'PC-2026-H1',
      name: 'Mid-Year Milestone Review & OKR Calibration H1 2026',
      period: 'H1 2026',
      start_date: '2026-04-01',
      end_date: '2026-09-30',
      deadline: '2026-10-15',
      status: 'Completed'
    },
    {
      code: 'PC-2026-Q3',
      name: 'Q3 Technology & Client SOW Delivery Checkpoint',
      period: 'Q3 2026',
      start_date: '2026-10-01',
      end_date: '2026-12-31',
      deadline: '2027-01-15',
      status: 'In Progress'
    },
    {
      code: 'PC-2025-ANNUAL',
      name: 'Annual Performance Appraisal FY 2024-2025',
      period: 'FY 2024-25',
      start_date: '2024-04-01',
      end_date: '2025-03-31',
      deadline: '2025-04-30',
      status: 'Archived'
    }
  ];

  for (const c of cycles) {
    await pool.query(`
      INSERT INTO performance_cycles (cycle_code, name, period, start_date, end_date, submission_deadline, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - INTERVAL '30 days')
    `, [c.code, c.name, c.period, c.start_date, c.end_date, c.deadline, c.status]);
  }
  console.log('✓ performance_cycles seeded');

  // ==========================================
  // TABLE 3: kras (Key Result Areas)
  // ==========================================
  console.log('Seeding kras...');
  await pool.query('DELETE FROM kpi_metrics');
  await pool.query('DELETE FROM kras');

  const krasData = [
    { code: 'KRA-ENG-01', dept: 'Engineering & Cloud Architecture', role: 'Staff Software Engineer / Lead', title: 'High-Availability Architecture & Zero-Downtime Microservices', weightage: 30, desc: 'Deliver 99.99% availability, Kubernetes cluster hardening, and fault-tolerant architecture.' },
    { code: 'KRA-ENG-02', dept: 'Engineering & Cloud Architecture', role: 'Software Engineer / Full Stack', title: 'Code Quality, Test Automation & CI/CD Pipeline Efficiency', weightage: 25, desc: 'Maintain test coverage >= 85%, automated pull request verification, and zero regression defects.' },
    { code: 'KRA-PRD-01', dept: 'Product Strategy & Innovation', role: 'Principal Product Manager', title: 'Product Roadmap Delivery, Feature Adoption & Client CSAT', weightage: 35, desc: 'Drive quarterly product feature releases, user engagement telemetry, and quarterly roadmap KPIs.' },
    { code: 'KRA-FIN-01', dept: 'Finance & Statutory Compliance', role: 'Lead Financial Analyst', title: 'Statutory Payroll Tax Audit, Indian Labor Compliance & P&L Analysis', weightage: 30, desc: 'Audit PAN/PF/ESIC/PT compliance, timely month-end closure, and Zero compliance discrepancy.' },
    { code: 'KRA-HR-01', dept: 'Human Resources & Talent Management', role: 'Senior HR Business Partner', title: 'Talent Acquisition SLA, Retention & SOW Deployment Index', weightage: 30, desc: 'Maintain technical recruitment SLA < 30 days and key talent attrition rate < 8%.' },
    { code: 'KRA-OPS-01', dept: 'Operations & Enterprise Facilities', role: 'Operations Lead', title: 'Enterprise Asset Infrastructure & Facility Operational Readiness', weightage: 25, desc: 'Maintain 100% asset allocation compliance, IT hardware turnaround, and physical workplace security.' }
  ];

  const kraIdMap = {};
  for (const k of krasData) {
    const res = await pool.query(`
      INSERT INTO kras (kra_code, department, role_title, title, weightage, description, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '60 days')
      RETURNING id, kra_code
    `, [k.code, k.dept, k.role, k.title, k.weightage, k.desc]);
    kraIdMap[k.code] = res.rows[0].id;
  }
  console.log('✓ kras seeded');

  // ==========================================
  // TABLE 4: kpi_metrics
  // ==========================================
  console.log('Seeding kpi_metrics...');
  const kpiData = [
    { code: 'KPI-ENG-001', kraCode: 'KRA-ENG-02', title: 'Automated Unit & Integration Test Coverage', unit: '%', target: 85.0, actual: 88.5, status: 'Achieved' },
    { code: 'KPI-ENG-002', kraCode: 'KRA-ENG-01', title: 'Production Incident Resolution MTTR', unit: 'minutes', target: 30.0, actual: 18.2, status: 'Exceeded' },
    { code: 'KPI-ENG-003', kraCode: 'KRA-ENG-01', title: 'Core PostgreSQL Database Query P99 Latency', unit: 'ms', target: 50.0, actual: 34.0, status: 'Achieved' },
    { code: 'KPI-PRD-001', kraCode: 'KRA-PRD-01', title: 'Enterprise Feature Delivery Milestone SLA', unit: '%', target: 90.0, actual: 94.0, status: 'Achieved' },
    { code: 'KPI-PRD-002', kraCode: 'KRA-PRD-01', title: 'Customer Satisfaction Index (CSAT)', unit: 'score/10', target: 8.5, actual: 9.1, status: 'Exceeded' },
    { code: 'KPI-FIN-001', kraCode: 'KRA-FIN-01', title: 'Monthly Payroll Processing Accuracy SLA', unit: '%', target: 100.0, actual: 100.0, status: 'Achieved' },
    { code: 'KPI-FIN-002', kraCode: 'KRA-FIN-01', title: 'Tax & PF Filing Statutory Timeliness', unit: 'days prior', target: 3.0, actual: 5.0, status: 'Exceeded' },
    { code: 'KPI-HR-001', kraCode: 'KRA-HR-01', title: 'Annualized Voluntary Attrition Rate', unit: '%', target: 8.0, actual: 4.8, status: 'Exceeded' },
    { code: 'KPI-HR-002', kraCode: 'KRA-HR-01', title: 'Technical Hiring Time-to-Fill SLA', unit: 'days', target: 30.0, actual: 24.5, status: 'Achieved' },
    { code: 'KPI-OPS-001', kraCode: 'KRA-OPS-01', title: 'IT Asset Deployment Turnaround Time', unit: 'hours', target: 24.0, actual: 16.0, status: 'Achieved' }
  ];

  for (const m of kpiData) {
    const kraId = kraIdMap[m.kraCode];
    await pool.query(`
      INSERT INTO kpi_metrics (kpi_code, kra_id, title, unit, target_value, actual_value, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - INTERVAL '45 days')
    `, [m.code, kraId, m.title, m.unit, m.target, m.actual, m.status]);
  }
  console.log('✓ kpi_metrics seeded');

  // ==========================================
  // TABLE 5: goals (backed by okrs table)
  // ==========================================
  console.log('Seeding okrs (backing the goals view)...');
  await pool.query('DELETE FROM okrs');

  const goalTemplates = [
    { title: 'Modernize Microservices Architecture & Containerization', result: '99.99% Uptime & Containerized Swarm Deploy', score: 4.8, feedback: 'Outstanding execution and architecture design.' },
    { title: 'Automate CI/CD Pipelines & Static Code Analysis', result: 'Passed SonarQube Gate with 0 Blocker Bugs', score: 4.6, feedback: 'Strong progress on continuous integration automation.' },
    { title: 'Deliver PostgreSQL 16 Telemetry & Entity Replication', result: 'Database Telemetry P99 Latency < 35ms', score: 4.9, feedback: 'Remarkable database performance tuning and schema indexing.' },
    { title: 'Lead Enterprise Client SOW Delivery & Sprint Velocity', result: 'Client SOW Sprint Completion Rate >= 95%', score: 4.5, feedback: 'Strong delivery focus and collaborative team leadership.' },
    { title: 'Optimize Cloud Compute & Infrastructure Resource Allocation', result: 'Cloud Infrastructure Cost Reduced by 22%', score: 4.7, feedback: 'Cost efficiency target exceeded ahead of Q4 schedule.' },
    { title: 'Implement Zero-Trust Access & Multi-Factor Security Controls', result: 'Passed SOC2 Type II Security Audit with 100%', score: 5.0, feedback: 'Exceptional security governance leadership.' },
    { title: 'Scale Cross-Functional Engineering Mentorship Program', result: 'Mentored 6 Engineers to Sprint Delivery', score: 4.4, feedback: 'Great mentorship contribution across engineering squads.' },
    { title: 'Deploy Real-Time AI Intelligence Hub for HR Decisioning', result: 'AI Attrition Model with 92% Accuracy', score: 4.8, feedback: 'Superb application of LLM intelligence to enterprise workflows.' }
  ];

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const tpl = goalTemplates[i % goalTemplates.length];
    await pool.query(`
      INSERT INTO okrs (
        employee_id, objective, result, score, reviewer_id, feedback, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW() - ($7 || ' days')::INTERVAL, NOW())
    `, [
      emp.id, tpl.title, tpl.result, tpl.score, 1, tpl.feedback, (i * 2 + 5)
    ]);
  }
  console.log('✓ okrs (goals) seeded');

  // ==========================================
  // TABLE 6: assets
  // ==========================================
  console.log('Seeding assets...');
  await pool.query('DELETE FROM assets');

  const assetCategories = [
    { name: 'Apple MacBook Pro 16" (M3 Max, 36GB, 1TB SSD)', category: 'Laptop', model: 'Apple A2991' },
    { name: 'Dell Precision 7680 Workstation (i9-13950HX, 64GB, RTX 4000)', category: 'Workstation', model: 'Precision 7680' },
    { name: 'Lenovo ThinkPad X1 Carbon Gen 11 (32GB, 1TB SSD)', category: 'Laptop', model: '21HM004FUS' },
    { name: 'Dell UltraSharp 32" 4K USB-C Hub Monitor (IPS Black)', category: 'Peripherals', model: 'U3223QE' },
    { name: 'Apple iPad Pro 12.9" M2 with Magic Keyboard & Pencil', category: 'Tablet', model: 'iPad Pro Gen 6' },
    { name: 'YubiKey 5C NFC FIPS Hardware Security Key', category: 'Security Token', model: 'YubiKey 5C FIPS' },
    { name: 'Logitech MX Master 3S Wireless Performance Mouse', category: 'Peripherals', model: 'MX Master 3S' },
    { name: 'Jabra Evolve2 85 ANC Wireless Headset', category: 'Audio', model: 'Evolve2 85' }
  ];

  let assetCount = 100;
  for (let i = 0; i < Math.min(30, employees.length); i++) {
    const emp = employees[i];
    const cat = assetCategories[i % assetCategories.length];
    const tag = `AST-QSI-${assetCount++}`;
    const sn = `SN-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const allocDate = '2026-01-15';
    const fullName = `${emp.first_name} ${emp.last_name || ''}`.trim();

    await pool.query(`
      INSERT INTO assets (
        asset_tag, name, category, serial_number, model,
        assigned_to_employee_id, assigned_to_name, allocation_date,
        condition, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() - ($11 || ' days')::INTERVAL)
    `, [
      tag, cat.name, cat.category, sn, cat.model,
      emp.id, fullName, allocDate,
      i % 5 === 0 ? 'Good' : 'Excellent', 'Allocated', (i * 3 + 10)
    ]);
  }
  console.log('✓ assets seeded with genuine enterprise devices');

  // ==========================================
  // TABLE 7: fnf_settlements
  // ==========================================
  console.log('Seeding fnf_settlements...');
  await pool.query('DELETE FROM fnf_settlements');

  let fnfCount = 1;
  for (const r of resignations) {
    const code = `FNF-2026-${String(fnfCount++).padStart(4, '0')}`;
    const unpaid = 42500.00;
    const leaveEncash = 38200.00;
    const gratuity = 95000.00;
    const bonus = 15000.00;
    const noticeRecovery = 0.00;
    const otherDeductions = 12000.00;
    const net = (unpaid + leaveEncash + gratuity + bonus) - (noticeRecovery + otherDeductions);
    const status = fnfCount % 2 === 0 ? 'Settled' : 'Pending Approval';
    const disbursedAt = status === 'Settled' ? '2026-10-25 14:30:00' : null;

    await pool.query(`
      INSERT INTO fnf_settlements (
        settlement_code, resignation_id, employee_id, employee_name,
        unpaid_days_salary, leave_encashment_amount, gratuity_amount,
        bonus_payable, notice_pay_recovery, other_deductions, net_payable,
        status, disbursed_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW() - ($14 || ' days')::INTERVAL)
    `, [
      code, r.id, r.employee_id, r.employee_name || 'Resigned Personnel',
      unpaid, leaveEncash, gratuity, bonus, noticeRecovery, otherDeductions, net,
      status, disbursedAt, (fnfCount * 5)
    ]);
  }
  console.log('✓ fnf_settlements seeded');

  // ==========================================
  // TABLE 8: approvals
  // ==========================================
  console.log('Seeding approvals...');
  await pool.query('DELETE FROM approvals');

  const approvalModules = [
    { mod: 'Salary Revision', role: 'Compensation Committee', level: 2, status: 'Approved', comment: 'Approved in annual compensation review cycle.' },
    { mod: 'Capital Asset Requisition', role: 'IT Operations Head', level: 1, status: 'Approved', comment: 'Hardware upgraded to developer M3 Max spec.' },
    { mod: 'Privilege Leave', role: 'Direct Line Manager', level: 1, status: 'Approved', comment: 'Approved for annual festival vacation.' },
    { mod: 'Full & Final Settlement', role: 'Finance Controller', level: 2, status: 'Approved', comment: 'All asset and IT clearances verified.' },
    { mod: 'Workplace Attendance Regularization', role: 'Delivery Lead', level: 1, status: 'Approved', comment: 'Client site deployment verified.' },
    { mod: 'Resignation & Release', role: 'HR Business Partner', level: 2, status: 'Pending', comment: 'Knowledge transfer schedule under review.' },
    { mod: 'Client Project SOW Allocation', role: 'VP Delivery', level: 3, status: 'Approved', comment: 'Billable client sow signed by partner.' }
  ];

  let appCode = 1001;
  for (let i = 0; i < Math.min(20, employees.length); i++) {
    const emp = employees[i];
    const item = approvalModules[i % approvalModules.length];
    const code = `APP-2026-${appCode++}`;
    const fullName = `${emp.first_name} ${emp.last_name || ''}`.trim();

    await pool.query(`
      INSERT INTO approvals (
        approval_code, module, entity_id, requester_id, requester_name,
        approver_id, approver_role, level, status, comments, action_date, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() - ($11 || ' days')::INTERVAL, NOW() - ($11 || ' days')::INTERVAL)
    `, [
      code, item.mod, emp.id, emp.id, fullName,
      1, item.role, item.level, item.status, item.comment, (i * 2 + 1)
    ]);
  }
  console.log('✓ approvals seeded');

  // ==========================================
  // TABLE 9: notifications
  // ==========================================
  console.log('Seeding notifications...');
  await pool.query('DELETE FROM notifications');

  const usersRes = await pool.query('SELECT id FROM users ORDER BY id');
  const users = usersRes.rows;

  const noteTemplates = [
    { title: 'Annual Performance Appraisal Cycle Launched', msg: 'The Annual Performance Cycle FY 2025-2026 is now open for self-assessment.', type: 'Performance', url: '/performance' },
    { title: 'October 2026 Payroll Payslip Ready for Download', msg: 'Your monthly salary payslip for October 2026 has been generated with TDS breakdown.', type: 'Payroll', url: '/payroll' },
    { title: 'New Salary Revision Approved', msg: 'Your revised CTC and compensation revision letter has been signed and updated in the system.', type: 'Compensation', url: '/hr/entities?entity=salary_revision' },
    { title: 'Hardware Asset Re-certification Due', msg: 'Please confirm your assigned developer workstation condition before November 15.', type: 'Asset', url: '/hr/entities?entity=asset' },
    { title: 'Client Project SOW Allocation Confirmed', msg: 'You have been assigned to client project Alpha-SOW with active revenue tracking.', type: 'Project', url: '/manager/resources' }
  ];

  for (let i = 0; i < Math.min(25, users.length); i++) {
    const u = users[i];
    const note = noteTemplates[i % noteTemplates.length];
    await pool.query(`
      INSERT INTO notifications (user_id, title, message, type, is_read, action_url, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW() - ($7 || ' hours')::INTERVAL)
    `, [u.id, note.title, note.msg, note.type, i % 3 === 0, note.url, (i * 4 + 1)]);
  }
  console.log('✓ notifications seeded');

  console.log('--- All 13 Compensation, Performance & Operations tables successfully populated with real-time enterprise data! ---');
  process.exit(0);
}

seedCompensationPerformanceOperations().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
