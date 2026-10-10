import { apiRequest } from "./apiClient";

export function getMyWeek(date) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiRequest(`/timesheets/my/week${query}`);
}

export function createTimesheet(data) {
  return apiRequest("/timesheets", { method: "POST", body: JSON.stringify(data) });
}

export function updateTimesheet(timesheetId, data) {
  return apiRequest(`/timesheets/${timesheetId}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteTimesheet(timesheetId) {
  return apiRequest(`/timesheets/${timesheetId}`, { method: "DELETE" });
}

export function submitTimesheet(timesheetId) {
  return apiRequest(`/timesheets/${timesheetId}/submit`, { method: "PATCH" });
}

export function submitWeek(date) {
  return apiRequest("/timesheets/submit-week", { method: "POST", body: JSON.stringify({ date }) });
}

export function getAllTimesheets(filters = {}) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  return apiRequest(`/timesheets/all${params.toString() ? `?${params}` : ""}`);
}

export function reviewTimesheet(timesheetId, status, reviewComment = "") {
  return apiRequest(`/timesheets/${timesheetId}/review`, {
    method: "PATCH",
    body: JSON.stringify({ status, reviewComment }),
  });
}