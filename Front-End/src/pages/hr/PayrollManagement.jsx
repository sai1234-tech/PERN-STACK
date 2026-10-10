import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import Loader from "../../components/common/Loader";
import ErrorMessage from "../../components/common/ErrorMessage";
import PayrollTable from "../../components/hr/PayrollTable";
import { useHRPayroll } from "../../hooks/usePayroll";
import { payrollPeriod } from "../../services/payrollService";
import "../../styles/employee/payroll.css";
import { useAuth } from "../../context/AuthContext";
import { normalizeRole } from "../../utils/auth";

const current = new Date();
const initialPeriod = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
const employeeName = (record) => `${record.employee?.firstName || record.firstName || ""} ${record.employee?.lastName || record.lastName || ""}`.trim() || record.employee?.name || record.employee?.email || "Employee";
const employeeId = (record) => record.employee?._id || record.employeeId || record._id;
const monthlySalary = (record) => Number(record.monthlySalary || record.monthly || record.employee?.monthlySalary || record.employee?.salary || record.employee?.employment?.salary || 0);

function PayrollManagementContent() {
  const [period, setPeriod] = useState(initialPeriod);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [salary, setSalary] = useState("");
  const [year, month] = period.split("-");
  const filters = useMemo(() => ({ month: payrollPeriod(month, year) }), [month, year]);
  const { records, loading, error, reload, generate, updateSalary } = useHRPayroll(filters);
  const visibleRecords = records.filter((record) => employeeName(record).toLowerCase().includes(search.toLowerCase()));
  const totalNet = records.reduce((total, record) => total + Number(record.netPay || record.netSalary || 0), 0);

  const handleGenerate = async () => {
    setGenerating(true); setNotice(""); setActionError("");
    try { await generate({ month: payrollPeriod(month, year) }); setNotice(`Payroll generated for ${period}.`); }
    catch (requestError) { setActionError(requestError.message); }
    finally { setGenerating(false); }
  };

  const handleSalary = async (event) => {
    event.preventDefault();
    if (!editing || Number(salary) <= 0) return;
    setActionError("");
    try {
      await updateSalary(employeeId(editing), { salary: Number(salary), effectiveDate: new Date().toISOString() });
      setNotice(`Salary updated for ${employeeName(editing)}.`); setEditing(null);
    } catch (requestError) { setActionError(requestError.message); }
  };

  return <>
    <EmployeeHeader />
    <main className="employee-page payroll-page">
      <header className="payroll-heading"><div><p className="page-kicker">HR Administration</p><h1>Payroll control</h1><p>Generate monthly payroll, review salary records, and maintain compensation.</p></div><label>Pay period<input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></label></header>
      {loading ? <Loader /> : error ? <ErrorMessage message={error} onRetry={reload} /> : <>
        <section className="payroll-summary"><div className="payroll-hero"><span>Payroll period</span><strong>{period}</strong><small>{records.length} employee records</small></div><div className="payroll-stat"><span>Total net payroll</span><strong>{money(totalNet)}</strong><small>Current period · INR</small></div><div className="payroll-stat"><span>Run status</span><strong>{records.length ? "Generated" : "Pending"}</strong><small>{records.length ? "Ready for review" : "Generate to publish payslips"}</small></div></section>
        {actionError && <p className="form-error" role="alert">{actionError}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
        <section className="payroll-toolbar"><div><h2>Payroll register</h2><p>Salary and monthly payroll values for the selected period.</p></div><div className="payroll-toolbar-actions"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee" aria-label="Search payroll employees" /><button type="button" onClick={handleGenerate} disabled={generating}>{generating ? "Generating..." : "Generate payroll"}</button></div></section>
        <section className="payroll-table-panel"><PayrollTable records={visibleRecords} onUpdateSalary={(record) => { setEditing(record); setSalary(monthlySalary(record) || ""); }} /></section>
      </>}
    </main>
    {editing && <div className="payroll-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><form className="payroll-modal" onSubmit={handleSalary}><div className="payroll-modal-heading"><div><span className="page-kicker">Compensation</span><h2>Update salary</h2><p>{employeeName(editing)}</p></div><button type="button" className="modal-close" aria-label="Close update salary dialog" onClick={() => setEditing(null)}>×</button></div><label className="salary-field">Monthly salary<input type="number" min="0" step="0.01" inputMode="decimal" value={salary} onChange={(event) => setSalary(event.target.value)} required /><small>Enter the employee's gross monthly salary in INR.</small></label><p className="salary-preview">Annual salary preview <strong>{money(Number(salary) * 12)}</strong></p><div className="form-actions"><button type="submit">Save salary</button><button type="button" className="quiet-action" onClick={() => setEditing(null)}>Cancel</button></div></form></div>}
  </>;
}

function PayrollManagement() {
  const { user } = useAuth();
  const role = normalizeRole(user);
  if (role === "employee" || role === "manager") {
    return <Navigate to="/employee/payroll" replace />;
  }
  return <PayrollManagementContent />;
}

export default PayrollManagement;
