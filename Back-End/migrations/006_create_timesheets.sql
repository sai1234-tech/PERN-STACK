CREATE TABLE IF NOT EXISTS timesheets (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    project VARCHAR(255) DEFAULT '',
    client VARCHAR(255) DEFAULT '',
    cost_center VARCHAR(255) DEFAULT '',
    task VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    break_minutes INTEGER DEFAULT 0,
    entry_mode VARCHAR(20) DEFAULT 'manual',
    billable BOOLEAN DEFAULT TRUE,
    hours NUMERIC(5, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    submitted_at TIMESTAMP,
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    review_comment TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_timesheets_employee_date ON timesheets(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_timesheets_status_date ON timesheets(status, date);
