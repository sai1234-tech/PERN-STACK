import pool from "../config/db.js";

async function seed() {
  try {
    const existing = await pool.query("SELECT count(*) FROM delivery_phase_signoffs");
    if (parseInt(existing.rows[0].count, 10) === 0) {
      await pool.query(`
        INSERT INTO delivery_phase_signoffs (phase_no, decision, signed_by_id, signed_by_name, signed_by_role, comments, signed_at)
        VALUES 
          (0, 'APPROVED', '11', 'Ananya Varma (Head of HR)', 'hr', 'Phase 0 Discovery & Architecture approved. All 6 core deliverables verified against PostgreSQL schema and documentation.', NOW() - INTERVAL '14 days'),
          (1, 'APPROVED', '1', 'Super Admin (Enterprise Governance)', 'admin', 'Phase 1 MVP Core approved. RBAC, Employee Master (55 staff), Onboarding, and Leave modules fully operational in production.', NOW() - INTERVAL '7 days')
      `);
      console.log("✓ Seeded realistic delivery phase signoffs for Phase 0 and Phase 1");
    } else {
      console.log("Signoffs already exist:", existing.rows[0].count);
    }
    process.exit(0);
  } catch (err) {
    console.error("Failed to seed signoffs:", err);
    process.exit(1);
  }
}

seed();

