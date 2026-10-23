import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import Loader from "../../components/common/Loader";
import { createManagedAccount, getAdminSummary } from "../../services/authService";
import { getAllEmployees } from "../../services/employeeService";
import { useSyncRefresh } from "../../utils/syncManager";
import { formatDate } from "../../utils/date";
import "./AccountManagement.css";

const initialForm = {
  role: "employee",
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  employeeCode: "",
  phone: "",
  department: "",
  designation: "",
  joiningDate: "",
  employmentType: "Full Time",
  salary: "",
};

export const ENTERPRISE_ROLE_OPTIONS = [
  {
    key: "super_admin",
    name: "Super Admin",
    icon: "👑",
    desc: "Configuration, masters, roles, workflows, audit",
    defaultDept: "Executive Leadership",
    defaultDesig: "Chief Executive Officer / Super Admin",
    badgeClass: "super-admin"
  },
  {
    key: "hr_admin",
    name: "HR Admin / Operations",
    icon: "💼",
    desc: "Employee lifecycle, onboarding, documents, leave, attendance, tickets",
    defaultDept: "Human Resources",
    defaultDesig: "HR Operations Lead",
    badgeClass: "hr-admin"
  },
  {
    key: "hr",
    name: "HR Manager",
    icon: "📋",
    desc: "Approvals, escalations, dashboards & workforce oversight",
    defaultDept: "Human Resources",
    defaultDesig: "Senior HR Manager",
    badgeClass: "hr"
  },
  {
    key: "recruiter",
    name: "Recruiter / TA",
    icon: "🎯",
    desc: "Requisitions, candidates, interviews, offers & preboarding",
    defaultDept: "Talent Acquisition",
    defaultDesig: "Lead Technical Recruiter",
    badgeClass: "recruiter"
  },
  {
    key: "manager",
    name: "Hiring / Team Manager",
    icon: "👥",
    desc: "Requisition, candidate feedback, leave, attendance, onboarding, performance",
    defaultDept: "Engineering",
    defaultDesig: "Engineering Delivery Manager",
    badgeClass: "manager"
  },
  {
    key: "payroll",
    name: "Payroll / Finance",
    icon: "💰",
    desc: "Restricted payroll and compensation data, salary runs & taxes",
    defaultDept: "Finance & Accounts",
    defaultDesig: "Payroll & Compensation Lead",
    badgeClass: "payroll"
  },
  {
    key: "it_admin",
    name: "IT / Admin",
    icon: "💻",
    desc: "Provisioning and assets with minimum necessary employee data",
    defaultDept: "IT & Infrastructure",
    defaultDesig: "IT Systems Administrator",
    badgeClass: "it-admin"
  },
  {
    key: "employee",
    name: "Standard Employee",
    icon: "👤",
    desc: "Self-service profile, leave, attendance, documents, tickets, performance",
    defaultDept: "Engineering",
    defaultDesig: "Software Engineer",
    badgeClass: "employee"
  },
  {
    key: "leadership",
    name: "Leadership Executive",
    icon: "🏢",
    desc: "Controlled strategic dashboards/reports & headcount analytics",
    defaultDept: "Executive Board",
    defaultDesig: "VP of Strategic Operations",
    badgeClass: "leadership"
  },
  {
    key: "auditor",
    name: "Statutory Auditor",
    icon: "🛡️",
    desc: "Read-only approved records and audit trails (compliance & logs)",
    defaultDept: "Compliance & Risk",
    defaultDesig: "Internal Compliance Auditor",
    badgeClass: "auditor"
  }
];

export const getRoleMeta = (rawRole = "", dept = "") => {
  const r = String(rawRole).toLowerCase().replace(/[-\s]+/g, "_");
  const found = ENTERPRISE_ROLE_OPTIONS.find((opt) => opt.key === r);
  if (found) return found;
  if (r.includes("super")) return ENTERPRISE_ROLE_OPTIONS[0];
  if (r.includes("recruiter") || r.includes("talent")) return ENTERPRISE_ROLE_OPTIONS[3];
  if (r.includes("payroll") || r.includes("finance")) return ENTERPRISE_ROLE_OPTIONS[5];
  if (r.includes("it")) return ENTERPRISE_ROLE_OPTIONS[6];
  if (r.includes("leader") || r.includes("exec")) return ENTERPRISE_ROLE_OPTIONS[8];
  if (r.includes("audit")) return ENTERPRISE_ROLE_OPTIONS[9];
  if (r.includes("manager") || r.includes("lead")) return ENTERPRISE_ROLE_OPTIONS[4];
  if (r.includes("hr") || dept.toLowerCase().includes("hr")) return ENTERPRISE_ROLE_OPTIONS[1];
  if (r.includes("admin")) return { key: "admin", name: "System Administrator", icon: "⚡", badgeClass: "admin" };
  return ENTERPRISE_ROLE_OPTIONS[7]; // Standard Employee
};

function AccountManagement() {
  const [activeTab, setActiveTab] = useState("directory"); // "directory" | "provision"
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [empRes, sumRes] = await Promise.all([
        getAllEmployees().catch(() => ({ data: [] })),
        getAdminSummary().catch(() => null),
      ]);

      const records = empRes.data || empRes.employees || [];
      setEmployees(Array.isArray(records) ? records : []);
      if (sumRes) {
        setSummary(sumRes.data || sumRes);
      }
    } catch (err) {
      console.error("Failed to load accounts:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useSyncRefresh(loadData, { interval: 4000, silent: true });

  const accountCounts = useMemo(() => {
    const roleOf = (employee) =>
      (employee.role || employee.user?.role || employee.user_role || "").toLowerCase();
    return {
      accounts: employees.length,
      hr: employees.filter((employee) => roleOf(employee) === "hr").length,
      employees: employees.filter((employee) => roleOf(employee) === "employee").length,
      admins: employees.filter((employee) => roleOf(employee) === "admin").length,
    };
  }, [employees]);

  const setField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError("");
    setNotice("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (
      !form.firstName.trim() ||
      !form.email.trim() ||
      !form.password ||
      !form.employeeCode.trim() ||
      !form.joiningDate
    ) {
      setError("First name, email, password, employee code, and joining date are required.");
      return;
    }

    try {
      setSaving(true);
      await createManagedAccount({
        ...form,
        firstName: form.firstName.trim(),
        name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        employeeCode: form.employeeCode.trim().toUpperCase(),
        department: form.department.trim(),
        designation: form.designation.trim(),
        phone: form.phone.trim(),
        salary: form.salary ? Number(form.salary) : 0,
      });

      const roleLabel = ENTERPRISE_ROLE_OPTIONS.find((r) => r.key === form.role)?.name || form.role;
      setNotice(
        `${roleLabel} account for ${form.firstName} (${form.email}) was provisioned successfully!`
      );
      setForm(initialForm);
      await loadData(true);
      setActiveTab("directory");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  // Filtered accounts
  const filteredAccounts = useMemo(() => {
    return employees.filter((emp) => {
      const q = search.toLowerCase().trim();
      const name = (emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`).toLowerCase();
      const email = (emp.email || "").toLowerCase();
      const code = (emp.employeeCode || "").toLowerCase();
      const dept = (emp.employment?.department || emp.department || "").toLowerCase();
      const desig = (emp.employment?.designation || emp.designation || "").toLowerCase();
      const role = (emp.role || emp.user?.role || emp.user_role || (dept.includes("hr") ? "hr" : "employee")).toLowerCase();
      const status = (emp.employment?.status || emp.status || "Active").toLowerCase();

      const matchesSearch =
        !q ||
        name.includes(q) ||
        email.includes(q) ||
        code.includes(q) ||
        dept.includes(q) ||
        desig.includes(q);

      const roleMeta = getRoleMeta(role, dept);
      const matchesRole =
        roleFilter === "all" ||
        roleFilter === role ||
        roleFilter === roleMeta.key ||
        (roleFilter === "admin" && (role === "admin" || role === "super_admin" || email.includes("admin"))) ||
        (roleFilter === "hr" && (role === "hr" || role === "hr_manager" || role === "hr_admin" || dept.includes("hr")));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && status === "active") ||
        (statusFilter === "inactive" && status !== "active");

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [employees, search, roleFilter, statusFilter]);

  return (
    <>
      <EmployeeHeader />

      <main className="account-management-hub">
        {/* =====================================================
            HERO COMMAND BANNER
        ===================================================== */}
        <header className="acct-hero-banner" aria-label="Account Management">
          <div className="acct-hero-left">
            <div className="hero-kicker-pill">
              <span className="pulsing-live-dot" />
              <span>Identity Governance & Security Access Control</span>
            </div>
            <h1>User Accounts & Access Control</h1>
            <p>
              Provision executive and operational credentials, manage role privileges (Admin, HR,
              Employee), and supervise active workforce access credentials.
            </p>

            <div className="emp-meta-pills">
              <span className="meta-pill-tag">👑 Role: Administrator</span>
              <span className="meta-pill-tag">🔒 bcrypt Hash Protected</span>
              <span className="meta-pill-tag">🛡️ Real-Time Governance</span>
            </div>
          </div>

          <div className="acct-hero-actions">
            <button
              type="button"
              className={`att-btn ${activeTab === "provision" ? "secondary" : "primary"}`}
              onClick={() => setActiveTab(activeTab === "provision" ? "directory" : "provision")}
            >
              {activeTab === "provision" ? "📋 View Accounts Directory" : "➕ Provision New Account"}
            </button>
          </div>
        </header>

        {/* =====================================================
            4 KPI STAT CARDS
        ===================================================== */}
        <section className="acct-kpi-grid" aria-label="Account KPIs">
          <div className="kpi-card-box emerald">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Total Accounts</span>
              <div className="kpi-icon-pod emerald">👥</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{summary?.accounts?.total ?? accountCounts.accounts}</span>
              <span className="kpi-badge-chip positive">Provisioned</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar emerald" style={{ width: "100%" }} />
            </div>
            <span className="kpi-subtext">Active credentials across enterprise</span>
          </div>

          <div className="kpi-card-box teal">
            <div className="kpi-card-head">
              <span className="kpi-title-text">HR Managers</span>
              <div className="kpi-icon-pod teal">💼</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{summary?.hr?.total ?? accountCounts.hr}</span>
              <span className="kpi-badge-chip neutral">Staff Ops</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar teal" style={{ width: "100%" }} />
            </div>
            <span className="kpi-subtext">People operations & payroll managers</span>
          </div>

          <div className="kpi-card-box indigo">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Employee Accounts</span>
              <div className="kpi-icon-pod indigo">👤</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{summary?.employees?.active ?? accountCounts.employees}</span>
              <span className="kpi-badge-chip indigo">Self-Service</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar indigo" style={{ width: "100%" }} />
            </div>
            <span className="kpi-subtext">Active workforce member accounts</span>
          </div>

          <div className="kpi-card-box rose">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Admin Accounts</span>
              <div className="kpi-icon-pod rose">👑</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{summary?.admins?.total ?? accountCounts.admins}</span>
              <span className="kpi-badge-chip positive">Full Authority</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar rose" style={{ width: "100%" }} />
            </div>
            <span className="kpi-subtext">Executive root governance</span>
          </div>
        </section>

        {/* =====================================================
            NOTICES & FEEDBACK
        ===================================================== */}
        {error && (
          <div className="acct-alert-box error" role="alert">
            ⚠️ {error}
          </div>
        )}

        {notice && (
          <div className="acct-alert-box success" role="status">
            ✓ {notice}
          </div>
        )}

        {/* =====================================================
            VIEW MODE TABS
        ===================================================== */}
        <nav className="acct-tab-pills" aria-label="Account Views">
          <button
            type="button"
            className={`acct-tab-btn ${activeTab === "directory" ? "active" : ""}`}
            onClick={() => setActiveTab("directory")}
          >
            👥 Provisioned Accounts Directory ({filteredAccounts.length})
          </button>
          <button
            type="button"
            className={`acct-tab-btn ${activeTab === "provision" ? "active" : ""}`}
            onClick={() => setActiveTab("provision")}
          >
            ➕ Provision New HR / Employee Account
          </button>
        </nav>

        {/* =====================================================
            TAB 1: PROVISIONED ACCOUNTS DIRECTORY
        ===================================================== */}
        {activeTab === "directory" && (
          <section className="acct-directory-panel">
            <div className="acct-toolbar-row">
              <div className="acct-search-box">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search accounts by name, email, employee ID, department..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button type="button" className="clear-search-btn" onClick={() => setSearch("")}>
                    ✕
                  </button>
                )}
              </div>

              <div className="acct-filter-cluster">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="acct-select"
                >
                  <option value="all">All Roles (10 Enterprise Roles)</option>
                  <option value="super_admin">👑 Super Admin</option>
                  <option value="admin">⚡ System Administrator</option>
                  <option value="hr_admin">💼 HR Admin / Operations</option>
                  <option value="hr">📋 HR Manager</option>
                  <option value="recruiter">🎯 Recruiter / TA</option>
                  <option value="manager">👥 Hiring / Team Manager</option>
                  <option value="payroll">💰 Payroll / Finance</option>
                  <option value="it_admin">💻 IT / Admin</option>
                  <option value="employee">👤 Standard Employee</option>
                  <option value="leadership">🏢 Leadership Executive</option>
                  <option value="auditor">🛡️ Statutory Auditor</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="acct-select"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Accounts</option>
                  <option value="inactive">Inactive Accounts</option>
                </select>
              </div>
            </div>

            {loading ? (
              <Loader label="Synchronizing user accounts..." />
            ) : filteredAccounts.length === 0 ? (
              <div className="acct-empty-state">
                <p>No user accounts matched your query.</p>
                <button
                  type="button"
                  className="att-btn primary"
                  onClick={() => {
                    setSearch("");
                    setRoleFilter("all");
                    setStatusFilter("all");
                  }}
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="acct-table-responsive">
                <table className="acct-data-table">
                  <thead>
                    <tr>
                      <th>User Account</th>
                      <th>Role Privilege</th>
                      <th>Employee ID</th>
                      <th>Department & Job Title</th>
                      <th>Status</th>
                      <th>Joined Date</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Always display Master Admin first */}
                    {roleFilter === "all" || roleFilter === "admin" ? (
                      <tr className="admin-row-highlight">
                        <td>
                          <div className="acct-user-cell">
                            <div className="acct-avatar admin">👑</div>
                            <div className="acct-user-meta">
                              <strong>System Administrator</strong>
                              <span>admin@hrms.com</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="role-badge admin">👑 Administrator</span>
                        </td>
                        <td>
                          <span className="code-pill">QSI-ROOT</span>
                        </td>
                        <td>
                          <strong>Executive Systems Command</strong>
                          <span className="dept-sub">HQ Architecture</span>
                        </td>
                        <td>
                          <span className="status-pill active">✓ Active</span>
                        </td>
                        <td>12 Mar 2022</td>
                        <td style={{ textAlign: "right" }}>
                          <span className="root-locked-tag">🔒 Master Account</span>
                        </td>
                      </tr>
                    ) : null}

                    {filteredAccounts.map((emp) => {
                      const name = emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "User";
                      const dept = emp.employment?.department || emp.department || "Engineering";
                      const desig = emp.employment?.designation || emp.designation || "Specialist";
                      const role = (emp.role || emp.user?.role || emp.user_role || "").toLowerCase();
                      const meta = getRoleMeta(role, dept);
                      const code = emp.employeeCode || `QSI-${emp._id?.slice(-4) || "001"}`;
                      const status = emp.employment?.status || emp.status || "Active";
                      const date = emp.employment?.joiningDate || emp.joiningDate || "2023-01-15";

                      return (
                        <tr key={emp._id || code}>
                          <td>
                            <div className="acct-user-cell">
                              <div className={`acct-avatar ${meta.badgeClass || "employee"}`}>
                                {meta.icon}
                              </div>
                              <div className="acct-user-meta">
                                <strong>{name}</strong>
                                <span>{emp.email || `${code.toLowerCase()}@quadraticsystems.com`}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`role-badge ${meta.badgeClass || "employee"}`}>
                              {meta.icon} {meta.name}
                            </span>
                          </td>
                          <td>
                            <span className="code-pill">{code}</span>
                          </td>
                          <td>
                            <strong>{desig}</strong>
                            <span className="dept-sub">{dept}</span>
                          </td>
                          <td>
                            <span className={`status-pill ${status.toLowerCase() === "active" ? "active" : "inactive"}`}>
                              {status.toLowerCase() === "active" ? "✓ Active" : "Inactive"}
                            </span>
                          </td>
                          <td>{formatDate(date)}</td>
                          <td style={{ textAlign: "right" }}>
                            <Link to="/hr/employees" className="action-link-btn" title="Inspect workforce record">
                              👁️ Manage
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* =====================================================
            TAB 2: PROVISION NEW ACCOUNT FORM
        ===================================================== */}
        {activeTab === "provision" && (
          <form className="acct-provision-card" onSubmit={handleSubmit}>
            <div className="acct-card-head">
              <div>
                <h2>➕ Provision HR or Employee Account</h2>
                <p>
                  Create login credentials and the linked employee employment profile from one secure form.
                </p>
              </div>
              <span className="admin-lock-badge">🔒 Admin Authorized Only</span>
            </div>

            {/* Role Selection */}
            <div className="acct-form-section">
              <label className="section-label">1. Select Account Role Privilege (10 Enterprise Roles) *</label>
              <div className="acct-role-radio-grid">
                {ENTERPRISE_ROLE_OPTIONS.map((opt) => (
                  <label
                    key={opt.key}
                    className={`role-option-card ${form.role === opt.key ? "selected" : ""}`}
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        role: opt.key,
                        department: !prev.department || prev.department === "Engineering" || prev.department === "Human Resources" ? opt.defaultDept : prev.department,
                        designation: !prev.designation || prev.designation === "Software Engineer" || prev.designation === "Senior HR Operations Manager" ? opt.defaultDesig : prev.designation,
                      }));
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={opt.key}
                      checked={form.role === opt.key}
                      onChange={() => {}}
                    />
                    <div className="role-option-content">
                      <span className="role-icon">{opt.icon}</span>
                      <div>
                        <strong>{opt.name}</strong>
                        <p>{opt.desc}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Personal Details */}
            <div className="acct-form-section">
              <label className="section-label">2. Identity & Contact Information</label>
              <div className="acct-inputs-grid">
                <div className="form-field-group">
                  <label>First Name *</label>
                  <input
                    name="firstName"
                    value={form.firstName}
                    onChange={setField}
                    placeholder="e.g. Aarav"
                    required
                  />
                </div>

                <div className="form-field-group">
                  <label>Last Name</label>
                  <input
                    name="lastName"
                    value={form.lastName}
                    onChange={setField}
                    placeholder="e.g. Sharma"
                  />
                </div>

                <div className="form-field-group">
                  <label>Official Email Address *</label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={setField}
                    placeholder="aarav.sharma@quadraticsystems.com"
                    required
                  />
                </div>

                <div className="form-field-group">
                  <label>Phone Number</label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={setField}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>
            </div>

            {/* Employment Details */}
            <div className="acct-form-section">
              <label className="section-label">3. Employment & Organization Parameters</label>
              <div className="acct-inputs-grid">
                <div className="form-field-group">
                  <label>Employee Code / ID *</label>
                  <input
                    name="employeeCode"
                    value={form.employeeCode}
                    onChange={setField}
                    placeholder={form.role === "hr" ? "HR-2024-001" : "EMP-2024-001"}
                    required
                  />
                </div>

                <div className="form-field-group">
                  <label>Date of Joining *</label>
                  <input
                    name="joiningDate"
                    type="date"
                    value={form.joiningDate}
                    onChange={setField}
                    required
                  />
                </div>

                <div className="form-field-group">
                  <label>Department</label>
                  <input
                    name="department"
                    value={form.department}
                    onChange={setField}
                    placeholder={form.role === "hr" ? "Human Resources" : "Engineering"}
                  />
                </div>

                <div className="form-field-group">
                  <label>Job Designation</label>
                  <input
                    name="designation"
                    value={form.designation}
                    onChange={setField}
                    placeholder={form.role === "hr" ? "Senior HR Operations Manager" : "Full-Stack Engineer"}
                  />
                </div>

                <div className="form-field-group">
                  <label>Employment Type</label>
                  <select
                    name="employmentType"
                    value={form.employmentType}
                    onChange={setField}
                  >
                    <option value="Full Time">Full Time Permanent</option>
                    <option value="Part Time">Part Time</option>
                    <option value="Contract">Contract / Consultant</option>
                    <option value="Intern">Internship</option>
                  </select>
                </div>

                <div className="form-field-group">
                  <label>Monthly Gross Salary (INR)</label>
                  <input
                    name="salary"
                    type="number"
                    min="0"
                    step="1000"
                    value={form.salary}
                    onChange={setField}
                    placeholder="85000"
                  />
                </div>
              </div>
            </div>

            {/* Password Credentials */}
            <div className="acct-form-section">
              <label className="section-label">4. Security Credentials</label>
              <div className="form-field-group full-width">
                <label>Temporary Password *</label>
                <input
                  name="password"
                  type="password"
                  minLength={6}
                  value={form.password}
                  onChange={setField}
                  placeholder="At least 6 characters"
                  required
                />
                <small className="field-hint">
                  🔒 Password is salted and hashed with bcrypt. Share this temporary password securely with the user.
                </small>
              </div>
            </div>

            {/* Form Actions */}
            <div className="acct-form-footer">
              <button
                type="button"
                className="att-btn secondary"
                onClick={() => setActiveTab("directory")}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="att-btn primary"
                disabled={saving}
              >
                {saving ? "Provisioning Account..." : `✓ Provision ${form.role === "hr" ? "HR Manager" : "Employee"} Account`}
              </button>
            </div>
          </form>
        )}
      </main>
    </>
  );
}

export default AccountManagement;
