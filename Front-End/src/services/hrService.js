import { apiRequest } from "./apiClient";

export async function getEmployees(search = "") {
  try {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await apiRequest(`/employees${query}`);
    return res;
  } catch (err) {
    console.error("Failed to fetch employees for HR:", err);
    return { employees: [] };
  }
}

export async function getAllAttendance() {
  try {
    const res = await apiRequest("/attendance/all");
    return res;
  } catch (err) {
    return { records: [] };
  }
}

export async function getMonthlyAttendanceReport(year, month) {
  try {
    const res = await apiRequest(`/attendance/monthly?year=${year}&month=${month}`);
    return res;
  } catch (err) {
    return { records: [] };
  }
}

export async function getAttendanceSummary() {
  try {
    const res = await apiRequest("/attendance/summary");
    return res;
  } catch (err) {
    return { summary: { present: 0, absent: 0, late: 0 } };
  }
}

export async function getAllLeaves() {
  try {
    const res = await apiRequest("/leaves/all");
    return res;
  } catch (err) {
    return { data: [] };
  }
}

export async function getLeaveTypes() {
  try {
    const res = await apiRequest("/leaves/types");
    return res;
  } catch (err) {
    return { data: [] };
  }
}

export async function approveLeave(leaveId) {
  try {
    const res = await apiRequest(`/leaves/${leaveId}/approve`, {
      method: "PATCH"
    });
    return res;
  } catch (err) {
    return await apiRequest(`/leaves/${leaveId}/approve`, {
      method: "PUT"
    });
  }
}

export async function rejectLeave(leaveId, rejectionReason) {
  try {
    const res = await apiRequest(`/leaves/${leaveId}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ rejectionReason })
    });
    return res;
  } catch (err) {
    return await apiRequest(`/leaves/${leaveId}/reject`, {
      method: "PUT",
      body: JSON.stringify({ rejectionReason })
    });
  }
}

export async function revertLeave(leaveId) {
  try {
    const res = await apiRequest(`/leaves/${leaveId}/revert`, {
      method: "PATCH"
    });
    return res;
  } catch (err) {
    return await apiRequest(`/leaves/${leaveId}/revert`, {
      method: "PUT"
    });
  }
}
