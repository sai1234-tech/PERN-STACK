import { apiRequest } from "./apiClient";

export function getAttendance() {
  return apiRequest("/attendance/my");
}

export function getTodayAttendance() {
  return apiRequest("/attendance/today");
}

export function clockIn() {
  return apiRequest("/attendance/check-in", { method: "POST" });
}

export function clockOut() {
  return apiRequest("/attendance/check-out", { method: "POST" });
}
