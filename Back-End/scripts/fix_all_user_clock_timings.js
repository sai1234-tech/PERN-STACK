import pool from "../config/db.js";

async function fixAllUserClockTimings() {
  console.log("Fixing all clock-in and clock-out timings to realistic, accurate times across all users...");

  // 1. Kushangala SaiKiran (user_id = 18, employee_id in timesheets = 14)
  // 16 Oct: clocked in at 9:33 AM (3 min late)
  await pool.query(`
    UPDATE attendance
    SET check_in = '2026-10-16 09:33:00',
        check_out = NULL,
        status = 'late',
        is_late = true,
        late_minutes = 3,
        working_hours = 4.50
    WHERE employee_id = 18 AND date = '2026-10-16';
  `);

  await pool.query(`
    UPDATE timesheets
    SET start_time = '2026-10-16 09:33:00',
        end_time = '2026-10-16 14:33:00'
    WHERE employee_id = 14 AND date = '2026-10-16';
  `);

  // 15 Oct: clocked in at 10:50 AM (80 min late, shift ended 7:35 PM)
  await pool.query(`
    UPDATE attendance
    SET check_in = '2026-10-15 10:50:00',
        check_out = '2026-10-15 19:35:00',
        status = 'late',
        is_late = true,
        late_minutes = 80,
        working_hours = 8.00
    WHERE employee_id = 18 AND date = '2026-10-15';
  `);

  await pool.query(`
    UPDATE timesheets
    SET start_time = '2026-10-15 10:50:00',
        end_time = '2026-10-15 19:35:00'
    WHERE employee_id = 14 AND date = '2026-10-15';
  `);

  // 14 Oct: clocked in at 09:45 AM (15 min late)
  await pool.query(`
    UPDATE attendance
    SET check_in = '2026-10-14 09:45:00',
        check_out = '2026-10-14 18:30:00',
        status = 'late',
        is_late = true,
        late_minutes = 15,
        working_hours = 8.00
    WHERE employee_id = 18 AND date = '2026-10-14';
  `);

  await pool.query(`
    UPDATE timesheets
    SET start_time = '2026-10-14 09:45:00',
        end_time = '2026-10-14 18:30:00'
    WHERE employee_id = 14 AND date = '2026-10-14';
  `);

  // 13 Oct: on time at 09:27 AM
  await pool.query(`
    UPDATE attendance
    SET check_in = '2026-10-13 09:27:00',
        check_out = '2026-10-13 18:15:00',
        status = 'present',
        is_late = false,
        late_minutes = 0,
        working_hours = 8.00
    WHERE employee_id = 18 AND date = '2026-10-13';
  `);

  await pool.query(`
    UPDATE timesheets
    SET start_time = '2026-10-13 09:27:00',
        end_time = '2026-10-13 18:15:00'
    WHERE employee_id = 14 AND date = '2026-10-13';
  `);

  // 12 Oct: 09:40 AM (10 min late)
  await pool.query(`
    UPDATE attendance
    SET check_in = '2026-10-12 09:40:00',
        check_out = '2026-10-12 18:25:00',
        status = 'late',
        is_late = true,
        late_minutes = 10,
        working_hours = 8.00
    WHERE employee_id = 18 AND date = '2026-10-12';
  `);

  await pool.query(`
    UPDATE timesheets
    SET start_time = '2026-10-12 09:40:00',
        end_time = '2026-10-12 18:25:00'
    WHERE employee_id = 14 AND date = '2026-10-12';
  `);

  // 2. Sandhya Rani (user_id = 21, employee_id in timesheets = 16)
  await pool.query(`
    UPDATE attendance SET check_in = '2026-10-16 10:03:00', check_out = NULL, status = 'late', is_late = true, late_minutes = 33 WHERE employee_id = 21 AND date = '2026-10-16';
    UPDATE attendance SET check_in = '2026-10-15 10:45:00', check_out = '2026-10-15 19:30:00', status = 'late', is_late = true, late_minutes = 75 WHERE employee_id = 21 AND date = '2026-10-15';
    UPDATE attendance SET check_in = '2026-10-14 09:25:00', check_out = '2026-10-14 18:15:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 21 AND date = '2026-10-14';
    UPDATE attendance SET check_in = '2026-10-13 09:28:00', check_out = '2026-10-13 18:18:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 21 AND date = '2026-10-13';
    UPDATE attendance SET check_in = '2026-10-12 09:24:00', check_out = '2026-10-12 18:15:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 21 AND date = '2026-10-12';
    
    UPDATE timesheets SET start_time = '2026-10-16 10:03:00', end_time = '2026-10-16 14:33:00' WHERE employee_id = 16 AND date = '2026-10-16';
    UPDATE timesheets SET start_time = '2026-10-15 10:45:00', end_time = '2026-10-15 19:30:00' WHERE employee_id = 16 AND date = '2026-10-15';
    UPDATE timesheets SET start_time = '2026-10-14 09:25:00', end_time = '2026-10-14 18:15:00' WHERE employee_id = 16 AND date = '2026-10-14';
    UPDATE timesheets SET start_time = '2026-10-13 09:28:00', end_time = '2026-10-13 18:18:00' WHERE employee_id = 16 AND date = '2026-10-13';
    UPDATE timesheets SET start_time = '2026-10-12 09:24:00', end_time = '2026-10-12 18:15:00' WHERE employee_id = 16 AND date = '2026-10-12';
  `);

  // 3. Ananya Varma (user_id = 15, employee_id in timesheets = 11)
  await pool.query(`
    UPDATE attendance SET check_in = '2026-10-16 09:22:00', check_out = NULL, status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 15 AND date = '2026-10-16';
    UPDATE attendance SET check_in = '2026-10-15 09:26:00', check_out = '2026-10-15 18:16:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 15 AND date = '2026-10-15';
    UPDATE attendance SET check_in = '2026-10-14 09:25:00', check_out = '2026-10-14 18:15:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 15 AND date = '2026-10-14';
    UPDATE attendance SET check_in = '2026-10-13 09:28:00', check_out = '2026-10-13 18:18:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 15 AND date = '2026-10-13';
    UPDATE attendance SET check_in = '2026-10-12 09:42:00', check_out = '2026-10-12 18:27:00', status = 'late', is_late = true, late_minutes = 12 WHERE employee_id = 15 AND date = '2026-10-12';

    UPDATE timesheets SET start_time = '2026-10-16 09:22:00', end_time = '2026-10-16 14:22:00' WHERE employee_id = 11 AND date = '2026-10-16';
    UPDATE timesheets SET start_time = '2026-10-15 09:26:00', end_time = '2026-10-15 18:16:00' WHERE employee_id = 11 AND date = '2026-10-15';
    UPDATE timesheets SET start_time = '2026-10-14 09:25:00', end_time = '2026-10-14 18:15:00' WHERE employee_id = 11 AND date = '2026-10-14';
    UPDATE timesheets SET start_time = '2026-10-13 09:28:00', end_time = '2026-10-13 18:18:00' WHERE employee_id = 11 AND date = '2026-10-13';
    UPDATE timesheets SET start_time = '2026-10-12 09:42:00', end_time = '2026-10-12 18:27:00' WHERE employee_id = 11 AND date = '2026-10-12';
  `);

  // 4. Lakshmi Ragula (user_id = 16, employee_id in timesheets = 12)
  await pool.query(`
    UPDATE attendance SET check_in = '2026-10-16 09:27:00', check_out = NULL, status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 16 AND date = '2026-10-16';
    UPDATE attendance SET check_in = '2026-10-15 09:24:00', check_out = '2026-10-15 18:15:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 16 AND date = '2026-10-15';
    UPDATE attendance SET check_in = '2026-10-14 09:48:00', check_out = '2026-10-14 18:33:00', status = 'late', is_late = true, late_minutes = 18 WHERE employee_id = 16 AND date = '2026-10-14';
    UPDATE attendance SET check_in = '2026-10-13 09:29:00', check_out = '2026-10-13 18:19:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 16 AND date = '2026-10-13';
    UPDATE attendance SET check_in = '2026-10-12 09:45:00', check_out = '2026-10-12 18:30:00', status = 'late', is_late = true, late_minutes = 15 WHERE employee_id = 16 AND date = '2026-10-12';

    UPDATE timesheets SET start_time = '2026-10-16 09:27:00', end_time = '2026-10-16 14:27:00' WHERE employee_id = 12 AND date = '2026-10-16';
    UPDATE timesheets SET start_time = '2026-10-15 09:24:00', end_time = '2026-10-15 18:15:00' WHERE employee_id = 12 AND date = '2026-10-15';
    UPDATE timesheets SET start_time = '2026-10-14 09:48:00', end_time = '2026-10-14 18:33:00' WHERE employee_id = 12 AND date = '2026-10-14';
    UPDATE timesheets SET start_time = '2026-10-13 09:29:00', end_time = '2026-10-13 18:19:00' WHERE employee_id = 12 AND date = '2026-10-13';
    UPDATE timesheets SET start_time = '2026-10-12 09:45:00', end_time = '2026-10-12 18:30:00' WHERE employee_id = 12 AND date = '2026-10-12';
  `);

  // 5. Vikas Guru (user_id = 17, employee_id in timesheets = 13)
  await pool.query(`
    UPDATE attendance SET check_in = '2026-10-16 09:25:00', check_out = NULL, status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 17 AND date = '2026-10-16';
    UPDATE attendance SET check_in = '2026-10-15 09:28:00', check_out = '2026-10-15 18:18:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 17 AND date = '2026-10-15';
    UPDATE attendance SET check_in = '2026-10-14 09:45:00', check_out = '2026-10-14 18:30:00', status = 'late', is_late = true, late_minutes = 15 WHERE employee_id = 17 AND date = '2026-10-14';
    UPDATE attendance SET check_in = '2026-10-13 09:24:00', check_out = '2026-10-13 18:15:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 17 AND date = '2026-10-13';
    UPDATE attendance SET check_in = '2026-10-12 09:26:00', check_out = '2026-10-12 18:16:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 17 AND date = '2026-10-12';

    UPDATE timesheets SET start_time = '2026-10-16 09:25:00', end_time = '2026-10-16 14:25:00' WHERE employee_id = 13 AND date = '2026-10-16';
    UPDATE timesheets SET start_time = '2026-10-15 09:28:00', end_time = '2026-10-15 18:18:00' WHERE employee_id = 13 AND date = '2026-10-15';
    UPDATE timesheets SET start_time = '2026-10-14 09:45:00', end_time = '2026-10-14 18:30:00' WHERE employee_id = 13 AND date = '2026-10-14';
    UPDATE timesheets SET start_time = '2026-10-13 09:24:00', end_time = '2026-10-13 18:15:00' WHERE employee_id = 13 AND date = '2026-10-13';
    UPDATE timesheets SET start_time = '2026-10-12 09:26:00', end_time = '2026-10-12 18:16:00' WHERE employee_id = 13 AND date = '2026-10-12';
  `);

  // 6. Anilk (user_id = 20, employee_id in timesheets = 15)
  await pool.query(`
    UPDATE attendance SET check_in = '2026-10-16 09:26:00', check_out = NULL, status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 20 AND date = '2026-10-16';
    UPDATE attendance SET check_in = '2026-10-15 09:25:00', check_out = '2026-10-15 18:15:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 20 AND date = '2026-10-15';
    UPDATE attendance SET check_in = '2026-10-14 09:27:00', check_out = '2026-10-14 18:17:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 20 AND date = '2026-10-14';
    UPDATE attendance SET check_in = '2026-10-13 09:24:00', check_out = '2026-10-13 18:15:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 20 AND date = '2026-10-13';
    UPDATE attendance SET check_in = '2026-10-12 09:28:00', check_out = '2026-10-12 18:18:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 20 AND date = '2026-10-12';

    UPDATE timesheets SET start_time = '2026-10-16 09:26:00', end_time = '2026-10-16 14:26:00' WHERE employee_id = 15 AND date = '2026-10-16';
    UPDATE timesheets SET start_time = '2026-10-15 09:25:00', end_time = '2026-10-15 18:15:00' WHERE employee_id = 15 AND date = '2026-10-15';
    UPDATE timesheets SET start_time = '2026-10-14 09:27:00', end_time = '2026-10-14 18:17:00' WHERE employee_id = 15 AND date = '2026-10-14';
    UPDATE timesheets SET start_time = '2026-10-13 09:24:00', end_time = '2026-10-13 18:15:00' WHERE employee_id = 15 AND date = '2026-10-13';
    UPDATE timesheets SET start_time = '2026-10-12 09:28:00', end_time = '2026-10-12 18:18:00' WHERE employee_id = 15 AND date = '2026-10-12';
  `);

  // 7. Sai Kiran (user_id = 1, employee_id in timesheets = 135)
  await pool.query(`
    UPDATE attendance SET check_in = '2026-10-16 09:28:00', check_out = NULL, status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 1 AND date = '2026-10-16';
    UPDATE attendance SET check_in = '2026-10-15 09:25:00', check_out = '2026-10-15 18:15:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 1 AND date = '2026-10-15';
    UPDATE attendance SET check_in = '2026-10-14 09:26:00', check_out = '2026-10-14 18:16:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 1 AND date = '2026-10-14';
    UPDATE attendance SET check_in = '2026-10-13 09:27:00', check_out = '2026-10-13 18:17:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 1 AND date = '2026-10-13';
    UPDATE attendance SET check_in = '2026-10-12 09:24:00', check_out = '2026-10-12 18:15:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 1 AND date = '2026-10-12';

    UPDATE timesheets SET start_time = '2026-10-16 09:28:00', end_time = '2026-10-16 14:28:00' WHERE employee_id = 135 AND date = '2026-10-16';
    UPDATE timesheets SET start_time = '2026-10-15 09:25:00', end_time = '2026-10-15 18:15:00' WHERE employee_id = 135 AND date = '2026-10-15';
    UPDATE timesheets SET start_time = '2026-10-14 09:26:00', end_time = '2026-10-14 18:16:00' WHERE employee_id = 135 AND date = '2026-10-14';
    UPDATE timesheets SET start_time = '2026-10-13 09:27:00', end_time = '2026-10-13 18:17:00' WHERE employee_id = 135 AND date = '2026-10-13';
    UPDATE timesheets SET start_time = '2026-10-12 09:24:00', end_time = '2026-10-12 18:15:00' WHERE employee_id = 135 AND date = '2026-10-12';
  `);

  // 8. SandhyaRani (user_id = 6, employee_id in timesheets = 139)
  await pool.query(`
    UPDATE attendance SET check_in = '2026-10-16 09:25:00', check_out = NULL, status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 6 AND date = '2026-10-16';
    UPDATE attendance SET check_in = '2026-10-15 09:28:00', check_out = '2026-10-15 18:18:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 6 AND date = '2026-10-15';
    UPDATE attendance SET check_in = '2026-10-14 09:24:00', check_out = '2026-10-14 18:15:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 6 AND date = '2026-10-14';
    UPDATE attendance SET check_in = '2026-10-13 09:27:00', check_out = '2026-10-13 18:17:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 6 AND date = '2026-10-13';
    UPDATE attendance SET check_in = '2026-10-12 09:26:00', check_out = '2026-10-12 18:16:00', status = 'present', is_late = false, late_minutes = 0 WHERE employee_id = 6 AND date = '2026-10-12';

    UPDATE timesheets SET start_time = '2026-10-16 09:25:00', end_time = '2026-10-16 14:25:00' WHERE employee_id = 139 AND date = '2026-10-16';
    UPDATE timesheets SET start_time = '2026-10-15 09:28:00', end_time = '2026-10-15 18:18:00' WHERE employee_id = 139 AND date = '2026-10-15';
    UPDATE timesheets SET start_time = '2026-10-14 09:24:00', end_time = '2026-10-14 18:15:00' WHERE employee_id = 139 AND date = '2026-10-14';
    UPDATE timesheets SET start_time = '2026-10-13 09:27:00', end_time = '2026-10-13 18:17:00' WHERE employee_id = 139 AND date = '2026-10-13';
    UPDATE timesheets SET start_time = '2026-10-12 09:26:00', end_time = '2026-10-12 18:16:00' WHERE employee_id = 139 AND date = '2026-10-12';
  `);

  console.log("Successfully updated all attendance and timesheet timings!");

  // Verify Kushangala SaiKiran (user 18)
  const kushRes = await pool.query(`
    SELECT a.id, a.date, a.check_in::text, a.check_out::text, a.status, a.is_late, a.late_minutes 
    FROM attendance a 
    WHERE a.employee_id = 18 
    ORDER BY a.date DESC
  `);
  console.log("\nKushangala SaiKiran attendance after fix:");
  console.table(kushRes.rows);

  const kushTs = await pool.query(`
    SELECT id, date, start_time::text, end_time::text, hours, status 
    FROM timesheets 
    WHERE employee_id = 14 
    ORDER BY date DESC
  `);
  console.log("\nKushangala SaiKiran timesheets after fix:");
  console.table(kushTs.rows);

  process.exit(0);
}

fixAllUserClockTimings().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
