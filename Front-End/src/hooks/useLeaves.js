import { useCallback, useEffect, useState } from "react";
import {
  applyForLeave,
  cancelLeave,
  getLeaveBalance,
  getLeaveTypes,
  getLeaves,
  updateLeave,
  deleteLeave,
} from "../services/leaveService";
import { useSyncRefresh } from "../utils/syncManager";

export function useLeaves() {
  const [leaves, setLeaves] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balance, setBalance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLeaves = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [response, typesResponse, balanceResponse] = await Promise.all([
        getLeaves(),
        getLeaveTypes(),
        getLeaveBalance(),
      ]);
      const records = response?.leaves || response?.records || response?.data || [];
      const types = typesResponse?.leaveTypes || typesResponse?.types || typesResponse?.data || [];
      const balanceRecords = balanceResponse?.data || balanceResponse?.balance || [];
      setLeaves(Array.isArray(records) ? records : [records]);
      setLeaveTypes(Array.isArray(types) ? types : [types]);
      setBalance(Array.isArray(balanceRecords) ? balanceRecords : [balanceRecords]);
    } catch (requestError) {
      if (!silent) setError(requestError.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaves();
  }, [loadLeaves]);

  useSyncRefresh(loadLeaves, { interval: 30000, silent: true });

  const submitLeave = async (data) => {
    await applyForLeave(data);
    await loadLeaves(true);
  };

  const cancel = async (leaveId) => {
    await cancelLeave(leaveId);
    await loadLeaves(true);
  };

  const updateExistingLeave = async (leaveId, data) => {
    await updateLeave(leaveId, data);
    await loadLeaves(true);
  };

  const deleteExistingLeave = async (leaveId) => {
    await deleteLeave(leaveId);
    await loadLeaves(true);
  };

  return {
    leaves,
    leaveTypes,
    balance,
    loading,
    error,
    reload: loadLeaves,
    submitLeave,
    cancel,
    updateExistingLeave,
    deleteExistingLeave,
  };
}
