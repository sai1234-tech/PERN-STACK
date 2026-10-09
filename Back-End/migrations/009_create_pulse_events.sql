CREATE TABLE IF NOT EXISTS daily_pulses (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    department VARCHAR(100) DEFAULT 'General',
    date DATE NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
    feedback TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_pulse_employee_date UNIQUE (employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_pulses_date ON daily_pulses(date);

CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    title VARCHAR(255) NOT NULL,
    time VARCHAR(50) DEFAULT '',
    start_time VARCHAR(50) DEFAULT '10:00',
    end_time VARCHAR(50) DEFAULT '11:30',
    duration VARCHAR(50) DEFAULT '1 hr 30 mins',
    category VARCHAR(100) DEFAULT 'Meeting',
    tag VARCHAR(100) DEFAULT 'Custom Event',
    type VARCHAR(50) DEFAULT 'custom',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_employee_date ON events(employee_id, date);
