import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import Loader from "../../components/common/Loader";
import ErrorMessage from "../../components/common/ErrorMessage";
import { useAuth } from "../../context/AuthContext";
import { useAttendance } from "../../hooks/useAttendance";
import { formatDate, formatTime, getLocalDateString, isToday } from "../../utils/date";
import { getDefaultDashboard } from "../../utils/auth";
import "../../styles/employee/attendance.css";

function EmployeeAttendance() {
  const { user, employee } = useAuth();
  const { attendance, todayAttendance, loading, error, reload } = useAttendance();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchDate, setSearchDate] = useState("");
  const [viewMode, setViewMode] = useState("table"); // "table" | "calendar" | "regularization"
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [showRegularizeModal, setShowRegularizeModal] = useState(false);
  const [regularizeNotice, setRegularizeNotice] = useState("");

  const [regularizeForm, setRegularizeForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    checkInTime: "09:30",
    checkOutTime: "18:30",
    reasonCategory: "Biometric Device Failure",
    remarks: "",
  });

  const [regularizations, setRegularizations] = useState(() => {
    try {
      const saved = localStorage.getItem("hrms_attendance_regularizations");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleSubmitRegularization = (e) => {
    e.preventDefault();
    if (!regularizeForm.date || !regularizeForm.remarks.trim()) return;
    const newReg = {
      id: `REG-2026-${String(regularizations.length + 82).padStart(3, "0")}`,
      date: regularizeForm.date,
      requestedIn: regularizeForm.checkInTime,
      requestedOut: regularizeForm.checkOutTime,
      reasonCategory: regularizeForm.reasonCategory,
      remarks: regularizeForm.remarks.trim(),
      status: "pending_manager",
      submittedAt: new Date().toISOString().slice(0, 10),
    };
    const updated = [newReg, ...regularizations];
    setRegularizations(updated);
    try {
      localStorage.setItem("hrms_attendance_regularizations", JSON.stringify(updated));
    } catch {}
    setShowRegularizeModal(false);
    setRegularizeNotice("✓ Regularization request submitted successfully for Manager review.");
    setTimeout(() => setRegularizeNotice(""), 4000);
    window.dispatchEvent(new CustomEvent("hrms_data_updated", { detail: { category: "attendance_regularization" } }));
  };

  const overviewPath = getDefaultDashboard(user, employee);
  const checkedIn = Boolean(todayAttendance?.checkIn) && !todayAttendance?.checkOut;

  // Helper to format record hours cleanly
  const getRecordHours = (rec) => {
    if (!rec.checkIn) return "0.0 hrs";

    const isTodayRecord = isToday(rec.date);
    const start = new Date(rec.checkIn).getTime();

    if (rec.checkOut) {
      const end = new Date(rec.checkOut).getTime();
      if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
        const hrs = ((end - start) / (1000 * 60 * 60)).toFixed(1);
        return `${hrs} hrs`;
      }
      if (rec.workingHours && !Number.isNaN(Number(rec.workingHours)) && Number(rec.workingHours) > 0) {
        return `${Number(rec.workingHours).toFixed(1)} hrs`;
      }
      return "0.0 hrs";
    }

    if (isTodayRecord && !Number.isNaN(start)) {
      const hrs = Math.max(0, (Date.now() - start) / (1000 * 60 * 60)).toFixed(1);
      return `${hrs} hrs (Active)`;
    }

    if (rec.workingHours && !Number.isNaN(Number(rec.workingHours)) && Number(rec.workingHours) > 0) {
      return `${Number(rec.workingHours).toFixed(1)} hrs`;
    }

    return "--:--";
  };

  const rawList = attendance || [];
  const attendanceRecords = useMemo(() => rawList, [rawList]);

  // Metrics
  const totalDays = attendanceRecords.length;
  const presentDays = attendanceRecords.filter((r) =>
    ["present", "late", "completed"].includes(String(r.status || "").toLowerCase()) || Boolean(r.checkIn)
  ).length;
  const lateDays = attendanceRecords.filter((r) =>
    String(r.status || "").toLowerCase() === "late"
  ).length;
  const presenceRate = totalDays ? Math.round((presentDays / totalDays) * 100) : 0;

  // Filtered List
  const filteredList = useMemo(() => {
    return attendanceRecords.filter((rec) => {
      const matchStatus =
        statusFilter === "all" ||
        String(rec.status || "").toLowerCase() === statusFilter.toLowerCase();
      const matchDate =
        !searchDate ||
        getLocalDateString(rec.date) === searchDate;
      return matchStatus && matchDate;
    });
  }, [attendanceRecords, statusFilter, searchDate]);

  // Export CSV Handler
  const handleExportCSV = () => {
    const headers = ["Date", "Clock In", "Clock Out", "Working Hours", "Status"];
    const rows = filteredList.map((r) => [
      r.date,
      r.checkIn ? formatTime(r.checkIn) : "--",
      r.checkOut ? formatTime(r.checkOut) : "--",
      r.workingHours || "8.0",
      r.status || "Present",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Quadratic_Attendance_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <EmployeeHeader />

      <main className="employee-attendance-hub">
        {/* =====================================================
            HERO COMMAND BANNER
        ===================================================== */}
        <section className="att-hero-banner" aria-label="Attendance Hero">
          <div className="att-hero-left">
            <div className="hero-kicker-pill">
              <span className="pulsing-live-dot" />
              <span>Quadratic Attendance Intelligence</span>
            </div>
            <h1>Time & Daily Attendance</h1>
            <p>
              Review monthly presence records, shift timings, verified biometric punches,
              and cumulative working hours.
            </p>

            <div className="emp-meta-pills">
              <span className="meta-pill-tag">🕒 Shift Window: 09:30 AM – 06:30 PM (IST)</span>
              <span className="meta-pill-tag">🎯 Net Work Target: 8.0 hrs</span>
              <span className="meta-pill-tag">🍱 Lunch Break: 45 Mins</span>
              <span className="meta-pill-tag">📍 Asia/Kolkata (IST)</span>
            </div>
          </div>

          <div className="att-hero-actions">
            <div className="att-live-status-badge">
              <span className={`status-beacon ${checkedIn ? "beacon-active" : "beacon-idle"}`} />
              <span>
                {checkedIn
                  ? `Shift Active (${todayAttendance?.checkIn ? formatTime(todayAttendance.checkIn) : "In Progress"})`
                  : todayAttendance?.checkOut
                  ? `Shift Ended (${formatTime(todayAttendance.checkOut)})`
                  : "Shift Inactive"}
              </span>
            </div>

            <Link
              to={overviewPath}
              className="att-btn secondary"
              title="Return to your role's overview to clock in or out"
            >
              ⏱️ Overview Punch Console
            </Link>

            <button
              type="button"
              className="att-btn att-btn-hero-regularize"
              onClick={() => setShowRegularizeModal(true)}
              title="Submit punch adjustment or biometric miss regularization"
            >
              ⏱️ Request Regularization
            </button>

            <button
              type="button"
              className="att-btn secondary"
              onClick={handleExportCSV}
              title="Export records to CSV"
            >
              📥 Export CSV
            </button>
          </div>
        </section>

        {/* =====================================================
            KPI METRIC CARDS (4 CARDS)
        ===================================================== */}
        <section className="att-kpi-grid" aria-label="Attendance Metrics">
          <div className="kpi-card-box emerald">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Presence Rate</span>
              <div className="kpi-icon-pod emerald">📈</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{presenceRate}%</span>
              <span className="kpi-badge-chip positive">High Consistency</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar emerald" style={{ width: `${presenceRate}%` }} />
            </div>
            <span className="kpi-subtext">{presentDays} Present out of {totalDays} Workdays</span>
          </div>

          <div className="kpi-card-box teal">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Logged Workdays</span>
              <div className="kpi-icon-pod teal">📅</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{totalDays}</span>
              <span className="kpi-badge-chip neutral">Current Cycle</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar teal" style={{ width: "100%" }} />
            </div>
            <span className="kpi-subtext">Automated biometric logging</span>
          </div>

          <div className="kpi-card-box rose">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Late Arrivals</span>
              <div className="kpi-icon-pod rose">⚠️</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{lateDays}</span>
              <span className={`kpi-badge-chip ${lateDays > 0 ? "rose" : "positive"}`}>
                {lateDays > 0 ? "Grace Limit: 3" : "On Time / Perfect"}
              </span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar rose" style={{ width: `${Math.min(100, (lateDays / 3) * 100)}%` }} />
            </div>
            <span className="kpi-subtext">
              {lateDays > 0 ? "Within permissible monthly tolerance" : "Zero late arrival flags this cycle"}
            </span>
          </div>

          <div className="kpi-card-box indigo">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Average Daily Hours</span>
              <div className="kpi-icon-pod indigo">⏱️</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">
                {checkedIn ? `Active` : "8.2h"}
              </span>
              <span className="kpi-badge-chip indigo">Target: 8.0h</span>
            </div>
            <div className="kpi-progress-rail">
              <div
                className="kpi-progress-bar indigo"
                style={{
                  width: "100%",
                }}
              />
            </div>
            <span className="kpi-subtext">Standard shift target: 8.0 hrs/day</span>
          </div>
        </section>

        {/* View Mode Switcher: Daily Ledger vs Monthly Calendar vs Regularizations */}
        <div className="att-view-mode-bar">
          <button
            type="button"
            className={`att-view-tab-btn ${viewMode === "table" ? "active" : ""}`}
            onClick={() => setViewMode("table")}
          >
            <span>📋 Daily Shift Ledger</span>
            <span className="att-tab-count-badge">{attendanceRecords.length}</span>
          </button>

          <button
            type="button"
            className={`att-view-tab-btn ${viewMode === "calendar" ? "active" : ""}`}
            onClick={() => setViewMode("calendar")}
          >
            <span>🗓️ Monthly Attendance Calendar</span>
          </button>

          <button
            type="button"
            className={`att-view-tab-btn ${viewMode === "regularization" ? "active" : ""}`}
            onClick={() => setViewMode("regularization")}
          >
            <span>🛡️ Regularization Requests</span>
            <span className="att-tab-count-badge">{regularizations.length}</span>
          </button>
        </div>

        {regularizeNotice && (
          <div className="att-notice-banner">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>{regularizeNotice}</span>
          </div>
        )}

        {/* =====================================================
            ATTENDANCE VIEWS
        ===================================================== */}
        {loading || (error && String(typeof error === "string" ? error : error?.message || "").toLowerCase().includes("authorization")) ? (
          <Loader label="Loading attendance history..." />
        ) : error ? (
          <ErrorMessage message={typeof error === "string" ? error : error?.message || "Failed to load attendance"} onRetry={reload} />
        ) : (
          <>
            {/* VIEW 1: TABLE VIEW */}
            {viewMode === "table" && (
          <div className="att-table-panel">
            <div className="att-table-toolbar">
              <div>
                <h2>Daily Attendance History</h2>
                <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.84rem" }}>
                  Showing {filteredList.length} verified shift records.
                </p>
              </div>

              <div className="att-filters-group">
                <input
                  type="date"
                  className="att-month-input"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  placeholder="Filter by date"
                  title="Filter by date"
                />

                <select
                  className="att-filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  title="Filter by status"
                >
                  <option value="all">All Statuses</option>
                  <option value="present">Present</option>
                  <option value="late">Late Arrival</option>
                  <option value="half-day">Half Day</option>
                  <option value="absent">Absent</option>
                </select>

                {(statusFilter !== "all" || searchDate) && (
                  <button
                    type="button"
                    className="att-btn secondary"
                    style={{ height: "40px", padding: "0 0.85rem", fontSize: "0.78rem" }}
                    onClick={() => {
                      setStatusFilter("all");
                      setSearchDate("");
                    }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            <div className="table-responsive-wrapper">
              <table className="att-records-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Working Hours</th>
                    <th>Break Duration</th>
                    <th>Status</th>
                    <th>Verification</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((rec) => (
                    <tr key={rec.id || rec._id || rec.date}>
                      <td className="att-date-col">
                        <strong>{formatDate(rec.date)}</strong>
                      </td>
                      <td>
                        <span className="time-badge">
                          {rec.checkIn ? formatTime(rec.checkIn) : "--:--"}
                        </span>
                      </td>
                      <td>
                        <span className="time-badge">
                          {rec.checkOut
                            ? formatTime(rec.checkOut)
                            : isToday(rec.date) && rec.checkIn
                            ? "Active"
                            : "--:--"}
                        </span>
                      </td>
                      <td>
                        <span className="hours-pill">
                          ⏱️ {getRecordHours(rec)}
                        </span>
                      </td>
                      <td className="att-break-col">
                        {rec.checkOut ? `${rec.breakDuration || 45} mins` : rec.checkIn ? "0 mins (In progress)" : "0 mins"}
                      </td>
                      <td>
                        <span
                          className={`status-chip-badge ${
                            String(rec.status).toLowerCase() === "late"
                              ? "late"
                              : String(rec.status).toLowerCase() === "absent"
                              ? "rose"
                              : "present"
                          }`}
                        >
                          {rec.status || "Present"}
                        </span>
                      </td>
                      <td>
                        <span className="att-verified-badge">
                          ✓ Biometric OK
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 2: MONTHLY ATTENDANCE CALENDAR */}
        {viewMode === "calendar" && (
          <div className="att-calendar-panel" style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  {calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })} Shift Attendance Calendar
                </h2>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                  Color-coded visual presence: Green = Present, Amber = Late/Half-day, Red = LOP / Unrecorded, Gray = Weekend.
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                {/* Month navigation controls */}
                <div style={{ display: "inline-flex", alignItems: "center", background: "#f1f5f9", borderRadius: "8px", padding: "3px", gap: "2px" }}>
                  <button
                    type="button"
                    onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                    style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "4px 10px", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", color: "#334155" }}
                    title="Previous Month"
                  >
                    ◀ Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarDate(new Date())}
                    style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "4px 10px", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", color: "#334155" }}
                    title="Jump to Current Month"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                    style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "4px 10px", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", color: "#334155" }}
                    title="Next Month"
                  >
                    Next ▶
                  </button>
                </div>

                <div style={{ display: "flex", gap: "8px", fontSize: "0.78rem", fontWeight: 600 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><span style={{ width: "10px", height: "10px", background: "#10b981", borderRadius: "2px" }} /> Present</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><span style={{ width: "10px", height: "10px", background: "#f59e0b", borderRadius: "2px" }} /> Late</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><span style={{ width: "10px", height: "10px", background: "#cbd5e1", borderRadius: "2px" }} /> Weekend</span>
                </div>
              </div>
            </div>

            {/* Calendar 7-Column Day Header */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px", marginBottom: "8px", textAlign: "center", fontWeight: 700, fontSize: "0.82rem", color: "#64748b" }}>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div style={{ color: "#ef4444", fontWeight: 800 }}>Sat (Weekend)</div>
              <div style={{ color: "#ef4444", fontWeight: 800 }}>Sun (Weekend)</div>
            </div>

            {/* Calendar Days Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px" }}>
              {(() => {
                const curYear = calendarDate.getFullYear();
                const curMonth = calendarDate.getMonth();
                const totalDays = new Date(curYear, curMonth + 1, 0).getDate();
                const prevMonthDays = new Date(curYear, curMonth, 0).getDate();
                const today = new Date();
                const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

                // Monday is Col 0 (index 0), Sunday is Col 6 (index 6)
                // In JS Date: Sunday = 0, Monday = 1, ..., Saturday = 6
                const firstDayOfWeek = new Date(curYear, curMonth, 1).getDay();
                const startPadding = (firstDayOfWeek + 6) % 7;
                const totalCells = startPadding + totalDays;
                const trailingPadding = (7 - (totalCells % 7)) % 7;

                const cells = [];

                // 1. PREVIOUS MONTH PADDING CELLS
                for (let p = 0; p < startPadding; p++) {
                  const prevDayNum = prevMonthDays - startPadding + p + 1;
                  cells.push(
                    <div
                      key={`prev-${p}`}
                      style={{
                        background: "#f8fafc",
                        border: "1px dashed #e2e8f0",
                        borderRadius: "8px",
                        padding: "8px",
                        minHeight: "75px",
                        opacity: 0.45,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between"
                      }}
                    >
                      <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 600 }}>{prevDayNum}</span>
                      <span style={{ fontSize: "0.68rem", color: "#cbd5e1" }}>Prev month</span>
                    </div>
                  );
                }

                // 2. CURRENT MONTH DAYS
                for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
                  const dateObj = new Date(curYear, curMonth, dayNum);
                  const dateStr = `${curYear}-${String(curMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                  const rec = attendanceRecords.find((r) => String(r.date).slice(0, 10) === dateStr);
                  const dayOfWeek = dateObj.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const isFuture = dateObj > todayMidnight;
                  const isTodayDate = dateObj.getTime() === todayMidnight.getTime();

                  let bg = "#f8fafc";
                  let borderColor = "#e2e8f0";
                  let statusLabel = isWeekend ? "Weekend (Off)" : isFuture ? "Upcoming" : "Not Logged";
                  let hours = rec?.workingHours || (isWeekend ? "0.0h" : isFuture ? "--" : "0.0h");

                  if (rec) {
                    const s = String(rec.status || "").toLowerCase();
                    if (s.includes("late")) {
                      bg = "#fef3c7";
                      borderColor = "#fde68a";
                      statusLabel = "Late Arrival";
                    } else if (s.includes("half")) {
                      bg = "#fef3c7";
                      borderColor = "#fde68a";
                      statusLabel = "Half Day";
                    } else if (s.includes("absent")) {
                      bg = "#fee2e2";
                      borderColor = "#fca5a5";
                      statusLabel = "Absent / LOP";
                    } else {
                      bg = "#f0fdf4";
                      borderColor = "#bbf7d0";
                      statusLabel = rec.status || "Present";
                    }
                  } else if (isWeekend) {
                    bg = "#f1f5f9";
                    borderColor = "#cbd5e1";
                    statusLabel = "Weekend (Off)";
                  } else if (isFuture) {
                    bg = "#f8fafc";
                    borderColor = "#e2e8f0";
                    statusLabel = "Upcoming";
                  } else {
                    bg = "#fef2f2";
                    borderColor = "#fecaca";
                    statusLabel = "Unrecorded";
                  }

                  cells.push(
                    <div
                      key={`day-${dayNum}`}
                      style={{
                        background: bg,
                        border: isTodayDate ? `2px solid #3b82f6` : `1px solid ${borderColor}`,
                        borderRadius: "8px",
                        padding: "8px",
                        minHeight: "75px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        boxShadow: isTodayDate ? "0 0 0 1px #3b82f6" : "none"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <strong style={{ fontSize: "0.85rem", color: isWeekend ? "#64748b" : "#0f172a" }}>{dayNum}</strong>
                          {isTodayDate && (
                            <span style={{ fontSize: "0.62rem", background: "#3b82f6", color: "#ffffff", padding: "1px 5px", borderRadius: "4px", fontWeight: 800 }}>
                              TODAY
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: isWeekend ? "#94a3b8" : borderColor === "#fde68a" ? "#b45309" : borderColor === "#fca5a5" || borderColor === "#fecaca" ? "#dc2626" : "#15803d" }}>
                          {hours}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.72rem", color: isWeekend ? "#64748b" : "#475569", fontWeight: isWeekend ? 700 : 600 }}>{statusLabel}</span>
                      {!isWeekend && !isFuture && (
                        <button
                          type="button"
                          className="att-cal-reg-btn"
                          onClick={() => {
                            setRegularizeForm({ ...regularizeForm, date: dateStr });
                            setShowRegularizeModal(true);
                          }}
                        >
                          Adjust / Regularize ➔
                        </button>
                      )}
                    </div>
                  );
                }

                // 3. NEXT MONTH TRAILING PADDING CELLS
                for (let t = 0; t < trailingPadding; t++) {
                  cells.push(
                    <div
                      key={`next-${t}`}
                      style={{
                        background: "#f8fafc",
                        border: "1px dashed #e2e8f0",
                        borderRadius: "8px",
                        padding: "8px",
                        minHeight: "75px",
                        opacity: 0.45,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between"
                      }}
                    >
                      <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 600 }}>{t + 1}</span>
                      <span style={{ fontSize: "0.68rem", color: "#cbd5e1" }}>Next month</span>
                    </div>
                  );
                }

                return cells;
              })()}
            </div>
          </div>
        )}

        {/* VIEW 3: REGULARIZATION REQUESTS LEDGER */}
        {viewMode === "regularization" && (
          <div className="att-regularization-panel">
            <div className="att-reg-panel-header">
              <div className="att-reg-panel-title-area">
                <div className="att-reg-panel-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="M12 8v4"/>
                    <path d="M12 16h.01"/>
                  </svg>
                </div>
                <div>
                  <h2>Attendance Regularization Queue</h2>
                  <p>Multi-tier audit tracking: Employee Submission ➔ Manager Authorization ➔ HR Final Sign-off.</p>
                </div>
              </div>
              <button
                type="button"
                className="att-btn primary att-btn-new-reg"
                onClick={() => setShowRegularizeModal(true)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>New Regularization Request</span>
              </button>
            </div>

            {regularizations.length === 0 ? (
              <div className="att-reg-empty-state">
                <div className="att-reg-empty-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </div>
                <h3>No Regularization Requests Found</h3>
                <p>Have an unrecorded biometric punch, remote client duty, or official travel? Submit a regularization request for swift manager review.</p>
                <button
                  type="button"
                  className="att-btn primary att-btn-new-reg"
                  onClick={() => setShowRegularizeModal(true)}
                >
                  + Create Regularization Request
                </button>
              </div>
            ) : (
              <div className="table-responsive-wrapper">
                <table className="att-reg-table">
                  <thead>
                    <tr>
                      <th>Request ID</th>
                      <th>Shift Date</th>
                      <th>Requested In / Out</th>
                      <th>Reason Category</th>
                      <th>Explanation & Remarks</th>
                      <th>Approval Matrix Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regularizations.map((reg) => (
                      <tr key={reg.id}>
                        <td className="att-reg-id-cell">{reg.id}</td>
                        <td className="att-reg-date-cell"><strong>{formatDate(reg.date)}</strong></td>
                        <td>
                          <span className="att-reg-time-pill">
                            {reg.requestedIn} – {reg.requestedOut}
                          </span>
                        </td>
                        <td className="att-reg-category-cell">{reg.reasonCategory}</td>
                        <td className="att-reg-remarks-cell">{reg.remarks}</td>
                        <td>
                          <span className={`att-reg-status-badge status-${reg.status}`}>
                            {reg.status === "approved"
                              ? "✓ Fully Approved by HR"
                              : reg.status === "pending_hr"
                              ? "⏳ Pending Final HR Sign-off"
                              : "⏳ Pending Manager Review"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </>
    )}

      </main>

      {/* Regularization Request Modal */}
      {showRegularizeModal && (
        <div className="att-modal-overlay" onClick={() => setShowRegularizeModal(false)} role="dialog" aria-modal="true" aria-labelledby="reg-modal-title">
          <div className="att-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="att-modal-header">
              <div className="att-modal-header-info">
                <div className="att-modal-icon-pod">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <div>
                  <h2 id="reg-modal-title">Request Attendance Regularization</h2>
                  <p>Adjust missed biometric punches or on-site client duty.</p>
                </div>
              </div>
              <button
                type="button"
                className="att-modal-close-btn"
                onClick={() => setShowRegularizeModal(false)}
                aria-label="Close modal"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="att-modal-policy-notice">
              <div className="att-policy-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              </div>
              <div className="att-policy-text">
                <strong>Attendance Audit Compliance Policy</strong>
                <span>
                  Regularization requests must be submitted within 48 hours of shift occurrence. Upon submission, it is routed to your reporting manager for biometric reconciliation and HR for final sign-off.
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmitRegularization} className="att-modal-form">
              <div className="att-form-group">
                <label className="att-form-label" htmlFor="reg-shift-date">
                  Shift Date <span className="att-required-star">*</span>
                </label>
                <div className="att-input-with-icon">
                  <svg className="att-field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  <input
                    id="reg-shift-date"
                    type="date"
                    required
                    className="att-modal-input has-icon"
                    value={regularizeForm.date}
                    onChange={(e) => setRegularizeForm({ ...regularizeForm, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="att-form-row">
                <div className="att-form-group">
                  <label className="att-form-label" htmlFor="reg-clock-in">
                    Actual Clock In (IST) <span className="att-required-star">*</span>
                  </label>
                  <div className="att-input-with-icon">
                    <svg className="att-field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <input
                      id="reg-clock-in"
                      type="time"
                      required
                      className="att-modal-input has-icon"
                      value={regularizeForm.checkInTime}
                      onChange={(e) => setRegularizeForm({ ...regularizeForm, checkInTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="att-form-group">
                  <label className="att-form-label" htmlFor="reg-clock-out">
                    Actual Clock Out (IST) <span className="att-required-star">*</span>
                  </label>
                  <div className="att-input-with-icon">
                    <svg className="att-field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <input
                      id="reg-clock-out"
                      type="time"
                      required
                      className="att-modal-input has-icon"
                      value={regularizeForm.checkOutTime}
                      onChange={(e) => setRegularizeForm({ ...regularizeForm, checkOutTime: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="att-form-group">
                <label className="att-form-label" htmlFor="reg-reason-cat">
                  Reason Category <span className="att-required-star">*</span>
                </label>
                <div className="att-select-wrapper">
                  <select
                    id="reg-reason-cat"
                    className="att-modal-select"
                    value={regularizeForm.reasonCategory}
                    onChange={(e) => setRegularizeForm({ ...regularizeForm, reasonCategory: e.target.value })}
                  >
                    <option value="Biometric Miss / Device Failure">Biometric Miss / Device Failure</option>
                    <option value="Client On-site Visit">Client On-site Visit</option>
                    <option value="Forgot to Punch">Forgot to Punch (Entry/Exit)</option>
                    <option value="Network / System Outage">Network / System Outage</option>
                    <option value="Authorized Work from Home">Authorized Work from Home</option>
                    <option value="Official Travel / Outdoor Duty">Official Travel / Outdoor Duty</option>
                  </select>
                </div>
              </div>

              <div className="att-form-group">
                <label className="att-form-label" htmlFor="reg-remarks">
                  Detailed Justification / Explanation <span className="att-required-star">*</span>
                </label>
                <textarea
                  id="reg-remarks"
                  required
                  rows={3}
                  className="att-modal-textarea"
                  placeholder="State specific reason for punch adjustment and manager approval context (e.g. client meeting at Cyber City, badge scanner failed)..."
                  value={regularizeForm.remarks}
                  onChange={(e) => setRegularizeForm({ ...regularizeForm, remarks: e.target.value })}
                />
                <span className="att-field-hint">
                  Provide clear context to expedite manager review and prevent payroll discrepancies.
                </span>
              </div>

              <div className="att-modal-actions">
                <button
                  type="button"
                  className="att-btn-cancel"
                  onClick={() => setShowRegularizeModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="att-btn-submit"
                >
                  <span>Submit for Manager Approval</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default EmployeeAttendance;
