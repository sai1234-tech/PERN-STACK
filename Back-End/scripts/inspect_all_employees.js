import pool from '../config/db.js';

async function main() {
  const emps = await pool.query(`
    SELECT e.id, e.user_id, e.employee_code, e.first_name, e.last_name, e.email, 
           (e.employment->>'department') as dept, 
           (e.employment->>'designation') as desig, 
           (e.employment->>'salary')::numeric as salary,
           (e.employment->>'status') as status
    FROM employees e
    ORDER BY e.id ASC
  `);
  console.log('TOTAL EMPLOYEES IN DB:', emps.rows.length);
  console.table(emps.rows);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
