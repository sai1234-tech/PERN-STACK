import { apiRequest } from "./apiClient";

export const getLifecycleStages = async () => {
  const response = await apiRequest("/lifecycle/stages");
  return response.data || response;
};

export const getEmployeeLifecycle = async (employeeId) => {
  const response = await apiRequest(`/lifecycle/employee/${employeeId}`);
  return response.data || response;
};

export const advanceLifecycleStage = async ({ employeeId, stageNumber, status, notes }) => {
  const response = await apiRequest("/lifecycle/advance", {
    method: "POST",
    body: JSON.stringify({
      employeeId,
      stageNumber,
      status,
      notes,
    }),
  });
  return response.data || response;
};
