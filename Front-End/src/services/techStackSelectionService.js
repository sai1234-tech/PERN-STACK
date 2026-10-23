import { apiRequest } from "./apiClient";

export const techStackSelectionService = {
  /**
   * 0. Executive Stack Decision Overview
   */
  async getOverview() {
    return apiRequest("/stack-selection/overview");
  },

  /**
   * 1. Comprehensive Technology Selection Matrix
   */
  async getMatrix(category = "", status = "") {
    const params = new URLSearchParams();
    if (category) params.append("category", category);
    if (status) params.append("status", status);
    const queryString = params.toString() ? `?${params.toString()}` : "";
    return apiRequest(`/stack-selection/matrix${queryString}`);
  },

  /**
   * 2. Interactive Custom Weights Scoring Evaluator
   */
  async evaluateCustomScoring(weights) {
    return apiRequest("/stack-selection/evaluate", {
      method: "POST",
      body: JSON.stringify(weights)
    });
  },

  /**
   * 3. Multi-Cloud Infrastructure Profiles (AWS, Azure, GCP, On-Prem)
   */
  async getCloudProfiles() {
    return apiRequest("/stack-selection/cloud-profiles");
  },

  /**
   * 4. Cloud Object Storage Providers & Presigned Engine
   */
  async getStorageProviders() {
    return apiRequest("/stack-selection/storage-providers");
  },

  async testStorageOperation(data = {}) {
    return apiRequest("/stack-selection/storage/test", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  /**
   * 5. Enterprise Identity Provider (IdP) SSO/MFA Configurations
   */
  async getIdpConfigurations() {
    return apiRequest("/stack-selection/idp/configurations");
  },

  async simulateIdpHandshake(data = {}) {
    return apiRequest("/stack-selection/idp/simulate", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  /**
   * 6. Total Cost of Ownership (TCO) 3-Year Comparative Financials
   */
  async getTcoComparison() {
    return apiRequest("/stack-selection/tco/comparison");
  }
};
