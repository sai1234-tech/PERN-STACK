import "dotenv/config";
import jwt from "jsonwebtoken";

const API_BASE = "http://127.0.0.1:5005/api";
const JWT_SECRET = process.env.JWT_SECRET || "enterprise_super_secure_jwt_secret_key_2026";

const adminToken = jwt.sign(
  {
    userId: 5,
    id: 5,
    email: "admin@company.com",
    role: "super_admin",
    first_name: "Operations",
    last_name: "Commander"
  },
  JWT_SECRET,
  { expiresIn: "1h" }
);

const headers = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${adminToken}`
};

async function runTests() {
  console.log("=== TESTING 9 ENTERPRISE ARCHITECTURE & OPERATIONS APIS ===");
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

  // 1. Radar Overview
  await test("GET /api/operations/overview", async () => {
    const res = await fetch(`${API_BASE}/operations/overview`, { headers });
    const json = await res.json();
    if (!res.ok || !json.success || !json.areas) throw new Error(JSON.stringify(json));
    console.log("  9 Areas Status:", Object.keys(json.areas).map(k => `${k}: ${json.areas[k].status}`).join(" | "));
  });

  // 2. Performance & Load Testing
  await test("GET & POST /api/operations/performance", async () => {
    const getRes = await fetch(`${API_BASE}/operations/performance/targets`, { headers });
    const getJson = await getRes.json();
    if (!getRes.ok || !getJson.sla_targets?.length) throw new Error(JSON.stringify(getJson));

    const postRes = await fetch(`${API_BASE}/operations/performance/load-test`, {
      method: "POST",
      headers,
      body: JSON.stringify({ concurrent_users: 50, duration_seconds: 10, test_scenario: "CI Verification Load Test" })
    });
    const postJson = await postRes.json();
    if (!postRes.ok || !postJson.success) throw new Error(JSON.stringify(postJson));
    console.log(`  Load Test Result: code=${postJson.data.test_run_code}, throughput=${postJson.data.throughput_rps} rps, p50=${postJson.data.p50_response_ms}ms, p95=${postJson.data.p95_response_ms}ms`);
  });

  // 3. Availability & Health Diagnostics
  await test("GET /api/operations/availability/status", async () => {
    const res = await fetch(`${API_BASE}/operations/availability/status`, { headers });
    const json = await res.json();
    if (!res.ok || !json.components?.length) throw new Error(JSON.stringify(json));
    console.log(`  Availability: ${json.system_uptime_pct}% uptime, MTBF: ${json.mtbf_hours}h, MTTR: ${json.mttr_minutes}m, ${json.components.length} components checked`);
  });

  // 4. Scalability Metrics
  await test("GET /api/operations/scalability/metrics", async () => {
    const res = await fetch(`${API_BASE}/operations/scalability/metrics`, { headers });
    const json = await res.json();
    if (!res.ok || !json.capacity_metrics?.length) throw new Error(JSON.stringify(json));
    console.log(`  Scalability: ${json.capacity_metrics.length} dimensions modeled (Readiness: ${json.scaling_readiness})`);
  });

  // 5. Security & Vulnerability Scan
  await test("GET & POST /api/operations/security", async () => {
    const getRes = await fetch(`${API_BASE}/operations/security/vulnerabilities`, { headers });
    const getJson = await getRes.json();
    if (!getRes.ok || !getJson.vulnerabilities?.length) throw new Error(JSON.stringify(getJson));

    const scanRes = await fetch(`${API_BASE}/operations/security/scan`, {
      method: "POST",
      headers,
      body: JSON.stringify({})
    });
    const scanJson = await scanRes.json();
    if (!scanRes.ok || !scanJson.success) throw new Error(JSON.stringify(scanJson));
    console.log(`  Security Scan: ${scanJson.scan_code} -> Status: ${scanJson.status}`);
  });

  // 6. Usability & UX Telemetry
  await test("GET /api/operations/usability/telemetry", async () => {
    const res = await fetch(`${API_BASE}/operations/usability/telemetry`, { headers });
    const json = await res.json();
    if (!res.ok || !json.tasks?.length) throw new Error(JSON.stringify(json));
    console.log(`  Usability: WCAG Score = ${json.wcag_accessibility_score}, Avg Completion = ${json.average_task_completion_seconds}s, Tasks = ${json.tasks.length}`);
  });

  // 7. Automated Backup & Dry-Run Restoration Testing
  await test("GET & POST /api/operations/backup", async () => {
    const getRes = await fetch(`${API_BASE}/operations/backup/ledger`, { headers });
    const getJson = await getRes.json();
    if (!getRes.ok || !getJson.backups?.length) throw new Error(JSON.stringify(getJson));

    const postRes = await fetch(`${API_BASE}/operations/backup/test-restore`, {
      method: "POST",
      headers,
      body: JSON.stringify({})
    });
    const postJson = await postRes.json();
    if (!postRes.ok || !postJson.success) throw new Error(JSON.stringify(postJson));
    console.log(`  Backup Restore Test: ${postJson.data.backup_id} -> Restore Time: ${postJson.data.restore_time_seconds}s, Status: ${postJson.data.restoration_status}`);
  });

  // 8. Disaster Recovery Tiers & Failover Drill
  await test("GET & POST /api/operations/dr", async () => {
    const getRes = await fetch(`${API_BASE}/operations/dr/tiers`, { headers });
    const getJson = await getRes.json();
    if (!getRes.ok || !getJson.tiers?.length) throw new Error(JSON.stringify(getJson));

    const postRes = await fetch(`${API_BASE}/operations/dr/drill`, {
      method: "POST",
      headers,
      body: JSON.stringify({ workload_tier: "TIER_1_PAYROLL_CORE" })
    });
    const postJson = await postRes.json();
    if (!postRes.ok || !postJson.success) throw new Error(JSON.stringify(postJson));
    console.log(`  DR Failover Drill: ${postJson.data.workload_tier} -> Actual RPO: ${postJson.data.actual_drill_rpo_minutes}m, Actual RTO: ${postJson.data.actual_drill_rto_minutes}m (Status: ${postJson.data.drill_status})`);
  });

  // 9. Observability Logs & Alerts
  await test("GET /api/operations/observability", async () => {
    const logRes = await fetch(`${API_BASE}/operations/observability/logs?limit=5`, { headers });
    const logJson = await logRes.json();
    if (!logRes.ok || !logJson.data?.length) throw new Error(JSON.stringify(logJson));

    const alertRes = await fetch(`${API_BASE}/operations/observability/alerts`, { headers });
    const alertJson = await alertRes.json();
    if (!alertRes.ok || !alertJson.alerts?.length) throw new Error(JSON.stringify(alertJson));
    console.log(`  Observability: ${logJson.total} logs indexed, ${alertJson.alerts.length} system alert rules active`);
  });

  // 10. Maintainability CI/CD & API Docs
  await test("GET /api/operations/maintainability/status", async () => {
    const res = await fetch(`${API_BASE}/operations/maintainability/status`, { headers });
    const json = await res.json();
    if (!res.ok || !json.ci_cd_runs?.length || !json.api_registry?.length) throw new Error(JSON.stringify(json));
    console.log(`  Maintainability: Test Coverage = ${json.code_metrics.test_coverage_pct}%, Endpoints = ${json.code_metrics.total_endpoints}, ${json.ci_cd_runs.length} CI runs, ${json.api_registry.length} API modules registered`);
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
