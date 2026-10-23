import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log("=== EXECUTING MIGRATION 021_TECHNOLOGY_STACK_AND_INFRASTRUCTURE_SELECTION.SQL ===");
  const sqlPath = path.join(__dirname, "../migrations/021_technology_stack_and_infrastructure_selection.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  await pool.query(sql);
  console.log("✓ Migration 021 tables created successfully in PostgreSQL!\n");

  console.log("Seeding technology stack matrix, multi-cloud profiles, and TCO financial models...");

  // 1. Seed Stack Selection Matrix
  const matrixCheck = await pool.query("SELECT count(*) FROM tech_stack_selection_matrix");
  if (parseInt(matrixCheck.rows[0].count, 10) === 0) {
    const matrix = [
      // Frontend
      {
        cat: "FRONTEND",
        name: "React 18 + Vite (Selected)",
        status: "SELECTED",
        overall: 96.5,
        skills: 98.0,
        sec: 94.0,
        intg: 96.0,
        tco: 98.0,
        adv: "Single language (JS/TS) across frontend and backend; immense enterprise component ecosystem; ultra-fast Vite HMR; easy onboarding for web engineers.",
        trade: "Requires disciplined state management patterns; virtual DOM overhead minimal but present.",
        verdict: "SELECTED: Maximizes engineering team velocity with zero context-switching and lowest TCO."
      },
      {
        cat: "FRONTEND",
        name: "Angular 17",
        status: "CANDIDATE",
        overall: 84.0,
        skills: 76.0,
        sec: 95.0,
        intg: 88.0,
        tco: 77.0,
        adv: "Strict opinionated structure; built-in dependency injection, form validation, and routing.",
        trade: "Heavy boilerplate; steeper learning curve; slower developer iteration speed for modern dynamic UIs.",
        verdict: "CANDIDATE: Solid framework but higher training overhead and slower feature delivery compared to React."
      },
      {
        cat: "FRONTEND",
        name: "Vue 3",
        status: "CANDIDATE",
        overall: 82.5,
        skills: 72.0,
        sec: 91.0,
        intg: 82.0,
        tco: 85.0,
        adv: "Intuitive template syntax, excellent reactivity system, gentle learning curve.",
        trade: "Smaller enterprise talent pool and fewer pre-built accessible enterprise design components.",
        verdict: "CANDIDATE: Viable alternative but talent market availability in India/global favors React."
      },

      // Backend
      {
        cat: "BACKEND",
        name: "Node.js + Express (Selected)",
        status: "SELECTED",
        overall: 95.8,
        skills: 98.0,
        sec: 93.5,
        intg: 96.5,
        tco: 95.0,
        adv: "Event-driven asynchronous I/O ideal for real-time SSE synchronization, high-concurrency microservices, shared models/validators with frontend, and lightweight container footprint (< 120MB).",
        trade: "CPU-intensive calculations require worker threads or separate compute clusters.",
        verdict: "SELECTED: Delivers maximum developer synergy with React, ultra-low memory overhead, and proven 1,200+ RPS."
      },
      {
        cat: "BACKEND",
        name: "Java 21 + Spring Boot 3",
        status: "CANDIDATE",
        overall: 86.5,
        skills: 82.0,
        sec: 96.0,
        intg: 91.0,
        tco: 77.0,
        adv: "Robust typing, mature enterprise ORM (Hibernate), extensive legacy ERP connectors.",
        trade: "Substantial memory consumption (JVM baseline 1.5GB+ per instance), longer cold starts, commercial Oracle JDK licensing risks, dual-language stack overhead.",
        verdict: "CANDIDATE: Enterprise standard but increases cloud compute and developer context switching costs."
      },
      {
        cat: "BACKEND",
        name: ".NET 8 Core / C#",
        status: "CANDIDATE",
        overall: 85.0,
        skills: 75.0,
        sec: 94.0,
        intg: 88.0,
        tco: 83.0,
        adv: "High raw execution performance, excellent Azure cloud integration, clean language design.",
        trade: "Talent pool bifurcation between JS frontend and C# backend, lingering Windows Server licensing biases.",
        verdict: "CANDIDATE: High performance but introduces dual-stack complexity without tangible advantages over Node.js."
      },

      // Database
      {
        cat: "DATABASE",
        name: "PostgreSQL 16 (Selected)",
        status: "SELECTED",
        overall: 98.2,
        skills: 96.0,
        sec: 98.0,
        intg: 99.0,
        tco: 100.0,
        adv: "Premier open-source relational database; unparalleled JSONB capabilities for semi-structured document dockets & effective-dated payloads; full ACID transactions; zero license fees; native multi-cloud availability (AWS RDS/Aurora, Azure Flexible, GCP Cloud SQL).",
        trade: "Requires DBA tuning for high-concurrency connection pooling (PgBouncer/pg-pool).",
        verdict: "SELECTED: Absolute best-in-class database with zero commercial license tax and maximum enterprise capability."
      },
      {
        cat: "DATABASE",
        name: "Microsoft SQL Server Enterprise",
        status: "REJECTED",
        overall: 78.5,
        skills: 78.0,
        sec: 94.0,
        intg: 82.0,
        tco: 60.0,
        adv: "Familiar enterprise database with deep integration with legacy Active Directory.",
        trade: "Extremely expensive core licensing ($14,000+ per 2-core pack), heavy infrastructure footprint, vendor lock-in.",
        verdict: "REJECTED: Unjustifiable multi-hundred-thousand-dollar licensing cost with zero capability gain over PostgreSQL."
      },
      {
        cat: "DATABASE",
        name: "MySQL 8",
        status: "CANDIDATE",
        overall: 81.0,
        skills: 88.0,
        sec: 84.0,
        intg: 80.0,
        tco: 72.0,
        adv: "Widespread availability, fast simple read throughput.",
        trade: "Inferior JSON querying/indexing compared to PostgreSQL JSONB; less mature temporal history & audit functions.",
        verdict: "CANDIDATE: Lacks PostgreSQL's advanced JSONB and analytical window functions required for complex HRMS."
      },

      // Storage
      {
        cat: "OBJECT_STORAGE",
        name: "Cloud Object Storage (S3 API Compatible)",
        status: "SELECTED",
        overall: 96.0,
        skills: 95.0,
        sec: 98.0,
        intg: 97.0,
        tco: 94.0,
        adv: "Virtually infinite document capacity; server-side AES-256-GCM encryption; time-limited presigned URLs (15-minute expiry); lifecycle tiering to Glacier/Cold storage.",
        trade: "Egress bandwidth costs must be budgeted for high-volume exports.",
        verdict: "SELECTED: Industry standard for secure statutory document dossiers, resumes, and payslips."
      },

      // API
      {
        cat: "API_ARCHITECTURE",
        name: "RESTful JSON APIs + OpenAPI 3.0",
        status: "SELECTED",
        overall: 97.0,
        skills: 98.0,
        sec: 96.0,
        intg: 99.0,
        tco: 95.0,
        adv: "Predictable caching, universal interoperability with external HR/Finance ERPs, sliding-window rate limiting, and automated Swagger documentation.",
        trade: "Multiple roundtrips if poorly structured; mitigated by dedicated overview endpoints.",
        verdict: "SELECTED: Optimal enterprise standard for internal UI and external 8-channel integration hub."
      },

      // Identity & Auth
      {
        cat: "IDENTITY_MFA",
        name: "Enterprise IdP SSO (SAML 2.0 / OIDC) + Step-Up MFA",
        status: "SELECTED",
        overall: 96.5,
        skills: 92.0,
        sec: 99.0,
        intg: 97.0,
        tco: 98.0,
        adv: "Centralized user identity management via Azure AD (Microsoft Entra ID), Okta, Keycloak, or Google Workspace; TOTP/FIDO2 MFA for privileged operations; zero-day deprovisioning.",
        trade: "Requires IdP tenant federation setup with corporate directory.",
        verdict: "SELECTED: Fully satisfies least-privilege RBAC, SOC 2, and Indian DPDP Act 2023 security mandates."
      }
    ];

    for (const m of matrix) {
      await pool.query(`
        INSERT INTO tech_stack_selection_matrix (
          layer_category, technology_name, status, overall_score,
          skills_fit_score, security_standards_score, integrations_score, tco_cost_score,
          key_advantages, potential_tradeoffs, architectural_verdict
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [m.cat, m.name, m.status, m.overall, m.skills, m.sec, m.intg, m.tco, m.adv, m.trade, m.verdict]);
    }
    console.log("✓ Seeded Technology Stack Selection Matrix");
  }

  // 2. Seed Multi-Cloud Infrastructure Profiles
  const cloudCheck = await pool.query("SELECT count(*) FROM infrastructure_cloud_profiles");
  if (parseInt(cloudCheck.rows[0].count, 10) === 0) {
    const profiles = [
      {
        provider: "AWS",
        name: "Amazon Web Services (AWS Multi-AZ)",
        compute: "AWS ECS Fargate (Serverless Containers)",
        db: "Amazon RDS for PostgreSQL (Multi-AZ Standby)",
        storage: "Amazon S3 Standard + Glacier Lifecycle",
        network: "Amazon CloudFront CDN + AWS WAF + VPC",
        monitoring: "Amazon CloudWatch + AWS X-Ray Tracing",
        cost: 485.00,
        ha: "Multi-AZ Active/Active Standby (99.99%)",
        spec: {
          region: "ap-south-1 (Mumbai)",
          db_instance: "db.r6g.large (Multi-AZ)",
          ecs_tasks: "2-10 Autoscale Containers",
          s3_bucket: "pern-hrms-production-vault-ap-south-1"
        }
      },
      {
        provider: "AZURE",
        name: "Microsoft Azure Enterprise",
        compute: "Azure App Service / Azure Kubernetes Service (AKS)",
        db: "Azure Database for PostgreSQL Flexible Server",
        storage: "Azure Blob Storage (ZRS Zone-Redundant)",
        network: "Azure Front Door + Azure Web Application Firewall",
        monitoring: "Azure Monitor + Application Insights",
        cost: 520.00,
        ha: "Zone-Redundant High Availability",
        spec: {
          region: "Central India (Pune)",
          db_tier: "Standard_D4ds_v5 Flexible",
          container_replicas: "2-8 Autoscale Nodes",
          blob_container: "pern-hrms-doc-store-centralindia"
        }
      },
      {
        provider: "GCP",
        name: "Google Cloud Platform (GCP)",
        compute: "Google Cloud Run / Google Kubernetes Engine (GKE)",
        db: "Cloud SQL for PostgreSQL (Regional HA)",
        storage: "Google Cloud Storage (Multi-Region Bucket)",
        network: "Cloud Armor + Cloud CDN + VPC",
        monitoring: "Cloud Logging + Cloud Monitoring (Stackdriver)",
        cost: 465.00,
        ha: "Regional Multi-Zone HA Failover",
        spec: {
          region: "asia-south1 (Mumbai)",
          db_machine: "db-custom-4-16384 Regional",
          cloud_run_instances: "2-10 Auto-provisioned Instances",
          gcs_bucket: "pern-hrms-enterprise-vault-mumbai"
        }
      },
      {
        provider: "ON_PREM_HYBRID",
        name: "Private Data Center / Hybrid Kubernetes",
        compute: "Self-Hosted Kubernetes (K8s) / Docker Swarm",
        db: "PostgreSQL 16 HA Cluster with Patroni & HAProxy",
        storage: "MinIO S3-Compatible Enterprise Object Vault",
        network: "NGINX Ingress Controller + Hardware Firewalls",
        monitoring: "Prometheus + Grafana + OpenTelemetry",
        cost: 280.00,
        ha: "Local Hot-Standby Physical Replication",
        spec: {
          topology: "Dual Bare-Metal Dell PowerEdge R650 Nodes",
          db_storage: "NVMe RAID-10 ZFS Pool",
          minio_nodes: "4-Drive Distributed Object Storage",
          backup_storage: "Encrypted Offsite NAS + Cloud Mirror"
        }
      }
    ];

    for (const p of profiles) {
      await pool.query(`
        INSERT INTO infrastructure_cloud_profiles (
          cloud_provider, provider_name, compute_service, database_service,
          storage_service, networking_service, monitoring_service, monthly_est_usd,
          high_availability_tier, deployment_spec
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [p.provider, p.name, p.compute, p.db, p.storage, p.network, p.monitoring, p.cost, p.ha, JSON.stringify(p.spec)]);
    }
    console.log("✓ Seeded Multi-Cloud Infrastructure Profiles");
  }

  // 3. Seed Cloud Object Storage Providers
  const storageCheck = await pool.query("SELECT count(*) FROM cloud_object_storage_providers");
  if (parseInt(storageCheck.rows[0].count, 10) === 0) {
    const providers = [
      {
        code: "AWS_S3_PRIMARY",
        name: "Amazon S3 Secure Object Vault (Primary)",
        bucket: "pern-hrms-doc-vault-ap-south-1",
        region: "ap-south-1 (Mumbai)",
        enc: "AES-256-GCM (AWS-KMS)",
        url: "https://s3.ap-south-1.amazonaws.com/pern-hrms-doc-vault-ap-south-1",
        active: true
      },
      {
        code: "AZURE_BLOB_SECONDARY",
        name: "Azure Blob Storage (Secondary DR Mirror)",
        bucket: "pern-hrms-doc-mirror",
        region: "Central India (Pune)",
        enc: "AES-256-GCM (Azure Key Vault)",
        url: "https://pernhrmsstorage.blob.core.windows.net/documents",
        active: true
      },
      {
        code: "LOCAL_ENCRYPTED_VAULT",
        name: "Local On-Premises AES-256 Encrypted Vault (Dev/Airgapped)",
        bucket: "uploads/documents",
        region: "Local Secure Server Storage",
        enc: "AES-256-GCM (Node.js Crypto)",
        url: "http://127.0.0.1:5005/uploads/documents",
        active: true
      }
    ];

    for (const s of providers) {
      await pool.query(`
        INSERT INTO cloud_object_storage_providers (
          provider_code, provider_name, bucket_or_container_name, region,
          encryption_algorithm, endpoint_url, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [s.code, s.name, s.bucket, s.region, s.enc, s.url, s.active]);
    }
    console.log("✓ Seeded Cloud Object Storage Providers");
  }

  // 4. Seed Enterprise Identity Provider Registry (SSO / MFA)
  const idpCheck = await pool.query("SELECT count(*) FROM idp_sso_configurations");
  if (parseInt(idpCheck.rows[0].count, 10) === 0) {
    const idps = [
      {
        code: "AZURE_AD_ENTRA",
        name: "Microsoft Entra ID (Azure Active Directory)",
        proto: "OIDC_OAUTH2",
        issuer: "https://login.microsoftonline.com/common/v2.0",
        clientId: "pern-hrms-azure-ad-client-prod",
        discovery: "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",
        mfa: true,
        mfaMethod: "Microsoft Authenticator / FIDO2",
        status: "ACTIVE_PRODUCTION"
      },
      {
        code: "OKTA_ENTERPRISE",
        name: "Okta Enterprise Workforce Identity",
        proto: "SAML_2_0",
        issuer: "https://company.okta.com/app/pern_hrms",
        clientId: "pern-hrms-okta-app-01",
        discovery: "https://company.okta.com/.well-known/openid-configuration",
        mfa: true,
        mfaMethod: "Okta Verify / WebAuthn Biometric",
        status: "ACTIVE_PRODUCTION"
      },
      {
        code: "KEYCLOAK_IAM",
        name: "Keycloak Open-Source Identity & Access Management",
        proto: "OIDC_OAUTH2",
        issuer: "https://iam.company.internal/realms/enterprise-hrms",
        clientId: "pern-hrms-client",
        discovery: "https://iam.company.internal/realms/enterprise-hrms/.well-known/openid-configuration",
        mfa: true,
        mfaMethod: "FreeOTP / Google Authenticator TOTP",
        status: "ACTIVE_PRODUCTION"
      },
      {
        code: "GOOGLE_WORKSPACE",
        name: "Google Workspace Enterprise Identity",
        proto: "OIDC_OAUTH2",
        issuer: "https://accounts.google.com",
        clientId: "pern-hrms-google-oauth-prod.apps.googleusercontent.com",
        discovery: "https://accounts.google.com/.well-known/openid-configuration",
        mfa: true,
        mfaMethod: "Google Prompt / Titan Security Key",
        status: "ACTIVE_PRODUCTION"
      }
    ];

    for (const i of idps) {
      await pool.query(`
        INSERT INTO idp_sso_configurations (
          idp_code, idp_name, protocol, issuer_url, client_id,
          discovery_endpoint, enforce_mfa, mfa_method, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [i.code, i.name, i.proto, i.issuer, i.clientId, i.discovery, i.mfa, i.mfaMethod, i.status]);
    }
    console.log("✓ Seeded Enterprise Identity Provider Registry");
  }

  // 5. Seed Total Cost of Ownership (TCO) Comparison Models
  const tcoCheck = await pool.query("SELECT count(*) FROM tco_financial_comparisons");
  if (parseInt(tcoCheck.rows[0].count, 10) === 0) {
    const tcoModels = [
      {
        name: "Selected PERN Stack (React + Node.js + PostgreSQL)",
        tier: "SELECTED_PERN_OPEN_SOURCE",
        y1: 64200.00,
        y2: 66800.00,
        y3: 69400.00,
        tco3yr: 200400.00,
        savings: 574100.00,
        licAnnual: 0.00,
        cloudAnnual: 6000.00,
        devAnnual: 58200.00,
        notes: "Zero database license fees; open-source React & Node.js ecosystem; shared TypeScript/JavaScript codebase yields 35% faster feature turnaround."
      },
      {
        name: "Proprietary Microsoft Stack (.NET + MS SQL Server Enterprise + Azure)",
        tier: "PROPRIETARY_MICROSOFT_ENTERPRISE",
        y1: 248500.00,
        y2: 258000.00,
        y3: 268000.00,
        tco3yr: 774500.00,
        savings: 0.00,
        licAnnual: 112000.00,
        cloudAnnual: 18500.00,
        devAnnual: 118000.00,
        notes: "Heavy recurring per-core SQL Server Enterprise licensing ($14,000+ per 2 cores); Windows Server CAL fees; dual-stack developer staffing costs."
      },
      {
        name: "Enterprise Java Stack (Spring Boot + Oracle Database Enterprise)",
        tier: "PROPRIETARY_ORACLE_JAVA",
        y1: 295000.00,
        y2: 305000.00,
        y3: 320000.00,
        tco3yr: 920000.00,
        savings: 0.00,
        licAnnual: 145000.00,
        cloudAnnual: 22000.00,
        devAnnual: 128000.00,
        notes: "Oracle DB processor licensing ($47,500/core); Oracle commercial Java SE subscription charges; JVM container compute sizing penalties."
      }
    ];

    for (const t of tcoModels) {
      await pool.query(`
        INSERT INTO tco_financial_comparisons (
          stack_option_name, stack_tier, year_1_cost_usd, year_2_cost_usd,
          year_3_cost_usd, total_3yr_tco_usd, total_savings_vs_proprietary_usd,
          license_costs_annual_usd, infrastructure_cloud_annual_usd, developer_maintenance_annual_usd, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [t.name, t.tier, t.y1, t.y2, t.y3, t.tco3yr, t.savings, t.licAnnual, t.cloudAnnual, t.devAnnual, t.notes]);
    }
    console.log("✓ Seeded TCO Financial Comparison Models");
  }

  console.log("\n========================================================");
  console.log("✅ 021 MIGRATION & SEEDING COMPLETED SUCCESSFULLY!");
  console.log("========================================================");
  process.exit(0);
}

run().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
