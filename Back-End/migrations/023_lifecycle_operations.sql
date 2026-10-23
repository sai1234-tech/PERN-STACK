-- 023: additive tables for lifecycle operations (does not alter existing tables)

CREATE TABLE IF NOT EXISTS preboarding_tasks (
  id SERIAL PRIMARY KEY,
  task_code TEXT UNIQUE NOT NULL,
  candidate_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Completed','Waived')),
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_preboarding_candidate ON preboarding_tasks(candidate_id);

CREATE TABLE IF NOT EXISTS attendance_regularizations (
  id SERIAL PRIMARY KEY,
  reg_code TEXT UNIQUE NOT NULL,
  employee_id INT NOT NULL,
  attendance_date DATE NOT NULL,
  requested_check_in TIMESTAMP,
  requested_check_out TIMESTAMP,
  requested_status TEXT NOT NULL DEFAULT 'present' CHECK (requested_status IN ('present','half-day')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  requested_by_user_id INT,
  decided_by_user_id INT,
  decided_by_name TEXT,
  decided_by_role TEXT,
  decision_comments TEXT,
  decided_at TIMESTAMPTZ,
  before_snapshot JSONB,
  after_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- only one open request per employee per day
CREATE UNIQUE INDEX IF NOT EXISTS uq_regularization_open
  ON attendance_regularizations(employee_id, attendance_date) WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS exit_documents (
  id SERIAL PRIMARY KEY,
  doc_code TEXT UNIQUE NOT NULL,
  employee_id INT NOT NULL,
  clearance_id INT NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('RELIEVING_LETTER','EXPERIENCE_CERTIFICATE','FNF_STATEMENT')),
  file_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  issued_by_user_id INT,
  issued_by_name TEXT,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (clearance_id, doc_type)
);
