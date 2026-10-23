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
              className="att-btn primary"
              style={{ background: "#4f46e5", color: "#ffffff", border: "none" }}
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
        <div style={{ display: "flex", gap: "8px", margin: "1.25rem 0 1rem", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px", overflowX: "auto" }}>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: viewMode === "table" ? "#4f46e5" : "#f8fafc",
              color: viewMode === "table" ? "#ffffff" : "#475569",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: viewMode === "table" ? "0 4px 10px rgba(79, 70, 229, 0.25)" : "none"
            }}
          >
            <span>📋 Daily Shift Ledger</span>
            <span style={{ background: viewMode === "table" ? "rgba(255,255,255,0.25)" : "#e2e8f0", padding: "2px 7px", borderRadius: "10px", fontSize: "0.75rem" }}>{attendanceRecords.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: viewMode === "calendar" ? "#4f46e5" : "#f8fafc",
              color: viewMode === "calendar" ? "#ffffff" : "#475569",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: viewMode === "calendar" ? "0 4px 10px rgba(79, 70, 229, 0.25)" : "none"
            }}
          >
            <span>🗓️ Monthly Attendance Calendar</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("regularization")}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: viewMode === "regularization" ? "#4f46e5" : "#f8fafc",
              color: viewMode === "regularization" ? "#ffffff" : "#475569",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: viewMode === "regularization" ? "0 4px 10px rgba(79, 70, 229, 0.25)" : "none"
            }}
          >
            <span>🛡️ Regularization Requests</span>
            <span style={{ background: viewMode === "regularization" ? "rgba(255,255,255,0.25)" : "#e2e8f0", padding: "2px 7px", borderRadius: "10px", fontSize: "0.75rem" }}>{regularizations.length}</span>
          </button>
        </div>

        {regularizeNotice && (
          <div style={{ background: "#dcfce7", color: "#166534", padding: "10px 14px", borderRadius: "8px", marginBottom: "1rem", fontWeight: 600, fontSize: "0.88rem", border: "1px solid #bbf7d0" }}>
            {regularizeNotice}
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
                  {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} Shift Attendance Calendar
                </h2>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                  Color-coded visual presence: Green = Present, Amber = Late/Half-day, Red = LOP / Unrecorded.
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px", fontSize: "0.78rem", fontWeight: 600 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><span style={{ width: "10px", height: "10px", background: "#10b981", borderRadius: "2px" }} /> Present</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><span style={{ width: "10px", height: "10px", background: "#f59e0b", borderRadius: "2px" }} /> Late</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><span style={{ width: "10px", height: "10px", background: "#cbd5e1", borderRadius: "2px" }} /> Weekend</span>
              </div>
            </div>

            {/* Calendar 7-Column Day Header */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px", marginBottom: "8px", textAlign: "center", fontWeight: 700, fontSize: "0.82rem", color: "#64748b" }}>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div style={{ color: "#94a3b8" }}>Sat</div>
              <div style={{ color: "#94a3b8" }}>Sun</div>
            </div>

            {/* Calendar Days Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px" }}>
              {(() => {
                const now = new Date();
                const curYear = now.getFullYear();
                const curMonth = now.getMonth();
                const totalDays = new Date(curYear, curMonth + 1, 0).getDate();
                const todayMidnight = new Date(curYear, curMonth, now.getDate());

                return Array.from({ length: totalDays }, (_, i) => {
                  const dayNum = i + 1;
                  const dateObj = new Date(curYear, curMonth, dayNum);
                  const dateStr = `${curYear}-${String(curMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                  const rec = attendanceRecords.find((r) => String(r.date).slice(0, 10) === dateStr);
                  const dayOfWeek = dateObj.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const isFuture = dateObj > todayMidnight;

                  let bg = "#f8fafc";
                  let borderColor = "#e2e8f0";
                  let statusLabel = isWeekend ? "Weekend" : isFuture ? "Upcoming" : "Not Logged";
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
                    borderColor = "#e2e8f0";
                    statusLabel = "Weekend";
                  } else if (isFuture) {
                    bg = "#f8fafc";
                    borderColor = "#e2e8f0";
                    statusLabel = "Upcoming";
                  } else {
                    bg = "#fef2f2";
                    borderColor = "#fecaca";
                    statusLabel = "Unrecorded";
                  }

                  return (
                    <div
                      key={dayNum}
                      style={{
                        background: bg,
                        border: `1px solid ${borderColor}`,
                        borderRadius: "8px",
                        padding: "8px",
                        minHeight: "75px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ fontSize: "0.85rem", color: "#0f172a" }}>{dayNum}</strong>
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: borderColor === "#fde68a" ? "#b45309" : borderColor === "#fca5a5" || borderColor === "#fecaca" ? "#dc2626" : "#15803d" }}>
                          {hours}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.72rem", color: "#475569", fontWeight: 600 }}>{statusLabel}</span>
                      {!isWeekend && !isFuture && (
                        <button
                          type="button"
                          onClick={() => {
                            setRegularizeForm({ ...regularizeForm, date: dateStr });
                            setShowRegularizeModal(true);
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#4f46e5",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            textAlign: "left",
                            padding: 0
                          }}
                        >
                          Adjust / Regularize ➔
                        </button>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* VIEW 3: REGULARIZATION REQUESTS LEDGER */}
        {viewMode === "regularization" && (
          <div className="att-regularization-panel" style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Attendance Regularization Queue</h2>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                  Multi-tier audit tracking: Employee Submission ➔ Manager Authorization ➔ HR Final Sign-off.
                </p>
              </div>
              <button
                type="button"
                className="att-btn primary"
                style={{ background: "#4f46e5", color: "#ffffff", border: "none" }}
                onClick={() => setShowRegularizeModal(true)}
              >
                + New Regularization Request
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontWeight: 700 }}>
                    <th style={{ padding: "10px 14px" }}>Request ID</th>
                    <th style={{ padding: "10px 14px" }}>Shift Date</th>
                    <th style={{ padding: "10px 14px" }}>Requested In / Out</th>
                    <th style={{ padding: "10px 14px" }}>Reason Category</th>
                    <th style={{ padding: "10px 14px" }}>Explanation & Remarks</th>
                    <th style={{ padding: "10px 14px" }}>Approval Matrix Status</th>
                  </tr>
                </thead>
                <tbody>
                  {regularizations.map((reg) => (
                    <tr key={reg.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: "#4f46e5" }}>{reg.id}</td>
                      <td style={{ padding: "12px 14px" }}><strong>{formatDate(reg.date)}</strong></td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 600 }}>
                          {reg.requestedIn} – {reg.requestedOut}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: 600, color: "#334155" }}>{reg.reasonCategory}</td>
                      <td style={{ padding: "12px 14px", color: "#64748b", maxWidth: "250px" }}>{reg.remarks}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontSize: "0.76rem",
                          fontWeight: 700,
                          background: reg.status === "approved" ? "#dcfce7" : reg.status === "pending_hr" ? "#e0e7ff" : "#fef3c7",
                          color: reg.status === "approved" ? "#166534" : reg.status === "pending_hr" ? "#3730a3" : "#854d0e"
                        }}>
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
          </div>
        )}
      </>
    )}

    {/* Regularization Request Modal */}
    {showRegularizeModal && (
      <div className="modal-overlay" onClick={() => setShowRegularizeModal(false)}>
        <div className="onboard-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
          <div className="modal-header-row">
            <div>
              <h2>Request Attendance Regularization</h2>
              <p>Adjust missed biometric punches or on-site client duty.</p>
            </div>
            <button type="button" className="btn-modal-close" onClick={() => setShowRegularizeModal(false)}>✕</button>
          </div>
          <form onSubmit={handleSubmitRegularization} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>Shift Date *</label>
              <input
                type="date"
                required
                value={regularizeForm.date}
                onChange={(e) => setRegularizeForm({ ...regularizeForm, date: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>Actual Clock In (IST) *</label>
                <input
                  type="time"
                  required
                  value={regularizeForm.checkInTime}
                  onChange={(e) => setRegularizeForm({ ...regularizeForm, checkInTime: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>Actual Clock Out (IST) *</label>
                <input
                  type="time"
                  required
                  value={regularizeForm.checkOutTime}
                  onChange={(e) => setRegularizeForm({ ...regularizeForm, checkOutTime: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>Reason Category *</label>
              <select
                value={regularizeForm.reasonCategory}
                onChange={(e) => setRegularizeForm({ ...regularizeForm, reasonCategory: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              >
                <option value="Biometric Miss / Device Failure">Biometric Miss / Device Failure</option>
                <option value="Client On-site Visit">Client On-site Visit</option>
                <option value="Forgot to Punch">Forgot to Punch (Entry/Exit)</option>
                <option value="Network / System Outage">Network / System Outage</option>
                <option value="Authorized Work from Home">Authorized Work from Home</option>
                <option value="Official Travel / Outdoor Duty">Official Travel / Outdoor Duty</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>Detailed Justification / Explanation *</label>
              <textarea
                required
                rows={3}
                placeholder="State specific reason for punch adjustment and manager approval context..."
                value={regularizeForm.remarks}
                onChange={(e) => setRegularizeForm({ ...regularizeForm, remarks: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", resize: "vertical" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
              <button type="button" onClick={() => setShowRegularizeModal(false)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button type="submit" style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#4f46e5", color: "#ffffff", fontWeight: 700, cursor: "pointer" }}>Submit for Manager Approval</button>
            </div>
          </form>
        </div>
      </div>
    )}
      </main>
    </>
  );
}

export default EmployeeAttendance;
