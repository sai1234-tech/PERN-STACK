import pool from '../config/db.js';

async function audit() {
  console.log("=== CHECKING EMPLOYEES COLUMNS ===");
  const empCols = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'employees'
    ORDER BY ordinal_position
  `);
  console.log(empCols.rows.map(r => `${r.column_name} (${r.data_type})`).join("\n"));

  console.log("\n=== CHECKING RELATED TABLES ===");
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  console.log(tables.rows.map(r => r.table_name).join(", "));

  console.log("\n=== SAMPLE EMPLOYEE RECORD ===");
  const sample = await pool.query(`SELECT * FROM employees LIMIT 1`);
  console.log(JSON.stringify(sample.rows[0], null, 2));

  process.exit(0);
}

audit().catch(console.error);
