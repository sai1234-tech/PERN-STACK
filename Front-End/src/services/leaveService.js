import { apiRequest } from "./apiClient";

export function getLeaves() {
  return apiRequest("/leaves/my");
}

export function getLeaveBalance() {
  return apiRequest("/leaves/balance");
}

export function cancelLeave(leaveId) {
  return apiRequest(`/leaves/${leaveId}/cancel`, { method: "PATCH" });
}

export function getLeaveTypes() {
  return apiRequest("/leaves/types");
}

export function applyForLeave(data) {
  return apiRequest("/leaves/apply", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateLeave(leaveId, data) {
  return apiRequest(`/leaves/${leaveId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }).catch(() => {
    return apiRequest(`/leaves/${leaveId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  });
}

export function deleteLeave(leaveId) {
  return apiRequest(`/leaves/${leaveId}`, {
    method: "DELETE",
  }).catch(() => {
    return cancelLeave(leaveId);
  });
}
