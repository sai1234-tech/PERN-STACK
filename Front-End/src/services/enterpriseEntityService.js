import { apiRequest } from "./apiClient";

export const enterpriseEntityService = {
  /**
   * Fetches real-time status and live database row counts for all 41 entities
   */
  async getOverview() {
    return apiRequest("/entities/overview");
  },

  /**
   * Fetches live PostgreSQL column schema metadata for a specific entity
   */
  async getEntitySchema(entityKey) {
    return apiRequest(`/entities/${entityKey}/schema`);
  },

  /**
   * Fetches live records from PostgreSQL for a specific entity with optional search, sorting, and pagination
   */
  async getEntityRecords(entityKey, { search = "", page = 1, limit = 50, sort = "desc" } = {}) {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (page) params.append("page", page);
    if (limit) params.append("limit", limit);
    if (sort) params.append("sort", sort);

    const queryString = params.toString() ? `?${params.toString()}` : "";
    return apiRequest(`/entities/${entityKey}${queryString}`);
  },

  /**
   * Creates a new live entity record in PostgreSQL
   */
  async createRecord(entityKey, data) {
    return apiRequest(`/entities/${entityKey}`, {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  /**
   * Updates an existing live entity record in PostgreSQL
   */
  async updateRecord(entityKey, id, data) {
    return apiRequest(`/entities/${entityKey}/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  },

  /**
   * Deletes a record from PostgreSQL
   */
  async deleteRecord(entityKey, id) {
    return apiRequest(`/entities/${entityKey}/${id}`, {
      method: "DELETE"
    });
  }
};
