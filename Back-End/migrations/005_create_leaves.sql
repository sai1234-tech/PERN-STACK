-- Migration: 005_create_leaves.sql
-- Create Leave Types and Leaves Tables in PostgreSQL

CREATE TABLE IF NOT EXISTS leave_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    annual_allocation NUMERIC(5, 2) NOT NULL DEFAULT 12,
    is_paid BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leaves (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id INTEGER NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    number_of_days NUMERIC(5, 2) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending Manager' CHECK (status IN ('Pending', 'Pending Manager', 'Pending HR', 'Approved', 'Rejected', 'Cancelled')),
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    manager_approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    manager_approved_at TIMESTAMP,
    manager_remarks TEXT DEFAULT '',
    hr_approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    hr_approved_at TIMESTAMP,
    hr_remarks TEXT DEFAULT '',
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    rejection_reason TEXT DEFAULT '',
    cancelled_at TIMESTAMP,
    cancelled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    document TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Leave Types
INSERT INTO leave_types (name, code, annual_allocation, is_paid, is_active, description)
VALUES 
    ('Casual Leave', 'CL', 12, true, true, 'Standard casual leave'),
    ('Sick Leave', 'SL', 12, true, true, 'Medical & sick leave'),
    ('Earned Leave', 'EL', 15, true, true, 'Privilege / earned leave'),
    ('Work From Home', 'WFH', 48, true, true, 'Remote work allowance'),
    ('Optional Holiday', 'OH', 3, true, true, 'Restricted or optional holiday')
ON CONFLICT DO NOTHING;

-- Select Queries
SELECT * FROM leave_types;
SELECT * FROM leaves ORDER BY id DESC;
