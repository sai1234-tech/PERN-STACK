import { useCallback, useEffect, useState } from "react";
import {
  generatePayroll,
  getPayroll,
  updateEmployeeSalary,
  unwrapPayrollData,
} from "../services/payrollService";
import { useSyncRefresh } from "../utils/syncManager";

function listData(response) {
  const payload = unwrapPayrollData(response, ["payroll", "records", "items"]);
  if (Array.isArray(payload)) return payload;
  return payload?.payroll || payload?.records || payload?.items || [];
}

export function useHRPayroll(filters) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await getPayroll(filters);
      setRecords(listData(response));
    } catch (requestError) {
      if (!silent) setError(requestError.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  useSyncRefresh(load, { interval: 30000, silent: true });

  const generate = async (data) => {
    await generatePayroll(data);
    await load(true);
  };

  const updateSalary = async (employeeId, data) => {
    await updateEmployeeSalary(employeeId, data);
    await load(true);
  };

  return { records, loading, error, reload: load, generate, updateSalary };
}