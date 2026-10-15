import bcrypt from "bcryptjs";
import pool from "../config/db.js";
import { createUser, findUserByEmail, findUserById } from "../repositories/userRepository.js";
import {
    findEmployeeByUserId,
    findEmployeeByEmail,
    findEmployeeById,
    createEmployeeRecord,
    updateEmployeeRecord,
    countEmployees,
    findEmployeeByCodeOrEmail
} from "../repositories/employeeRepository.js";
import { formatEmployeeResponse } from "./employeeController.js";
import generateJwt from "../utils/generateJwt.js";
import { upsertPayrollRecord } from "../repositories/payrollRepository.js";


// Allowed Roles
const ALLOWED_ROLES = ["admin", "hr", "manager", "employee"];

export const getFirstAdminSetupStatus = async (_req, res) => {
    try {
        const { rows } = await pool.query("SELECT EXISTS (SELECT 1 FROM users WHERE role = 'admin') AS complete");
        return res.status(200).json({ setupComplete: rows[0].complete });
    } catch (error) {
        console.error("First admin setup status error:", error);
        return res.status(500).json({ message: "Unable to check admin setup status." });
    }
};

export const setupFirstAdmin = async (req, res) => {
    const { name, email, password } = req.body || {};
    const trimmedName = String(name || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!trimmedName || trimmedName.length < 3 || trimmedName.length > 30 || !normalizedEmail || !password) {
        return res.status(400).json({ message: "A name (3–30 characters), email, and password are required." });
    }
    if (String(password).length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock($1)", [782451906]);

        const admins = await client.query("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1");
        if (admins.rowCount > 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({ message: "Admin setup is already complete." });
        }

        const existingUser = await client.query("SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)", [normalizedEmail]);
        if (existingUser.rowCount > 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({ message: "An account with this email already exists." });
        }

        const passwordHash = await bcrypt.hash(String(password), 12);
        const created = await client.query(
            `INSERT INTO users (name, email, password, role, is_active)
             VALUES ($1, $2, $3, 'admin', TRUE)
             RETURNING id, name, email, role, is_active`,
            [trimmedName, normalizedEmail, passwordHash]
        );

        await client.query("COMMIT");
        return res.status(201).json({ message: "Admin account created successfully.", user: created.rows[0] });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("First admin setup error:", error);
        return res.status(500).json({ message: "Failed to create the first admin account." });
    } finally {
        client.release();
    }
};

export const getAdminSummary = async (_req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                COUNT(*)::INTEGER AS total,
                COUNT(*) FILTER (WHERE role = 'hr')::INTEGER AS hr_total,
                COUNT(*) FILTER (WHERE role = 'admin')::INTEGER AS admin_total,
                COUNT(*) FILTER (WHERE role = 'employee' AND is_active = TRUE)::INTEGER AS active_employees
            FROM users
        `);
        const summary = rows[0];
        return res.status(200).json({
            success: true,
            data: {
                accounts: { total: summary.total },
                hr: { total: summary.hr_total },
                admins: { total: summary.admin_total },
                employees: { active: summary.active_employees },
            },
        });
    } catch (error) {
        console.error("Admin summary error:", error);
        return res.status(500).json({ success: false, message: "Failed to load account summary." });
    }
};


// Helper to provision or link an employee record for a user
export const provisionEmployeeForUser = async (user) => {
    if (!user) return null;

    // 1. Check if employee already linked by user_id
    let empRecord = await findEmployeeByUserId(user.id);
    if (empRecord) return empRecord;

    // 2. Check if employee already exists by email
    empRecord = await findEmployeeByEmail(user.email);
    if (empRecord) {
        if (!empRecord.user_id) {
            await updateEmployeeRecord(empRecord.id, { user_id: user.id });
            empRecord = await findEmployeeById(empRecord.id);
        }
        return empRecord;
    }

    // 3. Provision new employee profile with full Active status
    const count = await countEmployees();
    const generatedCode = `EMP${String(count + 1).padStart(3, "0")}`;
    const nameParts = (user.name || "Employee User").trim().split(/\s+/);
    const firstName = nameParts[0] || "Employee";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Default reporting manager: Vikas Guru if available
    let defaultManagerId = null;
    const defaultMgr = await findEmployeeByCodeOrEmail("gvikas@quadratics.com");
    if (defaultMgr && (user.role === "employee" || user.role === "intern")) {
        defaultManagerId = defaultMgr.id;
    }

    try {
        const cleanEmail = user.email && user.email.includes("@")
            ? user.email.toLowerCase().trim()
            : `${(user.name || "user").toLowerCase().replace(/[^a-z0-9]/g, "")}_${user.id}@quadratics.com`;

        const newEmp = await createEmployeeRecord({
            userId: user.id,
            reportsTo: defaultManagerId,
            employeeCode: generatedCode,
            firstName,
            lastName,
            email: cleanEmail,
            pan: "ABCDE1234F",
            uan: "100987654321",
            workLocation: "Hyderabad HQ",
            employment: {
                department: user.role === "hr" ? "Human Resources" : (user.role === "manager" ? "Engineering" : "Engineering"),
                designation: user.role === "hr" ? "HR Specialist" : (user.role === "manager" ? "Team Manager" : "Software Engineer"),
                joiningDate: new Date().toISOString().slice(0, 10),
                employmentType: "Full Time",
                status: "Active",
                reportsTo: defaultManagerId,
                salary: 660000
            },
            banking: {
                accountHolder: `${firstName} ${lastName}`.trim(),
                accountNumber: "1234567890",
                bankName: "HDFC Bank",
                ifscCode: "HDFC0001234"
            }
        });

        const provisioned = await findEmployeeById(newEmp.id);

        // Pre-initialize initial payroll record for current month so employee payroll page is fully ready
        try {
            const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
            await upsertPayrollRecord({
                employeeId: provisioned.id,
                month: currentMonthStr,
                basicSalary: 27500,
                allowances: 27500,
                bonus: 0,
                tax: 200,
                pf: 3300,
                deduction: 4400,
                grossSalary: 55000,
                totalDeductions: 7900,
                netSalary: 47100,
                generatedBy: user.id || 1,
                status: "generated"
            });
        } catch (prErr) {
            // Ignore if already exists
        }

        return provisioned;
    } catch (err) {
        return (await findEmployeeByUserId(user.id)) || (await findEmployeeByEmail(user.email));
    }
};

// @desc    Register a new user
// @route   POST /api/auth/signup
export const signup = async (req, res) => {
    try {
        const { name, email, password, role = "employee" } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email, and password are required." });
        }

        const trimmedName = name.trim();
        if (trimmedName.length < 3 || trimmedName.length > 30) {
            return res.status(400).json({ message: "Name must be between 3 and 30 characters." });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters." });
        }

        if (role && !ALLOWED_ROLES.includes(role)) {
            return res.status(400).json({ message: `Role must be one of: ${ALLOWED_ROLES.join(", ")}` });
        }

        // Check if user already exists
        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: "User with this email already exists." });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Save user to database
        const user = await createUser({
            name: trimmedName,
            email,
            password: passwordHash,
            role,
            isActive: true
        });

        // Automatically provision employee profile for new user
        const empRecord = await provisionEmployeeForUser(user);

        // Generate JWT token
        const token = generateJwt(user.id, user.role);

        res.status(201).json({
            message: "User registered successfully",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.is_active,
                created_at: user.created_at
            },
            employee: empRecord ? formatEmployeeResponse(empRecord) : null
        });
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ message: "Server error during registration", error: error.message });
    }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required." });
        }

        // Check user existence
        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        // Check account active status
        if (user.is_active === false) {
            return res.status(403).json({ message: "Account is inactive. Please contact your administrator." });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        // Generate JWT token and ensure employee record exists
        const token = generateJwt(user.id, user.role);
        const empRecord = await provisionEmployeeForUser(user);

        res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.is_active,
                created_at: user.created_at
            },
            employee: empRecord ? formatEmployeeResponse(empRecord) : null
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Server error during login", error: error.message });
    }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
export const getMe = async (req, res) => {
    try {
        const user = await findUserById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        const empRecord = await provisionEmployeeForUser(user);
        res.status(200).json({ 
            user,
            employee: empRecord ? formatEmployeeResponse(empRecord) : null
        });
    } catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({ message: "Server error retrieving profile", error: error.message });
    }
};
