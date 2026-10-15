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
import { formatPhotoUrl } from "../../utils/photo";
import { useSyncRefresh } from "../../utils/syncManager";
import { useAttendance } from "../../hooks/useAttendance";
import { useAuth } from "../../context/AuthContext";
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
  if (!response) return [];
  if (Array.isArray(response)) return response;
  const value =
    response?.data || response?.records || response?.employees || response?.leaves || response?.attendance || [];
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
          getEmployees(),
          getAllAttendance(),
          getAllLeaves(),
        ]);
      setEmployees(listFrom(employeeResponse));
      setAttendance(listFrom(attendanceResponse));
      setLeaves(listFrom(leaveResponse));
    } catch (requestError) {
      if (!silent) setError(requestError.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const { user } = useAuth();

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useSyncRefresh(() => loadDashboard(true), { interval: 2500, silent: true });

  // Cross-tab and window realtime data sync
  useEffect(() => {
    const handleSync = () => {
      loadDashboard(true);
    };
    window.addEventListener("hrms_data_updated", handleSync);
    window.addEventListener("storage", handleSync);
    window.addEventListener("focus", handleSync);
    return () => {
      window.removeEventListener("hrms_data_updated", handleSync);
      window.removeEventListener("storage", handleSync);
      window.removeEventListener("focus", handleSync);
    };
  }, [loadDashboard]);

  // Derived statistics
  const activeEmployees = useMemo(
    () =>
      employees.filter(
        (employee) => employee?.employment?.status !== "Inactive"
      ),
    [employees]
  );

  const pendingLeaves = useMemo(
    () => leaves.filter((leave) => String(leave?.status || "").toLowerCase().includes("pending")),
    [leaves]
  );

  const { todayAttendance, clockIn, clockOut } = useAttendance();
  const [clockActionSubmitting, setClockActionSubmitting] = useState(false);
  const checkedIn = Boolean(todayAttendance?.checkIn) && !todayAttendance?.checkOut;

  const handleClockInAction = async () => {
    setClockActionSubmitting(true);
    try {
      await clockIn();
      await loadDashboard(true);
    } finally {
      setClockActionSubmitting(false);
    }
  };

  const handleClockOutAction = async () => {
    setClockActionSubmitting(true);
    try {
      await clockOut();
      await loadDashboard(true);
    } finally {
      setClockActionSubmitting(false);
    }
  };

  const presentToday = useMemo(() => {
    const todayLocal = new Date().toLocaleDateString("en-CA"); // "YYYY-MM-DD" local
    const todayUTC = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" UTC
    const presentEmpKeys = new Set();

    attendance.forEach((record) => {
      if (!record) return;
      const recDate = record.date ? String(record.date).slice(0, 10) : "";
      const checkInDate = record.checkIn ? String(record.checkIn).slice(0, 10) : "";
      const isTodayRec =
        recDate === todayLocal ||
        recDate === todayUTC ||
        checkInDate === todayLocal ||
        checkInDate === todayUTC;

      const isPresentStatus =
        ["present", "late", "half-day", "completed"].includes(
          String(record.status || "").toLowerCase()
        ) || Boolean(record.checkIn);

      if (isTodayRec && isPresentStatus) {
        const empKey =
          record.employee?.id ||
          record.employee?.employeeCode ||
          record.employee?.email ||
          record.employee_id ||
          record.user_id ||
          record.id;
        if (empKey) {
          presentEmpKeys.add(String(empKey));
        }
      }
    });

    if (checkedIn && user) {
      const currentEmpKey = user.id || user.employeeId || user.email;
      if (currentEmpKey) {
        presentEmpKeys.add(String(currentEmpKey));
      }
    }

    return presentEmpKeys.size;
  }, [attendance, checkedIn, user]);

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
    const q = search.trim().toLowerCase();
    return employees.filter((emp) => {
      const matchesDept =
        deptFilter === "All" || emp.employment?.department === deptFilter;
      if (!matchesDept) return false;
      if (!q) return true;
      const fullName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim().toLowerCase();
      const code = String(emp.employeeCode || "").toLowerCase();
      const email = String(emp.email || emp.user?.email || "").toLowerCase();
      const dept = String(emp.employment?.department || "").toLowerCase();
      const desig = String(emp.employment?.designation || "").toLowerCase();
      return (
        fullName.includes(q) ||
        code.includes(q) ||
        email.includes(q) ||
        dept.includes(q) ||
        desig.includes(q)
      );
    });
  }, [employees, deptFilter, search]);

  if (loading) return <Loader label="Loading HR Command Center..." />;

  return (
    <>
      <EmployeeHeader />
      <main className="hr-dashboard-next">
        {/* Top Hero Command Banner */}
        <section className="hr-hero-banner" aria-label="HR Command Center Banner">
          <div className="hr-hero-top-row">
            <div className="hr-hero-left">
              <div className="hero-kicker-pill">
                <span className="pulsing-live-dot" />
                <span>HR Command Hub</span>
                <span className="hero-kicker-divider">•</span>
                <span className="hero-live-text">Live Workspace</span>
              </div>
              <h1 className="hr-hero-title">Workforce Command Center</h1>
              <p className="hr-hero-subtitle">
                Real-time intelligence across headcount, daily attendance, leave approvals, and employee records.
              </p>
            </div>

            <div className="hr-hero-status-pill">
              <div className="status-indicator-badge">
                <span className={`status-beacon ${checkedIn ? "beacon-active" : "beacon-idle"}`} />
                <span className="status-beacon-label">
                  {checkedIn ? "Shift Active" : "Shift Inactive"}
                </span>
              </div>
              <button
                type="button"
                className="hero-refresh-btn"
                onClick={() => {
                  setRefreshing(true);
                  loadDashboard();
                }}
                disabled={refreshing}
                title="Refresh HR Analytics & Attendance"
              >
                <span className={refreshing ? "spin-icon" : ""}>🔄</span>
                <span>{refreshing ? "Updating..." : "Refresh"}</span>
              </button>
            </div>
          </div>

          {/* Prominent High-Visibility Action Toolbar */}
          <div className="hr-hero-actions-bar" aria-label="Quick Navigation and Punch Actions">
            {checkedIn ? (
              <button
                type="button"
                className="cmd-action-btn cmd-clock-out"
                onClick={handleClockOutAction}
                disabled={clockActionSubmitting}
                title="Clock Out from shift"
              >
                <span className="cmd-btn-icon">⏹️</span>
                <span className="cmd-btn-text">
                  Clock Out ({todayAttendance.checkIn ? formatTime(todayAttendance.checkIn) : "Active"})
                </span>
              </button>
            ) : (
              <button
                type="button"
                className="cmd-action-btn cmd-clock-in"
                onClick={handleClockInAction}
                disabled={clockActionSubmitting}
                title="Clock In to start shift"
              >
                <span className="cmd-btn-icon">🕒</span>
                <span className="cmd-btn-text">Clock In Now</span>
              </button>
            )}

            <Link to="/employee/attendance" className="cmd-action-btn cmd-attendance" title="View Daily Attendance Log">
              <span className="cmd-btn-icon">⏱️</span>
              <span className="cmd-btn-text">Attendance Log</span>
            </Link>

            <Link to="/hr/employees" className="cmd-action-btn cmd-add-emp" title="Add & Manage Employees">
              <span className="cmd-btn-icon">➕</span>
              <span className="cmd-btn-text">Add Employee</span>
            </Link>

            <Link to="/hr/departments" className="cmd-action-btn cmd-depts" title="Manage Departments & Pods">
              <span className="cmd-btn-icon">🏢</span>
              <span className="cmd-btn-text">Departments</span>
            </Link>

            <Link to="/hr/organization" className="cmd-action-btn cmd-org" title="Enterprise Org Hierarchy">
              <span className="cmd-btn-icon">🌳</span>
              <span className="cmd-btn-text">Org Chart</span>
            </Link>

            <Link to="/hr/helpdesk" className="cmd-action-btn cmd-helpdesk" title="HR Support & Tickets">
              <span className="cmd-btn-icon">🎧</span>
              <span className="cmd-btn-text">Helpdesk</span>
            </Link>
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
          <div className="kpi-card indigo kpi-shortcuts-card">
            <div className="kpi-card-header">
              <span className="kpi-label">Operational Modules</span>
              <div className="kpi-icon-pill bg-indigo">⚡</div>
            </div>
            <div className="kpi-shortcuts-grid">
              <Link to="/hr/timesheets" className="shortcut-chip timesheets" title="Timesheets Approvals">
                <span className="chip-icon">🕒</span>
                <span className="chip-name">Timesheets</span>
              </Link>
              <Link to="/hr/payroll" className="shortcut-chip payroll" title="Payroll Run">
                <span className="chip-icon">💰</span>
                <span className="chip-name">Payroll</span>
              </Link>
              <Link to="/hr/documents" className="shortcut-chip documents" title="Company Documents">
                <span className="chip-icon">📄</span>
                <span className="chip-name">Documents</span>
              </Link>
              <Link to="/hr/departments" className="shortcut-chip teams" title="Departments & Teams">
                <span className="chip-icon">🏢</span>
                <span className="chip-name">Teams</span>
              </Link>
              <Link to="/hr/resignations" className="shortcut-chip resignations" title="Resignation Approvals">
                <span className="chip-icon">👋</span>
                <span className="chip-name">Resignations</span>
              </Link>
              <Link to="/hr/helpdesk" className="shortcut-chip helpdesk" title="HR Helpdesk">
                <span className="chip-icon">🎧</span>
                <span className="chip-name">Helpdesk</span>
              </Link>
            </div>
            <small className="kpi-meta">1-click executive module shortcuts</small>
          </div>
        </section>

        {/* =====================================================
            EMPLOYEE ENGAGEMENT & DAILY PULSE ANALYTICS
        ===================================================== */}
        <section className="hr-pulse-section">
          <EmployeeEngagementAnalytics />
        </section>

        {/* Department Analytics Visualization Map */}
        <section className="analytics-map-section">
          <div className="analytics-map-header">
            <div>
              <h2>Department Distribution Map</h2>
              <p>Workforce analytics and headcount allocation across organization units.</p>
            </div>
            <Link to="/hr/organization" className="analytics-map-link">
              <span>🌳</span> View Full Org Chart →
            </Link>
          </div>
          <div className="department-map-container">
            {departmentAnalytics.length === 0 ? (
              <div className="analytics-empty-notice">No department data available.</div>
            ) : (
              departmentAnalytics.map((dept, index) => {
                const color = avatarColors[index % avatarColors.length];
                return (
                  <div key={dept.name} className="dept-map-row">
                    <div className="dept-map-label" title={dept.name}>
                      {dept.name}
                    </div>
                    <div className="dept-map-track">
                      <div
                        className="dept-map-fill"
                        style={{
                          width: `${dept.percentage}%`,
                          backgroundColor: color.text || "#4f46e5",
                        }}
                      />
                    </div>
                    <div className="dept-map-stats">
                      <strong>{dept.count}</strong> <span>emp</span>
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
                              {employee.profilePhoto ? (
                                <img
                                  src={formatPhotoUrl(employee.profilePhoto)}
                                  alt={fullName}
                                  className="employee-avatar employee-avatar-img"
                                />
                              ) : (
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
                              )}
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
                      const matchedEmp = employees.find(
                        (e) =>
                          String(e.id || e._id || e.user?.id) ===
                          String(record.employee?.id || record.employee?._id || record.employeeId || record.employee)
                      );
                      const empName =
                        record.employee?.name ||
                        (matchedEmp
                          ? `${matchedEmp.firstName || ""} ${matchedEmp.lastName || ""}`.trim() || matchedEmp.user?.name
                          : "") ||
                        `${record.employee?.firstName || ""} ${record.employee?.lastName || ""}`.trim() ||
                        "Employee";
                      const empCode = record.employee?.employeeCode || matchedEmp?.employeeCode || "";
                      const empPhoto = record.employee?.profilePhoto || matchedEmp?.profilePhoto || "";
                      const color = getColorForString(empName);
                      const status = String(record.status || "").toLowerCase();

                      return (
                        <tr key={record._id || record.id || index}>
                          <td>
                            <div className="employee-cell-meta">
                              {empPhoto ? (
                                <img
                                  src={formatPhotoUrl(empPhoto)}
                                  alt={empName}
                                  className="employee-avatar employee-avatar-img"
                                />
                              ) : (
                                <div
                                  className="employee-avatar"
                                  style={{
                                    backgroundColor: color.bg,
                                    color: color.text,
                                  }}
                                >
                                  {getInitials("", "", empName)}
                                </div>
                              )}
                              <div className="employee-info-texts">
                                <strong className="employee-name">
                                  {empName}
                                </strong>
                                {empCode && (
                                  <small className="employee-email">
                                    {empCode}
                                  </small>
                                )}
                              </div>
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
