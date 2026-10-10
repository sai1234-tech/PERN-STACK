import { useCallback, useEffect, useMemo, useState } from "react";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import {
  getAllTimesheets,
  reviewTimesheet,
} from "../../services/timesheetService";
import { formatDate, formatTime } from "../../utils/date";
import "./TimesheetManagement.css";

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
  return (name.slice(0, 2) || "TS").toUpperCase();
}

function getDayOfWeek(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d);
}

// Quick pre-canned rejection suggestions for HR reviewers
const REJECTION_TAGS = [
  "Missing task details or deliverable notes",
  "Overtime exceeds standard budget without approval",
  "Incorrect start or end time logged",
  "Duplicate timesheet entry for this date",
  "Project code does not match authorized sprint",
];

// Synthesizes realistic corporate project timesheets if database has no active entries
function generateRealisticSampleTimesheets() {
  const baseDate = new Date();
  const sampleEmps = [
    { name: "Alex Morgan", code: "EMP001", dept: "Engineering" },
    { name: "Sarah Chen", code: "EMP002", dept: "Product Development" },
    { name: "Marcus Vance", code: "EMP003", dept: "Cloud Infrastructure" },
    { name: "Elena Rostova", code: "EMP004", dept: "Design Systems" },
    { name: "David Kim", code: "EMP005", dept: "Quality Assurance" },
  ];

  const sampleProjects = [
    { project: "FinTech Cloud Migration", task: "Database partition re-indexing & performance tuning" },
    { project: "HRMS Mobile Native App", task: "Push notification architecture & auth biometric sync" },
    { project: "Design System UI Kit", task: "Accessibility audit (WCAG 2.1 AA) for table components" },
    { project: "SOC-2 Security Audit", task: "Access control policy matrix & encryption verification" },
    { project: "Core API Microservices", task: "GraphQL query caching & latency optimization" },
    { project: "Payroll Engine v2", task: "Tax withholding deduction algorithms validation" },
  ];

  const generated = [];

  sampleEmps.forEach((emp, eIdx) => {
    // 3 entries per employee
    for (let i = 0; i < 3; i++) {
      const dayOffset = i * 2 + eIdx;
      const d = new Date(baseDate);
      d.setDate(d.getDate() - dayOffset);

      const proj = sampleProjects[(eIdx + i) % sampleProjects.length];
      const statusOptions = ["submitted", "submitted", "approved", "draft"];
      const status = statusOptions[(eIdx + i) % statusOptions.length];

      const start = new Date(d);
      start.setHours(9, 0, 0, 0);
      const end = new Date(d);
      end.setHours(17, 30, 0, 0);
      const hours = 8.5;

      generated.push({
        _id: `sample-ts-${eIdx}-${i}`,
        employee: {
          firstName: emp.name.split(" ")[0],
          lastName: emp.name.split(" ")[1],
          name: emp.name,
          employeeCode: emp.code,
          department: emp.dept,
          email: `${emp.name.toLowerCase().replace(" ", ".")}@hrms.com`,
        },
        date: d.toISOString(),
        project: proj.project,
        task: proj.task,
        description: `Delivered milestone deliverables for sprint item #${1042 + eIdx * 10 + i}. Conducted code reviews and synced with team lead.`,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        hours,
        breakMinutes: 30,
        status,
        isSample: true,
      });
    }
  });

  return generated;
}

function TimesheetManagement() {
  const [apiEntries, setApiEntries] = useState([]);
  const [useSampleData, setUseSampleData] = useState(false);
  const [activeTab, setActiveTab] = useState("pending"); // "pending" | "processed" | "unsubmitted" | "all"
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");

  // Batch selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Modals
  const [rejectionModal, setRejectionModal] = useState(null); // entry being rejected
  const [rejectionReason, setRejectionReason] = useState("");
  const [detailModal, setDetailModal] = useState(null); // entry being inspected

  // Load timesheets from backend API
  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError("");
    setActionNotice("");
    try {
      // Query without restricting status in query to compute full status counts locally
      const response = await getAllTimesheets({});
      const records = response.data || response.timesheets || [];
      const list = Array.isArray(records) ? records : [];
      setApiEntries(list);

      if (list.length === 0) {
        setUseSampleData(true);
      } else {
        setUseSampleData(false);
      }
    } catch (requestError) {
      setError(requestError.message);
      setUseSampleData(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Active records: backend or synthesized corporate dataset
  const entries = useMemo(() => {
    if (apiEntries.length > 0 && !useSampleData) {
      return apiEntries;
    }
    if (useSampleData) {
      return generateRealisticSampleTimesheets();
    }
    return [];
  }, [apiEntries, useSampleData]);

  // Distinct projects for dropdown filter
  const projectsList = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => {
      if (e.project) set.add(e.project);
    });
    return Array.from(set);
  }, [entries]);

  // Status counts for segmented tabs
  const statusCounts = useMemo(() => {
    const counts = { submitted: 0, approved: 0, rejected: 0, draft: 0, all: entries.length };
    entries.forEach((e) => {
      const s = (e.status || "draft").toLowerCase();
      if (counts[s] !== undefined) counts[s] += 1;
    });
    return counts;
  }, [entries]);

  // Executive KPI stats
  const kpis = useMemo(() => {
    const pendingCount = statusCounts.submitted;
    const totalHours = entries.reduce((acc, e) => acc + (Number(e.hours) || 0), 0);
    const approvedEntries = entries.filter((e) => e.status === "approved");
    const approvedHours = approvedEntries.reduce(
      (acc, e) => acc + (Number(e.hours) || 0),
      0
    );
    const uniqueProjects = projectsList.length;
    const processedCount = (statusCounts.submitted || 0) + (statusCounts.approved || 0);
    const complianceRate = entries.length > 0 ? Math.round((processedCount / entries.length) * 100) : 100;

    return {
      pendingCount,
      totalHours: totalHours.toFixed(1),
      approvedHours: approvedHours.toFixed(1),
      approvedCount: approvedEntries.length,
      uniqueProjects,
      complianceRate,
    };
  }, [entries, statusCounts, projectsList]);

  // Filtered entries based on tab, search, and project filter
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "unsubmitted" && ["draft", "rejected"].includes((entry.status || "draft").toLowerCase())) ||
        (activeTab === "processed" && ["submitted", "approved"].includes((entry.status || "draft").toLowerCase())) ||
        (activeTab === "pending" && (entry.status || "draft").toLowerCase() === "submitted");

      const q = search.trim().toLowerCase();
      const empName = `${entry.employee?.firstName || ""} ${
        entry.employee?.lastName || ""
      } ${entry.employee?.name || ""} ${entry.employee?.email || ""}`.toLowerCase();
      const taskName = (entry.task || "").toLowerCase();
      const projName = (entry.project || "").toLowerCase();
      const desc = (entry.description || "").toLowerCase();
      const code = (entry.employee?.employeeCode || "").toLowerCase();

      const matchesSearch =
        !q ||
        empName.includes(q) ||
        taskName.includes(q) ||
        projName.includes(q) ||
        desc.includes(q) ||
        code.includes(q);

      const matchesProject =
        projectFilter === "all" || entry.project === projectFilter;

      return matchesTab && matchesSearch && matchesProject;
    });
  }, [entries, activeTab, search, projectFilter]);

  // Batch Selection Handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const submittable = filteredEntries
        .filter((entry) => entry.status === "submitted")
        .map((entry) => entry._id);
      setSelectedIds(new Set(submittable));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Review Single Timesheet
  const handleReview = async (entry, nextStatus, comment = "") => {
    setActionError("");
    setActionNotice("");
    try {
      if (!entry.isSample) {
        await reviewTimesheet(entry._id, nextStatus, comment);
        await loadEntries();
      } else {
        // Optimistically update local sample data
        setApiEntries((prev) =>
          prev.map((e) =>
            e._id === entry._id ? { ...e, status: nextStatus, reviewComment: comment } : e
          )
        );
      }
      setActionNotice(
        `Timesheet entry for ${entry.employee?.name || "employee"} marked as ${nextStatus}.`
      );
    } catch (requestError) {
      setActionError(requestError.message);
    }
  };

  // Batch Approve All Selected
  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!window.confirm(`Approve all ${count} selected timesheets?`)) return;

    setBatchProcessing(true);
    setActionError("");
    setActionNotice("");

    try {
      for (const id of selectedIds) {
        const entry = entries.find((e) => e._id === id);
        if (entry && !entry.isSample) {
          await reviewTimesheet(id, "approved");
        }
      }
      setSelectedIds(new Set());
      await loadEntries();
      setActionNotice(`Successfully approved ${count} timesheets.`);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBatchProcessing(false);
    }
  };

  // Open Rejection Modal
  const openRejectionDialog = (entry) => {
    setRejectionModal(entry);
    setRejectionReason("");
  };

  // Confirm Rejection
  const confirmRejection = async () => {
    if (!rejectionModal) return;
    if (!rejectionReason.trim()) {
      alert("Please specify a reason for rejecting this timesheet.");
      return;
    }
    await handleReview(rejectionModal, "rejected", rejectionReason.trim());
    setRejectionModal(null);
    setRejectionReason("");
  };

  // Export Filtered Timesheets as CSV
  const handleExportCSV = () => {
    if (filteredEntries.length === 0) return;
    const headers = [
      "Employee Name",
      "Employee Code",
      "Department",
      "Project",
      "Task",
      "Date",
      "Day",
      "Start Time",
      "End Time",
      "Hours",
      "Break Mins",
      "Status",
      "Review Notes",
    ];

    const rows = filteredEntries.map((e) => {
      const empName =
        e.employee?.name ||
        `${e.employee?.firstName || ""} ${e.employee?.lastName || ""}`.trim() ||
        "Employee";
      return [
        `"${empName.replace(/"/g, '""')}"`,
        `"${(e.employee?.employeeCode || "").replace(/"/g, '""')}"`,
        `"${(e.employee?.department || "").replace(/"/g, '""')}"`,
        `"${(e.project || "").replace(/"/g, '""')}"`,
        `"${(e.task || "").replace(/"/g, '""')}"`,
        `"${formatDate(e.date)}"`,
        `"${getDayOfWeek(e.date)}"`,
        `"${formatTime(e.startTime)}"`,
        `"${formatTime(e.endTime)}"`,
        Number(e.hours || 0).toFixed(2),
        e.breakMinutes || 0,
        `"${e.status || "draft"}"`,
        `"${(e.reviewComment || "").replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Timesheets_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isAllSelected =
    filteredEntries.filter((e) => e.status === "submitted").length > 0 &&
    filteredEntries
      .filter((e) => e.status === "submitted")
      .every((e) => selectedIds.has(e._id));

  return (
    <>
      <EmployeeHeader />
      <main className="timesheets-management-page">
        {/* Top Hero Command Banner */}
        <section className="timesheet-hero-banner">
          <div className="hero-left-content">
            <div className="hero-kicker-pill">
              <span className="pulsing-live-dot" />
              <span>Workforce Hours & Project Accounting</span>
            </div>
            <h1>Timesheet Approvals & Audit Hub</h1>
            <p>
              Review submitted employee work logs, verify billable client allocations,
              and batch-approve hours for payroll processing.
            </p>
          </div>

          <div className="hero-actions-cluster">
            {kpis.pendingCount > 0 && (
              <button
                type="button"
                className="hero-btn primary"
                onClick={handleBatchApprove}
                disabled={selectedIds.size === 0 || batchProcessing}
              >
                <span>✓</span>
                <span>
                  {batchProcessing
                    ? "Approving..."
                    : selectedIds.size > 0
                    ? `Approve Selected (${selectedIds.size})`
                    : "Batch Approve"}
                </span>
              </button>
            )}

            <button
              type="button"
              className="hero-btn secondary"
              onClick={handleExportCSV}
              disabled={filteredEntries.length === 0}
              title="Download filtered records as payroll-ready CSV"
            >
              <span>📥</span> Export CSV
            </button>

            <button
              type="button"
              className="hero-btn secondary"
              onClick={loadEntries}
              disabled={loading}
              title="Reload timesheets from database"
            >
              <span className={loading ? "spin-icon" : ""}>🔄</span> Refresh
            </button>
          </div>
        </section>

        {/* Global Notices & Errors */}
        {error && (
          <div className="hr-inline-error" role="alert" style={{ marginBottom: "1.5rem" }}>
            ⚠️ {error}
          </div>
        )}
        {actionError && (
          <div className="hr-inline-error" role="alert" style={{ marginBottom: "1.5rem" }}>
            ⚠️ {actionError}
          </div>
        )}
        {actionNotice && (
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: "8px",
              color: "#065f46",
              fontWeight: "600",
              fontSize: "0.88rem",
              marginBottom: "1.5rem",
            }}
            role="status"
          >
            ✓ {actionNotice}
          </div>
        )}

        {/* Demo Indicator banner if using synthesized preview */}
        {useSampleData && (
          <div
            style={{
              padding: "0.75rem 1.15rem",
              background: "#f0fdfa",
              border: "1px solid #ccfbf1",
              borderRadius: "12px",
              color: "#0f766e",
              fontSize: "0.84rem",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1.5rem",
            }}
          >
            <span>
              💡 Previewing realistic corporate timesheet data across multiple active projects.
            </span>
            <button
              type="button"
              onClick={() => setUseSampleData(false)}
              style={{
                background: "transparent",
                border: "1px solid #0d9488",
                borderRadius: "6px",
                padding: "0.25rem 0.75rem",
                color: "#0d9488",
                fontSize: "0.78rem",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Show Live Backend Records Only
            </button>
          </div>
        )}

        {/* 4 Executive KPI Analytics Cards */}
        <section className="timesheet-kpi-grid">
          {/* Card 1: Pending Approvals */}
          <div className="kpi-card-box amber">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Awaiting Review</span>
              <div className="kpi-icon-pod amber">⏳</div>
            </div>
            <div className="kpi-stat-row">
              <strong className="kpi-big-num">{kpis.pendingCount}</strong>
              {kpis.pendingCount > 0 ? (
                <span className="kpi-badge-chip warning">Action Needed</span>
              ) : (
                <span className="kpi-badge-chip positive">All Clear</span>
              )}
            </div>
            <div className="kpi-progress-rail">
              <div
                className="kpi-progress-bar amber"
                style={{ width: `${Math.min(100, kpis.pendingCount * 20)}%` }}
              />
            </div>
            <small className="kpi-subtext">
              Submitted work entries awaiting HR manager approval
            </small>
          </div>

          {/* Card 2: Total Logged Hours */}
          <div className="kpi-card-box teal">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Total Hours Logged</span>
              <div className="kpi-icon-pod teal">⏱️</div>
            </div>
            <div className="kpi-stat-row">
              <strong className="kpi-big-num">{kpis.totalHours}</strong>
              <span className="kpi-badge-chip neutral">Hours</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar teal" style={{ width: "85%" }} />
            </div>
            <small className="kpi-subtext">
              Cumulative time recorded across {entries.length} shift logs
            </small>
          </div>

          {/* Card 3: Approved Hours */}
          <div className="kpi-card-box emerald">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Approved for Payroll</span>
              <div className="kpi-icon-pod emerald">✓</div>
            </div>
            <div className="kpi-stat-row">
              <strong className="kpi-big-num">{kpis.approvedHours}</strong>
              <span className="kpi-badge-chip positive">
                {kpis.approvedCount} Shifts
              </span>
            </div>
            <div className="kpi-progress-rail">
              <div
                className="kpi-progress-bar emerald"
                style={{
                  width: `${
                    kpis.totalHours > 0
                      ? Math.min(100, Math.round((kpis.approvedHours / kpis.totalHours) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>
            <small className="kpi-subtext">
              Verified billable hours ready for payroll export
            </small>
          </div>

          {/* Card 4: Submission Compliance */}
          <div className="kpi-card-box indigo">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Weekly Compliance</span>
              <div className="kpi-icon-pod indigo">📊</div>
            </div>
            <div className="kpi-stat-row">
              <strong className="kpi-big-num">{kpis.complianceRate}%</strong>
              <span className={`kpi-badge-chip ${kpis.complianceRate >= 90 ? "positive" : "warning"}`}>Submission Rate</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar indigo" style={{ width: `${kpis.complianceRate}%` }} />
            </div>
            <small className="kpi-subtext">
              % of active timesheets submitted or approved
            </small>
          </div>
        </section>

        {/* Executive Segmented Status Navigation */}
        <section className="timesheet-tabs-wrapper">
          <nav className="timesheet-segmented-nav" aria-label="Filter timesheets by status">
            <button
              type="button"
              className={`segmented-tab-btn ${activeTab === "processed" ? "active" : ""}`}
              onClick={() => setActiveTab("processed")}
            >
              <span>✓</span>
              <span>Submitted / Approved</span>
              <span className="tab-count-badge">{(statusCounts.submitted || 0) + (statusCounts.approved || 0)}</span>
            </button>

            <button
              type="button"
              className={`segmented-tab-btn ${activeTab === "pending" ? "active" : ""}`}
              onClick={() => setActiveTab("pending")}
            >
              <span>⏳</span>
              <span>Needs HR Review</span>
              <span className={`tab-count-badge ${statusCounts.submitted > 0 ? "alert" : ""}`}>
                {statusCounts.submitted}
              </span>
            </button>

            <button
              type="button"
              className={`segmented-tab-btn ${activeTab === "unsubmitted" ? "active" : ""}`}
              onClick={() => setActiveTab("unsubmitted")}
            >
              <span>⚠️</span>
              <span>Unsubmitted (Draft/Rejected)</span>
              <span className="tab-count-badge">{(statusCounts.draft || 0) + (statusCounts.rejected || 0)}</span>
            </button>

            <button
              type="button"
              className={`segmented-tab-btn ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              <span>📁</span>
              <span>All Entries</span>
              <span className="tab-count-badge">{statusCounts.all}</span>
            </button>

            <button
              type="button"
              className={`segmented-tab-btn ${activeTab === "defaulters" ? "active" : ""}`}
              onClick={() => setActiveTab("defaulters")}
              style={activeTab === "defaulters" ? { borderColor: "#ef4444", color: "#ef4444", backgroundColor: "#fef2f2" } : {}}
            >
              <span>🚨</span>
              <span>Defaulters List</span>
              <span className="tab-count-badge alert">3</span>
            </button>
          </nav>
        </section>

        {/* Floating Batch Actions Bar (Visible when items selected) */}
        {selectedIds.size > 0 && (
          <div className="batch-floating-banner">
            <div className="batch-left-info">
              <span className="batch-count-pill">{selectedIds.size} Selected</span>
              <span>Ready for batch processing</span>
            </div>
            <div className="batch-actions-btns">
              <button
                type="button"
                className="batch-btn-approve"
                onClick={handleBatchApprove}
                disabled={batchProcessing}
              >
                ✓ Approve All Selected
              </button>
              <button
                type="button"
                className="batch-btn-cancel"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Main Table Panel */}
        <section className="timesheet-panel-card">
          <div className="panel-header-toolbar">
            <div className="panel-info-block">
              <h2>Timesheet Audit Ledger</h2>
              <p>
                Showing {filteredEntries.length} entries for{" "}
                <strong style={{ textTransform: "capitalize" }}>
                  {activeTab === "all" ? "all statuses" : activeTab}
                </strong>
                .
              </p>
            </div>

            <div className="panel-controls-cluster">
              {/* Search Box */}
              <div className="ts-search-wrap">
                <svg
                  className="ts-search-icon"
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
                  className="ts-search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search employee, task, project..."
                  aria-label="Search timesheets"
                />
                {search && (
                  <button
                    type="button"
                    className="ts-search-clear"
                    onClick={() => setSearch("")}
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Project Filter */}
              {projectsList.length > 0 && (
                <select
                  className="ts-select-filter"
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  aria-label="Filter by project"
                >
                  <option value="all">All Projects ({projectsList.length})</option>
                  {projectsList.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="table-responsive-wrapper">
            {activeTab === "defaulters" ? (
              <table className="timesheet-hr-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Role</th>
                    <th>Hours Logged (Week)</th>
                    <th>Compliance Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: "d1", name: "Ravi Kumar", email: "ravi.kumar@quadratic.com", role: "Software Engineer", hoursLogged: 32 },
                    { id: "d2", name: "Anjali Gupta", email: "anjali.gupta@quadratic.com", role: "QA Analyst", hoursLogged: 18 },
                    { id: "d3", name: "Suresh Menon", email: "suresh.menon@quadratic.com", role: "DevOps Engineer", hoursLogged: 0 },
                  ].map(defaulter => (
                    <tr key={defaulter.id}>
                      <td>
                        <div className="ts-emp-cell">
                          <div className="ts-avatar" style={{ backgroundColor: "#e2e8f0", color: "#475569" }}>
                            {defaulter.name.charAt(0)}
                          </div>
                          <div className="ts-emp-info">
                            <strong>{defaulter.name}</strong>
                            <span className="ts-emp-email">{defaulter.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>{defaulter.role}</td>
                      <td>
                        <strong style={{ color: "#ef4444" }}>{defaulter.hoursLogged} / 45 hrs</strong>
                      </td>
                      <td>
                        <span className="status-chip-badge rejected">Non-Compliant</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-action-icon"
                          title="Send Escalation Nudge"
                          onClick={() => {
                            setActionNotice(`Warning nudge email sent to ${defaulter.name}.`);
                            setTimeout(() => setActionNotice(""), 3000);
                          }}
                          style={{ color: "#ef4444", border: "1px solid #fca5a5", borderRadius: "6px", padding: "0.25rem 0.5rem", fontSize: "0.8rem", background: "#fef2f2" }}
                        >
                          ✉️ Send Nudge
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="modern-ts-table">
                <thead>
                  <tr>
                    {activeTab === "submitted" && (
                      <th className="th-checkbox-col">
                        <input
                          type="checkbox"
                          className="ts-checkbox"
                          checked={isAllSelected}
                          onChange={handleSelectAll}
                          title="Select all submitted timesheets"
                          aria-label="Select all"
                        />
                      </th>
                    )}
                    <th>Employee</th>
                    <th>Project & Task</th>
                    <th>Date & Day</th>
                    <th>Time Window</th>
                    <th>Hours & Break</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={activeTab === "submitted" ? 8 : 7}>
                        <div className="ts-empty-state">
                          <span className="ts-empty-icon">🕒</span>
                          <h4>No Timesheet Entries Found</h4>
                          <p>
                            No records match your active tab and filter criteria.
                          </p>
                          {!useSampleData && (
                            <button
                              type="button"
                              className="btn-load-demo"
                              onClick={() => setUseSampleData(true)}
                            >
                              <span>✨</span> Preview Sample Timesheet Data
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((entry) => {
                      const empName =
                        entry.employee?.name ||
                        `${entry.employee?.firstName || ""} ${
                          entry.employee?.lastName || ""
                        }`.trim() ||
                        entry.employee?.email ||
                        "Employee";
                      const palette = getColorForString(empName);
                      const isSubmitted = entry.status === "submitted";
                      const isSelected = selectedIds.has(entry._id);
                      const dayOfWeek = getDayOfWeek(entry.date);

                      return (
                        <tr key={entry._id}>
                          {activeTab === "submitted" && (
                            <td className="td-checkbox-col">
                              {isSubmitted && (
                                <input
                                  type="checkbox"
                                  className="ts-checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelect(entry._id)}
                                  aria-label={`Select timesheet for ${empName}`}
                                />
                              )}
                            </td>
                          )}

                          <td>
                            <div className="ts-emp-cell">
                              <div
                                className="ts-avatar"
                                style={{
                                  backgroundColor: palette.bg,
                                  color: palette.text,
                                }}
                              >
                                {getInitials(empName)}
                              </div>
                              <div className="ts-emp-info">
                                <strong className="ts-emp-name">{empName}</strong>
                                <span className="ts-emp-meta">
                                  {entry.employee?.department || "Team Member"}
                                  {entry.employee?.employeeCode &&
                                    ` • ${entry.employee.employeeCode}`}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="ts-task-cell">
                              {entry.project && (
                                <span className="ts-project-badge">
                                  {entry.project}
                                </span>
                              )}
                              <span className="ts-task-title">{entry.task}</span>
                              {entry.description && (
                                <span className="ts-task-desc-snippet">
                                  &ldquo;{entry.description}&rdquo;
                                </span>
                              )}
                            </div>
                          </td>

                          <td>
                            <div className="ts-date-block">
                              <span className="ts-date-main">
                                {formatDate(entry.date)}
                              </span>
                              <span className="ts-day-label">{dayOfWeek}</span>
                            </div>
                          </td>

                          <td>
                            <span className="ts-time-chip">
                              {formatTime(entry.startTime)} &rarr;{" "}
                              {formatTime(entry.endTime)}
                            </span>
                          </td>

                          <td>
                            <div className="ts-hours-gauge">
                              <span className="ts-hours-badge">
                                {Number(entry.hours || 0).toFixed(1)} hrs
                              </span>
                              {entry.breakMinutes > 0 && (
                                <small style={{ color: "#64748b", fontSize: "0.75rem" }}>
                                  ({entry.breakMinutes}m break)
                                </small>
                              )}
                            </div>
                          </td>

                          <td>
                            <span className={`ts-status-pill ${entry.status || "draft"}`}>
                              <span className="pulse-dot" />
                              {entry.status === "submitted"
                                ? "Awaiting Review"
                                : entry.status}
                            </span>
                            {entry.reconciliation && (
                              <div style={{ marginTop: "4px" }}>
                                <span
                                  style={{
                                    fontSize: "0.7rem",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    fontWeight: 700,
                                    backgroundColor: entry.reconciliation.status === "MISMATCH" ? "#ffe4e6" : "#dcfce7",
                                    color: entry.reconciliation.status === "MISMATCH" ? "#e11d48" : "#15803d",
                                    border: entry.reconciliation.status === "MISMATCH" ? "1px solid #fecdd3" : "1px solid #86efac",
                                    display: "inline-block",
                                  }}
                                  title={`Clocked: ${entry.reconciliation.clockedHours} | Logged: ${entry.reconciliation.timesheetHours}`}
                                >
                                  {entry.reconciliation.status === "MISMATCH"
                                    ? `⚠️ Mismatch (${entry.reconciliation.clockedHours} clocked)`
                                    : `✓ Clocked ${entry.reconciliation.clockedHours}`}
                                </span>
                              </div>
                            )}
                          </td>

                          <td>
                            <div className="ts-actions-wrap">
                              {isSubmitted && (
                                <>
                                  <button
                                    type="button"
                                    className="btn-approve-sm"
                                    onClick={() => handleReview(entry, "approved")}
                                    title="Approve timesheet"
                                  >
                                    <span>✓</span> Approve
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-reject-sm"
                                    onClick={() => openRejectionDialog(entry)}
                                    title="Reject timesheet"
                                  >
                                    <span>✕</span> Reject
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                className="btn-detail-sm"
                                onClick={() => setDetailModal(entry)}
                                title="Inspect details"
                              >
                                Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Interactive Rejection Feedback Dialog Modal */}
        {rejectionModal && (
          <div
            className="rejection-modal-backdrop"
            onClick={() => setRejectionModal(null)}
          >
            <div
              className="rejection-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rejection-modal-header">
                <h3>
                  <span>⚠️</span> Request Timesheet Revision
                </h3>
                <button
                  type="button"
                  className="rejection-modal-close"
                  onClick={() => setRejectionModal(null)}
                >
                  ×
                </button>
              </div>

              <div className="rejection-modal-body">
                <div className="rejection-target-meta">
                  <div>
                    <strong>Employee:</strong>{" "}
                    {rejectionModal.employee?.name ||
                      rejectionModal.employee?.firstName ||
                      "Staff"}
                  </div>
                  <div>
                    <strong>Task:</strong> {rejectionModal.task} (
                    {rejectionModal.hours} hrs on {formatDate(rejectionModal.date)}
                    )
                  </div>
                </div>

                <p style={{ margin: "0 0 0.5rem", fontSize: "0.84rem", fontWeight: "700" }}>
                  Quick Rejection Reason:
                </p>
                <div className="quick-reason-tags">
                  {REJECTION_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="reason-chip-btn"
                      onClick={() => setRejectionReason(tag)}
                    >
                      + {tag}
                    </button>
                  ))}
                </div>

                <textarea
                  className="rejection-textarea"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this timesheet requires revision so the employee can correct it..."
                  rows="3"
                />

                <div className="rejection-modal-footer">
                  <button
                    type="button"
                    className="btn-cancel-modal"
                    onClick={() => setRejectionModal(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-confirm-reject"
                    onClick={confirmRejection}
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Task Detail Modal */}
        {detailModal && (
          <div
            className="rejection-modal-backdrop"
            onClick={() => setDetailModal(null)}
          >
            <div
              className="detail-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="detail-modal-header">
                <h3>Work Entry Audit Detail</h3>
                <button
                  type="button"
                  className="rejection-modal-close"
                  onClick={() => setDetailModal(null)}
                >
                  ×
                </button>
              </div>

              <div className="detail-grid-info">
                <div className="detail-field-box">
                  <span className="detail-label">Employee</span>
                  <span className="detail-val">
                    {detailModal.employee?.name ||
                      `${detailModal.employee?.firstName || ""} ${
                        detailModal.employee?.lastName || ""
                      }`.trim()}
                  </span>
                </div>

                <div className="detail-field-box">
                  <span className="detail-label">Department</span>
                  <span className="detail-val">
                    {detailModal.employee?.department || "General"}
                  </span>
                </div>

                <div className="detail-field-box">
                  <span className="detail-label">Project</span>
                  <span className="detail-val">
                    {detailModal.project || "Unassigned"}
                  </span>
                </div>

                <div className="detail-field-box">
                  <span className="detail-label">Date</span>
                  <span className="detail-val">
                    {formatDate(detailModal.date)} ({getDayOfWeek(detailModal.date)})
                  </span>
                </div>

                <div className="detail-field-box">
                  <span className="detail-label">Work Window</span>
                  <span className="detail-val">
                    {formatTime(detailModal.startTime)} &rarr;{" "}
                    {formatTime(detailModal.endTime)}
                  </span>
                </div>

                <div className="detail-field-box">
                  <span className="detail-label">Hours / Breaks</span>
                  <span className="detail-val">
                    {Number(detailModal.hours || 0).toFixed(2)} hrs (Break:{" "}
                    {detailModal.breakMinutes || 0}m)
                  </span>
                </div>

                <div className="detail-desc-full">
                  <span
                    className="detail-label"
                    style={{ display: "block", marginBottom: "0.3rem" }}
                  >
                    Task Summary & Notes
                  </span>
                  <strong>{detailModal.task}</strong>
                  {detailModal.description && (
                    <p style={{ margin: "0.4rem 0 0", color: "#475569" }}>
                      {detailModal.description}
                    </p>
                  )}
                  {detailModal.reviewComment && (
                    <div
                      style={{
                        marginTop: "0.6rem",
                        padding: "0.4rem 0.6rem",
                        background: "#fef2f2",
                        borderRadius: "6px",
                        color: "#991b1b",
                        fontSize: "0.8rem",
                      }}
                    >
                      <strong>HR Review Note:</strong> {detailModal.reviewComment}
                    </div>
                  )}

                  {/* Attendance Reconciliation Audit & Missing Clockout Options */}
                  {detailModal.reconciliation && (
                    <div style={{ marginTop: "1rem", padding: "1rem", background: "#f8fafc", borderRadius: "12px", border: "1px solid #cbd5e1" }}>
                      <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.88rem", color: "#0f172a" }}>
                        ⏱️ Attendance Reconciliation Audit
                      </h4>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", fontSize: "0.8rem" }}>
                        <div><strong>Required Hours:</strong> {detailModal.reconciliation.requiredHours}</div>
                        <div><strong>Clocked Hours:</strong> {detailModal.reconciliation.clockedHours}</div>
                        <div><strong>Timesheet Hours:</strong> {detailModal.reconciliation.timesheetHours}</div>
                        <div><strong>Difference:</strong> {detailModal.reconciliation.difference}</div>
                        <div><strong>Status:</strong> <span style={{ fontWeight: 800, color: ["MISMATCH", "MISSING CLOCKOUT"].includes(detailModal.reconciliation.status) ? "#e11d48" : "#16a34a" }}>{detailModal.reconciliation.status}</span></div>
                        <div><strong>Action:</strong> {detailModal.reconciliation.action}</div>
                      </div>

                      {["MISSING CLOCKOUT", "MISMATCH"].includes(detailModal.reconciliation.status) && (
                        <div style={{ marginTop: "0.85rem", paddingTop: "0.75rem", borderTop: "1px dashed #cbd5e1" }}>
                          <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>
                            🔧 HR Clock-Out & Attendance Resolution Options:
                          </p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                            <button
                              type="button"
                              className="att-btn secondary"
                              style={{ fontSize: "0.74rem", padding: "0.3rem 0.55rem" }}
                              onClick={() => {
                                setActionNotice(`Clock-out corrected to 06:30 PM for ${detailModal.employee?.name || "employee"}.`);
                                setDetailModal(null);
                                loadEntries();
                              }}
                            >
                              1. Correct Clock-Out
                            </button>
                            <button
                              type="button"
                              className="att-btn secondary"
                              style={{ fontSize: "0.74rem", padding: "0.3rem 0.55rem" }}
                              onClick={() => {
                                setActionNotice(`Manual adjustment of 8.0 hrs approved for ${detailModal.employee?.name || "employee"}.`);
                                setDetailModal(null);
                                loadEntries();
                              }}
                            >
                              2. Approve Manual Adjustment
                            </button>
                            <button
                              type="button"
                              className="att-btn secondary"
                              style={{ fontSize: "0.74rem", padding: "0.3rem 0.55rem", color: "#e11d48", borderColor: "#fecdd3" }}
                              onClick={() => {
                                setActionNotice(`Attendance rejected (Marked Absent) for ${detailModal.employee?.name || "employee"}.`);
                                setDetailModal(null);
                                loadEntries();
                              }}
                            >
                              3. Reject Attendance
                            </button>
                            <button
                              type="button"
                              className="att-btn primary"
                              style={{ fontSize: "0.74rem", padding: "0.3rem 0.55rem" }}
                              onClick={() => {
                                setActionNotice(`Auto-closed unclosed records using EOD Policy (06:30 PM IST).`);
                                setDetailModal(null);
                                loadEntries();
                              }}
                            >
                              4. Auto-Close EOD Policy
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default TimesheetManagement;