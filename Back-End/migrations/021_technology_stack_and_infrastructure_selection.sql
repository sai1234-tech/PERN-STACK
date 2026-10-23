-- 021_technology_stack_and_infrastructure_selection.sql
-- Enterprise PERN HRMS: Technology Stack Evaluation, Multi-Cloud Infrastructure & TCO Decision Tables
-- 1. Stack Selection Matrix (Frontend, Backend, Database, Storage, APIs, IdP) evaluated across
--    Internal Engineering Skills, Security Standards, Enterprise Integrations, and Total Cost of Ownership (TCO).
-- 2. Cloud Infrastructure Profiles (AWS, Azure, GCP, Hybrid/On-Premises).
-- 3. Cloud Object Storage Engine (AWS S3, Azure Blob, GCP Cloud Storage, Encrypted Vault).
-- 4. Enterprise Identity Provider Registry (Azure AD / Entra ID, Okta, Keycloak, Google Workspace).
-- 5. Total Cost of Ownership (TCO) & 3-Year Financial Comparison.

-- =========================================================================
-- 1. STACK SELECTION MATRIX
-- =========================================================================
CREATE TABLE IF NOT EXISTS tech_stack_selection_matrix (
    id SERIAL PRIMARY KEY,
    layer_category VARCHAR(100) NOT NULL, -- FRONTEND, BACKEND, DATABASE, OBJECT_STORAGE, API_ARCHITECTURE, IDENTITY_MFA
    technology_name VARCHAR(150) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'EVALUATED', -- SELECTED, CANDIDATE, REJECTED
    overall_score NUMERIC(5,2) NOT NULL, -- Out of 100
    skills_fit_score NUMERIC(5,2) NOT NULL, -- Out of 100 (Internal Engineering Skills)
    security_standards_score NUMERIC(5,2) NOT NULL, -- Out of 100 (Security Standards & Compliance)
    integrations_score NUMERIC(5,2) NOT NULL, -- Out of 100 (Enterprise Integration Capability)
    tco_cost_score NUMERIC(5,2) NOT NULL, -- Out of 100 (Total Cost of Ownership & Zero-License Benefit)
    key_advantages TEXT NOT NULL,
    potential_tradeoffs TEXT NOT NULL,
    architectural_verdict TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tech_stack_layer ON tech_stack_selection_matrix(layer_category, status);

-- =========================================================================
-- 2. MULTI-CLOUD INFRASTRUCTURE PROFILES (AWS, AZURE, GCP)
-- =========================================================================
CREATE TABLE IF NOT EXISTS infrastructure_cloud_profiles (
    id SERIAL PRIMARY KEY,
    cloud_provider VARCHAR(50) UNIQUE NOT NULL, -- AWS, AZURE, GCP, ON_PREM_HYBRID
    provider_name VARCHAR(150) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'READY_FOR_DEPLOYMENT',
    compute_service VARCHAR(150) NOT NULL,
    database_service VARCHAR(150) NOT NULL,
    storage_service VARCHAR(150) NOT NULL,
    networking_service VARCHAR(150) NOT NULL,
    monitoring_service VARCHAR(150) NOT NULL,
    monthly_est_usd NUMERIC(10,2) NOT NULL,
    iac_template_type VARCHAR(50) DEFAULT 'TERRAFORM_HCL',
    high_availability_tier VARCHAR(100) DEFAULT 'Multi-AZ Active/Active Standby',
    deployment_spec JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 3. CLOUD OBJECT STORAGE ENGINE (DOCUMENTS)
-- =========================================================================
CREATE TABLE IF NOT EXISTS cloud_object_storage_providers (
    id SERIAL PRIMARY KEY,
    provider_code VARCHAR(100) UNIQUE NOT NULL, -- AWS_S3_PRIMARY, AZURE_BLOB_SECONDARY, GCP_STORAGE_ARCHIVE, LOCAL_ENCRYPTED_VAULT
    provider_name VARCHAR(150) NOT NULL,
    bucket_or_container_name VARCHAR(150) NOT NULL,
    region VARCHAR(100) NOT NULL DEFAULT 'ap-south-1',
    encryption_algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',
    kms_key_id VARCHAR(150) DEFAULT 'arn:aws:kms:ap-south-1:123456789012:key/hrms-doc-vault',
    endpoint_url VARCHAR(255) DEFAULT 'https://s3.ap-south-1.amazonaws.com/pern-hrms-doc-vault',
    is_active BOOLEAN DEFAULT TRUE,
    supports_signed_urls BOOLEAN DEFAULT TRUE,
    signed_url_ttl_seconds INTEGER DEFAULT 900, -- 15 mins
    storage_class VARCHAR(50) DEFAULT 'STANDARD_INFREQUENT_ACCESS',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 4. ENTERPRISE IDENTITY PROVIDER REGISTRY (SSO / MFA)
-- =========================================================================
CREATE TABLE IF NOT EXISTS idp_sso_configurations (
    id SERIAL PRIMARY KEY,
    idp_code VARCHAR(100) UNIQUE NOT NULL, -- AZURE_AD_ENTRA, OKTA_ENTERPRISE, KEYCLOAK_IAM, GOOGLE_WORKSPACE
    idp_name VARCHAR(150) NOT NULL,
    protocol VARCHAR(50) NOT NULL DEFAULT 'OIDC_OAUTH2', -- SAML_2_0, OIDC_OAUTH2, HYBRID
    issuer_url VARCHAR(255) NOT NULL,
    client_id VARCHAR(150) NOT NULL,
    discovery_endpoint VARCHAR(255) NOT NULL,
    enforce_mfa BOOLEAN DEFAULT TRUE,
    mfa_method VARCHAR(100) DEFAULT 'TOTP_OR_FIDO2_WEBAUTHN',
    scim_provisioning_supported BOOLEAN DEFAULT TRUE,
    status VARCHAR(50) DEFAULT 'ACTIVE_PRODUCTION',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 5. TOTAL COST OF OWNERSHIP (TCO) FINANCIAL COMPARISON
-- =========================================================================
CREATE TABLE IF NOT EXISTS tco_financial_comparisons (
    id SERIAL PRIMARY KEY,
    stack_option_name VARCHAR(150) UNIQUE NOT NULL,
    stack_tier VARCHAR(100) NOT NULL, -- SELECTED_PERN_OPEN_SOURCE, PROPRIETARY_MICROSOFT_ENTERPRISE, PROPRIETARY_ORACLE_JAVA
    year_1_cost_usd NUMERIC(12,2) NOT NULL,
    year_2_cost_usd NUMERIC(12,2) NOT NULL,
    year_3_cost_usd NUMERIC(12,2) NOT NULL,
    total_3yr_tco_usd NUMERIC(12,2) NOT NULL,
    total_savings_vs_proprietary_usd NUMERIC(12,2) NOT NULL,
    license_costs_annual_usd NUMERIC(12,2) NOT NULL,
    infrastructure_cloud_annual_usd NUMERIC(12,2) NOT NULL,
    developer_maintenance_annual_usd NUMERIC(12,2) NOT NULL,
    notes TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT '021_technology_stack_and_infrastructure_selection migration schema initialized' AS status;
