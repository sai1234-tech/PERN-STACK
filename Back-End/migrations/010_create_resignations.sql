CREATE TABLE IF NOT EXISTS resignations (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    resignation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notice_period_days INTEGER NOT NULL DEFAULT 90,
    requested_last_working_day DATE NOT NULL,
    approved_last_working_day DATE,
    reason_category VARCHAR(50) NOT NULL,
    reason_details TEXT NOT NULL,
    status VARCHAR(30) DEFAULT 'pending',
    hr_review_comment TEXT DEFAULT '',
    manager_review_comment TEXT DEFAULT '',
    manager_reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    exit_interview_scheduled BOOLEAN DEFAULT FALSE,
    no_dues_cleared BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_resignations_employee_id ON resignations(employee_id);
CREATE INDEX IF NOT EXISTS idx_resignations_status ON resignations(status);
