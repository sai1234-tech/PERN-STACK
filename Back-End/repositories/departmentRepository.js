import pool from "../config/db.js";

export const initDepartmentTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS departments (
            id SERIAL PRIMARY KEY,
            department_code VARCHAR(50) UNIQUE NOT NULL,
            department_name VARCHAR(100) NOT NULL,
            manager_name VARCHAR(100) DEFAULT '',
            manager_email VARCHAR(255) DEFAULT '',
            description TEXT DEFAULT '',
            location VARCHAR(100) DEFAULT '',
            status VARCHAR(20) DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_departments_code ON departments(department_code);
    `;
    await pool.query(queryText);
};

export const formatDepartment = (row) => {
    if (!row) return null;
    return {
        _id: row.id,
        id: row.id,
        departmentCode: row.department_code,
        departmentName: row.department_name,
        managerName: row.manager_name || "",
        managerEmail: row.manager_email || "",
        description: row.description || "",
        location: row.location || "",
        status: row.status || "Active",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

export const createMultipleDepartmentRecords = async (departmentsData) => {
    const inserted = [];
    for (const data of departmentsData) {
        const queryText = `
            INSERT INTO departments (department_code, department_name, manager_name, manager_email, description, location, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        const values = [
            data.departmentCode.trim(),
            data.departmentName.trim(),
            data.managerName || "",
            data.managerEmail || "",
            data.description || "",
            data.location || "",
            data.status || "Active"
        ];
        const { rows } = await pool.query(queryText, values);
        inserted.push(formatDepartment(rows[0]));
    }
    return inserted;
};

export const findAllDepartments = async (search = "") => {
    let queryText = `SELECT * FROM departments`;
    const values = [];

    if (search && search.trim()) {
        queryText += `
            WHERE 
                department_code ILIKE $1 OR
                department_name ILIKE $1 OR
                manager_name ILIKE $1 OR
                location ILIKE $1
        `;
        values.push(`%${search.trim()}%`);
    }

    queryText += ` ORDER BY created_at DESC;`;
    const { rows } = await pool.query(queryText, values);
    return rows.map(formatDepartment);
};

export const findDepartmentById = async (id) => {
    const queryText = `SELECT * FROM departments WHERE id = $1;`;
    const { rows } = await pool.query(queryText, [id]);
    return rows[0] ? formatDepartment(rows[0]) : null;
};

export const findDepartmentByCode = async (code) => {
    const queryText = `SELECT * FROM departments WHERE UPPER(department_code) = UPPER($1);`;
    const { rows } = await pool.query(queryText, [code]);
    return rows[0] ? formatDepartment(rows[0]) : null;
};

export const updateDepartmentRecord = async (id, data) => {
    const queryText = `
        UPDATE departments
        SET 
            department_code = $1,
            department_name = $2,
            description = $3,
            manager_name = $4,
            manager_email = $5,
            location = $6,
            status = $7,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
        RETURNING *;
    `;
    const values = [
        data.departmentCode,
        data.departmentName,
        data.description || "",
        data.managerName || "",
        data.managerEmail || "",
        data.location || "",
        data.status || "Active",
        id
    ];
    const { rows } = await pool.query(queryText, values);
    return rows[0] ? formatDepartment(rows[0]) : null;
};

export const deleteDepartmentRecord = async (id) => {
    const queryText = `DELETE FROM departments WHERE id = $1 RETURNING *;`;
    const { rows } = await pool.query(queryText, [id]);
    return rows[0] ? formatDepartment(rows[0]) : null;
};
