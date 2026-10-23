import pool from '../config/db.js';

async function main() {
  try {
    const empCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'employees'");
    console.log('EMPLOYEES COLUMNS:', empCols.rows.map(r => r.column_name).join(', '));

    const emps = await pool.query('SELECT * FROM employees LIMIT 5');
    console.log('\n--- EMPLOYEES SAMPLE (first 2) ---');
    console.log(JSON.stringify(emps.rows.slice(0, 2), null, 2));

    const resCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'resignations'");
    console.log('\nRESIGNATIONS COLUMNS:', resCols.rows.map(r => r.column_name).join(', '));

    const res = await pool.query('SELECT * FROM resignations');
    console.log('RESIGNATIONS COUNT:', res.rows.length);
    console.log(JSON.stringify(res.rows, null, 2));

    const clrCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'clearances'");
    console.log('\nCLEARANCES COLUMNS:', clrCols.rows.map(r => r.column_name).join(', '));

    const clr = await pool.query('SELECT * FROM clearances');
    console.log('CLEARANCES COUNT:', clr.rows.length);
    console.log(JSON.stringify(clr.rows, null, 2));

    const depts = await pool.query('SELECT * FROM departments');
    console.log('\nDEPARTMENTS (' + depts.rows.length + '):');
    console.table(depts.rows);

    const audits = await pool.query('SELECT * FROM audit_logs LIMIT 5');
    console.log('\nAUDIT LOGS COUNT:', audits.rows.length);
    console.table(audits.rows);

    process.exit(0);
  } catch (err) {
    console.error("Query Error:", err);
    process.exit(1);
  }
}

main();
