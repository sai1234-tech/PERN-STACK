import { useCallback, useEffect, useState } from "react";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import LeaveManagement from "../../components/hr/LeaveManagement";
import Loader from "../../components/common/Loader";
import ErrorMessage from "../../components/common/ErrorMessage";
import { getAllLeaves } from "../../services/hrService";
import { useSyncRefresh } from "../../utils/syncManager";
import "../../styles/employee/leaves.css";

function HRLeaveManagement() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await getAllLeaves();
      const records = response?.data || response?.leaves || response?.records || [];
      setLeaves(Array.isArray(records) ? records : []);
    } catch (err) {
      if (!silent) setError(err.message || "Failed to load leave requests");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useSyncRefresh(() => loadData(true), { interval: 10000, silent: true });

  return (
    <>
      <EmployeeHeader />
      <main className="employee-leaves-hub" style={{ padding: "1.5rem 2rem" }}>
        {loading ? (
          <Loader label="Loading workforce leave requests..." />
        ) : error ? (
          <ErrorMessage message={error} onRetry={() => loadData()} />
        ) : (
          <LeaveManagement leaves={leaves} onChanged={() => loadData(true)} />
        )}
      </main>
    </>
  );
}

export default HRLeaveManagement;
