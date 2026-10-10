# HRMS - Enterprise Human Resource Management System (Front-End)

A modern, responsive, role-based Human Resource Management System (HRMS) frontend web application built with **React 19**, **Vite**, and **React Router v7**. This platform streamlines workforce administration, attendance tracking, leave workflows, timesheet logging, document verification, and payroll management across three specialized organizational roles: **Admin**, **HR**, and **Employee**.

---

## 📑 Table of Contents

- [Overview](#overview)
- [Key Features & Role Workspaces](#key-features--role-workspaces)
  - [Administrator Portal](#administrator-portal)
  - [HR & People Operations](#hr--people-operations)
  - [Employee Self-Service](#employee-self-service)
- [Tech Stack](#tech-stack)
- [Project Architecture](#project-architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Available Scripts](#available-scripts)
- [Routing & Access Control Matrix](#routing--access-control-matrix)
- [API Integration & Authentication](#api-integration--authentication)
- [Code Review & Architecture Insights](#code-review--architecture-insights)
  - [Strengths](#strengths)
  - [Recommended Next Steps](#recommended-next-steps)
- [License](#license)

---

## 🌟 Overview

The HRMS Front-End delivers an intuitive, fast, and mobile-friendly interface designed to support day-to-day HR workflows and employee self-service. Built on top of React 19 and Vite for fast development and production builds, it features strict client-side role-based access control (RBAC), real-time attendance timer tracking, and automated PDF payslip generation using `jsPDF` and `html2canvas`.

---

## 🚀 Key Features & Role Workspaces

### 1. 🛡️ Administrator Portal
- **System Administration Dashboard**: High-level statistical breakdown of company metrics, active/inactive employee count, department distribution, and financial summaries.
- **Account Provisioning (`/admin/accounts`)**: Controlled account creation allowing administrators to provision HR and Employee accounts with linked employee profiles and initial credentials.
- **Initial Setup Wizard (`/admin/setup`)**: Secure bootstrapping for creating the primary root administrator on first deployment.

### 2. 👥 HR & People Operations
- **Workforce Directory (`/hr/employees`)**: Comprehensive employee directory with live search by name, employee code, department, designation, and employment status.
- **Department Management (`/hr/departments`)**: Full CRUD controls to add, edit, and organize organizational departments and teams.
- **Attendance Monitoring (`/hr/dashboard`)**: Organization-wide view of clock-in and clock-out logs with automated daily status tracking (`present`, `late`, `half-day`, `completed`).
- **Monthly Attendance Reports**: Aggregated reporting for HR records and monthly auditing.
- **Leave Request Management (`LeaveManagement`)**: Centralized queue to approve or reject pending leave requests with applicant notes and dates.
- **Timesheet Administration (`/hr/timesheets`)**: Review, audit, and approve weekly timesheets and hours logged by employees.
- **Payroll Management (`/hr/payroll`)**: Calculate, manage, and disburse employee compensation including basic salary, allowances, bonuses, PF, and tax deductions.
- **Document Verification (`/hr/documents`)**: Inspect and approve compliance documents (ID proofs, PAN, Aadhaar, degree certificates) uploaded by employees.

### 3. 👤 Employee Self-Service
- **Personalized Workspace (`/employee/dashboard`)**: Time-aware greeting (`Good morning / afternoon / evening`), live calendar date, quick stats, and announcements.
- **Interactive Attendance Tracker (`/employee/attendance`)**:
  - One-click **Clock In** and **Clock Out**.
  - Live ticking timer calculating elapsed working hours in real time.
  - Historical attendance log with status indicators.
- **Leave Management (`/employee/leaves`)**: Apply for leaves (Casual, Sick, Earned), track remaining leave balance, and review approval status.
- **Timesheet Submission (`/employee/timesheets`)**: Log daily work hours, tasks performed, and project notes.
- **Payroll & Payslip Viewer (`/employee/payroll`)**: Detailed monthly breakdown of earnings and deductions with **one-click PDF payslip export** powered by `jsPDF` and `html2canvas`.
- **Document Management (`/employee/documents`)**: Upload essential compliance documents via multi-part file upload with verification status badges.
- **Employee Profile (`/employee/profile`)**: View personal details, department, designation, contact info, and joining date.

---

## 🛠️ Tech Stack

| Layer / Library | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | [React 19](https://react.dev/) | Component-based UI library |
| **Build Tool & Dev Server** | [Vite 8](https://vitejs.dev/) | Lightning-fast HMR and bundling |
| **Routing** | [React Router v7](https://reactrouter.com/) | Declarative client-side routing & navigation |
| **Styling** | Vanilla CSS + `responsive.css` | Custom design system with mobile touch targets (`>=44px`) and safe-area insets |
| **PDF Generation** | `jspdf` + `html2canvas` | Dynamic client-side payslip and report rendering & download |
| **Linting** | [Oxlint](https://oxc.rs/) | High-speed Rust-based JavaScript/JSX linter |
| **State & Auth** | Context API (`AuthContext`) | Global user session management with `sessionStorage` |

---

## 📂 Project Architecture

```
Front-End/
├── public/                 # Static public assets
├── src/
│   ├── api/                # API interface definitions
│   ├── assets/             # Images, icons, and SVG illustrations
│   ├── components/         # Reusable UI component library
│   │   ├── auth/           # AuthLayout, InputField
│   │   ├── common/         # Generic UI (Loader, ErrorMessage)
│   │   ├── employee/       # AttendanceCard, LeaveBalance, RecentActivity, Header
│   │   └── hr/             # LeaveManagement, MonthlyAttendanceReport, PayrollTable
│   ├── context/            # React Contexts (AuthContext for auth & session persistence)
│   ├── hooks/              # Custom data-fetching & business logic hooks
│   │   ├── useAttendance.js
│   │   ├── useDocuments.js
│   │   ├── useEmployee.js
│   │   ├── useEmployeePayroll.js
│   │   ├── useHRDocuments.js
│   │   ├── useLeaves.js
│   │   ├── usePayroll.js
│   │   └── useTimesheets.js
│   ├── pages/              # Routed screen components
│   │   ├── admin/          # AdminDashboard, AccountManagement
│   │   ├── auth/           # Login, Signup, AdminSetup
│   │   ├── employee/       # Dashboard, Attendance, Leaves, Timesheets, Payroll, Documents, Profile
│   │   └── hr/             # Dashboard, DepartmentManagement, EmployeeManagement, TimesheetManagement, etc.
│   ├── routes/             # Route declarations & ProtectedRoute guard (AppRoutes.jsx)
│   ├── services/           # Backend HTTP services & API client (apiClient, authService, etc.)
│   ├── styles/             # Global stylesheets & responsive media queries (responsive.css)
│   ├── utils/              # Utility helpers (auth normalization, date formatting, input validation)
│   ├── App.jsx             # Top-level application component with providers
│   ├── index.css           # Global resets and root CSS variables
│   └── main.jsx            # Application entrypoint
├── .env.example            # Sample environment variables configuration
├── .gitignore              # Git ignore rules
├── .oxlintrc.json          # Oxlint configuration
├── index.html              # Vite HTML template
├── package.json            # Project dependencies and npm scripts
└── vite.config.js          # Vite configuration
```

---

## ⚙️ Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or later (Node 20+ recommended)
- **npm**: v9.0.0 or later (or yarn / pnpm)
- **HRMS Backend API**: Running locally (default: `http://localhost:3000/api`) or hosted.

### Installation

1. Clone the repository and navigate to the project root:
   ```bash
   git clone <repository-url>
   cd Front-End
   ```

2. Install project dependencies:
   ```bash
   npm install
   ```

### Environment Configuration

Create a `.env` file in the root directory (or copy from `.env.example`):

```bash
cp .env.example .env
```

Define the backend API URL:

```env
VITE_API_URL=http://localhost:3000/api
```

> **Note**: If `VITE_API_URL` is omitted, the application automatically defaults to `http://localhost:3000/api`.

### Available Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts the Vite local development server with hot-module replacement (HMR). |
| `npm run build` | Bundles the application for production into the `dist/` folder. |
| `npm run preview` | Locally previews the production build output from `dist/`. |
| `npm run lint` | Runs Oxlint across all files to detect code issues and rule violations. |

---

## 🔒 Routing & Access Control Matrix

Route protection is handled declaratively by `<ProtectedRoute roles={[...]} />` in [AppRoutes.jsx](file:///c:/Users/Admin/Desktop/HRMS/Front-End/src/routes/AppRoutes.jsx):

| Route Path | Allowed Roles | Description |
| :--- | :--- | :--- |
| `/login` | Public (Unauthenticated) | User login screen |
| `/signup` | Public (Unauthenticated) | New employee registration |
| `/admin/setup` | Public / Initial Setup | Bootstrap primary administrator |
| `/employee/dashboard` | `employee` | Employee home dashboard |
| `/employee/attendance` | `employee` | Daily clock-in/out and history |
| `/employee/leaves` | `employee` | Leave application and status |
| `/employee/timesheets` | `employee` | Timesheet hour submission |
| `/employee/payroll` | `employee`, `hr` | Salary view and payslip PDF download |
| `/employee/documents` | `employee` | Personal compliance document upload |
| `/employee/profile` | `employee` | Personal employee information |
| `/hr/dashboard` | `hr` | HR operational dashboard and metrics |
| `/hr/employees` | `hr` | Employee directory and status control |
| `/hr/departments` | `hr` | Department hierarchy management |
| `/hr/timesheets` | `hr` | Workforce timesheet review |
| `/hr/payroll` | `hr` | Compensation and salary processing |
| `/hr/documents` | `hr` | Employee document verification |
| `/admin/dashboard` | `admin` | System-wide statistics and overview |
| `/admin/accounts` | `admin` | Controlled user and HR account creation |
| `/unauthorized` | Any Authenticated | Access denied fallback screen |

---

## 🔌 API Integration & Authentication

- **HTTP Client**: Centralized in [apiClient.js](file:///c:/Users/Admin/Desktop/HRMS/Front-End/src/services/apiClient.js). Automatically injects the `Authorization: Bearer <token>` header on every authenticated request.
- **Session Expiry**: Handles HTTP 401 Unauthorized responses by clearing local session storage and redirecting the user back to `/login`.
- **Form Data Support**: Intelligently toggles between `application/json` and `multipart/form-data` when uploading files (such as document PDFs and identity proofs in `documentService.js`).
- **Role Normalization**: Uses `normalizeRole()` in [auth.js](file:///c:/Users/Admin/Desktop/HRMS/Front-End/src/utils/auth.js) to gracefully support varied backend payload structures (handles role objects, raw strings, capitalized titles like `"HR Manager"` or `"System Admin"`).

---

## 🔍 Code Review & Architecture Insights

During an in-depth audit of the codebase, the following key findings and recommendations were identified:

### ✅ Key Strengths
1. **Clean Modular Structure**: Code is well-divided across pages, specialized components, custom hooks, and standalone service layers.
2. **Robust Role-Based Routing**: Clean declarative route guard pattern prevents unauthorized access and provides seamless redirects.
3. **Session Safety**: Using `sessionStorage` over `localStorage` guarantees that sessions automatically expire upon closing the browser tab, preventing credential lingering on shared enterprise workstations.
4. **Client-Side PDF Generation**: Eliminates heavy server-side PDF compilation bottlenecks by leveraging `html2canvas` and `jsPDF` directly in the browser.
5. **Responsive Mobile Styles**: Thoughtfully implements safe-area insets (`env(safe-area-inset-top)`), touch targets (`>=44px`), and overflow safeguards.

### 💡 Recommended Enhancements
1. **Consolidate API Layers**:
   - The directory `src/api/` contains empty placeholder files (`api.js`, `attendanceApi.js`, `employeeApi.js`, `leaveApi.js`). All active network calls are handled in `src/services/`. These empty files can either be removed or refactored into the service layer to eliminate confusion.
2. **Refine Effect Dependencies (`Oxlint` Warnings)**:
   - In [AttendanceCard.jsx](file:///c:/Users/Admin/Desktop/HRMS/Front-End/src/components/employee/AttendanceCard.jsx), add `attendance?.workingHours` to the `useEffect` dependency array to eliminate the React Hook exhaustive-deps warning.
   - Separate `useAuth` into its own file or use a separate export pattern so that [AuthContext.jsx](file:///c:/Users/Admin/Desktop/HRMS/Front-End/src/context/AuthContext.jsx) exports only components, preserving Fast Refresh compatibility during development.
3. **Global Notification System**:
   - Currently, notices and alerts are managed via local component state. Adding a lightweight toast notification provider (e.g. for leave approval, account creation, or clock-in success) would enhance feedback responsiveness across all pages.
4. **Error Boundary**:
   - Adding a top-level React Error Boundary will prevent the entire application from crashing in the event of unexpected runtime data issues.

---

## 📄 License

This project is proprietary and confidential. Developed for internal organization workforce management.
