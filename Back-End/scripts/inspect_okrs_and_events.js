import "dotenv/config";
import pool from "../config/db.js";

async function run() {
  const okrCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'okrs'
  `);
  console.log("OKRs Columns:", okrCols.rows);
  const okrs = await pool.query("SELECT * FROM okrs");
  console.log("OKRs Data:", okrs.rows);

  const eventCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'events'
  `);
  console.log("Events Columns:", eventCols.rows);

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
