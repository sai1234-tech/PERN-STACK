-- 024_data_migration_and_ingestion.sql
-- Enterprise PERN HRMS: Legacy Data Migration & Ingestion Engine
-- Covers:
-- 1. Legacy Sources Tracking (Excel, Biometric, Payroll, ATS, BGV, Documents) with AES-256-GCM & SHA-256
-- 2. Source-to-Target Field Mapping Registry
-- 3. Migration Jobs (Trial / Final Runs)
-- 4. Deduplication Logs (Merge & Conflict Resolution)
-- 5. Mandatory Field Validation Errors Catalog
-- 6. Financial, Headcount & Record Reconciliation Reports
-- 7. HR / Business Sign-Off Gate Ledger

CREATE TABLE IF NOT EXISTS migration_sources (
    id SERIAL PRIMARY KEY,
    source_code VARCHAR(50) UNIQUE NOT NULL,
    source_name VARCHAR(150) NOT NULL,
    source_category VARCHAR(50) NOT NULL, -- EMPLOYEE, ATTENDANCE, PAYROLL, ATS, BGV, DOCUMENTS
    file_name VARCHAR(255) NOT NULL,
    file_format VARCHAR(20) NOT NULL DEFAULT 'CSV',
    file_path VARCHAR(255),
    file_checksum VARCHAR(100) NOT NULL,
    encryption_algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',
    is_encrypted BOOLEAN DEFAULT TRUE,
    total_records INTEGER DEFAULT 0,
    identified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS migration_field_mappings (
    id SERIAL PRIMARY KEY,
    source_category VARCHAR(50) NOT NULL,
    source_field VARCHAR(100) NOT NULL,
    target_table VARCHAR(100) NOT NULL,
    target_column VARCHAR(100) NOT NULL,
    data_type VARCHAR(50) NOT NULL DEFAULT 'VARCHAR',
    is_mandatory BOOLEAN DEFAULT FALSE,
    transformation_rule VARCHAR(150) DEFAULT 'DIRECT_COPY',
    default_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_src_tgt UNIQUE(source_category, source_field, target_table, target_column)
);

CREATE TABLE IF NOT EXISTS migration_jobs (
    id SERIAL PRIMARY KEY,
    job_code VARCHAR(100) UNIQUE NOT NULL,
    job_type VARCHAR(20) NOT NULL DEFAULT 'TRIAL', -- TRIAL, FINAL
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, VALIDATING, DEDUPLICATING, RECONCILED, SIGNED_OFF, COMPLETED, FAILED
    total_source_records INTEGER DEFAULT 0,
    valid_records INTEGER DEFAULT 0,
    duplicate_records INTEGER DEFAULT 0,
    error_records INTEGER DEFAULT 0,
    migrated_records INTEGER DEFAULT 0,
    reconciliation_status VARCHAR(50) DEFAULT 'NOT_RUN', -- NOT_RUN, BALANCED, VARIANCE_DETECTED
    executed_by VARCHAR(150) DEFAULT 'System Admin',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    summary JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS migration_deduplication_logs (
    id SERIAL PRIMARY KEY,
    job_code VARCHAR(100) NOT NULL REFERENCES migration_jobs(job_code) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL DEFAULT 'EMPLOYEE',
    match_key VARCHAR(100) NOT NULL, -- PAN_EXACT_MATCH, EMAIL_MATCH, AADHAAR_MATCH, NAME_DOB_FUZZY
    match_value VARCHAR(150) NOT NULL,
    retained_record_id VARCHAR(100) NOT NULL,
    duplicate_record_id VARCHAR(100) NOT NULL,
    resolution_strategy VARCHAR(50) NOT NULL DEFAULT 'MERGE_PRESERVE_NEWEST',
    resolution_details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS migration_validation_errors (
    id SERIAL PRIMARY KEY,
    job_code VARCHAR(100) NOT NULL REFERENCES migration_jobs(job_code) ON DELETE CASCADE,
    source_code VARCHAR(50) NOT NULL,
    row_index INTEGER NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    rejected_value TEXT,
    error_code VARCHAR(100) NOT NULL,
    severity VARCHAR(20) DEFAULT 'ERROR',
    remediation_tip TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS migration_reconciliation_reports (
    id SERIAL PRIMARY KEY,
    job_code VARCHAR(100) NOT NULL REFERENCES migration_jobs(job_code) ON DELETE CASCADE,
    metric_category VARCHAR(100) NOT NULL,
    source_value NUMERIC(16,2) NOT NULL,
    target_value NUMERIC(16,2) NOT NULL,
    variance NUMERIC(16,2) GENERATED ALWAYS AS (source_value - target_value) STORED,
    reconciliation_status VARCHAR(50) NOT NULL DEFAULT 'BALANCED',
    audit_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS migration_signoffs (
    id SERIAL PRIMARY KEY,
    job_code VARCHAR(100) NOT NULL REFERENCES migration_jobs(job_code) ON DELETE CASCADE,
    signoff_stage VARCHAR(50) NOT NULL DEFAULT 'FINAL_MIGRATION_APPROVAL',
    approver_name VARCHAR(150) NOT NULL,
    approver_email VARCHAR(150) NOT NULL,
    approver_role VARCHAR(50) NOT NULL,
    decision VARCHAR(50) NOT NULL DEFAULT 'APPROVED',
    signature_hash VARCHAR(128) NOT NULL,
    comments TEXT,
    signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for lightning-fast queries
CREATE INDEX IF NOT EXISTS idx_mig_jobs_status ON migration_jobs(status);
CREATE INDEX IF NOT EXISTS idx_mig_jobs_code ON migration_jobs(job_code);
CREATE INDEX IF NOT EXISTS idx_mig_val_job ON migration_validation_errors(job_code);
CREATE INDEX IF NOT EXISTS idx_mig_dedup_job ON migration_deduplication_logs(job_code);
CREATE INDEX IF NOT EXISTS idx_mig_recon_job ON migration_reconciliation_reports(job_code);
CREATE INDEX IF NOT EXISTS idx_mig_signoff_job ON migration_signoffs(job_code);
