import { apiRequest } from "./apiClient";
import { broadcastDataChange } from "../utils/syncManager";

let mockEmployees = [
  { _id: "e1", firstName: "Aisha", lastName: "Sharma", employment: { status: "Active", department: "Engineering", designation: "Software Engineer" }, email: "aisha@example.com" },
  { _id: "e2", firstName: "Rohan", lastName: "Das", employment: { status: "Active", department: "Finance", designation: "Analyst" }, email: "rohan@example.com" }
];

export async function getEmployee() {
  try {
    const res = await apiRequest("/employee/me");
    if (res && (res.employee || res.user || res.data)) {
      return {
        success: true,
        data: res.employee || res.user || res.data,
        employee: res.employee || res.data,
        user: res.user,
      };
    }
  } catch (err) {
    try {
      const authRes = await apiRequest("/auth/me");
      if (authRes && (authRes.employee || authRes.user || authRes.data)) {
        return {
          success: true,
          data: authRes.employee || authRes.user || authRes.data,
          employee: authRes.employee || authRes.data,
          user: authRes.user,
        };
      }
    } catch (authErr) {
      // Continue to session fallback
    }
  }

  // Always resolve to the active logged-in user rather than random mock profiles
  try {
    const storedEmp = sessionStorage.getItem("hrms_employee")
      ? JSON.parse(sessionStorage.getItem("hrms_employee"))
      : null;
    const storedUser = sessionStorage.getItem("hrms_user")
      ? JSON.parse(sessionStorage.getItem("hrms_user"))
      : null;

    if (storedEmp || storedUser) {
      return {
        success: true,
        data: storedEmp || storedUser,
        employee: storedEmp || storedUser,
        user: storedUser,
      };
    }
  } catch (e) {}

  return {
    success: false,
    data: null,
    employee: null,
    user: null,
  };
}

export async function updateMyProfile(profileData) {
  try {
    const res = await apiRequest("/employee/me", {
      method: "PUT",
      body: JSON.stringify(profileData),
    });
    return res;
  } catch (err) {
    throw err;
  }
}

export async function updateEmployee(data) {
  try {
    const res = await apiRequest("/employee/me", {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return res;
  } catch (err) {
    throw err;
  }
}

export async function getAllEmployees(search = "") {
  try {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await apiRequest(`/employees${query}`);
    return res;
  } catch (err) {
    console.error("Failed to fetch employees from backend:", err);
    return { success: false, data: [] };
  }
}

export async function getEmployeeById(idOrCode) {
  if (!idOrCode) return { success: false, data: null, employee: null };
  try {
    const res = await apiRequest(`/employees/${encodeURIComponent(idOrCode)}`);
    if (res && (res.data || res.employee)) {
      return {
        success: true,
        data: res.data || res.employee,
        employee: res.data || res.employee,
      };
    }
  } catch (err) {
    console.error(`Failed to fetch employee by id ${idOrCode}:`, err);
  }
  return { success: false, data: null, employee: null };
}

export async function createEmployees(employees) {
  try {
    const res = await apiRequest("/employees", {
      method: "POST",
      body: JSON.stringify(employees),
    });
    return res;
  } catch (err) {
    throw err;
  }
}

export async function updateEmployeeById(id, employee) {
  try {
    const res = await apiRequest(`/employees/${id}`, {
      method: "PUT",
      body: JSON.stringify(employee),
    });
    return res;
  } catch (err) {
    throw err;
  }
}

export async function deleteEmployeeById(id) {
  try {
    const res = await apiRequest(`/employees/${id}`, {
      method: "DELETE",
    });
    return res;
  } catch (err) {
    throw err;
  }
}

export async function updateProfileSkills(skillsData) {
  try {
    const res = await apiRequest("/employee/me", {
      method: "PUT",
      body: JSON.stringify(skillsData),
    });
    return res;
  } catch (err) {
    throw err;
  }
}

export async function uploadProfilePicture(file) {
  try {
    const formData = new FormData();
    formData.append("profilePicture", file);
    const res = await apiRequest("/employee/me/profile-picture", {
      method: "POST",
      body: formData,
    });
    return res;
  } catch (err) {
    throw err;
  }
}