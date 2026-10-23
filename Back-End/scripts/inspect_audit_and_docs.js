import pool from "../config/db.js";

async function inspectDocTable() {
  const res = await pool.query("SELECT table_name, table_type FROM information_schema.tables WHERE table_name LIKE '%doc%'");
  console.log("Matching tables/views:", res.rows);
  process.exit(0);
}

inspectDocTable().catch(err => {
  console.error(err);
  process.exit(1);
});
