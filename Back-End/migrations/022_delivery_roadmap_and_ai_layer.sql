-- 022: Phased delivery roadmap (Phases 0-4) and controlled AI layer

CREATE TABLE IF NOT EXISTS delivery_phases (
  id SERIAL PRIMARY KEY,
  phase_no INT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  scope TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_deliverables (
  id SERIAL PRIMARY KEY,
  deliverable_code TEXT UNIQUE NOT NULL,
  phase_no INT NOT NULL REFERENCES delivery_phases(phase_no),
  title TEXT NOT NULL,
  description TEXT,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('TABLE','FILE')),
  evidence_ref TEXT NOT NULL,          -- table name, or path relative to repo root
  min_rows INT NOT NULL DEFAULT 1,     -- TABLE evidence: rows needed to count as live
  ui_route TEXT,
  api_route TEXT,
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS delivery_phase_signoffs (
  id SERIAL PRIMARY KEY,
  phase_no INT NOT NULL REFERENCES delivery_phases(phase_no),
  decision TEXT NOT NULL CHECK (decision IN ('APPROVED','REJECTED')),
  signed_by_id TEXT,
  signed_by_name TEXT,
  signed_by_role TEXT,
  comments TEXT,
  signed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_policy_documents (
  id SERIAL PRIMARY KEY,
  policy_code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  version TEXT DEFAULT '1.0',
  effective_from DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT TRUE,
  audience TEXT[] DEFAULT ARRAY['all'],   -- 'all' or specific roles
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_guardrail_rules (
  id SERIAL PRIMARY KEY,
  rule_code TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  pattern TEXT NOT NULL,                  -- case-insensitive regex tested on the user query
  action TEXT NOT NULL CHECK (action IN ('BLOCK','ESCALATE')),
  exempt_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS ai_interaction_logs (
  id SERIAL PRIMARY KEY,
  feature TEXT NOT NULL,                  -- POLICY_ASSISTANT | SEARCH | ANALYTICS | WORKFLOW
  user_id TEXT,
  user_role TEXT,
  query TEXT,
  outcome TEXT NOT NULL,                  -- ANSWERED | NO_ANSWER | BLOCKED | ESCALATED | SERVED
  rule_code TEXT,
  sources TEXT[],
  confidence NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created ON ai_interaction_logs(created_at DESC);

-- ---------------------------------------------------------------- guardrails
INSERT INTO ai_guardrail_rules (rule_code, description, pattern, action, exempt_roles) VALUES
 ('G-CRED','Never discuss credentials, OTPs or tokens','\b(password|passcode|otp|secret key|api key|token)\b','BLOCK','{}'),
 ('G-IDENT','Statutory/bank identifiers are not available through AI','\b(aadhaar|aadhar|pan number|bank account|ifsc|uan)\b','BLOCK','{admin,super_admin,hr,payroll}'),
 ('G-PAY','Compensation of named individuals is not available through AI','(salary|ctc|compensation|pay ?slip|pay) (of|for) [a-z]+','BLOCK','{admin,super_admin,payroll}'),
 ('G-DECISION','Employment decisions need a human decision-maker','\b(terminate|dismiss|fire|sack|demote|blacklist)\b.*\b(him|her|them|employee|[a-z]+)\b','ESCALATE','{}')
ON CONFLICT (rule_code) DO NOTHING;

-- ---------------------------------------------------------------- policies
INSERT INTO ai_policy_documents (policy_code, title, category, content, version) VALUES
 ('POL-LEAVE','Leave Policy','Leave',
  $$Employees accrue leave as configured per leave type (casual, sick, earned). Leave must be applied in the HRMS before the leave start date, except sick leave which may be applied within 2 working days after returning. Requests go to the reporting manager first and then to HR for final approval. Unused casual leave does not carry forward; earned leave carries forward up to 30 days. Leave without pay is deducted in the monthly payroll input. Sandwich rule applies to weekends and holidays between two leave days of the same type.$$,'2.1'),
 ('POL-ATT','Attendance and Working Hours Policy','Attendance',
  $$Standard working hours are 9 hours including a 1 hour break, with a grace period of 15 minutes per the assigned shift. Employees must clock in and out daily in the HRMS. Three late marks in a month are treated as one half-day leave deduction. Missed punches must be regularised within 3 working days with manager approval. Overtime requires prior manager approval.$$,'1.4'),
 ('POL-WFH','Work From Home Policy','Attendance',
  $$Work from home is available up to 2 days per week with manager approval, subject to client and project requirements. Employees on client deployment follow the client onsite policy. Employees must remain reachable during working hours and use only company-approved, secured devices and VPN.$$,'1.2'),
 ('POL-PROB','Probation and Confirmation Policy','Lifecycle',
  $$New employees serve a probation of 6 months. Managers submit a confirmation recommendation 30 days before probation ends, and HR issues the confirmation letter after approval. Probation may be extended by up to 3 months with written reasons. Notice period during probation is 30 days.$$,'1.1'),
 ('POL-NOTICE','Resignation and Notice Period Policy','Exit',
  $$Confirmed employees serve a 60 day notice period; senior roles serve 90 days. Resignation is submitted in the HRMS and reviewed by the manager and HR. Notice buy-out requires HR and leadership approval. Exit clearance covers IT assets, access, finance, leave and attendance, and documents. Final settlement is processed after all clearances are complete. Access is removed on the last working day.$$,'2.0'),
 ('POL-EXP','Expense Reimbursement Policy','Finance',
  $$Business expenses are reimbursable with original bills submitted within 30 days of the expense. Travel and accommodation require prior manager approval. Reimbursements above the limit defined for the grade need finance approval. Reimbursements are paid with the next payroll cycle.$$,'1.3'),
 ('POL-POSH','Prevention of Sexual Harassment (POSH) Policy','Conduct',
  $$The company has zero tolerance for sexual harassment. Complaints can be made in writing to the Internal Committee, which acts confidentially and completes inquiry within 90 days as required by the POSH Act 2013. Retaliation against complainants is prohibited and treated as misconduct.$$,'1.0'),
 ('POL-COC','Code of Conduct','Conduct',
  $$Employees must act with integrity, protect confidential client and company information, avoid conflicts of interest, and use company assets responsibly. Gifts above a nominal value must be declared to HR. Violations are handled through the disciplinary process with a fair hearing.$$,'1.5'),
 ('POL-DPDP','Data Privacy and Protection Policy','Compliance',
  $$Personal data is processed only for lawful HR purposes in line with the Digital Personal Data Protection Act 2023. Access to compensation, bank and statutory data is restricted to authorised roles. Documents are accessed through logged, time-limited links. Employees may request access to or correction of their data through the helpdesk. Data is retained only for the period defined in the retention schedule.$$,'1.0'),
 ('POL-HELP','Helpdesk and SLA Policy','Support',
  $$HR helpdesk tickets are acknowledged within 4 working hours. Standard queries are resolved within 2 working days, payroll queries within 3 working days. Tickets breaching SLA are escalated automatically to the HR manager and then to the HR head.$$,'1.2'),
 ('POL-BGV','Background Verification Policy','Hiring',
  $$Background verification covers identity, education, employment history and criminal record, and is initiated after offer acceptance. Verification is completed within 7 working days and delays are escalated. Offers are conditional until verification is cleared; adverse findings are reviewed by HR before any decision.$$,'1.1'),
 ('POL-ASSET','IT Asset and Access Policy','IT',
  $$Laptops, email and system access are provisioned on joining through the IT asset workflow. Assets remain company property and must be returned at exit or on request. Loss or theft must be reported to IT within 24 hours. Access follows least privilege and is reviewed periodically.$$,'1.0')
ON CONFLICT (policy_code) DO NOTHING;
