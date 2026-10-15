import { apiRequest } from "./apiClient";
import { broadcastDataChange } from "../utils/syncManager";

export function getAttendance() {
  return apiRequest("/attendance/my");
}

export function getTodayAttendance() {
  return apiRequest("/attendance/today");
}

export async function clockIn() {
  const res = await apiRequest("/attendance/check-in", { method: "POST" });
  broadcastDataChange("attendance", { action: "clockIn", timestamp: Date.now() });
  return res;
}

export async function clockOut() {
  const res = await apiRequest("/attendance/check-out", { method: "POST" });
  broadcastDataChange("attendance", { action: "clockOut", timestamp: Date.now() });
  return res;
}

