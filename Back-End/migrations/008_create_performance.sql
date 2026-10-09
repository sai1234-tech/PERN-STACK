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
