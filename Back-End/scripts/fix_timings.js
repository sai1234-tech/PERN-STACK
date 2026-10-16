import pool from "../config/db.js";

async function fixTimings() {
  console.log("Checking and fixing clock-in and timesheet timings in database...");

  // 1. Update attendance check_in from 04:00:00 to 09:30:00
  const attCheckInRes = await pool.query(`
    UPDATE attendance
    SET check_in = date + time '09:30:00'
    WHERE to_char(check_in, 'HH24:MI:SS') = '04:00:00'
    RETURNING id, employee_id, date, check_in, check_out;
  `);
  console.log(`Updated ${attCheckInRes.rowCount} attendance check_in records to 09:30 AM.`);

  // 2. Update attendance check_out from 12:45:00 to 18:15:00 (6:15 PM)
  const attCheckOutRes = await pool.query(`
    UPDATE attendance
    SET check_out = date + time '18:15:00'
    WHERE to_char(check_out, 'HH24:MI:SS') = '12:45:00'
    RETURNING id, employee_id, date, check_in, check_out;
  `);
  console.log(`Updated ${attCheckOutRes.rowCount} attendance check_out records to 06:15 PM.`);

  // 3. Update timesheets start_time from 04:00:00 to 09:30:00
  const tsStartRes = await pool.query(`
    UPDATE timesheets
    SET start_time = date + time '09:30:00'
    WHERE to_char(start_time, 'HH24:MI:SS') = '04:00:00'
    RETURNING id, employee_id, date, start_time, end_time;
  `);
  console.log(`Updated ${tsStartRes.rowCount} timesheet start_time records to 09:30 AM.`);

  // 4. Update timesheets end_time from 12:45:00 to 18:15:00
  const tsEndRes1 = await pool.query(`
    UPDATE timesheets
    SET end_time = date + time '18:15:00'
    WHERE to_char(end_time, 'HH24:MI:SS') = '12:45:00'
    RETURNING id, employee_id, date, start_time, end_time;
  `);
  console.log(`Updated ${tsEndRes1.rowCount} timesheet end_time records (8h) to 06:15 PM.`);

  // 5. Update timesheets end_time from 09:00:00 to 14:30:00 (4.5h half-day / Friday)
  const tsEndRes2 = await pool.query(`
    UPDATE timesheets
    SET end_time = date + time '14:30:00'
    WHERE to_char(end_time, 'HH24:MI:SS') = '09:00:00'
    RETURNING id, employee_id, date, start_time, end_time;
  `);
  console.log(`Updated ${tsEndRes2.rowCount} timesheet end_time records (4.5h) to 02:30 PM.`);

  // Verify recent attendance
  const sampleAtt = await pool.query(`
    SELECT a.id, u.name, a.date, a.check_in::text, a.check_out::text, a.working_hours, a.status
    FROM attendance a
    JOIN users u ON a.employee_id = u.id
    ORDER BY a.id DESC
    LIMIT 6;
  `);
  console.log("\nSample attendance records after fix:");
  console.table(sampleAtt.rows);

  process.exit(0);
}

fixTimings().catch((err) => {
  console.error("Error fixing timings:", err);
  process.exit(1);
});
