import pool from "../config/db.js";

export const initPulseTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS daily_pulses (
            id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            department VARCHAR(100) DEFAULT 'General',
            date DATE NOT NULL,
            score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
            feedback TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_pulse_employee_date UNIQUE (employee_id, date)
        );

        CREATE INDEX IF NOT EXISTS idx_daily_pulses_date ON daily_pulses(date);
    `;
    await pool.query(queryText);
};

export const formatPulse = (row) => {
    if (!row) return null;
    return {
        _id: row.id,
        id: row.id,
        employee: row.employee_id,
        user: row.user_id,
        department: row.department || "General",
        date: row.date,
        score: Number(row.score),
        feedback: row.feedback || "",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

export const upsertDailyPulseRecord = async ({ employeeId, userId, department, date, score, feedback }) => {
    const queryText = `
        INSERT INTO daily_pulses (employee_id, user_id, department, date, score, feedback)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (employee_id, date)
        DO UPDATE SET
            user_id = EXCLUDED.user_id,
            department = EXCLUDED.department,
            score = EXCLUDED.score,
            feedback = EXCLUDED.feedback,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *;
    `;
    const values = [employeeId, userId, department || "General", date, score, feedback || ""];
    const { rows } = await pool.query(queryText, values);
    return formatPulse(rows[0]);
};

export const findDailyPulseByEmployeeAndDate = async (employeeId, date) => {
    const queryText = `
        SELECT * FROM daily_pulses
        WHERE employee_id = $1 AND date = $2;
    `;
    const { rows } = await pool.query(queryText, [employeeId, date]);
    return rows[0] ? formatPulse(rows[0]) : null;
};

export const findDailyPulsesByDate = async (date) => {
    const queryText = `
        SELECT * FROM daily_pulses
        WHERE date = $1;
    `;
    const { rows } = await pool.query(queryText, [date]);
    return rows.map(formatPulse);
};

export const aggregateDepartmentPulseByDate = async (date) => {
    const queryText = `
        SELECT 
            department,
            AVG(score)::FLOAT as avg_score,
            COUNT(*)::INTEGER as count
        FROM daily_pulses
        WHERE date = $1
        GROUP BY department;
    `;
    const { rows } = await pool.query(queryText, [date]);
    return rows;
};

export const findRecentPulsesAdmin = async (limit = 30) => {
    const queryText = `
        SELECT 
            p.*,
            e.employee_code, e.first_name, e.last_name, e.profile_photo,
            e.employment->>'department' as emp_department,
            e.employment->>'designation' as designation,
            u.name as user_name, u.email as user_email, u.role as user_role
        FROM daily_pulses p
        LEFT JOIN employees e ON p.employee_id = e.id
        LEFT JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
        LIMIT $1;
    `;
    const { rows } = await pool.query(queryText, [limit]);
    return rows;
};
