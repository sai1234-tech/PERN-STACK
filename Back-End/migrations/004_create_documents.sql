-- Migration: 004_create_documents.sql
-- Create Employee Documents Table in PostgreSQL

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
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('requested', 'pending', 'verified', 'rejected')),
    expiry_date DATE,
    verification_notes TEXT DEFAULT '',
    request_note TEXT DEFAULT '',
    is_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Select Queries
SELECT * FROM employee_documents ORDER BY id DESC;
