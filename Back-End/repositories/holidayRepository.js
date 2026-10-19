import pool from "../config/db.js";

export const initHolidayTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS holidays (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            date DATE NOT NULL,
            type VARCHAR(50) DEFAULT 'Public Holiday',
            description TEXT DEFAULT '',
            added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
    `;
    await pool.query(queryText);
};

export const formatHoliday = (row) => {
    if (!row) return null;
    return {
        _id: row.id,
        id: row.id,
        title: row.title,
        date: row.date,
        type: row.type || "Public Holiday",
        description: row.description || "",
        addedBy: row.added_by || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

export const findAllHolidays = async () => {
    const queryText = `
        SELECT * FROM holidays
        ORDER BY date ASC;
    `;
    const { rows } = await pool.query(queryText);
    return rows.map(formatHoliday);
};

export const countHolidays = async () => {
    const queryText = `SELECT COUNT(*)::INTEGER as count FROM holidays;`;
    const { rows } = await pool.query(queryText);
    return rows[0].count;
};

export const createHolidayRecord = async ({ title, date, type = "Public Holiday", description = "", addedBy = null }) => {
    const queryText = `
        INSERT INTO holidays (title, date, type, description, added_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
    `;
    const values = [title, date, type, description, addedBy];
    const { rows } = await pool.query(queryText, values);
    return formatHoliday(rows[0]);
};

export const seedDefaultHolidays = async (holidayList) => {
    const inserted = [];
    for (const item of holidayList) {
        const itemResult = await createHolidayRecord(item);
        inserted.push(itemResult);
    }
    return inserted;
};

export const deleteHolidayRecord = async (id) => {
    const queryText = `
        DELETE FROM holidays
        WHERE id = $1
        RETURNING *;
    `;
    const { rows } = await pool.query(queryText, [id]);
    return formatHoliday(rows[0]);
};


