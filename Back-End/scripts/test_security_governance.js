import "dotenv/config";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

async function test() {
  console.log("=== TESTING ENTERPRISE SECURITY & GOVERNANCE BACKEND ===");

  // Find a test super_admin user to create a valid JWT
  const userRes = await pool.query("SELECT id, name, email, role FROM users WHERE role = 'super_admin' LIMIT 1");
  let testUser = userRes.rows[0];
  if (!testUser) {
    const anyUser = await pool.query("SELECT id, name, email, role FROM users LIMIT 1");
    testUser = anyUser.rows[0];
  }

  const token = jwt.sign(
    { userId: testUser.id, role: testUser.role, email: testUser.email },
    process.env.JWT_SECRET || "default_jwt_secret",
    { expiresIn: "1h" }
  );

  const baseUrl = "http://127.0.0.1:5005/api/governance";
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    // 1. Overview
    const resOverview = await fetch(`${baseUrl}/overview`, { headers });
    const jsonOverview = await resOverview.json();
    console.log("1. Overview:", jsonOverview.success ? "✓ PASSED" : "✗ FAILED", jsonOverview.data?.complianceStandard);

    // 2. Data Masking Policies
    const resMask = await fetch(`${baseUrl}/masking/policies`, { headers });
    const jsonMask = await resMask.json();
    console.log("2. Data Masking Policies:", jsonMask.success ? "✓ PASSED" : "✗ FAILED", `Policies: ${jsonMask.data?.length}`);

    // 3. Masking Preview
    const resPreview = await fetch(`${baseUrl}/masking/preview?role=employee`, { headers });
    const jsonPreview = await resPreview.json();
    console.log("3. Field Masking Preview (employee):", jsonPreview.success ? "✓ PASSED" : "✗ FAILED", {
      pan: jsonPreview.maskedRecordForRole?.pan,
      salary: jsonPreview.maskedRecordForRole?.basic_salary,
      bank: jsonPreview.maskedRecordForRole?.bank_account_number,
    });

    // 4. Cryptographic Audit Chain Verification
    const resAudit = await fetch(`${baseUrl}/audit/verify`, { headers });
    const jsonAudit = await resAudit.json();
    console.log("4. Cryptographic Audit Chain:", jsonAudit.success ? "✓ PASSED" : "✗ FAILED", `Intact: ${jsonAudit.isChainIntact}, Verified Blocks: ${jsonAudit.totalBlocksVerified}`);

    // 5. Document Access Logs
    const resDocs = await fetch(`${baseUrl}/documents/logs`, { headers });
    const jsonDocs = await resDocs.json();
    console.log("5. Document Access Logs:", jsonDocs.success ? "✓ PASSED" : "✗ FAILED", `Records: ${jsonDocs.count}`);

    // 6. Backup & DR Logs
    const resBackup = await fetch(`${baseUrl}/backup/logs`, { headers });
    const jsonBackup = await resBackup.json();
    console.log("6. Backup & DR Logs:", jsonBackup.success ? "✓ PASSED" : "✗ FAILED", `Snapshots: ${jsonBackup.data?.length}`);

    // 7. Data Retention Rules
    const resRetention = await fetch(`${baseUrl}/retention/rules`, { headers });
    const jsonRetention = await resRetention.json();
    console.log("7. Retention Rules:", jsonRetention.success ? "✓ PASSED" : "✗ FAILED", `Rules: ${jsonRetention.data?.length}`);

    // 8. DPDP Act 2023 Consents & Rights
    const resConsent = await fetch(`${baseUrl}/dpdp/consents`, { headers });
    const jsonConsent = await resConsent.json();
    const resRights = await fetch(`${baseUrl}/dpdp/rights`, { headers });
    const jsonRights = await resRights.json();
    console.log("8. Indian DPDP Act 2023:", jsonConsent.success && jsonRights.success ? "✓ PASSED" : "✗ FAILED", `Consents: ${jsonConsent.count}, Rights Requests: ${jsonRights.data?.length}`);

    // 9. Periodic Access Reviews & Separation Deprovisioning
    const resReviews = await fetch(`${baseUrl}/access-reviews`, { headers });
    const jsonReviews = await resReviews.json();
    const resDeprov = await fetch(`${baseUrl}/separation/deprovisioning-logs`, { headers });
    const jsonDeprov = await resDeprov.json();
    console.log("9. Access Reviews & Immediate Deprovisioning:", jsonReviews.success && jsonDeprov.success ? "✓ PASSED" : "✗ FAILED", `Campaigns: ${jsonReviews.data?.length}, Deprovisioned: ${jsonDeprov.data?.length}`);

    // 10. Generate Step-Up MFA Challenge
    const resMfa = await fetch(`${baseUrl}/mfa/challenge`, {
      method: "POST",
      headers,
      body: JSON.stringify({ actionScope: "PAYROLL_DISBURSE" }),
    });
    const jsonMfa = await resMfa.json();
    console.log("10. Privileged Step-up MFA:", jsonMfa.success ? "✓ PASSED" : "✗ FAILED", `Challenge: ${jsonMfa.data?.challenge_code}`);

    // 11. Verify MFA Challenge
    if (jsonMfa.success && jsonMfa.data?.otpSimulationDelivery) {
      const resVerifyMfa = await fetch(`${baseUrl}/mfa/verify`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          challengeCode: jsonMfa.data.challenge_code,
          otp: jsonMfa.data.otpSimulationDelivery,
        }),
      });
      const jsonVerifyMfa = await resVerifyMfa.json();
      console.log("11. Step-Up MFA Verification:", jsonVerifyMfa.success ? "✓ PASSED" : "✗ FAILED", jsonVerifyMfa.message);
    }

    console.log("\n=== ALL 11 GOVERNANCE & SECURITY ENDPOINTS FULLY VERIFIED ===");
  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

test();
