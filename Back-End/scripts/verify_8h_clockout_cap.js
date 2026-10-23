import http from 'http';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import pool from '../config/db.js';
import { autoClockOutOverEightHours } from '../repositories/attendanceRepository.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'pern_hrms_secret_jwt_key_2026!@#';

function apiCall(endpoint, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const customHeaders = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    if (payload) customHeaders['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request({
      hostname: 'localhost',
      port: 5005,
      path: endpoint,
      method,
      headers: customHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', err => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

async function verifyEightHourClockoutRule() {
  console.log("================================================================================");
  console.log("      VERIFYING STRICT 8-HOUR MAXIMUM CLOCK-IN & AUTO CLOCK-OUT POLICY          ");
  console.log("================================================================================");

  try {
    // 1. Pick test employee user
    const userRes = await pool.query("SELECT * FROM users WHERE role = 'employee' LIMIT 1");
    const testUser = userRes.rows[0];
    if (!testUser) throw new Error("No test employee found in database.");

    const token = jwt.sign({ userId: testUser.id, role: 'employee' }, JWT_SECRET, { expiresIn: '8h' });
    console.log(`✓ Test employee: ${testUser.name} (User ID: ${testUser.id})`);

    const todayDate = new Date().toISOString().slice(0, 10);

    // 2. Clear any existing attendance for today for clean test
    await pool.query("DELETE FROM attendance WHERE employee_id = $1 AND date = $2", [testUser.id, todayDate]);
    console.log("✓ Reset today's attendance record for clean deterministic simulation.");

    // -------------------------------------------------------------------------
    // TEST 1: Simulate active clock-in 9.5 hours ago (> 8 hours)
    // -------------------------------------------------------------------------
    console.log("\n>>> TEST 1: Simulating active clock-in that exceeded 8 hours (9.5 hours ago)...");
    const nineAndHalfHoursAgo = new Date(Date.now() - 9.5 * 60 * 60 * 1000);
    
    const insertRes = await pool.query(
      `INSERT INTO attendance (employee_id, date, check_in, check_out, status, is_late, late_minutes)
       VALUES ($1, $2, $3, NULL, 'present', false, 0)
       RETURNING *`,
      [testUser.id, todayDate, nineAndHalfHoursAgo]
    );
    const activeShift = insertRes.rows[0];
    console.log(`✓ Seeded unclosed shift started at: ${new Date(activeShift.check_in).toLocaleTimeString()} (Active 9.5h ago)`);

    // -------------------------------------------------------------------------
    // TEST 2: Run autoClockOutOverEightHours repository engine
    // -------------------------------------------------------------------------
    console.log("\n>>> TEST 2: Executing autoClockOutOverEightHours()...");
    const closed = await autoClockOutOverEightHours(testUser.id);
    console.log(`✓ Auto-close engine executed. Records closed: ${closed.length}`);

    if (closed.length !== 1) {
      throw new Error(`Expected exactly 1 record closed, but got ${closed.length}`);
    }

    const closedRecord = closed[0];
    const checkInMs = new Date(closedRecord.check_in).getTime();
    const checkOutMs = new Date(closedRecord.check_out).getTime();
    const actualDurationHours = (checkOutMs - checkInMs) / (1000 * 60 * 60);

    console.log(`   - Stored Working Hours: ${closedRecord.working_hours} hrs`);
    console.log(`   - Stored Overtime Hours: ${closedRecord.overtime_hours} hrs`);
    console.log(`   - Computed Duration:     ${actualDurationHours.toFixed(2)} hrs`);
    console.log(`   - Remarks:               "${closedRecord.remarks}"`);

    if (actualDurationHours !== 8.0 || Number(closedRecord.working_hours) !== 8.0) {
      throw new Error(`Clockout was not capped at exactly 8 hours! Duration: ${actualDurationHours}`);
    }
    console.log("✓ TEST 2 PASSED: Active clock-in exceeding 8 hours was auto-clocked out at exactly 8h limit.");

    // -------------------------------------------------------------------------
    // TEST 3: Verify GET /api/v1/attendance/today reflects completed 8-hour shift
    // -------------------------------------------------------------------------
    console.log("\n>>> TEST 3: Calling GET /api/v1/attendance/today via API...");
    const todayRes = await apiCall('/api/v1/attendance/today', 'GET', null, token);
    console.log(`✓ API Response Status: ${todayRes.status}`);
    console.log(`   - Check In:      ${todayRes.data?.data?.attendance?.checkIn}`);
    console.log(`   - Check Out:     ${todayRes.data?.data?.attendance?.checkOut}`);
    console.log(`   - Working Hours: ${todayRes.data?.data?.attendance?.workingHours} hrs`);

    if (!todayRes.data?.data?.attendance?.checkOut || Number(todayRes.data?.data?.attendance?.workingHours) !== 8.0) {
      throw new Error("API did not return closed 8-hour attendance record!");
    }
    console.log("✓ TEST 3 PASSED: Today attendance endpoint verifies shift is closed at 8 hours.");

    // -------------------------------------------------------------------------
    // TEST 4: Attempting to Clock-In again when 8 hours completed must be blocked
    // -------------------------------------------------------------------------
    console.log("\n>>> TEST 4: Attempting to Clock-In again after 8-hour limit reached...");
    const reClockIn = await apiCall('/api/v1/attendance/check-in', 'POST', {}, token);
    console.log(`✓ Clock-In Rejection Status: ${reClockIn.status} (Expected 400)`);
    console.log(`   - Rejection Message: "${reClockIn.data?.message}"`);

    if (reClockIn.status !== 400 || !reClockIn.data?.message?.includes("8 hours")) {
      throw new Error("System allowed clock-in after 8-hour limit was reached!");
    }
    console.log("✓ TEST 4 PASSED: Re-clocking in beyond 8 hours is strictly blocked.");

    // -------------------------------------------------------------------------
    // TEST 5: Manual check-out on a >8h shift clamps at 8 hours
    // -------------------------------------------------------------------------
    console.log("\n>>> TEST 5: Testing manual check-out clamping when raw shift > 8h...");
    // Update shift to remove check_out and set check_in to 10 hours ago
    const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000);
    await pool.query(
      `UPDATE attendance SET check_out = NULL, working_hours = NULL, check_in = $1 WHERE id = $2`,
      [tenHoursAgo, closedRecord.id]
    );

    const manualCheckOutRes = await apiCall('/api/v1/attendance/check-out', 'POST', {}, token);
    console.log(`✓ Manual Check-Out Status: ${manualCheckOutRes.status}`);
    console.log(`   - Message:       "${manualCheckOutRes.data?.message}"`);
    console.log(`   - Working Hours: ${manualCheckOutRes.data?.data?.attendance?.workingHours} hrs`);
    console.log(`   - Remarks:       "${manualCheckOutRes.data?.data?.attendance?.remarks}"`);

    if (Number(manualCheckOutRes.data?.data?.attendance?.workingHours) !== 8.0) {
      throw new Error("Manual check-out did not cap working hours at 8.0!");
    }
    console.log("✓ TEST 5 PASSED: Manual check-out capped working hours at 8.0 hours.");

    console.log("\n================================================================================");
    console.log("    ALL 8-HOUR CLOCK-IN & AUTO CLOCK-OUT RULES VERIFIED AND ENFORCED!          ");
    console.log("================================================================================");

    process.exit(0);
  } catch (err) {
    console.error("\n❌ VERIFICATION FAILED:", err);
    process.exit(1);
  }
}

verifyEightHourClockoutRule();
