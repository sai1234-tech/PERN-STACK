import React, { useState, useEffect, useMemo } from "react";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import Loader from "../../components/common/Loader";
import { getAllEmployees } from "../../services/employeeService";
import "./ResourceAllocation.css";

const STORAGE_KEY = "hrms_resource_allocation_matrix";

const PROJECT_SUGGESTIONS = [
  "Project Titan",
  "Project Phoenix",
  "Project Apollo",
  "Project Nexus",
  "Project Horizon",
  "Project Cyber",
];

const INITIAL_RESOURCE_POOL = [
  { id: "EMP-101", name: "Aisha Sharma", role: "Frontend Developer", department: "Engineering", code: "EM0101", defaultStatus: "Allocated", defaultProject: "Project Titan" },
  { id: "EMP-102", name: "Rohan Das", role: "Backend Developer", department: "IT", code: "EM0102", defaultStatus: "Bench", defaultProject: null },
  { id: "EMP-103", name: "Sneha Patel", role: "UX Designer", department: "Engineering", code: "EM0103", defaultStatus: "Allocated", defaultProject: "Project Phoenix" },
  { id: "EMP-104", name: "Karan Singh", role: "DevOps Engineer", department: "IT", code: "EM0104", defaultStatus: "Bench", defaultProject: null },
];

export default function ResourceAllocation() {
  const [employees, setEmployees] = useState([]);
  const [allocations, setAllocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [notice, setNotice] = useState("");

  // Allocation Modal state
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [projectInput, setProjectInput] = useState("");

  // Add Employee to Matrix Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEmpId, setAddEmpId] = useState("");
  const [addStatus, setAddStatus] = useState("Bench");
  const [addProject, setAddProject] = useState("Project Titan");

  // Load backend employees and saved allocation states
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await getAllEmployees();
        const apiEmployees = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);

        // Combine API employees with initial resource pool
        const mergedList = [...INITIAL_RESOURCE_POOL];
        const existingIds = new Set(INITIAL_RESOURCE_POOL.map(e => e.id));

        apiEmployees.forEach(emp => {
          const empId = emp._id || emp.id;
          if (!existingIds.has(empId)) {
            const name = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.name || emp.email || "Employee";
            const code = emp.employeeCode || emp.employeeId || "EMP";
            const dept = emp.employment?.department || emp.department || "Operations";
            const role = emp.employment?.designation || emp.designation || "Engineer";

            mergedList.push({
              id: empId,
              name,
              code,
              department: dept,
              role,
              defaultStatus: "Bench",
              defaultProject: null,
            });
          }
        });

        setEmployees(mergedList);

        // Load stored allocation states
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            setAllocations(JSON.parse(saved));
          } catch {
            // fallback
          }
        } else {
          // Initialize defaults
          const initialAlloc = {};
          mergedList.forEach(e => {
            initialAlloc[e.id] = {
              status: e.defaultStatus || "Bench",
              project: e.defaultProject || null,
            };
          });
          setAllocations(initialAlloc);
        }
      } catch (err) {
        console.error("Failed to load resources:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Save allocation change helper
  const updateAllocation = (empId, status, project = null) => {
    const updated = {
      ...allocations,
      [empId]: { status, project: status === "Allocated" ? project : null },
    };
    setAllocations(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  // Allocate resource handler
  const handleConfirmAllocation = (e) => {
    e.preventDefault();
    if (selectedEmp && projectInput.trim()) {
      updateAllocation(selectedEmp.id, "Allocated", projectInput.trim());
      setNotice(`Successfully allocated ${selectedEmp.name} to ${projectInput.trim()}.`);
      setSelectedEmp(null);
      setProjectInput("");
      setTimeout(() => setNotice(""), 3500);
    }
  };

  // Release to bench handler
  const handleReleaseToBench = (emp) => {
    updateAllocation(emp.id, "Bench", null);
    setNotice(`Released ${emp.name} back to Bench (Cost Center).`);
    setTimeout(() => setNotice(""), 3500);
  };

  // Add Employee to Matrix modal submit
  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!addEmpId) return;
    const targetEmp = employees.find(emp => emp.id === addEmpId);
    if (!targetEmp) return;

    updateAllocation(addEmpId, addStatus, addStatus === "Allocated" ? addProject : null);
    setNotice(`Added ${targetEmp.name} to Resource Matrix.`);
    setShowAddModal(false);
    setAddEmpId("");
    setTimeout(() => setNotice(""), 3500);
  };

  // Extract unique departments
  const departments = useMemo(() => {
    const set = new Set();
    employees.forEach(e => {
      if (e.department) set.add(e.department);
    });
    return ["ALL", ...Array.from(set)];
  }, [employees]);

  // Compute resource matrix items
  const matrixItems = useMemo(() => {
    return employees.map(e => {
      const alloc = allocations[e.id] || { status: "Bench", project: null };
      return {
        ...e,
        status: alloc.status,
        project: alloc.project,
      };
    });
  }, [employees, allocations]);

  // Filtered lists
  const filteredItems = useMemo(() => {
    return matrixItems.filter(item => {
      const name = item.name || "";
      const code = item.code || "";
      const role = item.role || "";
      const project = item.project || "";
      const dept = item.department || "";

      const matchesSearch =
        name.toLowerCase().includes(search.toLowerCase()) ||
        code.toLowerCase().includes(search.toLowerCase()) ||
        role.toLowerCase().includes(search.toLowerCase()) ||
        project.toLowerCase().includes(search.toLowerCase());

      const matchesDept = deptFilter === "ALL" || dept.toLowerCase() === deptFilter.toLowerCase();
      const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [matrixItems, search, deptFilter, statusFilter]);

  const benchList = useMemo(() => filteredItems.filter(e => e.status === "Bench"), [filteredItems]);
  const allocatedList = useMemo(() => filteredItems.filter(e => e.status === "Allocated"), [filteredItems]);

  const totalPoolCount = matrixItems.length;
  const totalAllocated = matrixItems.filter(e => e.status === "Allocated").length;
  const utilizationPercentage = totalPoolCount > 0 ? Math.round((totalAllocated / totalPoolCount) * 100) : 0;

  return (
    <>
      <EmployeeHeader />
      <main className="resource-hub-page">
        {/* Banner */}
        <header className="resource-banner">
          <div>
            <span className="resource-kicker">Quadratics Resource Intelligence</span>
            <h1>Bench & Resource Allocation</h1>
            <p>Track employee utilization, billable project allocations, and cost/revenue center balance.</p>
          </div>
          <div className="banner-action-cluster">
            <button
              type="button"
              className="resource-btn primary"
              onClick={() => setShowAddModal(true)}
            >
              ➕ Add Employee to Matrix
            </button>
          </div>
        </header>

        {/* KPI Metrics Suite */}
        <section className="resource-kpi-grid">
          <div className="res-kpi-card highlight">
            <span className="res-kpi-label">Resource Utilization</span>
            <div className="res-kpi-row">
              <strong className="res-kpi-val">{utilizationPercentage}%</strong>
              <span className="res-chip positive">Target ≥ 80%</span>
            </div>
            <div className="res-progress-rail">
              <div className="res-progress-bar" style={{ width: `${utilizationPercentage}%` }} />
            </div>
            <small className="res-kpi-sub">{totalAllocated} Billable of {totalPoolCount} Total Personnel</small>
          </div>

          <div className="res-kpi-card cost-center">
            <span className="res-kpi-label">On Bench (Cost Center)</span>
            <strong className="res-kpi-val">{matrixItems.filter(e => e.status === "Bench").length}</strong>
            <small className="res-kpi-sub">Available for Immediate Deployment</small>
          </div>

          <div className="res-kpi-card revenue-center">
            <span className="res-kpi-label">Allocated (Revenue Center)</span>
            <strong className="res-kpi-val">{totalAllocated}</strong>
            <small className="res-kpi-sub">Active Client Project Billing</small>
          </div>
        </section>

        {/* Notice alert */}
        {notice && <div className="resource-notice">✓ {notice}</div>}

        {/* Filter Toolbar */}
        <section className="resource-toolbar">
          <div className="toolbar-search-group">
            <input
              type="text"
              placeholder="Search resource by name, code, role, or project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="res-search-input"
            />

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="res-filter-select"
            >
              <option value="ALL">All Departments</option>
              {departments.filter(d => d !== "ALL").map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="res-filter-select"
            >
              <option value="ALL">All Statuses</option>
              <option value="Bench">On Bench Only</option>
              <option value="Allocated">Allocated Only</option>
            </select>
          </div>
        </section>

        {/* Main Allocation Matrix Grid */}
        {loading ? (
          <Loader />
        ) : (
          <div className="allocation-matrix-grid">
            {/* Bench Column (Cost Center) */}
            <div className="matrix-column bench-column">
              <div className="col-header-bar">
                <div className="col-header-info">
                  <span className="col-badge bench">COST CENTER</span>
                  <h3>On Bench <span>Available Resources</span></h3>
                </div>
                <span className="col-count-chip">{benchList.length}</span>
              </div>

              <div className="matrix-cards-scroll">
                {benchList.length > 0 ? (
                  benchList.map(emp => (
                    <div key={emp.id} className="resource-matrix-card bench-card">
                      <div className="res-card-head">
                        <div className="res-avatar">{emp.name.charAt(0).toUpperCase()}</div>
                        <div className="res-details">
                          <strong className="res-name">{emp.name}</strong>
                          <span className="res-code">{emp.code} • {emp.department}</span>
                          <span className="res-role">{emp.role}</span>
                        </div>
                      </div>

                      <div className="res-card-actions">
                        <button
                          type="button"
                          className="btn-allocate"
                          onClick={() => {
                            setSelectedEmp(emp);
                            setProjectInput("Project Titan");
                          }}
                        >
                          ⚡ Allocate to Project
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="matrix-empty-state">
                    <span>🎉 No employees currently on bench</span>
                  </div>
                )}
              </div>
            </div>

            {/* Allocated Column (Revenue Center) */}
            <div className="matrix-column allocated-column">
              <div className="col-header-bar">
                <div className="col-header-info">
                  <span className="col-badge allocated">REVENUE CENTER</span>
                  <h3>Allocated <span>Billable Projects</span></h3>
                </div>
                <span className="col-count-chip">{allocatedList.length}</span>
              </div>

              <div className="matrix-cards-scroll">
                {allocatedList.length > 0 ? (
                  allocatedList.map(emp => (
                    <div key={emp.id} className="resource-matrix-card allocated-card">
                      <div className="res-card-head">
                        <div className="res-avatar allocated">{emp.name.charAt(0).toUpperCase()}</div>
                        <div className="res-details">
                          <strong className="res-name">{emp.name}</strong>
                          <span className="res-code">{emp.code} • {emp.department}</span>
                          <span className="res-role">{emp.role}</span>
                        </div>
                      </div>

                      <div className="res-project-pill">
                        <span>📁 {emp.project || "Active Billable Project"}</span>
                      </div>

                      <div className="res-card-actions split">
                        <button
                          type="button"
                          className="btn-reallocate"
                          onClick={() => {
                            setSelectedEmp(emp);
                            setProjectInput(emp.project || "Project Titan");
                          }}
                        >
                          ✏️ Change Project
                        </button>
                        <button
                          type="button"
                          className="btn-release"
                          onClick={() => handleReleaseToBench(emp)}
                        >
                          ↩️ Release to Bench
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="matrix-empty-state">
                    <span>📭 No employees allocated to active projects</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Allocation Modal */}
        {selectedEmp && (
          <div className="res-modal-backdrop" onClick={() => setSelectedEmp(null)}>
            <form className="res-modal-card" onSubmit={handleConfirmAllocation} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <span className="resource-kicker">Resource Assignment</span>
                  <h2>Allocate {selectedEmp.name}</h2>
                  <p>{selectedEmp.role} ({selectedEmp.code})</p>
                </div>
                <button type="button" className="close-btn" onClick={() => setSelectedEmp(null)}>×</button>
              </div>

              <div className="modal-body">
                <label className="form-field">
                  <span>Billable Project Name / WBS Code *</span>
                  <input
                    type="text"
                    autoFocus
                    required
                    placeholder="e.g. Project Titan"
                    value={projectInput}
                    onChange={(e) => setProjectInput(e.target.value)}
                  />
                </label>

                {/* Quick project chips */}
                <div className="quick-suggestions-wrap">
                  <span className="field-hint">Quick Project Presets:</span>
                  <div className="suggestion-chips">
                    {PROJECT_SUGGESTIONS.map(p => (
                      <button
                        key={p}
                        type="button"
                        className={`chip-btn ${projectInput === p ? "active" : ""}`}
                        onClick={() => setProjectInput(p)}
                      >
                        📁 {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="resource-btn primary">Confirm Allocation</button>
                <button type="button" className="resource-btn secondary" onClick={() => setSelectedEmp(null)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Add Employee to Matrix Modal */}
        {showAddModal && (
          <div className="res-modal-backdrop" onClick={() => setShowAddModal(false)}>
            <form className="res-modal-card" onSubmit={handleAddSubmit} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <span className="resource-kicker">Corporate Roster Matrix</span>
                  <h2>Add Employee to Resource Matrix</h2>
                </div>
                <button type="button" className="close-btn" onClick={() => setShowAddModal(false)}>×</button>
              </div>

              <div className="modal-body">
                <label className="form-field">
                  <span>Select Corporate Employee *</span>
                  <select
                    value={addEmpId}
                    onChange={(e) => setAddEmpId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose employee from roster --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.code}) • {emp.department}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Initial Status *</span>
                  <select
                    value={addStatus}
                    onChange={(e) => setAddStatus(e.target.value)}
                    required
                  >
                    <option value="Bench">On Bench (Cost Center)</option>
                    <option value="Allocated">Allocated (Revenue Center)</option>
                  </select>
                </label>

                {addStatus === "Allocated" && (
                  <label className="form-field">
                    <span>Project Name *</span>
                    <input
                      type="text"
                      required
                      value={addProject}
                      onChange={(e) => setAddProject(e.target.value)}
                      placeholder="e.g. Project Titan"
                    />
                  </label>
                )}
              </div>

              <div className="modal-footer">
                <button type="submit" className="resource-btn primary">Add to Resource Matrix</button>
                <button type="button" className="resource-btn secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </>
  );
}
