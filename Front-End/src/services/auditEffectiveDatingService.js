import { apiRequest } from "./apiClient";

export const auditEffectiveDatingService = {
  /**
   * 0. Executive Overview Across All 5 Pillars
   */
  async getOverview() {
    return apiRequest("/audit-governance/overview");
  },

  /**
   * 1. Critical Data Change Logs
   */
  async getCriticalChanges(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/audit-governance/critical-changes${qs ? `?${qs}` : ""}`);
  },

  async logCriticalChange(data) {
    return apiRequest("/audit-governance/critical-changes", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * 2. Immutable Approval Decision History
   */
  async getApprovalDecisions(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/audit-governance/approval-decisions${qs ? `?${qs}` : ""}`);
  },

  async recordApprovalDecision(data) {
    return apiRequest("/audit-governance/approval-decisions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getApprovalChain(entityId) {
    return apiRequest(`/audit-governance/approval-decisions/entity/${entityId}`);
  },

  /**
   * 3. Effective-Dated History Ledger (Temporal Non-Overwriting)
   */
  async getEffectiveDatedHistory(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/audit-governance/effective-dated${qs ? `?${qs}` : ""}`);
  },

  async createEffectiveDatedRevision(data) {
    return apiRequest("/audit-governance/effective-dated", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getAsOfDateRecord(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/audit-governance/effective-dated/as-of${qs ? `?${qs}` : ""}`);
  },

  /**
   * 4. Sensitive Export & Administrative Action Logs
   */
  async getSensitiveExports(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/audit-governance/sensitive-exports${qs ? `?${qs}` : ""}`);
  },

  async logSensitiveExport(data) {
    return apiRequest("/audit-governance/sensitive-exports", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getAdminActions(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/audit-governance/admin-actions${qs ? `?${qs}` : ""}`);
  },

  async logAdminAction(data) {
    return apiRequest("/audit-governance/admin-actions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * 5. Document Preview / Download Governance & Watermarking
   */
  async getDocumentPolicies() {
    return apiRequest("/audit-governance/document-policies");
  },

  async updateDocumentPolicy(categoryCode, data) {
    return apiRequest(`/audit-governance/document-policies/${categoryCode}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async evaluateDocumentAccess(data) {
    return apiRequest("/audit-governance/documents/evaluate-access", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getDocumentAudit(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/audit-governance/document-audit${qs ? `?${qs}` : ""}`);
  },
};

export default auditEffectiveDatingService;
