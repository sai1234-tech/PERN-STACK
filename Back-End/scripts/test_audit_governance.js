import "dotenv/config";
import jwt from "jsonwebtoken";

const API_BASE = "http://127.0.0.1:5005/api";
const JWT_SECRET = process.env.JWT_SECRET || "enterprise_super_secure_jwt_secret_key_2026";

// Generate signed test token for admin
const adminToken = jwt.sign(
  {
    userId: 5,
    id: 5,
    email: "admin@company.com",
    role: "super_admin",
    first_name: "System",
    last_name: "Administrator"
  },
  JWT_SECRET,
  { expiresIn: "1h" }
);

const headers = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${adminToken}`
};

async function runTests() {
  console.log("=== TESTING ENTERPRISE AUDIT & EFFECTIVE GOVERNANCE APIS ===");
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  // 1. Executive Overview KPIs
  await test("GET /api/audit-governance/overview", async () => {
    const res = await fetch(`${API_BASE}/audit-governance/overview`, { headers });
    const json = await res.json();
    if (!res.ok || !json.success || !json.kpis) {
      throw new Error(`Status ${res.status}: ${JSON.stringify(json)}`);
    }
    console.log("  KPIs:", {
      critical_changes: json.kpis.critical_changes.total,
      approvals: json.kpis.approvals.total,
      effective_revisions: json.kpis.effective_dating.total_revisions,
      sensitive_exports: json.kpis.sensitive_exports.total_exports,
      admin_actions: json.kpis.admin_actions.total,
      doc_policies: json.kpis.document_governance.total_policies
    });
  });

  // 2. Critical Data Change Logging
  await test("POST & GET /api/audit-governance/critical-changes", async () => {
    const payload = {
      entity_type: "EMPLOYEE_COMPENSATION",
      entity_id: "12",
      entity_name: "Lakshmi Ragula (EMP01)",
      action_type: "UPDATE",
      old_values: { basic_salary: 80000, ctc: 1600000 },
      new_values: { basic_salary: 95000, ctc: 1900000 },
      changed_fields: ["basic_salary", "ctc"],
      business_justification: "Mid-year performance elevation approved by Board",
      criticality: "CRITICAL"
    };

    const postRes = await fetch(`${API_BASE}/audit-governance/critical-changes`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    const postJson = await postRes.json();
    if (!postRes.ok || !postJson.success) throw new Error(`POST failed: ${JSON.stringify(postJson)}`);

    const getRes = await fetch(`${API_BASE}/audit-governance/critical-changes?limit=5`, { headers });
    const getJson = await getRes.json();
    if (!getRes.ok || !getJson.data?.length) throw new Error(`GET failed: ${JSON.stringify(getJson)}`);
  });

  // 3. Retain Approval Decision History
  await test("POST & GET /api/audit-governance/approval-decisions", async () => {
    const payload = {
      workflow_type: "MONTHLY_PAYROLL_CUTOFF",
      entity_id: "PAY-2026-10-TEST",
      entity_title: "Payroll Batch Signoff Test",
      requester_name: "Automated Engine",
      step_number: 1,
      step_name: "CFO Sign-off",
      decision: "APPROVED",
      comments: "All statutory TDS and ESI deductions audited and matched against ledger",
      previous_status: "PENDING",
      resulting_status: "APPROVED_FINAL"
    };

    const postRes = await fetch(`${API_BASE}/audit-governance/approval-decisions`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    const postJson = await postRes.json();
    if (!postRes.ok || !postJson.success) throw new Error(`POST failed: ${JSON.stringify(postJson)}`);

    const getRes = await fetch(`${API_BASE}/audit-governance/approval-decisions?limit=5`, { headers });
    const getJson = await getRes.json();
    if (!getRes.ok || !getJson.data?.length) throw new Error(`GET failed: ${JSON.stringify(getJson)}`);
  });

  // 4. Effective-Dated Non-Overwriting Revision
  await test("POST & GET /api/audit-governance/effective-dated (Temporal Versioning)", async () => {
    const revisionPayload = {
      entity_type: "EMPLOYEE_COMPENSATION",
      entity_id: "201",
      entity_name: "Integration Test Candidate (EMP-122)",
      effective_from: "2026-11-01",
      change_reason: "PROMOTION_LEAD_ARCHITECT",
      record_payload: {
        designation: "Lead Systems Architect",
        department: "Engineering",
        grade: "L5",
        basic: 120000,
        hra: 48000,
        ctc_annual: 2400000
      },
      diff_summary: { promotion: "L4 to L5", delta: "+300,000 INR" }
    };

    const postRes = await fetch(`${API_BASE}/audit-governance/effective-dated`, {
      method: "POST",
      headers,
      body: JSON.stringify(revisionPayload)
    });
    const postJson = await postRes.json();
    if (!postRes.ok || !postJson.success) throw new Error(`POST failed: ${JSON.stringify(postJson)}`);

    const getRes = await fetch(`${API_BASE}/audit-governance/effective-dated?entity_id=201`, { headers });
    const getJson = await getRes.json();
    if (!getRes.ok || !getJson.data?.length) throw new Error(`GET failed: ${JSON.stringify(getJson)}`);
    console.log(`  Versions count for entity 201: ${getJson.data.length} (Latest v${getJson.data[0].version_number})`);
  });

  // 5. Point-in-Time Temporal "As-Of Date" Query
  await test("GET /api/audit-governance/effective-dated/as-of", async () => {
    const res = await fetch(`${API_BASE}/audit-governance/effective-dated/as-of?entity_type=EMPLOYEE_COMPENSATION&entity_id=201&as_of_date=2024-06-15`, { headers });
    const json = await res.json();
    if (!res.ok || !json.data) throw new Error(`As-of query failed: ${JSON.stringify(json)}`);
    console.log(`  As-of 2024-06-15: Designation = ${json.data.record_payload.designation}, Basic = ${json.data.record_payload.basic} (v${json.data.version_number})`);
  });

  // 6. Sensitive Export Logging
  await test("POST & GET /api/audit-governance/sensitive-exports", async () => {
    const payload = {
      export_type: "SALARY_REGISTER_EXCEL",
      export_format: "XLSX",
      record_count: 142,
      sensitivity_level: "FINANCIAL_CONFIDENTIAL",
      filter_criteria: { month: "2026-10", cost_center: "All" },
      export_purpose: "Automated Bank Disbursal Batch Export"
    };

    const postRes = await fetch(`${API_BASE}/audit-governance/sensitive-exports`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    const postJson = await postRes.json();
    if (!postRes.ok || !postJson.success) throw new Error(`POST failed: ${JSON.stringify(postJson)}`);

    const getRes = await fetch(`${API_BASE}/audit-governance/sensitive-exports?limit=5`, { headers });
    const getJson = await getRes.json();
    if (!getRes.ok || !getJson.data?.length) throw new Error(`GET failed: ${JSON.stringify(getJson)}`);
  });

  // 7. Administrative Action Audit Logging
  await test("POST & GET /api/audit-governance/admin-actions", async () => {
    const payload = {
      action_category: "SYSTEM_CONFIG_UPDATED",
      target_entity_type: "SECURITY_POLICY",
      target_entity_id: "POL-MFA-STEPUP",
      action_details: "Enforced step-up MFA challenge for all statutory and compensation exports",
      before_state: { stepup_required: false },
      after_state: { stepup_required: true },
      status: "SUCCESS"
    };

    const postRes = await fetch(`${API_BASE}/audit-governance/admin-actions`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    const postJson = await postRes.json();
    if (!postRes.ok || !postJson.success) throw new Error(`POST failed: ${JSON.stringify(postJson)}`);

    const getRes = await fetch(`${API_BASE}/audit-governance/admin-actions?limit=5`, { headers });
    const getJson = await getRes.json();
    if (!getRes.ok || !getJson.data?.length) throw new Error(`GET failed: ${JSON.stringify(getJson)}`);
  });

  // 8. Document Governance Policies
  await test("GET /api/audit-governance/document-policies", async () => {
    const res = await fetch(`${API_BASE}/audit-governance/document-policies`, { headers });
    const json = await res.json();
    if (!res.ok || !json.data?.length) throw new Error(`Policies failed: ${JSON.stringify(json)}`);
    console.log(`  Found ${json.data.length} active document governance policy categories`);
  });

  // 9. Document Access Permission Evaluation & Dynamic Watermarking
  await test("POST /api/audit-governance/documents/evaluate-access", async () => {
    // Test 1: Employee trying to preview own document -> Granted with dynamic watermark
    const previewRes = await fetch(`${API_BASE}/audit-governance/documents/evaluate-access`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        category_code: "GOVERNMENT_IDS_AADHAAR_PAN",
        action_type: "PREVIEW",
        target_role: "hr",
        target_user_email: "ananya.hr@company.com"
      })
    });
    const previewJson = await previewRes.json();
    if (!previewRes.ok || !previewJson.data.access_granted || !previewJson.data.watermark_text) {
      throw new Error(`Preview evaluation failed: ${JSON.stringify(previewJson)}`);
    }
    console.log(`  Preview evaluation: Granted=${previewJson.data.access_granted}, Watermark='${previewJson.data.watermark_text.slice(0, 35)}...'`);

    // Test 2: Unauthorized role trying to download confidential BGV dossier -> Denied
    const downloadRes = await fetch(`${API_BASE}/audit-governance/documents/evaluate-access`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        category_code: "BGV_INVESTIGATION_REPORTS",
        action_type: "DOWNLOAD",
        target_role: "employee",
        target_user_email: "employee@company.com"
      })
    });
    const downloadJson = await downloadRes.json();
    if (!downloadRes.ok || downloadJson.data.access_granted !== false) {
      throw new Error(`Download evaluation should have denied: ${JSON.stringify(downloadJson)}`);
    }
    console.log(`  Download evaluation for employee on BGV: Granted=${downloadJson.data.access_granted}, Reason='${downloadJson.data.denial_reason}'`);
  });

  // 10. Document Governance Audit Logs
  await test("GET /api/audit-governance/document-audit", async () => {
    const res = await fetch(`${API_BASE}/audit-governance/document-audit?limit=5`, { headers });
    const json = await res.json();
    if (!res.ok || !json.data) throw new Error(`Audit logs failed: ${JSON.stringify(json)}`);
    console.log(`  Total document governance audit records: ${json.total}`);
  });

  console.log("\n========================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED out of ${passed + failed} tests`);
  console.log("========================================================");
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
