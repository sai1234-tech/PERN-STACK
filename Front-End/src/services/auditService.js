import { apiRequest } from "./apiClient";

export async function getAuditLogs(limit = 100) {
  const res = await apiRequest(`/audit?limit=${limit}`);
  return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
}

export async function logAudit(auditData) {
  const res = await apiRequest("/audit", {
    method: "POST",
    body: JSON.stringify(auditData),
  });
  return res?.data || res;
}
