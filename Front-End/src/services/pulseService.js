import { apiRequest } from "./apiClient";

export async function submitDailyPulse(score, feedback = "") {
  return apiRequest("/pulse", {
    method: "POST",
    body: JSON.stringify({ score, feedback }),
  });
}

export async function getTodayPulse() {
  return apiRequest("/pulse/today");
}

export async function getPulseAnalytics() {
  return apiRequest("/pulse/analytics");
}
