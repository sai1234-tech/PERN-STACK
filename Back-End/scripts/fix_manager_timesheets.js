import pool from "../config/db.js";

async function main() {
  console.log("Updating timesheets for real-time manager review...");

  // 1. Set dates 2026-10-15 and 2026-10-16 to 'submitted' for Vikas Guru's team (14, 16, 135, 139)
  const r1 = await pool.query(`
    UPDATE timesheets 
    SET status = 'submitted', reviewed_by = NULL, reviewed_at = NULL, review_comment = '', submitted_at = '2026-10-16 18:30:00'
    WHERE employee_id IN (14, 16, 135, 139) AND date IN ('2026-10-15', '2026-10-16')
    RETURNING id, employee_id, date, task, status;
  `);
  console.log("Updated to submitted (awaiting manager review):", r1.rowCount);
  console.table(r1.rows);

  // 2. Set earlier approved records to have reviewed_by = 17 (Vikas Guru, Manager)
  const r2 = await pool.query(`
    UPDATE timesheets
    SET reviewed_by = 17, reviewed_at = '2026-10-14 18:30:00'
    WHERE employee_id IN (14, 16, 135, 139) AND date < '2026-10-15' AND status = 'approved' AND (reviewed_by IS NULL OR reviewed_by = 16)
    RETURNING id, employee_id, date, status, reviewed_by;
  `);
  console.log("Updated historical approved to show reviewed by Vikas Guru (17):", r2.rowCount);

  console.log("Database update complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
