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
const employeeId = (record) => record?.employee?._id || record?.employee?.id || record?.employeeId || record?.id || record?._id;
const monthlySalary = (record) => Number(record.monthlySalary || record.monthly || record.employee?.monthlySalary || record.employee?.salary || record.employee?.employment?.salary || 0);

function PayrollManagementContent() {
  const [period, setPeriod] = useState(initialPeriod);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [salary, setSalary] = useState("");
  const [editingPayroll, setEditingPayroll] = useState(null);
  const [payrollForm, setPayrollForm] = useState({
    basicSalary: "",
    allowances: "",
    bonus: "",
    tax: "",
    pf: "",
    deduction: "",
    status: "generated",
    syncBaseSalary: true,
  });

  const [year, month] = period.split("-");
  const filters = useMemo(() => ({ month: payrollPeriod(month, year) }), [month, year]);
  const { records, loading, error, reload, generate, updateSalary, updateRecord } = useHRPayroll(filters);
  const visibleRecords = records.filter((record) => employeeName(record).toLowerCase().includes(search.toLowerCase()));
  const totalNet = records.reduce((total, record) => total + Number(record.netPay || record.netSalary || 0), 0);

  const handleGenerate = async () => {
    setGenerating(true); setNotice(""); setActionError("");
    try {
      await generate({ month: payrollPeriod(month, year) });
      setNotice(`Payroll generated for ${period}.`);
      window.dispatchEvent(new CustomEvent("hrms_data_updated", { detail: { category: "payroll" } }));
      window.dispatchEvent(new CustomEvent("hrms:data_changed"));
    }
    catch (requestError) { setActionError(requestError.message); }
    finally { setGenerating(false); }
  };

  const handleSalary = async (event) => {
    event.preventDefault();
    if (!editing || Number(salary) <= 0) return;
    setActionError("");
    try {
      const targetEmpId = employeeId(editing);
      await updateSalary(targetEmpId, {
        salary: Number(salary),
        month: period,
        effectiveDate: new Date().toISOString(),
      });
      setNotice(`Salary updated for ${employeeName(editing)}.`);
      setEditing(null);
      window.dispatchEvent(new CustomEvent("hrms_data_updated", { detail: { category: "payroll" } }));
      window.dispatchEvent(new CustomEvent("hrms:data_changed"));
    } catch (requestError) {
      setActionError(requestError.message);
    }
  };

  const handleOpenEditPayroll = (record) => {
    const mSalary = monthlySalary(record);
    const basic = Number(record.basicSalary ?? Math.round(mSalary * 0.5));
    const allow = Number(record.allowances ?? Math.round(mSalary * 0.5));
    const bonus = Number(record.bonus ?? 0);
    const tax = Number(record.tax ?? (mSalary > 0 ? 200 : 0));
    const pf = Number(record.pf ?? (mSalary > 0 ? Math.min(Math.round(basic * 0.12), 3600) : 0));
    const ded = Number(record.deduction ?? record.otherDeductions ?? Math.round(mSalary * 0.08));
    const status = record.status || "generated";

    setEditingPayroll(record);
    setPayrollForm({
      basicSalary: basic || "",
      allowances: allow || "",
      bonus: bonus || "",
      tax: tax || "",
      pf: pf || "",
      deduction: ded || "",
      status: status,
      syncBaseSalary: true,
    });
  };

  const handleAutoSplit = () => {
    if (!editingPayroll) return;
    const mSalary = monthlySalary(editingPayroll);
    if (!mSalary) return;
    const basic = Math.round(mSalary * 0.5);
    const allow = Math.round(mSalary * 0.5);
    const pf = Math.min(Math.round(basic * 0.12), 3600);
    const tax = 200;
    const ded = Math.round(mSalary * 0.08);

    setPayrollForm((prev) => ({
      ...prev,
      basicSalary: basic,
      allowances: allow,
      tax,
      pf,
      deduction: ded,
    }));
  };

  const handleSavePayroll = async (event) => {
    event.preventDefault();
    if (!editingPayroll) return;
    setActionError("");
    setNotice("");
    try {
      const basic = Number(payrollForm.basicSalary || 0);
      const allow = Number(payrollForm.allowances || 0);
      const bonus = Number(payrollForm.bonus || 0);
      const tax = Number(payrollForm.tax || 0);
      const pf = Number(payrollForm.pf || 0);
      const ded = Number(payrollForm.deduction || 0);

      const gross = basic + allow + bonus;
      const totalDed = tax + pf + ded;
      const net = Math.max(0, gross - totalDed);
      const targetEmpId = employeeId(editingPayroll);

      const payload = {
        id: editingPayroll._id || editingPayroll.id,
        employeeId: targetEmpId,
        month: payrollPeriod(month, year),
        basicSalary: basic,
        allowances: allow,
        bonus: bonus,
        tax: tax,
        pf: pf,
        deduction: ded,
        grossSalary: gross,
        totalDeductions: totalDed,
        netSalary: net,
        status: payrollForm.status,
        updateBaseSalary: true,
      };

      await updateRecord(editingPayroll._id || editingPayroll.id || targetEmpId, payload);

      if (targetEmpId && gross > 0) {
        try {
          await updateSalary(targetEmpId, {
            salary: gross,
            month: payrollPeriod(month, year),
            effectiveDate: new Date().toISOString(),
          });
        } catch (e) {
          // handled if updateRecord already synced
        }
      }

      setNotice(`Payroll record and base salary updated successfully for ${employeeName(editingPayroll)}.`);
      setEditingPayroll(null);
      window.dispatchEvent(new CustomEvent("hrms_data_updated", { detail: { category: "payroll" } }));
      window.dispatchEvent(new CustomEvent("hrms:data_changed"));
    } catch (requestError) {
      setActionError(requestError.message);
    }
  };

  const currentGross = Number(payrollForm.basicSalary || 0) + Number(payrollForm.allowances || 0) + Number(payrollForm.bonus || 0);
  const currentDeductions = Number(payrollForm.tax || 0) + Number(payrollForm.pf || 0) + Number(payrollForm.deduction || 0);
  const currentNet = Math.max(0, currentGross - currentDeductions);

  return <>
    <EmployeeHeader />
    <main className="employee-page payroll-page">
      <header className="payroll-heading"><div><p className="page-kicker">HR Administration</p><h1>Payroll control</h1><p>Generate monthly payroll, review salary records, and maintain compensation.</p></div><label>Pay period<input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></label></header>
      {loading ? <Loader /> : error ? <ErrorMessage message={error} onRetry={reload} /> : <>
        <section className="payroll-summary"><div className="payroll-hero"><span>Payroll period</span><strong>{period}</strong><small>{records.length} employee records</small></div><div className="payroll-stat"><span>Total net payroll</span><strong>{money(totalNet)}</strong><small>Current period · INR</small></div><div className="payroll-stat"><span>Run status</span><strong>{records.length ? "Generated" : "Pending"}</strong><small>{records.length ? "Ready for review" : "Generate to publish payslips"}</small></div></section>
        {actionError && <p className="form-error" role="alert">{actionError}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
        <section className="payroll-toolbar"><div><h2>Payroll register</h2><p>Salary and monthly payroll values for the selected period.</p></div><div className="payroll-toolbar-actions"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee" aria-label="Search payroll employees" /><button type="button" onClick={handleGenerate} disabled={generating}>{generating ? "Generating..." : "Generate payroll"}</button></div></section>
        <section className="payroll-table-panel">
          <PayrollTable
            records={visibleRecords}
            onEditPayroll={handleOpenEditPayroll}
            onUpdateSalary={(record) => { setEditing(record); setSalary(monthlySalary(record) || ""); }}
          />
        </section>
      </>}
    </main>

    {/* Full Payroll Edit Modal for HR */}
    {editingPayroll && (
      <div
        className="payroll-modal-backdrop"
        role="presentation"
        onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingPayroll(null); }}
      >
        <form className="payroll-modal edit-payroll-modal" onSubmit={handleSavePayroll}>
          <div className="payroll-modal-heading">
            <div>
              <span className="page-kicker">Payroll Administration</span>
              <h2>Edit employee payroll</h2>
              <p>{employeeName(editingPayroll)} · {period}</p>
            </div>
            <button
              type="button"
              className="modal-close"
              aria-label="Close edit payroll dialog"
              onClick={() => setEditingPayroll(null)}
            >
              ×
            </button>
          </div>

          <div className="payroll-edit-grid">
            <div className="payroll-edit-col">
              <h4 className="payroll-edit-col-title">Earnings components (₹)</h4>
              <div className="payroll-edit-field">
                <label htmlFor="edit-basic">Basic Salary *</label>
                <input
                  id="edit-basic"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={payrollForm.basicSalary}
                  onChange={(e) => setPayrollForm({ ...payrollForm, basicSalary: e.target.value })}
                />
              </div>
              <div className="payroll-edit-field">
                <label htmlFor="edit-allowances">Allowances / HRA</label>
                <input
                  id="edit-allowances"
                  type="number"
                  min="0"
                  step="1"
                  value={payrollForm.allowances}
                  onChange={(e) => setPayrollForm({ ...payrollForm, allowances: e.target.value })}
                />
              </div>
              <div className="payroll-edit-field">
                <label htmlFor="edit-bonus">Bonus / Incentive</label>
                <input
                  id="edit-bonus"
                  type="number"
                  min="0"
                  step="1"
                  value={payrollForm.bonus}
                  onChange={(e) => setPayrollForm({ ...payrollForm, bonus: e.target.value })}
                />
              </div>
              {monthlySalary(editingPayroll) > 0 && (
                <button
                  type="button"
                  className="btn-quick-salary"
                  style={{ alignSelf: "flex-start", marginTop: "4px" }}
                  onClick={handleAutoSplit}
                >
                  ⚡ Auto 50/50 Split from Base
                </button>
              )}
            </div>

            <div className="payroll-edit-col">
              <h4 className="payroll-edit-col-title">Deductions components (₹)</h4>
              <div className="payroll-edit-field">
                <label htmlFor="edit-pf">Provident Fund (PF)</label>
                <input
                  id="edit-pf"
                  type="number"
                  min="0"
                  step="1"
                  value={payrollForm.pf}
                  onChange={(e) => setPayrollForm({ ...payrollForm, pf: e.target.value })}
                />
              </div>
              <div className="payroll-edit-field">
                <label htmlFor="edit-tax">Income Tax / PT</label>
                <input
                  id="edit-tax"
                  type="number"
                  min="0"
                  step="1"
                  value={payrollForm.tax}
                  onChange={(e) => setPayrollForm({ ...payrollForm, tax: e.target.value })}
                />
              </div>
              <div className="payroll-edit-field">
                <label htmlFor="edit-deduction">Other Deductions</label>
                <input
                  id="edit-deduction"
                  type="number"
                  min="0"
                  step="1"
                  value={payrollForm.deduction}
                  onChange={(e) => setPayrollForm({ ...payrollForm, deduction: e.target.value })}
                />
              </div>
              <div className="payroll-edit-field">
                <label htmlFor="edit-status">Payout Status</label>
                <select
                  id="edit-status"
                  value={payrollForm.status}
                  onChange={(e) => setPayrollForm({ ...payrollForm, status: e.target.value })}
                >
                  <option value="generated">Generated</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
          </div>

          <div className="payroll-edit-summary">
            <div className="payroll-edit-summary-item">
              <span>Gross Earnings</span>
              <strong>{money(currentGross)}</strong>
            </div>
            <div className="payroll-edit-summary-item">
              <span>Total Deductions</span>
              <strong style={{ color: "#dc2626" }}>{money(currentDeductions)}</strong>
            </div>
            <div className="payroll-edit-summary-item net">
              <span>Net Take-Home Pay</span>
              <strong>{money(currentNet)}</strong>
            </div>
          </div>

          <label className="payroll-sync-checkbox">
            <input
              type="checkbox"
              checked={payrollForm.syncBaseSalary}
              onChange={(e) => setPayrollForm({ ...payrollForm, syncBaseSalary: e.target.checked })}
            />
            <span>Sync this gross earnings ({money(currentGross)}) as employee's base monthly compensation</span>
          </label>

          <div className="form-actions">
            <button type="submit">Save Payroll Record</button>
            <button type="button" className="quiet-action" onClick={() => setEditingPayroll(null)}>Cancel</button>
          </div>
        </form>
      </div>
    )}

    {/* Quick Base Salary Modal */}
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
