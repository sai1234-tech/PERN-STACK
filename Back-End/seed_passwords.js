import bcrypt from "bcryptjs";
import pool from "./config/db.js";

async function seed() {
  try {
    const hash = await bcrypt.hash("Password@123", 10);
    
    // Update existing users
    await pool.query(
      "UPDATE users SET password = $1 WHERE email IN ('admin@company.com', 'hr@company.com', 'manager@company.com', 'saikiran@gmail.com', 'admin@example.com')",
      [hash]
    );
    console.log("Updated existing user passwords.");

    const demoUsers = [
      { name: "Admin Demo", email: "admin@hrms.com", role: "admin" },
      { name: "HR Manager", email: "hr@hrms.com", role: "hr" },
      { name: "Team Manager", email: "manager@hrms.com", role: "manager" },
      { name: "Employee Demo", email: "employee@hrms.com", role: "employee" }
    ];

    for (const u of demoUsers) {
      const check = await pool.query("SELECT id FROM users WHERE email = $1", [u.email]);
      if (check.rows.length === 0) {
        const userRes = await pool.query(
          "INSERT INTO users (name, email, password, role, is_active) VALUES ($1, $2, $3, $4, true) RETURNING id",
          [u.name, u.email, hash, u.role]
        );
        const userId = userRes.rows[0].id;
        const empCode = `EMP-${1000 + userId}`;
        await pool.query(
          "INSERT INTO employees (user_id, first_name, last_name, email, employee_code, department, designation, status, joining_date) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', CURRENT_DATE) ON CONFLICT (user_id) DO NOTHING",
          [userId, u.name.split(" ")[0], u.name.split(" ")[1] || "", u.email, empCode, u.role === 'hr' ? 'Human Resources' : (u.role === 'admin' ? 'Executive Leadership' : 'Engineering'), u.role === 'hr' ? 'HR Manager' : (u.role === 'admin' ? 'System Administrator' : 'Software Engineer')]
        );
      } else {
        await pool.query("UPDATE users SET password = $1, role = $2, is_active = true WHERE email = $3", [hash, u.role, u.email]);
      }
    }
    console.log("Seeded/updated demo accounts in PostgreSQL DB successfully.");
  } catch (err) {
    console.error("Seeding error:", err);
  } finally {
    process.exit();
  }
}

seed();
