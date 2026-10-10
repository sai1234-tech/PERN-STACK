import { useCallback, useEffect, useState } from "react";
import { clockIn, clockOut, getAttendance, getTodayAttendance } from "../services/attendanceService";
import { useSyncRefresh } from "../utils/syncManager";

export function useAttendance() {
  const [attendance, setAttendance] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAttendance = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [historyResult, todayResult] = await Promise.allSettled([
        getAttendance(),
        getTodayAttendance(),
      ]);

      if (historyResult.status === "fulfilled") {
        const response = historyResult.value;
        const records = response.attendance || response.records || response.data || [];
        setAttendance(Array.isArray(records) ? records : [records]);
      } else if (!silent) {
        setError(historyResult.reason.message);
      }

      if (todayResult.status === "fulfilled") {
        const response = todayResult.value;
        const todayData = response.data || response;
        const todayRecord = response.attendance || todayData.attendance || todayData || null;
        setTodayAttendance(Array.isArray(todayRecord) ? todayRecord[0] || null : todayRecord);
      } else if (todayResult.reason?.message?.toLowerCase().includes("no attendance")) {
        setTodayAttendance(null);
      }
    } catch (requestError) {
      if (!silent) setError(requestError.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  useSyncRefresh(loadAttendance, { interval: 30000, silent: true });

  const performAction = async (action) => {
    try {
      setError("");
      await action();
      await loadAttendance(true);
    } catch (err) {
      setError(err.message || "Attendance action failed");
      console.error("[useAttendance] Action failed:", err);
    }
  };

  return {
    attendance,
    todayAttendance,
    loading,
    error,
    reload: loadAttendance,
    clockIn: () => performAction(clockIn),
    clockOut: () => performAction(clockOut),
  };
}
