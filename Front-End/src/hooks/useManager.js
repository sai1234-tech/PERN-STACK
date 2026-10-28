import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "../services/apiClient";
import {
  ALLOCATION_STORAGE_KEY,
  loadUnifiedResourceMatrix,
  upsertAllocation,
} from "../services/allocationService";
import { useSyncRefresh, broadcastDataChange } from "../utils/syncManager";

export const useManager = () => {
  const [overview, setOverview] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [resignations, setResignations] = useState([]);
  const [allocatedResources, setAllocatedResources] = useState([]);
  const [benchResources, setBenchResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLeaves = useCallback(async () => {
    try {
      const res = await apiRequest("/manager/team-leaves");
      if (res?.success) setLeaves(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch leaves:", err);
    }
  }, []);

  const fetchTimesheets = useCallback(async () => {
    try {
      const res = await apiRequest("/manager/team-timesheets");
      if (res?.success) setTimesheets(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch timesheets:", err);
    }
  }, []);

  const fetchResignations = useCallback(async () => {
    try {
      const res = await apiRequest("/resignations/team");
      if (res?.success) setResignations(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch resignations:", err);
    }
  }, []);

  const fetchWorkforceAndProjects = useCallback(async () => {
    try {
      const unified = await loadUnifiedResourceMatrix();
      const enrichedMembers = unified.matrixItems || [];
      const allocatedList = unified.allocatedResources || [];
      const benchList = unified.benchResources || [];
      const rawOverview = unified.rawOverview || {};

      setAllocatedResources(allocatedList);
      setBenchResources(benchList);

      setOverview({
        ...rawOverview,
        teamSize: enrichedMembers.length,
        teamMembers: enrichedMembers,
        pendingLeaves: rawOverview?.pendingLeaves || 0,
        pendingTimesheets: rawOverview?.pendingTimesheets || 0,
      });

      setProjects(unified.activeProjects || []);
    } catch (err) {
      console.error("Failed to fetch workforce and projects:", err);
    }
  }, []);

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      await Promise.allSettled([
        fetchWorkforceAndProjects(),
        fetchLeaves(),
        fetchTimesheets(),
        fetchResignations(),
      ]);
    } catch (err) {
      console.warn("Notice loading manager data:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchWorkforceAndProjects, fetchLeaves, fetchTimesheets, fetchResignations]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Real-time live sync: refresh on mutations, cross-tab events, window focus & 4s background interval
  useSyncRefresh(loadAll, { interval: 4000, silent: true });

  const updateResourceAllocation = async (emp, status, project = null, sowNumber = null) => {
    if (!emp) return false;
    const key = String(emp.id ?? emp._id);
    try {
      let currentMap = {};
      try {
        const saved = localStorage.getItem(ALLOCATION_STORAGE_KEY);
        if (saved) currentMap = JSON.parse(saved) || {};
      } catch (_) {}

      currentMap[key] = {
        status,
        project: status === "Allocated" ? project : null,
        sowNumber: status === "Allocated" ? (sowNumber || "") : "",
        name: emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
        code: emp.code || emp.employeeCode || "EMP",
        department: emp.department || emp.employment?.department || "Engineering",
        role: emp.role || emp.employment?.designation || "Engineer",
        releasedToBench: status === "Bench",
      };

      localStorage.setItem(ALLOCATION_STORAGE_KEY, JSON.stringify(currentMap));
      window.dispatchEvent(new CustomEvent("hrms_data_updated", { detail: { category: "allocations" } }));
      window.dispatchEvent(new CustomEvent("hrms:data_changed"));

      await upsertAllocation({
        empId: key,
        employeeName: currentMap[key].name,
        employeeCode: currentMap[key].code,
        department: currentMap[key].department,
        role: currentMap[key].role,
        projectName: status === "Allocated" ? (project || "") : "",
        sowNumber: status === "Allocated" ? (sowNumber || "") : "",
        status,
        billability: status === "Allocated" ? "Billable" : "Internal",
        allocationPercentage: status === "Allocated" ? 100 : 0,
        notes: status === "Bench" ? "RELEASED_TO_BENCH" : "",
      }).catch(() => {});

      await fetchWorkforceAndProjects();
      return true;
    } catch (err) {
      console.error("Failed to update resource allocation:", err);
      return false;
    }
  };

  const approveLeave = async (id, remarks) => {
    try {
      const res = await apiRequest(`/manager/team-leaves/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "approved", remarks }),
      });
      if (res.success) {
        broadcastDataChange("leave");
        await loadAll(true);
        return true;
      }
    } catch (err) {
      console.error("Approve leave error:", err);
      return false;
    }
  };

  const rejectLeave = async (id, remarks) => {
    try {
      const res = await apiRequest(`/manager/team-leaves/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "rejected", remarks }),
      });
      if (res.success) {
        broadcastDataChange("leave");
        await loadAll(true);
        return true;
      }
    } catch (err) {
      console.error("Reject leave error:", err);
      return false;
    }
  };

  const approveTimesheet = async (id, comment) => {
    try {
      const res = await apiRequest(`/manager/team-timesheets/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "approved", reviewComment: comment }),
      });
      if (res.success) {
        broadcastDataChange("timesheet");
        await loadAll(true);
        return true;
      }
    } catch (err) {
      console.error("Approve timesheet error:", err);
      return false;
    }
  };

  const rejectTimesheet = async (id, comment) => {
    try {
      const res = await apiRequest(`/manager/team-timesheets/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "rejected", reviewComment: comment }),
      });
      if (res.success) {
        broadcastDataChange("timesheet");
        await loadAll(true);
        return true;
      }
    } catch (err) {
      console.error("Reject timesheet error:", err);
      return false;
    }
  };

  const approveResignation = async (id, comment) => {
    try {
      const res = await apiRequest(`/resignations/${id}/manager-review`, {
        method: "PATCH",
        body: JSON.stringify({ status: "manager_approved", managerReviewComment: comment }),
      });
      if (res.success) {
        await loadAll(true);
        return true;
      }
    } catch (err) {
      console.error("Approve resignation error:", err);
      return false;
    }
  };

  const rejectResignation = async (id, comment) => {
    try {
      const res = await apiRequest(`/resignations/${id}/manager-review`, {
        method: "PATCH",
        body: JSON.stringify({ status: "manager_rejected", managerReviewComment: comment }),
      });
      if (res.success) {
        await loadAll(true);
        return true;
      }
    } catch (err) {
      console.error("Reject resignation error:", err);
      return false;
    }
  };

  return {
    overview,
    leaves,
    timesheets,
    projects,
    resignations,
    allocatedResources,
    benchResources,
    loading,
    error,
    refresh: loadAll,
    updateResourceAllocation,
    approveLeave,
    rejectLeave,
    approveTimesheet,
    rejectTimesheet,
    approveResignation,
    rejectResignation,
  };
};
