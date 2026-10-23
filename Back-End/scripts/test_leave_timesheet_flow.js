import pool from "../config/db.js";
import { findTimesheetById, updateTimesheetRecord } from "../repositories/timesheetRepository.js";
import { findLeaveById, updateLeaveRecord } from "../repositories/leaveRepository.js";

async function runTests() {
  console.log("=== STARTING MULTI-TIER FLOW TEST (Employee -> Manager -> HR) ===");

  // 1. Find a test employee and manager user
  const empRes = await pool.query("SELECT id, user_id FROM employees WHERE id IS NOT NULL LIMIT 1;");
  if (empRes.rows.length === 0) {
    console.log("No employees found to test with.");
    process.exit(0);
  }
  const empId = empRes.rows[0].id;

  const mgrUserRes = await pool.query("SELECT id, role FROM users WHERE role = 'manager' LIMIT 1;");
  const hrUserRes = await pool.query("SELECT id, role FROM users WHERE role IN ('hr', 'admin') LIMIT 1;");

  const mgrUserId = mgrUserRes.rows[0]?.id || 1;
  const hrUserId = hrUserRes.rows[0]?.id || 2;

  console.log(`Using Test Employee #${empId}, Manager User #${mgrUserId}, HR User #${hrUserId}`);

  // ==========================================
  // TEST A: LEAVE FLOW
  // ==========================================
  console.log("\n--- Testing Leave Workflow ---");

  // Step A1: Employee Initiates
  const leaveInsert = await pool.query(
    `INSERT INTO leaves (employee_id, leave_type_id, start_date, end_date, number_of_days, reason, status)
     VALUES ($1, 1, '2026-11-10', '2026-11-11', 2, 'Family function', 'Pending Manager')
     RETURNING *;`,
    [empId]
  );
  const testLeave = leaveInsert.rows[0];
  console.log(`✓ Step 1: Employee initiated leave #${testLeave.id} -> Status: "${testLeave.status}"`);

  // Step A2: Manager Approves (Stage 1)
  await updateLeaveRecord(testLeave.id, {
    status: "Pending HR",
    manager_approved_by: mgrUserId,
    manager_approved_at: new Date(),
    manager_remarks: "Recommended by Manager - Proceed with HR approval",
  });
  const mgrApprovedLeave = await findLeaveById(testLeave.id);
  console.log(`✓ Step 2: Manager approved leave #${mgrApprovedLeave.id} -> Status: "${mgrApprovedLeave.status}", Manager: #${mgrApprovedLeave.manager_approved_by}, Remarks: "${mgrApprovedLeave.manager_remarks}"`);
  if (mgrApprovedLeave.status !== "Pending HR") {
    throw new Error(`Expected status 'Pending HR', got '${mgrApprovedLeave.status}'`);
  }

  // Step A3: HR Approves (Stage 2 - Final)
  await updateLeaveRecord(testLeave.id, {
    status: "Approved",
    hr_approved_by: hrUserId,
    hr_approved_at: new Date(),
    hr_remarks: "Final leave sign-off by HR Operations",
    approved_by: hrUserId,
    approved_at: new Date(),
  });
  const hrApprovedLeave = await findLeaveById(testLeave.id);
  console.log(`✓ Step 3: HR approved leave #${hrApprovedLeave.id} -> Status: "${hrApprovedLeave.status}", HR Approver: #${hrApprovedLeave.hr_approved_by}, Remarks: "${hrApprovedLeave.hr_remarks}"`);
  if (hrApprovedLeave.status !== "Approved") {
    throw new Error(`Expected status 'Approved', got '${hrApprovedLeave.status}'`);
  }

  // Clean up test leave
  await pool.query("DELETE FROM leaves WHERE id = $1", [testLeave.id]);
  console.log("✓ Cleaned up test leave record.");

  // ==========================================
  // TEST B: TIMESHEET FLOW
  // ==========================================
  console.log("\n--- Testing Timesheet Workflow ---");

  // Step B1: Employee Submits
  const tsInsert = await pool.query(
    `INSERT INTO timesheets (employee_id, date, project, task, hours, status, submitted_at)
     VALUES ($1, '2026-11-10', 'PRJ-TITAN-01', 'Core Architecture Sprint', 8.0, 'submitted', CURRENT_TIMESTAMP)
     RETURNING *;`,
    [empId]
  );
  const testTs = tsInsert.rows[0];
  console.log(`✓ Step 1: Employee submitted timesheet #${testTs.id} -> Status: "${testTs.status}"`);

  // Step B2: Manager Approves (Stage 1)
  await updateTimesheetRecord(testTs.id, {
    status: "pending_hr",
    reviewedBy: mgrUserId,
    reviewedAt: new Date(),
    reviewComment: "Verified sprint deliverables. Approved & forwarded to HR.",
    managerApprovedBy: mgrUserId,
    managerApprovedAt: new Date(),
    managerRemarks: "Verified sprint deliverables. Approved & forwarded to HR.",
  });
  const mgrApprovedTs = await findTimesheetById(testTs.id);
  console.log(`✓ Step 2: Manager approved timesheet #${mgrApprovedTs.id} -> Status: "${mgrApprovedTs.status}", Manager: #${mgrApprovedTs.managerApprovedBy}, Remarks: "${mgrApprovedTs.managerRemarks}"`);
  if (mgrApprovedTs.status !== "pending_hr") {
    throw new Error(`Expected status 'pending_hr', got '${mgrApprovedTs.status}'`);
  }

  // Step B3: HR Approves (Stage 2 - Final Sign-off)
  await updateTimesheetRecord(testTs.id, {
    status: "approved",
    reviewedBy: hrUserId,
    reviewedAt: new Date(),
    reviewComment: "Final HR sign-off executed. Reconciled to payroll ledger.",
    hrApprovedBy: hrUserId,
    hrApprovedAt: new Date(),
    hrRemarks: "Final HR sign-off executed. Reconciled to payroll ledger.",
  });
  const hrApprovedTs = await findTimesheetById(testTs.id);
  console.log(`✓ Step 3: HR approved timesheet #${hrApprovedTs.id} -> Status: "${hrApprovedTs.status}", HR: #${hrApprovedTs.hrApprovedBy}, Remarks: "${hrApprovedTs.hrRemarks}"`);
  if (hrApprovedTs.status !== "approved") {
    throw new Error(`Expected status 'approved', got '${hrApprovedTs.status}'`);
  }

  // Clean up test timesheet
  await pool.query("DELETE FROM timesheets WHERE id = $1", [testTs.id]);
  console.log("✓ Cleaned up test timesheet record.");

  console.log("\n=======================================================");
  console.log("🎉 ALL MULTI-TIER FLOW TESTS (Employee -> Manager -> HR) PASSED PERFECTLY!");
  console.log("=======================================================");
  process.exit(0);
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
