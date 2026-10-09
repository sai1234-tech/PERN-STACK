import pool from "../config/db.js";

export const initPerformanceTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS okrs (
            id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            objective TEXT NOT NULL,
            result VARCHAR(50) DEFAULT 'Pending Review',
            score NUMERIC(3, 1) DEFAULT 0,
            reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            feedback TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_okrs_employee_id ON okrs(employee_id);

        ALTER TABLE okrs ADD COLUMN IF NOT EXISTS result VARCHAR(50) DEFAULT 'Pending Review';
        ALTER TABLE okrs ADD COLUMN IF NOT EXISTS score NUMERIC(3, 1) DEFAULT 0;
        ALTER TABLE okrs ADD COLUMN IF NOT EXISTS reviewer_id INTEGER;
        ALTER TABLE okrs ADD COLUMN IF NOT EXISTS feedback TEXT DEFAULT '';
    `;
    await pool.query(queryText);
};

export const formatOkr = (row) => {
    if (!row) return null;
    return {
        _id: row.id,
        id: row.id,
        employee: row.first_name ? {
            _id: row.employee_id,
            id: row.employee_id,
            firstName: row.first_name,
            lastName: row.last_name || "",
            email: row.email || "",
            department: row.department || "",
            designation: row.designation || "",
        } : row.employee_id,
        objective: row.objective,
        result: row.result || "Pending Review",
        score: Number(row.score || 0),
        reviewer: row.reviewer_id,
        feedback: row.feedback || "",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

export const createOkrRecord = async ({ employeeId, objective }) => {
    const queryText = `
        INSERT INTO okrs (employee_id, objective)
        VALUES ($1, $2)
        RETURNING *;
    `;
    const { rows } = await pool.query(queryText, [employeeId, objective]);
    return formatOkr(rows[0]);
};

export const findOkrsByEmployee = async (employeeId) => {
    const queryText = `
        SELECT * FROM okrs
        WHERE employee_id = $1
        ORDER BY created_at DESC;
    `;
    const { rows } = await pool.query(queryText, [employeeId]);
    return rows.map(formatOkr);
};

export const findAllOkrsAdmin = async () => {
    const queryText = `
        SELECT 
            o.*,
            e.first_name, e.last_name, e.email,
            e.employment->>'department' as department,
            e.employment->>'designation' as designation
        FROM okrs o
        LEFT JOIN employees e ON o.employee_id = e.id
        ORDER BY o.created_at DESC;
    `;
    const { rows } = await pool.query(queryText);
    return rows.map(formatOkr);
};

export const findOkrById = async (id) => {
    const queryText = `
        SELECT 
            o.*,
            e.first_name, e.last_name, e.email,
            e.employment->>'department' as department,
            e.employment->>'designation' as designation
        FROM okrs o
        LEFT JOIN employees e ON o.employee_id = e.id
        WHERE o.id = $1;
    `;
    const { rows } = await pool.query(queryText, [id]);
    return rows[0] ? formatOkr(rows[0]) : null;
};

export const updateOkrScoreRecord = async (id, { score, result, reviewerId, feedback }) => {
    const queryText = `
        UPDATE okrs
        SET 
            score = $1,
            result = $2,
            reviewer_id = $3,
            feedback = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *;
    `;
    const values = [score, result, reviewerId, feedback || "", id];
    const { rows } = await pool.query(queryText, values);
    return findOkrById(rows[0].id);
};
