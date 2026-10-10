# Quadratic Systems Inc — HRMS End-to-End Architecture & Flow Documentation

This document provides a comprehensive, component-by-component architectural blueprint of the **Quadratic Systems Inc** Human Resource Management System (HRMS) frontend. It covers user authentication, role-based route guards, and the complete user journeys for both **Employees** and **HR / People Operations Managers**.

---

## 1. System Overview & Technology Stack

- **Framework**: React 18 with Vite
- **Routing**: React Router v6 (`BrowserRouter`, `Routes`, `Route`, `Navigate`, `NavLink`)
- **State Management**: React Context API (`AuthContext`), React Custom Hooks (`useAttendance`, `useEmployeePayroll`)
- **Styling Architecture**: Semantic Vanilla CSS with custom design tokens, glassmorphism, responsive breakpoints, and dedicated print stylesheet engines (No Tailwind)
- **Document Export Engine**: `html2canvas` and `jspdf` for pixel-perfect A4 legal payslip generation
- **Authentication**: JWT Bearer token authentication with session synchronization in `sessionStorage`
- **Backend API**: Node.js / Express REST API running on `http://localhost:3000/api`

---

## 2. End-to-End Authentication & Routing Flow

```mermaid
flowchart TD
    Start([User visits Application]) --> RootRedirect{Path: /}
    RootRedirect --> LoginRoute[/login]

    subgraph AuthLayer [Authentication & Role Resolution]
        LoginRoute --> LoginForm[Login.jsx Form Submission]
        LoginForm --> APILogin[POST /api/auth/login]
        APILogin -->|Success| SaveSession[Save Token & User to sessionStorage]
        SaveSession --> NormalizeRole[normalizeRole helper]
        NormalizeRole --> RoleCheck{User Role}
    end

    RoleCheck -->|employee| EmpDash[/employee/dashboard]
    RoleCheck -->|hr| HRDash[/hr/dashboard]
    RoleCheck -->|admin| AdminDash[/admin/dashboard]

    subgraph EmployeePortal [Employee Portal /employee/*]
        EmpDash --> EmpAtt[/employee/attendance]
        EmpDash --> EmpLeaves[/employee/leaves]
        EmpDash --> EmpTime[/employee/timesheets]
        EmpDash --> EmpPay[/employee/payroll]
        EmpDash --> EmpDocs[/employee/documents]
        EmpDash --> EmpProfile[/employee/profile]
    end

    subgraph HROperations [HR Operations Portal /hr/*]
        HRDash --> HREmp[/hr/employees]
        HRDash --> HRDept[/hr/departments]
        HRDash --> HRTime[/hr/timesheets]
        HRDash --> HRPay[/hr/payroll]
        HRDash --> HRDocs[/hr/documents]
        HRDash --> HRLeaveTab[Leave Approvals Tab]
        HRDash --> HRAttTab[Monthly Attendance Intelligence Tab]
        HRDash --> HRPersonalPay[/employee/payroll]
    end

    subgraph AdminPortal [System Admin Portal /admin/*]
        AdminDash --> AdminAccounts[/admin/accounts]
    end

    subgraph RouteGuards [Security & Protection]
        ProtectedRoute[ProtectedRoute Component]
        ProtectedRoute -->|Token Missing| RedirectLogin[/login]
        ProtectedRoute -->|Role Disallowed| RedirectUnauth[/unauthorized]
    end
```

---

## 3. Global Authentication & Session Management

### 3.1 `AuthContext.jsx`
- **File Location**: [src/context/AuthContext.jsx](file:///c:/Users/Admin/Desktop/HRMS/Front-End/src/context/AuthContext.jsx)
- **Primary State**:
  - `user`: Authenticated user object (ID, email, name, role, department).
  - `employee`: Associated employee profile record (job title, compensation, join date).
  - `loading`: Boolean indicating whether initial session verification is in progress.
- **Key Methods**:
  - `login(email, password)`: Calls `authService.loginUser`, synchronizes `sessionStorage` with token and user profile, and normalizes role.
  - `signup(userData)`: Registers a new user and persists session.
  - `logout()`: Clears `hrms_token`, `hrms_user`, and `hrms_employee` from `sessionStorage` and resets state to `null`.
  - `restoreSession()`: On initial app mount, checks `sessionStorage.getItem("hrms_token")` and calls `GET /api/auth/me` to refresh user credentials.

### 3.2 Role Normalization (`src/utils/auth.js`)
Normalizes flexible backend role strings into one of three standard application roles:
```javascript
export function normalizeRole(user) {
  const rawRole = user?.role?.name || user?.role?.key || user?.role || "employee";
  const role = String(rawRole).trim().toLowerCase();
  if (["admin", "administrator", "system admin"].includes(role)) return "admin";
  if (["hr", "human resources", "hr manager", "people operations"].includes(role)) return "hr";
  return "employee";
}
```

### 3.3 Route Protection (`src/routes/AppRoutes.jsx`)
Every protected route is wrapped inside the `<ProtectedRoute roles={[...]} />` higher-order component:
1. If `loading === true`: Renders a loading placeholder.
2. If `!user`: Redirects unauthenticated traffic to `/login`.
3. If user's normalized role is not in `roles`: Redirects to `/unauthorized`.
4. Otherwise: Renders the child page component.

---

## 4. Universal Header Architecture (`EmployeeHeader.jsx`)

- **Component**: [EmployeeHeader.jsx](file:///c:/Users/Admin/Desktop/HRMS/Front-End/src/components/employee/EmployeeHeader.jsx)
- **Stylesheet**: [EmployeeHeader.css](file:///c:/Users/Admin/Desktop/HRMS/Front-End/src/components/employee/EmployeeHeader.css)
- **Features**:
  1. **Corporate Identity**:
     - **Logo Pod**: Sleek `QSI` gradient badge with 3D elevation.
     - **Company Name**: **Quadratic Systems Inc**.
     - **Dynamic Portal Badge**: Role-aware pill indicating *Employee Self-Service*, *People Operations*, or *Executive Admin*.
  2. **Role-Aware Primary Navigation**:
     - Automatically renders the relevant icon-embellished links depending on whether the logged-in user is an Employee, HR Manager, or Admin.
  3. **Live Office Clock**:
     - Real-time time capsule updating in Indian Standard Time (`IST (UTC+5:30)`).
  4. **System Notifications Center**:
     - Interactive bell with unread badge counter (`🔔 3`) and animated dropdown drawer displaying corporate announcements, payroll notifications, and approval alerts.
  5. **User Profile Capsule**:
     - Two-letter initials avatar, employee display name, and active status indicator.
  6. **Sign Out Action**:
     - Quick-access sign out button executing session termination and redirecting to login.

---

## 5. Employee Journey & Component Map (`/employee/*`)

```
/employee
├── /dashboard     -> EmployeeDashboard.jsx (Attendance Punch, Balances, Quick Stats)
├── /attendance    -> EmployeeAttendance.jsx (Full Punch History, Daily Status)
├── /leaves        -> EmployeeLeaves.jsx (Leave Balance, Request Form, Request History)
├── /timesheets    -> EmployeeTimesheets.jsx (Weekly Task Logging, Project Hours)
├── /payroll       -> EmployeePayroll.jsx (Payslip, CTC Structure, Tax Intelligence)
├── /documents     -> EmployeeDocuments.jsx (Personal Dossier, Proof Uploads)
└── /profile       -> EmployeeProfile.jsx (Personal & Employment Records)
```

### 5.1 Employee Dashboard (`EmployeeDashboard.jsx`)
- **Route**: `/employee/dashboard`
- **Guarded By**: `ProtectedRoute roles={["employee"]}`
- **Key Child Components**:
  - `AttendanceCard.jsx`: Interactive Clock-In / Clock-Out widget. Displays live timestamps, current session duration, and triggers `POST /api/attendance/clock-in` or `POST /api/attendance/clock-out`.
  - `LeaveBalance.jsx`: High-level summary of remaining Paid, Sick, and Casual leaves.
  - `AttendanceSummary.jsx`: Monthly presence, late arrival, and absence counters.
  - `RecentActivity.jsx`: Audit trail of user's recent punches and leave status changes.

### 5.2 Attendance History (`EmployeeAttendance.jsx`)
- **Route**: `/employee/attendance`
- **Data Hook**: `useAttendance.js` calling `GET /api/attendance/my`
- **Capabilities**:
  - Displays summary metrics: Total Records, Present Days, Late Days, and Absences.
  - Table of punch history showing Date, Clock-In time, Clock-Out time, Total Working Hours, and Attendance Status chips.

### 5.3 Leave Management (`EmployeeLeaves.jsx`)
- **Route**: `/employee/leaves`
- **API Endpoints**: `GET /api/leaves/my`, `POST /api/leaves`, `PATCH /api/leaves/:id/cancel`
- **Capabilities**:
  - Live Leave Balance Cards (e.g., Casual Leave, Earned Leave, Sick Leave).
  - Leave Request Form with Leave Type dropdown, Start Date picker, End Date picker, and Reason text area.
  - Leave Request History table with real-time status badges (*Pending*, *Approved*, *Rejected*) and an inline **Cancel** button for pending requests.

### 5.4 Timesheets Logging (`EmployeeTimesheets.jsx`)
- **Route**: `/employee/timesheets`
- **API Endpoints**: `GET /api/timesheets/my`, `POST /api/timesheets`
- **Capabilities**:
  - Weekly timesheet calendar view.
  - Log project hours, billable task breakdown, and submission for manager approval.

### 5.5 Next-Level Payroll & Compensation (`EmployeePayroll.jsx`)
- **Route**: `/employee/payroll` (Accessible to both `employee` and `hr`)
- **Stylesheet**: [payroll.css](file:///c:/Users/Admin/Desktop/HRMS/Front-End/src/styles/employee/payroll.css)
- **Capabilities**:
  - **Executive Hero Banner**: Dynamic period selector (`‹ Prev`, Month Picker, `› Next`, `Current Month`) and direct **Print** / **Download PDF** actions.
  - **4 Real-Time KPI Cards**: Net Take-Home Pay (% of Gross), Gross Monthly Earnings, Total Deductions (PF, PT, TDS), and Annual CTC Package.
  - **3 Segmented Tabs**:
    1. **Official Payslip & Statement**: **Quadratic Systems Inc** branding, address at *5A1 Melange Towers, Madhapur, Hyderabad*, 8-point metadata grid, side-by-side Earnings & Deductions tables, Net Pay highlight card, Net Amount in Words converter (*e.g., "Eighty Two Thousand Four Hundred Rupees Only"*), cryptographic verification seal (`QSI-PAY-2026...`), authorized signatures, and legal disclaimer.
    2. **CTC Architecture & Salary Structure**: Visual component percentage rail (Basic 50%, HRA 25%, Flexible 15%, Retirement 10%) and detailed monthly/annual breakdown tiles.
    3. **Tax Withholding & YTD Analysis**: CBDT New Tax Regime (*Section 115BAC*) slabs, Standard Deduction (₹75,000), Section 87A rebate intelligence, and YTD cumulative ledger.

### 5.6 Personal Document Dossier (`EmployeeDocuments.jsx`)
- **Route**: `/employee/documents`
- **API Endpoints**: `GET /api/documents/my`, `POST /api/documents/upload`
- **Capabilities**:
  - Vault categories: Identification/KYC, Tax Declarations, Education Credentials, and Employment Contracts.
  - Drag-and-drop document upload with format and file size validation.

### 5.7 Employee Profile (`EmployeeProfile.jsx`)
- **Route**: `/employee/profile`
- **Capabilities**:
  - View personal data, primary contact email, phone number, residential address, emergency contacts, and assigned department/designation.

---

## 6. HR / People Operations Journey (`/hr/*`)

```
/hr
├── /dashboard     -> HRDashboard.jsx (Command Center, Live Attendance, Leaves, Monthly Report)
├── /employees     -> EmployeeManagement.jsx (Employee Directory, Add Staff Form, Profile Dossier)
├── /departments   -> DepartmentManagement.jsx (Department Cards, Add/Edit/Delete, Manager Assignment)
├── /timesheets    -> TimesheetManagement.jsx (Batch Review, Approval Workflow, Rejection Dialog)
├── /payroll       -> PayrollManagement.jsx (Monthly Payroll Run Engine, Salary Adjustments)
├── /documents     -> DocumentManagement.jsx (Company Vault, Employee Verification Workflow)
└── /employee/payroll -> EmployeePayroll.jsx (Personal Compensation View for HR Staff)
```

### 6.1 HR Executive Command Center (`HRDashboard.jsx`)
- **Route**: `/hr/dashboard`
- **Guarded By**: `ProtectedRoute roles={["hr"]}`
- **Sub-Tabs**:
  1. **Tab 1: Live Attendance & Employee Directory**:
     - 4 KPI Metric Cards: Active Headcount, Today's Presence Rate, Pending Leave Approvals, Open Timesheets.
     - Real-time attendance feed showing check-ins, check-outs, and late arrivals.
  2. **Tab 2: Leave Management & Approvals (`LeaveManagement.jsx`)**:
     - Displays all incoming leave requests from employees across all departments.
     - Features 4 summary KPI cards (*Pending Requests*, *Approved This Month*, *Rejected*, *Total Requests*).
     - Allows HR managers to **Approve** or **Reject** with inline status updates and balance verification.
  3. **Tab 3: Monthly Attendance Intelligence (`MonthlyAttendanceReport.jsx`)**:
     - Dual-view reporting engine: **Monthly Summary View** and **Day-by-Day Calendar Grid**.
     - Department and status filtering (All, Present, Late, Half-Day, Absent).
     - Single-click **CSV Export** generating payroll-ready attendance reports.
     - Interactive **Employee Drilldown Modal** inspecting exact daily punch logs and working hours.

### 6.2 Employee Directory & Lifecycle (`EmployeeManagement.jsx`)
- **Route**: `/hr/employees`
- **Layout**: Balanced dual-pane layout:
  - **Left Pane**: Add Employee Form with full validation (First/Last name, Email, Department with datalist autocomplete, Designation, Joining Date, Starting Base Salary).
  - **Right Pane**: Interactive Employee Directory with search input, department filter pills, and employee cards.
- **4 Metric Cards**: Total Staff, Full-Time Employees, Active Departments, New Joiners (Last 30 Days).
- **Profile Dossier Modal**: Clicking any employee card opens a full corporate dossier with employment timeline, compensation, and contact details.

### 6.3 Department Directory (`DepartmentManagement.jsx`)
- **Route**: `/hr/departments`
- **Capabilities**:
  - Add Department Form with Name, Code, Description, and Head of Department / Manager assignment.
  - Department Directory Grid: Cards displaying department name, unique code, active employee count, designated manager, and direct **Edit** and **Delete** actions.

### 6.4 Timesheet Approvals (`TimesheetManagement.jsx`)
- **Route**: `/hr/timesheets`
- **Capabilities**:
  - 4 KPI Cards: Pending Review, Approved Hours, Rejected Logs, Total Logged Hours.
  - **Batch Actions**: Multi-select checkboxes to approve multiple timesheets simultaneously.
  - **Rejection Reason Modal**: Opens a modal to input constructive feedback before rejecting a timesheet.
  - Project and client filters for audit reviews.

### 6.5 Payroll Management Engine (`PayrollManagement.jsx`)
- **Route**: `/hr/payroll`
- **Capabilities**:
  - Monthly payroll generation trigger (`POST /api/payroll/generate`).
  - Employee compensation table with base salary adjustments (`PATCH /api/payroll/employees/:id/salary`).
  - Payroll disbursement status tracking.

### 6.6 Enterprise Document Vault (`DocumentManagement.jsx`)
- **Route**: `/hr/documents`
- **Capabilities**:
  - Company Policy Repository: Upload and publish employee handbooks, NDA templates, and health insurance guidelines.
  - Employee Document Verification: Review pending employee KYC/tax documents, inspect previews, and **Verify** or **Reject** with reason notes.
  - Request Document Modal: Send automated notifications requesting specific documents from employees.

---

## 7. System Administration Journey (`/admin/*`)

```
/admin
├── /dashboard     -> AdminDashboard.jsx (System Metrics, Active Sessions, Role Distribution)
└── /accounts      -> AccountManagement.jsx (User Provisioning, Password Resets, Role Elevation)
```

- **Guarded By**: `ProtectedRoute roles={["admin"]}`
- **Capabilities**:
  - Account provisioning for HR Managers, Department Heads, and System Admins.
  - Account suspension, security lockouts, and credential resets.

---

## 8. Complete Route & Component Matrix

| Route URL | Primary Page Component | Authorized Roles | Header Navigation | Key Backend Endpoints |
| :--- | :--- | :--- | :--- | :--- |
| `/login` | `Login.jsx` | Public | None | `POST /api/auth/login` |
| `/signup` | `Signup.jsx` | Public | None | `POST /api/auth/signup` |
| `/admin/setup` | `AdminSetup.jsx` | Public | None | `POST /api/auth/setup-admin` |
| `/employee/dashboard` | `EmployeeDashboard.jsx` | `employee` | Overview | `GET /api/attendance/today`, `GET /api/leaves/balance` |
| `/employee/attendance` | `EmployeeAttendance.jsx` | `employee` | Attendance | `GET /api/attendance/my` |
| `/employee/leaves` | `EmployeeLeaves.jsx` | `employee` | Leaves | `GET /api/leaves/my`, `POST /api/leaves` |
| `/employee/timesheets` | `EmployeeTimesheets.jsx` | `employee` | Timesheets | `GET /api/timesheets/my`, `POST /api/timesheets` |
| `/employee/payroll` | `EmployeePayroll.jsx` | `employee`, `hr` | Payroll / My Comp. | `GET /api/payroll/my/salary`, `GET /api/payroll/my/payslip` |
| `/employee/documents` | `EmployeeDocuments.jsx` | `employee` | Documents | `GET /api/documents/my`, `POST /api/documents/upload` |
| `/employee/profile` | `EmployeeProfile.jsx` | `employee` | Profile | `GET /api/employees/me` |
| `/hr/dashboard` | `HRDashboard.jsx` | `hr` | HR Command | `GET /api/attendance/today/all`, `GET /api/leaves` |
| `/hr/employees` | `EmployeeManagement.jsx` | `hr` | Employees | `GET /api/employees`, `POST /api/employees` |
| `/hr/departments` | `DepartmentManagement.jsx` | `hr` | Departments | `GET /api/departments`, `POST /api/departments` |
| `/hr/timesheets` | `TimesheetManagement.jsx` | `hr` | Timesheets | `GET /api/timesheets`, `PATCH /api/timesheets/approve` |
| `/hr/payroll` | `PayrollManagement.jsx` | `hr` | Payroll Runs | `GET /api/payroll`, `POST /api/payroll/generate` |
| `/hr/documents` | `DocumentManagement.jsx` | `hr` | Documents | `GET /api/documents`, `PATCH /api/documents/:id/verify` |
| `/admin/dashboard` | `AdminDashboard.jsx` | `admin` | Admin Command | `GET /api/auth/admin-summary` |
| `/admin/accounts` | `AccountManagement.jsx` | `admin` | User Accounts | `GET /api/auth/accounts`, `POST /api/auth/accounts` |
| `/unauthorized` | Inline Fallback | Any authenticated | None | None |

---

## 9. Verification & Quality Assurance

- **Build Pipeline**: Verified with `npm run build` (Vite v8.2.2). Output produced 0 syntax or module resolution errors.
- **Styling Discipline**: 100% Vanilla CSS conforming to enterprise accessibility standards, interactive hover states, micro-animations, and unclipped print media layout.
- **Session Durability**: Seamless recovery of JWT bearer tokens and user context on hard browser refresh via `sessionStorage` and `getCurrentUser`.
