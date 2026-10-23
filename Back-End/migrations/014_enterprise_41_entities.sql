-- 014_enterprise_41_entities.sql
-- Enterprise PERN HRMS Complete 41-Entity Data Schema

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    cin VARCHAR(100) DEFAULT 'U72200TG2020PTC145678',
    gstin VARCHAR(100) DEFAULT '36AAACE1234F1Z5',
    pan VARCHAR(50) DEFAULT 'AAACE1234F',
    website VARCHAR(255) DEFAULT 'https://acme-hrms.enterprise.io',
    headquarters VARCHAR(255) DEFAULT 'HITEC City, Hyderabad, Telangana, India',
    contact_email VARCHAR(255) DEFAULT 'contact@acme-hrms.com',
    contact_phone VARCHAR(50) DEFAULT '+91 40 4567 8900',
    currency VARCHAR(10) DEFAULT 'INR',
    fiscal_year_start VARCHAR(20) DEFAULT 'April',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Designations
CREATE TABLE IF NOT EXISTS designations (
    id SERIAL PRIMARY KEY,
    designation_code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(150) NOT NULL,
    department VARCHAR(100) NOT NULL,
    band VARCHAR(50) DEFAULT 'L3',
    min_salary NUMERIC(12,2) DEFAULT 0,
    max_salary NUMERIC(12,2) DEFAULT 0,
    description TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Locations
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    location_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    country VARCHAR(100) DEFAULT 'India',
    address TEXT NOT NULL,
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    facility_type VARCHAR(50) DEFAULT 'Corporate HQ',
    capacity INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Statement of Works (SOWs)
CREATE TABLE IF NOT EXISTS statement_of_works (
    id SERIAL PRIMARY KEY,
    sow_number VARCHAR(100) UNIQUE NOT NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES client_projects(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_value NUMERIC(14,2) NOT NULL DEFAULT 0,
    billing_model VARCHAR(50) DEFAULT 'Time & Materials',
    status VARCHAR(50) DEFAULT 'Active',
    signed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Job Requisitions
CREATE TABLE IF NOT EXISTS job_requisitions (
    id SERIAL PRIMARY KEY,
    req_code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(150) NOT NULL,
    department VARCHAR(100) NOT NULL,
    positions INTEGER DEFAULT 1,
    filled INTEGER DEFAULT 0,
    budget_range VARCHAR(100) DEFAULT '₹15L - ₹22L',
    target_date DATE,
    priority VARCHAR(50) DEFAULT 'Medium',
    hiring_manager VARCHAR(150) DEFAULT 'Engineering Lead',
    status VARCHAR(50) DEFAULT 'Open',
    description TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Interviews
CREATE TABLE IF NOT EXISTS interviews (
    id SERIAL PRIMARY KEY,
    interview_code VARCHAR(50) UNIQUE NOT NULL,
    candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
    candidate_name VARCHAR(150) NOT NULL,
    role VARCHAR(150) NOT NULL,
    round VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    time VARCHAR(50) NOT NULL,
    panelist VARCHAR(150) NOT NULL,
    mode VARCHAR(50) DEFAULT 'Google Meet',
    meeting_link VARCHAR(255) DEFAULT '',
    status VARCHAR(50) DEFAULT 'Scheduled',
    score VARCHAR(50) DEFAULT 'Pending',
    feedback TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Job Offers
CREATE TABLE IF NOT EXISTS job_offers (
    id SERIAL PRIMARY KEY,
    offer_code VARCHAR(50) UNIQUE NOT NULL,
    candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
    designation VARCHAR(150) NOT NULL,
    department VARCHAR(100) NOT NULL,
    annual_ctc NUMERIC(12,2) NOT NULL,
    joining_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Released',
    offer_letter_url VARCHAR(255) DEFAULT '',
    accepted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Onboarding Tasks
CREATE TABLE IF NOT EXISTS onboarding_tasks (
    id SERIAL PRIMARY KEY,
    task_code VARCHAR(50) UNIQUE NOT NULL,
    candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) DEFAULT 'General',
    assigned_to VARCHAR(150) DEFAULT 'HR Induction Team',
    due_date DATE,
    status VARCHAR(50) DEFAULT 'Pending',
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Background Verification (BGV)
CREATE TABLE IF NOT EXISTS bgv_verifications (
    id SERIAL PRIMARY KEY,
    bgv_code VARCHAR(50) UNIQUE NOT NULL,
    candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
    verification_type VARCHAR(100) NOT NULL,
    agency VARCHAR(150) DEFAULT 'AuthBridge Screening Corp',
    initiated_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(50) DEFAULT 'In Progress',
    result VARCHAR(100) DEFAULT 'Pending',
    remarks TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Shifts
CREATE TABLE IF NOT EXISTS shifts (
    id SERIAL PRIMARY KEY,
    shift_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    grace_period_mins INTEGER DEFAULT 15,
    break_duration_mins INTEGER DEFAULT 60,
    is_night_shift BOOLEAN DEFAULT FALSE,
    description TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Salary Revisions
CREATE TABLE IF NOT EXISTS salary_revisions (
    id SERIAL PRIMARY KEY,
    revision_code VARCHAR(50) UNIQUE NOT NULL,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    effective_date DATE NOT NULL,
    previous_ctc NUMERIC(12,2) NOT NULL,
    new_ctc NUMERIC(12,2) NOT NULL,
    hike_percentage NUMERIC(5,2) NOT NULL,
    reason VARCHAR(255) DEFAULT 'Annual Performance Appraisal',
    approved_by VARCHAR(150) DEFAULT 'HR Director',
    status VARCHAR(50) DEFAULT 'Approved',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. Performance Cycles
CREATE TABLE IF NOT EXISTS performance_cycles (
    id SERIAL PRIMARY KEY,
    cycle_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    period VARCHAR(50) DEFAULT 'Q4 2026',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    submission_deadline DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Key Result Areas (KRAs)
CREATE TABLE IF NOT EXISTS kras (
    id SERIAL PRIMARY KEY,
    kra_code VARCHAR(50) UNIQUE NOT NULL,
    department VARCHAR(100) NOT NULL,
    role_title VARCHAR(150) NOT NULL,
    title VARCHAR(255) NOT NULL,
    weightage INTEGER DEFAULT 25,
    description TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. Key Performance Indicators (KPIs)
CREATE TABLE IF NOT EXISTS kpi_metrics (
    id SERIAL PRIMARY KEY,
    kpi_code VARCHAR(50) UNIQUE NOT NULL,
    kra_id INTEGER REFERENCES kras(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    unit VARCHAR(50) DEFAULT 'Percentage',
    target_value NUMERIC(10,2) NOT NULL,
    actual_value NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'On Track',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. Assets
CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    asset_tag VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100) UNIQUE NOT NULL,
    model VARCHAR(100) DEFAULT '',
    assigned_to_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    assigned_to_name VARCHAR(150) DEFAULT '',
    allocation_date DATE,
    return_date DATE,
    condition VARCHAR(50) DEFAULT 'Excellent',
    status VARCHAR(50) DEFAULT 'Allocated',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 16. Full & Final Settlements (FnF)
CREATE TABLE IF NOT EXISTS fnf_settlements (
    id SERIAL PRIMARY KEY,
    settlement_code VARCHAR(50) UNIQUE NOT NULL,
    resignation_id INTEGER REFERENCES resignations(id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(150) NOT NULL,
    unpaid_days_salary NUMERIC(12,2) DEFAULT 0,
    leave_encashment_amount NUMERIC(12,2) DEFAULT 0,
    gratuity_amount NUMERIC(12,2) DEFAULT 0,
    bonus_payable NUMERIC(12,2) DEFAULT 0,
    notice_pay_recovery NUMERIC(12,2) DEFAULT 0,
    other_deductions NUMERIC(12,2) DEFAULT 0,
    net_payable NUMERIC(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Calculated',
    disbursed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 17. In-App Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    action_url VARCHAR(255) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 18. Approvals Workflow
CREATE TABLE IF NOT EXISTS approvals (
    id SERIAL PRIMARY KEY,
    approval_code VARCHAR(50) UNIQUE NOT NULL,
    module VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    requester_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    requester_name VARCHAR(150) NOT NULL,
    approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approver_role VARCHAR(50) DEFAULT 'manager',
    level INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'pending',
    comments TEXT DEFAULT '',
    action_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 19. Role & Permission Matrix
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role VARCHAR(50) NOT NULL,
    module VARCHAR(50) NOT NULL,
    can_view BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_approve BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_role_module UNIQUE(role, module)
);

-- Create Indexes for Optimal Query Telemetry
CREATE INDEX IF NOT EXISTS idx_designations_dept ON designations(department);
CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);
CREATE INDEX IF NOT EXISTS idx_sows_client ON statement_of_works(client_id);
CREATE INDEX IF NOT EXISTS idx_requisitions_status ON job_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_interviews_cand ON interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_offers_cand ON job_offers(candidate_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_cand ON onboarding_tasks(candidate_id);
CREATE INDEX IF NOT EXISTS idx_bgv_cand ON bgv_verifications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_shifts_code ON shifts(shift_code);
CREATE INDEX IF NOT EXISTS idx_salary_rev_emp ON salary_revisions(employee_id);
CREATE INDEX IF NOT EXISTS idx_kras_dept ON kras(department);
CREATE INDEX IF NOT EXISTS idx_assets_emp ON assets(assigned_to_employee_id);
CREATE INDEX IF NOT EXISTS idx_fnf_emp ON fnf_settlements(employee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_approvals_module ON approvals(module, status);
CREATE INDEX IF NOT EXISTS idx_permissions_role ON role_permissions(role);
