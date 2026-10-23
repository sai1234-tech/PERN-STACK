-- 017_security_compliance_governance.sql
-- Enterprise PERN HRMS: 11 Security, Governance, DPDP Act 2023, MFA & Compliance Controls

-- =========================================================================
-- 1. MFA SESSIONS & PRIVILEGED STEP-UP CHALLENGES
-- =========================================================================
CREATE TABLE IF NOT EXISTS mfa_challenges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    challenge_code VARCHAR(100) UNIQUE NOT NULL,
    action_scope VARCHAR(100) NOT NULL, -- PAYROLL_DISBURSE, ROLE_ASSIGNMENT, STATUTORY_EXPORT, SALARY_REVISION
    otp_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    ip_address VARCHAR(50) DEFAULT '127.0.0.1',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mfa_user_code ON mfa_challenges(user_id, challenge_code);

-- =========================================================================
-- 2. FIELD-LEVEL DATA MASKING & SENSITIVE RESTRICTIONS
-- =========================================================================
CREATE TABLE IF NOT EXISTS data_masking_policies (
    id SERIAL PRIMARY KEY,
    field_name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL, -- COMPENSATION, BANKING, STATUTORY_IDENTITY
    masking_type VARCHAR(50) NOT NULL, -- LAST_4_VISIBLE, FIRST_2_LAST_2, FULL_MASK, CURRENCY_MASK
    allowed_roles JSONB NOT NULL DEFAULT '["admin", "super_admin", "finance", "payroll"]'::jsonb,
    statutory_law VARCHAR(150) DEFAULT 'Indian DPDP Act 2023 / RBI Guidelines',
    description TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO data_masking_policies (field_name, category, masking_type, allowed_roles, statutory_law, description)
VALUES 
    ('aadhaar', 'STATUTORY_IDENTITY', 'LAST_4_VISIBLE', '["admin", "super_admin", "hr_admin"]', 'Aadhaar Act 2016 (Masked Aadhaar)', 'Masks first 8 digits (XXXX-XXXX-1234)'),
    ('pan', 'STATUTORY_IDENTITY', 'FIRST_2_LAST_2', '["admin", "super_admin", "finance", "payroll"]', 'Income Tax Act 1961', 'Masks middle alphanumeric characters (AB****123F)'),
    ('uan', 'STATUTORY_IDENTITY', 'LAST_4_VISIBLE', '["admin", "super_admin", "payroll"]', 'EPFO Guidelines', 'Masks Universal Account Number'),
    ('bank_account_number', 'BANKING', 'LAST_4_VISIBLE', '["admin", "super_admin", "finance", "payroll"]', 'RBI Master Direction on Customer Data', 'Masks all except last 4 digits of account'),
    ('ifsc_code', 'BANKING', 'FIRST_2_LAST_2', '["admin", "super_admin", "finance", "payroll"]', 'RBI Banking Guidelines', 'Restricts IFSC branch details'),
    ('basic_salary', 'COMPENSATION', 'CURRENCY_MASK', '["admin", "super_admin", "finance", "payroll", "leadership"]', 'Internal Executive Compensation Policy', 'Confidential salary data masked for non-authorized viewers'),
    ('net_salary', 'COMPENSATION', 'CURRENCY_MASK', '["admin", "super_admin", "finance", "payroll", "leadership"]', 'Internal Executive Compensation Policy', 'Confidential net take-home masked for non-authorized viewers')
ON CONFLICT (field_name) DO UPDATE SET
    masking_type = EXCLUDED.masking_type,
    allowed_roles = EXCLUDED.allowed_roles,
    statutory_law = EXCLUDED.statutory_law;

-- =========================================================================
-- 3. CRYPTOGRAPHICALLY CHAINED IMMUTABLE AUDIT TRAIL
-- =========================================================================
CREATE TABLE IF NOT EXISTS immutable_audit_trail (
    id SERIAL PRIMARY KEY,
    sequence_number BIGINT UNIQUE NOT NULL,
    prev_hash VARCHAR(64) NOT NULL,
    curr_hash VARCHAR(64) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) DEFAULT '',
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    actor_name VARCHAR(150) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    details TEXT NOT NULL,
    before_state JSONB DEFAULT '{}'::jsonb,
    after_state JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(50) DEFAULT '127.0.0.1',
    user_agent VARCHAR(255) DEFAULT 'Enterprise PERN HRMS Client',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_immutable_audit_seq ON immutable_audit_trail(sequence_number);
CREATE INDEX IF NOT EXISTS idx_immutable_audit_entity ON immutable_audit_trail(entity_type, entity_id);

-- Seed initial genesis block in immutable audit trail if empty
INSERT INTO immutable_audit_trail (
    sequence_number, prev_hash, curr_hash, action, entity_type, entity_id,
    actor_name, actor_role, details, ip_address
)
SELECT 
    1,
    '0000000000000000000000000000000000000000000000000000000000000000',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'GENESIS_SECURITY_ANCHOR',
    'SYSTEM_AUDIT_LEDGER',
    'GENESIS-001',
    'System Security Officer',
    'super_admin',
    'Enterprise Immutable Audit Ledger Initialized with Cryptographic Chaining',
    '127.0.0.1'
WHERE NOT EXISTS (SELECT 1 FROM immutable_audit_trail);

-- =========================================================================
-- 4. DOCUMENT ACCESS & DOWNLOAD LOGS
-- =========================================================================
CREATE TABLE IF NOT EXISTS document_access_logs (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(100) DEFAULT 'Identity/Statutory',
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    employee_name VARCHAR(150) DEFAULT '',
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    actor_name VARCHAR(150) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- VIEW, DOWNLOAD, VERIFY, REJECT, DELETE, EXPORT
    ip_address VARCHAR(50) DEFAULT '127.0.0.1',
    user_agent VARCHAR(255) DEFAULT 'Browser',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_access_doc_id ON document_access_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_access_actor ON document_access_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_doc_access_time ON document_access_logs(created_at DESC);

-- =========================================================================
-- 5. BACKUP & DISASTER RECOVERY (DR) LEDGER
-- =========================================================================
CREATE TABLE IF NOT EXISTS system_backup_dr_logs (
    id SERIAL PRIMARY KEY,
    backup_code VARCHAR(100) UNIQUE NOT NULL,
    backup_type VARCHAR(50) NOT NULL, -- FULL_SNAPSHOT, INCREMENTAL_WAL, TRANSACTION_LOG
    target_storage VARCHAR(100) DEFAULT 'SECURE_ENCRYPTED_VAULT',
    encryption_algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',
    file_size_mb NUMERIC(10,2) NOT NULL,
    sha256_checksum VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'COMPLETED', -- COMPLETED, VERIFIED_RESTORE_READY, RESTORING, ARCHIVED
    rpo_minutes INTEGER DEFAULT 15,
    rto_minutes INTEGER DEFAULT 30,
    initiated_by VARCHAR(150) DEFAULT 'AUTOMATED_DR_ENGINE',
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 6. CONFIGURABLE DATA RETENTION & DELETION RULES
-- =========================================================================
CREATE TABLE IF NOT EXISTS data_retention_rules (
    id SERIAL PRIMARY KEY,
    rule_code VARCHAR(100) UNIQUE NOT NULL,
    data_category VARCHAR(150) NOT NULL,
    retention_period_months INTEGER NOT NULL,
    statutory_reference VARCHAR(255) NOT NULL,
    action_on_expiry VARCHAR(50) DEFAULT 'ANONYMIZE', -- ANONYMIZE, PERMANENT_PURGE, COLD_ARCHIVE
    is_active BOOLEAN DEFAULT TRUE,
    last_executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    records_purged_total INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO data_retention_rules (rule_code, data_category, retention_period_months, statutory_reference, action_on_expiry)
VALUES
    ('RET-PAYROLL-01', 'Payroll & Tax Disbursal Ledger', 84, 'Indian Income Tax Act 1961 Sec 44AA (7 Years Statutory Retention)', 'COLD_ARCHIVE'),
    ('RET-PF-ESI-02', 'PF & ESI Statutory Filings', 84, 'Employees Provident Fund & MP Act 1952 (7 Years)', 'COLD_ARCHIVE'),
    ('RET-CANDIDATES-03', 'Unselected Candidate Applications & Resumes', 12, 'DPDP Act 2023 Sec 8(7) Purpose Limitation (1 Year)', 'PERMANENT_PURGE'),
    ('RET-BIOMETRIC-04', 'Raw Biometric Device Punch Ingestion Logs', 3, 'DPDP Act 2023 Minimization & Internal Physical Security (90 Days)', 'ANONYMIZE'),
    ('RET-NOTIFS-05', 'In-App Notifications & Alert History', 1, 'Data Cleanliness Policy (30 Days)', 'PERMANENT_PURGE'),
    ('RET-EXITS-06', 'Separation & Full and Final Clearance Dockets', 60, 'Industrial Disputes Act / Companies Act (5 Years)', 'COLD_ARCHIVE')
ON CONFLICT (rule_code) DO NOTHING;

-- =========================================================================
-- 7. INDIAN DPDP ACT 2023 PRIVACY CONTROLS & CONSENT REGISTRY
-- =========================================================================
CREATE TABLE IF NOT EXISTS dpdp_consent_logs (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) NOT NULL,
    data_principal_name VARCHAR(150) NOT NULL,
    consent_purpose VARCHAR(100) NOT NULL, -- EMPLOYMENT_ADMINISTRATION, BIOMETRIC_ATTENDANCE, BGV_SCREENING, PAYROLL_BANKING
    notice_version VARCHAR(50) DEFAULT 'v2.4-DPDP-2026',
    is_granted BOOLEAN DEFAULT TRUE,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    withdrawn_at TIMESTAMP,
    ip_address VARCHAR(50) DEFAULT '127.0.0.1',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dpdp_rights_requests (
    id SERIAL PRIMARY KEY,
    request_code VARCHAR(100) UNIQUE NOT NULL,
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    employee_name VARCHAR(150) NOT NULL,
    employee_email VARCHAR(255) NOT NULL,
    request_type VARCHAR(100) NOT NULL, -- RIGHT_TO_ACCESS, RIGHT_TO_CORRECTION, RIGHT_TO_ERASURE, GRIEVANCE_REDRESSAL
    details TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'SUBMITTED', -- SUBMITTED, IN_REVIEW_BY_DPO, COMPLETED, REJECTED
    dpo_assigned VARCHAR(150) DEFAULT 'Adv. Meera Sen (Data Protection Officer)',
    dpo_remarks TEXT DEFAULT '',
    sla_deadline DATE DEFAULT (CURRENT_DATE + INTERVAL '15 days'),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 8. PERIODIC ACCESS REVIEWS & SEPARATION DEPROVISIONING LEDGER
-- =========================================================================
CREATE TABLE IF NOT EXISTS access_review_campaigns (
    id SERIAL PRIMARY KEY,
    campaign_code VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    period VARCHAR(50) NOT NULL,
    reviewer_role VARCHAR(100) DEFAULT 'Security & Compliance Admin',
    total_accounts_reviewed INTEGER DEFAULT 0,
    certified_count INTEGER DEFAULT 0,
    revoked_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'COMPLETED', -- COMPLETED, IN_PROGRESS, SCHEDULED
    deadline_date DATE NOT NULL,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS separation_deprovisioning_logs (
    id SERIAL PRIMARY KEY,
    resignation_id INTEGER REFERENCES resignations(id) ON DELETE SET NULL,
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    employee_name VARCHAR(150) NOT NULL,
    separation_date DATE NOT NULL,
    user_account_status VARCHAR(50) DEFAULT 'DEACTIVATED',
    active_tokens_revoked BOOLEAN DEFAULT TRUE,
    it_assets_reclaimed BOOLEAN DEFAULT TRUE,
    email_access_revoked BOOLEAN DEFAULT TRUE,
    sso_identity_deprovisioned BOOLEAN DEFAULT TRUE,
    deprovisioned_by VARCHAR(150) DEFAULT 'Automated Separation Engine',
    details TEXT DEFAULT 'Immediate access revocation completed upon exit clearance',
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit confirmation query
SELECT '017_security_compliance_governance migration completed successfully' AS status;
