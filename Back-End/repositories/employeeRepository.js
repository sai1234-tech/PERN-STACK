import pool from "../config/db.js";

// Initialize employees table in PostgreSQL
export const initEmployeeTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS employees (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
            reports_to INTEGER REFERENCES employees(id) ON DELETE SET NULL,
            employee_code VARCHAR(50) UNIQUE NOT NULL,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) DEFAULT '',
            email VARCHAR(255) UNIQUE NOT NULL,
            phone VARCHAR(50) DEFAULT '',
            pan VARCHAR(50) DEFAULT '',
            uan VARCHAR(50) DEFAULT '',
            profile_photo TEXT DEFAULT '',
            work_location VARCHAR(100) DEFAULT '',
            personal JSONB DEFAULT '{}'::jsonb,
            employment JSONB DEFAULT '{}'::jsonb,
            address JSONB DEFAULT '{}'::jsonb,
            emergency_contact JSONB DEFAULT '{}'::jsonb,
            banking JSONB DEFAULT '{}'::jsonb,
            skills JSONB DEFAULT '[]'::jsonb,
            certifications JSONB DEFAULT '[]'::jsonb,
            awards JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Dynamic Column Migrations for Existing Tables
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id INTEGER;
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS reports_to INTEGER;
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone VARCHAR(50) DEFAULT '';
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS pan VARCHAR(50) DEFAULT '';
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS uan VARCHAR(50) DEFAULT '';
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_photo TEXT DEFAULT '';
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_location VARCHAR(100) DEFAULT '';
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS personal JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS address JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS banking JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS awards JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `;
    await pool.query(queryText);
};


export const countEmployees = async () => {
    const queryText = `SELECT COUNT(*)::INTEGER as count FROM employees;`;
    const { rows } = await pool.query(queryText);
    return rows[0].count;
};

export const createEmployeeRecord = async (data) => {
    const {
        userId = null,
        reportsTo = null,
        employeeCode,
        firstName,
        lastName = "",
        email,
        phone = "",
        pan = "",
        uan = "",
        profilePhoto = "",
        workLocation = "",
        personal = {},
        employment = {},
        address = {},
        emergencyContact = {},
        banking = {},
        skills = [],
        certifications = [],
        awards = []
    } = data;

    const queryText = `
        INSERT INTO employees (
            user_id, reports_to, employee_code, first_name, last_name, 
            email, phone, pan, uan, profile_photo, work_location, 
            personal, employment, address, emergency_contact, banking, 
            skills, certifications, awards
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *;
    `;

    const values = [
        userId,
        reportsTo,
        employeeCode.toUpperCase().trim(),
        firstName.trim(),
        lastName.trim(),
        email.toLowerCase().trim(),
        phone,
        pan,
        uan,
        profilePhoto,
        workLocation,
        JSON.stringify(personal),
        JSON.stringify(employment),
        JSON.stringify(address),
        JSON.stringify(emergencyContact),
        JSON.stringify(banking),
        JSON.stringify(skills),
        JSON.stringify(certifications),
        JSON.stringify(awards)
    ];

    const { rows } = await pool.query(queryText, values);
    return rows[0];
};

export const findEmployeeById = async (id) => {
    const queryText = `
        SELECT 
            e.*, 
            u.name as user_name, u.email as user_email, u.role as user_role, u.is_active as user_is_active,
            m.first_name as manager_first_name, m.last_name as manager_last_name, m.employee_code as manager_code
        FROM employees e
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN employees m ON e.reports_to = m.id
        WHERE e.id = $1;
    `;
    const { rows } = await pool.query(queryText, [id]);
    return rows[0];
};

export const findEmployeeByCode = async (code) => {
    const queryText = `
        SELECT 
            e.*, 
            u.name as user_name, u.email as user_email, u.role as user_role, u.is_active as user_is_active,
            m.first_name as manager_first_name, m.last_name as manager_last_name, m.employee_code as manager_code
        FROM employees e
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN employees m ON e.reports_to = m.id
        WHERE UPPER(e.employee_code) = UPPER($1);
    `;
    const { rows } = await pool.query(queryText, [code]);
    return rows[0];
};

export const findEmployeeByUserId = async (userId) => {
    const queryText = `
        SELECT 
            e.*, 
            u.name as user_name, u.email as user_email, u.role as user_role, u.is_active as user_is_active,
            m.first_name as manager_first_name, m.last_name as manager_last_name, m.employee_code as manager_code
        FROM employees e
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN employees m ON e.reports_to = m.id
        WHERE e.user_id = $1;
    `;
    const { rows } = await pool.query(queryText, [userId]);
    return rows[0];
};

export const findEmployeeByEmail = async (email) => {
    const queryText = `
        SELECT * FROM employees 
        WHERE LOWER(email) = LOWER($1);
    `;
    const { rows } = await pool.query(queryText, [email]);
    return rows[0];
};

export const findEmployeeByCodeOrEmail = async (identifier) => {
    const queryText = `
        SELECT * FROM employees 
        WHERE UPPER(employee_code) = UPPER($1) OR LOWER(email) = LOWER($1);
    `;
    const { rows } = await pool.query(queryText, [identifier]);
    return rows[0];
};

export const findAllEmployees = async (search = "") => {
    let queryText = `
        SELECT 
            e.*, 
            u.name as user_name, u.email as user_email, u.role as user_role, u.is_active as user_is_active,
            m.first_name as manager_first_name, m.last_name as manager_last_name, m.employee_code as manager_code
        FROM employees e
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN employees m ON e.reports_to = m.id
    `;
    const values = [];

    if (search && search.trim()) {
        queryText += `
            WHERE 
                e.employee_code ILIKE $1 OR
                e.first_name ILIKE $1 OR
                e.last_name ILIKE $1 OR
                e.email ILIKE $1 OR
                e.employment->>'department' ILIKE $1 OR
                e.employment->>'designation' ILIKE $1
        `;
        values.push(`%${search.trim()}%`);
    }

    queryText += ` ORDER BY e.created_at DESC;`;
    const { rows } = await pool.query(queryText, values);
    return rows;
};

export const updateEmployeeRecord = async (id, fields) => {
    const keys = Object.keys(fields);
    if (keys.length === 0) return null;

    const setClauses = [];
    const values = [];

    keys.forEach((key, index) => {
        setClauses.push(`${key} = $${index + 1}`);
        const val = fields[key];
        values.push(typeof val === "object" && val !== null ? JSON.stringify(val) : val);
    });

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const queryText = `
        UPDATE employees 
        SET ${setClauses.join(", ")}
        WHERE id = $${values.length}
        RETURNING *;
    `;

    const { rows } = await pool.query(queryText, values);
    return rows[0];
};

export const deleteEmployeeRecord = async (id) => {
    const queryText = `DELETE FROM employees WHERE id = $1 RETURNING *;`;
    const { rows } = await pool.query(queryText, [id]);
    return rows[0];
};
