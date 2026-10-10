import pool from "./config/db.js";
import bcrypt from "bcryptjs";

async function createAnanyaAccount() {
  try {
    const passwordHash = await bcrypt.hash("Hr@202601", 10);
    const email = "ananyavarma.hr@company.com";

    const checkUser = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    let user;
    if (checkUser.rows.length === 0) {
      const userRes = await pool.query(
        "INSERT INTO users (name, email, password, role, is_active) VALUES ($1, $2, $3, $4, true) RETURNING *",
        ["Ananya Varma", email, passwordHash, "hr"]
      );
      user = userRes.rows[0];
      console.log("✓ Created user:", user);
    } else {
      user = checkUser.rows[0];
      await pool.query("UPDATE users SET password = $1, role = $2 WHERE id = $3", [passwordHash, "hr", user.id]);
      console.log("✓ Updated password and role for existing user:", user);
    }

    const checkEmp = await pool.query("SELECT * FROM employees WHERE user_id = $1", [user.id]);
    if (checkEmp.rows.length === 0) {
      const empRes = await pool.query(
        `INSERT INTO employees (
          user_id, employee_code, first_name, last_name, email, employment
        ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          user.id,
          "EMP-HR001",
          "Ananya",
          "Varma",
          email,
          JSON.stringify({
            department: "Human Resources",
            designation: "HR Lead & Operations Manager",
            status: "Active"
          })
        ]
      );
      console.log("✓ Created employee profile:", empRes.rows[0]);
    } else {
      console.log("✓ Employee profile already exists:", checkEmp.rows[0]);
    }

    process.exit(0);
  } catch (err) {
    console.error("Error creating account:", err);
    process.exit(1);
  }
}

createAnanyaAccount();
