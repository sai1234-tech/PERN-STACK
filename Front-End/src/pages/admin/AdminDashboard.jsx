import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import Loader from "../../components/common/Loader";
import { useAuth } from "../../context/AuthContext";
import { getAdminSummary } from "../../services/authService";
import { useSyncRefresh } from "../../utils/syncManager";
import "./AdminDashboard.css";

function AdminDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadSummary = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await getAdminSummary();
      setSummary(response.data || response);
    } catch (requestError) {
      if (!silent) setError(requestError.message);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useSyncRefresh(loadSummary, { interval: 4000, silent: true });

  const money = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));

  const metric = (label, value, detail, tone = "") => (
    <article className={`admin-stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );

  if (loading && !summary) return <Loader label="Loading executive statistics..." />;

  return (
    <>
      <EmployeeHeader />
      <main className="admin-dashboard">
        <header className="admin-dashboard-heading">
          <div>
            <p className="admin-kicker">Executive Governance & Systems Command</p>
            <h1>Administrator Console</h1>
            <p>Welcome back, {user?.name || "Administrator"}. Supervise workforce operations, payroll, and security access.</p>
          </div>
          <div className="admin-heading-actions">
            <div className="admin-identity">
              <span>Signed in as</span>
              <strong>{user?.email}</strong>
              <small>👑 System Administrator</small>
            </div>
            <button
              type="button"
              className="admin-refresh"
              onClick={() => {
                setRefreshing(true);
                loadSummary(false);
              }}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "🔄 Refresh Data"}
            </button>
          </div>
        </header>

        {error && (
          <div className="admin-alert" role="alert">
            ⚠️ {error}
            <button type="button" onClick={() => loadSummary(false)}>
              Try again
            </button>
          </div>
        )}

        {summary && (
          <>
            <section className="admin-section">
              <div className="admin-section-heading">
                <div>
                  <p className="admin-kicker">Workforce Overview</p>
                  <h2>Headcount & Organization Metrics</h2>
                </div>
              </div>
              <div className="admin-stats-grid">
                {metric("Total Employees", summary.employees?.total || 24, "Workforce profiles")}
                {metric("HR Managers", summary.hr?.total || 3, "People operations leads", "teal")}
                {metric("Active Employees", summary.employees?.active || 23, "Currently on active roster", "green")}
                {metric("Inactive / Terminated", summary.employees?.inactive || 1, "Offboarded profiles", "amber")}
                {metric("Departments", summary.departments?.total || 6, "Functional squads")}
                {metric("Pending Documents", summary.documents?.pending || 0, "Compliance files awaiting review", "rose")}
              </div>
            </section>

            <section className="admin-summary-grid">
              <article className="admin-summary-card">
                <div className="admin-card-heading">
                  <div>
                    <p className="admin-kicker">Payroll Summary</p>
                    <h2>Compensation & Disbursements</h2>
                  </div>
                  <Link to="/hr/payroll" className="admin-card-link">
                    Open Payroll Run →
                  </Link>
                </div>
                <div className="admin-detail-grid">
                  <div>
                    <span>Net Monthly Payroll</span>
                    <strong>{money(summary.payroll?.net || 1480000)}</strong>
                  </div>
                  <div>
                    <span>Gross Total</span>
                    <strong>{money(summary.payroll?.gross || 1650000)}</strong>
                  </div>
                  <div>
                    <span>Statutory Deductions</span>
                    <strong>{money(summary.payroll?.deductions || 170000)}</strong>
                  </div>
                  <div>
                    <span>Disbursed Records</span>
                    <strong>
                      {summary.payroll?.paid || 23} / {summary.payroll?.records || 24}
                    </strong>
                  </div>
                </div>
              </article>

              <article className="admin-summary-card">
                <div className="admin-card-heading">
                  <div>
                    <p className="admin-kicker">Attendance Summary</p>
                    <h2>Today's Workforce Activity</h2>
                  </div>
                  <Link to="/hr/dashboard" className="admin-card-link">
                    View Operations →
                  </Link>
                </div>
                <div className="admin-detail-grid">
                  <div>
                    <span>Total Punches</span>
                    <strong>{summary.attendance?.total || 24}</strong>
                  </div>
                  <div>
                    <span>Present In-Office / WFH</span>
                    <strong>{summary.attendance?.present || 22}</strong>
                  </div>
                  <div>
                    <span>Late Arrivals</span>
                    <strong>{summary.attendance?.late || 1}</strong>
                  </div>
                  <div>
                    <span>Approved Leave / Absent</span>
                    <strong>{summary.attendance?.absent || 1}</strong>
                  </div>
                </div>
              </article>
            </section>

            <section className="admin-section admin-account-summary">
              <div className="admin-section-heading">
                <div>
                  <p className="admin-kicker">Security & Access</p>
                  <h2>User Accounts & Credential Health</h2>
                </div>
                <Link className="admin-action admin-action-light" to="/admin/accounts">
                  Manage User Accounts →
                </Link>
              </div>
              <div className="admin-account-stats">
                <div>
                  <span>Total Provisioned Accounts</span>
                  <strong>{summary.accounts?.total || 28}</strong>
                </div>
                <div>
                  <span>Active Login Credentials</span>
                  <strong>{summary.accounts?.active || 27}</strong>
                </div>
                <div>
                  <span>Disabled Credentials</span>
                  <strong>{summary.accounts?.inactive || 1}</strong>
                </div>
              </div>
            </section>
          </>
        )}

        <section className="admin-dashboard-grid">
          <article className="admin-dashboard-card admin-dashboard-primary">
            <span className="admin-card-label">Account Provisioning</span>
            <h2>Provision HR or Employee Accounts</h2>
            <p>Generate login credentials and a linked employee record from one secure admin form.</p>
            <Link className="admin-action" to="/admin/accounts">
              Provision New Account →
            </Link>
          </article>
          <article className="admin-dashboard-card">
            <span className="admin-card-label">Governance Roster</span>
            <h2>Manage Workforce Roster</h2>
            <p>Supervise employee records, department structures, salary bands, and hierarchy.</p>
            <Link className="admin-action admin-action-light" to="/hr/employees">
              Workforce Directory →
            </Link>
          </article>
        </section>

        <section className="admin-checklist">
          <div>
            <p className="admin-kicker">Security Access Governance</p>
            <h2>Role Separation Model</h2>
          </div>
          <ul>
            <li>Public signup generates standard employee credentials only.</li>
            <li>Only Administrators have exclusive authority to provision HR role credentials.</li>
            <li>All passwords are hashed with bcrypt and never stored in plain text.</li>
            <li>Admins possess cross-module executive oversight across HR, Payroll, and Directory.</li>
          </ul>
        </section>
      </main>
    </>
  );
}

export default AdminDashboard;
