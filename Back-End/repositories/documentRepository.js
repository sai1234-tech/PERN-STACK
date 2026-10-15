import pool from "../config/db.js";

export const DOCUMENT_TYPES = [
    "Aadhaar / ID Proof",
    "PAN",
    "Passport",
    "Address Proof",
    "Education Certificates",
    "Experience Letter",
    "Offer Letter",
    "Appointment Letter",
    "Bank Details",
    "Salary Documents",
    "Payslips",
    "Other Documents",
    "General Document",
    "Identity Proof",
    "Medical Certificate",
    "Tax Document"
];

// Initialize employee_documents table in PostgreSQL
export const initDocumentTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS employee_documents (
            id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            document_type VARCHAR(100) NOT NULL,
            document_name VARCHAR(255) DEFAULT '',
            original_name VARCHAR(255) DEFAULT '',
            file_name VARCHAR(255) DEFAULT '',
            file_path TEXT DEFAULT '',
            file_url TEXT DEFAULT '',
            mime_type VARCHAR(100) DEFAULT '',
            size INTEGER DEFAULT 0,
            status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('requested', 'pending', 'verified', 'rejected', 'fulfilled')),
            expiry_date DATE,
            verification_notes TEXT DEFAULT '',
            request_note TEXT DEFAULT '',
            is_required BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Dynamic Column Migrations
        ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
        ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE employee_documents DROP CONSTRAINT IF EXISTS employee_documents_status_check;
        ALTER TABLE employee_documents
            ADD CONSTRAINT employee_documents_status_check
            CHECK (status IN ('requested', 'pending', 'verified', 'rejected', 'fulfilled'));
    `;
    await pool.query(queryText);
};

export const createDocumentRecord = async (data) => {
    const {
        employeeId,
        uploadedBy,
        documentType,
        documentName = "",
        originalName = "",
        fileName = "",
        filePath = "",
        fileUrl = "",
        mimeType = "",
        size = 0,
        status = "pending",
        expiryDate = null,
        requestNote = "",
        isRequired = false
    } = data;

    const queryText = `
        INSERT INTO employee_documents (
            employee_id, uploaded_by, document_type, document_name, 
            original_name, file_name, file_path, file_url, mime_type, 
            size, status, expiry_date, request_note, is_required
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *;
    `;

    const values = [
        employeeId,
        uploadedBy,
        documentType,
        documentName,
        originalName,
        fileName,
        filePath,
        fileUrl,
        mimeType,
        size,
        status,
        expiryDate,
        requestNote,
        isRequired
    ];

    const { rows } = await pool.query(queryText, values);
    return rows[0];
};

export const findDocumentById = async (id) => {
    const queryText = `
        SELECT 
            d.*,
            e.employee_code, e.first_name AS employee_first_name, e.last_name AS employee_last_name, e.email AS employee_email,
            u1.name AS uploaded_by_name, u1.email AS uploaded_by_email, u1.role AS uploaded_by_role,
            u2.name AS verified_by_name, u2.email AS verified_by_email, u2.role AS verified_by_role
        FROM employee_documents d
        JOIN employees e ON d.employee_id = e.id
        LEFT JOIN users u1 ON d.uploaded_by = u1.id
        LEFT JOIN users u2 ON d.verified_by = u2.id
        WHERE d.id = $1;
    `;
    const { rows } = await pool.query(queryText, [id]);
    return rows[0];
};

export const findDocumentsByEmployeeId = async (employeeId) => {
    const queryText = `
        SELECT 
            d.*,
            e.employee_code, e.first_name AS employee_first_name, e.last_name AS employee_last_name, e.email AS employee_email,
            u1.name AS uploaded_by_name, u1.email AS uploaded_by_email, u1.role AS uploaded_by_role,
            u2.name AS verified_by_name, u2.email AS verified_by_email, u2.role AS verified_by_role
        FROM employee_documents d
        JOIN employees e ON d.employee_id = e.id
        LEFT JOIN users u1 ON d.uploaded_by = u1.id
        LEFT JOIN users u2 ON d.verified_by = u2.id
        WHERE d.employee_id = $1
        ORDER BY d.created_at DESC;
    `;
    const { rows } = await pool.query(queryText, [employeeId]);
    return rows;
};

export const updateDocumentRecord = async (id, fields) => {
    const keys = Object.keys(fields);
    if (keys.length === 0) return null;

    const setClauses = [];
    const values = [];

    keys.forEach((key, index) => {
        setClauses.push(`${key} = $${index + 1}`);
        values.push(fields[key]);
    });

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const queryText = `
        UPDATE employee_documents 
        SET ${setClauses.join(", ")}
        WHERE id = $${values.length}
        RETURNING *;
    `;

    const { rows } = await pool.query(queryText, values);
    return rows[0];
};

export const deleteDocumentRecord = async (id) => {
    const queryText = `DELETE FROM employee_documents WHERE id = $1 RETURNING *;`;
    const { rows } = await pool.query(queryText, [id]);
    return rows[0];
};
