-- 018_enterprise_automations_and_slas.sql
-- Enterprise PERN HRMS: 9 Lifecycle Automations, SLA Engines & Scheduled Workflows

-- =========================================================================
-- 1. ROLE & CLIENT-BASED ONBOARDING CHECKLIST CREATION
-- =========================================================================
CREATE TABLE IF NOT EXISTS onboarding_checklist_templates (
    id SERIAL PRIMARY KEY,
    template_code VARCHAR(100) UNIQUE NOT NULL,
    target_role VARCHAR(100) NOT NULL, -- Engineering, Sales, HR, Finance, Client Deployment
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS onboarding_checklist_instances (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(150) NOT NULL,
    role VARCHAR(100) NOT NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    task_title VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    assigned_to VARCHAR(150) DEFAULT 'Employee',
    due_date DATE,
    status VARCHAR(50) DEFAULT 'Pending', -- Pending, In Progress, Completed, Overdue
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_onboard_inst_emp ON onboarding_checklist_instances(employee_id);
CREATE INDEX IF NOT EXISTS idx_onboard_inst_client ON onboarding_checklist_instances(client_id);

-- =========================================================================
-- 2. MISSING-DOCUMENT REMINDERS
-- =========================================================================
CREATE TABLE IF NOT EXISTS missing_document_reminders (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) NOT NULL,
    employee_name VARCHAR(150) NOT NULL,
    missing_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
    reminder_channel VARCHAR(50) DEFAULT 'IN_APP_AND_EMAIL',
    reminder_count INTEGER DEFAULT 1,
    due_date DATE DEFAULT (CURRENT_DATE + INTERVAL '7 days'),
    status VARCHAR(50) DEFAULT 'SENT', -- SENT, ACKNOWLEDGED, RESOLVED
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_missing_doc_emp ON missing_document_reminders(employee_id);

-- =========================================================================
-- 3. BGV SLA ESCALATION ENGINE
-- =========================================================================
CREATE TABLE IF NOT EXISTS bgv_sla_escalations (
    id SERIAL PRIMARY KEY,
    bgv_id INTEGER REFERENCES bgv_verifications(id) ON DELETE CASCADE,
    bgv_code VARCHAR(50) NOT NULL,
    candidate_id INTEGER REFERENCES candidates(id) ON DELETE SET NULL,
    candidate_name VARCHAR(150) NOT NULL,
    verification_type VARCHAR(100) NOT NULL,
    agency VARCHAR(150) DEFAULT 'AuthBridge Screening Corp',
    sla_days INTEGER DEFAULT 7,
    days_elapsed INTEGER DEFAULT 0,
    sla_status VARCHAR(50) DEFAULT 'ON_TRACK', -- ON_TRACK, AT_RISK, BREACHED
    escalation_level VARCHAR(50) DEFAULT 'NONE', -- NONE, L1_LEAD, L2_DIRECTOR, L3_EXECUTIVE
    escalated_to VARCHAR(150) DEFAULT '',
    action_taken TEXT DEFAULT '',
    escalated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bgv_sla_status ON bgv_sla_escalations(sla_status);

-- =========================================================================
-- 4. MONTHLY PAYROLL-INPUT GENERATION AFTER CUT-OFF
-- =========================================================================
CREATE TABLE IF NOT EXISTS monthly_cutoff_batches (
    id SERIAL PRIMARY KEY,
    batch_code VARCHAR(100) UNIQUE NOT NULL,
    month VARCHAR(20) NOT NULL,
    year INTEGER NOT NULL DEFAULT 2026,
    cutoff_day INTEGER DEFAULT 25,
    total_employees_processed INTEGER DEFAULT 0,
    total_lop_days NUMERIC(10,1) DEFAULT 0,
    total_overtime_hours NUMERIC(10,1) DEFAULT 0,
    total_gross_payable NUMERIC(14,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'CUTOFF_REACHED_GENERATED', -- CUTOFF_REACHED_GENERATED, DISBURSED, LOCKED
    executed_by VARCHAR(150) DEFAULT 'Automated Payroll Engine',
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 5. PROBATION / CONFIRMATION REMINDERS
-- =========================================================================
CREATE TABLE IF NOT EXISTS probation_confirmation_alerts (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) NOT NULL,
    employee_name VARCHAR(150) NOT NULL,
    department VARCHAR(100) NOT NULL,
    manager_name VARCHAR(150) NOT NULL,
    joining_date DATE NOT NULL,
    probation_end_date DATE NOT NULL,
    days_remaining INTEGER NOT NULL,
    alert_stage VARCHAR(50) NOT NULL, -- 30_DAYS_PRIOR, 15_DAYS_PRIOR, 7_DAYS_PRIOR, OVERDUE
    recommendation_status VARCHAR(50) DEFAULT 'PENDING_REVIEW', -- PENDING_REVIEW, CONFIRMED, EXTENDED, PIP
    manager_comments TEXT DEFAULT '',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_probation_emp ON probation_confirmation_alerts(employee_id);

-- =========================================================================
-- 6. PERFORMANCE-CYCLE REMINDERS
-- =========================================================================
CREATE TABLE IF NOT EXISTS performance_cycle_alerts (
    id SERIAL PRIMARY KEY,
    cycle_id INTEGER REFERENCES performance_cycles(id) ON DELETE CASCADE,
    cycle_code VARCHAR(50) NOT NULL,
    cycle_name VARCHAR(150) NOT NULL,
    stage VARCHAR(100) NOT NULL, -- GOAL_SETTING, SELF_APPRAISAL, MANAGER_APPRAISAL, HR_CALIBRATION
    deadline_date DATE NOT NULL,
    days_remaining INTEGER NOT NULL,
    recipient_role VARCHAR(100) NOT NULL,
    total_pending_submissions INTEGER DEFAULT 0,
    alert_message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'DISPATCHED',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 7. EXIT-CLEARANCE TASK CREATION (5 FUNCTIONAL DEPARTMENTS)
-- =========================================================================
CREATE TABLE IF NOT EXISTS exit_clearance_tasks (
    id SERIAL PRIMARY KEY,
    resignation_id INTEGER REFERENCES resignations(id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(150) NOT NULL,
    department VARCHAR(100) NOT NULL, -- IT, Finance, Admin, Reporting Manager, HR
    task_name VARCHAR(255) NOT NULL,
    required_action TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending', -- Pending, In Progress, Cleared, Rejected
    cleared_by VARCHAR(150),
    cleared_at TIMESTAMP,
    remarks TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exit_clearance_res ON exit_clearance_tasks(resignation_id);
CREATE INDEX IF NOT EXISTS idx_exit_clearance_dept ON exit_clearance_tasks(department);

-- =========================================================================
-- 8. HELPDESK SLA ESCALATION ENGINE
-- =========================================================================
CREATE TABLE IF NOT EXISTS ticket_sla_escalations (
    id SERIAL PRIMARY KEY,
    ticket_id VARCHAR(50) NOT NULL,
    emp_id VARCHAR(100) NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    priority VARCHAR(50) NOT NULL, -- Critical, High, Medium, Low
    sla_target_hours INTEGER NOT NULL, -- Critical: 4h, High: 8h, Medium: 24h, Low: 48h
    hours_elapsed NUMERIC(10,1) NOT NULL,
    sla_status VARCHAR(50) DEFAULT 'BREACHED', -- WITHIN_SLA, APPROACHING_SLA, BREACHED
    escalation_level VARCHAR(50) DEFAULT 'L1', -- L1, L2_LEAD, L3_DIRECTOR
    escalated_to VARCHAR(150) NOT NULL,
    breached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'OPEN'
);

CREATE INDEX IF NOT EXISTS idx_ticket_sla ON ticket_sla_escalations(sla_status);

-- =========================================================================
-- 9. SCHEDULED AUTHORIZED DASHBOARDS & REPORTS
-- =========================================================================
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id SERIAL PRIMARY KEY,
    report_code VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- ATTENDANCE, WORKFORCE, PAYROLL, COMPLIANCE, HELPDESK
    frequency VARCHAR(50) NOT NULL, -- DAILY, WEEKLY, MONTHLY, QUARTERLY
    authorized_roles JSONB NOT NULL DEFAULT '["admin", "leadership"]'::jsonb,
    format VARCHAR(50) DEFAULT 'PDF / CSV',
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scheduled_report_executions (
    id SERIAL PRIMARY KEY,
    report_code VARCHAR(100) NOT NULL,
    report_title VARCHAR(255) NOT NULL,
    execution_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    executed_by VARCHAR(150) DEFAULT 'Automated Report Scheduler',
    records_count INTEGER NOT NULL DEFAULT 0,
    file_size_kb NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'SUCCESS'
);

-- Audit confirmation query
SELECT '018_enterprise_automations_and_slas migration ready' AS status;
