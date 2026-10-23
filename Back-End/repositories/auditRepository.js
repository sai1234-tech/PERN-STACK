import pool from "../config/db.js";

export const initAuditTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS audit_logs (
            id SERIAL PRIMARY KEY,
            action VARCHAR(100) NOT NULL,
            entity_type VARCHAR(50) NOT NULL,
            entity_id VARCHAR(100) DEFAULT '',
            details TEXT DEFAULT '',
            user_name VARCHAR(150) DEFAULT 'System',
            user_role VARCHAR(50) DEFAULT '',
            ip_address VARCHAR(50) DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC);
    `;
    await pool.query(queryText);
};

export const formatAudit = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id || "",
        details: row.details || "",
        userName: row.user_name || "System",
        userRole: row.user_role || "",
        ipAddress: row.ip_address || "",
        timestamp: row.created_at,
        createdAt: row.created_at
    };
};

export const logAuditRecord = async ({
    action,
    entityType = "System",
    entityId = "",
    details = "",
    userName = "System",
    userRole = "",
    ipAddress = ""
}) => {
    try {
        const queryText = `
            INSERT INTO audit_logs (
                action, entity_type, entity_id, details, user_name, user_role, ip_address
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        const values = [action, entityType, entityId, details, userName, userRole, ipAddress];
        const { rows } = await pool.query(queryText, values);
        return formatAudit(rows[0]);
    } catch (err) {
        console.warn("Notice: Failed to append to audit log table:", err.message);
        return null;
    }
};

export const findAllAuditLogs = async (limit = 150) => {
    const queryText = `
        SELECT * FROM audit_logs
        ORDER BY created_at DESC, id DESC
        LIMIT $1;
    `;
    const { rows } = await pool.query(queryText, [limit]);
    return rows.map(formatAudit);
};
