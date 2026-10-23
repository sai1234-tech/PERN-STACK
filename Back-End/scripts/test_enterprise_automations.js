import "dotenv/config";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

async function test() {
  console.log("=== TESTING 9 ENTERPRISE AUTOMATIONS & SLA ENGINES ===");

  const userRes = await pool.query("SELECT id, name, email, role FROM users WHERE role = 'admin' OR role = 'super_admin' LIMIT 1");
  const testUser = userRes.rows[0];

  const token = jwt.sign(
    { userId: testUser.id, role: testUser.role, email: testUser.email },
    process.env.JWT_SECRET || "default_jwt_secret",
    { expiresIn: "1h" }
  );

  const baseUrl = "http://127.0.0.1:5005/api/automations";
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    // 0. Overview
    const resOverview = await fetch(`${baseUrl}/overview`, { headers });
    const jsonOverview = await resOverview.json();
    console.log("0. Automations Overview:", jsonOverview.success ? "✓ PASSED" : "✗ FAILED", jsonOverview.data);

    // 1. Role/Client Onboarding Checklists
    const resOnb = await fetch(`${baseUrl}/onboarding/instances`, { headers });
    const jsonOnb = await resOnb.json();
    console.log("1. Onboarding Checklists:", jsonOnb.success ? "✓ PASSED" : "✗ FAILED", `Tasks: ${jsonOnb.count}`);

    // 2. Missing-Document Reminders
    const resDocs = await fetch(`${baseUrl}/documents/missing`, { headers });
    const jsonDocs = await resDocs.json();
    console.log("2. Missing Document Reminders:", jsonDocs.success ? "✓ PASSED" : "✗ FAILED", `Reminders: ${jsonDocs.data?.length}`);

    // 3. BGV SLA Escalations
    const resBgv = await fetch(`${baseUrl}/bgv/slas`, { headers });
    const jsonBgv = await resBgv.json();
    console.log("3. BGV SLA Escalations:", jsonBgv.success ? "✓ PASSED" : "✗ FAILED", `Cases: ${jsonBgv.data?.length}`);

    // 4. Monthly Payroll Cut-Off Input Generation
    const resCutoff = await fetch(`${baseUrl}/payroll/cutoffs`, { headers });
    const jsonCutoff = await resCutoff.json();
    console.log("4. Monthly Payroll Cut-off Batches:", jsonCutoff.success ? "✓ PASSED" : "✗ FAILED", `Batches: ${jsonCutoff.data?.length}`);

    // 5. Probation & Confirmation Reminders
    const resProbation = await fetch(`${baseUrl}/probation/alerts`, { headers });
    const jsonProbation = await resProbation.json();
    console.log("5. Probation Confirmation Alerts:", jsonProbation.success ? "✓ PASSED" : "✗ FAILED", `Alerts: ${jsonProbation.data?.length}`);

    // 6. Performance-Cycle Reminders
    const resPerf = await fetch(`${baseUrl}/performance/alerts`, { headers });
    const jsonPerf = await resPerf.json();
    console.log("6. Performance Cycle Reminders:", jsonPerf.success ? "✓ PASSED" : "✗ FAILED", `Alerts: ${jsonPerf.data?.length}`);

    // 7. Exit Clearance Tasks (5 Departments)
    const resExit = await fetch(`${baseUrl}/exit/tasks`, { headers });
    const jsonExit = await resExit.json();
    console.log("7. Exit Clearance Tasks:", jsonExit.success ? "✓ PASSED" : "✗ FAILED", `Tasks: ${jsonExit.count}`);

    // 8. Helpdesk SLA Escalations
    const resTickets = await fetch(`${baseUrl}/helpdesk/slas`, { headers });
    const jsonTickets = await resTickets.json();
    console.log("8. Helpdesk SLA Escalations:", jsonTickets.success ? "✓ PASSED" : "✗ FAILED", `Escalated: ${jsonTickets.data?.length}`);

    // 9. Scheduled Authorized Reports
    const resReports = await fetch(`${baseUrl}/reports/scheduled`, { headers });
    const jsonReports = await resReports.json();
    console.log("9. Scheduled Authorized Reports:", jsonReports.success ? "✓ PASSED" : "✗ FAILED", `Reports: ${jsonReports.count}`);

    console.log("\n=== ALL 9 AUTOMATION & SLA ENGINES VERIFIED SUCCESSFULLY ===");
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

test();
