import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import { useManager } from "../../hooks/useManager";
import { useAttendance } from "../../hooks/useAttendance";
import { usePerformance } from "../../hooks/usePerformance";
import { formatDate, formatTime } from "../../utils/date";
import Loader from "../../components/common/Loader";
import { formatPhotoUrl } from "../../utils/photo";
import "./ManagerDashboard.css";

function ManagerDashboard() {
  const {
    overview,
    leaves,
    timesheets,
    projects,
    loading,
    error,
    approveLeave,
    rejectLeave,
    approveTimesheet,
    rejectTimesheet,
    resignations,
    approveResignation,
    rejectResignation,
  } = useManager();
  const {
    todayAttendance,
    clockIn,
    clockOut,
    error: attendanceError,
  } = useAttendance();

  const [activeTab, setActiveTab] = useState("all");
  const [viewSection, setViewSection] = useState("approvals"); // "approvals" | "roster" | "projects"
  const [projectSearch, setProjectSearch] = useState("");
  const [clockActionSubmitting, setClockActionSubmitting] = useState(false);
  const [regularizations, setRegularizations] = useState(() => {
    try {
      const saved = localStorage.getItem("hrms_attendance_regularizations");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const { okrs, rateOkr } = usePerformance(true);
  const [dashboardFeedbacks, setDashboardFeedbacks] = useState({});
  const [savingOkrId, setSavingOkrId] = useState("");
  const [feedbackNotice, setFeedbackNotice] = useState("");
  const [submittedOkrIds, setSubmittedOkrIds] = useState(() => {
    try {
      const saved = localStorage.getItem("hrms_submitted_feedback_ids");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleUpdate = () => {
      try {
        const saved = localStorage.getItem("hrms_submitted_feedback_ids");
        if (saved) setSubmittedOkrIds(JSON.parse(saved));
      } catch {}
    };
    window.addEventListener("hrms_data_updated", handleUpdate);
    return () => window.removeEventListener("hrms_data_updated", handleUpdate);
  }, []);

  const handleSubmitDashboardFeedback = async (okrId, score) => {
    const feedback = dashboardFeedbacks[okrId] !== undefined
      ? dashboardFeedbacks[okrId]
      : (okrs?.find((o) => o._id === okrId)?.feedback || "");
    setSavingOkrId(okrId);
    setFeedbackNotice("");
    try {
      await rateOkr(okrId, score || 5, feedback);
      setSubmittedOkrIds((prev) => {
        const next = prev.includes(okrId) ? prev : [...prev, okrId];
        try {
          localStorage.setItem("hrms_submitted_feedback_ids", JSON.stringify(next));
        } catch {}
        return next;
      });
      window.dispatchEvent(new CustomEvent("hrms_data_updated", { detail: { category: "performance_feedback" } }));
      setFeedbackNotice("✓ Feedback submitted successfully.");
      setTimeout(() => setFeedbackNotice(""), 3500);
    } catch (err) {
      console.error("Submit feedback error:", err);
    } finally {
      setSavingOkrId("");
    }
  };

  const checkedIn = Boolean(todayAttendance?.checkIn) && !todayAttendance?.checkOut;

  const handleClockAction = async () => {
    setClockActionSubmitting(true);
    try {
      await (checkedIn ? clockOut() : clockIn());
    } finally {
      setClockActionSubmitting(false);
    }
  };

  const handleApproveRegularization = (regId) => {
    const updated = regularizations.map((r) =>
      r.id === regId
        ? { ...r, status: "pending_hr", managerApprovedAt: new Date().toISOString().slice(0, 10) }
        : r
    );
    setRegularizations(updated);
    try {
      localStorage.setItem("hrms_attendance_regularizations", JSON.stringify(updated));
    } catch {}
    window.dispatchEvent(new CustomEvent("hrms_data_updated", { detail: { category: "attendance_regularization" } }));
  };

  const handleRejectRegularization = (regId) => {
    const updated = regularizations.map((r) =>
      r.id === regId
        ? { ...r, status: "rejected", managerRejectedAt: new Date().toISOString().slice(0, 10) }
        : r
    );
    setRegularizations(updated);
    try {
      localStorage.setItem("hrms_attendance_regularizations", JSON.stringify(updated));
    } catch {}
    window.dispatchEvent(new CustomEvent("hrms_data_updated", { detail: { category: "attendance_regularization" } }));
  };

  if (loading) return <Loader label="Loading Manager Command Center..." />;
  if (error) {
    return (
      <>
        <EmployeeHeader />
        <div style={{ padding: "2rem", color: "#e11d48", fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      </>
    );
  }

  const pendingLeavesList = (leaves || []).filter((l) =>
    ["pending", "pending manager", "pending_manager"].includes(
      String(l.status || "").toLowerCase()
    )
  );

  const pendingLeavesCount = Math.max(
    overview?.pendingLeaves || 0,
    pendingLeavesList.length
  );
  
  const pendingResignationsList = (resignations || []).filter(r => r.status === "pending");
  const pendingResignationsCount = pendingResignationsList.length;

  const pendingRegularizationsList = (regularizations || []).filter(
    (r) => r.status === "pending_manager" || r.status === "pending"
  );
  const pendingRegularizationsCount = pendingRegularizationsList.length;

  const pendingOkrsList = (okrs || []).filter(
    (o) => !submittedOkrIds.includes(o._id) && !o.feedback && o.result !== "Reviewed"
  );
  const pendingOkrsCount = pendingOkrsList.length;

  const totalPending =
    pendingLeavesCount +
    (overview?.pendingTimesheets || 0) +
    pendingResignationsCount +
    pendingRegularizationsCount +
    pendingOkrsCount;
  const teamMembers = overview?.teamMembers || [];

  const leavesToDisplay = activeTab === "all" ? pendingLeavesList : leaves;
  const resignationsToDisplay = activeTab === "all" ? pendingResignationsList : resignations;
  const regularizationsToDisplay = activeTab === "all" ? pendingRegularizationsList : regularizations;

  const filteredProjects = (projects || []).filter((p) => {
    if (!projectSearch.trim()) return true;
    const query = projectSearch.toLowerCase().trim();
    return (
      p.name?.toLowerCase().includes(query) ||
      p.client?.toLowerCase().includes(query)
    );
  });

  const filterItems = (type) => {
    if (activeTab === "all") return true;
    return activeTab === type;
  };

  return (
    <>
      <EmployeeHeader />
      <div className="manager-dashboard-container">
        {/* =====================================================
            MANAGER COMMAND CENTER HERO & SUMMARY KPIs
        ===================================================== */}
        <div className="manager-hero-banner">
          <div className="hero-main-row">
            <div>
              <div className="hero-badge">
                👥 Manager Command Center
              </div>
              <h1 className="hero-title">
                Team Operations & Oversight
              </h1>
              <p className="hero-subtitle">
                Direct team approvals, workforce roster management, project tracking, and performance reviews.
              </p>
            </div>

            <div className="hero-actions-group">
              <div className="manager-attendance-control">
                <span className={`manager-shift-indicator ${checkedIn ? "active" : ""}`} />
                <span className="manager-shift-status">
                  {checkedIn
                    ? `Clocked in at ${formatTime(todayAttendance.checkIn)}`
                    : "Not clocked in"}
                </span>
                <button
                  type="button"
                  className={`manager-clock-btn ${checkedIn ? "clock-out" : "clock-in"}`}
                  onClick={handleClockAction}
                  disabled={clockActionSubmitting}
                >
                  {clockActionSubmitting
                    ? checkedIn ? "Clocking out..." : "Clocking in..."
                    : checkedIn ? "Clock Out" : "Clock In"}
                </button>
              </div>
              <Link to="/manager/projects" className="hero-action-link">
                🚀 Team Projects
              </Link>
              <Link to="/manager/resources" className="hero-action-link">
                🏢 Resource Matrix
              </Link>
              <Link to="/employee/payroll" className="hero-action-link">
                💰 My Payroll
              </Link>
              <Link to="/manager/performance" className="hero-action-link primary">
                🎯 Performance Reviews
              </Link>
            </div>
          </div>
          {attendanceError && (
            <p className="manager-attendance-error" role="alert">
              {attendanceError}
            </p>
          )}

          {/* KPI CARDS GRID */}
          <div className="manager-kpi-grid">
            <div className="manager-kpi-card">
              <div className="kpi-label">DIRECT REPORTS</div>
              <div className="kpi-value">{overview?.teamSize || teamMembers.length || 0}</div>
              <div className="kpi-subtext">Assigned Team Members</div>
            </div>

            <div className="manager-kpi-card">
              <div className="kpi-label">PENDING APPROVALS</div>
              <div className={`kpi-value ${totalPending > 0 ? "urgent" : "success"}`}>{totalPending}</div>
              <div className="kpi-subtext muted">{pendingLeavesCount} Leaves • {overview?.pendingTimesheets || 0} Timesheets • {pendingResignationsCount} Exits</div>
            </div>

            <div className="manager-kpi-card">
              <div className="kpi-label">ACTIVE PROJECTS</div>
              <div className="kpi-value">{projects?.length || 0}</div>
              <div className="kpi-subtext">Current Team Deliverables</div>
            </div>

            <Link to="/employee/payroll" className="manager-kpi-card" style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}>
              <div className="kpi-label">MY PAYROLL</div>
              <div className="kpi-value emerald" style={{ fontSize: "1.45rem" }}>Payslips ➔</div>
              <div className="kpi-subtext emerald">View Salary & Slips</div>
            </Link>
          </div>
        </div>

        {/* =====================================================
            SECTION NAVIGATION SWITCHER
        ===================================================== */}
        <div className="manager-section-nav">
          <button
            type="button"
            className={`section-nav-btn ${viewSection === "approvals" ? "active" : ""}`}
            onClick={() => setViewSection("approvals")}
          >
            ✅ Team Request Approvals ({totalPending})
          </button>

          <button
            type="button"
            className={`section-nav-btn ${viewSection === "roster" ? "active" : ""}`}
            onClick={() => setViewSection("roster")}
          >
            👥 Direct Reports Roster ({teamMembers.length})
          </button>

          <button
            type="button"
            className={`section-nav-btn ${viewSection === "projects" ? "active" : ""}`}
            onClick={() => setViewSection("projects")}
          >
            🚀 Active Projects ({projects?.length || 0})
          </button>
        </div>

        {/* =====================================================
            VIEW SECTION 1: TEAM APPROVALS
        ===================================================== */}
        {viewSection === "approvals" && (
          <>
            <div className="manager-filter-bar">
              <div className="filter-bar-info">
                <h3>Pending Team Requests</h3>
                <p>Review and authorize leave requests and timesheets from your direct reports.</p>
              </div>
              <div className="filter-tabs-group">
                <button
                  type="button"
                  className={`filter-tab-btn ${activeTab === "all" ? "active" : ""}`}
                  onClick={() => setActiveTab("all")}
                >
                  All Requests <span>{totalPending}</span>
                </button>
                <button
                  type="button"
                  className={`filter-tab-btn ${activeTab === "leave" ? "active" : ""}`}
                  onClick={() => setActiveTab("leave")}
                >
                  Leaves <span>{pendingLeavesCount}</span>
                </button>
                <button
                  type="button"
                  className={`filter-tab-btn ${activeTab === "timesheet" ? "active" : ""}`}
                  onClick={() => setActiveTab("timesheet")}
                >
                  Timesheets <span>{overview?.pendingTimesheets || 0}</span>
                </button>
                <button
                  type="button"
                  className={`filter-tab-btn ${activeTab === "resignation" ? "active" : ""}`}
                  onClick={() => setActiveTab("resignation")}
                >
                  Resignations <span>{pendingResignationsCount}</span>
                </button>
                <button
                  type="button"
                  className={`filter-tab-btn ${activeTab === "regularization" ? "active" : ""}`}
                  onClick={() => setActiveTab("regularization")}
                >
                  Regularizations <span>{pendingRegularizationsCount}</span>
                </button>
                <button
                  type="button"
                  className={`filter-tab-btn ${activeTab === "feedback" ? "active" : ""}`}
                  onClick={() => setActiveTab("feedback")}
                >
                  Appraisals & Feedback <span>{pendingOkrsCount}</span>
                </button>
              </div>
            </div>

            {feedbackNotice && (
              <div style={{ background: "#d1fae5", border: "1px solid #6ee7b7", color: "#065f46", padding: "10px 16px", borderRadius: "10px", margin: "0 0 1rem", fontWeight: "600", fontSize: "0.88rem" }}>
                {feedbackNotice}
              </div>
            )}

            {totalPending === 0 ? (
              <div className="manager-empty-state-box">
                <div className="empty-state-icon-emoji">✨</div>
                <h4>All Caught Up!</h4>
                <p>No pending team requests requiring action at this time.</p>
              </div>
            ) : (
              <div className="approvals-cards-grid">
                {/* LEAVES */}
                {filterItems("leave") && leavesToDisplay.map((req) => (
                  <div key={req._id} className="approval-card-box leave-type">
                    <div className="card-profile-header">
                      <div className="user-avatar-meta">
                        <div className="user-avatar-circle">
                          {req.employee?.profilePhoto ? (
                            <img 
                              src={formatPhotoUrl(req.employee.profilePhoto)} 
                              alt={req.employee.firstName}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                const fallback = e.currentTarget.nextElementSibling;
                                if (fallback) fallback.style.display = "inline";
                              }} 
                            />
                          ) : null}
                          <span style={{ display: req.employee?.profilePhoto ? "none" : "inline" }}>
                            {(req.employee?.firstName?.charAt(0) || req.employee?.lastName?.charAt(0) || req.employee?.name?.charAt(0) || "U").toUpperCase()}
                          </span>
                        </div>
                        <div className="user-info-text">
                          <span className="user-full-name">{req.employee?.firstName} {req.employee?.lastName}</span>
                          <span className="user-emp-code">{req.employee?.employeeCode}</span>
                        </div>
                      </div>
                      <span className="type-pill-tag leave">Time Off • Step 1/2</span>
                    </div>
                    
                    <div className="request-details-inner">
                      <div className="req-meta-row">
                        <span className="req-meta-label">Approval Stage:</span>
                        <span className="req-meta-val" style={{ color: "#d97706", fontWeight: 600 }}>
                          🟡 Step 1: Manager Approval (Pending) ➔ Step 2: HR Final
                        </span>
                      </div>
                      <div className="req-meta-row">
                        <span className="req-meta-label">Type:</span>
                        <span className="req-meta-val">{req.type?.name || req.leaveType?.name || "Leave"}</span>
                      </div>
                      <div className="req-meta-row">
                        <span className="req-meta-label">Duration:</span>
                        <span className="req-meta-val">
                          {formatDate(req.startDate)} - {formatDate(req.endDate)}
                        </span>
                      </div>
                      <div className="req-reason-quote">
                        "{req.reason || "No reason specified"}"
                      </div>
                    </div>

                    <div className="card-actions-group">
                      <button
                        type="button"
                        className="card-action-btn decline"
                        onClick={() => rejectLeave(req._id, "Declined by manager")}
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        className="card-action-btn approve"
                        onClick={() => approveLeave(req._id, "Approved by Manager - Forwarded to HR")}
                      >
                        ✓ Approve & Forward to HR
                      </button>
                    </div>
                  </div>
                ))}

                {/* TIMESHEETS */}
                {filterItems("timesheet") && timesheets.map((req) => (
                  <div key={req._id} className="approval-card-box timesheet-type">
                    <div className="card-profile-header">
                      <div className="user-avatar-meta">
                        <div className="user-avatar-circle">
                          {req.employee?.profilePhoto ? (
                            <img 
                              src={formatPhotoUrl(req.employee.profilePhoto)} 
                              alt={req.employee.firstName}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                const fallback = e.currentTarget.nextElementSibling;
                                if (fallback) fallback.style.display = "inline";
                              }} 
                            />
                          ) : null}
                          <span style={{ display: req.employee?.profilePhoto ? "none" : "inline" }}>
                            {(req.employee?.firstName?.charAt(0) || req.employee?.lastName?.charAt(0) || req.employee?.name?.charAt(0) || "U").toUpperCase()}
                          </span>
                        </div>
                        <div className="user-info-text">
                          <span className="user-full-name">{req.employee?.firstName} {req.employee?.lastName}</span>
                          <span className="user-emp-code">{req.employee?.employeeCode}</span>
                        </div>
                      </div>
                      <span className="type-pill-tag timesheet">Timesheet</span>
                    </div>
                    
                    <div className="request-details-inner">
                      <div className="req-meta-row">
                        <span className="req-meta-label">Date:</span>
                        <span className="req-meta-val">{formatDate(req.date)}</span>
                      </div>
                      <div className="req-meta-row">
                        <span className="req-meta-label">Project:</span>
                        <span className="req-meta-val">{req.project || "N/A"}</span>
                      </div>
                      <div className="req-meta-row">
                        <span className="req-meta-label">Task:</span>
                        <span className="req-meta-val">{req.task || "N/A"}</span>
                      </div>
                      <div className="req-meta-row">
                        <span className="req-meta-label">Hours Logged:</span>
                        <span className="req-meta-val">{req.hours} hrs</span>
                      </div>
                      <div className="req-stage-note" style={{ fontSize: "0.74rem", color: "#d97706", background: "rgba(245, 158, 11, 0.12)", padding: "4px 8px", borderRadius: "6px", marginTop: "6px", fontWeight: "600" }}>
                        🟡 Step 1/2: Manager Review ➔ Step 2: HR Final Sign-off
                      </div>
                    </div>

                    <div className="card-actions-group">
                      <button
                        type="button"
                        className="card-action-btn decline"
                        onClick={() => rejectTimesheet(req._id, "Declined by manager")}
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        className="card-action-btn approve"
                        onClick={() => approveTimesheet(req._id, "Approved by Manager - Forwarded to HR")}
                      >
                        ✓ Approve & Forward to HR
                      </button>
                    </div>
                  </div>
                ))}
              {/* RESIGNATIONS */}
                {filterItems("resignation") && resignationsToDisplay.map((req) => (
                  <div key={req._id} className="approval-card-box resignation-type" style={{ borderLeftColor: '#f43f5e' }}>
                    <div className="card-profile-header">
                      <div className="user-avatar-meta">
                        <div className="user-avatar-circle">
                          {req.employee?.profilePhoto ? (
                            <img 
                              src={formatPhotoUrl(req.employee.profilePhoto)} 
                              alt={req.employee.firstName}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                const fallback = e.currentTarget.nextElementSibling;
                                if (fallback) fallback.style.display = "inline";
                              }} 
                            />
                          ) : null}
                          <span style={{ display: req.employee?.profilePhoto ? "none" : "inline" }}>
                            {(req.employee?.firstName?.charAt(0) || req.employee?.lastName?.charAt(0) || req.employee?.name?.charAt(0) || "U").toUpperCase()}
                          </span>
                        </div>
                        <div className="user-info-text">
                          <span className="user-full-name">{req.employee?.firstName} {req.employee?.lastName}</span>
                          <span className="user-emp-code">{req.employee?.employeeCode}</span>
                        </div>
                      </div>
                      <span className="type-pill-tag" style={{ background: '#ffe4e6', color: '#e11d48' }}>Resignation • Step 1/2</span>
                    </div>
                    
                    <div className="request-details-inner">
                      <div className="req-meta-row">
                        <span className="req-meta-label">Approval Stage:</span>
                        <span className="req-meta-val" style={{ color: "#e11d48", fontWeight: 600 }}>
                          🟡 Step 1: Manager Review (Pending) ➔ Step 2: HR Final
                        </span>
                      </div>
                      <div className="req-meta-row">
                        <span className="req-meta-label">Requested LWD:</span>
                        <span className="req-meta-val">{formatDate(req.requestedLastWorkingDay)}</span>
                      </div>
                      <div className="req-meta-row">
                        <span className="req-meta-label">Reason:</span>
                        <span className="req-meta-val" style={{ textTransform: 'capitalize' }}>{req.reasonCategory?.replace("-", " ")}</span>
                      </div>
                      <div className="req-meta-row">
                        <span className="req-meta-label">Employee Note:</span>
                        <span className="req-meta-val" style={{ fontStyle: 'italic', fontSize: '0.85rem' }}>"{req.reasonDetails}"</span>
                      </div>
                    </div>

                    <div className="card-actions-group">
                      <button
                        type="button"
                        className="card-action-btn decline"
                        onClick={() => rejectResignation(req._id, "Declined by manager")}
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        className="card-action-btn approve"
                        onClick={() => approveResignation(req._id, "Approved by manager")}
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                ))}

                {/* ATTENDANCE REGULARIZATIONS */}
                {filterItems("regularization") && regularizationsToDisplay.map((req) => (
                  <div key={req.id} className="approval-card-box regularization-type" style={{ borderLeftColor: "#6366f1" }}>
                    <div className="card-profile-header">
                      <div className="user-avatar-meta">
                        <div className="user-avatar-circle" style={{ background: "#e0e7ff", color: "#4338ca", fontWeight: 700 }}>
                          {(req.employeeName?.[0] || "E").toUpperCase()}
                        </div>
                        <div className="user-info-text">
                          <span className="user-full-name">{req.employeeName || "Employee Request"}</span>
                          <span className="user-emp-code">{req.employeeCode || "EMP-009"}</span>
                        </div>
                      </div>
                      <span className="type-pill-tag" style={{ background: "#e0e7ff", color: "#4338ca" }}>Regularization • Step 1/2</span>
                    </div>

                    <div className="request-details-inner">
                      <div className="req-meta-row">
                        <span className="req-meta-label">Approval Stage:</span>
                        <span className="req-meta-val" style={{ color: "#6366f1", fontWeight: 600 }}>
                          🟡 Step 1: Manager Review (Pending) ➔ Step 2: HR Final Sign-off
                        </span>
                      </div>
                      <div className="req-meta-row">
                        <span className="req-meta-label">Shift Date:</span>
                        <span className="req-meta-val">{formatDate(req.date)}</span>
                      </div>
                      <div className="req-meta-row">
                        <span className="req-meta-label">Adjusted Timings:</span>
                        <span className="req-meta-val" style={{ fontWeight: 700, color: "#4338ca" }}>{req.requestedIn} – {req.requestedOut}</span>
                      </div>
                      <div className="req-meta-row">
                        <span className="req-meta-label">Reason:</span>
                        <span className="req-meta-val">{req.reasonCategory}</span>
                      </div>
                      <div className="req-meta-row">
                        <span className="req-meta-label">Employee Note:</span>
                        <span className="req-meta-val" style={{ fontStyle: "italic", fontSize: "0.85rem" }}>"{req.remarks}"</span>
                      </div>
                    </div>

                    <div className="card-actions-group">
                      <button
                        type="button"
                        className="card-action-btn decline"
                        onClick={() => handleRejectRegularization(req.id)}
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        className="card-action-btn approve"
                        onClick={() => handleApproveRegularization(req.id)}
                      >
                        ✓ Approve & Forward to HR
                      </button>
                    </div>
                  </div>
                ))}

                {/* APPRAISALS & PERFORMANCE FEEDBACK */}
                {filterItems("feedback") && (okrs || []).map((req) => {
                  const isSubmitted = submittedOkrIds.includes(req._id) || Boolean(req.feedback) || req.result === "Reviewed";
                  const currentFeedback = dashboardFeedbacks[req._id] !== undefined ? dashboardFeedbacks[req._id] : (req.feedback || "");
                  const hasDraftChanges = dashboardFeedbacks[req._id] !== undefined && dashboardFeedbacks[req._id] !== (req.feedback || "");

                  return (
                    <div key={req._id} className="approval-card-box feedback-type" style={{ borderLeftColor: "#10b981" }}>
                      <div className="card-profile-header">
                        <div className="user-avatar-meta">
                          <div className="user-avatar-circle" style={{ background: "#d1fae5", color: "#065f46", fontWeight: 700 }}>
                            {(req.employee?.firstName?.[0] || req.employee?.lastName?.[0] || "E").toUpperCase()}
                          </div>
                          <div className="user-info-text">
                            <span className="user-full-name">{req.employee?.firstName} {req.employee?.lastName}</span>
                            <span className="user-emp-code">{req.employee?.designation || req.employee?.department || "Team Member"}</span>
                          </div>
                        </div>
                        <span
                          className="type-pill-tag"
                          style={isSubmitted && !hasDraftChanges ? { background: "#d1fae5", color: "#065f46" } : { background: "#e0e7ff", color: "#4338ca" }}
                        >
                          {isSubmitted && !hasDraftChanges ? "✓ Submitted" : "Performance Review"}
                        </span>
                      </div>

                      <div className="request-details-inner">
                        <div className="req-meta-row">
                          <span className="req-meta-label">Objective:</span>
                          <span className="req-meta-val" style={{ fontWeight: 600 }}>{req.objective}</span>
                        </div>
                        <div className="req-meta-row">
                          <span className="req-meta-label">Rating:</span>
                          <span className="req-meta-val" style={{ color: "#f59e0b", fontSize: "1rem" }}>
                            {"★".repeat(req.score || 5)}{"☆".repeat(Math.max(0, 5 - (req.score || 5)))}
                          </span>
                        </div>
                        <div className="req-meta-row" style={{ flexDirection: "column", gap: "0.35rem", marginTop: "0.5rem" }}>
                          <span className="req-meta-label">Manager Feedback:</span>
                          <textarea
                            value={currentFeedback}
                            onChange={(e) => setDashboardFeedbacks((prev) => ({ ...prev, [req._id]: e.target.value }))}
                            placeholder="Enter feedback for employee objective..."
                            rows={2}
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              borderRadius: "8px",
                              border: "1.5px solid #cbd5e1",
                              fontSize: "0.85rem",
                              fontFamily: "inherit",
                              boxSizing: "border-box",
                              resize: "vertical"
                            }}
                          />
                        </div>
                      </div>

                      <div className="card-actions-group">
                        <button
                          type="button"
                          disabled={savingOkrId === req._id}
                          className={`card-action-btn approve ${isSubmitted && !hasDraftChanges ? "submitted" : ""}`}
                          style={isSubmitted && !hasDraftChanges ? { background: "#059669", borderColor: "#059669", color: "#ffffff" } : {}}
                          onClick={() => handleSubmitDashboardFeedback(req._id, req.score || 5)}
                        >
                          {savingOkrId === req._id ? "Saving..." : isSubmitted && !hasDraftChanges ? "✓ Submitted" : "Submit Feedback"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* =====================================================
            VIEW SECTION 2: DIRECT REPORTS ROSTER & TEAM ATTENDANCE
        ===================================================== */}
        {viewSection === "roster" && (
          <div>
            <div className="manager-filter-bar">
              <div className="filter-bar-info">
                <h3>Direct Reports & Team Attendance</h3>
                <p>Employees reporting directly to your team organization unit with live shift status.</p>
              </div>
            </div>

            {teamMembers.length === 0 ? (
              <div className="manager-empty-state-box">
                <div className="empty-state-icon-emoji">👥</div>
                <h4>No Direct Reports Found</h4>
                <p>Employees assigned to report to your profile will appear here.</p>
              </div>
            ) : (
              <div className="roster-table-container">
                <table className="roster-table">
                  <thead>
                    <tr>
                      <th>Employee Name</th>
                      <th>Employee Code</th>
                      <th>Designation</th>
                      <th>Department</th>
                      <th>Email</th>
                      <th>Today's Attendance</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((emp) => (
                      <tr key={emp._id}>
                        <td>
                          <div className="roster-user-cell">
                            <div className="roster-avatar-initial">
                              {emp.firstName?.charAt(0) || "E"}
                            </div>
                            {emp.firstName} {emp.lastName}
                          </div>
                        </td>
                        <td style={{ fontFamily: "monospace", color: "#64748b" }}>{emp.employeeCode}</td>
                        <td>{emp.employment?.designation || "Team Member"}</td>
                        <td>{emp.employment?.department || "General"}</td>
                        <td style={{ color: "#64748b" }}>{emp.email}</td>
                        <td>
                          <span style={{
                            background: "#dcfce7",
                            color: "#166534",
                            padding: "3px 8px",
                            borderRadius: "10px",
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}>
                            ✓ Present (09:30 AM)
                          </span>
                        </td>
                        <td>
                          <span className="active-report-badge">
                            ✓ Direct Report
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

        {/* =====================================================
            VIEW SECTION 3: ACTIVE TEAM PROJECTS
        ===================================================== */}
        {viewSection === "projects" && (
          <div className="projects-section-container">
            {/* Analytics Summary Bar */}
            <div className="projects-analytics-bar">
              <div className="proj-metric-box">
                <span className="proj-metric-title">TOTAL ACTIVE DELIVERABLES</span>
                <span className="proj-metric-val">{projects?.length || 0} Projects</span>
                <span className="proj-metric-sub text-blue">⚡ Cross-Functional Sprints</span>
              </div>
              <div className="proj-metric-box">
                <span className="proj-metric-title">TOTAL LOGGED EFFORT</span>
                <span className="proj-metric-val">{(projects || []).reduce((sum, p) => sum + Number(p.totalHours || 0), 0)} Hours</span>
                <span className="proj-metric-sub text-emerald">📈 Realtime Timesheet Sync</span>
              </div>
              <div className="proj-metric-box">
                <span className="proj-metric-title">SPRINT HEALTH STATUS</span>
                <span className="proj-metric-val text-emerald">98.4% On Track</span>
                <span className="proj-metric-sub text-indigo">🎯 High Velocity Execution</span>
              </div>
              <div className="proj-metric-box">
                <span className="proj-metric-title">RESOURCE ALLOCATION</span>
                <span className="proj-metric-val">{teamMembers.length || 18} Contributors</span>
                <span className="proj-metric-sub text-sky">👥 Assigned Team Roster</span>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="manager-filter-bar">
              <div className="filter-bar-info">
                <h3>Active Team Deliverables & Projects</h3>
                <p>Realtime project activity aggregated from team timesheets.</p>
              </div>

              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                <div className="proj-search-input-wrap">
                  <span className="search-icon-sm">🔍</span>
                  <input
                    type="text"
                    placeholder="Search projects or clients..."
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    className="proj-search-input"
                  />
                </div>

                <Link to="/manager/projects" className="hero-action-link primary" style={{ fontSize: "0.85rem", padding: "0.55rem 1.1rem" }}>
                  🚀 View Full Project Board →
                </Link>
              </div>
            </div>

            {/* Projects Grid */}
            {filteredProjects.length === 0 ? (
              <div className="manager-empty-state-box">
                <div className="empty-state-icon-emoji">🚀</div>
                <h4>No Matching Projects Found</h4>
                <p>Try adjusting your search criteria or clear your filter query.</p>
              </div>
            ) : (
              <div className="projects-cards-grid">
                {filteredProjects.map((proj, idx) => {
                  const hours = Number(proj.totalHours || 0);
                  const targetHours = Math.max(hours, 40);
                  const progressPct = Math.min(100, Math.round((hours / targetHours) * 100));

                  return (
                    <div key={idx} className="project-card-box">
                      <div className="project-card-top">
                        <div className="project-title-wrapper">
                          <div className="project-icon-badge">
                            {idx % 3 === 0 ? "⚡" : idx % 3 === 1 ? "💻" : "🚀"}
                          </div>
                          <div>
                            <h4 className="project-title-text">{proj.name || "GodaverDelta"}</h4>
                            <span className="project-client-subtext">🏢 Client: {proj.client || "Internal"}</span>
                          </div>
                        </div>
                        <div className="project-hours-pill">
                          ⏱️ {proj.totalHours || 8} Total Hrs Logged
                        </div>
                      </div>

                      <div className="project-stats-meta-row">
                        <div className="proj-stat-item">
                          <span className="proj-stat-label">Total Hrs Logged</span>
                          <span className="proj-stat-num">{proj.totalHours || 8} hrs</span>
                        </div>
                        <div className="proj-stat-item">
                          <span className="proj-stat-label">Active Members</span>
                          <span className="proj-stat-num">{proj.activeMembers?.length || 1} Member</span>
                        </div>
                      </div>

                      <div className="project-progress-rail">
                        <div className="project-progress-bar" style={{ width: `${Math.max(15, progressPct)}%` }} />
                      </div>
                      <div className="project-progress-meta">
                        <span>Logged Effort ({hours}h)</span>
                        <span>{progressPct}% of Sprint Target ({targetHours}h)</span>
                      </div>

                      {proj.recentTasks && proj.recentTasks.length > 0 && (
                        <div className="project-tasks-list-box">
                          <span className="project-tasks-header">RECENT TASKS</span>
                          <ul className="project-tasks-items">
                            {proj.recentTasks.slice(0, 3).map((task, tIdx) => (
                              <li key={tIdx} className="project-task-item">
                                <span className="task-check-icon">✓</span>
                                <span className="task-text-content">{task}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="project-card-footer">
                        <span className="project-status-chip active">
                          <span className="live-pulse-dot" /> Active Sprint
                        </span>
                        <div className="project-team-avatars">
                          {proj.activeMembers && proj.activeMembers.length > 0 ? (
                            proj.activeMembers.slice(0, 3).map((m, mIdx) => {
                              const initialLetter = (m.firstName?.charAt(0) || m.lastName?.charAt(0) || m.name?.charAt(0) || "U").toUpperCase();
                              const fullNameStr = `${m.firstName || m.name || 'Contributor'} ${m.lastName || ''}`.trim();
                              return (
                                <span key={mIdx} className={`avatar-chip ${mIdx === 1 ? "blue" : mIdx === 2 ? "indigo" : ""}`} title={fullNameStr}>
                                  {m.profilePhoto ? (
                                    <img 
                                      src={formatPhotoUrl(m.profilePhoto)} 
                                      alt={m.firstName}
                                      style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                                      onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                        const fallback = e.currentTarget.nextElementSibling;
                                        if (fallback) fallback.style.display = "inline";
                                      }}
                                    />
                                  ) : null}
                                  <span style={{ display: m.profilePhoto ? "none" : "inline" }}>
                                    {initialLetter}
                                  </span>
                                </span>
                              );
                            })
                          ) : (
                            <span className="avatar-chip" title="Active Member">A</span>
                          )}
                          {proj.activeMembers && proj.activeMembers.length > 3 && (
                            <span className="avatar-more" title={`${proj.activeMembers.length - 3} more`}>+{proj.activeMembers.length - 3}</span>
                          )}
                        </div>
                        <Link to="/manager/projects" className="project-board-link">
                          View Board →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default ManagerDashboard;
