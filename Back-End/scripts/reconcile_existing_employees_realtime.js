import "dotenv/config";
import pool from "../config/db.js";

async function reconcile() {
  console.log("=== RECONCILING ALL EXISTING EMPLOYEES ACROSS REALTIME MODULES ===");

  const { rows: emps } = await pool.query(`
    SELECT id, user_id, employee_code, first_name, last_name, email,
           COALESCE(employment->>'department', 'Engineering') as department,
           COALESCE(employment->>'designation', 'Software Engineer') as designation,
           COALESCE(NULLIF(employment->>'salary', '')::numeric, 50000) as salary,
           COALESCE(employment->>'status', 'Active') as status
    FROM employees
    WHERE LOWER(COALESCE(employment->>'status', 'Active')) = 'active'
    ORDER BY id ASC;
  `);

  console.log(`Found ${emps.length} active employees in PostgreSQL.`);

  const curMonth = `${new Date().toISOString().slice(0, 7)}-01`;
  const defaultAdminId = 1;

  let allocCount = 0;
  let itCount = 0;
  let payCount = 0;
  let bioCount = 0;

  for (const emp of emps) {
    const fullName = `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || emp.email;

    // 1. Resource Allocation (On Bench if not allocated)
    const allocCheck = await pool.query(`SELECT id FROM project_allocations WHERE emp_id = $1`, [String(emp.id)]);
    if (allocCheck.rows.length === 0) {
      await pool.query(`
        INSERT INTO project_allocations (
          emp_id, employee_name, employee_code, department, role,
          project_name, client_name, status, billability,
          allocation_percentage, start_date, notes
        ) VALUES (
          $1, $2, $3, $4, $5,
          '', 'Internal Cost Center', 'Bench', 'Internal',
          0, CURRENT_DATE, 'Auto-provisioned on bench'
        );
      `, [String(emp.id), fullName, emp.employee_code, emp.department, emp.designation]);
      allocCount++;
    }

    // 2. IT Asset Provisioning Jobs
    const itCheck = await pool.query(`SELECT id FROM it_asset_provisioning_jobs WHERE employee_id = $1`, [emp.id]);
    if (itCheck.rows.length === 0) {
      const itCode = `IT-PROV-${Date.now().toString().slice(-4)}-${emp.id}`;
      await pool.query(`
        INSERT INTO it_asset_provisioning_jobs (
          request_code, target_system, employee_id, employee_name, item_type, status, assigned_serial_or_license
        ) VALUES (
          $1, 'Jira Service Management', $2, $3, 'LAPTOP_HARDWARE', 'PROVISIONED', 'Dell Latitude / Mac Enterprise Profile'
        );
      `, [itCode, emp.id, fullName]);
      itCount++;
    }

    // 3. Payrolls for current month
    const payCheck = await pool.query(`SELECT id FROM payrolls WHERE employee_id = $1 AND month = $2`, [emp.id, curMonth]);
    if (payCheck.rows.length === 0) {
      const basic = Math.round(emp.salary * 0.5);
      const allowances = Math.round(emp.salary * 0.3);
      const bonus = 0;
      const gross = basic + allowances + bonus;
      const tax = Math.round(gross * 0.1);
      const pf = Math.round(basic * 0.12);
      const totalDeductions = tax + pf;
      const net = gross - totalDeductions;

      await pool.query(`
        INSERT INTO payrolls (
          employee_id, month, basic_salary, allowances, bonus, tax, pf, deduction,
          gross_salary, total_deductions, net_salary, status, generated_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 0,
          $8, $9, $10, 'generated', $11
        );
      `, [emp.id, curMonth, basic, allowances, bonus, tax, pf, gross, totalDeductions, net, emp.user_id || defaultAdminId]);
      payCount++;
    }

    // 4. Biometric terminal enrollment punch
    const bioCheck = await pool.query(`SELECT id FROM biometric_punch_logs WHERE employee_code = $1`, [emp.employee_code]);
    if (bioCheck.rows.length === 0) {
      await pool.query(`
        INSERT INTO biometric_punch_logs (
          device_id, terminal_ip, employee_code, punch_time, punch_type, verification_mode, is_processed
        ) VALUES (
          'ZKT-HYD-TOWER-B-01', '192.168.10.15', $1, CURRENT_TIMESTAMP, 'ENROLLMENT', 'FACIAL_RECOGNITION', true
        );
      `, [emp.employee_code]);
      bioCount++;
    }
  }

  // Update scalability capacity metrics
  await pool.query(`
    UPDATE scalability_capacity_metrics 
    SET current_value = (SELECT count(*) FROM employees WHERE LOWER(COALESCE(employment->>'status', 'Active')) = 'active'),
        last_updated_at = CURRENT_TIMESTAMP
    WHERE metric_dimension = 'ACTIVE_EMPLOYEES';
  `);

  console.log(`✓ Reconciled ${allocCount} new Project Allocations (on bench).`);
  console.log(`✓ Reconciled ${itCount} new IT Asset Provisioning Jobs.`);
  console.log(`✓ Reconciled ${payCount} new Payroll records for month ${curMonth}.`);
  console.log(`✓ Reconciled ${bioCount} new Biometric enrollment punches.`);
  console.log("=== COMPLETED REALTIME EMPLOYEE RECONCILIATION ===");
  process.exit(0);
}

reconcile().catch(err => {
  console.error("Reconciliation error:", err);
  process.exit(1);
});
