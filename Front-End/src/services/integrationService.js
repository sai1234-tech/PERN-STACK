import { apiRequest } from "./apiClient";

export const integrationService = {
  /**
   * Get all 8 enterprise connectors with live configuration and health metrics
   */
  async getConnectors() {
    return apiRequest("/integrations");
  },

  /**
   * Get executive summary metrics, system health, and latest sync execution logs
   */
  async getSummary() {
    return apiRequest("/integrations/summary");
  },

  /**
   * Get detailed configuration, telemetry and domain batches for a single connector
   */
  async getConnectorDetail(connectorKey) {
    return apiRequest(`/integrations/${connectorKey}`);
  },

  /**
   * Trigger an instant real-time sync for a specific connector
   */
  async triggerSync(connectorKey, data = { triggeredBy: "MANUAL_USER" }) {
    return apiRequest(`/integrations/${connectorKey}/sync`, {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  /**
   * Update connector configuration, endpoint URL, auth type, or sync intervals
   */
  async updateConnector(connectorKey, data) {
    return apiRequest(`/integrations/${connectorKey}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  }
};
