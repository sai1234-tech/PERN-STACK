import { apiRequest } from "./apiClient";

/**
 * AI Intelligence Service — Frontend API Client
 * 
 * Supports the 5 core AI capabilities:
 * 1. AI HR Assistant (Chatbot Q&A)
 * 2. AI HR Analytics (Natural Language Workforce Metrics & Charts)
 * 3. Smart Attendance Monitoring (Anomaly Detection)
 * 4. AI Recruitment Assistant (Skill Match & Interview Generation)
 * 5. HR Policy Search (Semantic Clause Search with Citations)
 */

export async function askAiAssistant(prompt) {
  return await apiRequest("/ai/assistant/chat", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
}

export async function queryAiAnalytics(query) {
  return await apiRequest("/ai/analytics/query", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export async function getSmartAttendanceAnomalies(lookbackDays = 30) {
  return await apiRequest(`/ai/attendance/anomalies?lookbackDays=${lookbackDays}`, {
    method: "GET",
  });
}

export async function analyzeCandidateWithAi(payload) {
  return await apiRequest("/ai/recruitment/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function searchPoliciesWithAi(query) {
  return await apiRequest("/ai/policy/search", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export async function getAiHubOverview() {
  return await apiRequest("/ai/overview", {
    method: "GET",
  });
}
