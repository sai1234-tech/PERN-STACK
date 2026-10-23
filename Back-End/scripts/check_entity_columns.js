import pool from "../config/db.js";

async function check() {
  const tables = [
    'employees', 'organizations', 'departments', 'designations', 'locations',
    'clients', 'client_projects', 'statement_of_works', 'project_allocations',
    'candidates', 'job_requisitions', 'interviews', 'job_offers', 'onboarding_tasks',
    'bgv_verifications', 'employee_documents', 'attendance', 'shifts', 'holidays',
    'leave_types', 'leaves', 'salary_revisions', 'payrolls', 'performance_cycles',
    'okrs', 'kras', 'kpi_metrics', 'tickets', 'assets', 'resignations',
    'clearances', 'fnf_settlements', 'notifications', 'approvals', 'users',
    'role_permissions', 'audit_logs'
  ];

  for (const t of tables) {
    const res = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position",
      [t]
    );
    console.log(`\n[${t}] (${res.rows.length} cols):`);
    console.log(res.rows.map(r => `${r.column_name}`).join(", "));
  }
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
