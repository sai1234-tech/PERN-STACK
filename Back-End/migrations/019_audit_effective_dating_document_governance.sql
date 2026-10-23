-- 019_audit_effective_dating_document_governance.sql
-- Enterprise PERN HRMS: 5 Core Governance & Compliance Pillars:
-- 1. Critical Data Change Logs (User, Timestamp, Source, Old vs New, Diff)
-- 2. Immutable Approval Decision History (Decision, Approver, Timestamp, Comments, Step)
-- 3. Effective-Dated History Ledger (Temporal Non-Overwriting Versioning, As-Of-Date)
-- 4. Sensitive Export & Administrative Action Logs (File Checksum, PII/Financial, Admin Actions)
-- 5. Document Preview/Download Governance & Dynamic Watermarking Matrix

-- =========================================================================
-- 1. CRITICAL DATA CHANGE LOGS
-- =========================================================================
CREATE TABLE IF NOT EXISTS critical_data_change_logs (
    id SERIAL PRIMARY KEY,
    change_code VARCHAR(100) UNIQUE NOT NULL,
    entity_type VARCHAR(100) NOT NULL, -- EMPLOYEE_COMPENSATION, BANK_ACCOUNT, STATUTORY_IDENTIFIERS, ORG_STRUCTURE, SECURITY_ROLE_PERMISSION, SOW_BILLING_RATE
    entity_id VARCHAR(100) NOT NULL,
    entity_name VARCHAR(255) DEFAULT '',
    action_type VARCHAR(50) NOT NULL, -- INSERT, UPDATE, DELETE, STATUS_OVERRIDE, STATE_TRANSITION
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(150) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    source_ip VARCHAR(50) NOT NULL DEFAULT '127.0.0.1',
    source_channel VARCHAR(50) NOT NULL DEFAULT 'WEB_APPLICATION', -- WEB_APPLICATION, MOBILE_APP, ADMIN_CONSOLE, INTEGRATION_PIPELINE
    source_user_agent VARCHAR(255) DEFAULT 'Enterprise PERN Web Client',
    old_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    new_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    changed_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    business_justification TEXT NOT NULL DEFAULT '',
    criticality VARCHAR(50) DEFAULT 'CRITICAL', -- CRITICAL, HIGH, MEDIUM
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crit_change_entity ON critical_data_change_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_crit_change_user ON critical_data_change_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_crit_change_created ON critical_data_change_logs(created_at DESC);

-- =========================================================================
-- 2. IMMUTABLE APPROVAL DECISION HISTORY
-- =========================================================================
CREATE TABLE IF NOT EXISTS approval_decision_history (
    id SERIAL PRIMARY KEY,
    decision_code VARCHAR(100) UNIQUE NOT NULL,
    workflow_type VARCHAR(100) NOT NULL, -- LEAVE_REQUEST, MONTHLY_PAYROLL_CUTOFF, SALARY_REVISION, EXPENSE_REIMBURSEMENT, EXIT_CLEARANCE, JOB_OFFER, PROBATION_CONFIRMATION, DOCUMENT_VERIFICATION, BGV_CLEARANCE
    entity_id VARCHAR(100) NOT NULL,
    entity_title VARCHAR(255) DEFAULT '',
    requester_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    requester_name VARCHAR(150) DEFAULT '',
    step_number INTEGER NOT NULL DEFAULT 1,
    step_name VARCHAR(150) NOT NULL, -- Level 1 - Reporting Manager, Level 2 - Department Head, Level 3 - Finance Controller, Final HR Signoff
    decision VARCHAR(50) NOT NULL, -- APPROVED, REJECTED, SENT_BACK, DELEGATED, ESCALATED, AUTO_APPROVED_SLA
    approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approver_name VARCHAR(150) NOT NULL,
    approver_email VARCHAR(255) NOT NULL,
    approver_role VARCHAR(50) NOT NULL,
    comments TEXT NOT NULL, -- Mandatory remarks retained permanently
    delegated_to_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    delegated_to_name VARCHAR(150) DEFAULT '',
    previous_status VARCHAR(50) NOT NULL,
    resulting_status VARCHAR(50) NOT NULL,
    ip_address VARCHAR(50) DEFAULT '127.0.0.1',
    source_channel VARCHAR(50) DEFAULT 'WEB_PORTAL', -- WEB_PORTAL, MOBILE_APP, EMAIL_ACTIONABLE_MESSAGE, TEAMS_INTEGRATION
    decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_appr_hist_workflow ON approval_decision_history(workflow_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_appr_hist_approver ON approval_decision_history(approver_id);
CREATE INDEX IF NOT EXISTS idx_appr_hist_decided ON approval_decision_history(decided_at DESC);

-- =========================================================================
-- 3. EFFECTIVE-DATED HISTORY LEDGER (TEMPORAL / NON-OVERWRITING)
-- =========================================================================
CREATE TABLE IF NOT EXISTS effective_dated_history (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(100) NOT NULL, -- EMPLOYEE_COMPENSATION, JOB_DESIGNATION, DEPARTMENT_ASSIGNMENT, REPORTING_MANAGER, CLIENT_SOW_RATE
    entity_id VARCHAR(100) NOT NULL,
    entity_name VARCHAR(255) DEFAULT '',
    version_number INTEGER NOT NULL DEFAULT 1,
    effective_from DATE NOT NULL,
    effective_to DATE DEFAULT '9999-12-31',
    is_current BOOLEAN DEFAULT TRUE,
    change_reason VARCHAR(255) NOT NULL, -- ANNUAL_PERFORMANCE_MERIT, PROMOTION_TO_SENIOR_LEAD, STATUTORY_MIN_WAGE_ALIGNMENT, DEPT_TRANSFER, MARKET_BENCHMARK_CORRECTION
    record_payload JSONB NOT NULL,
    diff_summary JSONB DEFAULT '{}'::jsonb,
    created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by_name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_eff_history_entity ON effective_dated_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_eff_history_dates ON effective_dated_history(entity_type, entity_id, effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_eff_history_current ON effective_dated_history(entity_type, entity_id, is_current);

-- =========================================================================
-- 4. SENSITIVE EXPORT & ADMINISTRATIVE ACTION LOGS
-- =========================================================================
CREATE TABLE IF NOT EXISTS sensitive_export_logs (
    id SERIAL PRIMARY KEY,
    export_code VARCHAR(100) UNIQUE NOT NULL,
    export_type VARCHAR(100) NOT NULL, -- SALARY_REGISTER_EXCEL, BANK_DISBURSAL_CSV, AADHAAR_PAN_COMPLIANCE_DOCKET, PF_ESI_ECR_REPORT, EMPLOYEE_MASTER_DUMP, BGV_VERIFICATION_RECORDS, PERFORMANCE_RATING_REPORT, FORM_16_TDS_DOCKET
    export_format VARCHAR(20) NOT NULL, -- CSV, XLSX, PDF, JSON, ZIP
    record_count INTEGER NOT NULL DEFAULT 1,
    sensitivity_level VARCHAR(50) NOT NULL, -- RESTRICTED_PII, FINANCIAL_CONFIDENTIAL, STATUTORY_RESTRICTED, EXECUTIVE_ONLY
    filter_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
    file_checksum_sha256 VARCHAR(64) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(150) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    ip_address VARCHAR(50) NOT NULL DEFAULT '127.0.0.1',
    user_agent VARCHAR(255) DEFAULT 'Enterprise PERN Exporter',
    export_purpose TEXT NOT NULL DEFAULT 'Authorized Compliance / Disbursal Export',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sens_export_type ON sensitive_export_logs(export_type);
CREATE INDEX IF NOT EXISTS idx_sens_export_user ON sensitive_export_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sens_export_created ON sensitive_export_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS administrative_action_logs (
    id SERIAL PRIMARY KEY,
    action_code VARCHAR(100) UNIQUE NOT NULL,
    admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    admin_name VARCHAR(150) NOT NULL,
    admin_email VARCHAR(255) NOT NULL,
    admin_role VARCHAR(50) NOT NULL,
    action_category VARCHAR(100) NOT NULL, -- ROLE_PRIVILEGE_MODIFIED, SYSTEM_CONFIG_UPDATED, USER_ACCOUNT_LOCKED, USER_DEACTIVATED, IMPERSONATION_STARTED, POLICY_OVERRIDE, ENCRYPTION_KEY_ROTATED, RETENTION_RULE_EXECUTED
    target_entity_type VARCHAR(100) NOT NULL,
    target_entity_id VARCHAR(100) NOT NULL,
    action_details TEXT NOT NULL,
    before_state JSONB DEFAULT '{}'::jsonb,
    after_state JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'SUCCESS', -- SUCCESS, BLOCKED, FLAGGED_ANOMALY
    ip_address VARCHAR(50) DEFAULT '127.0.0.1',
    user_agent VARCHAR(255) DEFAULT 'PERN HRMS Admin Console',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_act_category ON administrative_action_logs(action_category);
CREATE INDEX IF NOT EXISTS idx_admin_act_admin ON administrative_action_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_act_created ON administrative_action_logs(created_at DESC);

-- =========================================================================
-- 5. DOCUMENT PREVIEW / DOWNLOAD GOVERNANCE & WATERMARKING POLICIES
-- =========================================================================
CREATE TABLE IF NOT EXISTS document_governance_policies (
    id SERIAL PRIMARY KEY,
    category_code VARCHAR(100) UNIQUE NOT NULL,
    category_label VARCHAR(150) NOT NULL,
    description TEXT DEFAULT '',
    can_preview_roles JSONB NOT NULL DEFAULT '["admin", "super_admin"]'::jsonb,
    can_download_roles JSONB NOT NULL DEFAULT '["super_admin"]'::jsonb,
    can_delete_roles JSONB NOT NULL DEFAULT '["super_admin"]'::jsonb,
    allow_owner_preview BOOLEAN DEFAULT TRUE,
    allow_owner_download BOOLEAN DEFAULT FALSE,
    requires_watermark BOOLEAN DEFAULT TRUE,
    watermark_pattern VARCHAR(255) DEFAULT 'CONFIDENTIAL - {{user_email}} - IP:{{ip}} - {{timestamp}}',
    requires_mfa_stepup_download BOOLEAN DEFAULT FALSE,
    max_downloads_per_day INTEGER DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_governance_audit (
    id SERIAL PRIMARY KEY,
    document_id INTEGER DEFAULT NULL,
    document_name VARCHAR(255) NOT NULL,
    document_category VARCHAR(100) NOT NULL,
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(150) NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- PREVIEW_REQUESTED, DOWNLOAD_REQUESTED, ACCESS_GRANTED, ACCESS_DENIED, WATERMARK_APPLIED
    access_granted BOOLEAN NOT NULL,
    denial_reason VARCHAR(255) DEFAULT '',
    watermark_applied VARCHAR(255) DEFAULT '',
    ip_address VARCHAR(50) DEFAULT '127.0.0.1',
    user_agent VARCHAR(255) DEFAULT 'PERN Document Viewer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_gov_audit_doc ON document_governance_audit(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_gov_audit_user ON document_governance_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_doc_gov_audit_created ON document_governance_audit(created_at DESC);

-- Seed Initial Document Governance Policies
INSERT INTO document_governance_policies (
    category_code, category_label, description,
    can_preview_roles, can_download_roles, can_delete_roles,
    allow_owner_preview, allow_owner_download, requires_watermark,
    watermark_pattern, requires_mfa_stepup_download, max_downloads_per_day
)
VALUES 
    (
        'COMPENSATION_LETTERS',
        'Compensation & Increment Letters',
        'Confidential CTC annexures, annual appraisals, and revision letters',
        '["admin", "super_admin", "finance", "hr", "manager"]'::jsonb,
        '["admin", "super_admin", "finance"]'::jsonb,
        '["super_admin"]'::jsonb,
        TRUE, FALSE, TRUE,
        'CONFIDENTIAL CTC - {{user_email}} - IP:{{ip}} - {{timestamp}}',
        TRUE, 5
    ),
    (
        'BGV_INVESTIGATION_REPORTS',
        'Background Verification Screening Dossiers',
        'Third-party criminal, court record, and previous employment verification dossiers',
        '["admin", "super_admin", "hr"]'::jsonb,
        '["admin", "super_admin"]'::jsonb,
        '["super_admin"]'::jsonb,
        FALSE, FALSE, TRUE,
        'BGV STRICT INTERNAL - {{user_email}} - IP:{{ip}} - {{timestamp}}',
        TRUE, 3
    ),
    (
        'MEDICAL_RECORDS',
        'Employee Medical & Health Fitness Certificates',
        'Protected health info (PHI) under DPDP Act 2023 Sec 6 sensitive health data',
        '["admin", "super_admin", "hr"]'::jsonb,
        '["admin", "super_admin"]'::jsonb,
        '["super_admin"]'::jsonb,
        TRUE, TRUE, TRUE,
        'PROTECTED HEALTH RECORD - {{user_email}} - IP:{{ip}} - {{timestamp}}',
        FALSE, 5
    ),
    (
        'GOVERNMENT_IDS_AADHAAR_PAN',
        'Statutory Identity Proofs (Aadhaar / PAN / Passport)',
        'Sensitive government issued personal identification documents requiring masking',
        '["admin", "super_admin", "hr", "finance"]'::jsonb,
        '["admin", "super_admin", "finance"]'::jsonb,
        '["super_admin"]'::jsonb,
        TRUE, TRUE, TRUE,
        'STATUTORY IDENTIFIER - {{user_email}} - IP:{{ip}} - {{timestamp}}',
        TRUE, 5
    ),
    (
        'PERFORMANCE_APPRAISALS',
        'Annual Performance Review & KRA Ratings',
        'Managerial ratings, executive feedback, and promotion calibration forms',
        '["admin", "super_admin", "hr", "manager"]'::jsonb,
        '["admin", "super_admin", "hr"]'::jsonb,
        '["super_admin"]'::jsonb,
        TRUE, FALSE, TRUE,
        'PERFORMANCE APPRAISAL - {{user_email}} - IP:{{ip}} - {{timestamp}}',
        FALSE, 10
    ),
    (
        'SEPARATION_FULL_FINAL',
        'Exit Clearance & F&F Settlement Dockets',
        'Departmental clearance sign-offs, gratuity, leave encashment, and no-dues slips',
        '["admin", "super_admin", "finance", "hr"]'::jsonb,
        '["admin", "super_admin", "finance"]'::jsonb,
        '["super_admin"]'::jsonb,
        TRUE, TRUE, TRUE,
        'SEPARATION DOCKET - {{user_email}} - IP:{{ip}} - {{timestamp}}',
        TRUE, 5
    ),
    (
        'COMPANY_POLICIES_PUBLIC',
        'General HR Policies, Code of Conduct & Handbooks',
        'Public organizational guidelines accessible to all verified employees',
        '["admin", "super_admin", "hr", "finance", "manager", "employee"]'::jsonb,
        '["admin", "super_admin", "hr", "finance", "manager", "employee"]'::jsonb,
        '["super_admin", "hr"]'::jsonb,
        TRUE, TRUE, FALSE,
        'PUBLIC POLICY - {{user_email}}',
        FALSE, 50
    )
ON CONFLICT (category_code) DO UPDATE SET
    can_preview_roles = EXCLUDED.can_preview_roles,
    can_download_roles = EXCLUDED.can_download_roles,
    requires_watermark = EXCLUDED.requires_watermark,
    watermark_pattern = EXCLUDED.watermark_pattern,
    requires_mfa_stepup_download = EXCLUDED.requires_mfa_stepup_download,
    max_downloads_per_day = EXCLUDED.max_downloads_per_day;

SELECT '019_audit_effective_dating_document_governance migration completed successfully' AS status;
