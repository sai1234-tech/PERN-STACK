import bcrypt from "bcryptjs";
import pool from "./config/db.js";

async function seed() {
  try {
    const hash = await bcrypt.hash("Password@123", 10);
    
    // Update existing users password
    await pool.query(
      "UPDATE users SET password = $1 WHERE email IN ('admin@company.com', 'hr@company.com', 'manager@company.com', 'saikiran@gmail.com', 'admin@example.com')",
      [hash]
    );

    // 10 Standard Enterprise User Roles
    const enterpriseRoles = [
      { name: "Super Admin", email: "superadmin@hrms.com", role: "super_admin", dept: "Executive Leadership", designation: "Chief Executive Officer / Super Admin" },
      { name: "HR Admin Operations", email: "hradmin@hrms.com", role: "hr_admin", dept: "Human Resources", designation: "HR Operations Lead" },
      { name: "Ananya Sharma", email: "hr@hrms.com", role: "hr", dept: "Human Resources", designation: "Senior HR Manager" },
      { name: "Rohan Verma", email: "recruiter@hrms.com", role: "recruiter", dept: "Talent Acquisition", designation: "Lead Technical Recruiter" },
      { name: "Vikas Guru", email: "manager@hrms.com", role: "manager", dept: "Engineering", designation: "Engineering Delivery Manager" },
      { name: "Pooja Hegde", email: "payroll@hrms.com", role: "payroll", dept: "Finance & Accounts", designation: "Payroll & Compensation Lead" },
      { name: "Kiran Kumar", email: "itadmin@hrms.com", role: "it_admin", dept: "IT & Infrastructure", designation: "IT Systems Administrator" },
      { name: "Arjun Reddy", email: "employee@hrms.com", role: "employee", dept: "Engineering", designation: "Senior Software Engineer" },
      { name: "Meera Nair", email: "leadership@hrms.com", role: "leadership", dept: "Executive Board", designation: "VP of Strategic Operations" },
      { name: "Suresh Iyer", email: "auditor@hrms.com", role: "auditor", dept: "Compliance & Risk", designation: "Statutory Compliance Auditor" },
      { name: "System Administrator", email: "admin@hrms.com", role: "admin", dept: "Executive Leadership", designation: "System Administrator" },
    ];

    for (const u of enterpriseRoles) {
      const check = await pool.query("SELECT id FROM users WHERE email = $1", [u.email]);
      let userId;
      if (check.rows.length === 0) {
        const userRes = await pool.query(
          "INSERT INTO users (name, email, password, role, is_active) VALUES ($1, $2, $3, $4, true) RETURNING id",
          [u.name, u.email, hash, u.role]
        );
        userId = userRes.rows[0].id;
      } else {
        userId = check.rows[0].id;
        await pool.query("UPDATE users SET password = $1, role = $2, name = $3, is_active = true WHERE id = $4", [hash, u.role, u.name, userId]);
      }

      const empCode = `EMP-${2000 + userId}`;
      const nameParts = u.name.split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || "";

      await pool.query(
        `INSERT INTO employees (user_id, first_name, last_name, email, employee_code, department, designation, status, joining_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', CURRENT_DATE)
         ON CONFLICT (user_id) DO UPDATE SET 
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           department = EXCLUDED.department,
           designation = EXCLUDED.designation,
           status = 'Active'`,
        [userId, firstName, lastName, u.email, empCode, u.dept, u.designation]
      );
    }

    console.log("✓ Seeded and synchronized all 10 Enterprise Roles into PostgreSQL DB successfully.");
  } catch (err) {
    console.error("Seeding error:", err);
  } finally {
    process.exit();
  }
}

seed();
