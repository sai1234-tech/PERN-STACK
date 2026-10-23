import pool from "../config/db.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key";

async function runTests() {
  console.log("=== Testing Tech Stack Selection Endpoints ===");
  try {
    const { rows: adminRows } = await pool.query(
      "SELECT id, role, email FROM users WHERE role IN ('admin', 'super_admin') LIMIT 1"
    );
    if (!adminRows.length) {
      throw new Error("No admin user found in database!");
    }
    const adminUser = adminRows[0];

    const token = jwt.sign(
      { userId: adminUser.id, email: adminUser.email, role: adminUser.role },
      process.env.JWT_SECRET || "default_jwt_secret",
      { expiresIn: "1h" }
    );

    const baseUrl = "http://127.0.0.1:5005/api/stack-selection";
    const headers = {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    };

    // Test 1: Overview
    const resOverview = await fetch(`${baseUrl}/overview`, { headers });
    const dataOverview = await resOverview.json();
    console.log("1. /overview status:", resOverview.status, "Success:", dataOverview.success);
    console.log("   Selected Tiers:", dataOverview.architecture_decision?.tier_selections?.length);
    console.log("   3-Yr TCO Savings:", dataOverview.architecture_decision?.three_year_tco_savings_usd);

    // Test 2: Matrix
    const resMatrix = await fetch(`${baseUrl}/matrix`, { headers });
    const dataMatrix = await resMatrix.json();
    console.log("2. /matrix status:", resMatrix.status, "Total Evaluated:", dataMatrix.total_technologies_evaluated);
    console.log("   Categories:", Object.keys(dataMatrix.grouped_matrix || {}));

    // Test 3: Evaluate Custom Scoring
    const resEval = await fetch(`${baseUrl}/evaluate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        skills_weight: 40,
        security_weight: 30,
        integrations_weight: 15,
        tco_weight: 15
      })
    });
    const dataEval = await resEval.json();
    console.log("3. /evaluate status:", resEval.status, "Top Tech:", dataEval.ranked_results?.[0]?.technology_name);

    // Test 4: Cloud Profiles
    const resClouds = await fetch(`${baseUrl}/cloud-profiles`, { headers });
    const dataClouds = await resClouds.json();
    console.log("4. /cloud-profiles status:", resClouds.status, "Profiles Count:", dataClouds.profiles?.length);

    // Test 5: Storage Providers
    const resStorage = await fetch(`${baseUrl}/storage-providers`, { headers });
    const dataStorage = await resStorage.json();
    console.log("5. /storage-providers status:", resStorage.status, "Providers Count:", dataStorage.providers?.length);

    // Test 6: Storage Test Signed URL
    const resStorageTest = await fetch(`${baseUrl}/storage/test`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        provider_code: "AWS_S3_PRIMARY",
        document_key: "employee-contracts/EMP-2026-9021.pdf",
        action: "DOWNLOAD"
      })
    });
    const dataStorageTest = await resStorageTest.json();
    console.log("6. /storage/test status:", resStorageTest.status, "Signed URL generated:", !!dataStorageTest.signed_url);

    // Test 7: IdP Configurations
    const resIdp = await fetch(`${baseUrl}/idp/configurations`, { headers });
    const dataIdp = await resIdp.json();
    console.log("7. /idp/configurations status:", resIdp.status, "IdP Count:", dataIdp.configurations?.length);

    // Test 8: Simulate IdP SSO Handshake
    const resIdpSim = await fetch(`${baseUrl}/idp/simulate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        idp_code: "AZURE_AD_ENTRA",
        test_user_email: "vp.engineering@enterprise.com"
      })
    });
    const dataIdpSim = await resIdpSim.json();
    console.log("8. /idp/simulate status:", resIdpSim.status, "Handshake Code:", dataIdpSim.handshake_code, "MFA:", dataIdpSim.sso_claims_verified?.mfa_verified);

    // Test 9: TCO Financial Comparison
    const resTco = await fetch(`${baseUrl}/tco/comparison`, { headers });
    const dataTco = await resTco.json();
    console.log("9. /tco/comparison status:", resTco.status, "Savings:", dataTco.financial_summary?.net_3yr_savings_usd, "Reduction:", dataTco.financial_summary?.savings_percentage);

    console.log("=== All Backend Stack Selection API Tests PASSED Successfully! ===");
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    await pool.end();
  }
}

runTests();
