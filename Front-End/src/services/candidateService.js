import { apiRequest } from "./apiClient";
import { broadcastDataChange } from "../utils/syncManager";

export async function getCandidates() {
  const res = await apiRequest("/candidate");
  return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
}

export async function createCandidate(candidateData) {
  const res = await apiRequest("/candidate", {
    method: "POST",
    body: JSON.stringify(candidateData),
  });
  broadcastDataChange("candidates", { action: "create", timestamp: Date.now() });
  return res?.data || res;
}

export async function updateCandidateStatus(id, status) {
  const res = await apiRequest(`/candidate/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  broadcastDataChange("candidates", { action: "statusChange", status, timestamp: Date.now() });
  return res?.data || res;
}

export async function updateCandidateBgv(id, bgvStatus, bgvNotes = "") {
  const res = await apiRequest(`/candidate/${id}/bgv`, {
    method: "PATCH",
    body: JSON.stringify({ bgvStatus, bgvNotes }),
  });
  broadcastDataChange("candidates", { action: "bgvChange", bgvStatus, timestamp: Date.now() });
  return res?.data || res;
}

export async function onboardCandidate(id, onboardData) {
  const res = await apiRequest(`/candidate/${id}/onboard`, {
    method: "POST",
    body: JSON.stringify(onboardData),
  });
  broadcastDataChange("candidates", { action: "onboard", timestamp: Date.now() });
  broadcastDataChange("employees", { action: "createFromCandidate", timestamp: Date.now() });
  return res?.data || res;
}
