import "dotenv/config";
import pool from "../config/db.js";

async function inspect() {
  const tables = [
    'users', 'employees', 'departments', 'clients', 'client_projects', 
    'client_rate_cards', 'project_allocations', 'resource_transitions',
    'attendance', 'leave_types', 'leaves', 'holidays', 'timesheets', 
    'candidates', 'tickets', 'okrs', 'payrolls', 'employee_documents', 
    'employee_history', 'daily_pulses', 'events', 'resignations', 
    'clearances', 'audit_logs'
  ];

  console.log("=== CHECKING TABLE ROW COUNTS ===");
  for (const t of tables) {
    try {
      const res = await pool.query(`SELECT count(*) FROM ${t}`);
      console.log(`Table ${t.padEnd(22)}: ${res.rows[0].count} rows`);
    } catch (err) {
      console.log(`Table ${t.padEnd(22)}: ERROR: ${err.message}`);
    }
  }

  // Also check database tables list directly from information_schema
  console.log("\n=== ALL PUBLIC TABLES IN DATABASE ===");
  const allTables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log(allTables.rows.map(r => r.table_name).join(", "));

  process.exit(0);
}

inspect().catch(err => {
  console.error("Error inspecting:", err);
  process.exit(1);
});
