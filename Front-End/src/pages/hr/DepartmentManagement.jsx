import { useCallback, useEffect, useMemo, useState } from "react";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import Loader from "../../components/common/Loader";
import {
  createDepartments,
  deleteDepartment,
  getDepartments,
  updateDepartment,
} from "../../services/departmentService";
import { getAllEmployees } from "../../services/employeeService";
import "./DepartmentManagement.css";

const emptyDepartment = {
  departmentCode: "",
  departmentName: "",
  description: "",
  managerName: "",
  managerEmail: "",
  location: "",
  status: "Active",
};

// Avatar color palette for modern visual badges
const avatarColors = [
  { bg: "#e0f2fe", text: "#0369a1", border: "#bae6fd" }, // sky
  { bg: "#ede9fe", text: "#6d28d9", border: "#ddd6fe" }, // purple
  { bg: "#dcfce7", text: "#15803d", border: "#bbf7d0" }, // green
  { bg: "#fef3c7", text: "#b45309", border: "#fde68a" }, // amber
  { bg: "#ffe4e6", text: "#be123c", border: "#fecdd3" }, // rose
  { bg: "#ccfbf1", text: "#0f766e", border: "#99f6e4" }, // teal
  { bg: "#e0e7ff", text: "#4338ca", border: "#c7d2fe" }, // indigo
];

function getColorForString(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name = "") {
  if (!name) return "DP";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function DepartmentManagement() {
  const [departments, setDepartments] = useState([]);
  const [employeeList, setEmployeeList] = useState([]);
  const [form, setForm] = useState(emptyDepartment);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadDepartments = useCallback(async () => {
    setError("");
    try {
      const response = await getDepartments(search);
      setDepartments(response.departments || response.data || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  // Load employee directory for smart manager autocomplete
  useEffect(() => {
    getAllEmployees()
      .then((res) => {
        setEmployeeList(res.data || res.employees || []);
      })
      .catch(() => {
        // Silently fall back if employee list is unavailable
      });
  }, []);

  const activeCount = useMemo(
    () => departments.filter((d) => d.status === "Active").length,
    [departments]
  );
  const inactiveCount = departments.length - activeCount;

  const visibleDepartments = useMemo(() => {
    return departments.filter(
      (department) =>
        statusFilter === "All" || department.status === statusFilter
    );
  }, [departments, statusFilter]);

  const setField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  // Smart manager select handler
  const handleManagerSelectChange = (event) => {
    const email = event.target.value;
    if (!email) {
      setForm((current) => ({
        ...current,
        managerName: "",
        managerEmail: "",
      }));
      return;
    }

    const matchedEmployee = employeeList.find((emp) => emp.email === email);
    if (matchedEmployee) {
      const fullName = `${matchedEmployee.firstName || ""} ${matchedEmployee.lastName || ""}`.trim() || matchedEmployee.name || matchedEmployee.email;
      setForm((current) => ({
        ...current,
        managerName: fullName,
        managerEmail: email,
      }));
    }
  };

  const resetForm = () => {
    setForm(emptyDepartment);
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!form.departmentCode.trim() || !form.departmentName.trim()) {
      setError("Department code and department name are required.");
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        // Update existing department
        const payload = {
          ...form,
          departmentCode: form.departmentCode.trim().toUpperCase(),
          departmentName: form.departmentName.trim(),
          managerName: form.managerName.trim(),
          managerEmail: form.managerEmail.trim().toLowerCase(),
          location: form.location.trim(),
          description: form.description.trim(),
          status: form.status,
        };
        await updateDepartment(editingId, payload);
        setNotice(`Department "${form.departmentName}" updated successfully.`);
      } else {
        // Create new department
        const payload = {
          ...form,
          departmentCode: form.departmentCode.trim().toUpperCase(),
          departmentName: form.departmentName.trim(),
          managerName: form.managerName.trim(),
          managerEmail: form.managerEmail.trim().toLowerCase(),
          location: form.location.trim(),
          description: form.description.trim(),
        };
        await createDepartments([payload]);
        setNotice(`Department "${form.departmentName}" created successfully.`);
      }
      resetForm();
      await loadDepartments();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const editDepartment = (department) => {
    setError("");
    setNotice("");
    const id = department._id || department.id;
    setEditingId(id);
    setForm({
      departmentCode: department.departmentCode || "",
      departmentName: department.departmentName || "",
      description: department.description || "",
      managerName: department.managerName || "",
      managerEmail: department.managerEmail || "",
      location: department.location || "",
      status: department.status || "Active",
    });

    // Smoothly scroll to the form for easy editing
    const formElement = document.querySelector(".department-form");
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const removeDepartment = async (department) => {
    const id = department._id || department.id;
    if (!id) {
      setError("Cannot delete: department ID is missing.");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to delete the department "${department.departmentName}" (${department.departmentCode || "N/A"})? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setError("");
      setNotice("");
      await deleteDepartment(id);
      setNotice(`Department "${department.departmentName}" deleted successfully.`);
      if (editingId === id) {
        resetForm();
      }
      await loadDepartments();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  if (loading) return <Loader label="Loading departments workspace..." />;

  return (
    <>
      <EmployeeHeader />
      <main className="department-page">
        {/* Top Header */}
        <header className="department-heading">
          <div>
            <div className="department-kicker-wrap">
              <span className="department-kicker-icon">🏢</span>
              <p className="department-kicker">Organisation Setup</p>
            </div>
            <h1>Department Directory</h1>
            <p>
              Manage organizational units, team managers, workplace locations,
              and operational records.
            </p>
          </div>
          <button
            className="header-create-button"
            type="button"
            onClick={() => {
              resetForm();
              const formElement = document.querySelector(".department-form");
              if (formElement) {
                formElement.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }}
          >
            <span className="plus-icon">+</span> New Department
          </button>
        </header>

        {/* Global Notifications */}
        {error && (
          <div className="department-alert" role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="department-notice" role="status">
            <span className="notice-icon">✓</span>
            <span>{notice}</span>
          </div>
        )}

        {/* High-level metrics */}
        <section className="department-metrics">
          <div className="metric-card">
            <div className="metric-icon-wrap bg-teal">🏢</div>
            <div className="metric-content">
              <span>Total Departments</span>
              <strong>{departments.length}</strong>
              <small>Across entire organization</small>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon-wrap bg-green">🟢</div>
            <div className="metric-content">
              <span>Active Departments</span>
              <strong className="metric-active">{activeCount}</strong>
              <small>Available for staff assignment</small>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon-wrap bg-slate">⚪</div>
            <div className="metric-content">
              <span>Inactive</span>
              <strong className="metric-inactive">{inactiveCount}</strong>
              <small>Archived or pending</small>
            </div>
          </div>
        </section>

        {/* Side-by-Side Main Layout */}
        <section className="department-layout">
          {/* Left Form: Add / Edit */}
          <form className="department-form panel" onSubmit={handleSubmit}>
            <div className="form-heading">
              <div>
                <div className="form-badge-row">
                  <h2>{editingId ? "Edit Department" : "Add Department"}</h2>
                  {editingId && (
                    <span className="editing-badge">Editing Mode</span>
                  )}
                </div>
                <p>
                  {editingId
                    ? "Update and save the department configuration."
                    : "Fill in the details to register a new organizational team."}
                </p>
              </div>
              {editingId && (
                <button
                  className="text-button"
                  type="button"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="department-form-grid">
              <label>
                Department Code *
                <input
                  name="departmentCode"
                  value={form.departmentCode}
                  onChange={setField}
                  placeholder="e.g. ENG, HR, FIN"
                  required
                />
              </label>

              <label>
                Department Name *
                <input
                  name="departmentName"
                  value={form.departmentName}
                  onChange={setField}
                  placeholder="e.g. Software Engineering"
                  required
                />
              </label>

              <label>
                Department Manager
                <select
                  name="managerEmail"
                  value={form.managerEmail}
                  onChange={handleManagerSelectChange}
                >
                  <option value="">-- Select a Manager --</option>
                  {employeeList
                    .filter((emp) => emp.user?.role === "manager" || emp.user?.role === "hr" || emp.user?.role === "admin")
                    .map((emp) => {
                    const fullName =
                      `${emp.firstName || ""} ${emp.lastName || ""}`.trim() ||
                      emp.name ||
                      emp.email;
                    const designation = emp.employment?.designation
                      ? ` - ${emp.employment.designation}`
                      : "";
                    return (
                      <option key={emp._id || emp.id} value={emp.email}>
                        {fullName} {designation}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label>
                Manager Email (Auto-filled)
                <input
                  name="managerEmailDisplay"
                  type="email"
                  value={form.managerEmail}
                  readOnly
                  placeholder="Select a manager above"
                  style={{ backgroundColor: "#f3f4f6", cursor: "not-allowed", color: "#6b7280" }}
                />
              </label>

              <label>
                Work Location
                <input
                  name="location"
                  value={form.location}
                  onChange={setField}
                  placeholder="e.g. HQ - Floor 4, Remote"
                />
              </label>

              <label>
                Status
                <select name="status" value={form.status} onChange={setField}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>

              <label className="description-field">
                Department Description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={setField}
                  rows="4"
                  placeholder="What is the primary function and mission of this department?"
                />
              </label>
            </div>

            <button className="save-button" type="submit" disabled={saving}>
              {saving ? (
                "Saving..."
              ) : editingId ? (
                <>
                  <span>💾</span> Save Changes
                </>
              ) : (
                <>
                  <span>+</span> Create Department
                </>
              )}
            </button>
          </form>

          {/* Right Directory: Complete Unified Table Box */}
          <section className="department-list panel">
            {/* Controls Bar */}
            <div className="directory-header-bar">
              <div className="directory-title-wrap">
                <h2>All Departments</h2>
                <span className="directory-counter-pill">
                  {visibleDepartments.length} of {departments.length}
                </span>
              </div>

              <div className="directory-controls">
                {/* Search Bar with Icon */}
                <div className="search-input-wrapper">
                  <svg
                    className="search-svg-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name, code, manager..."
                    aria-label="Search departments"
                  />
                  {search && (
                    <button
                      type="button"
                      className="search-clear-btn"
                      onClick={() => setSearch("")}
                      title="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Status Segmented Filter */}
                <div className="segmented-filter-bar">
                  <button
                    type="button"
                    className={`filter-tab ${statusFilter === "All" ? "active" : ""}`}
                    onClick={() => setStatusFilter("All")}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`filter-tab ${statusFilter === "Active" ? "active" : ""}`}
                    onClick={() => setStatusFilter("Active")}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    className={`filter-tab ${statusFilter === "Inactive" ? "active" : ""}`}
                    onClick={() => setStatusFilter("Inactive")}
                  >
                    Inactive
                  </button>
                </div>
              </div>
            </div>

            {/* Complete Unified Table in One Box */}
            <div className="department-table-wrap">
              <table className="department-modern-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Code</th>
                    <th>Manager</th>
                    <th>Location</th>
                    <th>Headcount</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th className="actions-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDepartments.length === 0 ? (
                    <tr>
                      <td colSpan="7">
                        <div className="table-empty-state">
                          <div className="empty-state-icon">🏢</div>
                          <h3>No departments found</h3>
                          <p>
                            {search || statusFilter !== "All"
                              ? "Try adjusting your search query or status filter."
                              : "Get started by adding your first department using the form."}
                          </p>
                          {(search || statusFilter !== "All") && (
                            <button
                              type="button"
                              className="clear-filter-btn"
                              onClick={() => {
                                setSearch("");
                                setStatusFilter("All");
                              }}
                            >
                              Reset Filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    visibleDepartments.map((department) => {
                      const color = getColorForString(
                        department.departmentName || department.departmentCode
                      );
                      const mgrInitials = getInitials(department.managerName);
                      const isDeptActive =
                        String(department.status).toLowerCase() === "active";

                      return (
                        <tr
                          key={department._id || department.id}
                          className="department-row"
                        >
                          {/* Department Column with Avatar Badge */}
                          <td>
                            <div className="dept-cell-main">
                              <div
                                className="dept-avatar-badge"
                                style={{
                                  backgroundColor: color.bg,
                                  color: color.text,
                                  borderColor: color.border,
                                }}
                              >
                                {getInitials(department.departmentName)}
                              </div>
                              <div className="dept-title-meta">
                                <span className="dept-name">
                                  {department.departmentName}
                                </span>
                                {department.description && (
                                  <span className="dept-sub-text">
                                    {department.description.slice(0, 38)}
                                    {department.description.length > 38
                                      ? "..."
                                      : ""}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Code Badge */}
                          <td>
                            <span className="dept-code-tag">
                              {department.departmentCode || "-"}
                            </span>
                          </td>

                          {/* Manager with Avatar & Email */}
                          <td>
                            {department.managerName ? (
                              <div className="manager-cell">
                                <div className="manager-avatar-mini">
                                  {mgrInitials}
                                </div>
                                <div className="manager-text-meta">
                                  <strong className="manager-name">
                                    {department.managerName}
                                  </strong>
                                  {department.managerEmail && (
                                    <a
                                      href={`mailto:${department.managerEmail}`}
                                      className="manager-email"
                                      title={department.managerEmail}
                                    >
                                      {department.managerEmail}
                                    </a>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="unassigned-text">
                                Unassigned
                              </span>
                            )}
                          </td>

                          {/* Location Chip */}
                          <td>
                            {department.location ? (
                              <span className="location-chip">
                                <span className="loc-pin">📍</span>
                                <span>{department.location}</span>
                              </span>
                            ) : (
                              <span className="unassigned-text">-</span>
                            )}
                          </td>

                          {/* Headcount & Team Members Column */}
                          <td>
                            <div className="dept-team-members" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: '600', color: '#111827' }}>
                                  {employeeList.filter(e => e.employment?.department === department.departmentName).length}
                                </span>
                                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>staff members</span>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#4b5563', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={
                                employeeList
                                  .filter(e => e.employment?.department === department.departmentName)
                                  .map(e => `${e.employeeCode || ''} ${e.firstName || ''} ${e.lastName || ''}`.trim() || e.name || e.email)
                                  .join(', ')
                              }>
                                {employeeList
                                  .filter(e => e.employment?.department === department.departmentName)
                                  .map(e => `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.name || e.email)
                                  .join(', ') || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No employees assigned</span>}
                              </div>
                            </div>
                          </td>

                          {/* Description */}
                          <td>
                            <div
                              className="description-snippet"
                              title={department.description}
                            >
                              {department.description || (
                                <span className="unassigned-text">
                                  No description
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Status Pill with Pulsing Dot */}
                          <td>
                            <span
                              className={`status-pill-modern ${
                                isDeptActive ? "active" : "inactive"
                              }`}
                            >
                              <span className="pulse-dot" />
                              {department.status || "Active"}
                            </span>
                          </td>

                          {/* Actions Buttons: Edit & Delete */}
                          <td className="actions-cell">
                            <div className="row-action-buttons">
                              <button
                                type="button"
                                className="action-btn edit-btn"
                                onClick={() => editDepartment(department)}
                                title="Edit department"
                              >
                                <svg
                                  className="action-svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                className="action-btn delete-btn"
                                onClick={() => removeDepartment(department)}
                                title="Delete department"
                              >
                                <svg
                                  className="action-svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </main>
    </>
  );
}

export default DepartmentManagement;
