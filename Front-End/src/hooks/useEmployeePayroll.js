import { useCallback, useEffect, useState } from "react";
import {
  getMyPayslip,
  getMySalary,
  normalizePayslip,
  unwrapPayrollData,
} from "../services/payrollService";
import { useSyncRefresh } from "../utils/syncManager";

export function useEmployeePayroll(month, year) {
  const [salary, setSalary] = useState(null);
  const [payslip, setPayslip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [salaryResult, payslipResult] = await Promise.allSettled([
        getMySalary(month, year),
        getMyPayslip(month, year),
      ]);
      if (salaryResult.status === "rejected") throw salaryResult.reason;
      setSalary(unwrapPayrollData(salaryResult.value, ["salary"]));
      if (payslipResult.status === "fulfilled") {
        setPayslip(normalizePayslip(payslipResult.value));
      } else if ([401, 403].includes(payslipResult.reason?.status)) {
        throw payslipResult.reason;
      } else {
        setPayslip(null);
      }
    } catch (requestError) {
      if (!silent) setError(requestError.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load]);

  useSyncRefresh(load, { interval: 30000, silent: true });

  return { salary, payslip, loading, error, reload: load };
}