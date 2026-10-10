import { apiRequest } from "./apiClient";

// Create OKR (Employee)
export const createOkr = async (objective) => {
  return apiRequest("/performance", {
    method: "POST",
    body: JSON.stringify({ objective }),
  });
};

// Get My OKRs (Employee)
export const getMyOkrs = async () => {
  return apiRequest("/performance/my");
};

// Get All OKRs (HR/Manager)
export const getAllOkrs = async () => {
  return apiRequest("/performance/all");
};

// Rate OKR (HR/Manager)
export const rateOkr = async (id, score, feedback) => {
  return apiRequest(`/performance/${id}/rate`, {
    method: "PUT",
    body: JSON.stringify({ score, feedback }),
  });
};
