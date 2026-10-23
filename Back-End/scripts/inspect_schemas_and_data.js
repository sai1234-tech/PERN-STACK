import "dotenv/config";
import pool from "../config/db.js";

async function run() {
  const tables = ['okrs', 'payrolls', 'candidates', 'tickets', 'events', 'employee_documents', 'leaves'];
  for (const t of tables) {
    console.log(`\n================= TABLE: ${t} =================`);
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `, [t]);
    console.log("Columns:", cols.rows.map(c => `${c.column_name} (${c.data_type})`).join(", "));

    const sample = await pool.query(`SELECT * FROM ${t} LIMIT 2`);
    console.log(`Sample (up to 2 rows):`, JSON.stringify(sample.rows, null, 2));
  }
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
