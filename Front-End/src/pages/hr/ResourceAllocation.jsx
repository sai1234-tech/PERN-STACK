import React, { useState, useEffect, useMemo } from "react";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import Loader from "../../components/common/Loader";
import { getAllEmployees } from "../../services/employeeService";
import {
  getAllAllocations,
  upsertAllocation,
  updateAllocationStatus,
  loadUnifiedResourceMatrix,
  DUMMY_EMP_IDS,
  DEFAULT_PROJECT_CODES,
  DEFAULT_PROJECT_NAMES,
} from "../../services/allocationService";
import {
  getClients,
  createClient,
  deleteClient,
  getClientProjects,
  createClientProject,
  deleteClientProject,
  getRateCards,
  createRateCard,
  deleteRateCard,
  getTransitions,
  createTransition,
  updateTransition,
} from "../../services/clientMasterService";
import { useSyncRefresh } from "../../utils/syncManager";
import "./ResourceAllocation.css";

const STORAGE_KEY = "hrms_resource_allocation_matrix";

export default function ResourceAllocation() {
  const [activeTab, setActiveTab] = useState("deployments");
  const [employees, setEmployees] = useState([]);
  const [allocations, setAllocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [notice, setNotice] = useState("");

  // Staff-Augmentation Master Entities State
  const [clients, setClients] = useState([]);
  const [clientProjects, setClientProjects] = useState([]);
  const [rateCards, setRateCards] = useState([]);
  const [canManageCommercials, setCanManageCommercials] = useState(false);
  const [transitions, setTransitions] = useState([]);

  // Allocation Modal state
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [projectInput, setProjectInput] = useState("");
  const [sowInput, setSowInput] = useState("");

  // Add Employee to Matrix Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEmpId, setAddEmpId] = useState("");
  const [addStatus, setAddStatus] = useState("Bench");
  const [addProject, setAddProject] = useState("");
  const [addSowNumber, setAddSowNumber] = useState("");

  // Client Master Modal state
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientForm, setClientForm] = useState({
    clientCode: "",
    clientName: "",
    accountOwnerName: "",
    clientManagerName: "",
    clientManagerEmail: "",
    msaReference: "",
    status: "Active"
  });

  // Project & SOW Master Modal state
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectForm, setProjectForm] = useState({
    projectCode: "",
    clientId: "",
    clientName: "",
    projectName: "",
    sowNumber: "",
    billingType: "T&M",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
    deliveryManagerName: "",
    budgetedHours: "1200",
    status: "Active"
  });

  // Commercial Rate Card Modal state
  const [showRateModal, setShowRateModal] = useState(false);
  const [rateForm, setRateForm] = useState({
    clientId: "",
    clientName: "",
    projectId: "",
    projectName: "",
    sowNumber: "",
    roleTitle: "",
    hourlyBillingRate: "",
    currency: "USD"
  });

  // Transition / Replacement Modal state
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [transitionForm, setTransitionForm] = useState({
    empId: "",
    employeeName: "",
    clientName: "",
    projectName: "",
    sowNumber: "",
    transitionType: "Replacement",
    replacementEmpId: "",
    replacementEmpName: "",
    ktStartDate: new Date().toISOString().slice(0, 10),
    ktEndDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    ktStatus: "In Progress",
    clientApprovalStatus: "Pending",
    notes: ""
  });

  // Load all data using unified resource matrix engine
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [
        unifiedMatrixRes,
        clientsRes,
        projectsRes,
        ratesRes,
        transitionsRes
      ] = await Promise.allSettled([
        loadUnifiedResourceMatrix(),
        getClients(),
        getClientProjects(),
        getRateCards(),
        getTransitions()
      ]);

      const unified =
        unifiedMatrixRes.status === "fulfilled" && unifiedMatrixRes.value
          ? unifiedMatrixRes.value
          : { employees: [], allocations: {} };

      const mergedList = unified.employees || [];
      const allocMap = unified.allocations || {};

      setEmployees(mergedList);
      setAllocations(allocMap);

      // Set Master Entities (filtering out legacy seeded default projects)
      if (clientsRes.status === "fulfilled" && clientsRes.value?.data) {
        setClients(clientsRes.value.data);
      }
      const baseProjects =
        projectsRes.status === "fulfilled" && Array.isArray(projectsRes.value?.data)
          ? projectsRes.value.data.filter(
              (p) => !DEFAULT_PROJECT_CODES.has(p.project_code) && !DEFAULT_PROJECT_NAMES.has(p.project_name)
            )
          : [];

      // Also include any active projects from live resource allocations so allocated projects immediately show in Active Projects / SOW Master
      const mergedProjects = [...baseProjects];
      Object.values(allocMap).forEach((al, idx) => {
        if (al?.status === "Allocated" && al.project && !DEFAULT_PROJECT_NAMES.has(al.project)) {
          const exists = mergedProjects.some(
            (p) => String(p.project_name || "").trim().toLowerCase() === String(al.project).trim().toLowerCase()
          );
          if (!exists) {
            mergedProjects.push({
              id: `alloc-proj-${idx}-${al.project}`,
              project_code: `PRJ-${String(al.project).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "ACT"}-0${idx + 1}`,
              project_name: al.project,
              client_name: al.sowNumber ? `SOW: ${al.sowNumber}` : "Active Client Engagement",
              sow_number: al.sowNumber || "SOW-ACTIVE",
              billing_type: "T&M",
              start_date: new Date().toISOString().slice(0, 10),
              end_date: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
              delivery_manager_name: "Vikas Guru",
              budgeted_hours: 1200,
              status: "Active",
            });
          }
        }
      });
      setClientProjects(mergedProjects);
      if (ratesRes.status === "fulfilled" && ratesRes.value?.data) {
        setRateCards(
          ratesRes.value.data.filter((r) => !DEFAULT_PROJECT_NAMES.has(r.project_name))
        );
        setCanManageCommercials(!!ratesRes.value.canManageCommercials);
      }
      if (transitionsRes.status === "fulfilled" && transitionsRes.value?.data) {
        setTransitions(
          transitionsRes.value.data.filter((t) => !DUMMY_EMP_IDS.has(String(t.emp_id)))
        );
      }

    } catch (err) {
      console.error("Failed to load staff-augmentation data:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  useSyncRefresh(() => loadData(true), { interval: 4000, silent: true });

  // Save allocation change helper with real PostgreSQL backend sync
  const updateAllocation = async (empId, status, project = null, sowNumber = null) => {
    const key = String(empId);
    const emp = employees.find(e => String(e.id) === String(empId));
    const updated = {
      ...allocations,
      [key]: {
        status,
        project: status === "Allocated" ? project : null,
        sowNumber: status === "Allocated" ? (sowNumber !== null ? sowNumber : (allocations[key]?.sowNumber || "")) : null,
        name: emp?.name || allocations[key]?.name || "",
        code: emp?.code || allocations[key]?.code || "",
        department: emp?.department || allocations[key]?.department || "Engineering",
        role: emp?.role || allocations[key]?.role || "Engineer",
        releasedToBench: status === "Bench",
      },
    };
    setAllocations(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("hrms_data_updated", { detail: { category: "allocations" } }));
    window.dispatchEvent(new CustomEvent("hrms:data_changed"));

    // Persist to PostgreSQL backend
    try {
      if (emp) {
        await upsertAllocation({
          empId: String(empId),
          employeeName: emp.name,
          employeeCode: emp.code,
          department: emp.department,
          role: emp.role,
          projectName: project || "",
          sowNumber: sowNumber || (allocations[empId]?.sowNumber || ""),
          status,
          billability: status === "Allocated" ? "Billable" : "Internal",
          allocationPercentage: status === "Allocated" ? 100 : 0,
          notes: status === "Bench" ? "RELEASED_TO_BENCH" : "",
        });
      }
    } catch (apiErr) {
      console.warn("Backend allocation update fallback:", apiErr.message);
    }
  };

  // Allocate resource handler
  const handleConfirmAllocation = (e) => {
    e.preventDefault();
    if (selectedEmp && projectInput.trim()) {
      updateAllocation(selectedEmp.id, "Allocated", projectInput.trim(), sowInput.trim());
      setNotice(`Successfully allocated ${selectedEmp.name} to ${projectInput.trim()} (${sowInput.trim() || 'SOW'}).`);
      setSelectedEmp(null);
      setProjectInput("");
      setSowInput("");
      setTimeout(() => setNotice(""), 3500);
    }
  };

  // Release to bench handler
  const handleReleaseToBench = (emp) => {
    updateAllocation(emp.id, "Bench", null, null);
    setNotice(`Released ${emp.name} back to Bench (Cost Center).`);
    setTimeout(() => setNotice(""), 3500);
  };

  // Add Employee to Matrix modal submit
  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!addEmpId) return;
    const targetEmp = employees.find(emp => emp.id === addEmpId);
    if (!targetEmp) return;

    updateAllocation(
      addEmpId,
      addStatus,
      addStatus === "Allocated" ? addProject : null,
      addStatus === "Allocated" ? addSowNumber : null
    );
    setNotice(`Added ${targetEmp.name} to Resource Matrix.`);
    setShowAddModal(false);
    setAddEmpId("");
    setAddSowNumber("");
    setTimeout(() => setNotice(""), 3500);
  };

  // Create Client Submit
  const handleCreateClientSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await createClient(clientForm);
      if (res?.success) {
        setNotice(`Client "${clientForm.clientName}" created successfully.`);
        setShowClientModal(false);
        setClientForm({
          clientCode: "",
          clientName: "",
          accountOwnerName: "",
          clientManagerName: "",
          clientManagerEmail: "",
          msaReference: "",
          status: "Active"
        });
        loadData();
      }
    } catch (err) {
      alert(err.message || "Failed to create client.");
    }
  };

  // Delete Client
  const handleDeleteClient = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove client "${name}"?`)) return;
    try {
      await deleteClient(id);
      setNotice(`Client "${name}" removed.`);
      loadData();
    } catch (err) {
      alert("Failed to delete client.");
    }
  };

  // Create Project SOW Submit
  const handleCreateProjectSubmit = async (e) => {
    e.preventDefault();
    try {
      const targetClient = clients.find(c => String(c.id) === String(projectForm.clientId));
      const payload = {
        ...projectForm,
        clientName: targetClient ? targetClient.client_name : projectForm.clientName || "Enterprise Client"
      };
      const res = await createClientProject(payload);
      if (res?.success) {
        setNotice(`Project SOW "${projectForm.projectName}" created successfully.`);
        setShowProjectModal(false);
        setProjectForm({
          projectCode: "",
          clientId: "",
          clientName: "",
          projectName: "",
          sowNumber: "",
          billingType: "T&M",
          startDate: new Date().toISOString().slice(0, 10),
          endDate: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
          deliveryManagerName: "",
          budgetedHours: "1200",
          status: "Active"
        });
        loadData();
      }
    } catch (err) {
      alert(err.message || "Failed to create project SOW.");
    }
  };

  // Delete Project SOW
  const handleDeleteProject = async (id, name) => {
    if (!window.confirm(`Delete project SOW "${name}"?`)) return;
    try {
      await deleteClientProject(id);
      setNotice(`Project "${name}" deleted.`);
      loadData();
    } catch (err) {
      alert("Failed to delete project.");
    }
  };

  // Create Rate Card Submit
  const handleCreateRateSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await createRateCard(rateForm);
      if (res?.success) {
        setNotice(`Commercial Rate Card for "${rateForm.roleTitle}" added.`);
        setShowRateModal(false);
        setRateForm({
          clientId: "",
          clientName: "",
          projectId: "",
          projectName: "",
          sowNumber: "",
          roleTitle: "",
          hourlyBillingRate: "",
          currency: "USD"
        });
        loadData();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to create rate card.");
    }
  };

  // Delete Rate Card
  const handleDeleteRateCard = async (id) => {
    if (!window.confirm("Delete this commercial rate-card entry?")) return;
    try {
      await deleteRateCard(id);
      setNotice("Rate card entry removed.");
      loadData();
    } catch (err) {
      alert("Failed to delete rate card.");
    }
  };

  // Create Transition Submit
  const handleCreateTransitionSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await createTransition(transitionForm);
      if (res?.success) {
        setNotice(`Transition workflow initiated for ${transitionForm.employeeName}.`);
        setShowTransitionModal(false);
        setTransitionForm({
          empId: "",
          employeeName: "",
          clientName: "",
          projectName: "",
          sowNumber: "",
          transitionType: "Replacement",
          replacementEmpId: "",
          replacementEmpName: "",
          ktStartDate: new Date().toISOString().slice(0, 10),
          ktEndDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
          ktStatus: "In Progress",
          clientApprovalStatus: "Pending",
          notes: ""
        });
        loadData();
      }
    } catch (err) {
      alert(err.message || "Failed to initiate transition.");
    }
  };

  // Update Transition Status
  const handleUpdateTransitionStatus = async (id, ktStatus, clientApprovalStatus) => {
    try {
      await updateTransition(id, { ktStatus, clientApprovalStatus });
      setNotice("Transition status updated.");
      loadData();
    } catch (err) {
      alert("Failed to update transition status.");
    }
  };

  // Quick pick project and auto-fill SOW in allocation modal
  const handlePickClientProject = (proj) => {
    setProjectInput(proj.project_name);
    setSowInput(proj.sow_number || "");
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
      const alloc = allocations[String(e.id)] || { status: "Bench", project: null, sowNumber: "" };
      return {
        ...e,
        status: alloc.status,
        project: alloc.project,
        sowNumber: alloc.sowNumber || "",
      };
    });
  }, [employees, allocations]);

  // Filtered lists for matrix
  const filteredItems = useMemo(() => {
    return matrixItems.filter(item => {
      const name = item.name || "";
      const code = item.code || "";
      const role = item.role || "";
      const project = item.project || "";
      const sow = item.sowNumber || "";
      const dept = item.department || "";

      const matchesSearch =
        name.toLowerCase().includes(search.toLowerCase()) ||
        code.toLowerCase().includes(search.toLowerCase()) ||
        role.toLowerCase().includes(search.toLowerCase()) ||
        project.toLowerCase().includes(search.toLowerCase()) ||
        sow.toLowerCase().includes(search.toLowerCase());

      const matchesDept = deptFilter === "ALL" || dept.toLowerCase() === deptFilter.toLowerCase();
      const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [matrixItems, search, deptFilter, statusFilter]);

  const benchList = useMemo(() => filteredItems.filter(e => e.status === "Bench"), [filteredItems]);
  const allocatedList = useMemo(() => filteredItems.filter(e => e.status === "Allocated"), [filteredItems]);

  const totalPoolCount = matrixItems.length;
  const totalAllocated = matrixItems.filter(e => e.status === "Allocated").length;
  const totalBench = matrixItems.filter(e => e.status === "Bench").length;
  const utilizationPercentage = totalPoolCount > 0 ? Math.round((totalAllocated / totalPoolCount) * 100) : 0;

  // CSV Report Generator
  const handleExportReportCSV = () => {
    const headers = [
      "Employee ID",
      "Employee Name",
      "Employee Code",
      "Department",
      "Designation Role",
      "Allocation Status",
      "Assigned Project",
      "SOW Number",
      "Financial Classification"
    ];

    const rows = matrixItems.map(item => [
      item.id,
      `"${item.name}"`,
      item.code,
      `"${item.department}"`,
      `"${item.role}"`,
      item.status,
      `"${item.project || 'Unassigned (Bench)'}"`,
      `"${item.sowNumber || 'N/A'}"`,
      item.status === 'Allocated' ? 'Revenue Center (Billable)' : 'Cost Center (Available Bench)'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Staff_Augmentation_Deployment_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const TABS = [
    { id: "deployments", label: "👥 Deployment Matrix", icon: "👥" },
    { id: "clients", label: "🏢 Client Master", count: clients.length, icon: "🏢" },
    { id: "projects", label: "📄 Project & SOW Master", count: clientProjects.length, icon: "📄" },
    { id: "rateCards", label: "💵 Rate-Cards (Restricted)", count: rateCards.length, icon: "💵" },
    { id: "transitions", label: "🔄 Transitions & Handover", count: transitions.length, icon: "🔄" },
    { id: "reports", label: "📊 Capacity & Utilization Reports", icon: "📊" },
  ];

  return (
    <>
      <EmployeeHeader />
      <main className="resource-hub-page">
        {/* Banner */}
        <header className="resource-banner">
          <div>
            <span className="resource-kicker">Project Deployment &amp; SOW Management</span>
            <h1>Resource Allocation</h1>
            <p>Manage employee project deployments, client accounts, SOW contracts, rate-cards, and handover transitions.</p>
          </div>
          <div className="banner-action-cluster">
            {activeTab === "deployments" && (
              <button
                type="button"
                className="resource-btn primary"
                onClick={() => setShowAddModal(true)}
              >
                ➕ Add Employee to Matrix
              </button>
            )}
            {activeTab === "clients" && (
              <button
                type="button"
                className="resource-btn primary"
                onClick={() => setShowClientModal(true)}
              >
                ➕ Add New Client
              </button>
            )}
            {activeTab === "projects" && (
              <button
                type="button"
                className="resource-btn primary"
                onClick={() => setShowProjectModal(true)}
              >
                ➕ Create Project / SOW
              </button>
            )}
            {activeTab === "rateCards" && canManageCommercials && (
              <button
                type="button"
                className="resource-btn primary"
                onClick={() => setShowRateModal(true)}
              >
                ➕ Add Commercial Rate-Card
              </button>
            )}
            {activeTab === "transitions" && (
              <button
                type="button"
                className="resource-btn primary"
                onClick={() => setShowTransitionModal(true)}
              >
                ➕ Initiate Transition / Roll-off
              </button>
            )}
            {activeTab === "reports" && (
              <button
                type="button"
                className="resource-btn primary"
                onClick={handleExportReportCSV}
              >
                📥 Export Deployment Report (CSV)
              </button>
            )}
          </div>
        </header>

        {/* Global Staff-Augmentation Navigation Bar */}
        <nav className="staff-nav-tabs-bar" aria-label="Staff Augmentation Hub Navigation">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`staff-tab-pill ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span className="badge-code" style={{ padding: "0.1rem 0.4rem", marginLeft: "4px" }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Notice alert */}
        {notice && <div className="resource-notice">✓ {notice}</div>}

        {/* =========================================================================
            TAB 1: DEPLOYMENT MATRIX & BENCH (EXISTING INTERACTIVE DUAL COLUMN)
        ========================================================================== */}
        {activeTab === "deployments" && (
          <>
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
                <strong className="res-kpi-val">{totalBench}</strong>
                <small className="res-kpi-sub">Available for Immediate SOW Deployment</small>
              </div>

              <div className="res-kpi-card revenue-center">
                <span className="res-kpi-label">Allocated (Revenue Center)</span>
                <strong className="res-kpi-val">{totalAllocated}</strong>
                <small className="res-kpi-sub">Active Client Project Billing</small>
              </div>
            </section>

            {/* Filter Toolbar */}
            <section className="resource-toolbar">
              <div className="toolbar-search-group">
                <input
                  type="text"
                  placeholder="Search resource by name, code, role, project, or SOW..."
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
                    <span className="col-count-pill">{benchList.length}</span>
                  </div>

                  <div className="resource-card-stack">
                    {benchList.length === 0 ? (
                      <div className="empty-col-box">
                        <span>✨</span>
                        <p>No resources currently on bench.</p>
                      </div>
                    ) : (
                      benchList.map(emp => (
                        <div key={emp.id} className="resource-card bench-card">
                          <div className="res-card-top">
                            <div className="res-avatar-pod">
                              {emp.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="res-info">
                              <h4>{emp.name}</h4>
                              <div className="res-meta-line">
                                <span className="res-code">{emp.code || 'EMP'}</span>
                                <span className="meta-bullet">•</span>
                                <span className="res-dept">{emp.department}</span>
                              </div>
                            </div>
                          </div>

                          <div className="res-role-strip">
                            <strong>Role:</strong> {emp.role}
                          </div>

                          <div className="res-card-actions">
                            <button
                              type="button"
                              className="action-link-btn allocate"
                              onClick={() => {
                                setSelectedEmp(emp);
                                setProjectInput("");
                                setSowInput("");
                              }}
                            >
                              ⚡ Allocate to Client Project
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Allocated Column (Revenue Center) */}
                <div className="matrix-column allocated-column">
                  <div className="col-header-bar">
                    <div className="col-header-info">
                      <span className="col-badge allocated">REVENUE CENTER</span>
                      <h3>Allocated <span>Billable Client SOWs</span></h3>
                    </div>
                    <span className="col-count-pill">{allocatedList.length}</span>
                  </div>

                  <div className="resource-card-stack">
                    {allocatedList.length === 0 ? (
                      <div className="empty-col-box">
                        <span>📋</span>
                        <p>No active project allocations found.</p>
                      </div>
                    ) : (
                      allocatedList.map(emp => (
                        <div key={emp.id} className="resource-card allocated-card">
                          <div className="res-card-top">
                            <div className="res-avatar-pod active">
                              {emp.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="res-info">
                              <h4>{emp.name}</h4>
                              <div className="res-meta-line">
                                <span className="res-code">{emp.code || 'EMP'}</span>
                                <span className="meta-bullet">•</span>
                                <span className="res-dept">{emp.department}</span>
                              </div>
                            </div>
                          </div>

                          <div className="res-project-pill">
                            <span className="pill-dot active" />
                            <div className="pill-details">
                              <span className="pill-title">🚀 {emp.project}</span>
                              {emp.sowNumber && (
                                <span className="pill-sow">📄 SOW: {emp.sowNumber}</span>
                              )}
                            </div>
                          </div>

                          <div className="res-role-strip">
                            <strong>Role:</strong> {emp.role}
                          </div>

                          <div className="res-card-actions">
                            <button
                              type="button"
                              className="action-link-btn reassign"
                              onClick={() => {
                                setSelectedEmp(emp);
                                setProjectInput(emp.project || "");
                                setSowInput(emp.sowNumber || "");
                              }}
                            >
                              ✏️ Reassign
                            </button>
                            <button
                              type="button"
                              className="action-link-btn release"
                              onClick={() => handleReleaseToBench(emp)}
                            >
                              🔄 Release to Bench
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* =========================================================================
            TAB 2: CLIENT MASTER (ACCOUNTS, CLIENT CODES, ACCOUNT OWNERS)
        ========================================================================== */}
        {activeTab === "clients" && (
          <section className="master-table-card">
            <div className="master-table-header">
              <div>
                <h2>🏢 Client Account Directory</h2>
                <p>Register enterprise clients, unique client identifiers, account owners, and Master Service Agreements (MSA).</p>
              </div>
              <button
                type="button"
                className="resource-btn primary"
                onClick={() => setShowClientModal(true)}
              >
                ➕ Add New Client
              </button>
            </div>

            <div className="table-responsive-box">
              <table className="master-data-table">
                <thead>
                  <tr>
                    <th>Client Code</th>
                    <th>Client Organization</th>
                    <th>Account Owner (Internal)</th>
                    <th>Client Manager POC</th>
                    <th>MSA Reference</th>
                    <th>Status</th>
                    <th>Registered On</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                        No clients registered yet. Click "+ Add New Client" to start.
                      </td>
                    </tr>
                  ) : (
                    clients.map(c => (
                      <tr key={c.id}>
                        <td><span className="badge-code">{c.client_code}</span></td>
                        <td><strong>{c.client_name}</strong></td>
                        <td>{c.account_owner_name || "Unassigned"}</td>
                        <td>
                          <div>{c.client_manager_name || "—"}</div>
                          <small style={{ color: "#64748b" }}>{c.client_manager_email}</small>
                        </td>
                        <td><span className="badge-code">{c.msa_reference || "MSA-PENDING"}</span></td>
                        <td>
                          <span className={`status-chip ${String(c.status).toLowerCase()}`}>
                            ● {c.status}
                          </span>
                        </td>
                        <td>{new Date(c.created_at || Date.now()).toLocaleDateString()}</td>
                        <td>
                          <button
                            type="button"
                            className="action-link-btn release"
                            onClick={() => handleDeleteClient(c.id, c.client_name)}
                          >
                            🗑️ Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* =========================================================================
            TAB 3: PROJECT & SOW MASTER (PROJECT CODES, SOW NUMBERS, DATES)
        ========================================================================== */}
        {activeTab === "projects" && (
          <section className="master-table-card">
            <div className="master-table-header">
              <div>
                <h2>📄 Project & SOW Master Registry</h2>
                <p>Manage Statements of Work (SOW), project deliverables, delivery managers, and engagement dates.</p>
              </div>
              <button
                type="button"
                className="resource-btn primary"
                onClick={() => setShowProjectModal(true)}
              >
                ➕ Create Project / SOW
              </button>
            </div>

            <div className="table-responsive-box">
              <table className="master-data-table">
                <thead>
                  <tr>
                    <th>Project Code</th>
                    <th>Client Name</th>
                    <th>Project Name</th>
                    <th>SOW Number</th>
                    <th>Model</th>
                    <th>Deployment Window</th>
                    <th>Delivery Manager</th>
                    <th>Budgeted Hours</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {clientProjects.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                        No project SOWs found.
                      </td>
                    </tr>
                  ) : (
                    clientProjects.map(p => (
                      <tr key={p.id}>
                        <td><span className="badge-code">{p.project_code}</span></td>
                        <td>{p.client_name}</td>
                        <td><strong>{p.project_name}</strong></td>
                        <td><span className="badge-code">{p.sow_number}</span></td>
                        <td>
                          <span className="status-chip active" style={{ fontSize: "0.7rem" }}>
                            {p.billing_type || "T&M"}
                          </span>
                        </td>
                        <td>
                          <small>
                            {new Date(p.start_date).toLocaleDateString()} ➔ {new Date(p.end_date).toLocaleDateString()}
                          </small>
                        </td>
                        <td>{p.delivery_manager_name || "Vikas Guru"}</td>
                        <td><strong>{Number(p.budgeted_hours || 0).toFixed(1)} hrs</strong></td>
                        <td>
                          <span className={`status-chip ${String(p.status).toLowerCase()}`}>
                            ● {p.status}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="action-link-btn release"
                            onClick={() => handleDeleteProject(p.id, p.project_name)}
                          >
                            🗑️ Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* =========================================================================
            TAB 4: RESTRICTED RATE-CARDS (COMMERCIALS WITH RBAC DATA MASKING)
        ========================================================================== */}
        {activeTab === "rateCards" && (
          <section className="master-table-card">
            <div className="master-table-header">
              <div>
                <h2>💵 Commercial Rate-Cards & Billing References</h2>
                <p>Role-based client billing rates. Standard workforce members view protected masks; Finance & Leadership view unmasked rates.</p>
              </div>
              {canManageCommercials && (
                <button
                  type="button"
                  className="resource-btn primary"
                  onClick={() => setShowRateModal(true)}
                >
                  ➕ Add Commercial Rate-Card
                </button>
              )}
            </div>

            <div className="commercial-notice-box">
              <span>
                {canManageCommercials
                  ? "🔒 Full Commercial Access: You have authorized clearance (Admin / Finance / Leadership) to inspect client billing rates."
                  : "🔒 Confidential Commercial Data: Hourly client billing rate values are masked under strict enterprise confidentiality."}
              </span>
              <span className="badge-code" style={{ background: "#ffffff" }}>
                {canManageCommercials ? "CLEARANCE: AUTHORIZED" : "CLEARANCE: RESTRICTED"}
              </span>
            </div>

            <div className="table-responsive-box">
              <table className="master-data-table">
                <thead>
                  <tr>
                    <th>Role Designation</th>
                    <th>Client Organization</th>
                    <th>Project & SOW</th>
                    <th>Hourly Rate</th>
                    <th>Estimated Monthly (160h)</th>
                    <th>Currency</th>
                    <th>Effective Date</th>
                    {canManageCommercials && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {rateCards.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                        No commercial rate-cards configured.
                      </td>
                    </tr>
                  ) : (
                    rateCards.map(rc => (
                      <tr key={rc.id}>
                        <td><strong>{rc.role_title}</strong></td>
                        <td>{rc.client_name}</td>
                        <td>
                          <div>{rc.project_name}</div>
                          {rc.sow_number && <small className="badge-code">{rc.sow_number}</small>}
                        </td>
                        <td>
                          <span className={`rate-val-pill ${rc.isRestricted ? "restricted" : ""}`}>
                            {rc.isRestricted ? "••••••" : `${rc.currency} ${Number(rc.hourly_billing_rate).toFixed(2)}/hr`}
                          </span>
                        </td>
                        <td>
                          <span className={`rate-val-pill ${rc.isRestricted ? "restricted" : ""}`}>
                            {rc.isRestricted ? "••••••" : `${rc.currency} ${Number(rc.monthly_billing_rate || rc.hourly_billing_rate * 160).toFixed(2)}`}
                          </span>
                        </td>
                        <td><strong>{rc.currency}</strong></td>
                        <td>{new Date(rc.effective_date || Date.now()).toLocaleDateString()}</td>
                        {canManageCommercials && (
                          <td>
                            <button
                              type="button"
                              className="action-link-btn release"
                              onClick={() => handleDeleteRateCard(rc.id)}
                            >
                              🗑️ Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* =========================================================================
            TAB 5: TRANSITIONS & REPLACEMENT TRACKER
        ========================================================================== */}
        {activeTab === "transitions" && (
          <section className="master-table-card">
            <div className="master-table-header">
              <div>
                <h2>🔄 Client Transition & Handover Tracker</h2>
                <p>Track project roll-offs, Knowledge Transfer (KT) periods, shadowing replacements, and client sign-off status.</p>
              </div>
              <button
                type="button"
                className="resource-btn primary"
                onClick={() => setShowTransitionModal(true)}
              >
                ➕ Initiate Transition / Roll-off
              </button>
            </div>

            <div className="table-responsive-box">
              <table className="master-data-table">
                <thead>
                  <tr>
                    <th>Outgoing Resource</th>
                    <th>Client Engagement</th>
                    <th>Transition Type</th>
                    <th>Shadowing Replacement</th>
                    <th>KT Schedule</th>
                    <th>KT Status</th>
                    <th>Client Sign-off</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transitions.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                        No in-flight transitions. Click "+ Initiate Transition" when rolling off resources.
                      </td>
                    </tr>
                  ) : (
                    transitions.map(t => (
                      <tr key={t.id}>
                        <td>
                          <strong>{t.employee_name}</strong>
                          <div><span className="badge-code">{t.emp_id}</span></div>
                        </td>
                        <td>
                          <div>{t.client_name}</div>
                          <small style={{ color: "#64748b" }}>{t.project_name} ({t.sow_number || "SOW"})</small>
                        </td>
                        <td>
                          <span className="status-chip active" style={{ fontSize: "0.72rem" }}>
                            {t.transition_type}
                          </span>
                        </td>
                        <td>
                          {t.replacement_emp_name ? (
                            <div>
                              <strong>{t.replacement_emp_name}</strong>
                              <div><span className="badge-code">{t.replacement_emp_id}</span></div>
                            </div>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>— None (Direct Roll-off)</span>
                          )}
                        </td>
                        <td>
                          <small>
                            {t.kt_start_date ? new Date(t.kt_start_date).toLocaleDateString() : "TBD"} ➔{" "}
                            {t.kt_end_date ? new Date(t.kt_end_date).toLocaleDateString() : "TBD"}
                          </small>
                        </td>
                        <td>
                          <span className={`status-chip ${String(t.kt_status).toLowerCase().replace(" ", "-")}`}>
                            ● {t.kt_status}
                          </span>
                        </td>
                        <td>
                          <span className={`status-chip ${String(t.client_approval_status).toLowerCase()}`}>
                            {t.client_approval_status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "0.4rem" }}>
                            {t.kt_status !== "Completed" && (
                              <button
                                type="button"
                                className="action-link-btn allocate"
                                onClick={() => handleUpdateTransitionStatus(t.id, "Completed", "Approved")}
                              >
                                ✓ Complete KT
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* =========================================================================
            TAB 6: CAPACITY, UTILIZATION & EXECUTIVE REPORTS
        ========================================================================== */}
        {activeTab === "reports" && (
          <section className="master-table-card">
            <div className="master-table-header">
              <div>
                <h2>📊 Staff-Augmentation Executive Reports</h2>
                <p>Consolidated breakdown of deployed revenue personnel, bench liability, SOW coverage, and replacement forecasts.</p>
              </div>
              <button
                type="button"
                className="resource-btn primary"
                onClick={handleExportReportCSV}
              >
                📥 Export Deployment Report (CSV)
              </button>
            </div>

            <div className="reports-kpi-row">
              <div className="report-summary-card">
                <span>Total Workforce Pool</span>
                <strong>{totalPoolCount}</strong>
                <small style={{ color: "#64748b" }}>All active employees in roster</small>
              </div>

              <div className="report-summary-card" style={{ borderLeft: "4px solid #10b981" }}>
                <span style={{ color: "#059669" }}>Deployed Revenue Center</span>
                <strong style={{ color: "#059669" }}>{totalAllocated}</strong>
                <small style={{ color: "#64748b" }}>Active billable client engagements</small>
              </div>

              <div className="report-summary-card" style={{ borderLeft: "4px solid #f59e0b" }}>
                <span style={{ color: "#d97706" }}>Available Cost Center (Bench)</span>
                <strong style={{ color: "#d97706" }}>{totalBench}</strong>
                <small style={{ color: "#64748b" }}>Ready for immediate deployment</small>
              </div>

              <div className="report-summary-card" style={{ borderLeft: "4px solid #0284c7" }}>
                <span style={{ color: "#0284c7" }}>Overall Utilization Rate</span>
                <strong style={{ color: "#0284c7" }}>{utilizationPercentage}%</strong>
                <small style={{ color: "#64748b" }}>Target healthy threshold ≥ 80%</small>
              </div>

              <div className="report-summary-card" style={{ borderLeft: "4px solid #8b5cf6" }}>
                <span style={{ color: "#7c3aed" }}>Active SOW Contracts</span>
                <strong style={{ color: "#7c3aed" }}>{clientProjects.length}</strong>
                <small style={{ color: "#64748b" }}>Across {clients.length} Enterprise Clients</small>
              </div>

              <div className="report-summary-card" style={{ borderLeft: "4px solid #f43f5e" }}>
                <span style={{ color: "#e11d48" }}>Transitions / KT In-Flight</span>
                <strong style={{ color: "#e11d48" }}>{transitions.length}</strong>
                <small style={{ color: "#64748b" }}>Roll-offs and replacement tracking</small>
              </div>
            </div>

            <div className="master-table-header" style={{ marginTop: "1rem" }}>
              <h3>Detailed Deployment Roster</h3>
            </div>

            <div className="table-responsive-box">
              <table className="master-data-table">
                <thead>
                  <tr>
                    <th>Emp ID</th>
                    <th>Resource Name</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Status</th>
                    <th>Client Project</th>
                    <th>SOW Number</th>
                    <th>Classification</th>
                  </tr>
                </thead>
                <tbody>
                  {matrixItems.map(item => (
                    <tr key={item.id}>
                      <td><span className="badge-code">{item.code || item.id}</span></td>
                      <td><strong>{item.name}</strong></td>
                      <td>{item.department}</td>
                      <td>{item.role}</td>
                      <td>
                        <span className={`status-chip ${item.status === "Allocated" ? "active" : "pending"}`}>
                          ● {item.status}
                        </span>
                      </td>
                      <td>{item.project || "— Unassigned —"}</td>
                      <td>{item.sowNumber ? <span className="badge-code">{item.sowNumber}</span> : "—"}</td>
                      <td>
                        <strong style={{ color: item.status === "Allocated" ? "#059669" : "#d97706" }}>
                          {item.status === "Allocated" ? "Revenue Center (Billable)" : "Cost Center (Bench)"}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* =========================================================================
            MODALS
        ========================================================================== */}

        {/* Allocate Resource Modal */}
        {selectedEmp && (
          <div className="res-modal-backdrop" onClick={() => setSelectedEmp(null)}>
            <form className="res-modal-card" onSubmit={handleConfirmAllocation} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <span className="resource-kicker">Deployment Assignment</span>
                  <h2>Allocate {selectedEmp.name}</h2>
                </div>
                <button type="button" className="close-btn" onClick={() => setSelectedEmp(null)}>×</button>
              </div>

              <div className="modal-body">
                <div className="target-emp-summary">
                  <div className="emp-avatar-sm">{selectedEmp.name.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <strong>{selectedEmp.name}</strong>
                    <span>{selectedEmp.role} • {selectedEmp.department}</span>
                  </div>
                </div>

                {/* Quick Pick From Registered Client Projects */}
                {clientProjects.length > 0 && (
                  <div style={{ marginBottom: "1rem" }}>
                    <span className="field-hint" style={{ marginBottom: "0.35rem", display: "block" }}>
                      Quick Pick From Registered Client SOWs:
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                      {clientProjects.map(proj => (
                        <button
                          key={proj.id}
                          type="button"
                          className="chip-btn"
                          onClick={() => handlePickClientProject(proj)}
                        >
                          🏢 {proj.project_name} ({proj.sow_number})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <label className="form-field">
                  <span>Project Name *</span>
                  <input
                    type="text"
                    required
                    value={projectInput}
                    onChange={(e) => setProjectInput(e.target.value)}
                    placeholder="Enter or pick a registered Client Project"
                    autoFocus
                  />
                </label>

                <label className="form-field" style={{ marginTop: "0.75rem" }}>
                  <span>SOW Number (Statement of Work)</span>
                  <input
                    type="text"
                    value={sowInput}
                    onChange={(e) => setSowInput(e.target.value)}
                    placeholder="Enter SOW Number"
                  />
                </label>
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
                <button type="button" className="close-btn" aria-label="Close modal" onClick={() => setShowAddModal(false)}>✕</button>
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
                  <>
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

                    <label className="form-field" style={{ marginTop: "0.5rem" }}>
                      <span>SOW Number (Statement of Work)</span>
                      <input
                        type="text"
                        value={addSowNumber}
                        onChange={(e) => setAddSowNumber(e.target.value)}
                        placeholder="e.g. SOW-2026-ENG-001"
                      />
                    </label>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button type="submit" className="resource-btn primary">Add to Resource Matrix</button>
                <button type="button" className="resource-btn secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Add New Client Modal */}
        {showClientModal && (
          <div className="res-modal-backdrop" onClick={() => setShowClientModal(false)}>
            <form className="res-modal-card" onSubmit={handleCreateClientSubmit} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <span className="resource-kicker">Client Master Registration</span>
                  <h2>Register New Client Account</h2>
                </div>
                <button type="button" className="close-btn" aria-label="Close modal" onClick={() => setShowClientModal(false)}>✕</button>
              </div>

              <div className="modal-body">
                <label className="form-field">
                  <span>Client Code * (Unique Identifier)</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CLT-GOOG-004"
                    value={clientForm.clientCode}
                    onChange={(e) => setClientForm({ ...clientForm, clientCode: e.target.value })}
                  />
                </label>

                <label className="form-field">
                  <span>Client Organization Name *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Google Cloud Platforms"
                    value={clientForm.clientName}
                    onChange={(e) => setClientForm({ ...clientForm, clientName: e.target.value })}
                  />
                </label>

                <label className="form-field">
                  <span>Account Owner Name (Internal Partner)</span>
                  <input
                    type="text"
                    placeholder="e.g. Meera Nair (VP Operations)"
                    value={clientForm.accountOwnerName}
                    onChange={(e) => setClientForm({ ...clientForm, accountOwnerName: e.target.value })}
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
                  <label className="form-field">
                    <span>Client Manager POC</span>
                    <input
                      type="text"
                      placeholder="e.g. Sundar Pichai"
                      value={clientForm.clientManagerName}
                      onChange={(e) => setClientForm({ ...clientForm, clientManagerName: e.target.value })}
                    />
                  </label>

                  <label className="form-field">
                    <span>Client Manager Email</span>
                    <input
                      type="email"
                      placeholder="e.g. sundar@google.com"
                      value={clientForm.clientManagerEmail}
                      onChange={(e) => setClientForm({ ...clientForm, clientManagerEmail: e.target.value })}
                    />
                  </label>
                </div>

                <label className="form-field">
                  <span>MSA Reference (Master Service Agreement)</span>
                  <input
                    type="text"
                    placeholder="e.g. MSA-2026-GOOG-GLOBAL"
                    value={clientForm.msaReference}
                    onChange={(e) => setClientForm({ ...clientForm, msaReference: e.target.value })}
                  />
                </label>
              </div>

              <div className="modal-footer">
                <button type="submit" className="resource-btn primary">Save Client Account</button>
                <button type="button" className="resource-btn secondary" onClick={() => setShowClientModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Create Project SOW Modal */}
        {showProjectModal && (
          <div className="res-modal-backdrop" onClick={() => setShowProjectModal(false)}>
            <form className="res-modal-card" onSubmit={handleCreateProjectSubmit} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <span className="resource-kicker">SOW Contract Creation</span>
                  <h2>Create Project / SOW Master</h2>
                </div>
                <button type="button" className="close-btn" aria-label="Close modal" onClick={() => setShowProjectModal(false)}>✕</button>
              </div>

              <div className="modal-body">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <label className="form-field">
                    <span>Project Code *</span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PRJ-NEXUS-04"
                      value={projectForm.projectCode}
                      onChange={(e) => setProjectForm({ ...projectForm, projectCode: e.target.value })}
                    />
                  </label>

                  <label className="form-field">
                    <span>Client Account *</span>
                    <select
                      required
                      value={projectForm.clientId}
                      onChange={(e) => setProjectForm({ ...projectForm, clientId: e.target.value })}
                    >
                      <option value="">-- Choose Client --</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.client_name} ({c.client_code})</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="form-field">
                  <span>Project Deliverable Name *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Project Nexus (Cloud AI Platform)"
                    value={projectForm.projectName}
                    onChange={(e) => setProjectForm({ ...projectForm, projectName: e.target.value })}
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <label className="form-field">
                    <span>SOW Number *</span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SOW-2026-ENG-004"
                      value={projectForm.sowNumber}
                      onChange={(e) => setProjectForm({ ...projectForm, sowNumber: e.target.value })}
                    />
                  </label>

                  <label className="form-field">
                    <span>Billing Model</span>
                    <select
                      value={projectForm.billingType}
                      onChange={(e) => setProjectForm({ ...projectForm, billingType: e.target.value })}
                    >
                      <option value="T&M">Time & Material (T&M)</option>
                      <option value="Fixed Price">Fixed Price Milestone</option>
                      <option value="Retainer">Monthly Retainer</option>
                    </select>
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <label className="form-field">
                    <span>Start Date</span>
                    <input
                      type="date"
                      required
                      value={projectForm.startDate}
                      onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })}
                    />
                  </label>

                  <label className="form-field">
                    <span>End Date</span>
                    <input
                      type="date"
                      required
                      value={projectForm.endDate}
                      onChange={(e) => setProjectForm({ ...projectForm, endDate: e.target.value })}
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <label className="form-field">
                    <span>Delivery Manager</span>
                    <input
                      type="text"
                      placeholder="e.g. Vikas Guru"
                      value={projectForm.deliveryManagerName}
                      onChange={(e) => setProjectForm({ ...projectForm, deliveryManagerName: e.target.value })}
                    />
                  </label>

                  <label className="form-field">
                    <span>Budgeted Hours</span>
                    <input
                      type="number"
                      placeholder="e.g. 1200"
                      value={projectForm.budgetedHours}
                      onChange={(e) => setProjectForm({ ...projectForm, budgetedHours: e.target.value })}
                    />
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="resource-btn primary">Save Project SOW</button>
                <button type="button" className="resource-btn secondary" onClick={() => setShowProjectModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Add Commercial Rate Card Modal */}
        {showRateModal && (
          <div className="res-modal-backdrop" onClick={() => setShowRateModal(false)}>
            <form className="res-modal-card" onSubmit={handleCreateRateSubmit} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <span className="resource-kicker">Restricted Commercial Setup</span>
                  <h2>Add Client Rate-Card Entry</h2>
                </div>
                <button type="button" className="close-btn" aria-label="Close modal" onClick={() => setShowRateModal(false)}>✕</button>
              </div>

              <div className="modal-body">
                <label className="form-field">
                  <span>Role Title / Designation *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Principal Cloud Architect"
                    value={rateForm.roleTitle}
                    onChange={(e) => setRateForm({ ...rateForm, roleTitle: e.target.value })}
                  />
                </label>

                {/* Quick Pick From Registered Project SOWs */}
                {clientProjects.length > 0 && (
                  <div style={{ marginBottom: "0.25rem" }}>
                    <span className="field-hint" style={{ marginBottom: "0.35rem", display: "block" }}>
                      Quick Pick From Registered Project SOWs:
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                      {clientProjects.map(proj => (
                        <button
                          key={proj.id}
                          type="button"
                          className="chip-btn"
                          onClick={() => {
                            setRateForm({
                              ...rateForm,
                              clientId: proj.client_id || "",
                              clientName: proj.client_name || "",
                              projectId: proj.id,
                              projectName: proj.project_name,
                              sowNumber: proj.sow_number || ""
                            });
                          }}
                        >
                          🏢 {proj.project_name} ({proj.sow_number})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
                  <label className="form-field">
                    <span>Client Account (Optional)</span>
                    <select
                      value={rateForm.clientId}
                      onChange={(e) => {
                        const target = clients.find(c => String(c.id) === String(e.target.value));
                        setRateForm({
                          ...rateForm,
                          clientId: e.target.value,
                          clientName: target ? target.client_name : ""
                        });
                      }}
                    >
                      <option value="">-- Choose Client --</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.client_name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="form-field">
                    <span>Project Deliverable / Name</span>
                    <input
                      type="text"
                      placeholder="e.g. HMRS Application Development"
                      value={rateForm.projectName}
                      onChange={(e) => setRateForm({ ...rateForm, projectName: e.target.value })}
                    />
                  </label>
                </div>

                <label className="form-field">
                  <span>SOW Number</span>
                  <input
                    type="text"
                    placeholder="e.g. SOW-2026-ENG-001"
                    value={rateForm.sowNumber}
                    onChange={(e) => setRateForm({ ...rateForm, sowNumber: e.target.value })}
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "1rem" }}>
                  <label className="form-field">
                    <span>Hourly Billing Rate *</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 115.00"
                      value={rateForm.hourlyBillingRate}
                      onChange={(e) => setRateForm({ ...rateForm, hourlyBillingRate: e.target.value })}
                    />
                  </label>

                  <label className="form-field">
                    <span>Currency</span>
                    <select
                      value={rateForm.currency}
                      onChange={(e) => setRateForm({ ...rateForm, currency: e.target.value })}
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="INR">INR (₹)</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="resource-btn primary">Save Rate-Card Entry</button>
                <button type="button" className="resource-btn secondary" onClick={() => setShowRateModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Initiate Transition Modal */}
        {showTransitionModal && (
          <div className="res-modal-backdrop" onClick={() => setShowTransitionModal(false)}>
            <form className="res-modal-card" onSubmit={handleCreateTransitionSubmit} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <span className="resource-kicker">Knowledge Transfer & Rotation</span>
                  <h2>Initiate Resource Transition</h2>
                </div>
                <button type="button" className="close-btn" aria-label="Close modal" onClick={() => setShowTransitionModal(false)}>✕</button>
              </div>

              <div className="modal-body">
                <label className="form-field">
                  <span>Outgoing Resource *</span>
                  <select
                    required
                    value={transitionForm.empId}
                    onChange={(e) => {
                      const emp = employees.find(m => String(m.id) === String(e.target.value));
                      const alloc = allocations[e.target.value];
                      setTransitionForm({
                        ...transitionForm,
                        empId: e.target.value,
                        employeeName: emp ? emp.name : "",
                        projectName: alloc?.project || "",
                        sowNumber: alloc?.sowNumber || ""
                      });
                    }}
                  >
                    <option value="">-- Choose Allocated Resource --</option>
                    {allocatedList.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.project})</option>
                    ))}
                  </select>
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <label className="form-field">
                    <span>Transition Type</span>
                    <select
                      value={transitionForm.transitionType}
                      onChange={(e) => setTransitionForm({ ...transitionForm, transitionType: e.target.value })}
                    >
                      <option value="Replacement">Replacement & Shadowing</option>
                      <option value="Roll-off">Direct Project Roll-off to Bench</option>
                      <option value="Internal Transfer">Internal Department Transfer</option>
                      <option value="Resignation Backfill">Resignation / Exit Backfill</option>
                    </select>
                  </label>

                  <label className="form-field">
                    <span>Shadowing Replacement Resource</span>
                    <select
                      value={transitionForm.replacementEmpId}
                      onChange={(e) => {
                        const target = employees.find(m => String(m.id) === String(e.target.value));
                        setTransitionForm({
                          ...transitionForm,
                          replacementEmpId: e.target.value,
                          replacementEmpName: target ? target.name : ""
                        });
                      }}
                    >
                      <option value="">-- None / Select from Bench --</option>
                      {benchList.map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.role})</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <label className="form-field">
                    <span>KT Start Date</span>
                    <input
                      type="date"
                      value={transitionForm.ktStartDate}
                      onChange={(e) => setTransitionForm({ ...transitionForm, ktStartDate: e.target.value })}
                    />
                  </label>

                  <label className="form-field">
                    <span>KT End Date</span>
                    <input
                      type="date"
                      value={transitionForm.ktEndDate}
                      onChange={(e) => setTransitionForm({ ...transitionForm, ktEndDate: e.target.value })}
                    />
                  </label>
                </div>

                <label className="form-field">
                  <span>Handover & Knowledge Transfer Notes</span>
                  <textarea
                    rows="3"
                    placeholder="Specify shadowing deliverables, client repo access transfer, and milestone handover..."
                    value={transitionForm.notes}
                    onChange={(e) => setTransitionForm({ ...transitionForm, notes: e.target.value })}
                  />
                </label>
              </div>

              <div className="modal-footer">
                <button type="submit" className="resource-btn primary">Initiate Handover Workflow</button>
                <button type="button" className="resource-btn secondary" onClick={() => setShowTransitionModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </>
  );
}
