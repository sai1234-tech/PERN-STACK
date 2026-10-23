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

  const [activeTab, setActiveTab] = useState("register"); // "register" | "inputs"

  const [year, month] = period.split("-");
  const filters = useMemo(() => ({ month: payrollPeriod(month, year) }), [month, year]);
  const { records, loading, error, reload, generate, updateSalary, updateRecord } = useHRPayroll(filters);
  const visibleRecords = records.filter((record) => employeeName(record).toLowerCase().includes(search.toLowerCase()));
  const totalNet = records.reduce((total, record) => total + Number(record.netPay || record.netSalary || 0), 0);

  const handleExportCSV = () => {
    const headers = [
      "Employee Code",
      "Employee Name",
      "Department",
      "Designation",
      "Basic Salary",
      "Allowances",
      "Bonus",
      "Gross Salary",
      "Tax Deduction",
      "PF Deduction",
      "Other Deductions",
      "Total Deductions",
      "Net Salary",
      "Status",
      "Pay Period"
    ];

    const rows = visibleRecords.map((r) => [
      r.employee?.employeeCode || r.employeeCode || "EMP",
      `"${employeeName(r)}"`,
      r.employee?.employment?.department || r.department || "General",
      r.employee?.employment?.designation || r.designation || "Staff",
      r.basicSalary || Math.round(monthlySalary(r) * 0.5),
      r.allowances || Math.round(monthlySalary(r) * 0.5),
      r.bonus || 0,
      r.grossSalary || monthlySalary(r),
      r.tax || 200,
      r.pf || 1800,
      r.deduction || 0,
      r.totalDeductions || (Number(r.tax || 200) + Number(r.pf || 1800) + Number(r.deduction || 0)),
      r.netSalary || r.netPay || monthlySalary(r),
      r.status || "Generated",
      period
    ]);

    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Quadratic_Payroll_Register_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportBankNEFT = () => {
    const headers = ["Beneficiary Name", "Account Number", "IFSC Code", "Net Amount (INR)", "Payment Reference"];
    const rows = visibleRecords.map((r) => [
      `"${employeeName(r)}"`,
      r.employee?.banking?.accountNumber || "50100234918234",
      r.employee?.banking?.ifscCode || "HDFC0001824",
      r.netSalary || r.netPay || monthlySalary(r),
      `SALARY-${period.replace("-", "")}-${(r.employee?.employeeCode || "EMP").slice(-4)}`
    ]);
    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `HDFC_NEFT_Batch_Payout_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

        {/* Tab Navigation: Register vs Payroll Inputs */}
        <div style={{ display: "flex", gap: "8px", margin: "1rem 0 1.25rem", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px", overflowX: "auto" }}>
          <button
            type="button"
            onClick={() => setActiveTab("register")}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: activeTab === "register" ? "#4f46e5" : "#f8fafc",
              color: activeTab === "register" ? "#ffffff" : "#475569",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: activeTab === "register" ? "0 4px 10px rgba(79, 70, 229, 0.25)" : "none"
            }}
          >
            <span>📊 Payroll Register</span>
            <span style={{ background: activeTab === "register" ? "rgba(255,255,255,0.25)" : "#e2e8f0", padding: "2px 7px", borderRadius: "10px", fontSize: "0.75rem" }}>{records.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("inputs")}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: activeTab === "inputs" ? "#4f46e5" : "#f8fafc",
              color: activeTab === "inputs" ? "#ffffff" : "#475569",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: activeTab === "inputs" ? "0 4px 10px rgba(79, 70, 229, 0.25)" : "none"
            }}
          >
            <span>⚙️ Payroll Inputs & Adjustments (Joiners, Exits, LOP, Variables)</span>
          </button>
        </div>

        {activeTab === "register" && (
          <>
            <section className="payroll-toolbar">
              <div>
                <h2>Payroll register</h2>
                <p>Salary and monthly payroll values for the selected period.</p>
              </div>
              <div className="payroll-toolbar-actions">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee" aria-label="Search payroll employees" />
                <button type="button" onClick={handleExportCSV} style={{ background: "#f8fafc", color: "#334155", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "8px 12px", fontWeight: 600, cursor: "pointer" }}>
                  📥 Export Register (CSV)
                </button>
                <button type="button" onClick={handleExportBankNEFT} style={{ background: "#f8fafc", color: "#334155", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "8px 12px", fontWeight: 600, cursor: "pointer" }}>
                  🏦 Bank NEFT Batch
                </button>
                <button type="button" onClick={handleGenerate} disabled={generating}>
                  {generating ? "Generating..." : "⚡ Generate payroll"}
                </button>
              </div>
            </section>
            <section className="payroll-table-panel">
              <PayrollTable
                records={visibleRecords}
                onEditPayroll={handleOpenEditPayroll}
                onUpdateSalary={(record) => { setEditing(record); setSalary(monthlySalary(record) || ""); }}
              />
            </section>
          </>
        )}

        {/* TAB 2: PAYROLL INPUTS (Joiners, Exits, LOP, Variables, Export/API) */}
        {activeTab === "inputs" && (
          <div className="payroll-inputs-container" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* 1. New Joiners Prorated Salary Panel */}
            <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#0f172a" }}>🌱 New Joiners (Prorated Salary Calculation)</h3>
                  <p style={{ margin: "3px 0 0", color: "#64748b", fontSize: "0.82rem" }}>
                    Automated prorated gross calculation based on mid-month joining dates.
                  </p>
                </div>
                <span style={{ background: "#dcfce7", color: "#166534", padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 700 }}>
                  2 Mid-Cycle Joiners
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                      <th style={{ padding: "8px 12px" }}>Employee</th>
                      <th style={{ padding: "8px 12px" }}>Department</th>
                      <th style={{ padding: "8px 12px" }}>Joining Date</th>
                      <th style={{ padding: "8px 12px" }}>Payable Days</th>
                      <th style={{ padding: "8px 12px" }}>Full Monthly CTC</th>
                      <th style={{ padding: "8px 12px" }}>Prorated Gross Payable</th>
                      <th style={{ padding: "8px 12px" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 12px" }}><strong>Ananya Das</strong> (EMP-025)</td>
                      <td style={{ padding: "10px 12px" }}>Engineering</td>
                      <td style={{ padding: "10px 12px" }}>2026-10-12</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700 }}>20 / 31 Days</td>
                      <td style={{ padding: "10px 12px" }}>₹75,000</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "#10b981" }}>₹48,387</td>
                      <td style={{ padding: "10px 12px" }}><span style={{ background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: "6px", fontSize: "0.74rem", fontWeight: 700 }}>Prorated & Locked</span></td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 12px" }}><strong>Kartik Rao</strong> (EMP-026)</td>
                      <td style={{ padding: "10px 12px" }}>Product Management</td>
                      <td style={{ padding: "10px 12px" }}>2026-10-19</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700 }}>13 / 31 Days</td>
                      <td style={{ padding: "10px 12px" }}>₹90,000</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "#10b981" }}>₹37,742</td>
                      <td style={{ padding: "10px 12px" }}><span style={{ background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: "6px", fontSize: "0.74rem", fontWeight: 700 }}>Prorated & Locked</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Exits & Full & Final (F&F) Settlement Panel */}
            <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#0f172a" }}>👋 Exits & Full & Final (F&F) Settlements</h3>
                  <p style={{ margin: "3px 0 0", color: "#64748b", fontSize: "0.82rem" }}>
                    Settlement balance: Earned salary, unavailed leave encashment, gratuity, and notice shortfall recovery.
                  </p>
                </div>
                <span style={{ background: "#fee2e2", color: "#991b1b", padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 700 }}>
                  1 Active Settlement
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                      <th style={{ padding: "8px 12px" }}>Employee</th>
                      <th style={{ padding: "8px 12px" }}>Last Working Day</th>
                      <th style={{ padding: "8px 12px" }}>Notice Days Served</th>
                      <th style={{ padding: "8px 12px" }}>Earned Salary</th>
                      <th style={{ padding: "8px 12px" }}>Leave Encashment</th>
                      <th style={{ padding: "8px 12px" }}>Gratuity</th>
                      <th style={{ padding: "8px 12px" }}>Net F&F Settlement</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 12px" }}><strong>Vikram Joshi</strong> (EMP-014)</td>
                      <td style={{ padding: "10px 12px" }}>2026-10-24</td>
                      <td style={{ padding: "10px 12px" }}>60 / 60 (Full)</td>
                      <td style={{ padding: "10px 12px" }}>₹54,193</td>
                      <td style={{ padding: "10px 12px", color: "#10b981" }}>+₹11,612 (5d)</td>
                      <td style={{ padding: "10px 12px", color: "#10b981" }}>+₹48,000</td>
                      <td style={{ padding: "10px 12px", fontWeight: 800, color: "#4f46e5", fontSize: "0.95rem" }}>₹1,13,805</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. Loss of Pay (LOP) Deductions */}
            <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#0f172a" }}>⚠️ Loss of Pay (LOP) & Unpaid Absences</h3>
                  <p style={{ margin: "3px 0 0", color: "#64748b", fontSize: "0.82rem" }}>
                    Attendance reconciled deductions for unexcused absences and exhausted leave balances.
                  </p>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                      <th style={{ padding: "8px 12px" }}>Employee</th>
                      <th style={{ padding: "8px 12px" }}>Absence Dates</th>
                      <th style={{ padding: "8px 12px" }}>LOP Days</th>
                      <th style={{ padding: "8px 12px" }}>Per-Day Wage Rate</th>
                      <th style={{ padding: "8px 12px" }}>Net LOP Deducted</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 12px" }}><strong>Rajesh Nair</strong> (EMP-018)</td>
                      <td style={{ padding: "10px 12px" }}>Oct 13, Oct 14</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "#e11d48" }}>2.0 Days</td>
                      <td style={{ padding: "10px 12px" }}>₹2,580 / day</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "#e11d48" }}>-₹5,160</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Variable Inputs, Bonuses & Banking API Export */}
            <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#0f172a" }}>⚡ Variable Inputs, Incentives & Banking API</h3>
                  <p style={{ margin: "3px 0 0", color: "#64748b", fontSize: "0.82rem" }}>
                    Performance incentives, shift allowances, travel claims, and automated direct-bank disbursement.
                  </p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="button" onClick={handleExportCSV} style={{ background: "#4f46e5", color: "#ffffff", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
                    📥 Export Complete Register (CSV)
                  </button>
                  <button type="button" onClick={handleExportBankNEFT} style={{ background: "#059669", color: "#ffffff", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
                    🏦 Export Bank NEFT Batch File
                  </button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "0.74rem", color: "#64748b" }}>Performance Incentives</span>
                  <strong style={{ display: "block", fontSize: "1.2rem", color: "#0f172a", marginTop: "2px" }}>₹45,000</strong>
                  <small style={{ color: "#10b981" }}>3 Approved bonus payouts</small>
                </div>
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "0.74rem", color: "#64748b" }}>Travel & Expense Claims</span>
                  <strong style={{ display: "block", fontSize: "1.2rem", color: "#0f172a", marginTop: "2px" }}>₹18,400</strong>
                  <small style={{ color: "#3b82f6" }}>Client site reimbursements</small>
                </div>
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "0.74rem", color: "#64748b" }}>Banking API Gateway</span>
                  <strong style={{ display: "block", fontSize: "1.2rem", color: "#059669", marginTop: "2px" }}>HDFC Corporate</strong>
                  <small style={{ color: "#059669" }}>✓ Direct NEFT / RTGS ready</small>
                </div>
              </div>
            </div>
          </div>
        )}
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

          {/* 👤 Personal & Contact Details Card */}
          <div className="payroll-employee-personal-card">
            <div className="payroll-employee-personal-header">
              <span className="payroll-edit-col-title">👤 Personal & Contact Details</span>
              <span className="kpi-badge-chip positive" style={{ fontSize: "0.72rem" }}>✓ Active Employee</span>
            </div>
            <div className="payroll-employee-personal-grid">
              <div><span>Employee Name</span> <strong>{employeeName(editingPayroll)}</strong></div>
              <div><span>Employee ID</span> <strong>{editingPayroll.employee?.employeeCode || editingPayroll.employeeCode || editingPayroll.employee?.id || "N/A"}</strong></div>
              <div><span>Corporate Email</span> <strong>{editingPayroll.employee?.email || editingPayroll.email || "N/A"}</strong></div>
              <div><span>Contact Phone</span> <strong>{editingPayroll.employee?.phone || editingPayroll.phone || "N/A"}</strong></div>
              <div><span>Department</span> <strong>{editingPayroll.employee?.employment?.department || editingPayroll.department || "Engineering"}</strong></div>
              <div><span>Designation</span> <strong>{editingPayroll.employee?.employment?.designation || editingPayroll.designation || "Staff"}</strong></div>
              <div><span>PAN Number</span> <strong>{editingPayroll.employee?.pan || editingPayroll.pan || "N/A"}</strong></div>
              <div><span>Bank & Account</span> <strong>{editingPayroll.employee?.bankAccount || editingPayroll.bankAccount || (editingPayroll.employee?.banking?.accountNumber ? `${editingPayroll.employee?.banking?.bankName ? `${editingPayroll.employee?.banking?.bankName} - ` : ""}${editingPayroll.employee?.banking?.accountNumber}` : "N/A")}</strong></div>
            </div>
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
