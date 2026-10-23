async function testIntegrations() {
  try {
    console.log("=== TESTING ENTERPRISE INTEGRATIONS API ===");
    const res = await fetch("http://127.0.0.1:5005/api/integrations");
    const data = await res.json();
    console.log("Connectors API Success:", data.success);
    console.log("Total Connectors:", data.totalConnectors);
    data.connectors.forEach((c) => {
      console.log(`- [${c.connector_key}] ${c.name} (${c.provider}) -> Status: ${c.health_status} | Protocol: ${c.protocol}`);
    });

    const summaryRes = await fetch("http://127.0.0.1:5005/api/integrations/summary");
    const summary = await summaryRes.json();
    console.log("\nSummary Metrics:", summary.metrics);
    console.log("Recent Sync Logs Count:", summary.recentSyncLogs?.length);

    // Test triggering an on-demand sync for biometric and payroll
    console.log("\nTesting on-demand sync for 'biometric_attendance':");
    const bioSyncRes = await fetch("http://127.0.0.1:5005/api/integrations/biometric_attendance/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ triggeredBy: "MANUAL_TEST" })
    });
    const bioSync = await bioSyncRes.json();
    console.log("Biometric Sync Result:", bioSync.message, bioSync.syncResult?.payload_summary);

    console.log("\nTesting on-demand sync for 'payroll_vendor':");
    const paySyncRes = await fetch("http://127.0.0.1:5005/api/integrations/payroll_vendor/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ triggeredBy: "MANUAL_TEST" })
    });
    const paySync = await paySyncRes.json();
    console.log("Payroll Sync Result:", paySync.message, paySync.syncResult?.payload_summary);

    process.exit(0);
  } catch (err) {
    console.error("Test error:", err);
    process.exit(1);
  }
}

testIntegrations();
