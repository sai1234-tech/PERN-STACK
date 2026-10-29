import { apiRequest } from "./apiClient";

export const deliveryRoadmapService = {
  getRoadmap: () => apiRequest("/delivery/roadmap"),
  createPhase: (data) =>
    apiRequest("/delivery/roadmap/phases", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  createDeliverable: (data) =>
    apiRequest("/delivery/roadmap/deliverables", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  signOff: (phaseNo, decision, comments) =>
    apiRequest(`/delivery/roadmap/phases/${phaseNo}/signoff`, {
      method: "POST",
      body: JSON.stringify({ decision, comments })
    }),

  askPolicy: (question) =>
    apiRequest("/delivery/ai/policy-assistant", { method: "POST", body: JSON.stringify({ question }) }),
  search: (q) => apiRequest(`/delivery/ai/search?q=${encodeURIComponent(q)}`),
  getAnalytics: () => apiRequest("/delivery/ai/analytics"),
  getWorkflowAssist: () => apiRequest("/delivery/ai/workflow-assist"),
  getGuardrails: () => apiRequest("/delivery/ai/guardrails"),
  getLogs: () => apiRequest("/delivery/ai/logs")
};
