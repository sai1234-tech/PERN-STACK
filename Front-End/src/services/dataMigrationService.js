import { apiRequest } from "./apiClient";

export const dataMigrationService = {
  // 1. Get Sources
  getSources: () => apiRequest("/data-migration/sources"),

  // 2. Get Field Mappings
  getFieldMappings: (category) =>
    apiRequest(`/data-migration/field-mappings${category ? `?category=${category}` : ""}`),

  // 3. Get Sample Preview
  getSamplePreview: () => apiRequest("/data-migration/sample-preview"),

  // 4. Trigger Trial Run
  runTrialMigration: (executedBy) =>
    apiRequest("/data-migration/trial-run", {
      method: "POST",
      body: JSON.stringify({ executedBy })
    }),

  // 5. Get Migration Jobs
  getJobs: () => apiRequest("/data-migration/jobs"),

  // 6. Get Job Details & Reports
  getJobDetails: (jobCode) => apiRequest(`/data-migration/jobs/${jobCode}`),

  // 7. Submit Business Sign-off
  submitSignoff: (signoffData) =>
    apiRequest("/data-migration/signoff", {
      method: "POST",
      body: JSON.stringify(signoffData)
    }),

  // 8. Execute Final Migration
  runFinalMigration: (jobCode) =>
    apiRequest("/data-migration/final-run", {
      method: "POST",
      body: JSON.stringify({ jobCode })
    })
};

export default dataMigrationService;
