import { apiRequest } from "./apiClient";

export const securityGovernanceService = {
  /**
   * 1. Overview & Security Posture
   */
  async getOverview() {
    return apiRequest("/governance/overview");
  },

  /**
   * 2. MFA Privileged Access
   */
  async generateMfaChallenge(actionScope = "PAYROLL_DISBURSE") {
    return apiRequest("/governance/mfa/challenge", {
      method: "POST",
      body: JSON.stringify({ actionScope }),
    });
  },

  async verifyMfaChallenge(challengeCode, otp) {
    return apiRequest("/governance/mfa/verify", {
      method: "POST",
      body: JSON.stringify({ challengeCode, otp }),
    });
  },

  async getMfaChallenges() {
    return apiRequest("/governance/mfa/challenges");
  },

  /**
   * 3. Field-Level Masking Policies
   */
  async getMaskingPolicies() {
    return apiRequest("/governance/masking/policies");
  },

  async updateMaskingPolicy(id, data) {
    return apiRequest(`/governance/masking/policies/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async getMaskingPreview(role = "employee") {
    return apiRequest(`/governance/masking/preview?role=${encodeURIComponent(role)}`);
  },

  /**
   * 4. Cryptographic Tamper-Evident Audit Trail
   */
  async getAuditChain(limit = 50) {
    return apiRequest(`/governance/audit/chain?limit=${limit}`);
  },

  async verifyAuditChain() {
    return apiRequest("/governance/audit/verify");
  },

  async recordProtectedTransaction(payload) {
    return apiRequest("/governance/audit/record", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * 5. Document Access & Download Logs
   */
  async getDocumentAccessLogs(limit = 50) {
    return apiRequest(`/governance/documents/logs?limit=${limit}`);
  },

  async logDocumentAccess(payload) {
    return apiRequest("/governance/documents/logs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * 6. Backup & Disaster Recovery
   */
  async getBackupLogs() {
    return apiRequest("/governance/backup/logs");
  },

  async triggerBackupSnapshot(backupType = "FULL_SNAPSHOT") {
    return apiRequest("/governance/backup/snapshot", {
      method: "POST",
      body: JSON.stringify({ backupType }),
    });
  },

  /**
   * 7. Data Retention Rules & Scheduled Purge
   */
  async getRetentionRules() {
    return apiRequest("/governance/retention/rules");
  },

  async updateRetentionRule(id, data) {
    return apiRequest(`/governance/retention/rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async executeRetentionPurge(ruleId = null) {
    return apiRequest("/governance/retention/purge", {
      method: "POST",
      body: JSON.stringify({ ruleId }),
    });
  },

  /**
   * 8. Indian DPDP Act 2023 Privacy Controls & Consents
   */
  async getDpdpConsents(limit = 50) {
    return apiRequest(`/governance/dpdp/consents?limit=${limit}`);
  },

  async recordDpdpConsent(data) {
    return apiRequest("/governance/dpdp/consents", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getDpdpRightsRequests() {
    return apiRequest("/governance/dpdp/rights");
  },

  async createDpdpRightsRequest(data) {
    return apiRequest("/governance/dpdp/rights", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateDpdpRightsRequest(id, data) {
    return apiRequest(`/governance/dpdp/rights/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  /**
   * 9. Periodic Access Reviews & Separation Deprovisioning
   */
  async getAccessReviewCampaigns() {
    return apiRequest("/governance/access-reviews");
  },

  async certifyAccessReview(data = {}) {
    return apiRequest("/governance/access-reviews/certify", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getDeprovisioningLogs() {
    return apiRequest("/governance/separation/deprovisioning-logs");
  },

  async triggerImmediateDeprovisioning(data) {
    return apiRequest("/governance/separation/immediate-deprovision", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};
