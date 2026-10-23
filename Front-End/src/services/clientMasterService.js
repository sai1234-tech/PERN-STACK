import { apiRequest } from "./apiClient";

/**
 * Client Master API Services
 */
export const getClients = async () => {
  return await apiRequest("/client-master/clients");
};

export const createClient = async (clientData) => {
  return await apiRequest("/client-master/clients", {
    method: "POST",
    body: JSON.stringify(clientData)
  });
};

export const updateClient = async (id, clientData) => {
  return await apiRequest(`/client-master/clients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(clientData)
  });
};

export const deleteClient = async (id) => {
  return await apiRequest(`/client-master/clients/${id}`, {
    method: "DELETE"
  });
};

/**
 * Client Project & SOW Master API Services
 */
export const getClientProjects = async () => {
  return await apiRequest("/client-master/projects");
};

export const createClientProject = async (projectData) => {
  return await apiRequest("/client-master/projects", {
    method: "POST",
    body: JSON.stringify(projectData)
  });
};

export const updateClientProject = async (id, projectData) => {
  return await apiRequest(`/client-master/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(projectData)
  });
};

export const deleteClientProject = async (id) => {
  return await apiRequest(`/client-master/projects/${id}`, {
    method: "DELETE"
  });
};

/**
 * Restricted Rate-Card API Services
 */
export const getRateCards = async () => {
  return await apiRequest("/client-master/rate-cards");
};

export const createRateCard = async (rateData) => {
  return await apiRequest("/client-master/rate-cards", {
    method: "POST",
    body: JSON.stringify(rateData)
  });
};

export const deleteRateCard = async (id) => {
  return await apiRequest(`/client-master/rate-cards/${id}`, {
    method: "DELETE"
  });
};

/**
 * Transitions & Replacement Tracker API Services
 */
export const getTransitions = async () => {
  return await apiRequest("/client-master/transitions");
};

export const createTransition = async (transitionData) => {
  return await apiRequest("/client-master/transitions", {
    method: "POST",
    body: JSON.stringify(transitionData)
  });
};

export const updateTransition = async (id, transitionData) => {
  return await apiRequest(`/client-master/transitions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(transitionData)
  });
};
