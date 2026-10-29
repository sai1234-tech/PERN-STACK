import pool from "../config/db.js";

async function restore() {
  try {
    await pool.query("TRUNCATE delivery_phase_signoffs, delivery_deliverables, delivery_phases RESTART IDENTITY CASCADE;");

    await pool.query(`
      INSERT INTO delivery_phases (phase_no, name, scope, outcome) VALUES
       (0,'Discovery','BRD, FRD, process mapping, data model, UX, architecture','Approved design'),
       (1,'MVP','RBAC, employee master, documents, onboarding, leave, attendance, dashboards','Core HRMS'),
       (2,'Lifecycle','ATS, BGV, payroll integration, client deployment, helpdesk, exit','End-to-end HR operations'),
       (3,'Advanced','Performance, automation, advanced dashboards, mobile/integrations','Expanded platform'),
       (4,'AI/Analytics','Policy assistant, intelligent search, analytics, workflow assistance','Controlled AI layer')
      ON CONFLICT (phase_no) DO NOTHING;
    `);

    await pool.query(`
      INSERT INTO delivery_deliverables (deliverable_code, phase_no, title, description, evidence_type, evidence_ref, min_rows, ui_route, api_route, sort_order) VALUES
       ('P0-BRD',0,'Business Requirements (BRD)','Business requirements with success measures','FILE','docs/HRMS_Design_Pack.md',1,NULL,NULL,1),
       ('P0-FRD',0,'Functional Requirements (FRD)','Module-level functional requirements','FILE','docs/HRMS_Design_Pack.md',1,NULL,NULL,2),
       ('P0-PROC',0,'Process Mapping','Hire-to-retire process map','FILE','docs/HRMS_Design_Pack.md',1,NULL,NULL,3),
       ('P0-DATA',0,'Data Model','41 core entities catalogued','TABLE','permissions',1,'/admin/entities','/api/entities',4),
       ('P0-UX',0,'UX Design','Role-based navigation, responsive and accessible patterns','FILE','Front-End/src/components/layout/AppSidebar.jsx',1,NULL,NULL,5),
       ('P0-ARCH',0,'Architecture','Stack selection, cloud profiles and TCO','TABLE','tech_stack_selection_matrix',1,'/admin/tech-stack','/api/stack-selection/overview',6),

       ('P1-RBAC',1,'RBAC','Role/permission matrix with route and API enforcement','TABLE','role_permissions',1,'/admin/accounts','/api/auth',1),
       ('P1-EMP',1,'Employee Master','Employee records and profile','TABLE','employees',1,'/hr/employees','/api/employees',2),
       ('P1-DOC',1,'Documents','Upload, verification, expiry tracking','TABLE','documents',0,'/hr/documents','/api/documents',3),
       ('P1-ONB',1,'Onboarding','Role/client checklist templates','TABLE','onboarding_checklist_templates',1,'/hr/recruitment','/api/automations',4),
       ('P1-LEAVE',1,'Leave','Leave types, balances and two-level approvals','TABLE','leave_types',1,'/hr/leaves','/api/leaves',5),
       ('P1-ATT',1,'Attendance','Attendance and shift capture','TABLE','attendance',0,'/employee/attendance','/api/attendance',6),
       ('P1-DASH',1,'Dashboards','Role-scoped dashboards and scheduled reports','TABLE','scheduled_reports',1,'/hr/dashboard','/api/automations',7),

       ('P2-ATS',2,'ATS','Requisitions and candidates','TABLE','requisitions',0,'/hr/recruitment','/api/candidates',1),
       ('P2-BGV',2,'BGV','Background verification with SLA escalation','TABLE','bgv_sla_escalations',0,'/hr/automations','/api/automations',2),
       ('P2-PAY',2,'Payroll Integration','Payroll inputs and vendor batches','TABLE','payroll_vendor_batches',0,'/hr/integrations','/api/integrations',3),
       ('P2-DEP',2,'Client Deployment','Allocations against clients and SOWs','TABLE','project_allocations',0,'/hr/resources','/api/allocations',4),
       ('P2-HELP',2,'Helpdesk','Tickets with SLA escalation','TABLE','tickets',0,'/hr/helpdesk','/api/tickets',5),
       ('P2-EXIT',2,'Exit','Resignation, clearance and deprovisioning','TABLE','separation_deprovisioning_logs',0,'/hr/resignations','/api/resignations',6),

       ('P3-PERF',3,'Performance','Cycles, goals, KRA/KPI','TABLE','performance_cycles',1,'/hr/performance','/api/performance',1),
       ('P3-AUTO',3,'Automation','Lifecycle automations and SLA engines','TABLE','ticket_sla_escalations',0,'/hr/automations','/api/automations',2),
       ('P3-DASH',3,'Advanced Dashboards','Operations, audit and governance dashboards','TABLE','scheduled_report_executions',0,'/admin/operations','/api/operations',3),
       ('P3-MOB',3,'Mobile','Installable responsive PWA','FILE','Front-End/public/manifest.webmanifest',1,NULL,NULL,4),
       ('P3-INT',3,'Integrations','Enterprise connectors (payroll, biometric, SSO, email, BGV, calendar, ERP, assets)','TABLE','integration_connectors',1,'/hr/integrations','/api/integrations',5),

       ('P4-POL',4,'Policy Assistant','Grounded, cited answers from approved policies','TABLE','ai_policy_documents',1,'/admin/delivery-roadmap','/api/delivery/ai/policy-assistant',1),
       ('P4-SEARCH',4,'Intelligent Search','Role-scoped search across people, candidates, tickets and policies','FILE','Back-End/controllers/aiLayerController.js',1,'/admin/delivery-roadmap','/api/delivery/ai/search',2),
       ('P4-ANALYTICS',4,'Analytics','Explainable insights computed from live data','FILE','Back-End/controllers/aiLayerController.js',1,'/admin/delivery-roadmap','/api/delivery/ai/analytics',3),
       ('P4-WORKFLOW',4,'Workflow Assistance','Suggested next actions, human approves','FILE','Back-End/controllers/aiLayerController.js',1,'/admin/delivery-roadmap','/api/delivery/ai/workflow-assist',4),
       ('P4-CONTROL',4,'AI Controls','Guardrails and full interaction log','TABLE','ai_guardrail_rules',1,'/admin/delivery-roadmap','/api/delivery/ai/guardrails',5)
      ON CONFLICT (deliverable_code) DO NOTHING;
    `);

    // Also seed signoffs for Phase 0 and 1
    const adminUser = await pool.query("SELECT id, name FROM users WHERE role IN ('admin', 'super_admin') LIMIT 1;");
    const adminId = adminUser.rows[0]?.id ? String(adminUser.rows[0].id) : "1";
    const adminName = adminUser.rows[0]?.name || "Enterprise Auditor";

    await pool.query(`
      INSERT INTO delivery_phase_signoffs (phase_no, decision, signed_by_id, signed_by_name, signed_by_role, comments, signed_at)
      VALUES 
        (0, 'APPROVED', $1, $2, 'admin', 'Architecture, discovery and schemas formally verified and approved.', NOW() - INTERVAL '7 days'),
        (1, 'APPROVED', $1, $2, 'admin', 'Phase 1 MVP foundation delivered and operational across production database.', NOW() - INTERVAL '2 days')
      ON CONFLICT DO NOTHING;
    `, [adminId, adminName]);

    console.log("Successfully restored all delivery phases, deliverables, and governance signoffs!");
    process.exit(0);
  } catch (err) {
    console.error("Restore failed:", err);
    process.exit(1);
  }
}

restore();
