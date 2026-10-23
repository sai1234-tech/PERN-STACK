async function test() {
  try {
    const res = await fetch("http://127.0.0.1:5005/api/entities/overview");
    const d = await res.json();
    console.log("Success:", d.success);
    console.log("Total Entities:", d.totalEntities);
    console.log("Total DB Records:", d.totalDatabaseRecords);
    console.log("Categories:", Object.keys(d.categories));
    console.log("\nAll Entities:");
    d.entities.forEach(e => {
      console.log(`- ${e.label} (${e.key}): ${e.count} rows [${e.status}] - Table: ${e.table}`);
    });

    // Test a specific entity query e.g. 'organization', 'sow', 'bgv', 'kra', 'asset'
    const testKeys = ['organization', 'designation', 'location', 'sow', 'bgv', 'shift', 'asset', 'fnf_input', 'approval', 'permission'];
    console.log("\nTesting specific entity queries:");
    for (const k of testKeys) {
      const entRes = await fetch(`http://127.0.0.1:5005/api/entities/${k}`);
      const entData = await entRes.json();
      console.log(`[${k}] => ${entData.data ? entData.data.length : 0} rows returned (Total: ${entData.pagination?.totalRecords})`);
    }

    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

test();
