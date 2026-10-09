-- Migration: 003_create_attendance.sql
-- Create Attendance Table in PostgreSQL

CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in TIMESTAMP,
    check_out TIMESTAMP,
    working_hours NUMERIC(5, 2) DEFAULT 0,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'half-day')),
    is_late BOOLEAN DEFAULT FALSE,
    late_minutes INTEGER DEFAULT 0,
    overtime_hours NUMERIC(5, 2) DEFAULT 0,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_employee_date UNIQUE (employee_id, date)
);

-- Select Queries
SELECT * FROM attendance ORDER BY date DESC, id DESC;
