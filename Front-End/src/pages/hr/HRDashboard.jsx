import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import LeaveManagement from "../../components/hr/LeaveManagement";
import MonthlyAttendanceReport from "../../components/hr/MonthlyAttendanceReport";
import EmployeeEngagementAnalytics from "../../components/hr/EmployeeEngagementAnalytics";
import Loader from "../../components/common/Loader";
import {
  getAllAttendance,
  getAllLeaves,
  getEmployees,
} from "../../services/hrService";
import { formatDate, formatTime } from "../../utils/date";
import { useSyncRefresh } from "../../utils/syncManager";
import "./HRDashboard.css";

const avatarColors = [
  { bg: "#e0f2fe", text: "#0369a1", border: "#bae6fd" },
  { bg: "#ede9fe", text: "#6d28d9", border: "#ddd6fe" },
  { bg: "#dcfce7", text: "#15803d", border: "#bbf7d0" },
  { bg: "#fef3c7", text: "#b45309", border: "#fde68a" },
  { bg: "#ffe4e6", text: "#be123c", border: "#fecdd3" },
  { bg: "#ccfbf1", text: "#0f766e", border: "#99f6e4" },
  { bg: "#e0e7ff", text: "#4338ca", border: "#c7d2fe" },
];

function getColorForString(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(firstName = "", lastName = "", name = "") {
  if (firstName || lastName) {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "EM";
  }
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  return "EM";
}

function listFrom(response) {
  const value =
    response?.data || response?.records || response?.employees || [];
  return Array.isArray(value) ? value : [];
}

function HRDashboard() {
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("directory");

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [employeeResponse, attendanceResponse, leaveResponse] =
        await Promise.all([
          getEmployees(search),
          getAllAttendance(),
          getAllLeaves(),
        ]);
      setEmployees(listFrom(employeeResponse));
      setAttendance(listFrom(attendanceResponse));
      setLeaves(listFrom(leaveResponse));
    } catch (requestError) {
      if (!silent) setError(requestError.message);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useSyncRefresh(() => loadDashboard(true), { interval: 4000, silent: true });

  // Derived statistics
  const activeEmployees = useMemo(
    () =>
      employees.filter(
        (employee) => employee.employment?.status !== "Inactive"
      ),
    [employees]
  );

  const pendingLeaves = useMemo(
    () => leaves.filter((leave) => leave.status === "Pending"),
    [leaves]
  );

  const presentToday = useMemo(
    () =>
      attendance.filter((record) =>
        ["present", "late", "half-day", "completed"].includes(
          String(record.status || "").toLowerCase()
        )
      ).length,
    [attendance]
  );

  // Department analytics map
  const departmentAnalytics = useMemo(() => {
    const counts = {};
    employees.forEach(emp => {
      const dept = emp.employment?.department || "Unassigned";
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count, percentage: Math.round((count / Math.max(employees.length, 1)) * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [employees]);

  // Departments list for quick filtering
  const departmentsList = useMemo(() => {
    const set = new Set();
    employees.forEach((emp) => {
      if (emp.employment?.department) {
        set.add(emp.employment.department);
      }
    });
    return Array.from(set);
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesDept =
        deptFilter === "All" || emp.employment?.department === deptFilter;
      return matchesDept;
    });
  }, [employees, deptFilter]);

  if (loading) return <Loader label="Loading HR Command Center..." />;

  return (
    <>
      <EmployeeHeader />
      <main className="hr-dashboard-next">
        {/* Top Hero Command Banner */}
        <section className="hr-hero-banner">
          <div className="hr-hero-left">
            <div className="hero-kicker-pill">
              <span className="pulsing-live-dot" />
              <span>HR Command Hub</span>
            </div>
            <h1>Workforce Command Center</h1>
            <p>
              Real-time intelligence across headcount, daily attendance, leave approvals, and employee records.
            </p>
          </div>

          <div className="hr-hero-actions">
            <Link to="/employee/attendance" className="hero-action-btn primary" style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)", color: "#fff" }}>
              <span>⏱️</span> My Punch Clock (In/Out)
            </Link>
            <Link to="/hr/employees" className="hero-action-btn secondary">
              <span>+</span> Add Employee
            </Link>
            <Link to="/hr/departments" className="hero-action-btn secondary">
              <span>🏢</span> Departments
            </Link>
            <Link to="/hr/organization" className="hero-action-btn secondary">
              <span>🌳</span> Org Chart
            </Link>
            <Link to="/hr/helpdesk" className="hero-action-btn secondary">
              <span>🎧</span> Helpdesk
            </Link>
            <button
              type="button"
              className="hero-action-btn tertiary"
              onClick={() => {
                setRefreshing(true);
                loadDashboard();
              }}
              disabled={refreshing}
            >
              <span className={refreshing ? "spin-icon" : ""}>🔄</span>
              {refreshing ? "Updating..." : "Refresh"}
            </button>
          </div>
        </section>

        {/* Global Alert Notification */}
        {error && (
          <div className="hr-alert-box" role="alert">
            <div className="alert-content">
              <span className="alert-icon">⚠️</span>
              <span>{error}</span>
            </div>
            <button type="button" onClick={loadDashboard}>
              Try Again
            </button>
          </div>
        )}

        {/* Next-Level 4-Column KPI Grid */}
        <section className="hr-kpi-grid">
          {/* Card 1: Total Employees */}
          <div className="kpi-card teal">
            <div className="kpi-card-header">
              <span className="kpi-label">Total Workforce</span>
              <div className="kpi-icon-pill bg-teal">👥</div>
            </div>
            <div className="kpi-value-row">
              <strong className="kpi-number">{employees.length}</strong>
              <span className="kpi-badge positive">
                {activeEmployees.length} Active
              </span>
            </div>
            <div className="kpi-footer-progress">
              <div
                className="progress-fill teal"
                style={{
                  width: `${
                    employees.length
                      ? Math.round(
                          (activeEmployees.length / employees.length) * 100
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
            <small className="kpi-meta">
              {employees.length - activeEmployees.length} inactive accounts
            </small>
          </div>

          {/* Card 2: Attendance Activity */}
          <div className="kpi-card emerald">
            <div className="kpi-card-header">
              <span className="kpi-label">Present Today</span>
              <div className="kpi-icon-pill bg-emerald">⏱️</div>
            </div>
            <div className="kpi-value-row">
              <strong className="kpi-number">{presentToday}</strong>
              <span className="kpi-badge positive">Attended</span>
            </div>
            <div className="kpi-footer-progress">
              <div
                className="progress-fill emerald"
                style={{
                  width: `${
                    activeEmployees.length
                      ? Math.min(
                          100,
                          Math.round(
                            (presentToday / activeEmployees.length) * 100
                          )
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
            <small className="kpi-meta">
              {attendance.length} total attendance records logged
            </small>
          </div>

          {/* Card 3: Pending Leave Requests */}
          <div className="kpi-card amber">
            <div className="kpi-card-header">
              <span className="kpi-label">Pending Leave</span>
              <div className="kpi-icon-pill bg-amber">🏖️</div>
            </div>
            <div className="kpi-value-row">
              <strong className="kpi-number">{pendingLeaves.length}</strong>
              {pendingLeaves.length > 0 ? (
                <span className="kpi-badge warning">Action Needed</span>
              ) : (
                <span className="kpi-badge neutral">All Clear</span>
              )}
            </div>
            <div className="kpi-footer-progress">
              <div
                className="progress-fill amber"
                style={{
                  width: `${Math.min(100, pendingLeaves.length * 20)}%`,
                }}
              />
            </div>
            <small className="kpi-meta">
              {leaves.length} total leave applications on file
            </small>
          </div>

          {/* Card 4: Quick Shortcuts Hub */}
          <div className="kpi-card indigo">
            <div className="kpi-card-header">
              <span className="kpi-label">Operational Modules</span>
              <div className="kpi-icon-pill bg-indigo">⚡</div>
            </div>
            <div className="kpi-shortcuts-grid">
              <Link to="/hr/timesheets" className="shortcut-chip timesheets" title="Timesheets">
                <span>🕒</span> Timesheets
              </Link>
              <Link to="/hr/payroll" className="shortcut-chip payroll" title="Payroll">
                <span>💰</span> Payroll
              </Link>
              <Link to="/hr/documents" className="shortcut-chip documents" title="Documents">
                <span>📄</span> Documents
              </Link>
              <Link to="/hr/departments" className="shortcut-chip teams" title="Teams">
                <span>🏢</span> Teams
              </Link>
              <Link to="/hr/resignations" className="shortcut-chip resignations" title="Resignations">
                <span>👋</span> Resignations
              </Link>
              <Link to="/hr/helpdesk" className="shortcut-chip helpdesk" title="HR Helpdesk">
                <span>🎧</span> Helpdesk
              </Link>
            </div>
            <small className="kpi-meta">1-click executive module shortcuts</small>
          </div>
        </section>

        {/* =====================================================
            EMPLOYEE ENGAGEMENT & DAILY PULSE ANALYTICS
        ===================================================== */}
        <section style={{ marginTop: "24px" }}>
          <EmployeeEngagementAnalytics />
        </section>

        {/* Department Analytics Visualization Map */}
        <section className="hr-panel-card analytics-map-section" style={{ marginTop: '24px', padding: '24px', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          <div className="panel-card-header" style={{ marginBottom: '20px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#111827' }}>Department Distribution Map</h2>
              <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '0.875rem' }}>Workforce analytics and headcount allocation across organization units.</p>
            </div>
            <Link to="/hr/organization" className="manage-all-link" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4f46e5', fontWeight: '500', textDecoration: 'none' }}>
              <span>🌳</span> View Full Org Chart →
            </Link>
          </div>
          <div className="department-map-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {departmentAnalytics.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>No department data available.</div>
            ) : (
              departmentAnalytics.map((dept, index) => {
                const color = avatarColors[index % avatarColors.length];
                return (
                  <div key={dept.name} className="dept-map-row" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="dept-map-label" style={{ width: '150px', fontWeight: '500', color: '#374151', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {dept.name}
                    </div>
                    <div className="dept-map-track" style={{ flex: 1, height: '12px', background: '#f3f4f6', borderRadius: '6px', overflow: 'hidden' }}>
                      <div className="dept-map-fill" style={{ height: '100%', width: `${dept.percentage}%`, backgroundColor: color.text, borderRadius: '6px', transition: 'width 1s ease-in-out' }}></div>
                    </div>
                    <div className="dept-map-stats" style={{ width: '80px', textAlign: 'right', fontSize: '0.875rem' }}>
                      <strong style={{ color: '#111827' }}>{dept.count}</strong> <span style={{ color: '#6b7280' }}>emp</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Executive Segmented Navigation Tabs */}
        <section className="hr-nav-tabs-wrapper">
          <nav className="hr-segmented-nav" aria-label="Dashboard views">
            <button
              type="button"
              className={`nav-tab-btn ${
                activeTab === "directory" ? "active" : ""
              }`}
              onClick={() => setActiveTab("directory")}
            >
              <span className="tab-icon">👥</span>
              <span className="tab-label">Employee Directory</span>
              <span className="tab-count-pill">{employees.length}</span>
            </button>

            <button
              type="button"
              className={`nav-tab-btn ${activeTab === "leave" ? "active" : ""}`}
              onClick={() => setActiveTab("leave")}
            >
              <span className="tab-icon">🏖️</span>
              <span className="tab-label">Leave Management</span>
              {pendingLeaves.length > 0 && (
                <span className="tab-count-pill alert">
                  {pendingLeaves.length}
                </span>
              )}
            </button>

            <button
              type="button"
              className={`nav-tab-btn ${
                activeTab === "attendance" ? "active" : ""
              }`}
              onClick={() => setActiveTab("attendance")}
            >
              <span className="tab-icon">⏱️</span>
              <span className="tab-label">Recent Attendance</span>
              <span className="tab-count-pill">{attendance.length}</span>
            </button>

            <button
              type="button"
              className={`nav-tab-btn ${
                activeTab === "monthly" ? "active" : ""
              }`}
              onClick={() => setActiveTab("monthly")}
            >
              <span className="tab-icon">📊</span>
              <span className="tab-label">Monthly Report</span>
            </button>
          </nav>
        </section>

        {/* Tab 1: Employee Directory */}
        {activeTab === "directory" && (
          <section className="hr-panel-card">
            <div className="panel-card-header">
              <div>
                <h2>Employee Directory</h2>
                <p>
                  Quickly search, filter, and inspect employees across all company departments.
                </p>
              </div>

              <div className="panel-controls-row">
                <div className="search-box-wrap">
                  <svg
                    className="search-svg-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, code, department..."
                    aria-label="Search employees"
                  />
                  {search && (
                    <button
                      type="button"
                      className="search-clear-btn"
                      onClick={() => setSearch("")}
                    >
                      ×
                    </button>
                  )}
                </div>

                {departmentsList.length > 0 && (
                  <select
                    className="filter-select"
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                    aria-label="Filter by department"
                  >
                    <option value="All">All Departments</option>
                    {departmentsList.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                )}

                <Link to="/hr/employees" className="manage-all-link">
                  Manage Directory →
                </Link>
              </div>
            </div>

            <div className="table-responsive-box">
              <table className="hr-modern-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Code</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Status</th>
                    <th className="action-col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan="6">
                        <div className="table-empty-notice">
                          <span className="empty-icon">👥</span>
                          <strong>No employees found</strong>
                          <p>Try clearing your search query or department filter.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((employee, index) => {
                      const fullName =
                        `${employee.firstName || ""} ${
                          employee.lastName || ""
                        }`.trim() ||
                        employee.user?.name ||
                        "Employee";
                      const color = getColorForString(fullName);
                      const initials = getInitials(
                        employee.firstName,
                        employee.lastName,
                        employee.user?.name
                      );
                      const isEmpActive =
                        employee.employment?.status === "Active" ||
                        employee.user?.isActive;

                      return (
                        <tr key={employee._id || employee.id || index}>
                          <td>
                            <div className="employee-cell-meta">
                              <div
                                className="employee-avatar"
                                style={{
                                  backgroundColor: color.bg,
                                  color: color.text,
                                  borderColor: color.border,
                                }}
                              >
                                {initials}
                              </div>
                              <div className="employee-info-texts">
                                <strong className="employee-name">
                                  {fullName}
                                </strong>
                                <small className="employee-email">
                                  {employee.email || employee.user?.email}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="code-tag">
                              {employee.employeeCode || "-"}
                            </span>
                          </td>
                          <td>
                            <span className="dept-tag">
                              {employee.employment?.department || "General"}
                            </span>
                          </td>
                          <td>
                            <span className="designation-text">
                              {employee.employment?.designation || "-"}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`status-pill ${
                                isEmpActive ? "active" : "inactive"
                              }`}
                            >
                              <span className="pulse-dot" />
                              {employee.employment?.status ||
                                (isEmpActive ? "Active" : "Inactive")}
                            </span>
                          </td>
                          <td className="action-col">
                            <Link
                              to="/hr/employees"
                              className="view-profile-btn"
                            >
                              Edit Profile
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tab 2: Leave Management */}
        {activeTab === "leave" && (
          <div className="tab-pane-container">
            <LeaveManagement leaves={leaves} onChanged={loadDashboard} />
          </div>
        )}

        {/* Tab 3: Recent Attendance */}
        {activeTab === "attendance" && (
          <section className="hr-panel-card">
            <div className="panel-card-header">
              <div>
                <h2>Workforce Attendance Stream</h2>
                <p>Real-time clock-in and clock-out logs across all personnel.</p>
              </div>
              <Link to="/hr/timesheets" className="manage-all-link">
                View Full Timesheets →
              </Link>
            </div>

            <div className="table-responsive-box">
              <table className="hr-modern-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Date</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.length === 0 ? (
                    <tr>
                      <td colSpan="5">
                        <div className="table-empty-notice">
                          <span className="empty-icon">⏱️</span>
                          <strong>No attendance records available</strong>
                          <p>Attendance records will appear here as employees clock in.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    attendance.slice(0, 15).map((record, index) => {
                      const empName =
                        record.employee?.name ||
                        `${record.employee?.firstName || ""} ${
                          record.employee?.lastName || ""
                        }`.trim() ||
                        "Employee";
                      const color = getColorForString(empName);
                      const status = String(record.status || "").toLowerCase();

                      return (
                        <tr key={record._id || record.id || index}>
                          <td>
                            <div className="employee-cell-meta">
                              <div
                                className="employee-avatar"
                                style={{
                                  backgroundColor: color.bg,
                                  color: color.text,
                                }}
                              >
                                {getInitials("", "", empName)}
                              </div>
                              <strong className="employee-name">
                                {empName}
                              </strong>
                            </div>
                          </td>
                          <td>
                            <span className="date-chip">
                              📅 {formatDate(record.date)}
                            </span>
                          </td>
                          <td>
                            <span className="time-chip in">
                              {formatTime(record.checkIn)}
                            </span>
                          </td>
                          <td>
                            <span className="time-chip out">
                              {formatTime(record.checkOut)}
                            </span>
                          </td>
                          <td>
                            <span className={`status-pill ${status}`}>
                              <span className="pulse-dot" />
                              {record.status || "-"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tab 4: Monthly Attendance Report */}
        {activeTab === "monthly" && (
          <div className="tab-pane-container">
            <MonthlyAttendanceReport allEmployees={employees} />
          </div>
        )}
      </main>
    </>
  );
}

export default HRDashboard;
