import pool from "../config/db.js";

export const initEventTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS events (
            id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            date DATE NOT NULL,
            title VARCHAR(255) NOT NULL,
            time VARCHAR(50) DEFAULT '',
            start_time VARCHAR(50) DEFAULT '10:00',
            end_time VARCHAR(50) DEFAULT '11:30',
            duration VARCHAR(50) DEFAULT '1 hr 30 mins',
            category VARCHAR(100) DEFAULT 'Meeting',
            tag VARCHAR(100) DEFAULT 'Custom Event',
            type VARCHAR(50) DEFAULT 'custom',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_events_employee_date ON events(employee_id, date);
    `;
    await pool.query(queryText);
};

export const formatEvent = (row) => {
    if (!row) return null;
    return {
        _id: row.id,
        id: row.id,
        employee: row.employee_id,
        date: row.date,
        title: row.title,
        time: row.time || "",
        startTime: row.start_time || "10:00",
        endTime: row.end_time || "11:30",
        duration: row.duration || "1 hr 30 mins",
        category: row.category || "Meeting",
        tag: row.tag || "Custom Event",
        type: row.type || "custom",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

export const createEventRecord = async (data) => {
    const {
        employeeId,
        date,
        title,
        time = "",
        startTime = "10:00",
        endTime = "11:30",
        duration = "1 hr 30 mins",
        category = "Meeting",
        tag = "Custom Event",
        type = "custom"
    } = data;

    const queryText = `
        INSERT INTO events (
            employee_id, date, title, time, start_time, end_time, duration, category, tag, type
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *;
    `;
    const values = [employeeId, date, title, time, startTime, endTime, duration, category, tag, type];
    const { rows } = await pool.query(queryText, values);
    return formatEvent(rows[0]);
};

export const findEventsByEmployeeAndDate = async (employeeId, date) => {
    const queryText = `
        SELECT * FROM events
        WHERE employee_id = $1 AND date = $2
        ORDER BY created_at ASC;
    `;
    const { rows } = await pool.query(queryText, [employeeId, date]);
    return rows.map(formatEvent);
};

export const findEventsByEmployee = async (employeeId) => {
    const queryText = `
        SELECT * FROM events
        WHERE employee_id = $1
        ORDER BY date DESC, created_at ASC;
    `;
    const { rows } = await pool.query(queryText, [employeeId]);
    return rows.map(formatEvent);
};

export const deleteEventRecord = async (id, employeeId) => {
    const queryText = `DELETE FROM events WHERE id = $1 AND employee_id = $2 RETURNING *;`;
    const { rows } = await pool.query(queryText, [id, employeeId]);
    return rows[0] ? formatEvent(rows[0]) : null;
};
