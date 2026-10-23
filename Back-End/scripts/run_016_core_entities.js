import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENTITIES_41 = [
  { name: "Employee", table: "employee" },
  { name: "Person", table: "person" },
  { name: "Employment", table: "employment" },
  { name: "Organization", table: "organization" },
  { name: "Department", table: "department" },
  { name: "Designation", table: "designation" },
  { name: "Location", table: "location" },
  { name: "Client", table: "client" },
  { name: "Project", table: "project" },
  { name: "SOW", table: "sow" },
  { name: "Deployment", table: "deployment" },
  { name: "Candidate", table: "candidate" },
  { name: "Requisition", table: "requisition" },
  { name: "Interview", table: "interview" },
  { name: "Offer", table: "offer" },
  { name: "Onboarding", table: "onboarding" },
  { name: "BGV", table: "bgv" },
  { name: "Document", table: "document" },
  { name: "Attendance", table: "attendance" },
  { name: "Shift", table: "shift" },
  { name: "Holiday", table: "holiday" },
  { name: "Leave Type", table: "leave_type" },
  { name: "Leave Balance", table: "leave_balance" },
  { name: "Leave Request", table: "leave_request" },
  { name: "Salary Revision", table: "salary_revision" },
  { name: "Payroll Input", table: "payroll_input" },
  { name: "Performance Cycle", table: "performance_cycle" },
  { name: "Goal", table: "goal" },
  { name: "KRA", table: "kra" },
  { name: "KPI", table: "kpi" },
  { name: "Ticket", table: "ticket" },
  { name: "Asset", table: "asset" },
  { name: "Exit", table: "exit" },
  { name: "Clearance", table: "clearance" },
  { name: "Full & Final Input", table: "fnf_input" },
  { name: "Notification", table: "notification" },
  { name: "Approval", table: "approval" },
  { name: "User", table: "\"user\"" },
  { name: "Role", table: "\"role\"" },
  { name: "Permission", table: "\"permission\"" },
  { name: "Audit Log", table: "audit_log" }
];

async function run() {
  console.log("=== RUNNING MIGRATION 016_CORE_DATABASE_ENTITIES.SQL ===");
  const sqlPath = path.join(__dirname, "../migrations/016_core_database_entities.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  await pool.query(sql);
  console.log("Migration 016 executed successfully in PostgreSQL!\n");

  console.log("=== VERIFYING ALL 41 CORE DATABASE ENTITIES ===");
  let verifiedCount = 0;
  for (const ent of ENTITIES_41) {
    try {
      const q = `SELECT count(*) AS cnt FROM ${ent.table}`;
      const res = await pool.query(q);
      const count = parseInt(res.rows[0].cnt, 10);
      console.log(`✓ [${ent.name}] -> Query on '${ent.table}' succeeded with ${count} records`);
      verifiedCount++;
    } catch (err) {
      console.error(`✗ [${ent.name}] -> FAILED on '${ent.table}':`, err.message);
    }
  }

  console.log(`\nVerification Complete: ${verifiedCount} / ${ENTITIES_41.length} entities operational in PostgreSQL.`);
  process.exit(verifiedCount === ENTITIES_41.length ? 0 : 1);
}

run().catch(err => {
  console.error("Migration fatal error:", err);
  process.exit(1);
});
