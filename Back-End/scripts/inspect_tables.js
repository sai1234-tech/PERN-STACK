import pool from "../config/db.js";

async function inspect() {
  const tsRes = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'timesheets' ORDER BY ordinal_position"
  );
  console.log("TIMESHEETS COLUMNS:", tsRes.rows.map(r => `${r.column_name} (${r.data_type})`));

  const lvRes = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'leaves' ORDER BY ordinal_position"
  );
  console.log("LEAVES COLUMNS:", lvRes.rows.map(r => `${r.column_name} (${r.data_type})`));

  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
