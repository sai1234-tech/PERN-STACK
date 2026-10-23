import { apiRequest } from "./apiClient";

export const enterpriseOperationsService = {
  /**
   * 0. Executive Radar Overview across 9 Areas
   */
  async getOverview() {
    return apiRequest("/operations/overview");
  },

  /**
   * 1. Performance
   */
  async getPerformanceTargets() {
    return apiRequest("/operations/performance/targets");
  },

  async executeLoadTest(data = {}) {
    return apiRequest("/operations/performance/load-test", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * 2. Availability
   */
  async getAvailabilityStatus() {
    return apiRequest("/operations/availability/status");
  },

  /**
   * 3. Scalability
   */
  async getScalabilityMetrics() {
    return apiRequest("/operations/scalability/metrics");
  },

  /**
   * 4. Security
   */
  async getSecurityVulnerabilities() {
    return apiRequest("/operations/security/vulnerabilities");
  },

  async runSecurityScan() {
    return apiRequest("/operations/security/scan", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  /**
   * 5. Usability
   */
  async getUsabilityTelemetry() {
    return apiRequest("/operations/usability/telemetry");
  },

  /**
   * 6. Backup & Automated Restoration Testing
   */
  async getBackupLedger() {
    return apiRequest("/operations/backup/ledger");
  },

  async triggerAutomatedRestoreTest() {
    return apiRequest("/operations/backup/test-restore", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  /**
   * 7. Disaster Recovery (RPO/RTO)
   */
  async getDisasterRecoveryTiers() {
    return apiRequest("/operations/dr/tiers");
  },

  async triggerDrill(workload_tier = "TIER_1_PAYROLL_CORE") {
    return apiRequest("/operations/dr/drill", {
      method: "POST",
      body: JSON.stringify({ workload_tier }),
    });
  },

  /**
   * 8. Observability
   */
  async getObservabilityLogs(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/operations/observability/logs${qs ? `?${qs}` : ""}`);
  },

  async getObservabilityAlerts() {
    return apiRequest("/operations/observability/alerts");
  },

  /**
   * 9. Maintainability
   */
  async getMaintainabilityStatus() {
    return apiRequest("/operations/maintainability/status");
  },
};

export default enterpriseOperationsService;
