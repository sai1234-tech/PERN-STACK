import { useCallback, useEffect, useState } from "react";
import { getEmployee, getEmployeeById, getAllEmployees } from "../services/employeeService";
import { useSyncRefresh } from "../utils/syncManager";

export function useEmployee(targetId = null) {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEmployee = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const searchId = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("id") ||
          new URLSearchParams(window.location.search).get("code") ||
          new URLSearchParams(window.location.search).get("employeeId")
        : null;

      const explicitTarget = targetId || searchId;

      // Only search for targeted employee if explicitTarget is explicitly passed via parameter or URL
      if (explicitTarget && explicitTarget !== "me") {
        const byIdRes = await getEmployeeById(explicitTarget).catch(() => null);
        if (byIdRes && (byIdRes.employee || byIdRes.data)) {
          setEmployee(byIdRes.employee || byIdRes.data);
          if (!silent) setLoading(false);
          return;
        }

        // Fallback search in all employees list for matching ID or code
        const allRes = await getAllEmployees().catch(() => null);
        const list = Array.isArray(allRes?.data) ? allRes.data : Array.isArray(allRes) ? allRes : [];
        const match = list.find((e) =>
          (e._id && String(e._id) === String(explicitTarget)) ||
          (e.id && String(e.id) === String(explicitTarget)) ||
          (e.employeeCode && String(e.employeeCode).toUpperCase() === String(explicitTarget).toUpperCase()) ||
          (e.email && String(e.email).toLowerCase() === String(explicitTarget).toLowerCase())
        );
        if (match) {
          setEmployee(match);
          if (!silent) setLoading(false);
          return;
        }
      }

      // Default: Load logged-in user profile (/employee/me)
      const response = await getEmployee().catch(() => null);
      if (response && (response.employee || response.data)) {
        setEmployee(response.employee || response.data);
      } else {
        const storedEmp = sessionStorage.getItem("hrms_employee")
          ? JSON.parse(sessionStorage.getItem("hrms_employee"))
          : null;
        const storedUser = sessionStorage.getItem("hrms_user")
          ? JSON.parse(sessionStorage.getItem("hrms_user"))
          : null;
        setEmployee(storedEmp || storedUser || null);
      }
    } catch (requestError) {
      if (!silent) setError(requestError.message || "Failed to load employee profile.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [targetId]);

  useEffect(() => {
    loadEmployee();
  }, [loadEmployee]);

  useSyncRefresh(loadEmployee, { interval: 30000, silent: true });

  return { employee, loading, error, reload: loadEmployee };
}
