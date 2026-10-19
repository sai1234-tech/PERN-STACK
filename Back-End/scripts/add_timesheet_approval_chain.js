import pool from "../config/db.js";

async function main() {
  console.log("Updating timesheets schema for Employee -> Manager -> HR approval workflow...");

  await pool.query(`
    ALTER TABLE timesheets ALTER COLUMN status TYPE VARCHAR(50);
    ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS manager_approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMP;
    ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS manager_remarks TEXT DEFAULT '';
    ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS hr_approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS hr_approved_at TIMESTAMP;
    ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS hr_remarks TEXT DEFAULT '';
  `);

  console.log("Timesheets schema successfully updated!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
