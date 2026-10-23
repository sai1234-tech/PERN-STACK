import { apiRequest } from "./apiClient";
import { broadcastDataChange } from "../utils/syncManager";

export async function getAllAllocations() {
  const res = await apiRequest("/allocation");
  return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
}

export async function getEmployeeAllocation(empId) {
  const res = await apiRequest(`/allocation/employee/${empId}`);
  return res?.data || res;
}

export async function upsertAllocation(allocationData) {
  const res = await apiRequest("/allocation", {
    method: "POST",
    body: JSON.stringify(allocationData),
  });
  broadcastDataChange("allocations", { action: "upsert", timestamp: Date.now() });
  return res?.data || res;
}

export async function updateAllocationStatus(id, status, projectName) {
  const res = await apiRequest(`/allocation/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, projectName }),
  });
  broadcastDataChange("allocations", { action: "statusChange", status, timestamp: Date.now() });
  return res?.data || res;
}

export async function deleteAllocation(id) {
  const res = await apiRequest(`/allocation/${id}`, {
    method: "DELETE",
  });
  broadcastDataChange("allocations", { action: "delete", id, timestamp: Date.now() });
  return res?.data || res;
}
