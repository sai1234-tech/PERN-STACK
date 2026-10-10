import { apiRequest } from "./apiClient";

export const createTicket = async (empId, query) => {
  const response = await apiRequest('/tickets', {
    method: "POST",
    body: JSON.stringify({ empId, query })
  });
  return response;
};

export const getAllTickets = async () => {
  const response = await apiRequest('/tickets');
  return response;
};

export const resolveTicket = async (id, resolution) => {
  const response = await apiRequest(`/tickets/${id}/resolve`, {
    method: "PUT",
    body: JSON.stringify({ resolution })
  });
  return response;
};
