import "dotenv/config";
import pool from "../config/db.js";

async function checkArjun() {
  const userId = 14;
  const empId = 197;
  console.log(`Checking data for Arjun Reddy (user_id: ${userId}, employee_id: ${empId}, code: EMP-2014):`);

  const att = await pool.query("SELECT count(*) FROM attendance WHERE employee_id = $1", [userId]);
  console.log(`- Attendance rows (user_id ${userId}):`, att.rows[0].count);

  const leaves = await pool.query("SELECT count(*) FROM leaves WHERE employee_id = $1", [empId]);
  console.log(`- Leaves rows (employee_id ${empId}):`, leaves.rows[0].count);

  const timesheets = await pool.query("SELECT count(*) FROM timesheets WHERE employee_id = $1", [userId]);
  console.log(`- Timesheets rows (user_id ${userId}):`, timesheets.rows[0].count);

  const payrolls = await pool.query("SELECT count(*) FROM payrolls WHERE employee_id = $1", [empId]);
  console.log(`- Payrolls rows (employee_id ${empId}):`, payrolls.rows[0].count);

  const okrs = await pool.query("SELECT count(*) FROM okrs WHERE employee_id = $1", [empId]);
  console.log(`- OKRs rows (employee_id ${empId}):`, okrs.rows[0].count);

  const tickets = await pool.query("SELECT count(*) FROM tickets WHERE emp_id ILIKE $1 OR emp_id ILIKE $2", ['%EMP-2014%', '%Arjun%']);
  console.log(`- Tickets matching EMP-2014 / Arjun:`, tickets.rows[0].count);

  const events = await pool.query("SELECT count(*) FROM events WHERE employee_id = $1", [empId]);
  console.log(`- Events rows (employee_id ${empId}):`, events.rows[0].count);

  const resignations = await pool.query("SELECT count(*) FROM resignations WHERE employee_id = $1", [empId]);
  console.log(`- Resignations rows (employee_id ${empId}):`, resignations.rows[0].count);

  const clearances = await pool.query("SELECT count(*) FROM clearances WHERE employee_id = $1", [empId]);
  console.log(`- Clearances rows (employee_id ${empId}):`, clearances.rows[0].count);

  process.exit(0);
}

checkArjun().catch(e => { console.error(e); process.exit(1); });
