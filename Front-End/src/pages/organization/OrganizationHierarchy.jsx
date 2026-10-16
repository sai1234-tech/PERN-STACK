import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import { useAuth } from "../../context/AuthContext";
import { normalizeRole } from "../../utils/auth";
import { getAllEmployees } from "../../services/employeeService";
import { getDepartments } from "../../services/departmentService";
import { formatPhotoUrl } from "../../utils/photo";
import { useSyncRefresh } from "../../utils/syncManager";
import "./OrganizationHierarchy.css";

const DEPARTMENT_COLORS = {
  "Executive Leadership": { bg: "#f1f5f9", text: "#0f172a", border: "#cbd5e1" },
  Engineering: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  "Human Resources": { bg: "#faf5ff", text: "#7e22ce", border: "#e9d5ff" },
  "Product & Design": { bg: "#fffbeb", text: "#b45309", border: "#fde68a" },
  Finance: { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" },
  Operations: { bg: "#f0fdfa", text: "#0f766e", border: "#99f6e4" },
};

const INITIAL_COLLAPSED_NODES = {};

// Accounts excluded from Organization Chart (SystemAdmin, AdminUser, AdminDemo, HRManager, Team Manager, John Manager, HR Admin)
const EXCLUDED_ORG_NAMES = new Set([
  "systemadmin",
  "system admin",
  "adminuser",
  "admin user",
  "admindemo",
  "admin demo",
  "hrmanager",
  "hr manager",
  "teammanager",
  "team manager",
  "johnmanager",
  "john manager",
  "hradmin",
  "hr admin",
]);

const EXCLUDED_ORG_EMAILS = new Set([
  "admin@company.com",
  "admin@example.com",
  "admin@hrms.com",
  "hr@company.com",
  "hr@hrms.com",
  "manager@company.com",
  "manager@hrms.com",
]);

const EXCLUDED_ORG_CODES = new Set([
  "EMP0003",
  "EMP010",
  "EMP011",
  "EMP014",
  "EMP017",
  "EMP018",
  "EMP019",
]);

const isExcludedFromOrgChart = (emp) => {
  if (!emp) return false;
  const fullName = (emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`).trim().toLowerCase();
  const cleanName = fullName.replace(/[^a-z0-9]/g, "");
  if (EXCLUDED_ORG_NAMES.has(fullName) || EXCLUDED_ORG_NAMES.has(cleanName)) return true;

  const email = (emp.email || "").trim().toLowerCase();
  if (EXCLUDED_ORG_EMAILS.has(email)) return true;

  const code = (emp.employeeCode || emp.code || "").trim().toUpperCase();
  if (EXCLUDED_ORG_CODES.has(code)) return true;

  return false;
};

const resolveEmployeeReference = (employeeMap, reference) => {
  const candidates =
    reference && typeof reference === "object"
      ? [reference.id, reference._id, reference.employeeCode, reference.email]
      : [reference];

  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined || candidate === "") continue;
    const key = String(candidate);
    const employee =
      employeeMap[key] ||
      employeeMap[key.toUpperCase()] ||
      employeeMap[key.toLowerCase()];
    if (employee) return employee;
  }
  return null;
};

function OrganizationHierarchy() {
  const { user, employee } = useAuth();
  const currentRole = normalizeRole(user, employee);

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("tree"); // "tree" | "pods" | "table"
  const [collapsedNodes, setCollapsedNodes] = useState(INITIAL_COLLAPSED_NODES);
  const [inspectedEmp, setInspectedEmp] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [loading, setLoading] = useState(true);

  // Load database employees to augment the organizational tree
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [empRes, deptRes] = await Promise.all([
        getAllEmployees().catch(() => ({ data: [] })),
        getDepartments().catch(() => ({ data: [] })),
      ]);

      const apiEmpList = empRes.data || empRes.employees || [];
      const deptList = deptRes.data || deptRes.departments || [];

      if (Array.isArray(deptList) && deptList.length > 0) {
        setDepartments(deptList);
      }

      if (Array.isArray(apiEmpList) && apiEmpList.length > 0) {
        const merged = [];
        apiEmpList.forEach((apiEmp) => {
          if (isExcludedFromOrgChart(apiEmp)) return;
          const code = apiEmp.employeeCode || `QSI-${apiEmp._id?.slice(-4)}`;
          const deptName = apiEmp.employment?.department || apiEmp.department || "Engineering";

          const formatted = {
            id: apiEmp.id ?? apiEmp._id,
            employeeCode: code,
            name: apiEmp.name || `${apiEmp.firstName || ""} ${apiEmp.lastName || ""}`.trim() || "Team Member",
            firstName: apiEmp.firstName || apiEmp.name || "Team",
            lastName: apiEmp.lastName || "Member",
            designation: apiEmp.employment?.designation || apiEmp.designation || "Staff Specialist",
            department: deptName,
            reportsTo: apiEmp.reportsTo || null, // No fallback fake manager IDs
            email: apiEmp.email || `${code.toLowerCase()}@quadratics.com`,
            phone: apiEmp.phone || "+91 98201 00000",
            status: apiEmp.employment?.status || "Active",
            location: "Corporate Office",
            employmentType: apiEmp.employment?.employmentType || "Full Time",
            profilePhoto: apiEmp.profilePhoto || apiEmp.profile_photo || "",
            avatarBg: "linear-gradient(135deg, #2563eb, #3b82f6)",
            experience: "2 yrs",
          };

          merged.push(formatted);
        });
        setEmployees(merged);
      }
    } catch (err) {
      console.error("Org chart data fetch fallback:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useSyncRefresh(loadData, { interval: 4000, silent: true });

  // Map employee lookups and parent-child tree mapping
  const { employeeMap, childrenMap, rootEmployees, departmentList } = useMemo(() => {
    const map = {};
    const cMap = {};
    const depts = new Set(["All"]);

    // 1. Initialize lookup maps
    employees.forEach((emp) => {
      const empIdStr = String(emp.id);
      map[empIdStr] = emp;
      if (emp.employeeCode) map[String(emp.employeeCode).toUpperCase()] = emp;
      if (emp.email) map[String(emp.email).toLowerCase()] = emp;

      cMap[empIdStr] = [];
      if (emp.department) depts.add(emp.department);
    });

    // Preserve every top-level reporting branch rather than hiding employees
    // whose manager is not connected to the designated CEO record.
    const designatedRoot = employees.find(
      (emp) => emp.employeeCode === "EMP001" || (emp.email && emp.email.toLowerCase() === "ceo@quadratics.com")
    );

    // Build parent-child relationships from database IDs, employee codes, or emails.
    employees.forEach((emp) => {
      const parentEmp = resolveEmployeeReference(map, emp.reportsTo);
      if (!parentEmp || String(parentEmp.id) === String(emp.id)) return;

      if (parentEmp && cMap[String(parentEmp.id)]) {
        if (!cMap[String(parentEmp.id)].some((c) => String(c.id) === String(emp.id))) {
          cMap[String(parentEmp.id)].push(emp);
        }
      }
    });

    const rootEmployees = employees.filter((emp) => {
      const parent = resolveEmployeeReference(map, emp.reportsTo);
      return !parent || String(parent.id) === String(emp.id);
    });
    if (designatedRoot) {
      rootEmployees.sort((a, b) => (a.id === designatedRoot.id ? -1 : b.id === designatedRoot.id ? 1 : 0));
    }

    return {
      employeeMap: map,
      childrenMap: cMap,
      rootEmployees,
      departmentList: Array.from(depts),
    };
  }, [employees]);

  // Determine current logged in employee's profile in the organization
  const myEmployeeRecord = useMemo(() => {
    if (!user) return null;
    const userEmail = (user.email || "").toLowerCase();
    const userCode = (employee?.employeeCode || user.employeeCode || "").toUpperCase();
    const userName = (user.name || `${user.firstName || ""} ${user.lastName || ""}`).trim().toLowerCase();

    // 1. Try finding by email, code, or name
    let found = employees.find(
      (e) =>
        (userEmail && e.email?.toLowerCase() === userEmail) ||
        (userCode && e.employeeCode?.toUpperCase() === userCode) ||
        (userName && e.name?.toLowerCase() === userName)
    );

    // 2. If not already found, synthesize a generic fallback for the UI
    if (!found) {
      const userDept = employee?.department || user?.department || (currentRole === "hr" ? "Human Resources" : "Engineering");

      found = {
        id: "emp-current-user",
        employeeCode: userCode || "QSI-701",
        name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "You",
        firstName: user.firstName || "You",
        lastName: user.lastName || "",
        designation: employee?.designation || user?.designation || (currentRole === "hr" ? "HR Specialist" : currentRole === "admin" ? "Systems Administrator" : "Senior Software Engineer"),
        department: userDept,
        reportsTo: null,
        email: user.email || "current.user@quadratics.com",
        phone: user.phone || "+91 98201 55432",
        profilePhoto: employee?.profilePhoto || user.profilePhoto || "",
        status: "Active",
        location: "Corporate Office",
        employmentType: "Full Time",
        avatarBg: "linear-gradient(135deg, #2563eb, #3b82f6)",
        experience: "2.5 yrs",
        isCurrentUser: true,
      };
    }
    return found;
  }, [user, employee, employees, currentRole]);

  // Determine who the current user reports to
  const myManager = useMemo(() => {
    if (!myEmployeeRecord || !myEmployeeRecord.reportsTo) return null;
    return resolveEmployeeReference(employeeMap, myEmployeeRecord.reportsTo);
  }, [myEmployeeRecord, employeeMap]);

  // Colleagues / peers who report to the same manager
  const myColleagues = useMemo(() => {
    if (!myEmployeeRecord || !myEmployeeRecord.reportsTo) return [];
    const manager = resolveEmployeeReference(employeeMap, myEmployeeRecord.reportsTo);
    if (!manager) return [];
    const peers = (childrenMap[manager.id] || []).filter(
      (p) => p.id !== myEmployeeRecord.id && p.email?.toLowerCase() !== user?.email?.toLowerCase()
    );
    return peers;
  }, [myEmployeeRecord, childrenMap, employeeMap, user]);

  // Direct reports who report directly to the current user (if user is a manager/lead)
  const myDirectReports = useMemo(() => {
    if (!myEmployeeRecord) return [];
    return childrenMap[myEmployeeRecord.id] || [];
  }, [myEmployeeRecord, childrenMap]);

  // Toggle collapsing of children
  const toggleCollapse = (empId, e) => {
    if (e) e.stopPropagation();
    setCollapsedNodes((prev) => ({
      ...prev,
      [empId]: !prev[empId],
    }));
  };

  const showTop7Records = () => setCollapsedNodes(INITIAL_COLLAPSED_NODES);
  const expandAll = () => setCollapsedNodes({});
  const collapseAll = () => {
    const collapsed = {};
    employees.forEach((emp) => {
      if (childrenMap[emp.id]?.length > 0) {
        collapsed[emp.id] = true;
      }
    });
    setCollapsedNodes(collapsed);
  };

  // Locate the current user in the tree
  const handleLocateMe = () => {
    if (!myEmployeeRecord) return;
    expandAll();
    setViewMode("tree");
    setSearchQuery(myEmployeeRecord.name);

    setTimeout(() => {
      const el = document.getElementById(`node-${myEmployeeRecord.id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }
    }, 200);
  };

  // Search match filter
  const isMatch = (emp) => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase();
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.employeeCode.toLowerCase().includes(q) ||
      emp.designation.toLowerCase().includes(q) ||
      emp.department.toLowerCase().includes(q)
    );
  };

  // Filtered employees for reporting matrix table
  const tableFilteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return employees
      .filter((e) => selectedDept === "All" || e.department === selectedDept)
      .filter((e) => {
        if (!q) return true;
        return (
          e.name.toLowerCase().includes(q) ||
          e.employeeCode.toLowerCase().includes(q) ||
          e.designation.toLowerCase().includes(q) ||
          e.department.toLowerCase().includes(q)
        );
      });
  }, [employees, selectedDept, searchQuery]);

  // Filter tree nodes when department is selected
  const shouldDisplayNode = (emp) => {
    if (selectedDept === "All") return true;
    if (emp.department === selectedDept) return true;
    const directChildren = childrenMap[emp.id] || [];
    return directChildren.some(shouldDisplayNode);
  };

  // Recursive Flow Chart Tree Node Component
  const renderTreeNode = (emp, level = 0) => {
    if (!emp) return null;
    if (!shouldDisplayNode(emp)) return null;

    const children = (childrenMap[emp.id] || []).filter(shouldDisplayNode);
    const hasChildren = children.length > 0;
    const isCollapsed = !!collapsedNodes[emp.id];
    const highlighted = isMatch(emp);
    const isCurrentUser =
      emp.id === myEmployeeRecord?.id ||
      (user?.email && emp.email?.toLowerCase() === user.email?.toLowerCase());

    const deptStyle = DEPARTMENT_COLORS[emp.department] || {
      bg: "#f8fafc",
      text: "#334155",
      border: "#e2e8f0",
    };

    const initials = emp.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");

    return (
      <div className={`org-tree-branch level-${level}`} key={emp.id}>
        {/* Visual Node Card */}
        <div
          id={`node-${emp.id}`}
          className={`org-node-card ${highlighted ? "is-highlighted" : ""} ${
            level === 0 ? "is-root-leader" : ""
          } ${isCurrentUser ? "is-current-user" : ""}`}
          onClick={() => setInspectedEmp(emp)}
          title={`Click to view ${emp.name}'s reporting dossier`}
          role="button"
          tabIndex={0}
        >
          {isCurrentUser && (
            <div className="node-you-pill-ribbon">
              <span>⭐ YOU</span>
            </div>
          )}

          {/* Card Top Banner with Status Indicator */}
          <div className="node-card-top">
            <div className="node-avatar" style={{ background: emp.avatarBg || "#1e3a8a" }}>
              {emp.profilePhoto && (
                <img
                  className="org-profile-photo"
                  src={formatPhotoUrl(emp.profilePhoto)}
                  alt=""
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                    if (event.currentTarget.nextElementSibling) {
                      event.currentTarget.nextElementSibling.style.display = "flex";
                    }
                  }}
                />
              )}
              <span style={{ display: emp.profilePhoto ? "none" : "flex" }}>{initials}</span>
              <span className="node-online-dot" title="Active in Organization" />
            </div>

            <div className="node-meta-wrap">
              <span className="node-code">{emp.employeeCode}</span>
              <span
                className="node-dept-tag"
                style={{
                  backgroundColor: deptStyle.bg,
                  color: deptStyle.text,
                  borderColor: deptStyle.border,
                }}
              >
                {emp.department}
              </span>
            </div>
          </div>

          {/* Employee Names & Designation */}
          <div className="node-info">
            <h4 className="node-name">{emp.name}</h4>
            <p className="node-designation">{emp.designation}</p>
          </div>

          {/* Node Footer: Direct Reports Count & Quick Actions */}
          <div className="node-card-footer">
            <div className="reports-counter-pill">
              <span className="reports-icon">👥</span>
              <span>
                {children.length} {children.length === 1 ? "Direct Report" : "Direct Reports"}
              </span>
            </div>

            {hasChildren && (
              <button
                type="button"
                className={`collapse-toggle-btn ${isCollapsed ? "is-collapsed" : ""}`}
                onClick={(e) => toggleCollapse(emp.id, e)}
                title={isCollapsed ? "Expand direct reports" : "Collapse direct reports"}
                aria-label="Toggle subordinate branch"
              >
                {isCollapsed ? `+ ${children.length}` : "−"}
              </button>
            )}
          </div>
        </div>

        {/* Child Subtree with Flow Connectors */}
        {hasChildren && !isCollapsed && (
          <div className="org-children-container">
            {/* Horizontal Bus Line connecting all sibling branches */}
            <div className="org-connector-bus" />

            <div className="org-children-row">
              {children.map((child) => (
                <div className="org-child-column" key={child.id}>
                  {/* Vertical drop line down into child */}
                  <div className="org-connector-vertical-down" />
                  {renderTreeNode(child, level + 1)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="org-hierarchy-page">
      <EmployeeHeader />

      <main className="org-hierarchy-container">
        {/* Page Hero Header */}
        <div className="org-page-header">
          <div className="header-breadcrumbs">
            <Link to="/employee/dashboard">Workspace</Link>
            <span className="breadcrumb-separator">/</span>
            <span>Organization Hierarchy</span>
          </div>

          <div className="header-title-flex">
            <div>
              <div className="company-badge-row">
                <span className="company-tag">Quadratic Systems Inc</span>
                <span className="total-headcount-pill">
                  👥 {employees.length} Total Workforce Members
                </span>
              </div>
              <h1 className="page-heading">Organization Hierarchy & Reporting Tree</h1>
              <p className="page-subheading">
                Visual flow chart depicting corporate reporting lines, leadership tiers, and department structures.
              </p>
            </div>

            {/* View Mode Switcher */}
            <div className="view-mode-tabs">
              <button
                type="button"
                className={`mode-tab-btn ${viewMode === "tree" ? "active" : ""}`}
                onClick={() => setViewMode("tree")}
                title="Interactive Flow Chart Tree"
              >
                <span>🌳 Tree Flow Chart</span>
              </button>
              <button
                type="button"
                className={`mode-tab-btn ${viewMode === "team" ? "active" : ""}`}
                onClick={() => setViewMode("team")}
                title="View Your Team & Reporting Colleagues"
              >
                <span>👥 My Team & Colleagues ({myColleagues.length + 1})</span>
              </button>
              <button
                type="button"
                className={`mode-tab-btn ${viewMode === "pods" ? "active" : ""}`}
                onClick={() => setViewMode("pods")}
                title="Department Squads & Pods"
              >
                <span>🏢 Department Squads</span>
              </button>
              <button
                type="button"
                className={`mode-tab-btn ${viewMode === "table" ? "active" : ""}`}
                onClick={() => setViewMode("table")}
                title="Reporting Table Directory"
              >
                <span>📋 Reporting Matrix</span>
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================
            PROMINENT PERSONAL REPORTING RELATIONSHIP HERO BANNER
        ============================================================ */}
        {myEmployeeRecord && (
          <div className="my-reporting-relationship-banner">
            <div className="relationship-hero-left">
              <div className="user-profile-summary">
                <div className="user-avatar-tag">
                  {myEmployeeRecord.profilePhoto && (
                    <img
                      className="org-profile-photo"
                      src={formatPhotoUrl(myEmployeeRecord.profilePhoto)}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                        if (event.currentTarget.nextElementSibling) {
                          event.currentTarget.nextElementSibling.style.display = "flex";
                        }
                      }}
                    />
                  )}
                  <span
                    className="avatar-letter"
                    style={{ display: myEmployeeRecord.profilePhoto ? "none" : "flex" }}
                  >
                    {myEmployeeRecord.name[0]}
                  </span>
                  <span className="user-badge-chip">YOU</span>
                </div>
                <div className="user-text-meta">
                  <h3>{myEmployeeRecord.name}</h3>
                  <div className="user-meta-sub">
                    <span className="badge-code">{myEmployeeRecord.employeeCode}</span>
                    <span className="badge-title">{myEmployeeRecord.designation}</span>
                    <span className="badge-dept">{myEmployeeRecord.department}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Flow Indicator Arrow */}
            <div className="reporting-flow-arrow">
              <div className="flow-direction-pill">
                <span className="arrow-icon">⬆️</span>
                <span className="flow-text">Reports To</span>
              </div>
              <div className="animated-flow-line">
                <span className="flow-pulse-dot" />
              </div>
            </div>

            {/* Reporting Manager Card */}
            <div className="relationship-hero-right">
              {myManager ? (
                <div
                  className="manager-hero-card"
                  onClick={() => setInspectedEmp(myManager)}
                  title="Click to view Manager's full reporting dossier"
                >
                  <div
                    className="manager-avatar-hero"
                    style={{ background: myManager.avatarBg || "#1e3a8a" }}
                  >
                    {myManager.profilePhoto && (
                      <img
                        className="org-profile-photo"
                        src={formatPhotoUrl(myManager.profilePhoto)}
                        alt=""
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                          if (event.currentTarget.nextElementSibling) {
                            event.currentTarget.nextElementSibling.style.display = "flex";
                          }
                        }}
                      />
                    )}
                    <span style={{ display: myManager.profilePhoto ? "none" : "flex" }}>
                      {myManager.name[0]}
                    </span>
                  </div>
                  <div className="manager-details">
                    <h4 className="manager-name-display">{myManager.name}</h4>
                    <p className="manager-desig-display">{myManager.designation || "Manager"}</p>
                    <div className="manager-micro-badges">
                      <span className="location-pill">📍 {myManager.location || "Location Not Specified"}</span>
                      <span className="dept-pill">{myManager.department || "Department Not Set"}</span>
                    </div>
                  </div>
                  <div className="manager-actions-row">
                    <button
                      type="button"
                      className="manager-action-chip"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectedEmp(myManager);
                      }}
                    >
                      Dossier
                    </button>
                    {myManager.email && (
                      <a
                        href={`mailto:${myManager.email}`}
                        className="manager-action-chip email"
                        onClick={(e) => e.stopPropagation()}
                        title={`Send email to ${myManager.name}`}
                      >
                        ✉️ Email
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="manager-hero-card executive-board">
                  <div className="manager-avatar-hero board">👤</div>
                  <div className="manager-details">
                    <h4 className="manager-name-display">No Direct Manager Assigned</h4>
                    <p className="manager-desig-display">Click below to assign or edit manager details</p>
                    <div className="manager-micro-badges" style={{ marginTop: "6px" }}>
                      <Link to="/hr/employees" className="dept-pill" style={{ background: "#2563eb", color: "#fff", textDecoration: "none" }}>
                        ✏️ Edit / Assign Manager
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              <div className="hero-btn-cluster">
                <button
                  type="button"
                  className="locate-me-btn"
                  onClick={handleLocateMe}
                  title="Spotlight and scroll to your position in the hierarchy tree"
                >
                  <span>📍 Locate Me</span>
                </button>
                <button
                  type="button"
                  className="team-squad-btn"
                  onClick={() => setViewMode("team")}
                  title="View all peers and colleagues reporting to your manager"
                >
                  <span>👥 My Team ({myColleagues.length})</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toolbar & Filter Bar */}
        <div className="org-toolbar-card">
          {/* Search Box */}
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by name, employee code (QSI-001), designation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="hierarchy-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery("")}
              >
                ✕
              </button>
            )}
          </div>

          {/* Department Quick Filter */}
          <div className="dept-filter-cluster">
            <span className="filter-label">Filter Department:</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="dept-select-dropdown"
            >
              {departmentList.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === "All" ? "All Departments (Whole Organization)" : dept}
                </option>
              ))}
            </select>
          </div>

          {/* Zoom & Expansion Controls (for Flow Chart) */}
          {viewMode === "tree" && (
            <div className="zoom-controls-cluster">
              <button
                type="button"
                className="zoom-btn"
                onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.1))}
                title="Zoom Out"
              >
                −
              </button>
              <span className="zoom-percent">{Math.round(zoomLevel * 100)}%</span>
              <button
                type="button"
                className="zoom-btn"
                onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
                title="Zoom In"
              >
                +
              </button>
              <button
                type="button"
                className="action-pill-btn"
                onClick={() => setZoomLevel(1)}
                title="Reset Scale"
              >
                Reset
              </button>
              <div className="v-divider" />
              <button
                type="button"
                className="action-pill-btn highlight"
                onClick={showTop7Records}
                title="Show Top 7 Leadership Records"
              >
                Top 7 Records
              </button>
              <button
                type="button"
                className="action-pill-btn"
                onClick={expandAll}
                title="Expand All Branches"
              >
                Expand All
              </button>
              <button
                type="button"
                className="action-pill-btn"
                onClick={collapseAll}
                title="Collapse to Leadership"
              >
                Collapse All
              </button>
            </div>
          )}
        </div>

        {/* ============================================================
            VIEW 1: INTERACTIVE FLOW CHART TREE
        ============================================================ */}
        {viewMode === "tree" && (
          <div className="org-canvas-viewport">
            <div className="org-canvas-status-bar">
              <span className="canvas-status-tag">
                🌳 Showing 7 records in view &bull; Scroll canvas or expand branches to explore all {employees.length} workforce members
              </span>
            </div>
            {loading ? (
              <div className="org-loading-state">
                <div className="loading-spinner" />
                <p>Constructing organization tree flow chart...</p>
              </div>
            ) : (
              <div
                className="org-tree-wrapper"
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: "top center" }}
              >
                {rootEmployees.length > 0 ? (
                  rootEmployees.map((rootEmployee) => renderTreeNode(rootEmployee, 0))
                ) : (
                  <div className="empty-org-state">
                    <p>No organizational records available to plot.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================================================
            VIEW: MY TEAM & PEERS SQUAD (REPORTING TO SAME MANAGER)
        ============================================================ */}
        {viewMode === "team" && (
          <div className="org-team-view-container">
            {/* Squad Intro Header */}
            <div className="team-squad-hero">
              <div className="squad-hero-info">
                <div className="squad-badge-row">
                  <span className="squad-dept-pill">
                    {myEmployeeRecord ? myEmployeeRecord.department : "Engineering"} Team Squad
                  </span>
                  <span className="squad-members-pill">
                    👥 {myColleagues.length + 1} Squad Members
                  </span>
                </div>
                <h2>Your Workplace Team & Colleague Network</h2>
                <p>
                  Colleagues and teammates working under the leadership of{" "}
                  <strong>{myManager ? myManager.name : "the Leadership Board"}</strong>.
                </p>
              </div>

              {myColleagues.length > 0 && (
                <div className="squad-hero-actions">
                  <a
                    href={`mailto:${[
                      myManager?.email,
                      myEmployeeRecord?.email,
                      ...myColleagues.map((c) => c.email),
                    ]
                      .filter(Boolean)
                      .join(",")}`}
                    className="squad-email-all-btn"
                  >
                    ✉️ Email Entire Squad
                  </a>
                </div>
              )}
            </div>

            {/* Visual Team Hierarchy Pod */}
            <div className="team-visual-pod">
              {/* Central Reporting Manager Card at Top */}
              <div className="team-manager-tier">
                <span className="tier-label">REPORTING MANAGER & SQUAD LEAD</span>
                {myManager ? (
                  <div
                    className="team-manager-card"
                    onClick={() => setInspectedEmp(myManager)}
                    title={`Click to view ${myManager.name}'s dossier`}
                  >
                    <div
                      className="manager-card-avatar"
                      style={{ background: myManager.avatarBg || "#1e3a8a" }}
                    >
                      {myManager.profilePhoto && (
                        <img
                          className="org-profile-photo"
                          src={formatPhotoUrl(myManager.profilePhoto)}
                          alt=""
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                            if (event.currentTarget.nextElementSibling) {
                              event.currentTarget.nextElementSibling.style.display = "flex";
                            }
                          }}
                        />
                      )}
                      <span style={{ display: myManager.profilePhoto ? "none" : "flex" }}>
                        {myManager.name[0]}
                      </span>
                    </div>
                    <div className="manager-card-text">
                      <span className="lead-badge">👑 Team Lead</span>
                      <h3>{myManager.name}</h3>
                      <p className="manager-title">{myManager.designation}</p>
                      <div className="manager-sub-meta">
                        <span className="meta-item">📍 {myManager.location || "Floor 5, Pod 14"}</span>
                        <span className="meta-item">🆔 {myManager.employeeCode}</span>
                        <span className="meta-item">✉️ {myManager.email}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="inspect-card-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectedEmp(myManager);
                      }}
                    >
                      View Dossier
                    </button>
                  </div>
                ) : (
                  <div className="team-manager-card board">
                    <div className="manager-card-avatar board">🌟</div>
                    <div className="manager-card-text">
                      <h3>Executive Directorate & Corporate Board</h3>
                      <p className="manager-title">Direct Reporting to Board of Directors</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Connector stem branching down to team members */}
              <div className="team-connector-branch">
                <div className="team-stem-down" />
                <div className="team-branch-bus" />
              </div>

              {/* Team Members Cluster (You + Peers) */}
              <div className="team-colleagues-section">
                <div className="team-colleagues-header">
                  <h3>
                    Squad Members ({myColleagues.length + 1}) • Reporting to {myManager ? myManager.name : "Manager"}
                  </h3>
                  <span className="same-manager-note">
                    All members below share the same direct reporting line
                  </span>
                </div>

                <div className="team-colleagues-grid">
                  {/* YOUR CARD */}
                  {myEmployeeRecord && (
                    <div
                      className="team-member-card is-you"
                      onClick={() => setInspectedEmp(myEmployeeRecord)}
                    >
                      <div className="card-you-ribbon">⭐ YOU</div>
                      <div className="member-card-top">
                        <div
                          className="member-avatar-box"
                          style={{ background: myEmployeeRecord.avatarBg || "#2563eb" }}
                        >
                          {myEmployeeRecord.profilePhoto && (
                            <img
                              className="org-profile-photo"
                              src={formatPhotoUrl(myEmployeeRecord.profilePhoto)}
                              alt=""
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                                if (event.currentTarget.nextElementSibling) {
                                  event.currentTarget.nextElementSibling.style.display = "flex";
                                }
                              }}
                            />
                          )}
                          <span style={{ display: myEmployeeRecord.profilePhoto ? "none" : "flex" }}>
                            {myEmployeeRecord.name[0]}
                          </span>
                          <span className="member-status-dot" />
                        </div>
                        <div className="member-meta-column">
                          <span className="member-code-badge">{myEmployeeRecord.employeeCode}</span>
                          <span className="member-dept-badge">{myEmployeeRecord.department}</span>
                        </div>
                      </div>

                      <div className="member-card-body">
                        <h4>{myEmployeeRecord.name}</h4>
                        <p className="member-designation-title">{myEmployeeRecord.designation}</p>
                        <div className="member-details-cluster">
                          <span>📍 {myEmployeeRecord.location || "Floor 5, Pod 14"}</span>
                          <span>✉️ {myEmployeeRecord.email}</span>
                          <span>📞 {myEmployeeRecord.phone}</span>
                        </div>
                      </div>

                      <div className="member-card-footer">
                        <span className="relationship-tag">Your Profile</span>
                        <button
                          type="button"
                          className="card-action-btn primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectedEmp(myEmployeeRecord);
                          }}
                        >
                          Your Dossier
                        </button>
                      </div>
                    </div>
                  )}

                  {/* COLLEAGUES CARDS */}
                  {myColleagues.map((colleague) => (
                    <div
                      className="team-member-card"
                      key={colleague.id}
                      onClick={() => setInspectedEmp(colleague)}
                    >
                      <div className="member-card-top">
                        <div
                          className="member-avatar-box"
                          style={{ background: colleague.avatarBg || "#1e3a8a" }}
                        >
                          {colleague.name[0]}
                          <span className="member-status-dot" />
                        </div>
                        <div className="member-meta-column">
                          <span className="member-code-badge">{colleague.employeeCode}</span>
                          <span className="member-dept-badge">{colleague.department}</span>
                        </div>
                      </div>

                      <div className="member-card-body">
                        <h4>{colleague.name}</h4>
                        <p className="member-designation-title">{colleague.designation}</p>
                        <div className="member-details-cluster">
                          <span>📍 {colleague.location || "Floor 5, Pod 14"}</span>
                          <span>✉️ {colleague.email}</span>
                          <span>📞 {colleague.phone}</span>
                        </div>
                      </div>

                      <div className="member-card-footer">
                        <span className="relationship-tag peer">Colleague / Peer</span>
                        <div className="card-buttons-pair">
                          <a
                            href={`mailto:${colleague.email}`}
                            className="card-action-btn email"
                            onClick={(e) => e.stopPropagation()}
                            title={`Email ${colleague.name}`}
                          >
                            ✉️
                          </a>
                          <button
                            type="button"
                            className="card-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectedEmp(colleague);
                            }}
                          >
                            Dossier
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Direct Subordinates Section (if user has reports) */}
              {myDirectReports.length > 0 && (
                <div className="team-subordinates-tier">
                  <div className="subordinates-tier-header">
                    <h3>Subordinates Reporting Directly To You ({myDirectReports.length})</h3>
                    <p>Team members who consider you their primary reporting manager</p>
                  </div>
                  <div className="team-colleagues-grid">
                    {myDirectReports.map((sub) => (
                      <div
                        className="team-member-card subordinate"
                        key={sub.id}
                        onClick={() => setInspectedEmp(sub)}
                      >
                        <div className="member-card-top">
                          <div
                            className="member-avatar-box"
                            style={{ background: sub.avatarBg || "#0284c7" }}
                          >
                            {sub.profilePhoto && (
                              <img
                                className="org-profile-photo"
                                src={formatPhotoUrl(sub.profilePhoto)}
                                alt=""
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";
                                  if (event.currentTarget.nextElementSibling) {
                                    event.currentTarget.nextElementSibling.style.display = "flex";
                                  }
                                }}
                              />
                            )}
                            <span style={{ display: sub.profilePhoto ? "none" : "flex" }}>
                              {sub.name[0]}
                            </span>
                            <span className="member-status-dot" />
                          </div>
                          <div className="member-meta-column">
                            <span className="member-code-badge">{sub.employeeCode}</span>
                            <span className="member-dept-badge">{sub.department}</span>
                          </div>
                        </div>

                        <div className="member-card-body">
                          <h4>{sub.name}</h4>
                          <p className="member-designation-title">{sub.designation}</p>
                          <div className="member-details-cluster">
                            <span>📍 {sub.location || "Floor 5, Pod 14"}</span>
                            <span>✉️ {sub.email}</span>
                          </div>
                        </div>

                        <div className="member-card-footer">
                          <span className="relationship-tag sub">Your Direct Report</span>
                          <button
                            type="button"
                            className="card-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectedEmp(sub);
                            }}
                          >
                            Dossier
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================
            VIEW 2: DEPARTMENT SQUADS & PODS
        ============================================================ */}
        {viewMode === "pods" && (
          <div className="org-pods-grid">
            {departmentList
              .filter((d) => d !== "All")
              .filter((d) => selectedDept === "All" || selectedDept === d)
              .map((dept) => {
                const members = employees.filter((e) => e.department === dept);
                const deptColor = DEPARTMENT_COLORS[dept] || {
                  bg: "#f8fafc",
                  text: "#0f172a",
                  border: "#cbd5e1",
                };

                return (
                  <div className="dept-pod-card" key={dept}>
                    <div className="dept-pod-header" style={{ borderTopColor: deptColor.text }}>
                      <div className="dept-pod-titles">
                        <span
                          className="dept-pod-chip"
                          style={{
                            backgroundColor: deptColor.bg,
                            color: deptColor.text,
                            borderColor: deptColor.border,
                          }}
                        >
                          {dept}
                        </span>
                        <h3>{dept} Team</h3>
                      </div>
                      <span className="member-count-badge">{members.length} Members</span>
                    </div>

                    <div className="dept-members-list">
                      {members.map((member) => {
                        const manager = resolveEmployeeReference(employeeMap, member.reportsTo);
                        return (
                          <div
                            className="pod-member-row"
                            key={member.id}
                            onClick={() => setInspectedEmp(member)}
                          >
                            <div
                              className="member-avatar-sm"
                              style={{ background: member.avatarBg || "#1e3a8a" }}
                            >
                              {member.profilePhoto && (
                                <img
                                  className="org-profile-photo"
                                  src={formatPhotoUrl(member.profilePhoto)}
                                  alt=""
                                  onError={(event) => {
                                    event.currentTarget.style.display = "none";
                                    if (event.currentTarget.nextElementSibling) {
                                      event.currentTarget.nextElementSibling.style.display = "flex";
                                    }
                                  }}
                                />
                              )}
                              <span style={{ display: member.profilePhoto ? "none" : "flex" }}>
                                {member.name[0]}
                              </span>
                            </div>
                            <div className="member-row-info">
                              <strong>{member.name}</strong>
                              <span>{member.designation}</span>
                              <small className="member-code-tag">{member.employeeCode}</small>
                            </div>
                            <div className="member-reports-to">
                              <span className="reports-label">Reports to:</span>
                              <strong>{manager ? manager.name : "Executive Board"}</strong>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* ============================================================
            VIEW 3: REPORTING MATRIX TABLE
        ============================================================ */}
        {viewMode === "table" && (
          <div className="org-table-panel">
            <div className="table-responsive-wrapper">
              <table className="org-matrix-table">
                <thead>
                  <tr>
                    <th>Employee Code</th>
                    <th>Full Name</th>
                    <th>Designation</th>
                    <th>Department</th>
                    <th>Reporting Manager</th>
                    <th>Direct Reports</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tableFilteredEmployees.map((emp) => {
                    const manager = resolveEmployeeReference(employeeMap, emp.reportsTo);
                    const directCount = (childrenMap[emp.id] || []).length;
                    const deptStyle = DEPARTMENT_COLORS[emp.department] || {
                      bg: "#f8fafc",
                      text: "#334155",
                    };

                    return (
                      <tr key={emp.id} className={isMatch(emp) ? "highlight-row" : ""}>
                        <td>
                          <span className="code-pill">{emp.employeeCode}</span>
                        </td>
                        <td>
                          <div className="table-user-cell">
                            <div
                              className="user-initials-chip"
                              style={{ background: emp.avatarBg || "#1e3a8a" }}
                            >
                              {emp.profilePhoto && (
                                <img
                                  className="org-profile-photo"
                                  src={formatPhotoUrl(emp.profilePhoto)}
                                  alt=""
                                  onError={(event) => {
                                    event.currentTarget.style.display = "none";
                                    if (event.currentTarget.nextElementSibling) {
                                      event.currentTarget.nextElementSibling.style.display = "flex";
                                    }
                                  }}
                                />
                              )}
                              <span style={{ display: emp.profilePhoto ? "none" : "flex" }}>
                                {emp.name[0]}
                              </span>
                            </div>
                            <strong>{emp.name}</strong>
                          </div>
                        </td>
                        <td>{emp.designation}</td>
                        <td>
                          <span
                            className="dept-table-tag"
                            style={{
                              backgroundColor: deptStyle.bg,
                              color: deptStyle.text,
                            }}
                          >
                            {emp.department}
                          </span>
                        </td>
                        <td>
                          {manager ? (
                            <div className="manager-cell">
                              <span className="manager-name">{manager.name}</span>
                              <small className="manager-desig">{manager.designation}</small>
                            </div>
                          ) : (
                            <span className="board-leader-tag">🌟 Executive Board</span>
                          )}
                        </td>
                        <td>
                          <span className="direct-reports-count">
                            {directCount > 0 ? `👥 ${directCount} members` : "—"}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="view-dossier-btn"
                            onClick={() => setInspectedEmp(emp)}
                          >
                            View Dossier
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-records-footer">
              <span className="footer-record-text">
                Showing <strong>7 records</strong> visible &bull; Scroll to explore all {tableFilteredEmployees.length} workforce records
              </span>
              <span className="scroll-indicator-pill">↕ Scrollable Directory</span>
            </div>
          </div>
        )}

        {/* ============================================================
            EMPLOYEE DOSSIER SLIDE-OVER MODAL
        ============================================================ */}
        {inspectedEmp && (
          <div className="org-dossier-overlay" onClick={() => setInspectedEmp(null)}>
            <div
              className="org-dossier-drawer"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="dossier-header-band">
                <button
                  type="button"
                  className="dossier-close-btn"
                  onClick={() => setInspectedEmp(null)}
                  aria-label="Close dossier"
                >
                  ✕
                </button>
                <div
                  className="dossier-avatar-hero"
                  style={{ background: inspectedEmp.avatarBg || "#1e3a8a" }}
                >
                  <span>
                    {inspectedEmp.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")}
                  </span>
                </div>
                <h3>{inspectedEmp.name}</h3>
                <p className="dossier-desig">{inspectedEmp.designation}</p>
                <div className="dossier-tags-row">
                  <span className="dossier-code-tag">{inspectedEmp.employeeCode}</span>
                  <span className="dossier-status-tag">🟢 {inspectedEmp.status}</span>
                  <span className="dossier-type-tag">{inspectedEmp.employmentType}</span>
                </div>
              </div>

              <div className="dossier-body-content">
                {/* Reporting Chain Section */}
                <div className="dossier-section">
                  <h4 className="section-kicker">REPORTING RELATIONSHIPS</h4>
                  <div className="reporting-chain-card">
                    <div className="chain-item">
                      <span className="chain-label">Direct Reporting Manager:</span>
                      {resolveEmployeeReference(employeeMap, inspectedEmp.reportsTo) ? (
                        <div
                          className="manager-click-box"
                          onClick={() =>
                            setInspectedEmp(resolveEmployeeReference(employeeMap, inspectedEmp.reportsTo))
                          }
                        >
                          <div className="manager-avatar-mini">
                            {resolveEmployeeReference(employeeMap, inspectedEmp.reportsTo).name[0]}
                          </div>
                          <div>
                            <strong>{resolveEmployeeReference(employeeMap, inspectedEmp.reportsTo).name}</strong>
                            <p>{resolveEmployeeReference(employeeMap, inspectedEmp.reportsTo).designation}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="board-badge">Reports directly to Executive Board</span>
                      )}
                    </div>

                    <div className="chain-item">
                      <span className="chain-label">
                        Direct Subordinates ({childrenMap[inspectedEmp.id]?.length || 0}):
                      </span>
                      {(childrenMap[inspectedEmp.id] || []).length > 0 ? (
                        <div className="subordinates-chips-cluster">
                          {childrenMap[inspectedEmp.id].map((sub) => (
                            <button
                              key={sub.id}
                              type="button"
                              className="subordinate-chip"
                              onClick={() => setInspectedEmp(sub)}
                              title={`View ${sub.name}'s dossier`}
                            >
                              <span>👤 {sub.name}</span>
                              <small>({sub.designation})</small>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="no-subordinates-note">No direct reports assigned</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Workplace Information Section */}
                <div className="dossier-section">
                  <h4 className="section-kicker">WORKPLACE DETAILS</h4>
                  <div className="dossier-meta-grid">
                    <div className="meta-cell">
                      <span className="meta-label">Department</span>
                      <strong className="meta-val">{inspectedEmp.department}</strong>
                    </div>
                    <div className="meta-cell">
                      <span className="meta-label">Workstation Location</span>
                      <strong className="meta-val">{inspectedEmp.location || "Not Specified"}</strong>
                    </div>
                    <div className="meta-cell">
                      <span className="meta-label">Work Email</span>
                      <strong className="meta-val email-val">{inspectedEmp.email || "Not Specified"}</strong>
                    </div>
                    <div className="meta-cell">
                      <span className="meta-label">Phone</span>
                      <strong className="meta-val">{inspectedEmp.phone || "Not Specified"}</strong>
                    </div>
                    <div className="meta-cell">
                      <span className="meta-label">Tenure / Experience</span>
                      <strong className="meta-val">{inspectedEmp.experience || "Not Specified"}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="dossier-drawer-footer">
                <a
                  href={`mailto:${inspectedEmp.email}`}
                  className="dossier-action-btn email-btn"
                >
                  ✉️ Send Email
                </a>
                <button
                  type="button"
                  className="dossier-action-btn close-btn"
                  onClick={() => setInspectedEmp(null)}
                >
                  Close Dossier
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default OrganizationHierarchy;
