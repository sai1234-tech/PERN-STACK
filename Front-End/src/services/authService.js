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

export const getCurrentUser = async () => {
  return apiRequest("/auth/me");
};

export const createManagedAccount = async (accountData) => {
  return apiRequest("/auth/accounts", {
    method: "POST",
    body: JSON.stringify(accountData),
  });
};

export const getAdminSummary = async () => {
  return apiRequest("/auth/admin-summary");
};