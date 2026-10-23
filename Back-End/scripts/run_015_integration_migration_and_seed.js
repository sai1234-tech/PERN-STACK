import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log("=== EXECUTING 015_ENTERPRISE_INTEGRATIONS MIGRATION ===");
  const sqlPath = path.join(__dirname, "../migrations/015_enterprise_integrations.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  await pool.query(sql);
  console.log(" Migration 015 SQL executed successfully!");

  // 1. Seed 8 Enterprise Integration Connectors
  console.log("Seeding 8 Enterprise Integration Connectors...");
  const connectors = [
    {
      connector_key: "payroll_vendor",
      name: "Payroll Vendor Integration",
      category: "Payroll & Compensation",
      provider: "ADP GlobalView / RazorpayX Payroll",
      protocol: "API / SFTP / Encrypted PGP File",
      endpoint_url: "sftp://payroll.enterprise-gateway.adp.com:22/inbound/",
      auth_type: "SFTP SSH Key + AES-256 PGP",
      config_data: {
        vendor_code: "ADP-CORP-9921",
        encryption: "PGP-AES256",
        export_schedule: "25th of month 23:59 UTC",
        auto_reconciliation: true,
        payroll_input_fields: ["employee_code", "gross_salary", "basic", "allowances", "tax_tds", "pf_provident_fund", "net_salary"],
        results_import_path: "/outbound/processed_payrolls/"
      },
      secret_key: "adp_rsa_pgp_key_prod_sec_***",
      health_status: "Connected",
      sync_interval_mins: 720
    },
    {
      connector_key: "biometric_attendance",
      name: "Biometric Terminal Sync Engine",
      category: "Time & Attendance",
      provider: "ZKTeco Enterprise COSEC Matrix",
      protocol: "API / Scheduled Import / Biometric Push",
      endpoint_url: "https://biometric-hub.internal.corp/api/v2/pull-punches",
      auth_type: "API Key / HMAC-SHA256",
      config_data: {
        active_terminals: [
          { terminal_id: "ZKT-HYD-TOWER-B-01", location: "Hyderabad HQ - Main Reception", ip: "192.168.10.15", status: "Online" },
          { terminal_id: "ZKT-HYD-TOWER-B-02", location: "Hyderabad HQ - Floor 7 Server Room", ip: "192.168.10.16", status: "Online" },
          { terminal_id: "ZKT-BLR-CAMPUS-01", location: "Bengaluru Tech Park - Block C", ip: "192.168.20.10", status: "Online" }
        ],
        push_frequency_seconds: 300,
        biometric_modes: ["FACIAL_RECOGNITION", "FINGERPRINT", "RFID_SMART_CARD"],
        auto_attendance_reconciliation: true
      },
      secret_key: "zkteco_hmac_secret_sha256_***",
      health_status: "Connected",
      sync_interval_mins: 5
    },
    {
      connector_key: "identity_provider",
      name: "Identity Provider (SSO & MFA)",
      category: "Identity & Security",
      provider: "Microsoft Entra ID / Okta Workforce Identity",
      protocol: "OAuth2 / OIDC / SAML 2.0",
      endpoint_url: "https://login.microsoftonline.com/quadratics-tenant/v2.0",
      auth_type: "OAuth2 / SAML 2.0",
      config_data: {
        tenant_id: "8f7311de-3b4c-4e89-9a21-998811aabbee",
        client_id: "99b1c70e-43fa-4e78-9321-cceedd889900",
        issuer: "https://sts.windows.net/8f7311de-3b4c-4e89-9a21-998811aabbee/",
        saml_acs_url: "https://hrms.enterprise.io/api/v1/auth/saml/callback",
        mfa_enforced: true,
        scim_user_provisioning: true,
        session_timeout_hours: 12
      },
      secret_key: "entra_client_secret_ms_***",
      health_status: "Connected",
      sync_interval_mins: 60
    },
    {
      connector_key: "email_service",
      name: "Enterprise Email & Notifications Gateway",
      category: "Communications",
      provider: "Microsoft Graph API / Enterprise SMTP",
      protocol: "Microsoft Graph / SMTP / Provider API",
      endpoint_url: "https://graph.microsoft.com/v1.0/sendMail",
      auth_type: "OAuth2 Client Credentials",
      config_data: {
        from_email: "hr-notifications@quadraticsystems.io",
        display_name: "Quadratic HRMS Enterprise System",
        smtp_fallback_host: "smtp.office365.com",
        smtp_fallback_port: 587,
        templates_active: ["Offer_Letter_Released", "Interview_Scheduled", "Monthly_Payslip_Delivery", "Leave_Status_Update", "Helpdesk_Resolution"],
        daily_transmission_quota: 50000
      },
      secret_key: "ms_graph_app_secret_cert_***",
      health_status: "Connected",
      sync_interval_mins: 15
    },
    {
      connector_key: "bgv_provider",
      name: "Background Verification (BGV) Provider",
      category: "Compliance & Screening",
      provider: "AuthBridge Screening Corp / FirstAdvantage",
      protocol: "REST API / Secure File Webhook",
      endpoint_url: "https://api.authbridge.com/v3/enterprise/cases",
      auth_type: "Bearer Token / Webhook HMAC",
      config_data: {
        account_id: "AB-ENT-HYD-5501",
        auto_trigger_on_offer_acceptance: true,
        screening_packages: [
          { package_id: "EXEC_SUITE", checks: ["Past Employment (5 yrs)", "Education Credential", "Criminal Record", "Address Check", "Credit/CIBIL"] }
        ],
        webhook_listener_url: "https://hrms.enterprise.io/api/v1/integrations/bgv/webhook",
        sla_turnaround_days: 7
      },
      secret_key: "authbridge_live_api_key_***",
      health_status: "Connected",
      sync_interval_mins: 180
    },
    {
      connector_key: "calendar_service",
      name: "Calendar & Interview Scheduling Sync",
      category: "Interview Scheduling",
      provider: "Microsoft Graph Calendar / Google Calendar API",
      protocol: "Microsoft Graph / Google Calendar API",
      endpoint_url: "https://graph.microsoft.com/v1.0/me/events",
      auth_type: "OAuth2 Delegated / App Permission",
      config_data: {
        supported_platforms: ["Microsoft Teams", "Google Meet"],
        auto_generate_meeting_link: true,
        conflict_detection_enabled: true,
        default_interview_buffer_mins: 15,
        ics_invitation_auto_dispatch: true
      },
      secret_key: "graph_calendar_oauth_token_***",
      health_status: "Connected",
      sync_interval_mins: 30
    },
    {
      connector_key: "finance_erp",
      name: "Finance & ERP General Ledger Bridge",
      category: "Cost Center & Accounting",
      provider: "SAP S/4HANA Enterprise Cloud / Oracle NetSuite",
      protocol: "REST API / GL Journal File Batch",
      endpoint_url: "https://s4hana.enterprise.sap.com/sap/opu/odata/sap/API_JOURNALENTRY",
      auth_type: "Mutual TLS / OAuth2",
      config_data: {
        sap_company_code: "1000",
        gl_salary_debit_account: "610000 - Salaries & Compensation",
        gl_bonus_debit_account: "611000 - Performance Bonus",
        gl_pf_employer_debit: "612000 - Employer PF Contribution",
        gl_payable_credit_account: "210000 - Accrued Payroll Payable",
        cost_centers: ["CC-ENG-01", "CC-HR-02", "CC-PROD-03", "CC-CLOUD-04"]
      },
      secret_key: "sap_s4hana_mtls_cert_token_***",
      health_status: "Connected",
      sync_interval_mins: 1440
    },
    {
      connector_key: "it_asset_system",
      name: "IT Asset & Access Provisioning System",
      category: "IT Infrastructure & Workflow",
      provider: "Jira Service Management / Microsoft Intune",
      protocol: "REST API / Workflow Webhook",
      endpoint_url: "https://quadratics.atlassian.net/rest/servicedeskapi/request",
      auth_type: "API Token / Webhook Secret",
      config_data: {
        service_desk_id: "SD-IT-OPS-1",
        request_type_id: "10045 - Employee Hardware & Access Provisioning",
        mdm_system: "Microsoft Intune Unified Endpoint Management",
        hardware_profiles: ["Apple MacBook Pro 16 M3 Max", "Dell UltraSharp 4K Monitor", "YubiKey 5C NFC"],
        auto_deprovision_on_exit: true
      },
      secret_key: "jira_intune_webhook_token_***",
      health_status: "Connected",
      sync_interval_mins: 15
    }
  ];

  for (const c of connectors) {
    await pool.query(`
      INSERT INTO integration_connectors 
        (connector_key, name, category, provider, protocol, endpoint_url, auth_type, config_data, secret_key, health_status, sync_interval_mins, total_sync_count, failed_sync_count)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 24, 0)
      ON CONFLICT (connector_key) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        provider = EXCLUDED.provider,
        protocol = EXCLUDED.protocol,
        endpoint_url = EXCLUDED.endpoint_url,
        auth_type = EXCLUDED.auth_type,
        config_data = EXCLUDED.config_data,
        health_status = EXCLUDED.health_status,
        sync_interval_mins = EXCLUDED.sync_interval_mins,
        updated_at = CURRENT_TIMESTAMP;
    `, [c.connector_key, c.name, c.category, c.provider, c.protocol, c.endpoint_url, c.auth_type, JSON.stringify(c.config_data), c.secret_key, c.health_status, c.sync_interval_mins]);
  }
  console.log(" All 8 integration connectors registered!");

  // 2. Seed Realistic Biometric Device Punches
  const empRes = await pool.query(`SELECT id, employee_code, first_name, last_name FROM employees ORDER BY id ASC LIMIT 5`);
  const emps = empRes.rows;

  if (emps.length > 0) {
    console.log("Seeding Biometric Punch Records...");
    const punches = [
      ["ZKT-HYD-TOWER-B-01", "192.168.10.15", emps[0].employee_code, "2026-10-22 09:28:14", "CHECK_IN", "FACIAL_RECOGNITION", true],
      ["ZKT-HYD-TOWER-B-01", "192.168.10.15", emps[0].employee_code, "2026-10-22 13:05:42", "BREAK_START", "FINGERPRINT", true],
      ["ZKT-HYD-TOWER-B-01", "192.168.10.15", emps[0].employee_code, "2026-10-22 14:02:11", "BREAK_END", "FINGERPRINT", true],
      ["ZKT-BLR-CAMPUS-01", "192.168.20.10", emps.length > 1 ? emps[1].employee_code : emps[0].employee_code, "2026-10-22 09:15:30", "CHECK_IN", "FACIAL_RECOGNITION", true],
      ["ZKT-BLR-CAMPUS-01", "192.168.20.10", emps.length > 2 ? emps[2].employee_code : emps[0].employee_code, "2026-10-22 09:42:18", "CHECK_IN", "RFID_SMART_CARD", true]
    ];
    for (const p of punches) {
      await pool.query(`
        INSERT INTO biometric_punch_logs (device_id, terminal_ip, employee_code, punch_time, punch_type, verification_mode, is_processed)
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `, p);
    }
  }

  // 3. Seed Payroll Vendor Batch
  console.log("Seeding Payroll Vendor Batch...");
  await pool.query(`
    INSERT INTO payroll_vendor_batches 
      (batch_code, vendor_name, period, transfer_method, total_employees, total_gross, total_net, file_checksum, status, dispatched_at, reconciled_at)
    VALUES 
      ('PY-BATCH-2026-10-ADP', 'ADP GlobalView Enterprise', '2026-10', 'SFTP_ENCRYPTED_PGP', 24, 2850000.00, 2415000.00, 'SHA256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069', 'RECONCILED', '2026-10-20 18:00:00', '2026-10-21 11:30:00')
    ON CONFLICT (batch_code) DO NOTHING;
  `);

  // 4. Seed ERP Journal Batch
  console.log("Seeding ERP Journal Batch...");
  await pool.query(`
    INSERT INTO erp_journal_batches 
      (voucher_code, erp_system, period, total_debit, total_credit, cost_centers_count, status, erp_reference_doc)
    VALUES 
      ('JV-2026-10-PAYROLL-SAP', 'SAP S/4HANA Enterprise Cloud', '2026-10', 2850000.00, 2850000.00, 4, 'POSTED', 'SAP-DOC-19000842')
    ON CONFLICT (voucher_code) DO NOTHING;
  `);

  // 5. Seed IT Asset Provisioning Jobs
  if (emps.length > 0) {
    console.log("Seeding IT Asset Provisioning Jobs...");
    const assetJobs = [
      ['IT-PROV-9011', 'Jira Service Management / Microsoft Intune', emps[0].id, `${emps[0].first_name} ${emps[0].last_name}`, 'LAPTOP_HARDWARE', 'PROVISIONED', 'Apple MacBook Pro 16" (SN: C02G9988MD6T)'],
      ['IT-PROV-9012', 'Microsoft Entra ID / Microsoft 365', emps[0].id, `${emps[0].first_name} ${emps[0].last_name}`, 'EMAIL_WORKSPACE', 'PROVISIONED', 'License: M365 E5 Security + PowerBI Enterprise'],
      ['IT-PROV-9013', 'Zscaler Private Access / Cisco AnyConnect', emps[0].id, `${emps[0].first_name} ${emps[0].last_name}`, 'VPN_NETWORK_ACCESS', 'PROVISIONED', 'ZPA Engineering Production Profile']
    ];
    for (const aj of assetJobs) {
      await pool.query(`
        INSERT INTO it_asset_provisioning_jobs (request_code, target_system, employee_id, employee_name, item_type, status, assigned_serial_or_license)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (request_code) DO NOTHING;
      `, aj);
    }
  }

  // 6. Seed Realistic Sync Execution Logs for all 8 Integrations
  console.log("Seeding Sync Telemetry Logs...");
  const syncLogs = [
    {
      connector_key: "payroll_vendor",
      job_type: "EXPORT_PAYROLL_INPUTS",
      direction: "OUTBOUND",
      status: "SUCCESS",
      records_processed: 24,
      payload_summary: "Dispatched encrypted PGP archive to ADP SFTP: payroll_inputs_2026_10.csv.pgp (Checksum Verified)",
      duration_ms: 1420,
      triggered_by: "AUTOMATED_CRON"
    },
    {
      connector_key: "biometric_attendance",
      job_type: "IMPORT_BIOMETRIC_PUNCHES",
      direction: "INBOUND",
      status: "SUCCESS",
      records_processed: 54,
      payload_summary: "Pulled 54 raw biometric punch events from ZKTeco Hyderabad HQ and Bengaluru Hub terminals",
      duration_ms: 320,
      triggered_by: "AUTOMATED_CRON"
    },
    {
      connector_key: "identity_provider",
      job_type: "SSO_TOKEN_EXCHANGE",
      direction: "BIDIRECTIONAL",
      status: "SUCCESS",
      records_processed: 33,
      payload_summary: "Microsoft Entra ID SAML 2.0 / OIDC Token Verification and SCIM User Directory Reconciliation",
      duration_ms: 210,
      triggered_by: "WEBHOOK"
    },
    {
      connector_key: "email_service",
      job_type: "DISPATCH_NOTIFICATION_EMAIL",
      direction: "OUTBOUND",
      status: "SUCCESS",
      records_processed: 48,
      payload_summary: "Microsoft Graph API: Sent 48 transactional notifications (Payslip delivery & Offer letter dispatch)",
      duration_ms: 680,
      triggered_by: "MANUAL_USER"
    },
    {
      connector_key: "bgv_provider",
      job_type: "POLL_VERIFICATION_STATUS",
      direction: "INBOUND",
      status: "SUCCESS",
      records_processed: 3,
      payload_summary: "AuthBridge REST API: Synced verification status for 3 candidate screenings (2 Green, 1 In-Progress)",
      duration_ms: 890,
      triggered_by: "AUTOMATED_CRON"
    },
    {
      connector_key: "calendar_service",
      job_type: "SYNC_CALENDAR_INVITES",
      direction: "BIDIRECTIONAL",
      status: "SUCCESS",
      records_processed: 2,
      payload_summary: "Microsoft Graph & Google Calendar: Scheduled Technical Round interview invites with Google Meet links",
      duration_ms: 450,
      triggered_by: "MANUAL_USER"
    },
    {
      connector_key: "finance_erp",
      job_type: "POST_ERP_GL_JOURNAL",
      direction: "OUTBOUND",
      status: "SUCCESS",
      records_processed: 4,
      payload_summary: "SAP S/4HANA: Successfully posted Payroll Journal Voucher JV-2026-10-PAYROLL across 4 Cost Centers",
      duration_ms: 1850,
      triggered_by: "MANUAL_USER"
    },
    {
      connector_key: "it_asset_system",
      job_type: "PROVISION_HARDWARE_ACCESS",
      direction: "OUTBOUND",
      status: "SUCCESS",
      records_processed: 3,
      payload_summary: "Jira Service Management: Triggered hardware provisioning ticket IT-PROV-9011 (MacBook Pro M3 Max) and MDM enrollment",
      duration_ms: 540,
      triggered_by: "WEBHOOK"
    }
  ];

  for (const log of syncLogs) {
    await pool.query(`
      INSERT INTO integration_sync_logs (connector_key, job_type, direction, status, records_processed, payload_summary, duration_ms, triggered_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
    `, [log.connector_key, log.job_type, log.direction, log.status, log.records_processed, log.payload_summary, log.duration_ms, log.triggered_by]);
  }

  console.log(" All 8 Enterprise Integration Connectors successfully seeded with live telemetry!");
  process.exit(0);
}

run().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
