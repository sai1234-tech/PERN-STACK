import "dotenv/config";
import pool from "../config/db.js";

async function copyTimesheetsToArjun() {
  const arjunEmpId = 197;
  const existingTimesheets = await pool.query("SELECT * FROM timesheets WHERE employee_id = 14");
  
  console.log(`Found ${existingTimesheets.rows.length} timesheets with employee_id = 14.`);
  for (const t of existingTimesheets.rows) {
    const existing = await pool.query(
      "SELECT id FROM timesheets WHERE employee_id = $1 AND date = $2",
      [arjunEmpId, t.date]
    );
    if (existing.rows.length === 0) {
      await pool.query(`
        INSERT INTO timesheets (
          employee_id, date, project, client, cost_center, task, description,
          start_time, end_time, break_minutes, entry_mode, billable, hours,
          status, submitted_at, reviewed_by, reviewed_at, review_comment,
          manager_approved_by, manager_approved_at, manager_remarks,
          hr_approved_by, hr_approved_at, hr_remarks, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
        )
      `, [
        arjunEmpId, t.date, t.project, t.client, t.cost_center, t.task, t.description,
        t.start_time, t.end_time, t.break_minutes, t.entry_mode, t.billable, t.hours,
        t.status, t.submitted_at, t.reviewed_by, t.reviewed_at, t.review_comment,
        t.manager_approved_by, t.manager_approved_at, t.manager_remarks,
        t.hr_approved_by, t.hr_approved_at, t.hr_remarks, t.created_at, t.updated_at
      ]);
      console.log(`  + Copied timesheet for date ${t.date} to Arjun Reddy (empId: 197)`);
    }
  }

  const countRes = await pool.query("SELECT count(*) FROM timesheets WHERE employee_id = $1", [arjunEmpId]);
  console.log(`Arjun Reddy (empId: 197) now has ${countRes.rows[0].count} timesheet records.`);
  process.exit(0);
}

copyTimesheetsToArjun().catch(e => { console.error(e); process.exit(1); });
