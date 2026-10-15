import { apiRequest } from "./apiClient";

export const signupUser = async (userData) => {
  return apiRequest("/auth/signup", {
    method: "POST",
    body: JSON.stringify(userData),
  });
};

export const loginUser = async (credentials) => {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
};

export const setupFirstAdmin = async (accountData) => {
  return apiRequest("/auth/setup-admin", {
    method: "POST",
    body: JSON.stringify(accountData),
  });
};

export const getFirstAdminSetupStatus = async () => {
  return apiRequest("/auth/setup-status");
};

export const getCurrentUser = async () => {
  return apiRequest("/auth/me");
};

export const createManagedAccount = async (accountData) => {
  const {
    role = "employee",
    password,
    ...employeeData
  } = accountData;
  return apiRequest("/employee", {
    method: "POST",
    body: JSON.stringify([{
      ...employeeData,
      grantLogin: true,
      loginRole: role,
      loginPassword: password,
    }]),
  });
};

export const getAdminSummary = async () => {
  return apiRequest("/auth/admin-summary");
};