import { apiRequest } from "./apiClient";

export const enterpriseAutomationsService = {
  /**
   * 0. Overview
   */
  async getOverview() {
    return apiRequest("/automations/overview");
  },

  /**
   * 1. Role / Client Onboarding Checklists
   */
  async getOnboardingTemplates() {
    return apiRequest("/automations/onboarding/templates");
  },

  async createOnboardingTemplate(data) {
    return apiRequest("/automations/onboarding/templates", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getOnboardingInstances(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/automations/onboarding/instances${qs ? `?${qs}` : ""}`);
  },

  async generateOnboardingChecklist(data) {
    return apiRequest("/automations/onboarding/generate", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateOnboardingTaskStatus(id, status) {
    return apiRequest(`/automations/onboarding/instances/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  /**
   * 2. Missing-Document Reminders
   */
  async getMissingDocumentReminders() {
    return apiRequest("/automations/documents/missing");
  },

  async triggerMissingDocReminder(reminderId) {
    return apiRequest("/automations/documents/remind", {
      method: "POST",
      body: JSON.stringify({ reminderId }),
    });
  },

  async scanMissingDocuments() {
    return apiRequest("/automations/documents/scan", {
      method: "POST",
    });
  },

  /**
   * 3. BGV SLA Escalations
   */
  async getBgvSlaEscalations() {
    return apiRequest("/automations/bgv/slas");
  },

  async triggerBgvEscalation(data) {
    return apiRequest("/automations/bgv/escalate", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * 4. Monthly Payroll Cut-Off Input Generation
   */
  async getCutoffBatches() {
    return apiRequest("/automations/payroll/cutoffs");
  },

  async executeMonthlyCutoff(data = {}) {
    return apiRequest("/automations/payroll/cutoff", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * 5. Probation & Confirmation Reminders
   */
  async getProbationAlerts() {
    return apiRequest("/automations/probation/alerts");
  },

  async updateProbationDecision(id, data) {
    return apiRequest(`/automations/probation/decision/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  /**
   * 6. Performance-Cycle Reminders
   */
  async getPerformanceAlerts() {
    return apiRequest("/automations/performance/alerts");
  },

  async dispatchPerformanceReminder(data) {
    return apiRequest("/automations/performance/remind", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * 7. Exit Clearance Tasks (5 Departments)
   */
  async getExitClearanceTasks(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/automations/exit/tasks${qs ? `?${qs}` : ""}`);
  },

  async createExitClearanceWorkflow(data) {
    return apiRequest("/automations/exit/workflow", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateClearanceTaskStatus(id, data) {
    return apiRequest(`/automations/exit/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  /**
   * 8. Helpdesk SLA Escalations
   */
  async getTicketSlaEscalations() {
    return apiRequest("/automations/helpdesk/slas");
  },

  async evaluateTicketSlas() {
    return apiRequest("/automations/helpdesk/evaluate", {
      method: "POST",
    });
  },

  /**
   * 9. Scheduled Authorized Dashboards & Reports
   */
  async getScheduledReports() {
    return apiRequest("/automations/reports/scheduled");
  },

  async runScheduledReport(reportCode) {
    return apiRequest("/automations/reports/run", {
      method: "POST",
      body: JSON.stringify({ reportCode }),
    });
  },

  async getReportExecutions() {
    return apiRequest("/automations/reports/executions");
  },
};
