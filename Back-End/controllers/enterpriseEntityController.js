import pool from "../config/db.js";

// Comprehensive metadata for all 41 enterprise HRMS entities
export const ENTITY_DEFINITIONS = {
  // 1. Core HR & Identity
  employee: {
    key: "employee",
    label: "Employee",
    category: "Core HR & Identity",
    table: "employees",
    idField: "id",
    displayField: "employee_code",
    query: `
      SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email, e.department, e.designation,
             e.status, e.employment_type, e.joining_date, e.phone, e.work_location, e.created_at
      FROM employees e
    `,
    searchFields: ["e.first_name", "e.last_name", "e.employee_code", "e.email", "e.department"]
  },
  person: {
    key: "person",
    label: "Person",
    category: "Core HR & Identity",
    table: "persons",
    idField: "id",
    displayField: "full_name",
    query: `
      SELECT p.id, p.employee_code, p.first_name, p.last_name, p.full_name, p.email, p.phone,
             p.gender, p.date_of_birth, p.marital_status, p.blood_group, p.aadhaar, p.pan, p.uan,
             p.current_address, p.permanent_address, p.emergency_contact_name, p.emergency_contact_phone, p.created_at
      FROM persons p
    `,
    searchFields: ["p.first_name", "p.last_name", "p.full_name", "p.email", "p.phone", "p.pan"]
  },
  employment: {
    key: "employment",
    label: "Employment",
    category: "Core HR & Identity",
    table: "employments",
    idField: "id",
    displayField: "employee_code",
    query: `
      SELECT emp.id, emp.employee_code, emp.employee_name, emp.official_email, emp.department,
             emp.designation, emp.employment_type, emp.employment_status, emp.joining_date,
             emp.work_location, emp.cost_center, emp.tax_regime, emp.probation_period_months,
             emp.notice_period_days, emp.confirmation_date, emp.band, emp.created_at
      FROM employments emp
    `,
    searchFields: ["emp.employee_name", "emp.employee_code", "emp.department", "emp.designation"]
  },
  user: {
    key: "user",
    label: "User",
    category: "Core HR & Identity",
    table: "users",
    idField: "id",
    displayField: "email",
    query: `
      SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.updated_at
      FROM users u
    `,
    searchFields: ["u.name", "u.email", "u.role"]
  },
  role: {
    key: "role",
    label: "Role",
    category: "Core HR & Identity",
    table: "roles",
    idField: "id",
    displayField: "role_name",
    query: `
      SELECT r.id, r.role_code, r.role_name, r.description, r.is_system, r.created_at
      FROM roles r
    `,
    searchFields: ["r.role_code", "r.role_name", "r.description"]
  },
  permission: {
    key: "permission",
    label: "Permission",
    category: "Core HR & Identity",
    table: "permissions",
    idField: "id",
    displayField: "permission_code",
    query: `
      SELECT perm.id, perm.permission_code, perm.module, perm.action, perm.description, perm.created_at
      FROM permissions perm
    `,
    searchFields: ["perm.permission_code", "perm.module", "perm.action", "perm.description"]
  },
  audit_log: {
    key: "audit_log",
    label: "Audit Log",
    category: "Core HR & Identity",
    table: "audit_logs",
    idField: "id",
    displayField: "action",
    query: `
      SELECT al.id, al.action, al.entity_type, al.entity_id, al.details, al.user_name, al.user_role, al.ip_address, al.created_at
      FROM audit_logs al
    `,
    searchFields: ["al.action", "al.entity_type", "al.user_name", "al.details"]
  },

  // 2. Organization & Workplace Structure
  organization: {
    key: "organization",
    label: "Organization",
    category: "Organization & Workplace",
    table: "organizations",
    idField: "id",
    displayField: "company_name",
    query: `
      SELECT o.id, o.company_name, o.legal_name, o.cin, o.gstin, o.pan, o.website,
             o.headquarters, o.contact_email, o.contact_phone, o.currency, o.fiscal_year_start, o.created_at
      FROM organizations o
    `,
    searchFields: ["o.company_name", "o.legal_name", "o.cin", "o.gstin"]
  },
  department: {
    key: "department",
    label: "Department",
    category: "Organization & Workplace",
    table: "departments",
    idField: "id",
    displayField: "department_name",
    query: `
      SELECT d.id, d.department_code, d.department_name, d.manager_name, d.manager_email,
             d.description, d.location, d.status, d.created_at
      FROM departments d
    `,
    searchFields: ["d.department_name", "d.department_code", "d.manager_name"]
  },
  designation: {
    key: "designation",
    label: "Designation",
    category: "Organization & Workplace",
    table: "designations",
    idField: "id",
    displayField: "title",
    query: `
      SELECT des.id, des.designation_code, des.title, des.department, des.band,
             des.min_salary, des.max_salary, des.description, des.created_at
      FROM designations des
    `,
    searchFields: ["des.title", "des.designation_code", "des.department", "des.band"]
  },
  location: {
    key: "location",
    label: "Location",
    category: "Organization & Workplace",
    table: "locations",
    idField: "id",
    displayField: "name",
    query: `
      SELECT loc.id, loc.location_code, loc.name, loc.city, loc.state, loc.country,
             loc.address, loc.timezone, loc.facility_type, loc.capacity, loc.is_active, loc.created_at
      FROM locations loc
    `,
    searchFields: ["loc.name", "loc.city", "loc.state", "loc.location_code"]
  },
  shift: {
    key: "shift",
    label: "Shift",
    category: "Organization & Workplace",
    table: "shifts",
    idField: "id",
    displayField: "name",
    query: `
      SELECT s.id, s.shift_code, s.name, s.start_time, s.end_time, s.grace_period_mins,
             s.break_duration_mins, s.is_night_shift, s.description, s.created_at
      FROM shifts s
    `,
    searchFields: ["s.shift_code", "s.name"]
  },
  holiday: {
    key: "holiday",
    label: "Holiday",
    category: "Organization & Workplace",
    table: "holidays",
    idField: "id",
    displayField: "title",
    query: `
      SELECT h.id, h.title, h.date, h.type, h.description, h.added_by, h.created_at
      FROM holidays h
    `,
    searchFields: ["h.title", "h.type"]
  },

  // 3. Clients, Projects & SOW
  client: {
    key: "client",
    label: "Client",
    category: "Clients, Projects & SOW",
    table: "clients",
    idField: "id",
    displayField: "client_name",
    query: `
      SELECT c.id, c.client_code, c.client_name, c.account_owner_name, c.client_manager_name,
             c.client_manager_email, c.status, c.msa_reference, c.created_at
      FROM clients c
    `,
    searchFields: ["c.client_name", "c.client_code", "c.account_owner_name"]
  },
  project: {
    key: "project",
    label: "Project",
    category: "Clients, Projects & SOW",
    table: "client_projects",
    idField: "id",
    displayField: "project_name",
    query: `
      SELECT cp.id, cp.project_code, cp.client_id, cp.client_name, cp.project_name, cp.sow_number,
             cp.billing_type, cp.start_date, cp.end_date, cp.delivery_manager_name, cp.budgeted_hours, cp.status, cp.created_at
      FROM client_projects cp
    `,
    searchFields: ["cp.project_name", "cp.project_code", "cp.client_name"]
  },
  sow: {
    key: "sow",
    label: "SOW",
    category: "Clients, Projects & SOW",
    table: "statement_of_works",
    idField: "id",
    displayField: "sow_number",
    query: `
      SELECT sow.id, sow.sow_number, sow.client_id, c.client_name, sow.project_id, cp.project_name,
             sow.title, sow.start_date, sow.end_date, sow.total_value, sow.billing_model, sow.status, sow.signed_at, sow.created_at
      FROM statement_of_works sow
      LEFT JOIN clients c ON sow.client_id = c.id
      LEFT JOIN client_projects cp ON sow.project_id = cp.id
    `,
    searchFields: ["sow.sow_number", "sow.title", "c.client_name"]
  },
  deployment: {
    key: "deployment",
    label: "Deployment",
    category: "Clients, Projects & SOW",
    table: "project_allocations",
    idField: "id",
    displayField: "project_name",
    query: `
      SELECT pa.id, pa.employee_code, pa.employee_name, pa.project_name, pa.client_name,
             pa.role, pa.allocation_percentage, pa.billability, pa.start_date, pa.end_date, pa.status, pa.created_at
      FROM project_allocations pa
    `,
    searchFields: ["pa.employee_name", "pa.employee_code", "pa.project_name", "pa.client_name"]
  },

  // 4. Talent Acquisition & Onboarding
  candidate: {
    key: "candidate",
    label: "Candidate",
    category: "Talent Acquisition & Onboarding",
    table: "candidates",
    idField: "id",
    displayField: "name",
    query: `
      SELECT cand.id, cand.candidate_id, cand.name, cand.email, cand.phone, cand.skills,
             cand.experience, cand.status, cand.bgv_status, cand.department, cand.designation, cand.joining_date, cand.created_at
      FROM candidates cand
    `,
    searchFields: ["cand.name", "cand.email", "cand.candidate_id", "cand.skills"]
  },
  requisition: {
    key: "requisition",
    label: "Requisition",
    category: "Talent Acquisition & Onboarding",
    table: "job_requisitions",
    idField: "id",
    displayField: "req_code",
    query: `
      SELECT jr.id, jr.req_code, jr.title, jr.department, jr.positions, jr.filled,
             jr.budget_range, jr.target_date, jr.priority, jr.hiring_manager, jr.status, jr.description, jr.created_at
      FROM job_requisitions jr
    `,
    searchFields: ["jr.req_code", "jr.title", "jr.department", "jr.hiring_manager"]
  },
  interview: {
    key: "interview",
    label: "Interview",
    category: "Talent Acquisition & Onboarding",
    table: "interviews",
    idField: "id",
    displayField: "interview_code",
    query: `
      SELECT i.id, i.interview_code, i.candidate_id, i.candidate_name, i.role, i.round,
             i.date, i.time, i.panelist, i.mode, i.meeting_link, i.status, i.score, i.feedback, i.created_at
      FROM interviews i
    `,
    searchFields: ["i.interview_code", "i.candidate_name", "i.panelist", "i.role"]
  },
  offer: {
    key: "offer",
    label: "Offer",
    category: "Talent Acquisition & Onboarding",
    table: "job_offers",
    idField: "id",
    displayField: "offer_code",
    query: `
      SELECT jo.id, jo.offer_code, jo.candidate_id, c.name AS candidate_name, jo.designation,
             jo.department, jo.annual_ctc, jo.joining_date, jo.expiry_date, jo.status, jo.offer_letter_url, jo.created_at
      FROM job_offers jo
      LEFT JOIN candidates c ON jo.candidate_id = c.id
    `,
    searchFields: ["jo.offer_code", "c.name", "jo.designation", "jo.department"]
  },
  onboarding: {
    key: "onboarding",
    label: "Onboarding",
    category: "Talent Acquisition & Onboarding",
    table: "onboarding_tasks",
    idField: "id",
    displayField: "task_code",
    query: `
      SELECT ot.id, ot.task_code, ot.candidate_id, c.name AS candidate_name, ot.employee_id,
             ot.title, ot.category, ot.assigned_to, ot.due_date, ot.status, ot.completed_at, ot.created_at
      FROM onboarding_tasks ot
      LEFT JOIN candidates c ON ot.candidate_id = c.id
    `,
    searchFields: ["ot.task_code", "ot.title", "c.name", "ot.assigned_to"]
  },
  bgv: {
    key: "bgv",
    label: "BGV",
    category: "Talent Acquisition & Onboarding",
    table: "bgv_verifications",
    idField: "id",
    displayField: "bgv_code",
    query: `
      SELECT bgv.id, bgv.bgv_code, bgv.candidate_id, c.name AS candidate_name, bgv.verification_type,
             bgv.agency, bgv.initiated_date, bgv.status, bgv.result, bgv.remarks, bgv.created_at
      FROM bgv_verifications bgv
      LEFT JOIN candidates c ON bgv.candidate_id = c.id
    `,
    searchFields: ["bgv.bgv_code", "c.name", "bgv.agency", "bgv.verification_type"]
  },
  document: {
    key: "document",
    label: "Document",
    category: "Talent Acquisition & Onboarding",
    table: "employee_documents",
    idField: "id",
    displayField: "document_name",
    query: `
      SELECT ed.id, ed.employee_id, CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
             ed.document_type, ed.document_name, ed.file_name, ed.file_url, ed.status, ed.uploaded_at
      FROM employee_documents ed
      LEFT JOIN employees e ON ed.employee_id = e.id
    `,
    searchFields: ["ed.document_name", "ed.document_type", "e.first_name", "e.last_name"]
  },

  // 5. Time, Attendance & Leave
  attendance: {
    key: "attendance",
    label: "Attendance",
    category: "Time, Attendance & Leave",
    table: "attendance",
    idField: "id",
    displayField: "date",
    query: `
      SELECT a.id, a.employee_id, CONCAT(e.first_name, ' ', e.last_name) AS employee_name, e.employee_code,
             a.date, a.check_in, a.check_out, a.working_hours, a.status, a.is_late, a.overtime_hours, a.remarks
      FROM attendance a
      LEFT JOIN employees e ON a.employee_id = e.id
    `,
    searchFields: ["e.first_name", "e.last_name", "e.employee_code", "a.status"]
  },
  leave_type: {
    key: "leave_type",
    label: "Leave Type",
    category: "Time, Attendance & Leave",
    table: "leave_types",
    idField: "id",
    displayField: "name",
    query: `
      SELECT lt.id, lt.name, lt.code, lt.annual_allocation, lt.is_paid, lt.is_active, lt.description, lt.created_at
      FROM leave_types lt
    `,
    searchFields: ["lt.name", "lt.code"]
  },
  leave_balance: {
    key: "leave_balance",
    label: "Leave Balance",
    category: "Time, Attendance & Leave",
    table: "leave_balances",
    idField: "id",
    displayField: "employee_name",
    query: `
      SELECT lb.id, lb.employee_id, lb.employee_code, lb.employee_name, lb.leave_type_name,
             lb.leave_type_code, lb.total_entitled, lb.days_used, lb.days_pending, lb.balance_remaining
      FROM leave_balances lb
    `,
    searchFields: ["lb.employee_name", "lb.employee_code", "lb.leave_type_name"]
  },
  leave_request: {
    key: "leave_request",
    label: "Leave Request",
    category: "Time, Attendance & Leave",
    table: "leaves",
    idField: "id",
    displayField: "reason",
    query: `
      SELECT l.id, l.employee_id, CONCAT(e.first_name, ' ', e.last_name) AS employee_name, e.employee_code,
             lt.name AS leave_type, l.start_date, l.end_date, l.number_of_days, l.reason, l.status, l.applied_at
      FROM leaves l
      LEFT JOIN employees e ON l.employee_id = e.id
      LEFT JOIN leave_types lt ON l.leave_type_id = lt.id
    `,
    searchFields: ["e.first_name", "e.last_name", "l.reason", "lt.name", "l.status"]
  },

  // 6. Compensation, Performance & Operations
  salary_revision: {
    key: "salary_revision",
    label: "Salary Revision",
    category: "Compensation, Performance & Operations",
    table: "salary_revisions",
    idField: "id",
    displayField: "revision_code",
    query: `
      SELECT sr.id, sr.revision_code, sr.employee_id, CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
             sr.effective_date, sr.previous_ctc, sr.new_ctc, sr.hike_percentage, sr.reason, sr.approved_by, sr.status, sr.created_at
      FROM salary_revisions sr
      LEFT JOIN employees e ON sr.employee_id = e.id
    `,
    searchFields: ["sr.revision_code", "e.first_name", "e.last_name", "sr.reason"]
  },
  payroll_input: {
    key: "payroll_input",
    label: "Payroll Input",
    category: "Compensation, Performance & Operations",
    table: "payroll_inputs",
    idField: "id",
    displayField: "input_code",
    query: `
      SELECT pi.id, pi.input_code, pi.employee_id, pi.employee_code, pi.employee_name,
             pi.month, pi.year, pi.basic_pay, pi.hra, pi.special_allowance, pi.overtime_allowance,
             pi.variable_pay, pi.reimbursements, pi.statutory_bonus, pi.pf_deduction, pi.tax_deduction,
             pi.gross_earnings, pi.net_payable, pi.status, pi.remarks, pi.created_at
      FROM payroll_inputs pi
    `,
    searchFields: ["pi.input_code", "pi.employee_name", "pi.employee_code", "pi.month", "pi.status"]
  },
  performance_cycle: {
    key: "performance_cycle",
    label: "Performance Cycle",
    category: "Compensation, Performance & Operations",
    table: "performance_cycles",
    idField: "id",
    displayField: "cycle_code",
    query: `
      SELECT pc.id, pc.cycle_code, pc.name, pc.period, pc.start_date, pc.end_date, pc.submission_deadline, pc.status, pc.created_at
      FROM performance_cycles pc
    `,
    searchFields: ["pc.cycle_code", "pc.name", "pc.period"]
  },
  goal: {
    key: "goal",
    label: "Goal",
    category: "Compensation, Performance & Operations",
    table: "goals",
    idField: "id",
    displayField: "goal_title",
    query: `
      SELECT g.id, g.employee_id, g.employee_name, g.employee_code, g.goal_title,
             g.key_result, g.achievement_score, g.manager_feedback, g.status, g.created_at
      FROM goals g
    `,
    searchFields: ["g.goal_title", "g.key_result", "g.employee_name", "g.employee_code"]
  },
  kra: {
    key: "kra",
    label: "KRA",
    category: "Compensation, Performance & Operations",
    table: "kras",
    idField: "id",
    displayField: "kra_code",
    query: `
      SELECT k.id, k.kra_code, k.department, k.role_title, k.title, k.weightage, k.description, k.created_at
      FROM kras k
    `,
    searchFields: ["k.kra_code", "k.department", "k.role_title", "k.title"]
  },
  kpi: {
    key: "kpi",
    label: "KPI",
    category: "Compensation, Performance & Operations",
    table: "kpi_metrics",
    idField: "id",
    displayField: "kpi_code",
    query: `
      SELECT kpi.id, kpi.kpi_code, kpi.kra_id, k.title AS kra_title, kpi.title, kpi.unit,
             kpi.target_value, kpi.actual_value, kpi.status, kpi.created_at
      FROM kpi_metrics kpi
      LEFT JOIN kras k ON kpi.kra_id = k.id
    `,
    searchFields: ["kpi.kpi_code", "kpi.title", "k.title"]
  },
  ticket: {
    key: "ticket",
    label: "Ticket",
    category: "Compensation, Performance & Operations",
    table: "tickets",
    idField: "id",
    displayField: "ticket_id",
    query: `
      SELECT t.id, t.ticket_id, t.emp_id, t.query, t.status, t.resolution, t.created_at, t.updated_at
      FROM tickets t
    `,
    searchFields: ["t.ticket_id", "t.emp_id", "t.query", "t.status"]
  },
  asset: {
    key: "asset",
    label: "Asset",
    category: "Compensation, Performance & Operations",
    table: "assets",
    idField: "id",
    displayField: "asset_tag",
    query: `
      SELECT a.id, a.asset_tag, a.name, a.category, a.serial_number, a.model,
             a.assigned_to_employee_id, a.assigned_to_name, a.allocation_date, a.return_date, a.condition, a.status, a.created_at
      FROM assets a
    `,
    searchFields: ["a.asset_tag", "a.name", "a.serial_number", "a.assigned_to_name"]
  },
  exit: {
    key: "exit",
    label: "Exit",
    category: "Compensation, Performance & Operations",
    table: "resignations",
    idField: "id",
    displayField: "reason_category",
    query: `
      SELECT r.id, r.employee_id, CONCAT(e.first_name, ' ', e.last_name) AS employee_name, e.employee_code,
             r.resignation_date, r.notice_period_days, r.requested_last_working_day, r.approved_last_working_day,
             r.reason_category, r.reason_details, r.status, r.created_at
      FROM resignations r
      LEFT JOIN employees e ON r.employee_id = e.id
    `,
    searchFields: ["e.first_name", "e.last_name", "r.reason_category", "r.status"]
  },
  clearance: {
    key: "clearance",
    label: "Clearance",
    category: "Compensation, Performance & Operations",
    table: "clearances",
    idField: "id",
    displayField: "id",
    query: `
      SELECT cl.id, cl.employee_id, CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
             cl.resignation_id, cl.assets, cl.it_access, cl.finance, cl.leave_attendance, cl.documents, cl.final_settlement, cl.relieving_letter, cl.created_at
      FROM clearances cl
      LEFT JOIN employees e ON cl.employee_id = e.id
    `,
    searchFields: ["e.first_name", "e.last_name"]
  },
  fnf_input: {
    key: "fnf_input",
    label: "Full & Final Input",
    category: "Compensation, Performance & Operations",
    table: "fnf_settlements",
    idField: "id",
    displayField: "settlement_code",
    query: `
      SELECT fnf.id, fnf.settlement_code, fnf.resignation_id, fnf.employee_id, fnf.employee_name,
             fnf.unpaid_days_salary, fnf.leave_encashment_amount, fnf.gratuity_amount, fnf.bonus_payable,
             fnf.notice_pay_recovery, fnf.other_deductions, fnf.net_payable, fnf.status, fnf.disbursed_at, fnf.created_at
      FROM fnf_settlements fnf
    `,
    searchFields: ["fnf.settlement_code", "fnf.employee_name", "fnf.status"]
  },
  notification: {
    key: "notification",
    label: "Notification",
    category: "Compensation, Performance & Operations",
    table: "notifications",
    idField: "id",
    displayField: "title",
    query: `
      SELECT n.id, n.user_id, u.email AS user_email, n.title, n.message, n.type, n.is_read, n.action_url, n.created_at
      FROM notifications n
      LEFT JOIN users u ON n.user_id = u.id
    `,
    searchFields: ["n.title", "n.message", "u.email"]
  },
  approval: {
    key: "approval",
    label: "Approval",
    category: "Compensation, Performance & Operations",
    table: "approvals",
    idField: "id",
    displayField: "approval_code",
    query: `
      SELECT app.id, app.approval_code, app.module, app.entity_id, app.requester_name,
             app.approver_role, app.level, app.status, app.comments, app.action_date, app.created_at
      FROM approvals app
    `,
    searchFields: ["app.approval_code", "app.module", "app.requester_name", "app.status"]
  }
};

/**
 * GET /api/entities/overview
 * Real-time summary and count across ALL 41 enterprise HRMS entities
 */
export const getEntitiesOverview = async (req, res, next) => {
  try {
    const keys = Object.keys(ENTITY_DEFINITIONS);
    const countPromises = keys.map(async (key) => {
      const def = ENTITY_DEFINITIONS[key];
      try {
        const r = await pool.query(`SELECT COUNT(*) AS c FROM ${def.table}`);
        const count = parseInt(r.rows[0]?.c || 0, 10);
        return {
          key: def.key,
          label: def.label,
          category: def.category,
          table: def.table,
          count,
          status: count > 0 ? "Operational" : "Synchronized",
          liveSync: true
        };
      } catch (err) {
        return {
          key: def.key,
          label: def.label,
          category: def.category,
          table: def.table,
          count: 0,
          status: "Error",
          error: err.message
        };
      }
    });

    const results = await Promise.all(countPromises);

    // Grouping by category
    const categories = {};
    results.forEach((item) => {
      if (!categories[item.category]) categories[item.category] = [];
      categories[item.category].push(item);
    });

    const totalRecords = results.reduce((acc, curr) => acc + curr.count, 0);

    return res.status(200).json({
      success: true,
      totalEntities: results.length,
      totalDatabaseRecords: totalRecords,
      lastSynchronizedAt: new Date().toISOString(),
      entities: results,
      categories
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/entities/:entityKey/schema
 * Live PostgreSQL schema definition and columns
 */
export const getEntitySchema = async (req, res, next) => {
  try {
    const { entityKey } = req.params;
    const def = ENTITY_DEFINITIONS[entityKey];
    if (!def) {
      return res.status(404).json({ success: false, message: `Entity '${entityKey}' not found` });
    }

    const colsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [def.table]);

    return res.status(200).json({
      success: true,
      entityKey,
      label: def.label,
      table: def.table,
      category: def.category,
      displayField: def.displayField,
      searchFields: def.searchFields,
      columns: colsResult.rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/entities/:entityKey
 * Fetch live records for any of the 41 entities with real-time PostgreSQL queries
 */
export const getEntityRecords = async (req, res, next) => {
  try {
    const { entityKey } = req.params;
    const def = ENTITY_DEFINITIONS[entityKey];

    if (!def) {
      return res.status(404).json({
        success: false,
        message: `Entity '${entityKey}' is not recognized. Valid entities: ${Object.keys(ENTITY_DEFINITIONS).join(", ")}`
      });
    }

    const { search = "", limit = 50, page = 1, sort = "desc" } = req.query;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

    let queryStr = def.query.trim();
    const params = [];

    // Search filter if provided
    if (search && def.searchFields && def.searchFields.length > 0) {
      const searchClauses = def.searchFields.map((field) => {
        params.push(`%${search}%`);
        return `CAST(${field} AS TEXT) ILIKE $${params.length}`;
      });
      const upper = queryStr.toUpperCase();
      if (upper.includes(" GROUP BY ")) {
        queryStr += ` HAVING (${searchClauses.join(" OR ")})`;
      } else if (upper.includes(" WHERE ")) {
        queryStr += ` AND (${searchClauses.join(" OR ")})`;
      } else {
        queryStr += ` WHERE (${searchClauses.join(" OR ")})`;
      }
    }

    // Ordering: default to column 1 (usually primary key/id)
    if (!queryStr.toUpperCase().includes(" ORDER BY ")) {
      queryStr += ` ORDER BY 1 ${sort.toUpperCase() === "ASC" ? "ASC" : "DESC"}`;
    }

    // Pagination
    params.push(parseInt(limit, 10));
    queryStr += ` LIMIT $${params.length}`;
    params.push(offset);
    queryStr += ` OFFSET $${params.length}`;

    const recordResult = await pool.query(queryStr, params);

    // Total Count query
    let totalCount = recordResult.rows.length;
    try {
      if (def.table) {
        const countRes = await pool.query(`SELECT count(*) FROM ${def.table}`);
        totalCount = parseInt(countRes.rows[0].count, 10);
      }
    } catch {
      // Fallback
    }

    return res.status(200).json({
      success: true,
      entity: {
        key: def.key,
        label: def.label,
        category: def.category,
        table: def.table
      },
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalRecords: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit, 10))
      },
      data: recordResult.rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/entities/:entityKey
 * Insert new record dynamically for supported entities
 */
export const createEntityRecord = async (req, res, next) => {
  try {
    const { entityKey } = req.params;
    const def = ENTITY_DEFINITIONS[entityKey];
    if (!def) {
      return res.status(404).json({ success: false, message: `Entity '${entityKey}' not found` });
    }

    const payload = req.body;
    const keys = Object.keys(payload).filter(k => payload[k] !== undefined && k !== 'id');
    if (keys.length === 0) {
      return res.status(400).json({ success: false, message: "No data provided in request body" });
    }

    const cols = keys.map(k => `"${k}"`).join(", ");
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const values = keys.map(k => payload[k]);

    const insertSql = `INSERT INTO ${def.table} (${cols}) VALUES (${placeholders}) RETURNING *`;
    const result = await pool.query(insertSql, values);

    // Audit log
    try {
      await pool.query(`
        INSERT INTO audit_logs (action, entity_type, entity_id, details, user_name, user_role, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, ['CREATE', def.label, result.rows[0].id || 0, `Created new ${def.label} record`, req.user?.name || 'System User', req.user?.role || 'admin', req.ip || '127.0.0.1']);
    } catch (auditErr) {
      console.warn("Audit log notice:", auditErr.message);
    }

    return res.status(201).json({
      success: true,
      message: `${def.label} record created successfully`,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/entities/:entityKey/:id
 * Update record dynamically by ID
 */
export const updateEntityRecord = async (req, res, next) => {
  try {
    const { entityKey, id } = req.params;
    const def = ENTITY_DEFINITIONS[entityKey];
    if (!def) {
      return res.status(404).json({ success: false, message: `Entity '${entityKey}' not found` });
    }

    const payload = req.body;
    const keys = Object.keys(payload).filter(k => payload[k] !== undefined && k !== 'id' && k !== 'created_at');
    if (keys.length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update provided" });
    }

    const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
    const values = [...keys.map(k => payload[k]), id];

    const updateSql = `UPDATE ${def.table} SET ${setClauses} WHERE id = $${values.length} RETURNING *`;
    const result = await pool.query(updateSql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: `${def.label} with ID ${id} not found` });
    }

    return res.status(200).json({
      success: true,
      message: `${def.label} updated successfully`,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/entities/:entityKey/:id
 * Delete record dynamically by ID
 */
export const deleteEntityRecord = async (req, res, next) => {
  try {
    const { entityKey, id } = req.params;
    const def = ENTITY_DEFINITIONS[entityKey];
    if (!def) {
      return res.status(404).json({ success: false, message: `Entity '${entityKey}' not found` });
    }

    const delSql = `DELETE FROM ${def.table} WHERE id = $1 RETURNING *`;
    const result = await pool.query(delSql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: `${def.label} with ID ${id} not found` });
    }

    return res.status(200).json({
      success: true,
      message: `${def.label} deleted successfully`,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};
