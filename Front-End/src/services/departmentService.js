import { apiRequest } from "./apiClient";

export async function getDepartments(search = "") {
  try {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await apiRequest(`/departments${query}`);
    return res;
  } catch (err) {
    console.error("Failed to fetch departments from backend:", err);
    return { departments: [] };
  }
}

export async function createDepartments(departments) {
  try {
    const res = await apiRequest("/departments", {
      method: "POST",
      body: JSON.stringify(departments),
    });
    return res;
  } catch (err) {
    throw err;
  }
}

export async function updateDepartment(id, department) {
  try {
    const res = await apiRequest(`/departments/${id}`, {
      method: "PUT",
      body: JSON.stringify(department),
    });
    return res;
  } catch (err) {
    throw err;
  }
}

export async function deleteDepartment(id) {
  try {
    const res = await apiRequest(`/departments/${id}`, {
      method: "DELETE",
    });
    return res;
  } catch (err) {
    throw err;
  }
}
