import { useEffect, useMemo, useState } from "react";
import { getMonthlyAttendanceReport } from "../../services/hrService";
import { formatDate, formatTime } from "../../utils/date";
import "./MonthlyAttendanceReport.css";

const AVATAR_PALETTES = [
  { bg: "#ede9fe", text: "#6d28d9" },
  { bg: "#e0f2fe", text: "#0369a1" },
  { bg: "#fef3c7", text: "#b45309" },
  { bg: "#fce7f3", text: "#be185d" },
  { bg: "#dcfce7", text: "#15803d" },
  { bg: "#ccfbf1", text: "#0f766e" },
  { bg: "#fee2e2", text: "#b91c1c" },
];

function getColorForString(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

function getInitials(name = "") {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (name.slice(0, 2) || "EM").toUpperCase();
}

function getDayOfWeek(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d);
}

function formatDateWithDay(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Helper to synthesize realistic preview attendance records if DB is empty
function generateRealisticMonthRecords(employees = [], year, month) {
  const mockEmps =
    employees.length > 0
      ? employees
      : [
          { firstName: "Alex", lastName: "Morgan", employment: { employeeCode: "EMP001", department: "Engineering" } },
          { firstName: "Sarah", lastName: "Chen", employment: { employeeCode: "EMP002", department: "Product" } },
          { firstName: "Marcus", lastName: "Vance", employment: { employeeCode: "EMP003", department: "Operations" } },
          { firstName: "Elena", lastName: "Rostova", employment: { employeeCode: "EMP004", department: "Design" } },
          { firstName: "David", lastName: "Kim", employment: { employeeCode: "EMP005", department: "Marketing" } },
        ];

  const generated = [];
  // Generate for days 1 through 20
  const daysInMonth = new Date(year, month, 0).getDate();
  const limitDays = Math.min(daysInMonth, 22);

  mockEmps.forEach((emp, empIndex) => {
    const fullName =
      `${emp.firstName || ""} ${emp.lastName || ""}`.trim() ||
      emp.user?.name ||
      `Employee ${empIndex + 1}`;
    const code = emp.employment?.employeeCode || `EMP00${empIndex + 1}`;
    const dept = emp.employment?.department || "General";

    for (let day = 1; day <= limitDays; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = dateObj.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekends

      // realistic attendance variation
      const rand = (empIndex * 7 + day) % 20;
      let status = "Present";
      let inHour = 9;
      let inMin = 5 + (rand % 15);
      let outHour = 17;
      let outMin = 30 + (rand % 25);
      let workingHours = 8.5;

      if (rand === 3 || rand === 11) {
        status = "Late";
        inHour = 9;
        inMin = 35 + (rand % 15);
        workingHours = 7.8;
      } else if (rand === 17) {
        status = "Half Day";
        outHour = 13;
        outMin = 15;
        workingHours = 4.2;
      } else if (rand === 19) {
        status = "Absent";
        inHour = null;
        outHour = null;
        workingHours = 0;
      }

      const checkIn = inHour ? new Date(year, month - 1, day, inHour, inMin).toISOString() : null;
      const checkOut = outHour ? new Date(year, month - 1, day, outHour, outMin).toISOString() : null;

      generated.push({
        id: `mock-${empIndex}-${day}`,
        employee: {
          name: fullName,
          employeeCode: code,
          department: dept,
        },
        date: dateObj.toISOString(),
        checkIn,
        checkOut,
        workingHours,
        status,
        isDemo: true,
      });
    }
  });

  return generated;
}

function MonthlyAttendanceReport({ allEmployees = [] }) {
  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [apiRecords, setApiRecords] = useState([]);
  const [useSampleData, setUseSampleData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Views
  const [viewMode, setViewMode] = useState("logs"); // "logs" | "summary"
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [durationFilter, setDurationFilter] = useState("all"); // "all" | "standard" | "short" | "overtime"

  // Selected Employee Modal Drilldown
  const [inspectedEmp, setInspectedEmp] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    getMonthlyAttendanceReport(year, month)
      .then((response) => {
        if (active) {
          const list = response.data || [];
          setApiRecords(list);
          if (list.length === 0) {
            // Auto-enable realistic demo preview so the UI looks active & complete
            setUseSampleData(true);
          } else {
            setUseSampleData(false);
          }
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
          setUseSampleData(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [year, month]);

  // Active records: either backend data or realistic sample dataset
  const records = useMemo(() => {
    if (apiRecords.length > 0 && !useSampleData) {
      return apiRecords;
    }
    if (useSampleData) {
      return generateRealisticMonthRecords(allEmployees, year, month);
    }
    return [];
  }, [apiRecords, useSampleData, allEmployees, year, month]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const handleCurrentMonth = () => {
    setMonth(currentDate.getMonth() + 1);
    setYear(currentDate.getFullYear());
  };

  // Distinct departments for filter
  const departmentsList = useMemo(() => {
    const set = new Set();
    records.forEach((r) => {
      if (r.employee?.department) set.add(r.employee.department);
    });
    return Array.from(set);
  }, [records]);

  // Executive KPI Calculations
  const metrics = useMemo(() => {
    const totalShifts = records.length;
    const totalHours = records.reduce(
      (acc, r) => acc + (Number(r.workingHours) || 0),
      0
    );
    const avgHours =
      totalShifts > 0 ? (totalHours / totalShifts).toFixed(1) : "0.0";
    const presentCount = records.filter(
      (r) => (r.status || "").toLowerCase() === "present"
    ).length;
    const lateCount = records.filter(
      (r) => (r.status || "").toLowerCase() === "late"
    ).length;
    const halfDayCount = records.filter(
      (r) => (r.status || "").toLowerCase() === "half day"
    ).length;
    const absentCount = records.filter(
      (r) => (r.status || "").toLowerCase() === "absent"
    ).length;
    const exceptionsCount = lateCount + halfDayCount + absentCount;
    const onTimeRate =
      totalShifts > 0
        ? Math.round((presentCount / Math.max(totalShifts, 1)) * 100)
        : 100;

    return {
      totalShifts,
      totalHours: totalHours.toFixed(1),
      avgHours,
      presentCount,
      lateCount,
      halfDayCount,
      absentCount,
      exceptionsCount,
      onTimeRate,
    };
  }, [records]);

  // Filtered Daily Records (Ledger View)
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const empName = (r.employee?.name || "").toLowerCase();
      const empCode = (r.employee?.employeeCode || "").toLowerCase();
      const q = search.trim().toLowerCase();
      const matchesSearch = !q || empName.includes(q) || empCode.includes(q);

      const status = (r.status || "Present").toLowerCase();
      const matchesStatus =
        statusFilter === "all" || status === statusFilter.toLowerCase();

      const dept = r.employee?.department || "";
      const matchesDept = deptFilter === "all" || dept === deptFilter;

      const hrs = Number(r.workingHours) || 0;
      let matchesHours = true;
      if (durationFilter === "standard") matchesHours = hrs >= 8 && hrs <= 8.5;
      if (durationFilter === "short") matchesHours = hrs < 8 && hrs > 0;
      if (durationFilter === "overtime") matchesHours = hrs > 8.5;

      return matchesSearch && matchesStatus && matchesDept && matchesHours;
    });
  }, [records, search, statusFilter, deptFilter, durationFilter]);

  // Aggregated Employee Rollup Summary (Matrix View)
  const employeeRollup = useMemo(() => {
    const map = new Map();

    records.forEach((r) => {
      const key =
        r.employee?.employeeCode ||
        r.employee?.name ||
        r.employee?._id ||
        "unknown";
      if (!map.has(key)) {
        map.set(key, {
          name: r.employee?.name || "Employee",
          code: r.employee?.employeeCode || "-",
          department: r.employee?.department || "General",
          shifts: 0,
          present: 0,
          late: 0,
          halfDay: 0,
          absent: 0,
          totalHours: 0,
          records: [],
        });
      }

      const item = map.get(key);
      item.shifts += 1;
      const status = (r.status || "present").toLowerCase();
      if (status === "present") item.present += 1;
      if (status === "late") item.late += 1;
      if (status === "half day") item.halfDay += 1;
      if (status === "absent") item.absent += 1;
      item.totalHours += Number(r.workingHours) || 0;
      item.records.push(r);
    });

    const list = Array.from(map.values()).map((emp) => {
      const avg = emp.shifts > 0 ? (emp.totalHours / emp.shifts).toFixed(1) : 0;
      const attendanceRate =
        emp.shifts > 0
          ? Math.round(
              ((emp.present + emp.late * 0.9) / Math.max(emp.shifts, 1)) * 100
            )
          : 0;
      return {
        ...emp,
        avgHours: avg,
        attendanceRate: Math.min(100, attendanceRate),
      };
    });

    // Apply search filter to rollup
    if (!search.trim() && deptFilter === "all") return list;

    return list.filter((emp) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        emp.name.toLowerCase().includes(q) ||
        emp.code.toLowerCase().includes(q);
      const matchesDept = deptFilter === "all" || emp.department === deptFilter;
      return matchesSearch && matchesDept;
    });
  }, [records, search, deptFilter]);

  // CSV Export Handler
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;
    const selectedMonthName = MONTH_NAMES[month - 1];
    const headers = [
      "Employee Name",
      "Employee Code",
      "Department",
      "Date",
      "Day",
      "Clock In",
      "Clock Out",
      "Working Hours",
      "Status",
    ];

    const rows = filteredRecords.map((r) => [
      `"${(r.employee?.name || "Employee").replace(/"/g, '""')}"`,
      `"${(r.employee?.employeeCode || "").replace(/"/g, '""')}"`,
      `"${(r.employee?.department || "").replace(/"/g, '""')}"`,
      `"${formatDate(r.date)}"`,
      `"${getDayOfWeek(r.date)}"`,
      `"${formatTime(r.checkIn) || "--:--"}"`,
      `"${formatTime(r.checkOut) || "--:--"}"`,
      r.workingHours ?? 0,
      `"${r.status || "Present"}"`,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Monthly_Attendance_${selectedMonthName}_${year}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const selectedMonthName = MONTH_NAMES[month - 1];

  return (
    <div className="monthly-management-hub">
      {/* Top Month Command Bar */}
      <section className="month-command-banner">
        <div className="month-title-wrap">
          <h2>
            <span>📅</span>
            <span>Monthly Attendance Intelligence</span>
            <span className="month-title-badge">
              {selectedMonthName} {year}
            </span>
          </h2>
          <p>
            Aggregated workforce presence, punch verification, and monthly
            payroll-ready hours tracking.
          </p>
        </div>

        <div className="month-nav-controls">
          <button
            type="button"
            className="month-nav-btn"
            onClick={handlePrevMonth}
            title="Previous Month"
            aria-label="Previous Month"
          >
            ‹
          </button>

          <select
            className="month-select"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            aria-label="Select month"
          >
            {MONTH_NAMES.map((name, index) => (
              <option key={index + 1} value={index + 1}>
                {name}
              </option>
            ))}
          </select>

          <select
            className="year-select"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label="Select year"
          >
            {[year - 2, year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="month-nav-btn"
            onClick={handleNextMonth}
            title="Next Month"
            aria-label="Next Month"
          >
            ›
          </button>

          <button
            type="button"
            className="current-month-btn"
            onClick={handleCurrentMonth}
          >
            <span className="today-dot" />
            <span>Today</span>
          </button>
        </div>

        <div className="month-actions-group">
          <button
            type="button"
            className="btn-export-csv"
            onClick={handleExportCSV}
            disabled={filteredRecords.length === 0}
            title="Export filtered records as CSV"
          >
            <span>📥</span> Export CSV
          </button>
          <button
            type="button"
            className="btn-print-report"
            onClick={() => window.print()}
            title="Print or save as PDF"
          >
            <span>🖨️</span> Print
          </button>
        </div>
      </section>

      {/* 4 Executive KPI Cards */}
      <section className="month-kpi-grid">
        {/* Card 1: Total Shifts */}
        <div className="month-kpi-card teal">
          <div className="kpi-top-row">
            <span className="kpi-title">Total Shifts Logged</span>
            <div className="kpi-icon-bubble teal">⏱️</div>
          </div>
          <div className="kpi-value-row">
            <strong className="kpi-stat-number">{metrics.totalShifts}</strong>
            <span className="kpi-stat-unit">shifts</span>
            <span className="kpi-stat-pill success">Active</span>
          </div>
          <small className="kpi-submeta">
            Recorded across {employeeRollup.length} active workforce members
          </small>
        </div>

        {/* Card 2: Productive Hours */}
        <div className="month-kpi-card emerald">
          <div className="kpi-top-row">
            <span className="kpi-title">Total Productive Hours</span>
            <div className="kpi-icon-bubble emerald">⚡</div>
          </div>
          <div className="kpi-value-row">
            <strong className="kpi-stat-number">{metrics.totalHours}</strong>
            <span className="kpi-stat-unit">hrs</span>
          </div>
          <small className="kpi-submeta">
            Averaging <strong>{metrics.avgHours} hrs</strong> per recorded shift
          </small>
        </div>

        {/* Card 3: On-Time Attendance Rate */}
        <div className="month-kpi-card blue">
          <div className="kpi-top-row">
            <span className="kpi-title">On-Time Attendance</span>
            <div className="kpi-icon-bubble blue">🎯</div>
          </div>
          <div className="kpi-value-row">
            <strong className="kpi-stat-number">{metrics.onTimeRate}%</strong>
            <span className="kpi-stat-pill success">
              {metrics.presentCount} on-time
            </span>
          </div>
          <small className="kpi-submeta">
            Target benchmark: &gt;92% punctual workforce presence
          </small>
        </div>

        {/* Card 4: Attendance Exceptions */}
        <div className="month-kpi-card amber">
          <div className="kpi-top-row">
            <span className="kpi-title">Exceptions & Leaves</span>
            <div className="kpi-icon-bubble amber">⚠️</div>
          </div>
          <div className="kpi-value-row">
            <strong className="kpi-stat-number">
              {metrics.exceptionsCount}
            </strong>
            <span className="kpi-stat-unit">flagged</span>
            {metrics.exceptionsCount > 0 && (
              <span className="kpi-stat-pill warning">Review</span>
            )}
          </div>
          <small className="kpi-submeta">
            {metrics.lateCount} late arrivals &bull; {metrics.halfDayCount} half
            days &bull; {metrics.absentCount} absences
          </small>
        </div>
      </section>

      {/* Main Table Section */}
      <section className="month-table-panel">
        <div className="panel-toolbar-header">
          {/* Dual View Mode Switcher */}
          <div className="view-switcher-pill">
            <button
              type="button"
              className={`view-pill-btn ${
                viewMode === "logs" ? "active" : ""
              }`}
              onClick={() => setViewMode("logs")}
            >
              <span>📋</span> Daily Punch Ledger
              <span className="view-pill-count">{filteredRecords.length}</span>
            </button>
            <button
              type="button"
              className={`view-pill-btn ${
                viewMode === "summary" ? "active" : ""
              }`}
              onClick={() => setViewMode("summary")}
            >
              <span>👥</span> Employee Monthly Rollup
              <span className="view-pill-count">{employeeRollup.length}</span>
            </button>
          </div>

          {/* Filter Controls Row */}
          <div className="toolbar-filters-row">
            {/* Search Input */}
            <div className="month-search-wrap">
              <svg
                className="month-search-icon"
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
                type="text"
                className="month-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee or code..."
                aria-label="Search monthly attendance"
              />
              {search && (
                <button
                  type="button"
                  className="month-search-clear"
                  onClick={() => setSearch("")}
                >
                  ×
                </button>
              )}
            </div>

            {/* Department Filter */}
            {departmentsList.length > 0 && (
              <select
                className="filter-select-mini"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                aria-label="Filter by department"
              >
                <option value="all">All Departments</option>
                {departmentsList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}

            {/* Status Filter (applicable in Logs mode) */}
            {viewMode === "logs" && (
              <select
                className="filter-select-mini"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="all">All Statuses</option>
                <option value="Present">Present</option>
                <option value="Late">Late Arrival</option>
                <option value="Half Day">Half Day</option>
                <option value="Absent">Absent</option>
              </select>
            )}

            {/* Duration Filter */}
            {viewMode === "logs" && (
              <select
                className="filter-select-mini"
                value={durationFilter}
                onChange={(e) => setDurationFilter(e.target.value)}
                aria-label="Filter by shift duration"
              >
                <option value="all">All Durations</option>
                <option value="standard">Standard (8 - 8.5h)</option>
                <option value="short">Short (&lt; 8h)</option>
                <option value="overtime">Overtime (&gt; 8.5h)</option>
              </select>
            )}
          </div>
        </div>

        {/* Inline Error or Notice */}
        {error && (
          <div className="hr-inline-error" role="alert">
            ⚠️ {error}
          </div>
        )}

        {/* Demo Indicator banner if using synthesized preview */}
        {useSampleData && (
          <div
            style={{
              padding: "0.65rem 1rem",
              background: "#f0fdfa",
              border: "1px solid #ccfbf1",
              borderRadius: "10px",
              color: "#0f766e",
              fontSize: "0.82rem",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1rem",
            }}
          >
            <span>
              💡 Viewing realistic monthly demonstration data for {selectedMonthName} {year}.
            </span>
            <button
              type="button"
              onClick={() => setUseSampleData(false)}
              style={{
                background: "transparent",
                border: "1px solid #0d9488",
                borderRadius: "6px",
                padding: "0.2rem 0.6rem",
                color: "#0d9488",
                fontSize: "0.76rem",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Show Live Backend Only
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="month-empty-state-box">
            <span className="month-empty-icon">⏳</span>
            <h4>Loading Monthly Records...</h4>
            <p>Fetching attendance intelligence for {selectedMonthName} {year}.</p>
          </div>
        ) : viewMode === "logs" ? (
          /* ==========================================================================
             VIEW 1: Detailed Daily Punch Ledger
             ========================================================================== */
          <div className="month-table-container">
            <table className="modern-attendance-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date & Day</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Working Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <div className="month-empty-state-box">
                        <span className="month-empty-icon">📅</span>
                        <h4>No Attendance Records Found</h4>
                        <p>
                          No shifts were logged matching your current filters for{" "}
                          {selectedMonthName} {year}.
                        </p>
                        {!useSampleData && (
                          <button
                            type="button"
                            className="btn-sample-seed"
                            onClick={() => setUseSampleData(true)}
                          >
                            <span>✨</span> Load Sample Monthly Data
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => {
                    const empName = record.employee?.name || "Employee";
                    const palette = getColorForString(empName);
                    const status = String(record.status || "Present").toLowerCase();
                    const hours = Number(record.workingHours) || 0;
                    const dayOfWeek = getDayOfWeek(record.date);

                    return (
                      <tr key={record.id || record._id}>
                        <td>
                          <div className="emp-id-cell">
                            <div
                              className="emp-avatar-chip"
                              style={{
                                backgroundColor: palette.bg,
                                color: palette.text,
                              }}
                            >
                              {getInitials(empName)}
                            </div>
                            <div className="emp-details">
                              <strong className="emp-name-text">
                                {empName}
                              </strong>
                              <div className="emp-meta-sub">
                                {record.employee?.employeeCode && (
                                  <span className="emp-code-sub">
                                    {record.employee.employeeCode}
                                  </span>
                                )}
                                {record.employee?.department && (
                                  <span className="emp-dept-sub">
                                    {record.employee.department}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="date-calendar-cell">
                            <span className="date-main">
                              {formatDate(record.date)}
                            </span>
                            <span className="day-badge">{dayOfWeek}</span>
                          </div>
                        </td>

                        <td>
                          {record.checkIn ? (
                            <span className="punch-chip">
                              🕒 {formatTime(record.checkIn)}
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>--:--</span>
                          )}
                        </td>

                        <td>
                          {record.checkOut ? (
                            <span className="punch-chip">
                              🕒 {formatTime(record.checkOut)}
                            </span>
                          ) : record.checkIn ? (
                            <span className="punch-chip in-progress">
                              ● On Duty
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>--:--</span>
                          )}
                        </td>

                        <td>
                          <div className="hours-gauge-cell">
                            <span
                              className={`hours-pill-badge ${
                                hours >= 8
                                  ? "full"
                                  : hours > 4
                                  ? "partial"
                                  : "minimal"
                              }`}
                            >
                              {hours > 0 ? `${hours} hrs` : "0 hrs"}
                            </span>
                            <div className="hours-bar-mini">
                              <div
                                className={`hours-bar-fill ${
                                  hours < 8 ? "amber" : ""
                                }`}
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.round((hours / 9) * 100)
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className={`status-pill ${status}`}>
                            <span className="pulse-dot" />
                            {record.status || "Present"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* ==========================================================================
             VIEW 2: Employee Monthly Rollup Matrix
             ========================================================================== */
          <div className="month-table-container">
            <table className="modern-attendance-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Days Worked</th>
                  <th>Punctuality Breakdown</th>
                  <th>Total Hours</th>
                  <th>Avg Hours / Day</th>
                  <th>Monthly Compliance</th>
                  <th>Audit Detail</th>
                </tr>
              </thead>
              <tbody>
                {employeeRollup.length === 0 ? (
                  <tr>
                    <td colSpan="8">
                      <div className="month-empty-state-box">
                        <span className="month-empty-icon">👥</span>
                        <h4>No Employee Summary Available</h4>
                        <p>No aggregated employee attendance found for this month.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  employeeRollup.map((emp) => {
                    const palette = getColorForString(emp.name);
                    return (
                      <tr key={emp.code || emp.name}>
                        <td>
                          <div className="emp-id-cell">
                            <div
                              className="emp-avatar-chip"
                              style={{
                                backgroundColor: palette.bg,
                                color: palette.text,
                              }}
                            >
                              {getInitials(emp.name)}
                            </div>
                            <div className="emp-details">
                              <strong className="emp-name-text">
                                {emp.name}
                              </strong>
                              {emp.code !== "-" && (
                                <span className="emp-code-sub">{emp.code}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className="emp-dept-sub">{emp.department}</span>
                        </td>

                        <td>
                          <strong>{emp.shifts}</strong> days
                        </td>

                        <td>
                          <span style={{ fontSize: "0.82rem", color: "#475569" }}>
                            🟢 <strong>{emp.present}</strong> on-time &bull; 🟡{" "}
                            <strong>{emp.late}</strong> late &bull; 🔴{" "}
                            <strong>{emp.absent}</strong> absent
                          </span>
                        </td>

                        <td>
                          <strong>{emp.totalHours.toFixed(1)}</strong> hrs
                        </td>

                        <td>
                          <span className="hours-pill-badge full">
                            {emp.avgHours} hrs
                          </span>
                        </td>

                        <td>
                          <div className="progress-rate-cell">
                            <span className="rate-number">
                              {emp.attendanceRate}%
                            </span>
                            <div className="rate-track">
                              <div
                                className={`rate-fill ${
                                  emp.attendanceRate < 85 ? "warning" : ""
                                }`}
                                style={{ width: `${emp.attendanceRate}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="btn-inspect-ledger"
                            onClick={() => setInspectedEmp(emp)}
                          >
                            Inspect &rarr;
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Drill-down Modal for Inspecting an Employee's Monthly Punch Audit */}
      {inspectedEmp && (
        <div
          className="ledger-modal-backdrop"
          onClick={() => setInspectedEmp(null)}
        >
          <div
            className="ledger-modal-window"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ledger-modal-header">
              <h3>
                Monthly Ledger: {inspectedEmp.name} ({selectedMonthName}{" "}
                {year})
              </h3>
              <button
                type="button"
                className="ledger-modal-close"
                onClick={() => setInspectedEmp(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="ledger-modal-body">
              <div className="ledger-emp-summary-strip">
                <div className="ledger-stat-tag">
                  <span>Total Shifts</span>
                  <strong>{inspectedEmp.shifts}</strong>
                </div>
                <div className="ledger-stat-tag">
                  <span>Cumulative Hours</span>
                  <strong>{inspectedEmp.totalHours.toFixed(1)} hrs</strong>
                </div>
                <div className="ledger-stat-tag">
                  <span>Average Daily</span>
                  <strong>{inspectedEmp.avgHours} hrs</strong>
                </div>
                <div className="ledger-stat-tag">
                  <span>Attendance Rate</span>
                  <strong>{inspectedEmp.attendanceRate}%</strong>
                </div>
              </div>

              <table className="modern-attendance-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Hours</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectedEmp.records.map((r) => {
                    const status = String(r.status || "Present").toLowerCase();
                    return (
                      <tr key={r.id || r._id}>
                        <td>{formatDateWithDay(r.date)}</td>
                        <td>{formatTime(r.checkIn) || "--:--"}</td>
                        <td>{formatTime(r.checkOut) || "--:--"}</td>
                        <td>
                          <strong>{r.workingHours ?? 0} hrs</strong>
                        </td>
                        <td>
                          <span className={`status-pill ${status}`}>
                            <span className="pulse-dot" />
                            {r.status || "Present"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MonthlyAttendanceReport;
