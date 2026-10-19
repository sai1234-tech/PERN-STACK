import pool from "../config/db.js";

async function seedOct19Timesheets() {
  console.log("Seeding realistic work week 19 Oct timesheets...");

  // Remove existing entries for 2026-10-19 to keep it clean and idempotent
  await pool.query("DELETE FROM timesheets WHERE date = '2026-10-19'");

  const items = [
    {
      employee_id: 16,
      date: "2026-10-19",
      project: "WBS-FE-002: UI Components",
      client: "Quadratic Systems Inc",
      task: "NDP Web UI Dashboard Architecture",
      description: "Built high-performance executive dashboard views, optimized rendering lifecycle, and verified state synchronizations.",
      start_time: "2026-10-19 09:30:00",
      end_time: "2026-10-19 18:15:00",
      break_minutes: 45,
      hours: 8.0,
      status: "pending_hr",
      submitted_at: "2026-10-19 18:15:00",
      reviewed_by: 17,
      reviewed_at: "2026-10-19 18:20:00",
      review_comment: "Approved by Vikas Guru, forwarded to HR for final sign-off",
      manager_approved_by: 17,
      manager_approved_at: "2026-10-19 18:20:00",
      manager_remarks: "Approved by Vikas Guru, forwarded to HR for final sign-off",
    },
    {
      employee_id: 135,
      date: "2026-10-19",
      project: "Cloud Infrastructure & DevOps",
      client: "Quadratic Systems Inc",
      task: "Kubernetes Ingress & TLS Auto-Renewal Automation",
      description: "Configured Traefik ingress route middleware, automated Let's Encrypt TLS secret rotation in staging cluster.",
      start_time: "2026-10-19 09:30:00",
      end_time: "2026-10-19 18:15:00",
      break_minutes: 45,
      hours: 8.0,
      status: "pending_hr",
      submitted_at: "2026-10-19 18:18:00",
      reviewed_by: 17,
      reviewed_at: "2026-10-19 18:25:00",
      review_comment: "Deliverables verified in staging, approved for HR sign-off",
      manager_approved_by: 17,
      manager_approved_at: "2026-10-19 18:25:00",
      manager_remarks: "Deliverables verified in staging, approved for HR sign-off",
    },
    {
      employee_id: 139,
      date: "2026-10-19",
      project: "Core API Microservices",
      client: "Quadratic Systems Inc",
      task: "GraphQL Query Caching & Latency Optimization",
      description: "Implemented Redis cache layer for complex nested queries, cut p99 response times by 42%.",
      start_time: "2026-10-19 09:30:00",
      end_time: "2026-10-19 18:15:00",
      break_minutes: 45,
      hours: 8.0,
      status: "pending_hr",
      submitted_at: "2026-10-19 18:20:00",
      reviewed_by: 17,
      reviewed_at: "2026-10-19 18:28:00",
      review_comment: "Benchmark reports reviewed. Approved for HR sign-off",
      manager_approved_by: 17,
      manager_approved_at: "2026-10-19 18:28:00",
      manager_remarks: "Benchmark reports reviewed. Approved for HR sign-off",
    },
    {
      employee_id: 14,
      date: "2026-10-19",
      project: "Enterprise HRMS Engine",
      client: "Quadratic Systems Inc",
      task: "Core Platform Architecture & Microservice Refactoring",
      description: "Refactored internal routing modules, enhanced middleware caching, and resolved async session bottlenecks.",
      start_time: "2026-10-19 09:30:00",
      end_time: "2026-10-19 18:15:00",
      break_minutes: 45,
      hours: 8.0,
      status: "submitted",
      submitted_at: "2026-10-19 18:15:00",
    },
  ];

  for (const item of items) {
    await pool.query(
      `INSERT INTO timesheets (
        employee_id, date, project, client, task, description,
        start_time, end_time, break_minutes, hours, status,
        submitted_at, reviewed_by, reviewed_at, review_comment,
        manager_approved_by, manager_approved_at, manager_remarks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      [
        item.employee_id,
        item.date,
        item.project,
        item.client,
        item.task,
        item.description,
        item.start_time,
        item.end_time,
        item.break_minutes,
        item.hours,
        item.status,
        item.submitted_at || null,
        item.reviewed_by || null,
        item.reviewed_at || null,
        item.review_comment || null,
        item.manager_approved_by || null,
        item.manager_approved_at || null,
        item.manager_remarks || null,
      ]
    );
    console.log(`Inserted timesheet for employee ${item.employee_id} (${item.status})`);
  }

  const checkRes = await pool.query("SELECT id, employee_id, date, status, project, task FROM timesheets WHERE date = '2026-10-19'");
  console.table(checkRes.rows);
  console.log("Seeding complete successfully!");
  process.exit(0);
}

seedOct19Timesheets().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
