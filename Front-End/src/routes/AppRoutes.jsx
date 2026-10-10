import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import InitialLoader from "../components/common/InitialLoader";
import { normalizeRole } from "../utils/auth";
import { SidebarProvider } from "../context/SidebarContext";
import DashboardLayout from "../components/layout/DashboardLayout";

// ── Auth pages (small, loaded eagerly since they're the entry point) ──────────
import Login from "../pages/auth/Login";
import Signup from "../pages/auth/Signup";
import AdminSetup from "../pages/auth/AdminSetup";

// ── All app pages: code-split via lazy() ─────────────────────────────────────
// Each page bundle is only downloaded when the route is first visited.
// This reduces the initial JS bundle from ~1MB+ to < 100KB.
const EmployeeDashboard    = lazy(() => import("../pages/employee/EmployeeDashboard"));
const EmployeeAttendance   = lazy(() => import("../pages/employee/EmployeeAttendance"));
const EmployeeLeaves       = lazy(() => import("../pages/employee/EmployeeLeaves"));
const EmployeeTimesheets   = lazy(() => import("../pages/employee/EmployeeTimesheets"));
const EmployeeProfile      = lazy(() => import("../pages/employee/EmployeeProfile"));
const EmployeePayroll      = lazy(() => import("../pages/employee/EmployeePayroll"));
const EmployeeDocuments    = lazy(() => import("../pages/employee/EmployeeDocuments"));
const Performance          = lazy(() => import("../pages/employee/Performance"));
const EmployeeResignation  = lazy(() => import("../pages/employee/EmployeeResignation"));
const EmployeeCalendar     = lazy(() => import("../pages/employee/EmployeeCalendar"));

const ManagerDashboard     = lazy(() => import("../pages/manager/ManagerDashboard"));
const ManagerProjects      = lazy(() => import("../pages/manager/ManagerProjects"));

const HRDashboard          = lazy(() => import("../pages/hr/HRDashboard"));
const DepartmentManagement = lazy(() => import("../pages/hr/DepartmentManagement"));
const EmployeeManagement   = lazy(() => import("../pages/hr/EmployeeManagement"));
const TimesheetManagement  = lazy(() => import("../pages/hr/TimesheetManagement"));
const PayrollManagement    = lazy(() => import("../pages/hr/PayrollManagement"));
const DocumentManagement   = lazy(() => import("../pages/hr/DocumentManagement"));
const RecruitmentOnboarding = lazy(() => import("../pages/hr/RecruitmentOnboarding"));
const ResourceAllocation   = lazy(() => import("../pages/hr/ResourceAllocation"));
const ShiftRoster          = lazy(() => import("../pages/hr/ShiftRoster"));
const Helpdesk             = lazy(() => import("../pages/hr/Helpdesk"));
const ManagerPerformance   = lazy(() => import("../pages/manager/ManagerPerformance"));
const HRLeaveManagement    = lazy(() => import("../pages/hr/HRLeaveManagement"));
const HRResignationManagement = lazy(() => import("../pages/hr/HRResignationManagement"));
const AccountManagement    = lazy(() => import("../pages/admin/AccountManagement"));
const AdminDashboard       = lazy(() => import("../pages/admin/AdminDashboard"));
const OrganizationHierarchy = lazy(() => import("../pages/organization/OrganizationHierarchy"));

/**
 * Protect routes based on authentication and role.
 */
/**
 * Protect routes based on authentication and role.
 */
function ProtectedRoute({ children, roles = [] }) {
  const { user, loading } = useAuth();

  if (loading) return <InitialLoader />;
  if (!user) return <Navigate to="/login" replace />;

  const userRole = normalizeRole(user);
  if (roles.length > 0 && !roles.includes(userRole)) {
    if (userRole === "admin") return <Navigate to="/admin/dashboard" replace />;
    if (userRole === "hr") return <Navigate to="/hr/dashboard" replace />;
    if (userRole === "manager") return <Navigate to="/manager/dashboard" replace />;
    return <Navigate to="/employee/dashboard" replace />;
  }

  return children;
}

/**
 * Dynamic Root Redirect based on user role
 */
function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) return <InitialLoader />;
  if (!user) return <Navigate to="/login" replace />;

  const role = normalizeRole(user);
  if (role === "admin") return <Navigate to="/admin/dashboard" replace />;
  if (role === "hr") return <Navigate to="/hr/dashboard" replace />;
  if (role === "manager") return <Navigate to="/manager/dashboard" replace />;
  return <Navigate to="/employee/dashboard" replace />;
}

const ALL_ROLES = ["employee", "manager", "hr", "admin"];

// Shared suspense fallback — shows the same loader used for auth
function PageLoader() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        flexDirection: "column",
        gap: "16px",
        color: "#64748b",
        fontWeight: 600,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: "3px solid #e2e8f0",
          borderTopColor: "#176b70",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <span>Loading…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>

        {/* PUBLIC & ENTRY ROUTES */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="/dashboard" element={<RootRedirect />} />
        <Route path="/login"      element={<Login />} />
        <Route path="/signup"     element={<Signup />} />
        <Route path="/admin/setup" element={<AdminSetup />} />

        {/* AUTHENTICATED APP SHELL */}
        <Route
          element={
            <ProtectedRoute>
              <SidebarProvider>
                <DashboardLayout />
              </SidebarProvider>
            </ProtectedRoute>
          }
        >
          {/* ── Employee & Self-Service (All Roles) ── */}
          <Route path="/employee/dashboard"   element={<ProtectedRoute roles={ALL_ROLES}><EmployeeDashboard /></ProtectedRoute>} />
          <Route path="/employee/calendar"    element={<ProtectedRoute roles={ALL_ROLES}><EmployeeCalendar /></ProtectedRoute>} />
          <Route path="/calendar"             element={<ProtectedRoute roles={ALL_ROLES}><EmployeeCalendar /></ProtectedRoute>} />
          <Route path="/employee/attendance"  element={<ProtectedRoute roles={ALL_ROLES}><EmployeeAttendance /></ProtectedRoute>} />
          <Route path="/attendance"           element={<ProtectedRoute roles={ALL_ROLES}><EmployeeAttendance /></ProtectedRoute>} />
          <Route path="/employee/leaves"      element={<ProtectedRoute roles={ALL_ROLES}><EmployeeLeaves /></ProtectedRoute>} />
          <Route path="/leaves"               element={<ProtectedRoute roles={ALL_ROLES}><EmployeeLeaves /></ProtectedRoute>} />
          <Route path="/employee/timesheets"  element={<ProtectedRoute roles={ALL_ROLES}><EmployeeTimesheets /></ProtectedRoute>} />
          <Route path="/timesheets"           element={<ProtectedRoute roles={ALL_ROLES}><EmployeeTimesheets /></ProtectedRoute>} />
          <Route path="/employee/performance" element={<ProtectedRoute roles={ALL_ROLES}><Performance /></ProtectedRoute>} />
          <Route path="/performance"          element={<ProtectedRoute roles={ALL_ROLES}><Performance /></ProtectedRoute>} />
          <Route path="/employee/profile"     element={<ProtectedRoute roles={ALL_ROLES}><EmployeeProfile /></ProtectedRoute>} />
          <Route path="/profile"              element={<ProtectedRoute roles={ALL_ROLES}><EmployeeProfile /></ProtectedRoute>} />
          <Route path="/employee/payroll"     element={<ProtectedRoute roles={ALL_ROLES}><EmployeePayroll /></ProtectedRoute>} />
          <Route path="/manager/payroll"      element={<ProtectedRoute roles={ALL_ROLES}><EmployeePayroll /></ProtectedRoute>} />
          <Route path="/payroll"              element={<ProtectedRoute roles={ALL_ROLES}><EmployeePayroll /></ProtectedRoute>} />
          <Route path="/employee/documents"   element={<ProtectedRoute roles={ALL_ROLES}><EmployeeDocuments /></ProtectedRoute>} />
          <Route path="/documents"            element={<ProtectedRoute roles={ALL_ROLES}><EmployeeDocuments /></ProtectedRoute>} />
          <Route path="/employee/resignation" element={<ProtectedRoute roles={ALL_ROLES}><EmployeeResignation /></ProtectedRoute>} />
          <Route path="/resignation"          element={<ProtectedRoute roles={ALL_ROLES}><EmployeeResignation /></ProtectedRoute>} />

          {/* ── Manager Routes ── */}
          <Route path="/manager/dashboard"   element={<ProtectedRoute roles={["manager", "admin"]}><ManagerDashboard /></ProtectedRoute>} />
          <Route path="/manager/projects"    element={<ProtectedRoute roles={["manager", "admin"]}><ManagerProjects /></ProtectedRoute>} />
          <Route path="/manager/performance" element={<ProtectedRoute roles={["manager", "admin"]}><ManagerPerformance /></ProtectedRoute>} />

          {/* ── Admin Routes ── */}
          <Route path="/admin/dashboard" element={<ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/accounts"  element={<ProtectedRoute roles={["admin"]}><AccountManagement /></ProtectedRoute>} />

          {/* ── HR / Admin Governance ── */}
          <Route path="/hr/dashboard"    element={<ProtectedRoute roles={["hr", "admin"]}><HRDashboard /></ProtectedRoute>} />
          <Route path="/hr/departments"  element={<ProtectedRoute roles={["hr", "admin"]}><DepartmentManagement /></ProtectedRoute>} />
          <Route path="/departments"     element={<ProtectedRoute roles={["hr", "admin"]}><DepartmentManagement /></ProtectedRoute>} />
          <Route path="/hr/employees"    element={<ProtectedRoute roles={["hr", "admin"]}><EmployeeManagement /></ProtectedRoute>} />
          <Route path="/hr/timesheets"   element={<ProtectedRoute roles={["hr", "admin"]}><TimesheetManagement /></ProtectedRoute>} />
          <Route path="/hr/recruitment"  element={<ProtectedRoute roles={["hr", "admin"]}><RecruitmentOnboarding /></ProtectedRoute>} />
          <Route path="/hr/resources"    element={<ProtectedRoute roles={["hr", "admin"]}><ResourceAllocation /></ProtectedRoute>} />
          <Route path="/hr/roster"       element={<ProtectedRoute roles={["hr", "admin"]}><ShiftRoster /></ProtectedRoute>} />
          <Route path="/hr/payroll"      element={<ProtectedRoute roles={["hr", "admin", "manager"]}><PayrollManagement /></ProtectedRoute>} />
          <Route path="/hr/helpdesk"     element={<ProtectedRoute roles={["hr", "admin"]}><Helpdesk /></ProtectedRoute>} />
          <Route path="/helpdesk"        element={<ProtectedRoute roles={ALL_ROLES}><Helpdesk /></ProtectedRoute>} />
          <Route path="/hr/leaves"       element={<ProtectedRoute roles={["hr", "admin"]}><HRLeaveManagement /></ProtectedRoute>} />
          <Route path="/hr/documents"    element={<ProtectedRoute roles={["hr", "admin"]}><DocumentManagement /></ProtectedRoute>} />
          <Route path="/hr/resignations" element={<ProtectedRoute roles={["hr", "admin"]}><HRResignationManagement /></ProtectedRoute>} />
          <Route path="/hr/performance"  element={<ProtectedRoute roles={["hr", "admin", "manager"]}><ManagerPerformance /></ProtectedRoute>} />
          <Route path="/hr/organization"       element={<ProtectedRoute roles={ALL_ROLES}><OrganizationHierarchy /></ProtectedRoute>} />
          <Route path="/organization"          element={<ProtectedRoute roles={ALL_ROLES}><OrganizationHierarchy /></ProtectedRoute>} />
          <Route path="/employee/organization"  element={<ProtectedRoute roles={ALL_ROLES}><OrganizationHierarchy /></ProtectedRoute>} />
        </Route>

        {/* UNAUTHORIZED */}
        <Route path="/unauthorized" element={<RootRedirect />} />

        {/* FALLBACK */}
        <Route path="*" element={<RootRedirect />} />

      </Routes>
    </Suspense>
  );
}

export default AppRoutes;