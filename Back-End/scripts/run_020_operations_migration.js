import "dotenv/config";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log("=== EXECUTING MIGRATION 020_ENTERPRISE_ARCHITECTURE_NFR_OPERATIONS.SQL ===");
  const sqlPath = path.join(__dirname, "../migrations/020_enterprise_architecture_nfr_operations.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  await pool.query(sql);
  console.log("✓ Migration 020 tables created successfully in PostgreSQL!\n");

  console.log("Seeding realistic enterprise operations, NFR benchmarks & monitoring records...");

  // 1. Performance SLA Targets
  const perfCheck = await pool.query("SELECT count(*) FROM performance_sla_targets");
  if (parseInt(perfCheck.rows[0].count, 10) === 0) {
    const targets = [
      { name: "Employee Authentication & JWT Issuance", module: "Auth", method: "POST", endpoint: "/api/auth/login", p50: 60, p95: 180, p99: 350, max: 800, tps: 800, cur_p50: 42, cur_p95: 110, cur_p99: 195 },
      { name: "Attendance Real-Time Clock In/Out", module: "Attendance", method: "POST", endpoint: "/api/attendance/clock-in", p50: 50, p95: 150, p99: 300, max: 700, tps: 1200, cur_p50: 38, cur_p95: 85, cur_p99: 140 },
      { name: "Monthly Payroll Calculation & Cut-off", module: "Payroll", method: "POST", endpoint: "/api/automations/cutoff/execute", p50: 120, p95: 350, p99: 700, max: 1500, tps: 200, cur_p50: 95, cur_p95: 240, cur_p99: 420 },
      { name: "Core Database Entities Universal Query", module: "Entities", method: "GET", endpoint: "/api/entities/:name", p50: 70, p95: 220, p99: 450, max: 1000, tps: 600, cur_p50: 48, cur_p95: 135, cur_p99: 230 },
      { name: "Sensitive Document Preview & Watermarking", module: "Documents", method: "POST", endpoint: "/api/audit-governance/documents/evaluate-access", p50: 40, p95: 120, p99: 250, max: 600, tps: 500, cur_p50: 25, cur_p95: 75, cur_p99: 120 },
      { name: "Leave Request Submission & Quota Calculation", module: "Leaves", method: "POST", endpoint: "/api/leaves", p50: 80, p95: 250, p99: 500, max: 1000, tps: 400, cur_p50: 52, cur_p95: 145, cur_p99: 260 }
    ];

    for (const t of targets) {
      await pool.query(`
        INSERT INTO performance_sla_targets (
          transaction_name, module, http_method, endpoint_pattern,
          target_p50_ms, target_p95_ms, target_p99_ms, max_acceptable_ms, target_tps,
          current_p50_ms, current_p95_ms, current_p99_ms, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'OPTIMAL')
      `, [t.name, t.module, t.method, t.endpoint, t.p50, t.p95, t.p99, t.max, t.tps, t.cur_p50, t.cur_p95, t.cur_p99]);
    }

    // Seed load test run
    await pool.query(`
      INSERT INTO performance_load_test_runs (
        test_run_code, test_scenario, concurrent_users, duration_seconds,
        total_requests, successful_requests, failed_requests, throughput_rps,
        min_response_ms, avg_response_ms, p50_response_ms, p95_response_ms, p99_response_ms, max_response_ms,
        error_rate_pct, load_profile, system_cpu_peak_pct, system_memory_peak_mb, status
      ) VALUES (
        'LOAD-202610-001', 'Peak Payroll & Morning Clock-In Load Simulation',
        250, 120, 18500, 18498, 2, 154.16,
        18.4, 58.2, 49.0, 115.5, 230.8, 480.0,
        0.01, 'PEAK_HOUR_SPIKE', 42.8, 910.4, 'PASSED'
      );
    `);
    console.log("✓ Seeded Performance SLA targets and load test runs");
  }

  // 2. Availability SLA Tiers & Health
  const availCheck = await pool.query("SELECT count(*) FROM availability_sla_tiers");
  if (parseInt(availCheck.rows[0].count, 10) === 0) {
    const tiers = [
      { name: "Tier 1: Core HR & Payroll Engine", criticality: "MISSION_CRITICAL", target: 99.99, actual30: 99.992, actual90: 99.988, down30: 3, mtbf: 720, mttr: 3.5 },
      { name: "Tier 2: Employee & Manager Self-Service", criticality: "BUSINESS_OPERATIONAL", target: 99.95, actual30: 99.981, actual90: 99.974, down30: 8, mtbf: 480, mttr: 4.8 },
      { name: "Tier 3: Executive Reports & BI Analytics", criticality: "ADMINISTRATIVE", target: 99.90, actual30: 99.965, actual90: 99.955, down30: 15, mtbf: 360, mttr: 8.0 }
    ];

    for (const a of tiers) {
      await pool.query(`
        INSERT INTO availability_sla_tiers (
          tier_name, business_criticality, target_uptime_pct, actual_uptime_30d_pct, actual_uptime_90d_pct,
          total_downtime_minutes_30d, mtbf_hours, mttr_minutes, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'HEALTHY')
      `, [a.name, a.criticality, a.target, a.actual30, a.actual90, a.down30, a.mtbf, a.mttr]);
    }

    await pool.query(`
      INSERT INTO availability_incidents (
        incident_code, affected_component, severity, started_at, resolved_at,
        duration_minutes, root_cause, remediation_action, status
      ) VALUES (
        'INC-202610-001', 'FILE_VAULT_ENCRYPTION_POOL', 'P3_MINOR',
        NOW() - INTERVAL '4 days 2 hours', NOW() - INTERVAL '4 days 1 hour 54 minutes',
        6, 'Ephemeral connection socket timeout during simultaneous S3 certificate renegotiation',
        'Updated connection pool keep-alive timeout to 60s and enabled fallback retry circuit breaker',
        'RESOLVED'
      );
    `);
    console.log("✓ Seeded Availability SLA tiers and incident logs");
  }

  // 3. Scalability Capacity Metrics
  const scaleCheck = await pool.query("SELECT count(*) FROM scalability_capacity_metrics");
  if (parseInt(scaleCheck.rows[0].count, 10) === 0) {
    const empCount = (await pool.query("SELECT count(*) FROM employees")).rows[0].count;
    const docCount = (await pool.query("SELECT count(*) FROM employee_documents")).rows[0].count;

    const metrics = [
      { dim: "ACTIVE_EMPLOYEES", unit: "Headcount", cur: Number(empCount) || 142, limit: 100000, proj: 25000, strat: "Multi-tenant Sharding & PostgreSQL Partitioning by Org Unit" },
      { dim: "CLIENT_ACCOUNTS", unit: "Enterprises", cur: 18, limit: 10000, proj: 250, strat: "Dedicated Client Schema Isolation & Multi-Region VPC" },
      { dim: "STORED_DOCUMENTS", unit: "Files", cur: Number(docCount) || 1540, limit: 10000000, proj: 2500000, strat: "Encrypted Cloud Object Storage with Dynamic Content Tiering" },
      { dim: "DAILY_TRANSACTIONS", unit: "Requests/Day", cur: 48200, limit: 50000000, proj: 5000000, strat: "Horizontal API Gateway Scaling & Read-Replica Load Balancing" },
      { dim: "DB_STORAGE_GB", unit: "Gigabytes", cur: 14.5, limit: 2000.0, proj: 120.0, strat: "Automated Cold-Data Archival to Glacier & WAL Compression" }
    ];

    for (const m of metrics) {
      await pool.query(`
        INSERT INTO scalability_capacity_metrics (
          metric_dimension, unit_of_measure, current_value, capacity_limit,
          projected_12m_growth, scale_strategy, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'NORMAL')
      `, [m.dim, m.unit, m.cur, m.limit, m.proj, m.strat]);
    }
    console.log("✓ Seeded Scalability capacity metrics");
  }

  // 4. Security Vulnerability Register
  const secCheck = await pool.query("SELECT count(*) FROM security_vulnerability_register");
  if (parseInt(secCheck.rows[0].count, 10) === 0) {
    const vulns = [
      { code: "SEC-OWASP-01", cat: "OWASP_A01_BROKEN_ACCESS", sev: "CRITICAL", comp: "Document Download Controller", desc: "Enforce category-level preview vs download role separation to prevent unauthorized ID extraction", cve: "CWE-285", rem: "Added document_governance_policies table with strict server-side download role verification" },
      { code: "SEC-OWASP-02", cat: "OWASP_A02_CRYPTO_FAILURES", sev: "HIGH", comp: "Statutory Identity Vault", desc: "Aadhaar, PAN and Bank Account numbers exposed in plain text to non-privileged roles", cve: "CWE-312", rem: "Implemented AES-256-GCM cipher encryption at rest with dynamic client-side masking policies" },
      { code: "SEC-OWASP-03", cat: "OWASP_A03_INJECTION", sev: "HIGH", comp: "PostgreSQL Database Layer", desc: "Potential SQL injection vulnerability via raw string interpolation in filter queries", cve: "CWE-89", rem: "Refactored 100% of database queries to parameterized inputs ($1, $2, $3) using pg pool" },
      { code: "SEC-OWASP-04", cat: "OWASP_A05_SECURITY_MISCONFIG", sev: "MEDIUM", comp: "Express Gateway Headers", desc: "Missing HTTP Strict Transport Security (HSTS) and Content Security Policy headers", cve: "CWE-16", rem: "Integrated securityMiddleware with strict HSTS (1 year), X-Frame-Options DENY, and X-Content-Type-Options" }
    ];

    for (const v of vulns) {
      await pool.query(`
        INSERT INTO security_vulnerability_register (
          vulnerability_code, category, severity, component, description,
          cve_reference, remediation_guideline, status, remediated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'REMEDIATED', NOW() - INTERVAL '1 day')
      `, [v.code, v.cat, v.sev, v.comp, v.desc, v.cve, v.rem]);
    }
    console.log("✓ Seeded Security vulnerability register");
  }

  // 5. Usability & UX Telemetry
  const uxCheck = await pool.query("SELECT count(*) FROM usability_telemetry");
  if (parseInt(uxCheck.rows[0].count, 10) === 0) {
    const uxData = [
      { portal: "EMPLOYEE_SELF_SERVICE", vp: "MOBILE_RESPONSIVE", route: "/employee/attendance", task: "Clock-In & Geolocation Verification", time: 3.8, succ: 99.4, lcp: 680, fid: 8.5, cls: 0.008, wcag: 98.0 },
      { portal: "EMPLOYEE_SELF_SERVICE", vp: "DESKTOP_FULL", route: "/employee/leaves", task: "Leave Application & Balance Check", time: 8.2, succ: 99.1, lcp: 710, fid: 10.0, cls: 0.012, wcag: 97.5 },
      { portal: "MANAGER_PORTAL", vp: "DESKTOP_FULL", route: "/manager/dashboard", task: "Timesheet Multi-Approval Review", time: 6.4, succ: 98.7, lcp: 740, fid: 12.0, cls: 0.015, wcag: 96.0 },
      { portal: "HR_ADMIN_CONSOLE", vp: "DESKTOP_FULL", route: "/hr/automations", task: "Trigger Monthly Payroll Cut-off", time: 4.5, succ: 100.0, lcp: 790, fid: 14.0, cls: 0.020, wcag: 95.5 },
      { portal: "EMPLOYEE_SELF_SERVICE", vp: "TABLET", route: "/employee/documents", task: "Download Masked Payslip", time: 5.1, succ: 98.9, lcp: 730, fid: 9.0, cls: 0.010, wcag: 96.5 }
    ];

    for (const u of uxData) {
      await pool.query(`
        INSERT INTO usability_telemetry (
          portal_type, viewport_category, page_route, task_name,
          avg_completion_time_sec, success_rate_pct, lcp_ms, fid_ms, cls_score, accessibility_wcag_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [u.portal, u.vp, u.route, u.task, u.time, u.succ, u.lcp, u.fid, u.cls, u.wcag]);
    }
    console.log("✓ Seeded Usability & UX telemetry");
  }

  // 6. Automated Backup Catalog & Verification Testing
  const backupCheck = await pool.query("SELECT count(*) FROM automated_backup_test_ledger");
  if (parseInt(backupCheck.rows[0].count, 10) === 0) {
    const backups = [
      {
        id: "BKP-20261023-0100",
        type: "FULL_DATABASE",
        size: 142.8,
        tier: "ENCRYPTED_OBJECT_STORAGE_HOT",
        sha: crypto.createHash("sha256").update("BKP_FULL_20261023_0100_VERIFIED").digest("hex"),
        restoreSec: 18.5,
        status: "RESTORE_VERIFIED_CONSISTENT"
      },
      {
        id: "BKP-20261023-0600",
        type: "INCREMENTAL_WAL",
        size: 24.2,
        tier: "ENCRYPTED_OBJECT_STORAGE_HOT",
        sha: crypto.createHash("sha256").update("BKP_WAL_20261023_0600_VERIFIED").digest("hex"),
        restoreSec: 4.2,
        status: "RESTORE_VERIFIED_CONSISTENT"
      },
      {
        id: "BKP-20261022-0100",
        type: "FULL_DATABASE",
        size: 139.5,
        tier: "COLD_ARCHIVE_GLACIER",
        sha: crypto.createHash("sha256").update("BKP_FULL_20261022_0100_VERIFIED").digest("hex"),
        restoreSec: 19.1,
        status: "RESTORE_VERIFIED_CONSISTENT"
      }
    ];

    for (const b of backups) {
      await pool.query(`
        INSERT INTO automated_backup_test_ledger (
          backup_id, backup_type, backup_size_mb, storage_tier, sha256_checksum,
          is_restoration_tested, restore_time_seconds, restoration_status
        ) VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7)
      `, [b.id, b.type, b.size, b.tier, b.sha, b.restoreSec, b.status]);
    }
    console.log("✓ Seeded Automated backup ledger and restore test records");
  }

  // 7. Disaster Recovery Tiers (RPO & RTO)
  const drCheck = await pool.query("SELECT count(*) FROM disaster_recovery_tiers");
  if (parseInt(drCheck.rows[0].count, 10) === 0) {
    const drTiers = [
      {
        tier: "TIER_1_PAYROLL_CORE",
        desc: "Payroll Calculation, Bank Disbursal Ledger, Statutory Master & Auth Users",
        rpo_target: 15,
        rto_target: 30,
        rpo_actual: 4,
        rto_actual: 12,
        replication: "SYNCHRONOUS_STANDBY_WAL_SHIPPING",
        status: "PASSED_WITHIN_SLA"
      },
      {
        tier: "TIER_2_ATTENDANCE_LEAVE",
        desc: "Biometric Attendance Ingestion, Leave Requests, Timesheet Submissions",
        rpo_target: 60,
        rto_target: 120,
        rpo_actual: 14,
        rto_actual: 38,
        replication: "SEMI_SYNCHRONOUS_REPLICATION",
        status: "PASSED_WITHIN_SLA"
      },
      {
        tier: "TIER_3_ANALYTICS_REPORTS",
        desc: "Executive KPI Dashboards, Historical Pulse Surveys & Scheduled Reports",
        rpo_target: 240,
        rto_target: 360,
        rpo_actual: 45,
        rto_actual: 90,
        replication: "ASYNCHRONOUS_SNAPSHOT_MIRROR",
        status: "PASSED_WITHIN_SLA"
      }
    ];

    for (const d of drTiers) {
      await pool.query(`
        INSERT INTO disaster_recovery_tiers (
          workload_tier, description, rpo_target_minutes, rto_target_minutes,
          actual_drill_rpo_minutes, actual_drill_rto_minutes, replication_mode, drill_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [d.tier, d.desc, d.rpo_target, d.rto_target, d.rpo_actual, d.rto_actual, d.replication, d.status]);
    }
    console.log("✓ Seeded Disaster recovery tiers with RPO/RTO metrics");
  }

  // 8. Observability Log Stream & Alerts
  const obsCheck = await pool.query("SELECT count(*) FROM observability_log_stream");
  if (parseInt(obsCheck.rows[0].count, 10) === 0) {
    const logs = [
      { level: "INFO", module: "AUTH_GATEWAY", message: "User authenticated successfully: admin@company.com (role: super_admin)", ip: "127.0.0.1" },
      { level: "INFO", module: "PAYROLL_ENGINE", message: "Monthly payroll cut-off batch initialized for October 2026. 142 records locked.", ip: "127.0.0.1" },
      { level: "SECURITY_ALERT", module: "DOCUMENT_GOVERNANCE", message: "Restricted download prevented: role 'employee' denied on BGV_INVESTIGATION_REPORTS dossier", ip: "192.168.1.18" },
      { level: "WARN", module: "CACHE_MEMORY", message: "Memory cache hit-ratio fell below 90% during bulk entity exploration query", ip: "127.0.0.1" },
      { level: "INFO", module: "TEMPORAL_LEDGER", message: "Effective-dated version #4 advanced for employee #201 without overwriting history", ip: "127.0.0.1" }
    ];

    for (const l of logs) {
      await pool.query(`
        INSERT INTO observability_log_stream (
          log_level, service_name, module, message, ip_address
        ) VALUES ($1, 'PERN-HRMS-API', $2, $3, $4)
      `, [l.level, l.module, l.message, l.ip]);
    }

    const alerts = [
      { code: "ALT-SYS-01", name: "API Latency p95 > 250ms Alert", cond: "HTTP p95 latency exceeds 250ms over 5-minute rolling window", sev: "WARNING", state: "RESOLVED" },
      { code: "ALT-SYS-02", name: "High Rate-Limit Threshold Violation", cond: "Single IP triggers > 600 requests per minute limit", sev: "CRITICAL", state: "RESOLVED" },
      { code: "ALT-SYS-03", name: "PostgreSQL Database Connection Pool Saturation", cond: "Active client connections exceed 85% of pool capacity", sev: "WARNING", state: "RESOLVED" }
    ];

    for (const a of alerts) {
      await pool.query(`
        INSERT INTO observability_alerts (
          alert_code, alert_name, condition_rule, severity, current_state
        ) VALUES ($1, $2, $3, $4, $5)
      `, [a.code, a.name, a.cond, a.sev, a.state]);
    }
    console.log("✓ Seeded Observability logs and alerts");
  }

  // 9. Maintainability CI/CD Pipeline & API Registry
  const cicdCheck = await pool.query("SELECT count(*) FROM maintainability_cicd_pipeline");
  if (parseInt(cicdCheck.rows[0].count, 10) === 0) {
    await pool.query(`
      INSERT INTO maintainability_cicd_pipeline (
        build_version, git_commit_hash, git_branch, pipeline_stage,
        status, test_coverage_pct, total_tests_passed, duration_seconds, deployed_by
      ) VALUES
      ('v2.6.4-prod', 'a7eaa41e-d392-42ab-881d-bc7702c78cea', 'main', 'DEPLOY_PRODUCTION', 'SUCCESS', 95.40, 264, 48, 'Automated CI/CD Pipeline Worker'),
      ('v2.6.3-rc2', 'c8191fa2-8b43-41c1-9f22-10928f810281', 'release/v2.6', 'DEPLOY_PRODUCTION', 'SUCCESS', 94.80, 252, 45, 'Automated CI/CD Pipeline Worker')
    `);

    const apis = [
      { mod: "Auth & Identity", prefix: "/api/auth", count: 8 },
      { mod: "Core Entities (41)", prefix: "/api/entities", count: 42 },
      { mod: "Enterprise Integrations (8)", prefix: "/api/integrations", count: 18 },
      { mod: "Security & Compliance (11)", prefix: "/api/governance", count: 24 },
      { mod: "Lifecycle Automations & SLAs (9)", prefix: "/api/automations", count: 28 },
      { mod: "Audit & Effective Dating (5)", prefix: "/api/audit-governance", count: 16 },
      { mod: "Operations & Architecture (9)", prefix: "/api/operations", count: 20 }
    ];

    for (const api of apis) {
      await pool.query(`
        INSERT INTO maintainability_api_registry (
          api_module, route_prefix, endpoint_count
        ) VALUES ($1, $2, $3)
      `, [api.mod, api.prefix, api.count]);
    }
    console.log("✓ Seeded Maintainability CI/CD pipeline and API registry");
  }

  console.log("\n========================================================");
  console.log("✅ 020 MIGRATION & SEEDING COMPLETED SUCCESSFULLY!");
  console.log("========================================================");
  process.exit(0);
}

run().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
