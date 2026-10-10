import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import Loader from "../../components/common/Loader";
import ErrorMessage from "../../components/common/ErrorMessage";
import { useLeaves } from "../../hooks/useLeaves";
import { useEmployee } from "../../hooks/useEmployee";
import { formatDate } from "../../utils/date";
import WeekdayDatePicker from "../../components/common/WeekdayDatePicker";
import "../../styles/employee/leaves.css";

function isWeekend(dateStr) {
  if (!dateStr) return false;
  const str = String(dateStr).slice(0, 10);
  const parts = str.split("-");
  if (parts.length !== 3) return false;
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  const day = d.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

function calculateDays(start, end) {
  if (!start || !end) return 0;
  const sParts = String(start).slice(0, 10).split("-");
  const eParts = String(end).slice(0, 10).split("-");
  if (sParts.length !== 3 || eParts.length !== 3) return 0;

  let current = new Date(parseInt(sParts[0], 10), parseInt(sParts[1], 10) - 1, parseInt(sParts[2], 10));
  const endDate = new Date(parseInt(eParts[0], 10), parseInt(eParts[1], 10) - 1, parseInt(eParts[2], 10));

  if (isNaN(current.getTime()) || isNaN(endDate.getTime()) || endDate < current) return 0;

  let workingDays = 0;
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }
  return workingDays;
}

// ----------------------------------------------------------------------------
// Enterprise Data Constants
// ----------------------------------------------------------------------------
const REAL_LEAVE_TYPES = [
  { id: "earned", code: "EL", name: "Earned / Privilege Leave", available: 12, total: 15, accrual: "1.25 days/mo" },
  { id: "casual", code: "CL", name: "Casual Leave", available: 4, total: 6, accrual: "0.50 days/mo" },
  { id: "sick", code: "SL", name: "Sick / Medical Leave", available: 6, total: 8, accrual: "Annual grant" },
  { id: "optional", code: "OH", name: "Optional Festival Holiday", available: 1, total: 2, accrual: "Gazetted calendar" },
];

const WFH_REASONS = [
  "Deep Focus Sprint / Complex Feature Coding",
  "Personal Commitment / Home Utility Service",
  "Mild Health Indisposition (Fit to Work Remotely)",
  "Commute / Transit Disruption / Weather Advisory",
  "Family / Dependent Care Commitment",
  "Distributed Cross-Timezone Collaboration",
  "Other Planned Project Deliverable",
];

const WFH_SESSION_TYPES = [
  { id: "full", label: "Full Day", hoursText: "8.0 Hours", timeText: "09:30 AM – 06:30 PM IST", costPerDay: 1 },
  { id: "first_half", label: "First Half", hoursText: "4.0 Hours", timeText: "09:30 AM – 01:30 PM IST", costPerDay: 0.5 },
  { id: "second_half", label: "Second Half", hoursText: "4.0 Hours", timeText: "02:00 PM – 06:30 PM IST", costPerDay: 0.5 },
];

function EmployeeLeaves() {
  const {
    leaves,
    leaveTypes,
    balance,
    loading,
    error,
    submitLeave,
    updateExistingLeave,
    deleteExistingLeave,
  } = useLeaves();
  const { employee } = useEmployee();

  const [searchParams] = useSearchParams();
  const isWfhInitial = searchParams.get("tab") === "wfh" || searchParams.get("type") === "wfh";
  const [requestMode, setRequestMode] = useState(isWfhInitial ? "wfh" : "leave");
  const [historyFilter, setHistoryFilter] = useState("all");

  // --------------------------------------------------------------------------
  // Form State: Standard Leave / Time Off
  // --------------------------------------------------------------------------
  const [leaveForm, setLeaveForm] = useState({
    leaveType: "",
    startDate: "",
    endDate: "",
    reason: "",
    emergencyContact: "",
  });

  // --------------------------------------------------------------------------
  // Form State: Work From Home (WFH)
  // --------------------------------------------------------------------------
  const [wfhForm, setWfhForm] = useState({
    startDate: "",
    endDate: "",
    reasonCategory: WFH_REASONS[0],
    sessionType: "full",
    deliverables: "",
    emergencyContact: "+91 98490 11223",
    broadbandChecked: true,
    teamsChecked: true,
  });

  const [submitError, setSubmitError] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Modal states for Editing & Deleting pending requests
  const [editingLeave, setEditingLeave] = useState(null);
  const [deletingLeave, setDeletingLeave] = useState(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Leave types list (dynamically mapped from backend isolated user balance)
  const typesToRender = useMemo(() => {
    if (balance && balance.length > 0) {
      return balance.map((b) => ({
        id: b.leaveType?.id || b.leaveType?._id || b.leaveType?.code,
        code: b.leaveType?.code || "LV",
        name: b.leaveType?.name || "Leave",
        available: Number(b.available ?? 0),
        total: Number(b.annualAllocation ?? b.annual_allocation ?? 12),
        accrual: `${b.used || 0} used, ${b.pending || 0} pending`,
      }));
    }
    if (leaveTypes && leaveTypes.length > 0) {
      return leaveTypes
        .filter((t) => t.id !== "wfh" && t.code !== "WFH")
        .map((t) => {
          const match = REAL_LEAVE_TYPES.find((d) => d.id === t.id || d.name === t.name);
          const annualAlloc = Number(t.annualAllocation ?? t.annual_allocation ?? t.total ?? match?.total ?? 12);
          return {
            id: t.id || t._id || t.code,
            code: t.code || match?.code || "LV",
            name: t.name || match?.name || "Leave",
            available: Number(t.available ?? annualAlloc),
            total: annualAlloc,
            accrual: match?.accrual || "Standard policy",
          };
        });
    }
    return REAL_LEAVE_TYPES;
  }, [balance, leaveTypes]);

  // Local requests list (strictly scoped to user's logged-in records)
  const [localLeaves, setLocalLeaves] = useState([]);

  // Sync user leaves from backend API into local state
  useEffect(() => {
    if (Array.isArray(leaves)) {
      const formatted = leaves.map((l) => ({
        id: l._id || l.id,
        isWfh: l.leaveType?.code === "WFH" || l.leaveType?.name?.includes("Work From Home"),
        type: l.leaveType?.name || l.type || "Leave",
        leaveTypeId: l.leaveType?._id || l.leaveType,
        startDate: l.startDate ? String(l.startDate).slice(0, 10) : "",
        endDate: l.endDate ? String(l.endDate).slice(0, 10) : "",
        duration: l.numberOfDays || calculateDays(l.startDate, l.endDate),
        reason: l.reason || "",
        emergencyContact: l.emergencyContact || "",
        status: l.status || "Pending",
        appliedAt: l.createdAt ? String(l.createdAt).slice(0, 10) : "",
      }));
      setLocalLeaves(formatted);
    }
  }, [leaves]);

  // --------------------------------------------------------------------------
  // Leave Mode Calculations
  // --------------------------------------------------------------------------
  const leaveDurationDays = useMemo(() => {
    return calculateDays(leaveForm.startDate, leaveForm.endDate);
  }, [leaveForm.startDate, leaveForm.endDate]);

  const selectedLeaveTypeInfo = useMemo(() => {
    if (!leaveForm.leaveType) return null;
    return typesToRender.find((t) => t.id === leaveForm.leaveType || t.name === leaveForm.leaveType) || null;
  }, [leaveForm.leaveType, typesToRender]);

  const leaveAvailableBalance = selectedLeaveTypeInfo?.available ?? 12;
  const leaveBalanceAfter = leaveAvailableBalance - leaveDurationDays;
  const isLeaveNegativeBalance = Boolean(
    leaveForm.leaveType && leaveDurationDays > 0 && leaveBalanceAfter < 0
  );

  // --------------------------------------------------------------------------
  // WFH Mode Calculations
  // --------------------------------------------------------------------------
  const wfhRawDays = useMemo(() => {
    return calculateDays(wfhForm.startDate, wfhForm.endDate);
  }, [wfhForm.startDate, wfhForm.endDate]);

  const activeSessionMeta = useMemo(() => {
    return WFH_SESSION_TYPES.find((s) => s.id === wfhForm.sessionType) || WFH_SESSION_TYPES[0];
  }, [wfhForm.sessionType]);

  const wfhQuotaCost = wfhForm.sessionType === "full" ? wfhRawDays : 0.5 * (wfhRawDays || 1);
  const wfhMonthlyAvailable = 3; // 4 Monthly grant - 1 already consumed
  const wfhBalanceAfter = wfhMonthlyAvailable - wfhQuotaCost;
  const isWfhNegativeBalance = Boolean(
    wfhForm.startDate && wfhForm.endDate && wfhQuotaCost > 0 && wfhBalanceAfter < 0
  );

  // --------------------------------------------------------------------------
  // Submit Handlers
  // --------------------------------------------------------------------------
  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    setSubmittedMessage("");

    if (!leaveForm.leaveType || !leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason.trim()) {
      setSubmitError("Please select a leave category, dates, and provide a reason.");
      return;
    }

    if (leaveForm.startDate > leaveForm.endDate) {
      setSubmitError("End date must be on or after start date.");
      return;
    }

    if (isLeaveNegativeBalance) {
      setSubmitError(`Insufficient quota. You only have ${leaveAvailableBalance} days available.`);
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        ...leaveForm,
        type: selectedLeaveTypeInfo?.name || leaveForm.leaveType,
        duration: leaveDurationDays,
      };

      if (submitLeave) {
        await submitLeave(payload);
      }

      const newLeave = {
        id: `leave-local-${Date.now()}`,
        isWfh: false,
        type: selectedLeaveTypeInfo?.name || "Casual Leave",
        leaveTypeId: leaveForm.leaveType,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        duration: leaveDurationDays,
        reason: leaveForm.reason.trim(),
        emergencyContact: leaveForm.emergencyContact,
        status: "Pending",
        appliedAt: new Date().toISOString().slice(0, 10),
      };

      setLocalLeaves((prev) => [newLeave, ...prev]);
      setLeaveForm({
        leaveType: "",
        startDate: "",
        endDate: "",
        reason: "",
        emergencyContact: "",
      });
      setSubmittedMessage("✓ Leave application submitted successfully! Status is Pending manager approval.");
    } catch (err) {
      setSubmitError(err.message || "Failed to submit leave.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWfhSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    setSubmittedMessage("");

    if (!wfhForm.startDate || !wfhForm.endDate || !wfhForm.deliverables.trim()) {
      setSubmitError("Please select dates and outline your planned deliverables.");
      return;
    }

    if (wfhForm.startDate > wfhForm.endDate) {
      setSubmitError("End date must be on or after start date.");
      return;
    }

    if (isWfhNegativeBalance) {
      setSubmitError(`WFH quota exceeded. You have ${wfhMonthlyAvailable} remote days available this month.`);
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        leaveType: "wfh",
        startDate: wfhForm.startDate,
        endDate: wfhForm.endDate,
        sessionType: wfhForm.sessionType,
        duration: wfhQuotaCost,
        reason: `${wfhForm.reasonCategory}: ${wfhForm.deliverables.trim()}`,
      };

      if (submitLeave) {
        await submitLeave(payload);
      }

      const newWfh = {
        id: `wfh-local-${Date.now()}`,
        isWfh: true,
        type: "Work From Home (WFH)",
        sessionType: wfhForm.sessionType,
        sessionLabel: activeSessionMeta.label + ` (${activeSessionMeta.hoursText})`,
        startDate: wfhForm.startDate,
        endDate: wfhForm.endDate,
        duration: wfhQuotaCost,
        reason: wfhForm.reasonCategory,
        deliverables: wfhForm.deliverables.trim(),
        emergencyContact: wfhForm.emergencyContact,
        status: "Pending",
        appliedAt: new Date().toISOString().slice(0, 10),
      };

      setLocalLeaves((prev) => [newWfh, ...prev]);
      setWfhForm({
        startDate: "",
        endDate: "",
        reasonCategory: WFH_REASONS[0],
        sessionType: "full",
        deliverables: "",
        emergencyContact: "+91 98490 11223",
        broadbandChecked: true,
        teamsChecked: true,
      });
      setSubmittedMessage("✓ Work From Home request submitted! Reporting manager notified.");
    } catch (err) {
      setSubmitError(err.message || "Failed to submit WFH request.");
    } finally {
      setSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // Edit Request Modal Logic
  // --------------------------------------------------------------------------
  const handleOpenEdit = (item) => {
    setModalError("");
    setEditingLeave({
      ...item,
      startDate: item.startDate ? item.startDate.slice(0, 10) : "",
      endDate: item.endDate ? item.endDate.slice(0, 10) : "",
      leaveType: item.leaveTypeId || "casual",
      reasonCategory: item.reason || WFH_REASONS[0],
      sessionType: item.sessionType || "full",
      deliverables: item.deliverables || item.reason || "",
      reason: item.reason || "",
      emergencyContact: item.emergencyContact || "",
    });
  };

  const handleEditFieldChange = (e) => {
    const { name, value } = e.target;
    setEditingLeave((prev) => ({ ...prev, [name]: value }));
  };

  const editDuration = editingLeave ? calculateDays(editingLeave.startDate, editingLeave.endDate) : 0;

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingLeave) return;
    setModalError("");

    if (!editingLeave.startDate || !editingLeave.endDate) {
      setModalError("Please specify start and end dates.");
      return;
    }

    if (editingLeave.startDate > editingLeave.endDate) {
      setModalError("End date must be on or after start date.");
      return;
    }

    try {
      setModalSubmitting(true);
      const isWfhItem = Boolean(editingLeave.isWfh);
      const updatedData = {
        ...editingLeave,
        duration: isWfhItem && editingLeave.sessionType !== "full" ? 0.5 : editDuration,
        reason: isWfhItem ? editingLeave.reasonCategory : editingLeave.reason.trim(),
        deliverables: isWfhItem ? editingLeave.deliverables.trim() : "",
      };

      if (updateExistingLeave) {
        try {
          await updateExistingLeave(editingLeave.id || editingLeave._id, updatedData);
        } catch {
          // fallback
        }
      }

      setLocalLeaves((prev) =>
        prev.map((item) =>
          (item.id || item._id) === (editingLeave.id || editingLeave._id) ? { ...item, ...updatedData } : item
        )
      );

      setEditingLeave(null);
      setSubmittedMessage("✓ Request updated successfully!");
    } catch (err) {
      setModalError(err.message || "Failed to update request.");
    } finally {
      setModalSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // Delete Request Logic
  // --------------------------------------------------------------------------
  const handleOpenDelete = (item) => {
    setDeletingLeave(item);
  };

  const handleConfirmDelete = async () => {
    if (!deletingLeave) return;
    try {
      setModalSubmitting(true);
      const leaveId = deletingLeave.id || deletingLeave._id;

      if (deleteExistingLeave) {
        try {
          await deleteExistingLeave(leaveId);
        } catch {
          // fallback
        }
      }

      setLocalLeaves((prev) => prev.filter((item) => (item.id || item._id) !== leaveId));
      setDeletingLeave(null);
      setSubmittedMessage("✓ Request has been cancelled and removed.");
    } catch (err) {
      setSubmitError(err.message || "Failed to delete request.");
    } finally {
      setModalSubmitting(false);
    }
  };

  // KPI calculations
  const approvedCount = localLeaves.filter((l) => l.status?.toLowerCase() === "approved").length;
  const pendingCount = localLeaves.filter((l) => l.status?.toLowerCase() === "pending").length;
  const remainingBalance = typesToRender.reduce((sum, t) => sum + (Number(t.available) || 0), 0);

  return (
    <>
      <EmployeeHeader />

      <main className="employee-leaves-hub">
        {/* =====================================================
            HERO COMMAND BANNER
        ===================================================== */}
        <section className="leave-hero-banner" aria-label="Leaves Hero Banner">
          <div className="leave-hero-left">
            <div className="hero-kicker-pill">
              <span className="pulsing-live-dot" />
              <span>Quadratic Employee Workspace</span>
            </div>
            <h1>Time Off & Remote Work Hub</h1>
            <p>
              Manage paid vacation, sick time off, or request Work From Home (WFH) days with automated
              reporting manager notification and enterprise quota protection.
            </p>

            <div className="emp-meta-pills">
              <span className="meta-pill-tag">🌴 Leave Quota: 24 Days/yr</span>
              <span className="meta-pill-tag">🏠 WFH Quota: 4 Days/mo</span>
              <span className="meta-pill-tag">📍 Hyderabad HQ (Melange Towers)</span>
              <span className="meta-pill-tag">✓ Manager: Kavita Rao (Director)</span>
            </div>
          </div>
        </section>

        {/* =====================================================
            4 KPI METRICS
        ===================================================== */}
        <section className="leave-kpi-grid" aria-label="Leave KPIs">
          <div className="kpi-card-box emerald">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Remaining Leaves</span>
              <div className="kpi-icon-pod emerald">🌴</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{remainingBalance} Days</span>
              <span className="kpi-badge-chip positive">Active</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar emerald" style={{ width: "75%" }} />
            </div>
            <span className="kpi-subtext">75% of annual allowance remaining</span>
          </div>

          <div className="kpi-card-box teal">
            <div className="kpi-card-head">
              <span className="kpi-title-text">WFH Allowance</span>
              <div className="kpi-icon-pod teal">🏠</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{wfhMonthlyAvailable} Days</span>
              <span className="kpi-badge-chip neutral">Sep 2026</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar teal" style={{ width: "75%" }} />
            </div>
            <span className="kpi-subtext">1 of 4 remote days utilized this month</span>
          </div>

          <div className="kpi-card-box indigo">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Approved Requests</span>
              <div className="kpi-icon-pod indigo">✓</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{approvedCount} Requests</span>
              <span className="kpi-badge-chip indigo">Processed</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar indigo" style={{ width: `${Math.min(100, approvedCount * 25)}%` }} />
            </div>
            <span className="kpi-subtext">Verified by reporting manager</span>
          </div>

          <div className="kpi-card-box rose">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Pending Approvals</span>
              <div className="kpi-icon-pod rose">⏱️</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{pendingCount} Active</span>
              <span className="kpi-badge-chip rose">In Review</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar rose" style={{ width: `${pendingCount ? 50 : 0}%` }} />
            </div>
            <span className="kpi-subtext">Can be updated or cancelled below</span>
          </div>
        </section>

        {/* =====================================================
            DUAL-PANE WORKSPACE: FORM + BALANCES
        ===================================================== */}
        <div className="leave-workspace-grid">
          {/* Left: Interactive Form Card */}
          <section className="leave-form-card">
            <h2>{requestMode === "wfh" ? "Apply for Work From Home (Remote Shift)" : "Request Time Off / Paid Leave"}</h2>
            <p>
              {requestMode === "wfh"
                ? "Schedule remote workdays. Full-time employees are entitled to 4 monthly remote days with manager concurrence."
                : "Submit formal leave against your accrued annual balances (Earned, Casual, Sick)."}
            </p>

            {/* Mode Switcher */}
            <div className="request-mode-switcher">
              <button
                type="button"
                className={`mode-tab-btn ${requestMode === "leave" ? "active" : ""}`}
                onClick={() => {
                  setRequestMode("leave");
                  setSubmitError("");
                }}
              >
                <span>🌴</span> Paid Leave / Time Off
              </button>
              <button
                type="button"
                className={`mode-tab-btn ${requestMode === "wfh" ? "active wfh" : ""}`}
                onClick={() => {
                  setRequestMode("wfh");
                  setSubmitError("");
                }}
              >
                <span>🏠</span> Work From Home (WFH)
              </button>
            </div>

            {submitError && (
              <div
                style={{
                  padding: "0.85rem 1rem",
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                  borderRadius: "10px",
                  color: "#e11d48",
                  fontSize: "0.84rem",
                  fontWeight: 600,
                  marginBottom: "1rem",
                }}
              >
                ⚠️ {submitError}
              </div>
            )}

            {submittedMessage && (
              <div
                style={{
                  padding: "0.85rem 1rem",
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  borderRadius: "10px",
                  color: "#059669",
                  fontSize: "0.84rem",
                  fontWeight: 600,
                  marginBottom: "1rem",
                }}
              >
                {submittedMessage}
              </div>
            )}

            {/* ===================================================
                FORM VARIANT A: REALISTIC TIME OFF / LEAVE FORM
            =================================================== */}
            {requestMode === "leave" && (
              <form className="leave-app-form" onSubmit={handleLeaveSubmit}>
                <div className="form-field-group">
                  <label>Leave Category *</label>
                  <select
                    value={leaveForm.leaveType}
                    onChange={(e) => setLeaveForm((prev) => ({ ...prev, leaveType: e.target.value }))}
                    required
                  >
                    <option value="">Select leave category</option>
                    {typesToRender.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name} ({type.available} Days Available / {type.total} Total)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row-2col">
                  <div className="form-field-group">
                    <label>Leave Start Date *</label>
                    <WeekdayDatePicker
                      value={leaveForm.startDate}
                      onChange={(val) => setLeaveForm((prev) => ({ ...prev, startDate: val }))}
                      min={new Date().toISOString().slice(0, 10)}
                      placeholder="Select working start date (Mon-Fri)"
                      required
                    />
                  </div>

                  <div className="form-field-group">
                    <label>Leave End Date *</label>
                    <WeekdayDatePicker
                      value={leaveForm.endDate}
                      onChange={(val) => setLeaveForm((prev) => ({ ...prev, endDate: val }))}
                      min={leaveForm.startDate || new Date().toISOString().slice(0, 10)}
                      placeholder="Select working end date (Mon-Fri)"
                      required
                    />
                  </div>
                </div>

                {/* Live Quota Check for Leave */}
                {leaveForm.leaveType && (
                  <div className={`leave-balance-preview-card ${isLeaveNegativeBalance ? "deficit" : "sufficient"}`}>
                    <div className="preview-top-row">
                      <span className="preview-type-name">{selectedLeaveTypeInfo?.name || "Selected Leave"}</span>
                      <span className={`preview-badge ${isLeaveNegativeBalance ? "badge-deficit" : "badge-ok"}`}>
                        {isLeaveNegativeBalance ? "⚠️ Negative Balance" : "✓ Quota Sufficient"}
                      </span>
                    </div>

                    <div className="preview-metrics-grid">
                      <div className="preview-metric">
                        <span className="metric-label">Available Balance</span>
                        <strong className="metric-val">{leaveAvailableBalance} Days</strong>
                      </div>
                      <div className="preview-metric">
                        <span className="metric-label">Requested</span>
                        <strong className="metric-val">{leaveDurationDays} Days</strong>
                      </div>
                      <div className="preview-metric">
                        <span className="metric-label">Remaining After</span>
                        <strong className={`metric-val ${isLeaveNegativeBalance ? "negative" : "positive"}`}>
                          {leaveBalanceAfter} Days
                        </strong>
                      </div>
                    </div>

                    {isLeaveNegativeBalance && (
                      <div className="preview-warning-alert">
                        ⛔ <strong>Insufficient Leave Quota:</strong> You have only <strong>{leaveAvailableBalance} days</strong> remaining in this category, but requested <strong>{leaveDurationDays} days</strong>. Confirm button disabled.
                      </div>
                    )}
                  </div>
                )}

                <div className="form-field-group">
                  <label>Reason for Leave *</label>
                  <textarea
                    rows="3"
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm((prev) => ({ ...prev, reason: e.target.value }))}
                    placeholder="Provide context for your leave request (e.g. personal commitments, family vacation)..."
                    required
                  />
                </div>

                <div className="form-field-group">
                  <label>Emergency Contact Phone (Optional)</label>
                  <input
                    type="tel"
                    value={leaveForm.emergencyContact}
                    onChange={(e) => setLeaveForm((prev) => ({ ...prev, emergencyContact: e.target.value }))}
                    placeholder="+91 98765 43210"
                  />
                </div>

                <button
                  type="submit"
                  className={`submit-leave-btn ${isLeaveNegativeBalance ? "disabled-deficit" : ""}`}
                  disabled={submitting || isLeaveNegativeBalance || !leaveForm.leaveType || leaveDurationDays === 0 || (employee?.employment?.status !== "Active" && employee?.employment?.status !== "Notice Period")}
                >
                  {submitting
                    ? "Submitting..."
                    : isLeaveNegativeBalance
                    ? `⛔ Negative Balance (${leaveBalanceAfter} Days) — Cannot Confirm`
                    : "✈️ Confirm & Submit Leave Request"}
                </button>
              </form>
            )}

            {/* ===================================================
                FORM VARIANT B: REALISTIC ENTERPRISE WFH FORM
            =================================================== */}
            {requestMode === "wfh" && (
              <form className="leave-app-form" onSubmit={handleWfhSubmit}>
                {/* 1. Reason for Remote Work */}
                <div className="form-field-group">
                  <label>Reason for Remote Work *</label>
                  <select
                    value={wfhForm.reasonCategory}
                    onChange={(e) => setWfhForm((prev) => ({ ...prev, reasonCategory: e.target.value }))}
                    required
                  >
                    {WFH_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Session Coverage Selector */}
                <div className="form-field-group">
                  <label>Shift Coverage *</label>
                  <div className="wfh-session-grid">
                    {WFH_SESSION_TYPES.map((session) => {
                      const isSelected = wfhForm.sessionType === session.id;
                      return (
                        <div
                          key={session.id}
                          className={`wfh-session-card ${isSelected ? "selected" : ""}`}
                          onClick={() => setWfhForm((prev) => ({ ...prev, sessionType: session.id }))}
                        >
                          <div className="session-title-row">
                            <span className="session-name">
                              {isSelected ? "🔘" : "⚪"} {session.label}
                            </span>
                            <span className="session-hours-tag">{session.hoursText}</span>
                          </div>
                          <span className="session-time-text">{session.timeText}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Dates */}
                <div className="form-row-2col">
                  <div className="form-field-group">
                    <label>Remote Start Date *</label>
                    <WeekdayDatePicker
                      value={wfhForm.startDate}
                      onChange={(val) => setWfhForm((prev) => ({ ...prev, startDate: val }))}
                      min={new Date().toISOString().slice(0, 10)}
                      placeholder="Select working start date (Mon-Fri)"
                      required
                    />
                  </div>

                  <div className="form-field-group">
                    <label>Remote End Date *</label>
                    <WeekdayDatePicker
                      value={wfhForm.endDate}
                      onChange={(val) => setWfhForm((prev) => ({ ...prev, endDate: val }))}
                      min={wfhForm.startDate || new Date().toISOString().slice(0, 10)}
                      placeholder="Select working end date (Mon-Fri)"
                      required
                    />
                  </div>
                </div>

                {/* 4. Live WFH Quota Tracker */}
                {wfhForm.startDate && (
                  <div className={`leave-balance-preview-card ${isWfhNegativeBalance ? "deficit" : "sufficient"}`}>
                    <div className="preview-top-row">
                      <span className="preview-type-name">
                        🏠 Remote Shift Quota (Sep 2026 Allowance)
                      </span>
                      <span className={`preview-badge ${isWfhNegativeBalance ? "badge-deficit" : "badge-ok"}`}>
                        {isWfhNegativeBalance ? "⚠️ Quota Exceeded" : "✓ Quota Available"}
                      </span>
                    </div>

                    <div className="preview-metrics-grid">
                      <div className="preview-metric">
                        <span className="metric-label">Monthly Available</span>
                        <strong className="metric-val">{wfhMonthlyAvailable} Days</strong>
                      </div>
                      <div className="preview-metric">
                        <span className="metric-label">Requested Quota</span>
                        <strong className="metric-val">{wfhQuotaCost} Days</strong>
                      </div>
                      <div className="preview-metric">
                        <span className="metric-label">Remaining After</span>
                        <strong className={`metric-val ${isWfhNegativeBalance ? "negative" : "positive"}`}>
                          {wfhBalanceAfter} Days
                        </strong>
                      </div>
                    </div>

                    {isWfhNegativeBalance && (
                      <div className="preview-warning-alert">
                        ⛔ <strong>Monthly WFH Limit Exceeded:</strong> You have only <strong>{wfhMonthlyAvailable} remote days</strong> remaining for September. The confirm button is disabled.
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Sprint Deliverables */}
                <div className="form-field-group">
                  <label>Planned Deliverables & Key Tasks *</label>
                  <textarea
                    rows="3"
                    value={wfhForm.deliverables}
                    onChange={(e) => setWfhForm((prev) => ({ ...prev, deliverables: e.target.value }))}
                    placeholder="List Jira tickets, key features, or deliverables scheduled for this remote workday (e.g. PR review, sprint feature coding, team standup at 10 AM)..."
                    required
                  />
                </div>

                {/* 6. Readiness & Connectivity Checklist */}
                <div className="wfh-checklist-box">
                  <span className="wfh-checklist-title">🛡️ Remote Readiness & Connectivity Acknowledgment</span>
                  <label className="wfh-checkbox-item">
                    <input
                      type="checkbox"
                      checked={wfhForm.broadbandChecked}
                      onChange={(e) => setWfhForm((prev) => ({ ...prev, broadbandChecked: e.target.checked }))}
                    />
                    <span>
                      <strong>High-Speed Broadband (&gt;50 Mbps) & Power Backup</strong> are active and verified at home location.
                    </span>
                  </label>

                  <label className="wfh-checkbox-item">
                    <input
                      type="checkbox"
                      checked={wfhForm.teamsChecked}
                      onChange={(e) => setWfhForm((prev) => ({ ...prev, teamsChecked: e.target.checked }))}
                    />
                    <span>
                      <strong>Availability:</strong> I will be active on Microsoft Teams and phone throughout shift hours (09:30 AM – 06:30 PM IST).
                    </span>
                  </label>
                </div>

                {/* 7. Reporting Manager routing */}
                <div className="wfh-manager-pill">
                  <div className="wfh-manager-left">
                    <div className="wfh-manager-avatar">KR</div>
                    <div>
                      <strong style={{ display: "block", color: "#0f172a" }}>Kavita Rao</strong>
                      <span style={{ fontSize: "0.74rem", color: "#64748b" }}>Director of Engineering • Reporting Manager</span>
                    </div>
                  </div>
                  <span style={{ fontSize: "0.76rem", color: "#059669", fontWeight: 700 }}>
                    ✓ Auto-routed for review
                  </span>
                </div>

                {/* Confirm Button */}
                <button
                  type="submit"
                  className={`submit-leave-btn ${isWfhNegativeBalance ? "disabled-deficit" : ""}`}
                  disabled={
                    submitting ||
                    isWfhNegativeBalance ||
                    !wfhForm.startDate ||
                    !wfhForm.endDate ||
                    !wfhForm.broadbandChecked ||
                    !wfhForm.teamsChecked ||
                    wfhQuotaCost === 0 ||
                    (employee?.employment?.status !== "Active" && employee?.employment?.status !== "Notice Period")
                  }
                >
                  {submitting
                    ? "Submitting..."
                    : isWfhNegativeBalance
                    ? `⛔ Monthly Quota Exceeded (${wfhBalanceAfter} Days) — Cannot Confirm`
                    : `🏠 Confirm & Submit WFH Request (${wfhQuotaCost} ${wfhQuotaCost === 1 ? "Day" : "Days"})`}
                </button>
              </form>
            )}
          </section>

          {/* Right: Policy & Quota Panel */}
          <aside className="leave-balance-panel">
            <h3 style={{ margin: "0 0 1rem", fontSize: "1.05rem", color: "#0f172a", fontWeight: 800 }}>
              {requestMode === "wfh" ? "Remote Work Guidelines" : "Annual Leave Quotas"}
            </h3>

            {requestMode === "leave" ? (
              typesToRender.map((t) => (
                <div key={t.id} className="balance-item-card">
                  <div className="balance-head-row">
                    <span className="balance-title">{t.name}</span>
                    <span className="balance-fraction">{t.available} / {t.total}</span>
                  </div>
                  <div className="balance-rail">
                    <div
                      className="balance-fill"
                      style={{ width: `${Math.min(100, Math.round((t.available / t.total) * 100))}%` }}
                    />
                  </div>
                  <small style={{ color: "#64748b", fontSize: "0.74rem" }}>
                    {t.accrual} • Accrual tracked automatically
                  </small>
                </div>
              ))
            ) : (
              <div>
                <div className="balance-item-card">
                  <div className="balance-head-row">
                    <span className="balance-title">Monthly Remote Quota</span>
                    <span className="balance-fraction">{wfhMonthlyAvailable} / 4 Days</span>
                  </div>
                  <div className="balance-rail">
                    <div className="balance-fill" style={{ width: "75%", background: "#0284c7" }} />
                  </div>
                  <small style={{ color: "#64748b", fontSize: "0.74rem" }}>
                    Refreshes on the 1st of every month. Unused days do not carry forward.
                  </small>
                </div>

                <div className="bulletin-box" style={{ marginTop: "1rem" }}>
                  📋 <strong>Core Hours:</strong> Standard shift applies (09:30 AM – 06:30 PM IST). Daily standup attendance and task tracking via Timesheets are mandatory.
                </div>

                <div className="bulletin-box" style={{ marginTop: "0.75rem" }}>
                  🛡️ <strong>IT Compliance:</strong> Only use official Quadratic corporate laptops with endpoint encryption and active VPN.
                </div>
              </div>
            )}

            <div className="bulletin-box" style={{ marginTop: "1.25rem" }}>
              💡 <strong>Update & Delete Feasibility:</strong> Any request currently in <em>Pending</em> status can be updated or cancelled below before manager sign-off.
            </div>
          </aside>
        </div>

        {/* =====================================================
            LEAVE & WFH APPLICATION HISTORY TABLE
        ===================================================== */}
        {loading || (error && String(typeof error === "string" ? error : error?.message || "").toLowerCase().includes("authorization")) ? (
          <Loader label="Loading leave history..." />
        ) : error ? (
          <ErrorMessage message={typeof error === "string" ? error : error?.message || "Failed to load leave history"} />
        ) : (
          <section className="leave-history-panel" aria-label="Leave History Table">
            <div className="leave-history-head">
              <div>
                <h2>Application History & Request Management</h2>
                <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.84rem" }}>
                  Record of all applied leaves and WFH sessions. Pending requests can be edited or cancelled.
                </p>

                {/* Filter Tabs */}
                <div className="history-filter-row">
                  <button
                    type="button"
                    className={`history-filter-btn ${historyFilter === "all" ? "active" : ""}`}
                    onClick={() => setHistoryFilter("all")}
                  >
                    All Records ({localLeaves.length})
                  </button>
                  <button
                    type="button"
                    className={`history-filter-btn ${historyFilter === "leaves" ? "active" : ""}`}
                    onClick={() => setHistoryFilter("leaves")}
                  >
                    🌴 Paid Leaves ({localLeaves.filter((l) => !l.isWfh).length})
                  </button>
                  <button
                    type="button"
                    className={`history-filter-btn ${historyFilter === "wfh" ? "active" : ""}`}
                    onClick={() => setHistoryFilter("wfh")}
                  >
                    🏠 WFH Remote ({localLeaves.filter((l) => l.isWfh).length})
                  </button>
                </div>
              </div>
            </div>

            <div className="table-responsive-wrapper">
              <table className="att-records-table">
                <thead>
                  <tr>
                    <th>Type / Category</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Duration</th>
                    <th>Reason / Agenda</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {localLeaves
                    .filter((item) => {
                      if (historyFilter === "wfh") return Boolean(item.isWfh);
                      if (historyFilter === "leaves") return !item.isWfh;
                      return true;
                    })
                    .map((item, idx) => {
                      const days = item.duration || calculateDays(item.startDate, item.endDate);
                      const isPending = ["pending", "pending manager", "pending hr", "pending_manager", "pending_hr"].includes(
                        String(item.status || "").toLowerCase()
                      );

                      return (
                        <tr key={item.id || item._id || idx}>
                          <td>
                            <strong>
                              {item.isWfh ? "🏠 " : "🌴 "}
                              {item.type}
                            </strong>
                            {item.sessionLabel && (
                              <span style={{ display: "block", fontSize: "0.72rem", color: "#0284c7" }}>
                                {item.sessionLabel}
                              </span>
                            )}
                          </td>
                          <td>{formatDate(item.startDate)}</td>
                          <td>{formatDate(item.endDate)}</td>
                          <td>
                            <span className="hours-pill">
                              {days} {days === 1 ? "Day" : "Days"}
                            </span>
                          </td>
                          <td
                            style={{
                              maxWidth: "260px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={item.deliverables || item.reason}
                          >
                            {item.deliverables || item.reason || "Personal work"}
                          </td>
                          <td>
                            {(() => {
                              const norm = String(item.status || "").toLowerCase();
                              if (norm === "pending manager" || norm === "pending_manager" || norm === "pending") {
                                return (
                                  <span className="status-chip-badge late" title="Step 1 of 2: Awaiting Manager Approval">
                                    🟡 Pending Manager (Step 1/2)
                                  </span>
                                );
                              }
                              if (norm === "pending hr" || norm === "pending_hr") {
                                return (
                                  <span className="status-chip-badge" style={{ background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd" }} title="Step 2 of 2: Manager Approved! Awaiting HR Final Approval">
                                    🔵 Pending HR (Step 2/2)
                                  </span>
                                );
                              }
                              if (norm === "approved") {
                                return (
                                  <span className="status-chip-badge present" title="Leave Final Approved by HR">
                                    🟢 Approved (Final)
                                  </span>
                                );
                              }
                              if (norm === "rejected") {
                                return (
                                  <span className="status-chip-badge rose" title="Leave Rejected">
                                    🔴 Rejected
                                  </span>
                                );
                              }
                              return (
                                <span className="status-chip-badge late">
                                  {item.status || "Pending"}
                                </span>
                              );
                            })()}
                          </td>
                          <td>
                            {isPending ? (
                              <div className="leave-action-group">
                                <button
                                  type="button"
                                  className="edit-leave-btn"
                                  onClick={() => handleOpenEdit(item)}
                                  title="Edit this pending request"
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  type="button"
                                  className="delete-leave-btn"
                                  onClick={() => handleOpenDelete(item)}
                                  title="Delete / cancel this pending request"
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: "0.76rem", color: "#94a3b8", fontStyle: "italic" }}>
                                Locked ({item.status})
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* =====================================================
          MODAL: EDIT PENDING REQUEST (ADAPTS FOR LEAVE OR WFH)
      ===================================================== */}
      {editingLeave && (
        <div className="modal-backdrop" onClick={() => setEditingLeave(null)}>
          <div
            className="leave-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-request-title"
          >
            <div className="leave-modal-header">
              <div>
                <h3 id="edit-request-title">
                  {editingLeave.isWfh ? "Edit WFH Request" : "Edit Leave Request"}
                </h3>
                <p>Modify dates, reason, or deliverables for this pending request</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingLeave(null)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="leave-modal-body">
                {modalError && (
                  <div
                    style={{
                      padding: "0.75rem 1rem",
                      background: "#fff1f2",
                      border: "1px solid #fecdd3",
                      borderRadius: "8px",
                      color: "#e11d48",
                      fontSize: "0.82rem",
                      marginBottom: "1rem",
                      fontWeight: 600,
                    }}
                  >
                    ⚠️ {modalError}
                  </div>
                )}

                {/* Conditional Fields based on isWfh */}
                {editingLeave.isWfh ? (
                  <>
                    <div className="form-field-group">
                      <label>Reason for Remote Work *</label>
                      <select
                        name="reasonCategory"
                        value={editingLeave.reasonCategory}
                        onChange={handleEditFieldChange}
                        required
                      >
                        {WFH_REASONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field-group">
                      <label>Shift Session *</label>
                      <select
                        name="sessionType"
                        value={editingLeave.sessionType}
                        onChange={handleEditFieldChange}
                        required
                      >
                        {WFH_SESSION_TYPES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label} ({s.hoursText} • {s.timeText})
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="form-field-group">
                    <label>Leave Category *</label>
                    <select
                      name="leaveType"
                      value={editingLeave.leaveType}
                      onChange={handleEditFieldChange}
                      required
                    >
                      {typesToRender.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name} ({type.available} Days Available)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-row-2col">
                  <div className="form-field-group">
                    <label>Start Date *</label>
                    <WeekdayDatePicker
                      value={editingLeave.startDate}
                      onChange={(val) => setEditingLeave((prev) => ({ ...prev, startDate: val }))}
                      placeholder="Select working start date"
                      required
                    />
                  </div>

                  <div className="form-field-group">
                    <label>End Date *</label>
                    <WeekdayDatePicker
                      value={editingLeave.endDate}
                      onChange={(val) => setEditingLeave((prev) => ({ ...prev, endDate: val }))}
                      min={editingLeave.startDate}
                      placeholder="Select working end date"
                      required
                    />
                  </div>
                </div>

                <div className="form-field-group">
                  <label>
                    {editingLeave.isWfh ? "Planned Deliverables / Tasks *" : "Reason for Leave *"}
                  </label>
                  <textarea
                    name={editingLeave.isWfh ? "deliverables" : "reason"}
                    rows="3"
                    value={editingLeave.isWfh ? editingLeave.deliverables : editingLeave.reason}
                    onChange={handleEditFieldChange}
                    required
                  />
                </div>

                <div className="form-field-group">
                  <label>Emergency Contact Phone</label>
                  <input
                    type="tel"
                    name="emergencyContact"
                    value={editingLeave.emergencyContact}
                    onChange={handleEditFieldChange}
                  />
                </div>
              </div>

              <div className="leave-modal-footer">
                <button
                  type="button"
                  className="modal-btn-cancel"
                  onClick={() => setEditingLeave(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-btn-save"
                  disabled={modalSubmitting || editDuration === 0}
                >
                  {modalSubmitting ? "Saving..." : "💾 Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          MODAL: DELETE / CANCEL CONFIRMATION
      ===================================================== */}
      {deletingLeave && (
        <div className="modal-backdrop" onClick={() => setDeletingLeave(null)}>
          <div
            className="leave-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "480px" }}
            role="dialog"
            aria-modal="true"
          >
            <div className="leave-modal-header" style={{ background: "#fff1f2" }}>
              <div>
                <h3 style={{ color: "#e11d48" }}>Cancel Pending Request</h3>
                <p>Are you sure you want to cancel this {deletingLeave.isWfh ? "WFH" : "leave"} request?</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDeletingLeave(null)}
              >
                ✕
              </button>
            </div>

            <div className="leave-modal-body">
              <div
                style={{
                  background: "#f8fafc",
                  padding: "1rem",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  fontSize: "0.86rem",
                  lineHeight: 1.6,
                }}
              >
                <div>
                  <strong>Type:</strong> {deletingLeave.type}
                </div>
                <div>
                  <strong>Dates:</strong> {formatDate(deletingLeave.startDate)} to{" "}
                  {formatDate(deletingLeave.endDate)} ({deletingLeave.duration || 1} day)
                </div>
                <div>
                  <strong>Details:</strong>{" "}
                  {deletingLeave.deliverables || deletingLeave.reason || "Not specified"}
                </div>
              </div>
              <p
                style={{
                  color: "#64748b",
                  fontSize: "0.82rem",
                  marginTop: "0.85rem",
                  marginBottom: 0,
                }}
              >
                ⚠️ Once cancelled, this request is permanently removed from manager review.
              </p>
            </div>

            <div className="leave-modal-footer">
              <button
                type="button"
                className="modal-btn-cancel"
                onClick={() => setDeletingLeave(null)}
              >
                Keep Request
              </button>
              <button
                type="button"
                className="modal-btn-delete"
                onClick={handleConfirmDelete}
                disabled={modalSubmitting}
              >
                {modalSubmitting ? "Deleting..." : "🗑️ Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default EmployeeLeaves;
