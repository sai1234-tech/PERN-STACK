import "dotenv/config";
import pool from "../config/db.js";

const ENTITIES_REQUESTED = [
  "Employee", "Person", "Employment", "Organization", "Department", 
  "Designation", "Location", "Client", "Project", "SOW", 
  "Deployment", "Candidate", "Requisition", "Interview", "Offer", 
  "Onboarding", "BGV", "Document", "Attendance", "Shift", 
  "Holiday", "Leave Type", "Leave Balance", "Leave Request", "Salary Revision", 
  "Payroll Input", "Performance Cycle", "Goal", "KRA", "KPI", 
  "Ticket", "Asset", "Exit", "Clearance", "Full & Final Input", 
  "Notification", "Approval", "User", "Role", "Permission", "Audit Log"
];

async function run() {
  const res = await pool.query(`
    SELECT table_name, table_type 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  const tables = res.rows.map(r => r.table_name);
  console.log(`Found ${tables.length} tables/views in public schema:`);
  console.log(tables);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
