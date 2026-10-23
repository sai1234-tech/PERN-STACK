-- 016_core_database_entities.sql
-- Enterprise PERN HRMS: 41 Core Database Entities Implementation
-- Real Relational Tables, First-Class Views, Constraints and Entity Mappings

-- =========================================================================
-- 1. DEDICATED TABLES FOR ENTERPRISE IDENTITY & COMPLIANCE
-- =========================================================================

-- 1.1 Roles Master Table (Entity 39: Role)
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    role_code VARCHAR(50) UNIQUE NOT NULL,
    role_name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT '',
    is_system BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed standard enterprise roles
INSERT INTO roles (role_code, role_name, description, is_system)
VALUES 
    ('admin', 'System Administrator', 'Full system access and compliance oversight', TRUE),
    ('hr', 'Human Resources Executive', 'Talent, payroll, onboarding and policy management', TRUE),
    ('manager', 'People Manager / Team Lead', 'Team timesheets, leave approvals and OKR tracking', TRUE),
    ('employee', 'Enterprise Employee', 'Self-service workspace, profile and attendance punch', TRUE),
    ('leadership', 'Executive Leadership', 'Enterprise KPIs, headcount analysis and financial insights', TRUE)
ON CONFLICT (role_code) DO NOTHING;

-- 1.2 Permissions Master Table (Entity 40: Permission)
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    permission_code VARCHAR(100) UNIQUE NOT NULL,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed standard granular permissions across all modules
INSERT INTO permissions (permission_code, module, action, description)
VALUES
    ('employees.view', 'employees', 'view', 'View employee directories and profiles'),
    ('employees.create', 'employees', 'create', 'Add new employee records'),
    ('employees.edit', 'employees', 'edit', 'Update employee job and identity details'),
    ('employees.delete', 'employees', 'delete', 'Deactivate or delete employee records'),
    ('attendance.view', 'attendance', 'view', 'View attendance and punch telemetry'),
    ('attendance.create', 'attendance', 'create', 'Record attendance or punch in/out'),
    ('attendance.edit', 'attendance', 'edit', 'Regularize attendance records'),
    ('attendance.approve', 'attendance', 'approve', 'Approve attendance regularization'),
    ('leaves.view', 'leaves', 'view', 'View leave balances and requests'),
    ('leaves.create', 'leaves', 'create', 'Submit leave applications'),
    ('leaves.approve', 'leaves', 'approve', 'Approve or reject leave requests'),
    ('timesheets.view', 'timesheets', 'view', 'View weekly timesheet submissions'),
    ('timesheets.create', 'timesheets', 'create', 'Submit billable and task timesheets'),
    ('timesheets.approve', 'timesheets', 'approve', 'Approve or reject timesheet entries'),
    ('payroll.view', 'payroll', 'view', 'View payslips and payroll inputs'),
    ('payroll.create', 'payroll', 'create', 'Initiate monthly payroll processing batch'),
    ('payroll.edit', 'payroll', 'edit', 'Adjust variable pay and deductions'),
    ('payroll.approve', 'payroll', 'approve', 'Authorize and disburse monthly payroll'),
    ('recruitment.view', 'recruitment', 'view', 'View job requisitions and candidate pipeline'),
    ('recruitment.create', 'recruitment', 'create', 'Create job postings and schedule interviews'),
    ('recruitment.edit', 'recruitment', 'edit', 'Issue job offers and trigger BGV'),
    ('performance.view', 'performance', 'view', 'View performance cycles, OKRs and KPIs'),
    ('performance.create', 'performance', 'create', 'Create KRAs, KPIs and goals'),
    ('performance.evaluate', 'performance', 'evaluate', 'Conduct appraisals and score performance'),
    ('assets.view', 'assets', 'view', 'View IT and hardware inventory'),
    ('assets.allocate', 'assets', 'allocate', 'Allocate or recover company assets'),
    ('entities.view', 'entities', 'view', 'Access 41-entity master data explorer'),
    ('entities.manage', 'entities', 'manage', 'Execute CRUD on enterprise master entities'),
    ('audit.view', 'audit', 'view', 'Inspect real-time system audit logs')
ON CONFLICT (permission_code) DO NOTHING;

-- 1.3 Payroll Inputs Table (Entity 26: Payroll Input)
CREATE TABLE IF NOT EXISTS payroll_inputs (
    id SERIAL PRIMARY KEY,
    input_code VARCHAR(50) UNIQUE NOT NULL,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    employee_code VARCHAR(50),
    employee_name VARCHAR(150),
    month VARCHAR(20) NOT NULL,
    year INTEGER NOT NULL DEFAULT 2026,
    basic_pay NUMERIC(12,2) DEFAULT 0,
    hra NUMERIC(12,2) DEFAULT 0,
    special_allowance NUMERIC(12,2) DEFAULT 0,
    overtime_allowance NUMERIC(12,2) DEFAULT 0,
    variable_pay NUMERIC(12,2) DEFAULT 0,
    reimbursements NUMERIC(12,2) DEFAULT 0,
    statutory_bonus NUMERIC(12,2) DEFAULT 0,
    pf_deduction NUMERIC(12,2) DEFAULT 0,
    tax_deduction NUMERIC(12,2) DEFAULT 0,
    unpaid_leave_deductions NUMERIC(12,2) DEFAULT 0,
    other_deductions NUMERIC(12,2) DEFAULT 0,
    gross_earnings NUMERIC(12,2) GENERATED ALWAYS AS (basic_pay + hra + special_allowance + overtime_allowance + variable_pay + reimbursements + statutory_bonus) STORED,
    net_payable NUMERIC(12,2) GENERATED ALWAYS AS (
        (basic_pay + hra + special_allowance + overtime_allowance + variable_pay + reimbursements + statutory_bonus) - 
        (pf_deduction + tax_deduction + unpaid_leave_deductions + other_deductions)
    ) STORED,
    status VARCHAR(50) DEFAULT 'Draft',
    remarks TEXT DEFAULT '',
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial payroll inputs from active payrolls
INSERT INTO payroll_inputs (
    input_code, employee_id, employee_code, employee_name, month, year,
    basic_pay, hra, special_allowance, overtime_allowance, variable_pay,
    pf_deduction, tax_deduction, status, remarks
)
SELECT 
    CONCAT('INP-', e.employee_code, '-2026-10'),
    e.id,
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name),
    'October 2026',
    2026,
    COALESCE(p.basic_salary, 45000),
    COALESCE(p.allowances * 0.5, 12000),
    COALESCE(p.allowances * 0.5, 8000),
    2500,
    COALESCE(p.bonus, 5000),
    COALESCE(p.pf, 3600),
    COALESCE(p.tax, 4500),
    'Approved',
    'Standard monthly payroll input ledger'
FROM employees e
LEFT JOIN (
    SELECT DISTINCT ON (employee_id) employee_id, basic_salary, allowances, bonus, pf, tax 
    FROM payrolls 
    ORDER BY employee_id, id DESC
) p ON p.employee_id = e.id
ON CONFLICT (input_code) DO NOTHING;


-- =========================================================================
-- 2. FIRST-CLASS RELATIONAL VIEWS FOR IDENTITY, PERSON & EMPLOYMENT
-- =========================================================================

-- 2.1 Entity 2: Person (Persons Master View)
CREATE OR REPLACE VIEW persons AS
SELECT 
    e.id,
    e.id AS employee_id,
    e.employee_code,
    e.first_name,
    e.last_name,
    CONCAT(e.first_name, ' ', e.last_name) AS full_name,
    e.email,
    e.phone,
    e.aadhaar,
    e.pan,
    e.uan,
    COALESCE(e.personal->>'gender', 'Not Specified') AS gender,
    COALESCE(e.personal->>'dob', '1995-01-01') AS date_of_birth,
    COALESCE(e.personal->>'maritalStatus', 'Single') AS marital_status,
    COALESCE(e.personal->>'bloodGroup', 'O+') AS blood_group,
    COALESCE(e.address->>'current', 'Hyderabad, India') AS current_address,
    COALESCE(e.address->>'permanent', 'Hyderabad, India') AS permanent_address,
    COALESCE(e.emergency_contact->>'name', 'Primary Kin') AS emergency_contact_name,
    COALESCE(e.emergency_contact->>'phone', e.phone) AS emergency_contact_phone,
    e.created_at,
    e.updated_at
FROM employees e;

-- 2.2 Entity 3: Employment (Employment Contract View)
CREATE OR REPLACE VIEW employments AS
SELECT 
    e.id,
    e.id AS employee_id,
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
    e.email AS official_email,
    e.department,
    e.designation,
    e.employment_type,
    e.status AS employment_status,
    e.joining_date,
    e.work_location,
    e.cost_center,
    e.tax_regime,
    COALESCE(e.employment->>'probationPeriodMonths', '6') AS probation_period_months,
    COALESCE(e.employment->>'noticePeriodDays', '60') AS notice_period_days,
    COALESCE(e.employment->>'confirmationDate', e.joining_date::text) AS confirmation_date,
    COALESCE(e.employment->>'band', 'L3') AS band,
    e.created_at,
    e.updated_at
FROM employees e;

-- 2.3 Entity 23: Leave Balance (Leave Entitlement & Remaining Balances View)
CREATE OR REPLACE VIEW leave_balances AS
SELECT 
    ROW_NUMBER() OVER (ORDER BY e.id, lt.id) AS id,
    e.id AS employee_id,
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
    lt.id AS leave_type_id,
    lt.name AS leave_type_name,
    lt.code AS leave_type_code,
    lt.annual_allocation AS total_entitled,
    COALESCE(SUM(CASE WHEN l.status = 'approved' THEN l.number_of_days ELSE 0 END), 0) AS days_used,
    COALESCE(SUM(CASE WHEN l.status = 'pending' THEN l.number_of_days ELSE 0 END), 0) AS days_pending,
    (lt.annual_allocation - COALESCE(SUM(CASE WHEN l.status = 'approved' THEN l.number_of_days ELSE 0 END), 0)) AS balance_remaining
FROM employees e
CROSS JOIN leave_types lt
LEFT JOIN leaves l ON l.employee_id = e.id AND l.leave_type_id = lt.id
GROUP BY e.id, e.employee_code, e.first_name, e.last_name, lt.id, lt.name, lt.code, lt.annual_allocation;

-- 2.4 Entity 28: Goal (Performance Goals & OKR View)
CREATE OR REPLACE VIEW goals AS
SELECT 
    o.id,
    o.employee_id,
    CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
    e.employee_code,
    o.objective AS goal_title,
    o.result AS key_result,
    o.score AS achievement_score,
    o.feedback AS manager_feedback,
    CASE 
        WHEN o.score >= 4.0 THEN 'Exceeded'
        WHEN o.score >= 3.0 THEN 'Achieved'
        WHEN o.score IS NOT NULL THEN 'In Progress'
        ELSE 'Active'
    END AS status,
    o.created_at,
    o.updated_at
FROM okrs o
LEFT JOIN employees e ON o.employee_id = e.id;


-- =========================================================================
-- 3. ALIAS VIEWS FOR CANONICAL PLURAL / SINGULAR ENTITY ACCESS
-- =========================================================================

-- Projects & SOWs
CREATE OR REPLACE VIEW projects AS SELECT * FROM client_projects;
CREATE OR REPLACE VIEW sows AS SELECT * FROM statement_of_works;
CREATE OR REPLACE VIEW deployments AS SELECT * FROM project_allocations;

-- Recruitment & Talent
CREATE OR REPLACE VIEW requisitions AS SELECT * FROM job_requisitions;
CREATE OR REPLACE VIEW offers AS SELECT * FROM job_offers;
CREATE OR REPLACE VIEW onboardings AS SELECT * FROM onboarding_tasks;
CREATE OR REPLACE VIEW bgvs AS SELECT * FROM bgv_verifications;
CREATE OR REPLACE VIEW documents AS SELECT * FROM employee_documents;

-- Attendance, Leaves & KPIs
CREATE OR REPLACE VIEW leave_requests AS SELECT * FROM leaves;
CREATE OR REPLACE VIEW kpis AS SELECT * FROM kpi_metrics;

-- Offboarding & Settlements
CREATE OR REPLACE VIEW exits AS SELECT * FROM resignations;
CREATE OR REPLACE VIEW fnf_inputs AS SELECT * FROM fnf_settlements;
CREATE OR REPLACE VIEW full_and_final_inputs AS SELECT * FROM fnf_settlements;


-- =========================================================================
-- 4. SINGULAR ALIAS VIEWS MATCHING EXACT CORE ENTITY NAMES
-- =========================================================================

CREATE OR REPLACE VIEW employee AS SELECT * FROM employees;
CREATE OR REPLACE VIEW person AS SELECT * FROM persons;
CREATE OR REPLACE VIEW employment AS SELECT * FROM employments;
CREATE OR REPLACE VIEW organization AS SELECT * FROM organizations;
CREATE OR REPLACE VIEW department AS SELECT * FROM departments;
CREATE OR REPLACE VIEW designation AS SELECT * FROM designations;
CREATE OR REPLACE VIEW location AS SELECT * FROM locations;
CREATE OR REPLACE VIEW client AS SELECT * FROM clients;
CREATE OR REPLACE VIEW project AS SELECT * FROM client_projects;
CREATE OR REPLACE VIEW sow AS SELECT * FROM statement_of_works;
CREATE OR REPLACE VIEW deployment AS SELECT * FROM project_allocations;
CREATE OR REPLACE VIEW candidate AS SELECT * FROM candidates;
CREATE OR REPLACE VIEW requisition AS SELECT * FROM job_requisitions;
CREATE OR REPLACE VIEW interview AS SELECT * FROM interviews;
CREATE OR REPLACE VIEW offer AS SELECT * FROM job_offers;
CREATE OR REPLACE VIEW onboarding AS SELECT * FROM onboarding_tasks;
CREATE OR REPLACE VIEW bgv AS SELECT * FROM bgv_verifications;
CREATE OR REPLACE VIEW document AS SELECT * FROM employee_documents;
CREATE OR REPLACE VIEW shift AS SELECT * FROM shifts;
CREATE OR REPLACE VIEW holiday AS SELECT * FROM holidays;
CREATE OR REPLACE VIEW leave_type AS SELECT * FROM leave_types;
CREATE OR REPLACE VIEW leave_balance AS SELECT * FROM leave_balances;
CREATE OR REPLACE VIEW leave_request AS SELECT * FROM leaves;
CREATE OR REPLACE VIEW salary_revision AS SELECT * FROM salary_revisions;
CREATE OR REPLACE VIEW payroll_input AS SELECT * FROM payroll_inputs;
CREATE OR REPLACE VIEW performance_cycle AS SELECT * FROM performance_cycles;
CREATE OR REPLACE VIEW goal AS SELECT * FROM goals;
CREATE OR REPLACE VIEW kra AS SELECT * FROM kras;
CREATE OR REPLACE VIEW kpi AS SELECT * FROM kpi_metrics;
CREATE OR REPLACE VIEW ticket AS SELECT * FROM tickets;
CREATE OR REPLACE VIEW asset AS SELECT * FROM assets;
CREATE OR REPLACE VIEW exit AS SELECT * FROM resignations;
CREATE OR REPLACE VIEW clearance AS SELECT * FROM clearances;
CREATE OR REPLACE VIEW fnf_input AS SELECT * FROM fnf_settlements;
CREATE OR REPLACE VIEW full_and_final_input AS SELECT * FROM fnf_settlements;
CREATE OR REPLACE VIEW notification AS SELECT * FROM notifications;
CREATE OR REPLACE VIEW approval AS SELECT * FROM approvals;
CREATE OR REPLACE VIEW "user" AS SELECT * FROM users;
CREATE OR REPLACE VIEW "role" AS SELECT * FROM roles;
CREATE OR REPLACE VIEW "permission" AS SELECT * FROM permissions;
CREATE OR REPLACE VIEW audit_log AS SELECT * FROM audit_logs;

-- Audit verification query
SELECT '016_core_database_entities completed successfully' AS status;
