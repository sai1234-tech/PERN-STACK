import pool from "../config/db.js";

async function inspectAdmins() {
  const users = await pool.query("SELECT id, email, role FROM users WHERE role IN ('admin', 'super_admin')");
  console.log("Admin users:", users.rows);
  process.exit(0);
}

inspectAdmins().catch(err => {
  console.error(err);
  process.exit(1);
});
