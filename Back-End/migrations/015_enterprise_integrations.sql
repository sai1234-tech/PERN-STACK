-- 015_enterprise_integrations.sql
-- Enterprise PERN HRMS: 8 External Integration Connectors & Sync Telemetry

-- 1. Integration Connectors Configuration Table
CREATE TABLE IF NOT EXISTS integration_connectors (
    id SERIAL PRIMARY KEY,
    connector_key VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    provider VARCHAR(150) NOT NULL,
    protocol VARCHAR(150) NOT NULL,
    endpoint_url VARCHAR(255) DEFAULT '',
    auth_type VARCHAR(50) DEFAULT 'Bearer Token',
    config_data JSONB DEFAULT '{}'::jsonb,
    secret_key VARCHAR(255) DEFAULT '',
    is_enabled BOOLEAN DEFAULT TRUE,
    health_status VARCHAR(50) DEFAULT 'Connected',
    last_sync_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sync_interval_mins INTEGER DEFAULT 60,
    total_sync_count INTEGER DEFAULT 0,
    failed_sync_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Integration Sync Logs & Audit Telemetry
CREATE TABLE IF NOT EXISTS integration_sync_logs (
    id SERIAL PRIMARY KEY,
    connector_key VARCHAR(50) NOT NULL REFERENCES integration_connectors(connector_key) ON DELETE CASCADE,
    job_type VARCHAR(100) NOT NULL,
    direction VARCHAR(20) DEFAULT 'OUTBOUND',
    status VARCHAR(50) DEFAULT 'SUCCESS',
    records_processed INTEGER DEFAULT 0,
    payload_summary TEXT DEFAULT '',
    raw_response JSONB DEFAULT '{}'::jsonb,
    duration_ms INTEGER DEFAULT 120,
    triggered_by VARCHAR(50) DEFAULT 'AUTOMATED_CRON',
    error_message TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Raw Biometric Device Punch Ingestion Logs
CREATE TABLE IF NOT EXISTS biometric_punch_logs (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    terminal_ip VARCHAR(50) DEFAULT '192.168.10.15',
    employee_code VARCHAR(50) NOT NULL,
    punch_time TIMESTAMP NOT NULL,
    punch_type VARCHAR(50) DEFAULT 'CHECK_IN',
    verification_mode VARCHAR(50) DEFAULT 'FACIAL_RECOGNITION',
    is_processed BOOLEAN DEFAULT FALSE,
    attendance_id INTEGER REFERENCES attendance(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Payroll Vendor Transfer Batches (API / SFTP / PGP Encrypted)
CREATE TABLE IF NOT EXISTS payroll_vendor_batches (
    id SERIAL PRIMARY KEY,
    batch_code VARCHAR(100) UNIQUE NOT NULL,
    vendor_name VARCHAR(150) NOT NULL,
    period VARCHAR(50) NOT NULL,
    transfer_method VARCHAR(50) DEFAULT 'SFTP_ENCRYPTED_PGP',
    total_employees INTEGER DEFAULT 0,
    total_gross NUMERIC(14,2) DEFAULT 0,
    total_net NUMERIC(14,2) DEFAULT 0,
    file_checksum VARCHAR(100) DEFAULT '',
    status VARCHAR(50) DEFAULT 'RECONCILED',
    dispatched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reconciled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Finance / ERP General Ledger Journal Batches (SAP / NetSuite)
CREATE TABLE IF NOT EXISTS erp_journal_batches (
    id SERIAL PRIMARY KEY,
    voucher_code VARCHAR(100) UNIQUE NOT NULL,
    erp_system VARCHAR(150) NOT NULL,
    period VARCHAR(50) NOT NULL,
    total_debit NUMERIC(14,2) DEFAULT 0,
    total_credit NUMERIC(14,2) DEFAULT 0,
    cost_centers_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'POSTED',
    erp_reference_doc VARCHAR(100) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. IT Asset & Identity Provisioning Jobs (Jira / Intune / Jamf)
CREATE TABLE IF NOT EXISTS it_asset_provisioning_jobs (
    id SERIAL PRIMARY KEY,
    request_code VARCHAR(100) UNIQUE NOT NULL,
    target_system VARCHAR(150) NOT NULL,
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    employee_name VARCHAR(150) NOT NULL,
    item_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'PROVISIONED',
    assigned_serial_or_license VARCHAR(150) DEFAULT '',
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for high-frequency synchronization telemetry
CREATE INDEX IF NOT EXISTS idx_sync_logs_connector ON integration_sync_logs(connector_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_biometric_unprocessed ON biometric_punch_logs(is_processed, employee_code);
CREATE INDEX IF NOT EXISTS idx_payroll_batches_period ON payroll_vendor_batches(period);
CREATE INDEX IF NOT EXISTS idx_erp_batches_code ON erp_journal_batches(voucher_code);
CREATE INDEX IF NOT EXISTS idx_it_asset_emp ON it_asset_provisioning_jobs(employee_id);
