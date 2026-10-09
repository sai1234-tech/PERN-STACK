import pool from "../config/db.js";

export const initTicketTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS tickets (
            id SERIAL PRIMARY KEY,
            ticket_id VARCHAR(50) UNIQUE NOT NULL,
            emp_id VARCHAR(100) NOT NULL,
            query TEXT NOT NULL,
            status VARCHAR(20) DEFAULT 'Open',
            resolution TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_tickets_emp_id ON tickets(emp_id);
    `;
    await pool.query(queryText);
};

export const formatTicket = (row) => {
    if (!row) return null;
    return {
        _id: row.id,
        id: row.ticket_id || row.id,
        dbId: row.id,
        empId: row.emp_id,
        query: row.query,
        status: row.status || "Open",
        resolution: row.resolution || "",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

export const createTicketRecord = async ({ ticketId, empId, query, status = "Open" }) => {
    const queryText = `
        INSERT INTO tickets (ticket_id, emp_id, query, status)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
    `;
    const values = [ticketId, empId, query, status];
    const { rows } = await pool.query(queryText, values);
    return formatTicket(rows[0]);
};

export const findAllTickets = async () => {
    const queryText = `
        SELECT * FROM tickets
        ORDER BY created_at DESC;
    `;
    const { rows } = await pool.query(queryText);
    return rows.map(formatTicket);
};

export const findTicketByTicketId = async (ticketId) => {
    const queryText = `
        SELECT * FROM tickets
        WHERE ticket_id = $1 OR id::text = $1;
    `;
    const { rows } = await pool.query(queryText, [ticketId]);
    return rows[0] ? formatTicket(rows[0]) : null;
};

export const resolveTicketRecord = async (ticketId, resolution) => {
    const queryText = `
        UPDATE tickets
        SET status = 'Resolved', resolution = $1, updated_at = CURRENT_TIMESTAMP
        WHERE ticket_id = $2 OR id::text = $2
        RETURNING *;
    `;
    const { rows } = await pool.query(queryText, [resolution || "", ticketId]);
    return rows[0] ? formatTicket(rows[0]) : null;
};

export const findMyTickets = async (searchTerms = []) => {
    if (!searchTerms.length) {
        return findAllTickets();
    }

    const queryText = `
        SELECT * FROM tickets
        WHERE emp_id ILIKE ANY($1) OR emp_id = 'HR-CONNECT' OR emp_id = 'EMP-UNKNOWN'
        ORDER BY created_at DESC;
    `;
    const patternList = searchTerms.map((t) => `%${t}%`);
    const { rows } = await pool.query(queryText, [patternList]);
    return rows.map(formatTicket);
};
