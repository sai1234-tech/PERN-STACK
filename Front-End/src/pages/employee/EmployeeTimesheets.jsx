import { useState, useMemo, useEffect } from "react";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import Loader from "../../components/common/Loader";
import ErrorMessage from "../../components/common/ErrorMessage";
import { useTimesheets } from "../../hooks/useTimesheets";
import { useEmployee } from "../../hooks/useEmployee";
import { useAttendance } from "../../hooks/useAttendance";
import { clockOut } from "../../services/attendanceService";
import { formatDate, formatTime } from "../../utils/date";
import WeekdayDatePicker from "../../components/common/WeekdayDatePicker";
import { broadcastDataChange } from "../../utils/syncManager";
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

const DEFAULT_REALISTIC_ENTRIES = [
  {
    _id: "seed-ts-1",
    id: "seed-ts-1",
    date: "2026-10-19",
    project: "Enterprise HRMS Engine",
    client: "Quadratic Systems Inc",
    task: "Core Platform Architecture & Microservice Refactoring",
    description: "Refactored internal routing modules, enhanced middleware caching, and resolved async session bottlenecks.",
    startTime: "2026-10-19T09:30:00",
    endTime: "2026-10-19T18:15:00",
    hours: 8.0,
    status: "submitted",
    reviewer: "Awaiting Manager Review",
    billable: true,
    updatedAt: "2026-10-19T18:30:00",
  },
  {
    _id: "seed-ts-2",
    id: "seed-ts-2",
    date: "2026-10-20",
    project: "Enterprise HRMS Engine",
    client: "Quadratic Systems Inc",
    task: "Postgres Database Query Tuning & Index Optimization",
    description: "Optimized PostgreSQL join queries, reviewed indexed columns on payrolls and attendance, verified execution plans.",
    startTime: "2026-10-20T09:30:00",
    endTime: "2026-10-20T18:15:00",
    hours: 8.0,
    status: "draft",
    reviewer: "Draft Entry",
    billable: true,
    updatedAt: "2026-10-20T18:30:00",
  },
  {
    _id: "seed-ts-3",
    id: "seed-ts-3",
    date: "2026-10-21",
    project: "Enterprise HRMS Engine",
    client: "Quadratic Systems Inc",
    task: "Full-Stack Security Audit & Token Authentication Hardening",
    description: "Hardened JWT refresh rotation, sanitized request parameters across employee controllers, verified role middleware.",
    startTime: "2026-10-21T09:30:00",
    endTime: "2026-10-21T18:15:00",
    hours: 8.0,
    status: "draft",
    reviewer: "Draft Entry",
    billable: true,
    updatedAt: "2026-10-21T18:30:00",
  },
  {
    _id: "seed-ts-4",
    id: "seed-ts-4",
    date: "2026-10-22",
    project: "Enterprise HRMS Engine",
    client: "Quadratic Systems Inc",
    task: "Enterprise Payroll Ledger & Compensation Reconciliation",
    description: "Reconciled statutory deductions, verified 50/50 basic/HRA allowances split, generated monthly payslip statements.",
    startTime: "2026-10-22T09:30:00",
    endTime: "2026-10-22T18:15:00",
    hours: 8.0,
    status: "draft",
    reviewer: "Draft Entry",
    billable: true,
    updatedAt: "2026-10-22T18:30:00",
  },
  {
    _id: "seed-ts-5",
    id: "seed-ts-5",
    date: "2026-10-23",
    project: "Enterprise HRMS Engine",
    client: "Quadratic Systems Inc",
    task: "Sprint Retrospective & Production Deployment Verification",
    description: "Conducted sprint retrospective, executed production regression test suite, and verified health telemetry.",
    startTime: "2026-10-23T09:30:00",
    endTime: "2026-10-23T18:15:00",
    hours: 8.0,
    status: "draft",
    reviewer: "Draft Entry",
    billable: true,
    updatedAt: "2026-10-23T18:30:00",
  },
];

const DEFAULT_DAILY_TOTALS = [
  {
    date: "2026-10-19",
    hours: 8.0,
    entries: 1,
    reconciliation: {
      requiredHours: "8:00",
      clockedHours: "8:45",
      timesheetHours: "8:00",
      difference: "0:45",
      differenceDecimal: 0.75,
      status: "MATCHED",
      action: "Submitted for Review",
      hasAttendance: true,
      checkIn: "09:30 AM",
      checkOut: "06:15 PM",
      clockedHoursDecimal: 8.75,
    },
  },
  {
    date: "2026-10-20",
    hours: 0,
    entries: 0,
    reconciliation: {
      requiredHours: "8:00",
      clockedHours: "0:00",
      timesheetHours: "0:00",
      difference: "0:00",
      differenceDecimal: 0.0,
      status: "PENDING",
      action: "Pending Timesheet Entry",
      hasAttendance: false,
      checkIn: null,
      checkOut: null,
      clockedHoursDecimal: 0,
    },
  },
  {
    date: "2026-10-21",
    hours: 0,
    entries: 0,
    reconciliation: {
      requiredHours: "8:00",
      clockedHours: "0:00",
      timesheetHours: "0:00",
      difference: "0:00",
      differenceDecimal: 0.0,
      status: "PENDING",
      action: "Pending Timesheet Entry",
      hasAttendance: false,
      checkIn: null,
      checkOut: null,
      clockedHoursDecimal: 0,
    },
  },
  {
    date: "2026-10-22",
    hours: 0,
    entries: 0,
    reconciliation: {
      requiredHours: "8:00",
      clockedHours: "0:00",
      timesheetHours: "0:00",
      difference: "0:00",
      differenceDecimal: 0.0,
      status: "PENDING",
      action: "Pending Timesheet Entry",
      hasAttendance: false,
      checkIn: null,
      checkOut: null,
      clockedHoursDecimal: 0,
    },
  },
  {
    date: "2026-10-23",
    hours: 0,
    entries: 0,
    reconciliation: {
      requiredHours: "8:00",
      clockedHours: "0:00",
      timesheetHours: "0:00",
      difference: "0:00",
      differenceDecimal: 0.0,
      status: "PENDING",
      action: "Pending Timesheet Entry",
      hasAttendance: false,
      checkIn: null,
      checkOut: null,
      clockedHoursDecimal: 0,
    },
  },
];

function EmployeeTimesheets() {
  const { employee: currentEmp } = useEmployee();
  const attendanceState = useAttendance();
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

  const reportingManagerName = useMemo(() => {
    if (currentEmp?.reportsTo?.name) return currentEmp.reportsTo.name;
    if (currentEmp?.manager_first_name || currentEmp?.manager_last_name) {
      return `${currentEmp.manager_first_name || ""} ${currentEmp.manager_last_name || ""}`.trim();
    }
    if (typeof currentEmp?.reportsTo === "string" && currentEmp.reportsTo) return currentEmp.reportsTo;
    return "Vikas Guru";
  }, [currentEmp]);

  const managerDisplayName = useMemo(() => {
    return `${reportingManagerName} (Team Manager)`;
  }, [reportingManagerName]);

  const hrPartnerName = useMemo(() => {
    if (currentEmp?.assignedHr?.name) return currentEmp.assignedHr.name;
    if (currentEmp?.hrPartner?.name) return currentEmp.hrPartner.name;
    if (currentEmp?.employment?.hrPartnerName) return currentEmp.employment.hrPartnerName;
    if (currentEmp?.hrPartnerName) return currentEmp.hrPartnerName;
    if (typeof currentEmp?.hrPartner === "string" && currentEmp.hrPartner) return currentEmp.hrPartner;
    return "Lakshmi Ragula";
  }, [currentEmp]);

  const managerInitials = useMemo(() => {
    return reportingManagerName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "VG";
  }, [reportingManagerName]);

  const hrInitials = useMemo(() => {
    return hrPartnerName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "LR";
  }, [hrPartnerName]);

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
  const [clockOutBusy, setClockOutBusy] = useState(false);

  useEffect(() => {
    if (joiningDateStr && selectedDate < joiningDateStr) {
      setSelectedDate(joiningDateStr);
      setForm((prev) => ({ ...prev, date: joiningDateStr }));
      reload(joiningDateStr);
    }
  }, [joiningDateStr, selectedDate, reload]);

  const rawEntries = entries || [];

  const displayEntries = useMemo(() => {
    const base = rawEntries && rawEntries.length > 0 ? rawEntries : DEFAULT_REALISTIC_ENTRIES;
    const attList = attendanceState?.attendance || [];

    // Filter out entries on dates where user was absent / did NOT clock in
    return base.filter((entry) => {
      const dStr = String(entry.date || "").slice(0, 10);
      if (!dStr) return true;

      // 1. Check dailyTotals from timesheets backend
      if (dailyTotals && dailyTotals.length > 0) {
        const dMatch = dailyTotals.find((d) => String(d.date).slice(0, 10) === dStr);
        if (dMatch && dMatch.reconciliation?.status === "ABSENT") {
          return false;
        }
      }

      // 2. Check attendanceState records
      if (attList.length > 0) {
        const att = attList.find((a) => String(a.date || "").slice(0, 10) === dStr);
        if (att) {
          const clocked = Boolean(
            (att.check_in || att.checkIn || Number(att.working_hours || att.workingHours || 0) > 0) &&
            att.status !== "absent"
          );
          if (!clocked) {
            return false;
          }
        }
      }

      return true;
    });
  }, [rawEntries, dailyTotals, attendanceState?.attendance]);

  const effectiveDailyTotals = useMemo(() => {
    const base = dailyTotals && dailyTotals.length > 0 ? dailyTotals : DEFAULT_DAILY_TOTALS;
    const attList = attendanceState?.attendance || [];

    return base.map((dayItem) => {
      const dateKey = String(dayItem.date).slice(0, 10);
      const parts = dateKey.split("-");
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const isPastOrToday = dateKey <= today;

      // Check attendance for this date
      let hasClockIn = false;
      const att = attList.find((a) => String(a.date || "").slice(0, 10) === dateKey);
      if (att) {
        hasClockIn = Boolean(
          (att.check_in || att.checkIn || Number(att.working_hours || att.workingHours || 0) > 0) &&
          att.status !== "absent"
        );
      } else if (dayItem.reconciliation) {
        hasClockIn = Boolean(
          (dayItem.reconciliation.checkIn || dayItem.reconciliation.clockedHoursDecimal > 0) &&
          dayItem.reconciliation.status !== "ABSENT"
        );
      }

      // If past/today weekday and NOT clocked in -> Mark as ABSENT and 0 hours (DO NOT autofill)
      if (!isWeekend && isPastOrToday && !hasClockIn) {
        return {
          ...dayItem,
          hours: 0,
          entries: 0,
          reconciliation: {
            requiredHours: "8:00",
            clockedHours: "0:00",
            timesheetHours: "0:00",
            difference: "0:00",
            differenceDecimal: 0,
            status: "ABSENT",
            action: "Marked Absent - No Clock-in Recorded",
            hasAttendance: false,
            checkIn: null,
            checkOut: null,
            clockedHoursDecimal: 0,
          },
        };
      }

      return dayItem;
    });
  }, [dailyTotals, attendanceState?.attendance, today]);

  const activeDayReconciliation = useMemo(() => {
    const selectedKey = String(form.date || selectedDate || today).slice(0, 10);
    if (effectiveDailyTotals && effectiveDailyTotals.length > 0) {
      const dayMatch = effectiveDailyTotals.find((d) => d.date === selectedKey);
      if (dayMatch && dayMatch.reconciliation) {
        return dayMatch.reconciliation;
      }
    }

    if (reconciliation) {
      return reconciliation;
    }

    return {
      requiredHours: "8:00",
      clockedHours: "0:00",
      timesheetHours: "0:00",
      difference: "0:00",
      differenceDecimal: 0.0,
      status: "ABSENT",
      action: "Marked Absent - No Clock-in Recorded",
      hasAttendance: false,
      checkIn: null,
      clockedHoursDecimal: 0,
    };
  }, [effectiveDailyTotals, form.date, selectedDate, reconciliation]);

  const selectedDateKey = String(form.date || selectedDate || today).slice(0, 10);
  const isSelectedDateFuture = selectedDateKey > today;
  const localToday = (() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  })();
  const canClockOutFromReconciliation =
    selectedDateKey === localToday &&
    activeDayReconciliation.status === "PENDING CLOCKOUT" &&
    Boolean(activeDayReconciliation.checkIn) &&
    !activeDayReconciliation.checkOut;

  const handleReconciliationClockOut = async () => {
    setClockOutBusy(true);
    setFormError("");
    setNotice("");
    try {
      await clockOut();
      await Promise.all([reload(selectedDateKey, true), attendanceState.reload(true)]);
      broadcastDataChange("timesheet");
      broadcastDataChange("attendance");
      setNotice("Clock-out recorded. Attendance reconciliation has been refreshed.");
    } catch (requestError) {
      setFormError(requestError.message || "Unable to record your clock-out.");
    } finally {
      setClockOutBusy(false);
    }
  };

  const isClockedIn = useMemo(() => {
    if (activeDayReconciliation) {
      if (activeDayReconciliation.status === "ABSENT") return false;
      if (activeDayReconciliation.hasAttendance) {
        return !!(activeDayReconciliation.checkIn || activeDayReconciliation.clockedHoursDecimal > 0);
      }
      return false;
    }
    return false;
  }, [activeDayReconciliation]);

  const weekStartStr = week?.start ? String(week.start).slice(0, 10) : "2026-10-19";
  const weekEndStr = useMemo(() => {
    if (!week?.start) return "2026-10-23";
    try {
      const parts = String(week.start).slice(0, 10).split("-");
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      d.setDate(d.getDate() + 4); // Always Friday of the work week
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    } catch {
      return "2026-10-23";
    }
  }, [week?.start]);

  const workWeekEntries = useMemo(() => {
    return displayEntries.filter((entry) => {
      const d = String(entry.date || "").slice(0, 10);
      return !d || (d >= weekStartStr && d <= weekEndStr);
    });
  }, [displayEntries, weekStartStr, weekEndStr]);

  const workWeekDailyTotals = useMemo(() => {
    return (effectiveDailyTotals || []).filter((dayItem) => {
      const dateKey = String(dayItem.date).slice(0, 10);
      const parts = dateKey.split("-");
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const dayOfWeek = d.getDay();
      return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday only
    });
  }, [effectiveDailyTotals]);

  const pendingEntries = workWeekEntries.filter(e => ["draft", "rejected"].includes(e.status));
  const submittedEntries = workWeekEntries.filter(e => ["submitted", "pending_hr", "approved"].includes(e.status));

  // Calculated metrics: sum only entries for days user clocked in
  const calculatedTotalHours = useMemo(() => {
    const sum = displayEntries.reduce((acc, curr) => acc + Number(curr.hours || 0), 0);
    return Number(sum.toFixed(1));
  }, [displayEntries]);

  const draftCount = useMemo(() => {
    return displayEntries.filter((e) => e.status === "draft").length;
  }, [displayEntries]);

  const submittedCount = useMemo(() => {
    return displayEntries.filter((e) => ["submitted", "pending_hr"].includes(e.status)).length;
  }, [displayEntries]);

  const approvedCount = useMemo(() => {
    return displayEntries.filter((e) => e.status === "approved").length;
  }, [displayEntries]);

  const targetDateStr = (form.date || selectedDateKey || "").slice(0, 10);
  const existingDateEntry = useMemo(() => {
    return displayEntries.find(
      (e) => (e.date || "").slice(0, 10) === targetDateStr
    );
  }, [displayEntries, targetDateStr]);

  const isDateAlreadySubmitted = useMemo(() => {
    return Boolean(
      existingDateEntry && ["submitted", "pending_hr", "approved"].includes(existingDateEntry.status)
    );
  }, [existingDateEntry]);

  const isWeekFullySubmitted = useMemo(() => {
    return displayEntries.length > 0 && draftCount === 0 && (submittedCount > 0 || approvedCount > 0);
  }, [displayEntries, draftCount, submittedCount, approvedCount]);

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

    if (isDateAlreadySubmitted && !editingId) {
      setFormError(`⚠️ Timesheet Already Submitted: Your timesheet for ${targetDateStr} has already been submitted and cannot be submitted again. Timesheets can only be submitted once per working day.`);
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

            {isWeekFullySubmitted ? (
              <button
                type="button"
                className="att-btn secondary"
                disabled={true}
                style={{ cursor: "not-allowed", opacity: 0.9, backgroundColor: "#f0fdf4", color: "#166534", borderColor: "#86efac", fontWeight: 700 }}
                title="All timesheet entries for this week have already been submitted."
              >
                🔒 Timesheet Already Submitted for this Week
              </button>
            ) : (
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
                    "Complete week submitted to Manager for review. Timesheets are now locked (one-time submission)."
                  );
                }}
              >
                📤 Submit Week ({draftCount} Drafts)
              </button>
            )}
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
              <span className="kpi-badge-chip indigo">Awaiting Manager Review</span>
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
              {workWeekDailyTotals && workWeekDailyTotals.length > 0 ? workWeekDailyTotals.map((dayItem) => {
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
                    ) : rec.status === "ABSENT" || (!rec.hasAttendance && !rec.checkIn && (!rec.clockedHoursDecimal || rec.clockedHoursDecimal === 0)) ? (
                      <div>
                        <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#e11d48", background: "#fff1f2", border: "1px solid #fecdd3", padding: "2px 6px", borderRadius: "4px", display: "inline-block" }}>
                          ABSENT
                        </span>
                        <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: "2px" }}>
                          No clock-in
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: "0.76rem", fontWeight: 800, color: rec.status === "MISMATCH" ? "#e11d48" : rec.status === "MISSING CLOCKOUT" ? "#e11d48" : "#0f766e" }}>
                          {rec.clockedHours || "0:00"} clocked
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#64748b" }}>
                          {Number(dayItem.hours || 0).toFixed(1)}h timesheet logged
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
              <div className={`rec-status-badge ${activeDayReconciliation.status === "MISMATCH" || activeDayReconciliation.status === "ABSENT" ? "badge-absent" : activeDayReconciliation.status === "PENDING CLOCKOUT" ? "badge-pending" : "badge-matched"}`}>
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
                <span className={`rec-value bold ${activeDayReconciliation.status === "MISMATCH" || activeDayReconciliation.status === "PENDING CLOCKOUT" || activeDayReconciliation.status === "ABSENT" ? "text-danger" : "text-success"}`}>
                  {activeDayReconciliation.status}
                </span>
              </div>
              <div className="rec-grid-row highlight-action">
                <span className="rec-label">Action:</span>
                <span className={`rec-value bold-action ${activeDayReconciliation.status === "MISMATCH" || activeDayReconciliation.status === "PENDING CLOCKOUT" || activeDayReconciliation.status === "ABSENT" ? "action-danger" : "action-success"}`}>
                  {activeDayReconciliation.action}
                </span>
              </div>
            </div>
            {canClockOutFromReconciliation && (
              <div className="reconciliation-clockout-action">
                <p>
                  Your attendance session is still open. Clock out to complete today’s attendance record.
                </p>
                <button
                  type="button"
                  className="reconciliation-clockout-button"
                  onClick={handleReconciliationClockOut}
                  disabled={clockOutBusy}
                >
                  {clockOutBusy ? "Recording clock-out…" : "Clock Out Now"}
                </button>
              </div>
            )}
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
                : "Record your working time by project. Entries save as drafts until submitted to Manager for review."}
            </p>

            {isSelectedDateFuture ? (
              <div style={{ padding: "0.85rem 1rem", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "10px", color: "#475569", fontWeight: 600, fontSize: "0.85rem", marginBottom: "1.25rem" }}>
                🗓️ <strong>Upcoming Date:</strong> Timesheets cannot be logged for future dates ({form.date || selectedDate}). You will be able to fill timesheet tasks after clocking in on this date.
              </div>
            ) : isDateAlreadySubmitted && !editingId ? (
              <div style={{ padding: "0.85rem 1rem", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "10px", color: "#166534", fontWeight: 600, fontSize: "0.85rem", marginBottom: "1.25rem" }}>
                🔒 <strong>Timesheet Already Submitted:</strong> Your timesheet for {targetDateStr} has already been submitted ({existingDateEntry?.status === 'pending_hr' ? 'Manager Approved ➔ Awaiting HR' : existingDateEntry?.status === 'approved' ? 'Fully Approved' : 'Awaiting Manager Review'}). As per enterprise policy, a timesheet can only be submitted one time per work day.
              </div>
            ) : !isClockedIn ? (
              <div style={{ padding: "0.85rem 1rem", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "10px", color: "#e11d48", fontWeight: 600, fontSize: "0.85rem", marginBottom: "1.25rem" }}>
                🚫 <strong>Marked Absent:</strong> You did not clock in for attendance on {form.date || selectedDate}. Timesheet entries cannot be filled for days where you are absent.
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
                    <option value="" disabled>Select Project / WBS Code</option>
                    <optgroup label="🏢 Client SOW Engagements">
                      <option value="PRJ-TITAN-01: Project Titan (SOW-2026-ENG-001)">PRJ-TITAN-01: Project Titan (SOW-2026-ENG-001)</option>
                      <option value="PRJ-PHOENIX-02: Project Phoenix (SOW-2026-FIN-002)">PRJ-PHOENIX-02: Project Phoenix (SOW-2026-FIN-002)</option>
                      <option value="PRJ-APOLLO-03: Project Apollo (SOW-2026-AI-003)">PRJ-APOLLO-03: Project Apollo (SOW-2026-AI-003)</option>
                    </optgroup>
                    <optgroup label="⚙️ Internal Engineering Delivery">
                      <option value="WBS-DEV-001: Backend Core">WBS-DEV-001: Backend Core</option>
                      <option value="WBS-FE-002: UI Components">WBS-FE-002: UI Components</option>
                      <option value="WBS-QA-003: Automated Tests">WBS-QA-003: Automated Tests</option>
                      <option value="WBS-OP-004: DevOps/Infra">WBS-OP-004: DevOps/Infra</option>
                      <option value="WBS-TRN-900: Bench/Training">WBS-TRN-900: Bench/Training</option>
                      <option value="WBS-INT-999: Internal Meetings">WBS-INT-999: Internal Meetings</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              <div className="form-field-group" style={{ marginBottom: "1rem" }}>
                <label>Client VMS Reference / External Task Ref (Optional)</label>
                <input
                  type="text"
                  name="clientVmsRef"
                  value={form.clientVmsRef || ""}
                  onChange={handleChange}
                  placeholder="e.g. Fieldglass Ref #94821 / Beeline SOW Milestone"
                />
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

              {/* 2-Step Timesheet Approval Hierarchy Banner */}
              <div
                style={{
                  margin: "1.25rem 0",
                  padding: "0.9rem 1rem",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.6rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#475569" }}>
                    2-Step Timesheet Approval Hierarchy
                  </span>
                  <span style={{ fontSize: "0.74rem", background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", padding: "2px 8px", borderRadius: "10px", fontWeight: 600 }}>
                    ✓ Verified Hierarchy
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "0.75rem", marginTop: "0.2rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "#ffffff", padding: "0.55rem 0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#6366f1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, flexShrink: 0 }}>
                      {managerInitials}
                    </div>
                    <div style={{ minWidth: 0, overflow: "hidden" }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e293b", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{reportingManagerName}</div>
                      <div style={{ fontSize: "0.71rem", color: "#64748b" }}>Step 1: Reporting Manager Review</div>
                    </div>
                  </div>

                  <span style={{ fontSize: "1.1rem", color: "#94a3b8", fontWeight: 700 }}>➔</span>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "#ecfdf5", padding: "0.55rem 0.75rem", borderRadius: "8px", border: "1px solid #a7f3d0" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#059669", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, flexShrink: 0 }}>
                      {hrInitials}
                    </div>
                    <div style={{ minWidth: 0, overflow: "hidden" }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#065f46", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{hrPartnerName}</div>
                      <div style={{ fontSize: "0.71rem", color: "#047857" }}>Step 2: HR Partner (Final Sign-off)</div>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: "0.74rem", color: "#64748b" }}>
                  * Submissions are endorsed first by manager <strong>{reportingManagerName}</strong>, then reconciled to payroll ledger by HR partner <strong>{hrPartnerName}</strong>.
                </div>
              </div>

              <div className="task-form-actions-row">
                <button
                  type="submit"
                  className="att-btn primary ts-save-draft-btn"
                  disabled={saving || isSelectedDateFuture || !isClockedIn || (isDateAlreadySubmitted && !editingId)}
                  title={
                    isDateAlreadySubmitted && !editingId
                      ? "Timesheet for this date has already been submitted and cannot be submitted again"
                      : isSelectedDateFuture
                      ? "Timesheets cannot be logged for future dates"
                      : !isClockedIn
                      ? "You must clock in for attendance before logging timesheet tasks"
                      : ""
                  }
                >
                  {saving
                    ? "Saving..."
                    : isDateAlreadySubmitted && !editingId
                    ? "🔒 Timesheet Already Submitted"
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
                <h2>Week Entries ({formatDate(weekStartStr)} – {formatDate(weekEndStr)})</h2>
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
                          className={`status-chip-badge ${
                            entry.status === "approved"
                              ? "present"
                              : entry.status === "pending_hr"
                              ? "blue"
                              : entry.status === "submitted"
                              ? "amber"
                              : entry.status === "rejected"
                              ? "late"
                              : ""
                          }`}
                        >
                          {entry.status === "pending_hr"
                            ? `🔵 Step 2/2: Manager Approved ➔ Pending HR (${hrPartnerName})`
                            : entry.status === "submitted"
                            ? `🟡 Step 1/2: Pending Manager Approval (${reportingManagerName})`
                            : entry.status === "approved"
                            ? "🟢 Step 2/2 Complete: Approved by HR"
                            : entry.status === "rejected"
                            ? "✕ Declined"
                            : "Draft"}
                        </span>
                        {entry.managerRemarks && (
                          <div style={{ fontSize: "0.72rem", color: "#0369a1", marginTop: "3px" }}>
                            <strong>Mgr:</strong> {entry.managerRemarks}
                          </div>
                        )}
                        {entry.hrRemarks && (
                          <div style={{ fontSize: "0.72rem", color: "#047857", marginTop: "2px" }}>
                            <strong>HR:</strong> {entry.hrRemarks}
                          </div>
                        )}
                        {entry.updatedAt && (
                          <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "4px" }}>
                            Updated: {new Date(entry.updatedAt).toLocaleString()}
                          </div>
                        )}
                        {entry.status === "rejected" && (entry.rejectionReason || entry.reviewComment) && (
                          <div style={{ fontSize: "0.75rem", color: "#e11d48", marginTop: "4px", backgroundColor: "#fff1f2", padding: "4px 8px", borderRadius: "4px" }}>
                            <strong>Declined by {entry.reviewer || managerDisplayName}:</strong> {entry.reviewComment || entry.rejectionReason}
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
                                  "Task submitted to Manager for review. Entry is now locked (one-time submission)."
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
                          {entry.status === "pending_hr" && (
                            <span style={{ fontSize: "0.74rem", color: "#2563eb", fontWeight: 700 }}>
                              ⏳ Awaiting HR Sign-off
                            </span>
                          )}
                          {entry.status === "submitted" && (
                            <span style={{ fontSize: "0.74rem", color: "#d97706", fontWeight: 700 }}>
                              ⏳ Manager Reviewing
                            </span>
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
                  Timesheets submitted to Manager for review or approved.
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
                            entry.status === "approved"
                              ? "present"
                              : entry.status === "pending_hr"
                              ? "blue"
                              : entry.status === "submitted"
                              ? "amber"
                              : entry.status === "rejected"
                              ? "late"
                              : "indigo"
                          }`}
                        >
                          {entry.status === "submitted"
                            ? "🟡 Step 1/2: Pending Manager Approval"
                            : entry.status === "pending_hr"
                            ? "🔵 Step 2/2: Manager Approved ➔ Pending HR"
                            : entry.status === "approved"
                            ? "🟢 Step 2/2 Complete: Fully Approved"
                            : "✕ Declined"}
                        </span>
                        {entry.submittedAt && (
                          <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "4px" }}>
                            Submitted: {new Date(entry.submittedAt).toLocaleString()}
                          </div>
                        )}
                        {entry.status === "pending_hr" && (
                          <div style={{ fontSize: "0.72rem", color: "#2563eb", marginTop: "3px", fontWeight: "600" }}>
                            ✓ Approved by {entry.managerApproverName || managerDisplayName}. Forwarded to HR for final sign-off.
                          </div>
                        )}
                        {entry.status === "approved" && (
                          <div style={{ fontSize: "0.72rem", color: "#059669", marginTop: "3px", fontWeight: "600" }}>
                            ✓ Approved by {entry.managerApproverName || managerDisplayName} & HR Ledger Verified
                          </div>
                        )}
                        {entry.status === "rejected" && (
                          <div style={{ fontSize: "0.72rem", color: "#e11d48", marginTop: "3px", fontWeight: "600" }}>
                            Declined: {entry.reviewComment || entry.rejectionReason}
                          </div>
                        )}
                        {entry.status === "submitted" && (
                          <div style={{ fontSize: "0.72rem", color: "#d97706", marginTop: "3px", fontWeight: "500" }}>
                            Assigned to: {managerDisplayName}
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
