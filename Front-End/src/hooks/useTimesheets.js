import { useCallback, useEffect, useState } from "react";
import {
  createTimesheet,
  deleteTimesheet,
  getMyWeek,
  submitTimesheet,
  submitWeek,
  updateTimesheet,
} from "../services/timesheetService";
import { useSyncRefresh } from "../utils/syncManager";

function normalizeWeek(response) {
  const data = response?.data || response || {};
  let entries = Array.isArray(data.entries) ? data.entries : [];

  // Calculate unsubmitted for today (EOD check helper)
  const localDate = new Date();
  const todayDateStr = new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const todaysTimesheet = entries.find(e => (e.date || "").substring(0, 10) === todayDateStr);
  const hasUnsubmittedToday = !todaysTimesheet || ["draft", "rejected"].includes(todaysTimesheet.status);

  // EOD threshold (e.g., 5:00 PM local)
  const eodHour = 17;
  const isPastEOD = new Date().getHours() >= eodHour;
  const needsEODReminder = hasUnsubmittedToday && isPastEOD;

  return {
    entries,
    totalHours: Number(data.totalHours || entries.reduce((a,c) => a + (c.hours||0), 0)),
    statusCounts: data.statusCounts || {},
    week: data.week || {},
    dailyTotals: data.dailyTotals || [],
    reconciliation: data.reconciliation || null,
    weekReconciliation: data.weekReconciliation || null,
    needsEODReminder,
    hasUnsubmittedToday,
    pendingCount: entries.filter(e => ["draft", "rejected"].includes(e.status)).length,
    submittedCount: entries.filter(e => ["submitted", "approved"].includes(e.status)).length,
  };
}

export function useTimesheets() {
  const [timesheetWeek, setTimesheetWeek] = useState(() => normalizeWeek({}));
  const [activeDate, setActiveDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWeek = useCallback(async (date, silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    const targetDate = date !== undefined ? date : activeDate;
    if (date !== undefined) setActiveDate(date || "");

    try {
      setTimesheetWeek(normalizeWeek(await getMyWeek(targetDate)));
    } catch (requestError) {
      if (!silent) setError(requestError.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [activeDate]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  useSyncRefresh(() => loadWeek(activeDate, true), { interval: 30000, silent: true });

  const performAction = async (action) => {
    await action();
    await loadWeek(activeDate, true);
  };

  return {
    ...timesheetWeek,
    loading,
    error,
    reload: loadWeek,
    create: (data) => performAction(() => createTimesheet(data)),
    update: (id, data) => performAction(() => updateTimesheet(id, data)),
    remove: (id) => performAction(() => deleteTimesheet(id)),
    submit: (id) => performAction(() => submitTimesheet(id)),
    submitAll: (date) => performAction(() => submitWeek(date)),
  };
}