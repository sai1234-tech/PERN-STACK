import pool from '../config/db.js';

async function main() {
  const tablesRes = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  const tables = tablesRes.rows.map(r => r.table_name).sort();
  console.log('ALL PUBLIC TABLES:', tables);

  const counts = {};
  for (const t of tables) {
    try {
      const c = await pool.query(`SELECT COUNT(*) FROM "${t}"`);
      counts[t] = Number(c.rows[0].count);
    } catch (e) {
      counts[t] = 'Error: ' + e.message;
    }
  }
  console.table(counts);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
