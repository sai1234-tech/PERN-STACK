import { useState, useEffect } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSidebar } from "../../context/SidebarContext";
import { normalizeRole, getDefaultDashboard } from "../../utils/auth";
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
  const isAdmin = role === "admin";
  const isHr = role === "hr";
  const isManager = role === "manager" || isVikas;
  const isEmployee = !isAdmin && !isHr && !isManager;

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
  const designation =
    isManager
      ? (rawDesignation && !["staff", "employee", "software engineer"].includes(rawDesignation.toLowerCase()) ? rawDesignation : "Team Manager")
      : isHr
      ? (rawDesignation || "HR Lead")
      : isAdmin
      ? (rawDesignation || "Administrator")
      : (rawDesignation || "Software Engineer");

  const homeRoute = getDefaultDashboard(user, employee);

  const portalBadge = isAdmin
    ? "Executive Admin"
    : role === "hr"
    ? "HR Portal"
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
                <NavLink to="/hr/departments" end className="sidebar-nav-link" title="Department Structure">
                  <span className="nav-item-icon">🏛️</span>
                  {!isCollapsed && <span className="nav-item-label">Departments</span>}
                </NavLink>
                <NavLink to="/hr/organization" end className="sidebar-nav-link" title="Enterprise Hierarchy">
                  <span className="nav-item-icon">🌳</span>
                  {!isCollapsed && <span className="nav-item-label">Org Hierarchy</span>}
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
