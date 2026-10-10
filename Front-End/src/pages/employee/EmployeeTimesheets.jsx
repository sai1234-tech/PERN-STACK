import { useState, useMemo, useEffect } from "react";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import Loader from "../../components/common/Loader";
import ErrorMessage from "../../components/common/ErrorMessage";
import { useTimesheets } from "../../hooks/useTimesheets";
import { useEmployee } from "../../hooks/useEmployee";
import { formatDate, formatTime } from "../../utils/date";
import WeekdayDatePicker from "../../components/common/WeekdayDatePicker";
import "../../styles/employee/timesheets.css";

const today = new Date().toISOString().slice(0, 10);
const emptyForm = {
  date: today,
  project: "",
  task: "",
  description: "",
  startTime: "",
  endTime: "",
  breakMinutes: "45",
};

function toIsoDate(value) {
  return value ? new Date(value).toISOString() : "";
}

function toLocalDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function EmployeeTimesheets() {
  const { employee: currentEmp } = useEmployee();
  const rawJoining = currentEmp?.employment?.joiningDate || currentEmp?.joiningDate || currentEmp?.dateOfJoining || null;
  const joiningDateStr = useMemo(() => {
    if (!rawJoining) return "";
    try {
      const d = new Date(rawJoining);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
    } catch {}
    return "";
  }, [rawJoining]);

  const {
    entries,
    totalHours,
    statusCounts,
    week,
    dailyTotals,
    reconciliation,
    weekReconciliation,
    loading,
    error,
    reload,
    create,
    update,
    remove,
    submit,
    submitAll,
  } = useTimesheets();

  const [selectedDate, setSelectedDate] = useState(today);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (joiningDateStr && selectedDate < joiningDateStr) {
      setSelectedDate(joiningDateStr);
      setForm((prev) => ({ ...prev, date: joiningDateStr }));
      reload(joiningDateStr);
    }
  }, [joiningDateStr, selectedDate, reload]);

  const rawEntries = entries || [];

  const displayEntries = useMemo(() => {
    return rawEntries;
  }, [rawEntries]);

  const activeDayReconciliation = useMemo(() => {
    const selectedKey = String(form.date || selectedDate || today).slice(0, 10);
    if (dailyTotals && dailyTotals.length > 0) {
      const dayMatch = dailyTotals.find((d) => d.date === selectedKey);
      if (dayMatch && dayMatch.reconciliation) {
        return dayMatch.reconciliation;
      }
    }

    if (reconciliation) {
      return reconciliation;
    }

    return {
      requiredHours: "8:00",
      clockedHours: "4:00",
      timesheetHours: "8:00",
      difference: "4:00",
      differenceDecimal: 4.0,
      status: "MISMATCH",
      action: "HR Review Required",
    };
  }, [dailyTotals, form.date, selectedDate, reconciliation]);

  const selectedDateKey = String(form.date || selectedDate || today).slice(0, 10);
  const isSelectedDateFuture = selectedDateKey > today;

  const isClockedIn = useMemo(() => {
    if (activeDayReconciliation) {
      if (activeDayReconciliation.hasAttendance) {
        return !!(activeDayReconciliation.checkIn || activeDayReconciliation.clockedHoursDecimal > 0);
      }
      return false;
    }
    return false;
  }, [activeDayReconciliation]);

  const pendingEntries = displayEntries.filter(e => ["draft", "rejected"].includes(e.status));
  const submittedEntries = displayEntries.filter(e => ["submitted", "approved"].includes(e.status));

  // Calculated metrics
  const calculatedTotalHours = useMemo(() => {
    if (totalHours > 0) return totalHours;
    return displayEntries.reduce((acc, curr) => acc + Number(curr.hours || 0), 0);
  }, [totalHours, displayEntries]);

  const draftCount = displayEntries.filter((e) => e.status === "draft").length;
  const submittedCount = displayEntries.filter((e) => e.status === "submitted").length;
  const approvedCount = displayEntries.filter((e) => e.status === "approved").length;

  const isWeekend = (dateStr) => {
    if (!dateStr) return false;
    const str = String(dateStr).slice(0, 10);
    const parts = str.split("-");
    if (parts.length !== 3) return false;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const day = d.getDay();
    return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "date") {
      if (joiningDateStr && value < joiningDateStr) {
        setFormError(`⚠️ Date of Joining Policy: Work entries cannot be logged for dates prior to your Date of Joining (${formatDate(joiningDateStr)}).`);
        setForm((prev) => ({ ...prev, date: "" }));
        return;
      }
      if (isWeekend(value)) {
        setFormError("⚠️ Saturday and Sunday are non-working weekend days. Work entries can only be logged for Monday – Friday.");
        setForm((prev) => ({ ...prev, date: "" }));
        return;
      }
    }
    setFormError("");
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleWeekChange = (e) => {
    const val = e.target.value;
    if (joiningDateStr && val < joiningDateStr) {
      setFormError(`⚠️ Cannot view or log timesheets prior to your Date of Joining (${formatDate(joiningDateStr)}).`);
      return;
    }
    setFormError("");
    setSelectedDate(val);
    reload(val);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    setNotice("");

    if (isSelectedDateFuture) {
      setFormError(`⚠️ Upcoming Date: Timesheets cannot be logged for future dates (${form.date || selectedDate}).`);
      return;
    }

    if (!isClockedIn) {
      setFormError(`⚠️ Not Clocked In: You did not clock in for attendance on ${form.date || selectedDate}. You must clock in for attendance before logging timesheet tasks.`);
      return;
    }

    if (!form.date || !form.task.trim() || !form.startTime || !form.endTime) {
      setFormError("Date, task name, start time, and end time are required.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...form,
        task: form.task.trim(),
        project: form.project.trim() || "General Engineering",
        description: form.description.trim(),
        startTime: toIsoDate(form.startTime),
        endTime: toIsoDate(form.endTime),
        breakMinutes: Number(form.breakMinutes) || 0,
      };

      if (editingId) {
        await update(editingId, payload);
      } else {
        await create(payload);
      }

      setForm({ ...emptyForm, date: form.date });
      setEditingId("");
      setNotice(editingId ? "Timesheet task updated successfully." : "Timesheet entry saved as draft.");
    } catch (requestError) {
      setFormError(requestError.message || "Failed to save timesheet entry.");
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (entry) => {
    setEditingId(entry._id);
    setForm({
      date: String(entry.date).slice(0, 10),
      project: entry.project || "",
      task: entry.task || "",
      description: entry.description || "",
      startTime: toLocalDateTime(entry.startTime),
      endTime: toLocalDateTime(entry.endTime),
      breakMinutes: String(entry.breakMinutes || 45),
    });
    setFormError("");
    setNotice("");
    window.scrollTo({ top: 120, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId("");
    setForm(emptyForm);
    setFormError("");
    setNotice("");
  };

  const handleAction = async (action, successMessage) => {
    setFormError("");
    setNotice("");
    try {
      await action();
      setNotice(successMessage);
    } catch (requestError) {
      setFormError(requestError.message || "Action failed.");
    }
  };

  return (
    <>
      <EmployeeHeader />

      <main className="employee-timesheets-hub">
        {/* =====================================================
            HERO COMMAND BANNER
        ===================================================== */}
        <section className="time-hero-banner" aria-label="Timesheets Hero">
          <div className="time-hero-left">
            <div className="hero-kicker-pill">
              <span className="pulsing-live-dot" />
              <span>Quadratic Project & Work Tracking</span>
            </div>
            <h1>Weekly Timesheets & Work Logs</h1>
            <p>
              Log billable project milestones, track daily task allocation, and submit
              weekly timesheets for manager review.
            </p>

            <div className="emp-meta-pills">
              {joiningDateStr && (
                <span className="meta-pill-tag" style={{ background: "rgba(45, 212, 191, 0.2)", border: "1px solid rgba(45, 212, 191, 0.4)", color: "#5eead4" }}>
                  📅 Joined: {formatDate(joiningDateStr)}
                </span>
              )}
              <span className="meta-pill-tag">🎯 Weekly Target: 40.0 hrs</span>
              <span className="meta-pill-tag">⏱️ Shift: 09:30 AM – 06:30 PM (8.0 Net Hrs)</span>
              <span className="meta-pill-tag">🍱 Lunch Break: 45 Mins</span>
              <span className="meta-pill-tag">🌏 Timezone: Asia/Kolkata (IST)</span>
            </div>
          </div>

          <div className="time-hero-actions">
            <div className="week-navigator-box">
              <span style={{ fontSize: "0.76rem", fontWeight: 700, paddingLeft: "0.4rem" }}>Week:</span>
              <input
                type="date"
                className="week-date-input"
                value={selectedDate}
                min={joiningDateStr || undefined}
                onChange={handleWeekChange}
                title="Select week date"
              />
            </div>

            <button
              type="button"
              className="att-btn primary"
              disabled={draftCount === 0}
              onClick={() => {
                const hoursByDate = {};
                displayEntries.forEach((d) => {
                  const breakH = (Number(d.breakMinutes) || 45) / 60;
                  hoursByDate[d.date] = (hoursByDate[d.date] || 0) + Number(d.hours) + breakH;
                });

                let failedDate = null;
                for (const date in hoursByDate) {
                  const dayOfWeek = new Date(date).getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  if (!isWeekend && hoursByDate[date] < 8.75) {
                    failedDate = date;
                    break;
                  }
                }

                if (failedDate) {
                  setFormError(`Enterprise Shift Policy (Asia/Kolkata): You must log 8.0 net working hours (+45m lunch break) for ${failedDate}.`);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  return;
                }

                handleAction(
                  () => submitAll(selectedDate),
                  "Complete week submitted to HR for approval."
                );
              }}
            >
              📤 Submit Week ({draftCount} Drafts)
            </button>
          </div>
        </section>

        {/* =====================================================
            4 KPI CARDS
        ===================================================== */}
        <section className="time-kpi-grid" aria-label="Timesheet KPIs">
          <div className="kpi-card-box emerald">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Logged This Week</span>
              <div className="kpi-icon-pod emerald">⏱️</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{calculatedTotalHours.toFixed(1)}h</span>
              <span className="kpi-badge-chip positive">
                {Math.round((calculatedTotalHours / 40) * 100)}% of Target
              </span>
            </div>
            <div className="kpi-progress-rail">
              <div
                className="kpi-progress-bar emerald"
                style={{ width: `${Math.min(100, (calculatedTotalHours / 40) * 100)}%` }}
              />
            </div>
            <span className="kpi-subtext">Target: 40.0 hours weekly standard</span>
          </div>

          <div className="kpi-card-box teal">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Draft Entries</span>
              <div className="kpi-icon-pod teal">📝</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{draftCount}</span>
              <span className="kpi-badge-chip neutral">Editable</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar teal" style={{ width: `${(draftCount / 5) * 100}%` }} />
            </div>
            <span className="kpi-subtext">Save drafts as you work through the week</span>
          </div>

          <div className="kpi-card-box indigo">
            <div className="kpi-card-head">
              <span className="kpi-title-text">In Review (Submitted)</span>
              <div className="kpi-icon-pod indigo">⏳</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{submittedCount}</span>
              <span className="kpi-badge-chip indigo">Awaiting HR</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar indigo" style={{ width: `${submittedCount ? 100 : 0}%` }} />
            </div>
            <span className="kpi-subtext">Locked while under manager review</span>
          </div>

          <div className="kpi-card-box rose">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Approved Hours</span>
              <div className="kpi-icon-pod rose">✓</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{approvedCount} Tasks</span>
              <span className="kpi-badge-chip positive">Verified</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar rose" style={{ width: "100%" }} />
            </div>
            <span className="kpi-subtext">Approved and sent to payroll ledger</span>
          </div>
        </section>

        {/* =====================================================
            ENTERPRISE WEEKLY CALENDAR STRIP (AMAZON / AWS STYLE)
        ===================================================== */}
        <section className="enterprise-calendar-strip" style={{ marginBottom: "2rem" }}>
          <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "16px", padding: "1.25rem 1.5rem", boxShadow: "0 4px 16px rgba(15,23,42,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
                  🗓️ Weekly Shift & Hours Calendar
                </h3>
                <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                  Mon – Fri (09:30 AM – 06:30 PM IST) • Saturday & Sunday Non-Working
                </span>
              </div>
              <div className="meta-pill-tag" style={{ background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0", fontWeight: 700 }}>
                ● LIVE SYNC ACTIVE (IST)
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "0.75rem" }}>
              {dailyTotals && dailyTotals.length > 0 ? dailyTotals.map((dayItem) => {
                const parts = dayItem.date.split("-");
                const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                const dayName = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
                const dayNum = d.getDate();
                const isWeekendDay = [0, 6].includes(d.getDay());
                const isBeforeJoining = joiningDateStr && dayItem.date < joiningDateStr;
                const isDisabledDay = isWeekendDay || isBeforeJoining;
                const isSelected = String(form.date || selectedDate).slice(0, 10) === dayItem.date;
                const rec = dayItem.reconciliation || {};

                return (
                  <div
                    key={dayItem.date}
                    onClick={() => {
                      if (!isDisabledDay) {
                        setForm((prev) => ({ ...prev, date: dayItem.date }));
                      }
                    }}
                    style={{
                      padding: "0.75rem 0.5rem",
                      borderRadius: "12px",
                      border: isSelected ? "2px solid #0d9488" : "1px solid #e2e8f0",
                      background: isDisabledDay ? "#f8fafc" : isSelected ? "#f0fdfa" : "#ffffff",
                      cursor: isDisabledDay ? "not-allowed" : "pointer",
                      textAlign: "center",
                      opacity: isDisabledDay ? 0.6 : 1,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: isDisabledDay ? "#94a3b8" : "#475569", textTransform: "uppercase" }}>
                      {dayName}
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: isDisabledDay ? "#64748b" : "#0f172a", margin: "2px 0" }}>
                      {dayNum}
                    </div>
                    {isBeforeJoining ? (
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8" }}>PRE-JOINING</span>
                    ) : isWeekendDay ? (
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8" }}>OFF</span>
                    ) : dayItem.date > today ? (
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8" }}>UPCOMING</span>
                    ) : !rec.hasAttendance && !rec.checkIn && (!rec.clockedHoursDecimal || rec.clockedHoursDecimal === 0) ? (
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#e11d48", background: "#fff1f2", padding: "2px 4px", borderRadius: "4px" }}>
                        NOT CLOCKED IN
                      </span>
                    ) : (
                      <div>
                        <div style={{ fontSize: "0.76rem", fontWeight: 800, color: rec.status === "MISMATCH" ? "#e11d48" : rec.status === "MISSING CLOCKOUT" ? "#e11d48" : "#0f766e" }}>
                          {dayItem.hours.toFixed(1)}h logged
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#64748b" }}>
                          ({rec.clockedHours || "0:00"} clocked)
                        </div>
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div style={{ gridColumn: "span 7", textAlign: "center", color: "#64748b", padding: "1rem" }}>
                  Loading calendar...
                </div>
              )}
            </div>
          </div>
        </section>

        {/* =====================================================
            ATTENDANCE RECONCILIATION CARD
        ===================================================== */}
        <section className="attendance-reconciliation-panel" aria-label="Attendance Reconciliation">
          <div className="reconciliation-card-container">
            <div className="reconciliation-card-header">
              <div className="rec-title-group">
                <span className="rec-icon">⏱️</span>
                <div>
                  <h3 className="rec-card-title">Attendance Reconciliation</h3>
                  <span className="rec-date-subtitle">
                    Date: {form.date || selectedDate || today} | Reconciling Attendance Clocking vs Timesheet Hours
                  </span>
                </div>
              </div>
              <div className={`rec-status-badge ${activeDayReconciliation.status === "MISMATCH" ? "badge-mismatch" : activeDayReconciliation.status === "PENDING CLOCKOUT" ? "badge-pending" : "badge-matched"}`}>
                {activeDayReconciliation.status}
              </div>
            </div>

            <div className="reconciliation-table-grid">
              <div className="rec-grid-row">
                <span className="rec-label">Required Hours:</span>
                <span className="rec-value mono">{activeDayReconciliation.requiredHours}</span>
              </div>
              <div className="rec-grid-row">
                <span className="rec-label">Clocked Hours:</span>
                <span className="rec-value mono highlight-clocked">{activeDayReconciliation.clockedHours}</span>
              </div>
              <div className="rec-grid-row">
                <span className="rec-label">Timesheet Hours:</span>
                <span className="rec-value mono highlight-timesheet">{activeDayReconciliation.timesheetHours}</span>
              </div>
              <div className="rec-grid-row border-top">
                <span className="rec-label">Difference:</span>
                <span className={`rec-value mono ${activeDayReconciliation.differenceDecimal > 0.25 ? "text-danger" : "text-success"}`}>
                  {activeDayReconciliation.difference}
                </span>
              </div>
              <div className="rec-grid-row">
                <span className="rec-label">Status:</span>
                <span className={`rec-value bold ${activeDayReconciliation.status === "MISMATCH" ? "text-danger" : "text-success"}`}>
                  {activeDayReconciliation.status}
                </span>
              </div>
              <div className="rec-grid-row highlight-action">
                <span className="rec-label">Action:</span>
                <span className={`rec-value bold-action ${activeDayReconciliation.status === "MISMATCH" ? "action-danger" : "action-success"}`}>
                  {activeDayReconciliation.action}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            NOTICES & ERRORS
        ===================================================== */}
        {formError && (
          <div
            style={{
              padding: "0.85rem 1rem",
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              borderRadius: "10px",
              color: "#e11d48",
              fontWeight: 600,
              fontSize: "0.86rem",
              marginBottom: "1.5rem",
            }}
          >
            ⚠️ {formError}
          </div>
        )}

        {notice && (
          <div
            style={{
              padding: "0.85rem 1rem",
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: "10px",
              color: "#059669",
              fontWeight: 600,
              fontSize: "0.86rem",
              marginBottom: "1.5rem",
            }}
          >
            ✓ {notice}
          </div>
        )}

        {/* =====================================================
            DUAL-PANE WORKSPACE (LOG FORM + SUMMARY TIPS)
        ===================================================== */}
        <div className="timesheet-workspace-layout">
          {/* Left: Task Entry Form */}
          <section className="timesheet-card-panel">
            <h2>{editingId ? "Edit Timesheet Task" : "Log Daily Work Entry"}</h2>
            <p>
              {editingId
                ? "Update your draft task details and click Save Changes."
                : "Record your working time by project. Entries save as drafts until submitted to HR."}
            </p>

            {isSelectedDateFuture ? (
              <div style={{ padding: "0.85rem 1rem", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "10px", color: "#475569", fontWeight: 600, fontSize: "0.85rem", marginBottom: "1.25rem" }}>
                🗓️ <strong>Upcoming Date:</strong> Timesheets cannot be logged for future dates ({form.date || selectedDate}). You will be able to fill timesheet tasks after clocking in on this date.
              </div>
            ) : !isClockedIn ? (
              <div style={{ padding: "0.85rem 1rem", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "10px", color: "#e11d48", fontWeight: 600, fontSize: "0.85rem", marginBottom: "1.25rem" }}>
                🚫 <strong>Not Clocked In:</strong> You did not clock in for attendance on {form.date || selectedDate}. Timesheet entries cannot be filled until you clock in for attendance on this date.
              </div>
            ) : null}

            <form className="task-entry-form" onSubmit={handleCreate}>
              <div className="form-row-2col">
                <div className="form-field-group">
                  <label>Date *</label>
                  <WeekdayDatePicker
                    value={form.date}
                    onChange={(val) => {
                      if (joiningDateStr && val < joiningDateStr) {
                        setFormError(`⚠️ Date of Joining Policy: Work entries cannot be logged for dates prior to your Date of Joining (${formatDate(joiningDateStr)}).`);
                        return;
                      }
                      setFormError("");
                      setForm((prev) => ({ ...prev, date: val }));
                    }}
                    min={joiningDateStr || undefined}
                    placeholder="Select working date (Mon–Fri)"
                    required
                  />
                </div>

                <div className="form-field-group">
                  <label>WBS Code / Project *</label>
                  <select
                    name="project"
                    value={form.project}
                    onChange={handleChange}
                    required
                  >
                    <option value="" disabled>Select WBS Code</option>
                    <option value="WBS-DEV-001: Backend Core">WBS-DEV-001: Backend Core</option>
                    <option value="WBS-FE-002: UI Components">WBS-FE-002: UI Components</option>
                    <option value="WBS-QA-003: Automated Tests">WBS-QA-003: Automated Tests</option>
                    <option value="WBS-OP-004: DevOps/Infra">WBS-OP-004: DevOps/Infra</option>
                    <option value="WBS-TRN-900: Bench/Training">WBS-TRN-900: Bench/Training</option>
                    <option value="WBS-INT-999: Internal Meetings">WBS-INT-999: Internal Meetings</option>
                  </select>
                </div>
              </div>

              <div className="form-field-group">
                <label>Task Title *</label>
                <input
                  type="text"
                  name="task"
                  value={form.task}
                  onChange={handleChange}
                  placeholder="What key feature or milestone did you work on?"
                  required
                />
              </div>

              <div className="form-row-2col">
                <div className="form-field-group">
                  <label>Start Time *</label>
                  <input
                    type="datetime-local"
                    name="startTime"
                    value={form.startTime}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-field-group">
                  <label>End Time *</label>
                  <input
                    type="datetime-local"
                    name="endTime"
                    value={form.endTime}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-field-group">
                <label>Break / Lunch Deduction (Minutes)</label>
                <input
                  type="number"
                  name="breakMinutes"
                  min="0"
                  max="180"
                  value={form.breakMinutes}
                  onChange={handleChange}
                />
              </div>

              <div className="form-field-group">
                <label>Detailed Notes (Optional)</label>
                <textarea
                  name="description"
                  rows="2"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Summarize deliverables, pull requests, or client meetings..."
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <button
                  type="submit"
                  className="att-btn primary"
                  disabled={saving || isSelectedDateFuture || !isClockedIn}
                  title={isSelectedDateFuture ? "Timesheets cannot be logged for future dates" : !isClockedIn ? "You must clock in for attendance before logging timesheet tasks" : ""}
                >
                  {saving
                    ? "Saving..."
                    : isSelectedDateFuture
                    ? "🚫 Cannot Log (Future Date)"
                    : !isClockedIn
                    ? "🚫 Cannot Log (Not Clocked In)"
                    : editingId
                    ? "💾 Save Changes"
                    : "📥 Save Task as Draft"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    className="att-btn secondary"
                    onClick={cancelEdit}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* Right: Policy & Guidelines */}
          <aside className="leave-balance-panel">
            <div className="balance-item-card">
              <span className="balance-title">Timesheet Submission Cycle</span>
              <p style={{ margin: "0.25rem 0", color: "#64748b", fontSize: "0.82rem", lineHeight: 1.5 }}>
                Weekly timesheets close every <strong>Friday at 6:00 PM IST</strong>. Approved hours are automatically reconciled with your monthly payroll calculation.
              </p>
            </div>

            <div className="balance-item-card">
              <span className="balance-title">Standard Working Hours Policy</span>
              <p style={{ margin: "0.25rem 0", color: "#64748b", fontSize: "0.82rem", lineHeight: 1.5 }}>
                Quadratic Systems operates on a 40-hour work week (8 hours/day Monday to Friday). Work exceeding 45 hours will be evaluated for overtime compensatory time-off.
              </p>
            </div>

            <div className="bulletin-box">
              💡 <strong>Audit Tip:</strong> Always tag the exact client or project name. This enables accurate R&D tax credit classification by the finance department.
            </div>
          </aside>
        </div>

        {/* =====================================================
            WEEK ENTRIES TABLE
        ===================================================== */}
        {loading || (error && String(typeof error === "string" ? error : error?.message || "").toLowerCase().includes("authorization")) ? (
          <Loader label="Loading timesheets..." />
        ) : error ? (
          <ErrorMessage message={typeof error === "string" ? error : error?.message || "Failed to load timesheets"} onRetry={() => reload(selectedDate)} />
        ) : (
          <section className="timesheet-table-panel" aria-label="Timesheet Table">
            <div className="timesheet-table-head">
              <div>
                <h2>Week Entries ({formatDate(week?.start || "2026-09-14")} – {formatDate(week?.end || "2026-09-18")})</h2>
                <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.84rem" }}>
                  Review all logged project hours for the selected week.
                </p>
              </div>
            </div>

            <div className="table-responsive-wrapper">
              <table className="att-records-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Project</th>
                    <th>Task & Description</th>
                    <th>Time Window</th>
                    <th>Hours</th>
                    <th>Status & Tracking</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingEntries.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                        🎉 No pending timesheets! All caught up.
                      </td>
                    </tr>
                  ) : pendingEntries.map((entry) => (
                    <tr key={entry._id}>
                      <td>
                        <strong>{formatDate(entry.date)}</strong>
                      </td>
                      <td>
                        <span className="project-tag-chip">
                          📁 {entry.project || "Core Platform"}
                        </span>
                      </td>
                      <td style={{ maxWidth: "280px" }}>
                        <strong style={{ display: "block", color: "#0f172a" }}>{entry.task}</strong>
                        {entry.description && (
                          <span style={{ fontSize: "0.76rem", color: "#64748b" }}>
                            {entry.description}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="time-badge">
                          {entry.startTime ? formatTime(entry.startTime) : "09:30 AM"} –{" "}
                          {entry.endTime ? formatTime(entry.endTime) : "06:30 PM"}
                        </span>
                      </td>
                      <td>
                        <span className="hours-pill">
                          ⏱️ {Number(entry.hours || 8.0).toFixed(2)} hrs
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-chip-badge ${entry.status === "rejected" ? "late" : ""}`}
                        >
                          {entry.status || "Draft"}
                        </span>
                        {entry.updatedAt && (
                          <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "4px" }}>
                            Updated: {new Date(entry.updatedAt).toLocaleString()}
                          </div>
                        )}
                        {entry.status === "rejected" && entry.rejectionReason && (
                          <div style={{ fontSize: "0.75rem", color: "#e11d48", marginTop: "4px", backgroundColor: "#fff1f2", padding: "4px 8px", borderRadius: "4px" }}>
                            <strong>Rejected by {entry.reviewer}:</strong> {entry.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="time-action-group">
                          {["draft", "rejected"].includes(entry.status) && (
                            <button
                              type="button"
                              className="time-inline-btn edit"
                              onClick={() => beginEdit(entry)}
                            >
                              Edit
                            </button>
                          )}
                          {["draft", "rejected"].includes(entry.status) && (
                            <button
                              type="button"
                              className="time-inline-btn submit"
                              onClick={() =>
                                handleAction(
                                  () => submit(entry._id),
                                  "Task submitted to HR for approval."
                                )
                              }
                            >
                              Submit
                            </button>
                          )}
                          {entry.status === "draft" && (
                            <button
                              type="button"
                              className="time-inline-btn delete"
                              onClick={() =>
                                handleAction(
                                  () => remove(entry._id),
                                  "Draft entry removed."
                                )
                              }
                            >
                              Delete
                            </button>
                          )}
                          {entry.status === "approved" && (
                            <span style={{ fontSize: "0.74rem", color: "#059669", fontWeight: 700 }}>
                              ✓ Approved
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* SUBMITTED TIMESHEETS SECTION */}
            <div className="timesheet-table-head" style={{ marginTop: "2rem", paddingTop: "2rem", borderTop: "1px dashed #cbd5e1" }}>
              <div>
                <h2 style={{ color: "#0f172a" }}>Submitted / Processed Timesheets</h2>
                <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.84rem" }}>
                  Timesheets that have been submitted to HR or fully approved.
                </p>
              </div>
            </div>

            <div className="table-responsive-wrapper">
              <table className="att-records-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Project</th>
                    <th>Task & Description</th>
                    <th>Hours</th>
                    <th>Status & Tracking</th>
                  </tr>
                </thead>
                <tbody>
                  {submittedEntries.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                        No submitted timesheets found for this week.
                      </td>
                    </tr>
                  ) : submittedEntries.map((entry) => (
                    <tr key={entry._id}>
                      <td>
                        <strong>{formatDate(entry.date)}</strong>
                      </td>
                      <td>
                        <span className="project-tag-chip">
                          📁 {entry.project || "Core Platform"}
                        </span>
                      </td>
                      <td style={{ maxWidth: "280px" }}>
                        <strong style={{ display: "block", color: "#0f172a" }}>{entry.task}</strong>
                        {entry.description && (
                          <span style={{ fontSize: "0.76rem", color: "#64748b" }}>
                            {entry.description}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="hours-pill">
                          ⏱️ {Number(entry.hours || 8.0).toFixed(2)} hrs
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-chip-badge ${
                            entry.status === "approved" ? "present" : "indigo"
                          }`}
                        >
                          {entry.status === "submitted" ? "Waiting for HR" : "Approved"}
                        </span>
                        {entry.submittedAt && (
                          <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "4px" }}>
                            Submitted: {new Date(entry.submittedAt).toLocaleString()}
                          </div>
                        )}
                        {entry.status === "approved" && entry.reviewer && (
                          <div style={{ fontSize: "0.7rem", color: "#059669", marginTop: "2px", fontWeight: "bold" }}>
                            Reviewed by {entry.reviewer}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

export default EmployeeTimesheets;
