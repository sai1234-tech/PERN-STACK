import { useState, useEffect } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSidebar } from "../../context/SidebarContext";
import { normalizeRole, getDefaultDashboard, getRoleDisplayTitle } from "../../utils/auth";
import { formatPhotoUrl } from "../../utils/photo";
import { useEmployee } from "../../hooks/useEmployee";
import "./AppSidebar.css";

function AppSidebar() {
  const { user, employee: authEmployee, logout } = useAuth();
  const { employee: hookEmployee } = useEmployee();
  const employee = hookEmployee || authEmployee;
  const profile = employee || user || {};
  const { isCollapsed: isDesktopCollapsed, isMobileOpen, toggleCollapse, closeMobile } = useSidebar();
  const location = useLocation();

  const [isMobileScreen, setIsMobileScreen] = useState(() => {
    return typeof window !== "undefined" ? window.innerWidth <= 992 : false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth <= 992);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // On mobile (drawer open or screen width <= 992px), sidebar is NEVER collapsed; module names are ALWAYS visible
  const isCollapsed = isDesktopCollapsed && !isMobileOpen && !isMobileScreen;

  // Close mobile drawer on route change
  useEffect(() => {
    closeMobile();
  }, [location.pathname, closeMobile]);

  // Desktop keyboard shortcut Ctrl+[ or Cmd+[ to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "[") {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCollapse]);

  const role = normalizeRole(user, employee);
  const isVikas =
    Boolean(
      profile?.name?.toLowerCase().includes("vikas") ||
      user?.name?.toLowerCase().includes("vikas") ||
      profile?.email?.toLowerCase().includes("vikas") ||
      user?.email?.toLowerCase().includes("vikas") ||
      employee?.email?.toLowerCase().includes("vikas")
    );

  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin" || isSuperAdmin;
  const isHrAdmin = role === "hr_admin" || role === "hr_operations";
  const isHrManager = role === "hr_manager";
  const isHr = role === "hr" || isHrAdmin || isHrManager;
  const isRecruiter = role === "recruiter" || role === "talent_acquisition";
  const isPayroll = role === "payroll" || role === "finance";
  const isItAdmin = role === "it_admin" || role === "it";
  const isLeadership = role === "leadership" || role === "executive";
  const isAuditor = role === "auditor";
  const isManager = (role === "manager" || role === "hiring_manager" || isVikas) && !isHr && !isAdmin;
  const isEmployee = !isAdmin && !isHr && !isManager && !isRecruiter && !isPayroll && !isItAdmin && !isLeadership && !isAuditor;

  const displayName =
    (isVikas ? "Vikas Guru" : "") ||
    profile.name ||
    `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
    user?.name ||
    user?.email?.split("@")[0] ||
    "Employee";

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "QS";

  const rawDesignation = profile.employment?.designation || profile.designation || profile.jobTitle;
  const designation = rawDesignation || getRoleDisplayTitle(role);

  const homeRoute = getDefaultDashboard(user, employee);

  const portalBadge = isSuperAdmin
    ? "Super Admin Console"
    : isAdmin
    ? "Executive Admin"
    : isHrAdmin
    ? "HR Admin & Operations"
    : isHrManager
    ? "HR Management"
    : isHr
    ? "HR Operations"
    : isRecruiter
    ? "Talent Acquisition"
    : isPayroll
    ? "Payroll & Finance"
    : isItAdmin
    ? "IT & Infrastructure"
    : isLeadership
    ? "Executive Leadership"
    : isAuditor
    ? "Statutory Audit"
    : isManager
    ? "Manager Workspace"
    : "Employee Self-Service";

  const userPhoto =
    authEmployee?.profilePhoto ||
    user?.profilePhoto ||
    profile.profilePhoto ||
    "";

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={closeMobile}
          aria-label="Close Navigation Drawer"
        />
      )}

      <aside
        className={`app-vertical-sidebar ${isCollapsed ? "collapsed" : "expanded"} ${
          isMobileOpen ? "mobile-open" : ""
        }`}
        aria-label="Application Sidebar Navigation"
      >
        {/* ===================================================
            SIDEBAR BRAND HEADER
        =================================================== */}
        <div className="sidebar-brand-section">
          {!isCollapsed ? (
            <>
              <Link to={homeRoute} className="sidebar-brand-link" title="Quadratic Systems Inc">
                <div className="sidebar-logo-pod">QSI</div>
                <div className="sidebar-brand-info">
                  <span className="sidebar-company-title">Quadratic HRMS</span>
                  <span className="sidebar-portal-badge">
                    <span className="live-status-dot" />
                    {portalBadge}
                  </span>
                </div>
              </Link>


              {/* Mobile Drawer Dismiss Button (< 992px) */}
              <button
                type="button"
                className="sidebar-mobile-close-btn"
                onClick={closeMobile}
                title="Close Navigation Menu"
                aria-label="Close navigation menu"
              >
                ✕
              </button>
            </>
          ) : (
            /* When collapsed: Centered interactive Logo */
            <div className="sidebar-collapsed-expand-btn">
              <div className="sidebar-logo-pod">QSI</div>
            </div>
          )}
        </div>

        {/* ===================================================
            NAVIGATION MENU GROUPS
        =================================================== */}
        <div className="sidebar-nav-scroller">
          {/* 1. EMPLOYEE NAVIGATION */}
          {isEmployee && (
            <>
              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">WORKSPACE</span>}
                <NavLink to={homeRoute} end className="sidebar-nav-link" title="Overview Dashboard">
                  <span className="nav-item-icon">📊</span>
                  {!isCollapsed && <span className="nav-item-label">Overview</span>}
                </NavLink>
                <NavLink to="/ai-assistant" end className="sidebar-nav-link" title="Ask HR policy questions and search">
                  <span className="nav-item-icon">💬</span>
                  {!isCollapsed && <span className="nav-item-label">Policy Assistant</span>}
                </NavLink>
              </div>

              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">TIME & ATTENDANCE</span>}
                <NavLink to="/employee/attendance" end className="sidebar-nav-link" title="Daily Attendance & Punch Station">
                  <span className="nav-item-icon">⏱️</span>
                  {!isCollapsed && <span className="nav-item-label">Attendance</span>}
                </NavLink>
                <NavLink to="/employee/leaves" end className="sidebar-nav-link" title="Leave & WFH Portal">
                  <span className="nav-item-icon">🌴</span>
                  {!isCollapsed && (
                    <>
                      <span className="nav-item-label">Leaves & WFH</span>
                      <span className="sidebar-sub-badge">Active</span>
                    </>
                  )}
                </NavLink>
                <NavLink to="/employee/timesheets" end className="sidebar-nav-link" title="Timesheets & Work Hours">
                  <span className="nav-item-icon">📋</span>
                  {!isCollapsed && <span className="nav-item-label">Timesheets</span>}
                </NavLink>
                <NavLink to="/employee/performance" end className="sidebar-nav-link" title="OKRs & Appraisals">
                  <span className="nav-item-icon">🎯</span>
                  {!isCollapsed && <span className="nav-item-label">Performance</span>}
                </NavLink>
              </div>

              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">FINANCE & RECORDS</span>}
                <NavLink to="/employee/payroll" end className="sidebar-nav-link" title="Salary & Payslips">
                  <span className="nav-item-icon">💰</span>
                  {!isCollapsed && <span className="nav-item-label">My Payroll</span>}
                </NavLink>
                <NavLink to="/employee/documents" end className="sidebar-nav-link" title="Document Vault">
                  <span className="nav-item-icon">📂</span>
                  {!isCollapsed && <span className="nav-item-label">Documents</span>}
                </NavLink>
                <NavLink to="/employee/resignation" end className="sidebar-nav-link" title="Resignation Portal">
                  <span className="nav-item-icon">🚪</span>
                  {!isCollapsed && <span className="nav-item-label">Resignation</span>}
                </NavLink>
              </div>

              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">ORGANIZATION</span>}
                <NavLink to="/organization" end className="sidebar-nav-link" title="Organization Hierarchy & Teams">
                  <span className="nav-item-icon">🌳</span>
                  {!isCollapsed && <span className="nav-item-label">Org Chart</span>}
                </NavLink>
                <NavLink to="/employee/calendar" end className="sidebar-nav-link" title="Corporate Holiday Calendar">
                  <span className="nav-item-icon">🗓️</span>
                  {!isCollapsed && <span className="nav-item-label">Holiday Calendar</span>}
                </NavLink>
                <NavLink to="/employee/profile" end className="sidebar-nav-link" title="Personal & Employment Profile">
                  <span className="nav-item-icon">👤</span>
                  {!isCollapsed && <span className="nav-item-label">My Profile</span>}
                </NavLink>
                <NavLink to="/ai" end className="sidebar-nav-link" title="AI HR Assistant & Cognitive Intelligence Hub">
                  <span className="nav-item-icon">🧠</span>
                  {!isCollapsed && (
                    <>
                      <span className="nav-item-label">AI HR Assistant</span>
                      <span className="sidebar-sub-badge" style={{ background: "#6366f1", color: "#fff" }}>AI</span>
                    </>
                  )}
                </NavLink>
              </div>
            </>
          )}

          {/* 2. MANAGER NAVIGATION (Streamlined to Essential Modules Only) */}
          {isManager && (
            <>
              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">TEAM MANAGEMENT</span>}
                <NavLink to="/manager/dashboard" end className="sidebar-nav-link" title="Team Approvals & Command Center">
                  <span className="nav-item-icon">👥</span>
                  {!isCollapsed && <span className="nav-item-label">Team Overview & Approvals</span>}
                </NavLink>
                <NavLink to="/manager/projects" end className="sidebar-nav-link" title="Active Projects & Deliverables">
                  <span className="nav-item-icon">🚀</span>
                  {!isCollapsed && <span className="nav-item-label">Active Projects</span>}
                </NavLink>
                <NavLink to="/manager/timesheets" end className="sidebar-nav-link" title="Review Team Timesheets">
                  <span className="nav-item-icon">📋</span>
                  {!isCollapsed && <span className="nav-item-label">Team Timesheets</span>}
                </NavLink>
                <NavLink to="/manager/resources" end className="sidebar-nav-link" title="Bench & Resource Allocation Matrix">
                  <span className="nav-item-icon">🏢</span>
                  {!isCollapsed && <span className="nav-item-label">Resource Matrix</span>}
                </NavLink>
                <NavLink to="/manager/performance" end className="sidebar-nav-link" title="Team Performance Reviews & OKRs">
                  <span className="nav-item-icon">🎯</span>
                  {!isCollapsed && <span className="nav-item-label">Team Appraisals & OKRs</span>}
                </NavLink>
                <NavLink to="/organization" end className="sidebar-nav-link" title="Organization Hierarchy">
                  <span className="nav-item-icon">🌳</span>
                  {!isCollapsed && <span className="nav-item-label">Org Hierarchy</span>}
                </NavLink>
              </div>

              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">MY SELF-SERVICE</span>}
                <NavLink to="/employee/attendance" end className="sidebar-nav-link" title="My Daily Attendance & Punch Station">
                  <span className="nav-item-icon">⏱️</span>
                  {!isCollapsed && <span className="nav-item-label">My Attendance</span>}
                </NavLink>
                <NavLink to="/employee/leaves" end className="sidebar-nav-link" title="My Leaves & WFH Portal">
                  <span className="nav-item-icon">🌴</span>
                  {!isCollapsed && <span className="nav-item-label">My Leaves & WFH</span>}
                </NavLink>
                <NavLink to="/employee/timesheets" end className="sidebar-nav-link" title="My Timesheets">
                  <span className="nav-item-icon">📋</span>
                  {!isCollapsed && <span className="nav-item-label">My Timesheets</span>}
                </NavLink>
                <NavLink to="/employee/payroll" end className="sidebar-nav-link" title="My Compensation & Payslips">
                  <span className="nav-item-icon">💰</span>
                  {!isCollapsed && <span className="nav-item-label">My Payroll</span>}
                </NavLink>
                <NavLink to="/employee/calendar" end className="sidebar-nav-link" title="Corporate Holiday Calendar">
                  <span className="nav-item-icon">🗓️</span>
                  {!isCollapsed && <span className="nav-item-label">Holiday Calendar</span>}
                </NavLink>
                <NavLink to="/employee/profile" end className="sidebar-nav-link" title="My Personal & Employment Profile">
                  <span className="nav-item-icon">👤</span>
                  {!isCollapsed && <span className="nav-item-label">My Profile</span>}
                </NavLink>
                <NavLink to="/ai" end className="sidebar-nav-link" title="AI Intelligence Hub & Smart Attendance">
                  <span className="nav-item-icon">🧠</span>
                  {!isCollapsed && (
                    <>
                      <span className="nav-item-label">AI Intelligence Hub</span>
                      <span className="sidebar-sub-badge" style={{ background: "#6366f1", color: "#fff" }}>AI</span>
                    </>
                  )}
                </NavLink>
              </div>
            </>
          )}

          {/* 3. HR NAVIGATION */}
          {isHr && (
            <>
              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">HR DASHBOARD</span>}
                <NavLink to="/hr/dashboard" end className="sidebar-nav-link" title="HR Command Center">
                  <span className="nav-item-icon">🏢</span>
                  {!isCollapsed && <span className="nav-item-label">HR Overview</span>}
                </NavLink>
              </div>

              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">PEOPLE & STRUCTURE</span>}
                <NavLink to="/hr/recruitment" end className="sidebar-nav-link" title="Recruitment & Onboarding">
                  <span className="nav-item-icon">🎯</span>
                  {!isCollapsed && <span className="nav-item-label">Recruitment</span>}
                </NavLink>
                <NavLink to="/hr/employees" end className="sidebar-nav-link" title="Employee Directory">
                  <span className="nav-item-icon">👥</span>
                  {!isCollapsed && <span className="nav-item-label">Employees</span>}
                </NavLink>
                <NavLink to="/hr/lifecycle" end className="sidebar-nav-link" title="22-Stage Employee Lifecycle Journey">
                  <span className="nav-item-icon">🔄</span>
                  {!isCollapsed && <span className="nav-item-label">Lifecycle Journey</span>}
                </NavLink>
                <NavLink to="/hr/resources" end className="sidebar-nav-link" title="Staff-Augmentation SOWs, Clients & Rate Cards">
                  <span className="nav-item-icon">💼</span>
                  {!isCollapsed && <span className="nav-item-label">Staff-Aug & SOWs</span>}
                </NavLink>
                <NavLink to="/hr/departments" end className="sidebar-nav-link" title="Department Structure">
                  <span className="nav-item-icon">🏛️</span>
                  {!isCollapsed && <span className="nav-item-label">Departments</span>}
                </NavLink>
                <NavLink to="/hr/organization" end className="sidebar-nav-link" title="Enterprise Hierarchy">
                  <span className="nav-item-icon">🌳</span>
                  {!isCollapsed && <span className="nav-item-label">Org Hierarchy</span>}
                </NavLink>
                <NavLink to="/hr/entities" end className="sidebar-nav-link" title="Core Database Entities (41 Master Entities)">
                  <span className="nav-item-icon">🌐</span>
                  {!isCollapsed && <span className="nav-item-label">Database Entities</span>}
                </NavLink>
                <NavLink to="/hr/integrations" end className="sidebar-nav-link" title="Enterprise 8-Channel Integration Hub">
                  <span className="nav-item-icon">🔌</span>
                  {!isCollapsed && <span className="nav-item-label">Integrations Hub</span>}
                </NavLink>
                <NavLink to="/admin/governance" end className="sidebar-nav-link" title="Enterprise Security, Governance & DPDP Compliance">
                  <span className="nav-item-icon">🔐</span>
                  {!isCollapsed && <span className="nav-item-label">Security & Compliance</span>}
                </NavLink>
                <NavLink to="/hr/automations" end className="sidebar-nav-link" title="Lifecycle Automations, SLA Engines & Scheduled Reports">
                  <span className="nav-item-icon">⚙️</span>
                  {!isCollapsed && <span className="nav-item-label">Automations & SLAs</span>}
                </NavLink>
                <NavLink to="/admin/audit-governance" end className="sidebar-nav-link" title="Audit, Temporal History & Document Governance">
                  <span className="nav-item-icon">📋</span>
                  {!isCollapsed && <span className="nav-item-label">Audit & Governance</span>}
                </NavLink>
                <NavLink to="/admin/operations" end className="sidebar-nav-link" title="Enterprise Operations, NFR Benchmarks & Architecture">
                  <span className="nav-item-icon">⚡</span>
                  {!isCollapsed && <span className="nav-item-label">Operations & Architecture</span>}
                </NavLink>
                <NavLink to="/admin/tech-stack" end className="sidebar-nav-link" title="Tech Stack Selection, Multi-Cloud Topology & TCO Model">
                  <span className="nav-item-icon">🏛️</span>
                  {!isCollapsed && <span className="nav-item-label">Tech Stack & Cloud</span>}
                </NavLink>
                <NavLink to="/admin/delivery-roadmap" end className="sidebar-nav-link" title="Phase 0-4 Delivery Roadmap and AI Assistant">
                  <span className="nav-item-icon">🗺️</span>
                  {!isCollapsed && <span className="nav-item-label">Roadmap & AI Assistant</span>}
                </NavLink>
                <NavLink to="/ai" end className="sidebar-nav-link" title="Cognitive AI HRMS Intelligence Hub (5 Core AI Modules)">
                  <span className="nav-item-icon">🧠</span>
                  {!isCollapsed && (
                    <>
                      <span className="nav-item-label">AI Intelligence Hub</span>
                      <span className="sidebar-sub-badge" style={{ background: "#6366f1", color: "#fff" }}>5 Modules</span>
                    </>
                  )}
                </NavLink>
              </div>

              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">OPERATIONS</span>}
                <NavLink to="/hr/helpdesk" end className="sidebar-nav-link" title="HR Support Tickets">
                  <span className="nav-item-icon">🎟️</span>
                  {!isCollapsed && <span className="nav-item-label">HR Helpdesk</span>}
                </NavLink>
                <NavLink to="/hr/roster" end className="sidebar-nav-link" title="Shift & Roster Management">
                  <span className="nav-item-icon">🕒</span>
                  {!isCollapsed && <span className="nav-item-label">Shift Roster</span>}
                </NavLink>
                <NavLink to="/hr/timesheets" end className="sidebar-nav-link" title="Timesheet Approvals">
                  <span className="nav-item-icon">⏱️</span>
                  {!isCollapsed && <span className="nav-item-label">Timesheets</span>}
                </NavLink>
                <NavLink to="/hr/leaves" end className="sidebar-nav-link" title="Leave Management">
                  <span className="nav-item-icon">🌴</span>
                  {!isCollapsed && <span className="nav-item-label">Leave Management</span>}
                </NavLink>
                <NavLink to="/hr/resignations" end className="sidebar-nav-link" title="Resignation Management">
                  <span className="nav-item-icon">🚪</span>
                  {!isCollapsed && <span className="nav-item-label">Resignations</span>}
                </NavLink>
                <NavLink to="/hr/performance" end className="sidebar-nav-link" title="Appraisals & Performance">
                  <span className="nav-item-icon">🎯</span>
                  {!isCollapsed && <span className="nav-item-label">Appraisals</span>}
                </NavLink>
                <NavLink to="/hr/payroll" end className="sidebar-nav-link" title="Payroll Processing">
                  <span className="nav-item-icon">💳</span>
                  {!isCollapsed && <span className="nav-item-label">Payroll Run</span>}
                </NavLink>
                <NavLink to="/hr/documents" end className="sidebar-nav-link" title="Company Documents Vault">
                  <span className="nav-item-icon">📂</span>
                  {!isCollapsed && <span className="nav-item-label">Documents</span>}
                </NavLink>
              </div>

              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">MY WORKSPACE</span>}
                <NavLink to="/employee/attendance" end className="sidebar-nav-link" title="My Daily Attendance & Punch Station">
                  <span className="nav-item-icon">⏱️</span>
                  {!isCollapsed && <span className="nav-item-label">My Attendance (Clock In/Out)</span>}
                </NavLink>
                <NavLink to="/employee/calendar" end className="sidebar-nav-link" title="Corporate Holiday Calendar">
                  <span className="nav-item-icon">🗓️</span>
                  {!isCollapsed && <span className="nav-item-label">Holiday Calendar</span>}
                </NavLink>
                <NavLink to="/employee/payroll" end className="sidebar-nav-link" title="My Compensation">
                  <span className="nav-item-icon">💰</span>
                  {!isCollapsed && <span className="nav-item-label">My Payroll</span>}
                </NavLink>
                <NavLink to="/employee/dashboard" end className="sidebar-nav-link" title="My Personal Self-Service Dashboard">
                  <span className="nav-item-icon">👤</span>
                  {!isCollapsed && <span className="nav-item-label">My Personal Dashboard</span>}
                </NavLink>
              </div>
            </>
          )}

          {/* 3. ADMIN NAVIGATION */}
          {isAdmin && (
            <>
              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">ADMINISTRATION</span>}
                <NavLink to="/admin/dashboard" end className="sidebar-nav-link" title="Executive Admin Console">
                  <span className="nav-item-icon">⚡</span>
                  {!isCollapsed && <span className="nav-item-label">Admin Console</span>}
                </NavLink>
                <NavLink to="/admin/accounts" end className="sidebar-nav-link" title="User Account Control">
                  <span className="nav-item-icon">🛡️</span>
                  {!isCollapsed && <span className="nav-item-label">User Accounts</span>}
                </NavLink>
              </div>

              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">WORKFORCE GOVERNANCE</span>}
                <NavLink to="/hr/employees" end className="sidebar-nav-link" title="Workforce Directory">
                  <span className="nav-item-icon">👥</span>
                  {!isCollapsed && <span className="nav-item-label">Employees</span>}
                </NavLink>
                <NavLink to="/hr/lifecycle" end className="sidebar-nav-link" title="22-Stage Employee Lifecycle Journey">
                  <span className="nav-item-icon">🔄</span>
                  {!isCollapsed && <span className="nav-item-label">Lifecycle Journey</span>}
                </NavLink>
                <NavLink to="/admin/staff-aug" end className="sidebar-nav-link" title="Staff-Augmentation SOWs, Clients & Rate Cards">
                  <span className="nav-item-icon">💼</span>
                  {!isCollapsed && <span className="nav-item-label">Staff-Aug & SOWs</span>}
                </NavLink>
                <NavLink to="/hr/departments" end className="sidebar-nav-link" title="Departments & Pods">
                  <span className="nav-item-icon">🏢</span>
                  {!isCollapsed && <span className="nav-item-label">Departments</span>}
                </NavLink>
                <NavLink to="/hr/dashboard" end className="sidebar-nav-link" title="HR Operations Center">
                  <span className="nav-item-icon">📊</span>
                  {!isCollapsed && <span className="nav-item-label">HR Operations</span>}
                </NavLink>
                <NavLink to="/hr/payroll" end className="sidebar-nav-link" title="Company Payroll Run">
                  <span className="nav-item-icon">💳</span>
                  {!isCollapsed && <span className="nav-item-label">Payroll Run</span>}
                </NavLink>
                <NavLink to="/hr/timesheets" end className="sidebar-nav-link" title="Timesheet Approvals">
                  <span className="nav-item-icon">⏱️</span>
                  {!isCollapsed && <span className="nav-item-label">Timesheets</span>}
                </NavLink>
                <NavLink to="/hr/leaves" end className="sidebar-nav-link" title="Leave Management">
                  <span className="nav-item-icon">🌴</span>
                  {!isCollapsed && <span className="nav-item-label">Leave Management</span>}
                </NavLink>
                <NavLink to="/hr/resignations" end className="sidebar-nav-link" title="Resignation Approvals">
                  <span className="nav-item-icon">🚪</span>
                  {!isCollapsed && <span className="nav-item-label">Resignations</span>}
                </NavLink>
                <NavLink to="/hr/documents" end className="sidebar-nav-link" title="Compliance Vault">
                  <span className="nav-item-icon">📂</span>
                  {!isCollapsed && <span className="nav-item-label">Documents</span>}
                </NavLink>
                <NavLink to="/employee/calendar" end className="sidebar-nav-link" title="Corporate Holiday Calendar">
                  <span className="nav-item-icon">🗓️</span>
                  {!isCollapsed && <span className="nav-item-label">Holiday Calendar</span>}
                </NavLink>
              </div>

              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">ORGANIZATION</span>}
                <NavLink to="/organization" end className="sidebar-nav-link" title="Enterprise Hierarchy">
                  <span className="nav-item-icon">🌳</span>
                  {!isCollapsed && <span className="nav-item-label">Org Tree</span>}
                </NavLink>
                <NavLink to="/admin/entities" end className="sidebar-nav-link" title="Core Database Entities (41 Master Entities)">
                  <span className="nav-item-icon">🌐</span>
                  {!isCollapsed && <span className="nav-item-label">Database Entities</span>}
                </NavLink>
                <NavLink to="/admin/integrations" end className="sidebar-nav-link" title="Enterprise 8-Channel Integration Hub">
                  <span className="nav-item-icon">🔌</span>
                  {!isCollapsed && <span className="nav-item-label">Integrations Hub</span>}
                </NavLink>
                <NavLink to="/admin/governance" end className="sidebar-nav-link" title="Enterprise Security, Governance & DPDP Compliance">
                  <span className="nav-item-icon">🔐</span>
                  {!isCollapsed && <span className="nav-item-label">Security & Compliance</span>}
                </NavLink>
                <NavLink to="/admin/automations" end className="sidebar-nav-link" title="Lifecycle Automations, SLA Engines & Scheduled Reports">
                  <span className="nav-item-icon">⚙️</span>
                  {!isCollapsed && <span className="nav-item-label">Automations & SLAs</span>}
                </NavLink>
                <NavLink to="/admin/audit-governance" end className="sidebar-nav-link" title="Audit, Temporal History & Document Governance">
                  <span className="nav-item-icon">📋</span>
                  {!isCollapsed && <span className="nav-item-label">Audit & Governance</span>}
                </NavLink>
                <NavLink to="/admin/operations" end className="sidebar-nav-link" title="Enterprise Operations, NFR Benchmarks & Architecture">
                  <span className="nav-item-icon">⚡</span>
                  {!isCollapsed && <span className="nav-item-label">Operations & Architecture</span>}
                </NavLink>
                <NavLink to="/admin/tech-stack" end className="sidebar-nav-link" title="Tech Stack Selection, Multi-Cloud Topology & TCO Model">
                  <span className="nav-item-icon">🏛️</span>
                  {!isCollapsed && <span className="nav-item-label">Tech Stack & Cloud</span>}
                </NavLink>
                <NavLink to="/admin/delivery-roadmap" end className="sidebar-nav-link" title="Phase 0-4 Delivery Roadmap and AI Assistant">
                  <span className="nav-item-icon">🗺️</span>
                  {!isCollapsed && <span className="nav-item-label">Roadmap & AI Assistant</span>}
                </NavLink>
                <NavLink to="/admin/data-migration" end className="sidebar-nav-link" title="Legacy Data Migration & Ingestion Engine">
                  <span className="nav-item-icon">📦</span>
                  {!isCollapsed && <span className="nav-item-label">Data Migration</span>}
                </NavLink>
                <NavLink to="/ai" end className="sidebar-nav-link" title="Cognitive AI HRMS Intelligence Hub (5 Core AI Modules)">
                  <span className="nav-item-icon">🧠</span>
                  {!isCollapsed && (
                    <>
                      <span className="nav-item-label">AI Intelligence Hub</span>
                      <span className="sidebar-sub-badge" style={{ background: "#6366f1", color: "#fff" }}>5 Modules</span>
                    </>
                  )}
                </NavLink>
              </div>

              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">MY WORKSPACE</span>}
                <NavLink to="/employee/profile" end className="sidebar-nav-link" title="Executive Profile">
                  <span className="nav-item-icon">👤</span>
                  {!isCollapsed && <span className="nav-item-label">My Profile</span>}
                </NavLink>
                <NavLink to="/employee/documents" end className="sidebar-nav-link" title="My Documents">
                  <span className="nav-item-icon">📁</span>
                  {!isCollapsed && <span className="nav-item-label">My Documents</span>}
                </NavLink>
                <NavLink to="/employee/payroll" end className="sidebar-nav-link" title="My Compensation & Payslips">
                  <span className="nav-item-icon">💰</span>
                  {!isCollapsed && <span className="nav-item-label">My Payroll</span>}
                </NavLink>
              </div>
            </>
          )}

          {/* 5. RECRUITER / TALENT ACQUISITION */}
          {isRecruiter && (
            <>
              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">TALENT ACQUISITION</span>}
                <NavLink to="/hr/recruitment" end className="sidebar-nav-link" title="Recruitment & Preboarding Pipeline">
                  <span className="nav-item-icon">🎯</span>
                  {!isCollapsed && <span className="nav-item-label">Hiring Pipeline</span>}
                </NavLink>
                <NavLink to="/hr/employees" end className="sidebar-nav-link" title="Workforce Directory">
                  <span className="nav-item-icon">👥</span>
                  {!isCollapsed && <span className="nav-item-label">Employees</span>}
                </NavLink>
                <NavLink to="/hr/departments" end className="sidebar-nav-link" title="Department Structure">
                  <span className="nav-item-icon">🏛️</span>
                  {!isCollapsed && <span className="nav-item-label">Departments</span>}
                </NavLink>
                <NavLink to="/organization" end className="sidebar-nav-link" title="Enterprise Hierarchy">
                  <span className="nav-item-icon">🌳</span>
                  {!isCollapsed && <span className="nav-item-label">Org Tree</span>}
                </NavLink>
              </div>

              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">MY SELF-SERVICE</span>}
                <NavLink to="/employee/attendance" end className="sidebar-nav-link" title="My Attendance">
                  <span className="nav-item-icon">⏱️</span>
                  {!isCollapsed && <span className="nav-item-label">My Attendance</span>}
                </NavLink>
                <NavLink to="/employee/leaves" end className="sidebar-nav-link" title="My Leaves">
                  <span className="nav-item-icon">🌴</span>
                  {!isCollapsed && <span className="nav-item-label">My Leaves</span>}
                </NavLink>
                <NavLink to="/employee/calendar" end className="sidebar-nav-link" title="Holiday Calendar">
                  <span className="nav-item-icon">🗓️</span>
                  {!isCollapsed && <span className="nav-item-label">Holiday Calendar</span>}
                </NavLink>
                <NavLink to="/employee/profile" end className="sidebar-nav-link" title="My Profile">
                  <span className="nav-item-icon">👤</span>
                  {!isCollapsed && <span className="nav-item-label">My Profile</span>}
                </NavLink>
              </div>
            </>
          )}

          {/* 6. PAYROLL / FINANCE */}
          {isPayroll && (
            <>
              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">PAYROLL & FINANCE</span>}
                <NavLink to="/hr/payroll" end className="sidebar-nav-link" title="Payroll Processing & Run">
                  <span className="nav-item-icon">💳</span>
                  {!isCollapsed && <span className="nav-item-label">Payroll Run</span>}
                </NavLink>
                <NavLink to="/hr/employees" end className="sidebar-nav-link" title="Workforce Salary Records">
                  <span className="nav-item-icon">👥</span>
                  {!isCollapsed && <span className="nav-item-label">Workforce Directory</span>}
                </NavLink>
                <NavLink to="/hr/documents" end className="sidebar-nav-link" title="Statutory & Compliance Vault">
                  <span className="nav-item-icon">📂</span>
                  {!isCollapsed && <span className="nav-item-label">Tax & Compliance</span>}
                </NavLink>
                <NavLink to="/organization" end className="sidebar-nav-link" title="Enterprise Hierarchy">
                  <span className="nav-item-icon">🌳</span>
                  {!isCollapsed && <span className="nav-item-label">Org Tree</span>}
                </NavLink>
              </div>

              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">MY SELF-SERVICE</span>}
                <NavLink to="/employee/attendance" end className="sidebar-nav-link" title="My Attendance">
                  <span className="nav-item-icon">⏱️</span>
                  {!isCollapsed && <span className="nav-item-label">My Attendance</span>}
                </NavLink>
                <NavLink to="/employee/leaves" end className="sidebar-nav-link" title="My Leaves">
                  <span className="nav-item-icon">🌴</span>
                  {!isCollapsed && <span className="nav-item-label">My Leaves</span>}
                </NavLink>
                <NavLink to="/employee/profile" end className="sidebar-nav-link" title="My Profile">
                  <span className="nav-item-icon">👤</span>
                  {!isCollapsed && <span className="nav-item-label">My Profile</span>}
                </NavLink>
              </div>
            </>
          )}

          {/* 7. IT / ADMIN */}
          {isItAdmin && (
            <>
              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">IT PROVISIONING & ASSETS</span>}
                <NavLink to="/admin/accounts" end className="sidebar-nav-link" title="User Account Control & Credentials">
                  <span className="nav-item-icon">🛡️</span>
                  {!isCollapsed && <span className="nav-item-label">User Provisioning</span>}
                </NavLink>
                <NavLink to="/hr/recruitment" end className="sidebar-nav-link" title="IT Preboarding Asset Allocation">
                  <span className="nav-item-icon">💻</span>
                  {!isCollapsed && <span className="nav-item-label">IT Checklist</span>}
                </NavLink>
                <NavLink to="/hr/employees" end className="sidebar-nav-link" title="Employee Directory">
                  <span className="nav-item-icon">👥</span>
                  {!isCollapsed && <span className="nav-item-label">Directory</span>}
                </NavLink>
                <NavLink to="/hr/helpdesk" end className="sidebar-nav-link" title="IT Support Tickets">
                  <span className="nav-item-icon">🎟️</span>
                  {!isCollapsed && <span className="nav-item-label">IT Helpdesk</span>}
                </NavLink>
              </div>

              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">MY SELF-SERVICE</span>}
                <NavLink to="/employee/attendance" end className="sidebar-nav-link" title="My Attendance">
                  <span className="nav-item-icon">⏱️</span>
                  {!isCollapsed && <span className="nav-item-label">My Attendance</span>}
                </NavLink>
                <NavLink to="/employee/leaves" end className="sidebar-nav-link" title="My Leaves">
                  <span className="nav-item-icon">🌴</span>
                  {!isCollapsed && <span className="nav-item-label">My Leaves</span>}
                </NavLink>
                <NavLink to="/employee/profile" end className="sidebar-nav-link" title="My Profile">
                  <span className="nav-item-icon">👤</span>
                  {!isCollapsed && <span className="nav-item-label">My Profile</span>}
                </NavLink>
              </div>
            </>
          )}

          {/* 8. LEADERSHIP EXECUTIVE */}
          {isLeadership && (
            <>
              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">EXECUTIVE GOVERNANCE</span>}
                <NavLink to="/admin/dashboard" end className="sidebar-nav-link" title="Executive Analytics & Operations">
                  <span className="nav-item-icon">⚡</span>
                  {!isCollapsed && <span className="nav-item-label">Executive Console</span>}
                </NavLink>
                <NavLink to="/hr/employees" end className="sidebar-nav-link" title="Workforce Headcount">
                  <span className="nav-item-icon">👥</span>
                  {!isCollapsed && <span className="nav-item-label">Headcount Directory</span>}
                </NavLink>
                <NavLink to="/organization" end className="sidebar-nav-link" title="Enterprise Hierarchy">
                  <span className="nav-item-icon">🌳</span>
                  {!isCollapsed && <span className="nav-item-label">Org Tree</span>}
                </NavLink>
                <NavLink to="/hr/recruitment" end className="sidebar-nav-link" title="Hiring Pipeline Analytics">
                  <span className="nav-item-icon">🎯</span>
                  {!isCollapsed && <span className="nav-item-label">Hiring Pipeline</span>}
                </NavLink>
                <NavLink to="/hr/payroll" end className="sidebar-nav-link" title="Payroll & Compensation Metrics">
                  <span className="nav-item-icon">💳</span>
                  {!isCollapsed && <span className="nav-item-label">Payroll Summary</span>}
                </NavLink>
              </div>

              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">MY SELF-SERVICE</span>}
                <NavLink to="/employee/attendance" end className="sidebar-nav-link" title="My Attendance">
                  <span className="nav-item-icon">⏱️</span>
                  {!isCollapsed && <span className="nav-item-label">My Attendance</span>}
                </NavLink>
                <NavLink to="/employee/profile" end className="sidebar-nav-link" title="My Profile">
                  <span className="nav-item-icon">👤</span>
                  {!isCollapsed && <span className="nav-item-label">My Profile</span>}
                </NavLink>
              </div>
            </>
          )}

          {/* 9. STATUTORY AUDITOR */}
          {isAuditor && (
            <>
              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">AUDIT & COMPLIANCE</span>}
                <NavLink to="/admin/dashboard" end className="sidebar-nav-link" title="Audit Telemetry & System Activity">
                  <span className="nav-item-icon">🛡️</span>
                  {!isCollapsed && <span className="nav-item-label">Audit Logs & Activity</span>}
                </NavLink>
                <NavLink to="/hr/employees" end className="sidebar-nav-link" title="Workforce Records (Read-Only)">
                  <span className="nav-item-icon">👥</span>
                  {!isCollapsed && <span className="nav-item-label">Workforce Records</span>}
                </NavLink>
                <NavLink to="/hr/documents" end className="sidebar-nav-link" title="Compliance Documents Vault">
                  <span className="nav-item-icon">📂</span>
                  {!isCollapsed && <span className="nav-item-label">Compliance Vault</span>}
                </NavLink>
                <NavLink to="/hr/payroll" end className="sidebar-nav-link" title="Payroll Audit Trail">
                  <span className="nav-item-icon">💳</span>
                  {!isCollapsed && <span className="nav-item-label">Payroll Audit</span>}
                </NavLink>
                <NavLink to="/admin/governance" end className="sidebar-nav-link" title="Enterprise Security, Governance & DPDP Compliance">
                  <span className="nav-item-icon">🔐</span>
                  {!isCollapsed && <span className="nav-item-label">Security & Compliance</span>}
                </NavLink>
                <NavLink to="/hr/automations" end className="sidebar-nav-link" title="Lifecycle Automations, SLA Engines & Scheduled Reports">
                  <span className="nav-item-icon">⚙️</span>
                  {!isCollapsed && <span className="nav-item-label">Automations & SLAs</span>}
                </NavLink>
                <NavLink to="/admin/audit-governance" end className="sidebar-nav-link" title="Audit, Temporal History & Document Governance">
                  <span className="nav-item-icon">📋</span>
                  {!isCollapsed && <span className="nav-item-label">Audit & Governance</span>}
                </NavLink>
                <NavLink to="/admin/operations" end className="sidebar-nav-link" title="Enterprise Operations, NFR Benchmarks & Architecture">
                  <span className="nav-item-icon">⚡</span>
                  {!isCollapsed && <span className="nav-item-label">Operations & Architecture</span>}
                </NavLink>
              </div>

              <div className="sidebar-nav-group">
                {!isCollapsed && <span className="sidebar-group-label">MY SELF-SERVICE</span>}
                <NavLink to="/employee/attendance" end className="sidebar-nav-link" title="My Attendance">
                  <span className="nav-item-icon">⏱️</span>
                  {!isCollapsed && <span className="nav-item-label">My Attendance</span>}
                </NavLink>
                <NavLink to="/employee/profile" end className="sidebar-nav-link" title="My Profile">
                  <span className="nav-item-icon">👤</span>
                  {!isCollapsed && <span className="nav-item-label">My Profile</span>}
                </NavLink>
              </div>
            </>
          )}
        </div>

        {/* ===================================================
            SIDEBAR FOOTER (USER MINI PROFILE & SIGNOUT)
        =================================================== */}
        <div className="sidebar-footer-cluster">
          <Link
            to="/employee/profile"
            className="sidebar-user-card"
            title={`View profile for ${displayName}`}
          >
            <div className="sidebar-user-avatar">
              {userPhoto ? (
                <img
                  src={formatPhotoUrl(userPhoto)}
                  alt={displayName}
                  className="sidebar-avatar-img"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const fallback = e.currentTarget.nextElementSibling;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
              ) : null}
              <span
                className="sidebar-avatar-initials"
                style={{ display: userPhoto ? "none" : "flex" }}
              >
                {initials}
              </span>
            </div>

            {!isCollapsed && (
              <div className="sidebar-user-meta">
                <span className="sidebar-user-name">{displayName}</span>
                <span className="sidebar-user-role">{designation}</span>
              </div>
            )}
          </Link>

          {/* Sign Out Button */}
          <button
            type="button"
            className="sidebar-signout-btn"
            onClick={logout}
            title="Sign out of Quadratic HRMS"
            aria-label="Sign out"
          >
            <svg 
              className="signout-icon"
              xmlns="http://www.w3.org/2000/svg" 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            {!isCollapsed && <span className="signout-label">Sign out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

export default AppSidebar;
