import { useRef, useState, useMemo, useEffect } from "react";
import { Navigate } from "react-router-dom";

import EmployeeHeader from "../../components/employee/EmployeeHeader";
import Loader from "../../components/common/Loader";
import ErrorMessage from "../../components/common/ErrorMessage";

import { useEmployeePayroll } from "../../hooks/useEmployeePayroll";
import { downloadRenderedPayslip } from "../../services/payrollService";
import { useAuth } from "../../context/AuthContext";
import { normalizeRole } from "../../utils/auth";

import "../../styles/employee/payroll.css";

const current = new Date();

const initialPeriod = `${current.getFullYear()}-${String(
  current.getMonth() + 1
).padStart(2, "0")}`;

const money = (value, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const valueOf = (object, keys) =>
  keys.reduce((value, key) => value ?? object?.[key], undefined);

const amount = (value) =>
  Number(
    value && typeof value === "object"
      ? value.amount || value.value || 0
      : value || 0
  );

const formatPeriod = (period) => {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      month: "long",
      year: "numeric",
    }).format(new Date(`${period}-01T00:00:00`));
  } catch {
    return period;
  }
};

function numberToWordsINR(amount) {
  const num = Math.round(Number(amount) || 0);
  if (num <= 0) return "Zero Rupees Only";

  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertTwoDigits(n) {
    if (n < 20) return a[n];
    const tens = b[Math.floor(n / 10)];
    const units = a[n % 10];
    return units ? `${tens} ${units}` : tens;
  }

  function convertThreeDigits(n) {
    if (n === 0) return "";
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let res = "";
    if (hundred > 0) {
      res += `${a[hundred]} Hundred`;
      if (rest > 0) res += " and ";
    }
    if (rest > 0) res += convertTwoDigits(rest);
    return res;
  }

  const crore = Math.floor(num / 10000000);
  let rem = num % 10000000;
  const lakh = Math.floor(rem / 100000);
  rem = rem % 100000;
  const thousand = Math.floor(rem / 1000);
  rem = rem % 1000;

  const parts = [];
  if (crore > 0) parts.push(`${convertTwoDigits(crore)} Crore`);
  if (lakh > 0) parts.push(`${convertTwoDigits(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${convertTwoDigits(thousand)} Thousand`);
  if (rem > 0) parts.push(convertThreeDigits(rem));

  return `${parts.join(" ")} Rupees Only`.trim();
}

function EmployeePayrollContent({ user, employee }) {
  const [period, setPeriod] = useState(initialPeriod);
  const [activeTab, setActiveTab] = useState("payslip");
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState("");
  const payslipRef = useRef(null);

  // Personal & Contact Details Modal State
  const [showPersonalModal, setShowPersonalModal] = useState(false);
  const [personalNotice, setPersonalNotice] = useState("");
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalForm, setPersonalForm] = useState({
    phone: "",
    personalEmail: "",
    altPhone: "",
    address: "",
  });

  const [year, month] = period.split("-");

  const {
    salary,
    payslip,
    loading,
    error,
    reload,
  } = useEmployeePayroll(Number(month), Number(year));

  useEffect(() => {
    const handleSync = () => reload(true);
    window.addEventListener("focus", handleSync);
    window.addEventListener("hrms_data_updated", handleSync);
    window.addEventListener("hrms:data_changed", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("focus", handleSync);
      window.removeEventListener("hrms_data_updated", handleSync);
      window.removeEventListener("hrms:data_changed", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [reload]);

  // =========================================================
  // SALARY PROFILE DERIVATION
  // =========================================================

  const salarySource =
    salary ||
    employee?.salary ||
    employee?.compensation ||
    user?.salary ||
    user?.compensation ||
    {};

  const salaryRecord =
    (salary?.salary && typeof salary.salary === "object" ? salary.salary : null) ||
    salary?.compensation ||
    (salary && typeof salary === "object" && (salary.annualSalary || salary.monthlySalary || salary.grossSalary) ? salary : null) ||
    (payslip && typeof payslip === "object" && (payslip.annualSalary || payslip.monthlySalary || payslip.grossSalary) ? payslip : null) ||
    employee?.employment?.salary ||
    employee?.salary ||
    employee?.compensation ||
    user?.salary ||
    user?.compensation ||
    {};

  const rawSalaryNumber =
    typeof salaryRecord === "number"
      ? salaryRecord
      : typeof salary === "number"
      ? salary
      : Number(
          (typeof salaryRecord === "object" ? salaryRecord?.salary : 0) ||
          employee?.employment?.salary ||
          employee?.salary ||
          user?.salary ||
          0
        );

  const rawAnnualSalary = Number(
    valueOf(salaryRecord, [
      "annualSalary",
      "annual",
      "yearlySalary",
      "grossAnnualSalary",
    ]) || (rawSalaryNumber >= 120000 ? rawSalaryNumber : 0)
  );

  const rawMonthlySalary = Number(
    valueOf(salaryRecord, [
      "monthlySalary",
      "monthly",
      "monthlyBaseSalary",
      "grossSalary",
      "grossPay",
    ]) || (rawSalaryNumber > 0 && rawSalaryNumber < 120000 ? rawSalaryNumber : 0)
  );

  const rawBasic = Number(
    valueOf(salaryRecord, [
      "basicSalary",
      "basic",
      "baseSalary",
      "salary",
    ]) || 0
  );

  // Intelligent Annual vs Monthly conversion
  let finalAnnual = 0;
  let finalMonthly = 0;

  if (rawAnnualSalary >= 120000) {
    finalAnnual = rawAnnualSalary;
    finalMonthly = Math.round(rawAnnualSalary / 12);
  } else if (rawMonthlySalary >= 120000) {
    finalAnnual = rawMonthlySalary;
    finalMonthly = Math.round(rawMonthlySalary / 12);
  } else if (rawBasic >= 120000) {
    finalAnnual = rawBasic;
    finalMonthly = Math.round(rawBasic / 12);
  } else if (rawMonthlySalary > 0) {
    finalMonthly = rawMonthlySalary;
    finalAnnual = rawMonthlySalary * 12;
  } else if (rawBasic > 0) {
    finalMonthly = rawBasic;
    finalAnnual = rawBasic * 12;
  } else if (rawSalaryNumber >= 120000) {
    finalAnnual = rawSalaryNumber;
    finalMonthly = Math.round(rawSalaryNumber / 12);
  } else if (rawSalaryNumber > 0) {
    finalMonthly = rawSalaryNumber;
    finalAnnual = rawSalaryNumber * 12;
  } else {
    finalAnnual = 660000;
    finalMonthly = 55000;
  }

  // =========================================================
  // EMPLOYEE PROFILE INFORMATION
  // =========================================================

  const profile = payslip?.employee || employee || user || {};

  // Sync personal form when modal opens or profile loads
  useEffect(() => {
    let saved = {};
    try {
      const stored = localStorage.getItem("hrms_employee_profile_edits");
      if (stored) saved = JSON.parse(stored);
    } catch {}
    setPersonalForm({
      phone: saved.phone || profile.phone || user?.phone || "",
      personalEmail: saved.personalEmail || profile.personalEmail || user?.personalEmail || "",
      altPhone: saved.altPhone || profile.altPhone || "",
      address: saved.address || profile.address || user?.address || "",
    });
  }, [profile, user, showPersonalModal]);

  const handleSavePersonalModal = (e) => {
    e.preventDefault();
    setSavingPersonal(true);
    try {
      let existing = {};
      try {
        const stored = localStorage.getItem("hrms_employee_profile_edits");
        if (stored) existing = JSON.parse(stored);
      } catch {}

      const updated = {
        ...existing,
        phone: personalForm.phone.trim(),
        personalEmail: personalForm.personalEmail.trim(),
        altPhone: personalForm.altPhone.trim(),
        address: personalForm.address.trim(),
      };
      localStorage.setItem("hrms_employee_profile_edits", JSON.stringify(updated));
      setPersonalNotice("Personal & Contact Details updated successfully!");
      window.dispatchEvent(new CustomEvent("hrms_data_updated", { detail: { category: "profile" } }));
      window.dispatchEvent(new CustomEvent("hrms:data_changed"));
      setTimeout(() => {
        setPersonalNotice("");
        setShowPersonalModal(false);
      }, 900);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPersonal(false);
    }
  };

  const employeeName =
    profile.name ||
    `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
    user?.name ||
    "Employee";

  const employeeCode =
    profile.employeeCode ||
    profile.employeeId ||
    user?.employeeCode ||
    user?.employeeId ||
    "";

  const employeeEmail =
    profile.email ||
    user?.email ||
    "";

  const department =
    profile.employment?.department ||
    profile.department ||
    user?.department ||
    "Engineering";

  const designation =
    profile.employment?.designation ||
    profile.designation ||
    user?.designation ||
    profile.jobTitle ||
    "Developer";

  const rawJoining =
    profile.employment?.joiningDate ||
    profile.joiningDate ||
    profile.dateOfJoining ||
    user?.joiningDate ||
    user?.employment?.joiningDate;

  const dateOfJoining = rawJoining
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
        new Date(rawJoining)
      )
    : "Not Specified";

  const panNumber =
    profile.pan ||
    profile.panNumber ||
    employee?.pan ||
    user?.pan ||
    "N/A";

  const uanNumber =
    profile.uan ||
    profile.uanNumber ||
    profile.pfNumber ||
    employee?.uan ||
    user?.uan ||
    "N/A";

  const bankAccount =
    profile.banking?.accountNumber
      ? `${profile.banking.bankName ? `${profile.banking.bankName} - ` : ""}${profile.banking.accountNumber}`
      : profile.bankAccount ||
        profile.accountNumber ||
        (employee?.banking?.accountNumber
          ? `${employee.banking.bankName ? `${employee.banking.bankName} - ` : ""}${employee.banking.accountNumber}`
          : "N/A");

  // =========================================================
  // PAYSLIP & EARNINGS BREAKDOWN
  // =========================================================

  const hasSalaryConfigured = finalAnnual > 0 || finalMonthly > 0;

  const hasRealPayslip = Boolean(
    payslip &&
      payslip.status !== "not_applicable" &&
      (payslip.status === "generated" ||
        payslip.status === "Generated" ||
        Number(payslip.grossSalary || 0) > 0 ||
        Number(payslip.grossPay || 0) > 0 ||
        Number(payslip.basicSalary || 0) > 0 ||
        Number(payslip.netSalary || 0) > 0 ||
        Number(payslip.netPay || 0) > 0)
  );

  const earnings = payslip?.earnings || payslip?.income || {};
  const deductions = payslip?.deductions || {};

  const rawGrossPay =
    Number(valueOf(payslip, ["grossSalary", "grossPay"]) || earnings.total || 0) ||
    finalMonthly ||
    0;
  const displayGrossPay =
    rawGrossPay >= 120000 ? Math.round(rawGrossPay / 12) : rawGrossPay;

  const rawBasicSalary =
    Number(
      valueOf(payslip, ["basicSalary", "basic", "baseSalary"]) ||
        valueOf(earnings, ["basicSalary", "basic", "baseSalary"]) ||
        0
    ) ||
    Math.round(displayGrossPay * 0.5);

  const displayBasicSalary =
    rawBasicSalary >= 120000
      ? Math.round(rawBasicSalary / 12)
      : rawBasicSalary > displayGrossPay
      ? Math.round(displayGrossPay * 0.5)
      : rawBasicSalary;

  const rawHra =
    Number(
      valueOf(payslip, ["allowances", "allowance", "totalAllowances", "hra"]) ||
        valueOf(earnings, ["allowances", "allowance", "hra"]) ||
        0
    ) ||
    Math.max(0, displayGrossPay - displayBasicSalary);

  const displayHra =
    rawHra >= 120000
      ? Math.round(rawHra / 12)
      : rawHra > displayGrossPay
      ? Math.max(0, displayGrossPay - displayBasicSalary)
      : rawHra;

  const displaySpecial =
    Number(
      valueOf(earnings, ["specialAllowance", "special"]) ||
        valueOf(payslip, ["specialAllowance", "special"]) ||
        0
    ) ||
    Math.max(0, displayGrossPay - (displayBasicSalary + displayHra));

  const displayConveyance = Number(
    valueOf(earnings, ["conveyance", "transport"]) ||
      valueOf(payslip, ["conveyance", "transport"]) ||
      0
  );

  const displayBonus = Number(
    valueOf(payslip, ["bonus", "bonusAmount"]) ||
      valueOf(earnings, ["bonus", "bonusAmount"]) ||
      0
  );

  // Deductions calculation
  const rawPf =
    Number(
      valueOf(payslip, ["pf", "providentFund", "pfDeduction"]) ||
        valueOf(deductions, ["pf", "providentFund", "pfDeduction"]) ||
        0
    ) ||
    (displayBasicSalary > 0 ? Math.min(Math.round(displayBasicSalary * 0.12), 3600) : 0);
  const displayPf = rawPf >= 120000 ? Math.round(rawPf / 12) : rawPf;

  const rawPt =
    Number(
      valueOf(payslip, ["tax", "incomeTax", "taxDeduction", "pt"]) ||
        valueOf(deductions, ["tax", "pt", "professionalTax"]) ||
        0
    ) ||
    (displayGrossPay > 0 ? 200 : 0);
  const displayPt = rawPt >= 120000 ? Math.round(rawPt / 12) : rawPt;

  const rawTds =
    Number(
      valueOf(deductions, ["tds", "incomeTax", "taxWithholding"]) ||
        valueOf(payslip, ["tds", "incomeTax"]) ||
        0
    );
  const displayTds = rawTds >= 120000 ? Math.round(rawTds / 12) : rawTds;

  const rawOtherDed = Number(
    valueOf(payslip, ["otherDeductions", "deduction"]) ||
      valueOf(deductions, ["otherDeductions", "deduction", "other"]) ||
      0
  );
  const displayOtherDeductions = rawOtherDed >= 120000 ? Math.round(rawOtherDed / 12) : rawOtherDed;

  const calculatedTotalDeductions =
    displayPf + displayPt + displayTds + displayOtherDeductions;

  const displayTotalDeductions =
    Number(
      valueOf(payslip, ["totalDeductions", "deductionsTotal"]) ||
        deductions.total ||
        0
    ) || calculatedTotalDeductions;

  const rawNetPay =
    Number(
      valueOf(payslip, ["netSalary", "netPay", "netAmount"]) || 0
    ) || Math.max(displayGrossPay - displayTotalDeductions, 0);

  const displayNetPay =
    rawNetPay >= 120000
      ? Math.round(rawNetPay / 12)
      : rawNetPay > 0
      ? rawNetPay
      : Math.max(displayGrossPay - displayTotalDeductions, 0);

  // CTC Component calculations for Architecture Tab
  const ctcMonthly = finalMonthly;
  const ctcAnnual = finalAnnual;
  const ctcBasic = Math.round(ctcMonthly * 0.5);
  const ctcHra = Math.round(ctcMonthly * 0.25);
  const ctcSpecial = Math.round(ctcMonthly * 0.25);
  const ctcConveyance = 0;
  const ctcPf = ctcMonthly > 0 ? Math.min(Math.round(ctcBasic * 0.12), 3600) : 0;

  const displayStatus =
    payslip?.status === "generated" || payslip?.status === "Generated"
      ? "Verified & Disbursed"
      : hasSalaryConfigured
      ? "Verified & Active"
      : "Not Generated";

  const displayGeneratedAt = payslip?.generatedAt
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(payslip.generatedAt))
    : `${formatPeriod(period)} Automated Cycle`;

  // Percentage stats for KPI cards
  const netPercentage = Math.min(
    100,
    Math.round((displayNetPay / (displayGrossPay || 1)) * 100)
  );
  const deductionPercentage = Math.min(
    100,
    Math.round((displayTotalDeductions / (displayGrossPay || 1)) * 100)
  );

  const joiningDateRaw =
    profile.employment?.joiningDate ||
    profile.joiningDate ||
    profile.dateOfJoining;

  const joiningYearMonth = useMemo(() => {
    if (!joiningDateRaw) return "";
    const d = new Date(joiningDateRaw);
    if (isNaN(d.getTime())) return "";
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }, [joiningDateRaw]);

  const isPeriodBeforeJoining = Boolean(
    !hasRealPayslip &&
      (payslip?.isBeforeJoining ||
        salary?.isBeforeJoining ||
        (joiningYearMonth && period < joiningYearMonth))
  );

  // Navigation handlers
  const handlePrevMonth = () => {
    const [y, m] = period.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    const nextPeriod = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (joiningYearMonth && nextPeriod < joiningYearMonth) {
      setActionError(`Payroll is not available prior to your date of joining (${formatPeriod(joiningYearMonth)}).`);
      return;
    }
    setActionError("");
    setPeriod(nextPeriod);
  };

  const handleNextMonth = () => {
    const [y, m] = period.split("-").map(Number);
    const d = new Date(y, m, 1);
    setActionError("");
    setPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  // PDF Download Handler
  const handleDownload = async () => {
    if (isPeriodBeforeJoining) {
      setActionError("Payslips cannot be downloaded for periods prior to your date of joining.");
      return;
    }
    if (!hasRealPayslip && !hasSalaryConfigured) {
      setActionError(`Official payslip has not been generated yet for ${formatPeriod(period)}.`);
      return;
    }
    setDownloading(true);
    setActionError("");
    try {
      await downloadRenderedPayslip(payslipRef.current, period);
    } catch (requestError) {
      setActionError(
        requestError?.message ||
          `Payslip export failed for ${formatPeriod(period)}.`
      );
    } finally {
      setDownloading(false);
    }
  };

  if (loading && !salary && !payslip && !user && !employee) {
    return (
      <>
        <EmployeeHeader />
        <main className="employee-payroll-hub" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
          <Loader label="Loading official payroll records and compensation breakdown..." />
        </main>
      </>
    );
  }

  return (
    <>
      <EmployeeHeader />

      <main className="employee-payroll-hub">
        {/* =====================================================
            HERO COMMAND BANNER
        ===================================================== */}
        <section className="payroll-hero-banner" aria-label="Payroll banner">
          <div className="hero-left-content">
            <div className="hero-kicker-pill">
              <span className="pulsing-live-dot" /> Enterprise Compensation Intelligence
            </div>
            <h1>My Payroll & Compensation</h1>
            <p>
              Access official tax-compliant payslips, detailed earnings breakdowns,
              statutory deductions ledger, and full-year CTC architecture.
            </p>
          </div>

          <div className="hero-actions-cluster">
            <div className="pay-period-navigator">
              <button
                type="button"
                className="period-nav-arrow"
                onClick={handlePrevMonth}
                title="Previous Month"
                aria-label="Previous Month"
              >
                ‹
              </button>
              <input
                type="month"
                className="period-input-control"
                value={period}
                min={joiningYearMonth || undefined}
                onChange={(e) => {
                  const val = e.target.value;
                  if (joiningYearMonth && val < joiningYearMonth) {
                    setActionError(`Payroll is not available prior to your date of joining (${formatPeriod(joiningYearMonth)}).`);
                    return;
                  }
                  setActionError("");
                  setPeriod(val);
                }}
                aria-label="Select Pay Period"
              />
              <button
                type="button"
                className="period-nav-arrow"
                onClick={handleNextMonth}
                title="Next Month"
                aria-label="Next Month"
              >
                ›
              </button>
            </div>

            <button
              type="button"
              className="hero-btn secondary"
              onClick={() => setPeriod(initialPeriod)}
            >
              Current Month
            </button>

            <button
              type="button"
              className="hero-btn secondary"
              onClick={() => window.print()}
            >
              🖨️ Print
            </button>

            <button
              type="button"
              className="hero-btn primary"
              onClick={handleDownload}
              disabled={downloading || (!hasRealPayslip && !hasSalaryConfigured) || isPeriodBeforeJoining}
              title={!hasRealPayslip && !hasSalaryConfigured ? "Payslip not yet generated for this period" : "Download PDF"}
              style={(!hasRealPayslip && !hasSalaryConfigured) || isPeriodBeforeJoining ? { opacity: 0.6, cursor: "not-allowed" } : {}}
            >
              📥 {downloading ? "Generating PDF..." : "Download PDF"}
            </button>
          </div>
        </section>

        {/* =====================================================
            KPI METRICS ROW (4 CARDS)
        ===================================================== */}
        <section className="payroll-kpi-grid" aria-label="Compensation KPIs">
          {/* Card 1: Net Take-Home Pay */}
          <div className="kpi-card-box emerald">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Net Take-Home Pay</span>
              <div className="kpi-icon-pod emerald">💰</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{money(displayNetPay)}</span>
              <span className={`kpi-badge-chip ${displayNetPay > 0 ? "positive" : "neutral"}`}>
                {displayNetPay > 0
                  ? `${netPercentage}% of Gross`
                  : hasSalaryConfigured
                  ? "Scheduled Base"
                  : "Pending Setup"}
              </span>
            </div>
            <div className="kpi-progress-rail">
              <div
                className="kpi-progress-bar emerald"
                style={{ width: `${displayNetPay > 0 ? netPercentage : 0}%` }}
              />
            </div>
            <span className="kpi-subtext">
              {displayNetPay > 0
                ? `Direct Deposit to Bank • ${formatPeriod(period)}`
                : hasSalaryConfigured
                ? `Scheduled base • Pay cycle ending ${formatPeriod(period)}`
                : `No compensation package recorded`}
            </span>
          </div>

          {/* Card 2: Gross Monthly Earnings */}
          <div className="kpi-card-box teal">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Gross Monthly Earnings</span>
              <div className="kpi-icon-pod teal">📈</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">
                {money(hasRealPayslip ? displayGrossPay : finalMonthly)}
              </span>
              <span className="kpi-badge-chip neutral">
                {hasRealPayslip ? "Fixed + Allowances" : (hasSalaryConfigured ? "Base Structure" : "Not Set")}
              </span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar teal" style={{ width: hasRealPayslip || hasSalaryConfigured ? "100%" : "0%" }} />
            </div>
            <span className="kpi-subtext">
              {hasRealPayslip
                ? `Base: ${money(displayBasicSalary)} • HRA: ${money(displayHra)}`
                : (hasSalaryConfigured ? `Scheduled base: ${money(finalMonthly)} / month` : "Salary not yet configured by HR")}
            </span>
          </div>

          {/* Card 3: Statutory Deductions */}
          <div className="kpi-card-box rose">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Total Deductions</span>
              <div className="kpi-icon-pod rose">🛡️</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{money(displayTotalDeductions)}</span>
              <span className={`kpi-badge-chip ${hasRealPayslip ? "deduction" : "neutral"}`}>
                {hasRealPayslip ? `${deductionPercentage}% Total` : "0% Total"}
              </span>
            </div>
            <div className="kpi-progress-rail">
              <div
                className="kpi-progress-bar rose"
                style={{ width: `${hasRealPayslip ? deductionPercentage : 0}%` }}
              />
            </div>
            <span className="kpi-subtext">
              {hasRealPayslip
                ? `PF: ${money(displayPf)} • PT: ${money(displayPt)}${displayTds > 0 ? ` • TDS: ${money(displayTds)}` : ""}${displayOtherDeductions > 0 ? ` • Insurance: ${money(displayOtherDeductions)}` : ""}`
                : "Deductions calculated upon monthly payroll generation"}
            </span>
          </div>

          {/* Card 4: Annual CTC Package */}
          <div className="kpi-card-box indigo">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Annual CTC Package</span>
              <div className="kpi-icon-pod indigo">🏢</div>
            </div>
            <div className="kpi-stat-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
              <span className="kpi-big-num" style={{ fontSize: "1.45rem", wordBreak: "break-word" }}>{money(finalAnnual)}</span>
              <span className="kpi-badge-chip neutral" style={{ whiteSpace: "nowrap" }}>
                {hasSalaryConfigured ? "Full Cost to Co." : "Pending Setup"}
              </span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar indigo" style={{ width: hasSalaryConfigured ? "100%" : "0%" }} />
            </div>
            <span className="kpi-subtext">
              {hasSalaryConfigured
                ? `Monthly CTC: ${money(Math.round(finalAnnual / 12))}`
                : "Salary structure pending HR assignment"}
            </span>
          </div>
        </section>

        {/* =====================================================
            ERROR NOTICE
        ===================================================== */}
        {actionError && (
          <div
            style={{
              padding: "1rem 1.25rem",
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              borderRadius: "12px",
              color: "#e11d48",
              marginBottom: "1.5rem",
              fontWeight: "600",
              fontSize: "0.88rem",
            }}
          >
            ⚠️ {actionError}
          </div>
        )}

        {/* =====================================================
            JOINING DATE RESTRICTION NOTICE (INFORMATIVE BANNER)
        ===================================================== */}
        {isPeriodBeforeJoining && (
          <section className="dash-panel-card" style={{ padding: "1.25rem 1.75rem", margin: "0 0 1.5rem", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.5rem" }}>ℹ️</span>
                <div>
                  <h4 style={{ margin: "0 0 0.25rem", color: "#0f172a", fontSize: "0.95rem" }}>
                    Historical Pay Period ({formatPeriod(period)})
                  </h4>
                  <p style={{ margin: 0, color: "#475569", fontSize: "0.85rem" }}>
                    This pay cycle precedes your recorded date of joining ({joiningYearMonth ? formatPeriod(joiningYearMonth) : "Current"}). Displaying your active compensation package below.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="hero-btn secondary"
                style={{ fontSize: "0.82rem", padding: "0.4rem 0.85rem" }}
                onClick={() => {
                  setActionError("");
                  setPeriod(initialPeriod);
                }}
              >
                Jump to Current Cycle ({formatPeriod(initialPeriod)})
              </button>
            </div>
          </section>
        )}

        {/* =====================================================
            SEGMENTED PORTAL TABS
        ===================================================== */}
        <div className="payroll-nav-wrapper">
          <div className="payroll-segmented-nav" role="tablist" aria-label="Payroll Sections">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "all"}
              className={`payroll-tab-btn ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              <span className="tab-icon" aria-hidden="true">🌟</span>
              <span className="tab-label">Complete View</span>
              <span className="tab-sublabel">(All Sections)</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "payslip"}
              className={`payroll-tab-btn ${activeTab === "payslip" ? "active" : ""}`}
              onClick={() => setActiveTab("payslip")}
            >
              <span className="tab-icon" aria-hidden="true">📄</span>
              <span className="tab-label">Official Payslip</span>
              <span className="tab-sublabel">&amp; Statement</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "ctc"}
              className={`payroll-tab-btn ${activeTab === "ctc" ? "active" : ""}`}
              onClick={() => setActiveTab("ctc")}
            >
              <span className="tab-icon" aria-hidden="true">💼</span>
              <span className="tab-label">CTC Architecture</span>
              <span className="tab-sublabel">&amp; Salary Structure</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "ytd"}
              className={`payroll-tab-btn ${activeTab === "ytd" ? "active" : ""}`}
              onClick={() => setActiveTab("ytd")}
            >
              <span className="tab-icon" aria-hidden="true">📊</span>
              <span className="tab-label">Tax Withholding</span>
              <span className="tab-sublabel">&amp; YTD Analysis</span>
            </button>
          </div>
        </div>

        {/* =====================================================
            TAB 1: OFFICIAL PAYSLIP & STATEMENT
        ===================================================== */}
        {(activeTab === "all" || activeTab === "payslip") && (
          (hasRealPayslip || hasSalaryConfigured) ? (
            <article className="payslip-modern-card" ref={payslipRef} style={{ marginBottom: activeTab === "all" ? "2.5rem" : "0" }}>
              {/* Corporate Header */}
              <div className="payslip-corp-header">
                <div className="corp-brand-block">
                  <h2>🏢 Quadratic Systems Inc</h2>
                  <p>
                    5A1 Melange Towers, Madhapur, Hyderabad
                  </p>
                </div>

                <div className="payslip-period-badge">
                  <span>OFFICIAL SALARY STATEMENT</span>
                  <strong>{formatPeriod(period)}</strong>
                  <div style={{ marginTop: "0.4rem" }}>
                    <span
                      className="kpi-badge-chip positive"
                      style={{ fontSize: "0.72rem" }}
                    >
                      ✓ {displayStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* Employee Metadata Header */}
              <div className="payslip-meta-header">
                <span className="payslip-meta-heading-title">👤 Personal & Contact Details</span>
                <button
                  type="button"
                  className="payslip-edit-link-btn"
                  onClick={() => setShowPersonalModal(true)}
                  title="View and edit personal and contact details"
                >
                  ✏️ Edit
                </button>
              </div>

              {/* Employee Metadata Grid */}
              <div className="payslip-meta-grid">
                <div className="payslip-meta-item">
                  <span>Employee Name</span>
                  <strong>{employeeName}</strong>
                </div>
                <div className="payslip-meta-item">
                  <span>Employee ID</span>
                  <strong>{employeeCode}</strong>
                </div>
                <div className="payslip-meta-item">
                  <span>Department</span>
                  <strong>{department}</strong>
                </div>
                <div className="payslip-meta-item">
                  <span>Designation</span>
                  <strong>{designation}</strong>
                </div>

                <div className="payslip-meta-item">
                  <span>Date of Joining</span>
                  <strong>{dateOfJoining}</strong>
                </div>
                <div className="payslip-meta-item">
                  <span>PAN Number</span>
                  <strong>{panNumber}</strong>
                </div>
                <div className="payslip-meta-item">
                  <span>UAN / PF Number</span>
                  <strong>{uanNumber}</strong>
                </div>
                <div className="payslip-meta-item">
                  <span>Bank & Account</span>
                  <strong>{bankAccount}</strong>
                </div>
              </div>

              {/* Earnings & Deductions Tables */}
              <div className="payslip-ledger-grid">
                {/* Earnings Column */}
                <div className="ledger-column">
                  <h3>
                    Earnings <span>Gross Additions</span>
                  </h3>
                  <div className="ledger-table-wrap">
                    <table className="ledger-table">
                      <thead>
                        <tr>
                          <th>Pay Component</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Basic Salary</td>
                          <td>{money(displayBasicSalary)}</td>
                        </tr>
                        <tr>
                          <td>House Rent Allowance (HRA)</td>
                          <td>{money(displayHra)}</td>
                        </tr>
                        <tr>
                          <td>Special / City Allowance</td>
                          <td>{money(displaySpecial)}</td>
                        </tr>
                        <tr>
                          <td>Conveyance & Medical Allowance</td>
                          <td>{money(displayConveyance)}</td>
                        </tr>
                        {displayBonus > 0 && (
                          <tr>
                            <td>Performance Bonus / Incentive</td>
                            <td>{money(displayBonus)}</td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th>Total Gross Earnings (A)</th>
                          <th>{money(displayGrossPay)}</th>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Deductions Column */}
                <div className="ledger-column">
                  <h3>
                    Deductions <span>Withheld & Statutory</span>
                  </h3>
                  <div className="ledger-table-wrap">
                    <table className="ledger-table">
                      <thead>
                        <tr>
                          <th>Deduction Component</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Provident Fund (Employee EPF)</td>
                          <td className="deduction-text">{displayPf > 0 ? `-${money(displayPf)}` : money(0)}</td>
                        </tr>
                        <tr>
                          <td>Professional Tax (PT)</td>
                          <td className="deduction-text">{displayPt > 0 ? `-${money(displayPt)}` : money(0)}</td>
                        </tr>
                        <tr>
                          <td>Tax Deducted at Source (TDS)</td>
                          <td className={displayTds > 0 ? "deduction-text" : ""}>{displayTds > 0 ? `-${money(displayTds)}` : money(0)}</td>
                        </tr>
                        {displayOtherDeductions > 0 && (
                          <>
                            <tr>
                              <td>Group Medical &amp; Health Insurance (GMC)</td>
                              <td className="deduction-text">-{money(Math.round(displayOtherDeductions * 0.6))}</td>
                            </tr>
                            <tr>
                              <td>Group Term Life &amp; Accident Policy (GPA)</td>
                              <td className="deduction-text">-{money(displayOtherDeductions - Math.round(displayOtherDeductions * 0.6))}</td>
                            </tr>
                          </>
                        )}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th>Total Deductions (B)</th>
                          <th className="deduction-text">-{money(displayTotalDeductions)}</th>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              {/* Net Pay Highlight Banner */}
              <div className="payslip-net-banner">
                <div className="net-stat-card">
                  <span>Gross Earnings (A)</span>
                  <strong>{money(displayGrossPay)}</strong>
                </div>

                <div className="net-stat-card">
                  <span>Total Deductions (B)</span>
                  <strong className="deduction-text">-{money(displayTotalDeductions)}</strong>
                </div>

                <div className="net-stat-card highlight">
                  <span>Net Disbursed Take-Home Pay (A - B)</span>
                  <strong>{money(displayNetPay)}</strong>
                </div>
              </div>

              {/* In-Words Conversion */}
              <div className="net-words-wrapper">
                <div className="net-words-row">
                  <strong>Net Amount in Words:</strong> {numberToWordsINR(displayNetPay)}
                </div>
              </div>

              {/* Security Stamp & Verification */}
              <div className="payslip-stamp-wrapper">
                <div className="payslip-security-stamp">
                  <div className="qr-code-box">🛡️</div>
                  <div className="stamp-text">
                    <strong>Digitally Verified Corporate Disbursement</strong>
                    <span>
                      REF: QSI-PAY-{year}{month}-{employeeCode.replace(/\D/g, "") || "901"} • HASH: 7F8E-2B4A-91C0
                    </span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="payslip-signatures-row">
                <div className="sign-column">
                  <div className="digital-signature-box">
                    <span className="signature-cursive">
                      {profile.reportsToName || profile.managerName || "HR Manager"}
                    </span>
                    <div className="signature-verified-badge">
                      ✓ DIGITALLY SIGNED
                    </div>
                  </div>
                  <span className="signatory-title">Employer Authorized Signatory</span>
                  <div className="signatory-org">
                    Quadratic Systems Inc
                  </div>
                </div>

                <div className="sign-column">
                  <div className="digital-signature-box">
                    <span className="signature-cursive">
                      {employeeName}
                    </span>
                    <div className="signature-verified-badge">
                      ✓ VERIFIED
                    </div>
                  </div>
                  <span className="signatory-title">Employee Signature Acknowledgement</span>
                  <div className="signatory-org">
                    {employeeName} ({employeeCode})
                  </div>
                </div>
              </div>

              {/* Legal Footer */}
              <div className="payslip-legal-footer">
                This document is a computer-generated official payroll record issued by Quadratic Systems Inc in compliance with the Payment of Wages Act. For compensation questions, reach out to payroll@quadraticsystems.com.
              </div>
            </article>
          ) : (
            <section className="dash-panel-card" style={{ padding: "3.5rem 2rem", margin: "1.5rem 0", background: "var(--card-bg, #ffffff)", borderRadius: "16px", border: "1px dashed var(--border-color, #cbd5e1)", textAlign: "center" }}>
              <div style={{ maxWidth: "560px", margin: "0 auto" }}>
                <div style={{ fontSize: "3.2rem", marginBottom: "1rem" }}>📋</div>
                <h3 style={{ fontSize: "1.35rem", fontWeight: "700", color: "var(--text-primary, #0f172a)", marginBottom: "0.5rem" }}>
                  {hasSalaryConfigured ? `Payslip Awaiting Generation for ${formatPeriod(period)}` : "No Payroll Record Found"}
                </h3>
                <p style={{ fontSize: "0.95rem", color: "var(--text-secondary, #64748b)", lineHeight: 1.6, marginBottom: "1.5rem" }}>
                  {hasSalaryConfigured
                    ? `Your monthly base salary is configured (${money(finalMonthly)}/month), but HR has not yet executed the payroll run for ${formatPeriod(period)}. Your official payslip and disbursement record will be available as soon as the pay cycle is completed.`
                    : `No compensation package or payroll run has been recorded for your profile. Once HR sets up your salary and processes the pay cycle for ${formatPeriod(period)}, your official payslip will be generated here.`}
                </p>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1.25rem", borderRadius: "9999px", background: hasSalaryConfigured ? "#fef3c7" : "#f1f5f9", color: hasSalaryConfigured ? "#92400e" : "#475569", fontSize: "0.85rem", fontWeight: "600" }}>
                  ⏳ Status: {hasSalaryConfigured ? "Awaiting Monthly Payroll Run" : "Pending HR Compensation Setup"}
                </div>
              </div>
            </section>
          )
        )}

        {/* =====================================================
            TAB 2: CTC ARCHITECTURE & SALARY STRUCTURE
        ===================================================== */}
        {(activeTab === "all" || activeTab === "ctc") && (
          hasSalaryConfigured ? (
            <article className="ctc-structure-card" style={{ marginBottom: activeTab === "all" ? "2.5rem" : "0" }}>
              <div className="ctc-structure-head">
                <div>
                  <h2>Annual Compensation Architecture (CTC)</h2>
                  <p>
                    Comprehensive structural breakdown of your full compensation package
                    including fixed base pay, flexible allowances, and statutory retirement provisions.
                  </p>
                </div>

                <div className="payslip-period-badge">
                  <span>TOTAL ANNUAL CTC</span>
                  <strong style={{ fontSize: "1.65rem", color: "#0d9488" }}>
                    {money(ctcAnnual)}
                  </strong>
                </div>
              </div>

              {/* Visual Rail */}
              <div className="ctc-visual-rail">
                <div className="ctc-visual-fill basic" style={{ width: "50%" }} title="Basic Pay: 50%" />
                <div className="ctc-visual-fill hra" style={{ width: "25%" }} title="HRA: 25%" />
                <div className="ctc-visual-fill allowances" style={{ width: "15%" }} title="Special Allowances: 15%" />
                <div className="ctc-visual-fill pf" style={{ width: "10%" }} title="Employer Contributions: 10%" />
              </div>

              {/* Legend */}
              <div className="ctc-legend-strip">
                <div className="ctc-legend-item">
                  <span className="ctc-legend-dot" style={{ background: "#0d9488" }} />
                  Fixed Basic Pay (50%)
                </div>
                <div className="ctc-legend-item">
                  <span className="ctc-legend-dot" style={{ background: "#10b981" }} />
                  House Rent Allowance (25%)
                </div>
                <div className="ctc-legend-item">
                  <span className="ctc-legend-dot" style={{ background: "#6366f1" }} />
                  Flexible Allowances (15%)
                </div>
                <div className="ctc-legend-item">
                  <span className="ctc-legend-dot" style={{ background: "#f59e0b" }} />
                  Employer PF & Benefits (10%)
                </div>
              </div>

              {/* Breakdown Tiles */}
              <div className="ctc-breakdown-grid">
                <div className="ctc-tile-box">
                  <span>Fixed Basic Salary</span>
                  <strong>{money(ctcBasic * 12)}</strong>
                  <small>{money(ctcBasic)} / month</small>
                </div>

                <div className="ctc-tile-box">
                  <span>House Rent Allowance (HRA)</span>
                  <strong>{money(ctcHra * 12)}</strong>
                  <small>{money(ctcHra)} / month</small>
                </div>

                <div className="ctc-tile-box">
                  <span>Special / City Allowance</span>
                  <strong>{money(ctcSpecial * 12)}</strong>
                  <small>{money(ctcSpecial)} / month</small>
                </div>

                <div className="ctc-tile-box">
                  <span>Conveyance & Travel</span>
                  <strong>{money(ctcConveyance * 12)}</strong>
                  <small>{money(ctcConveyance)} / month</small>
                </div>

                <div className="ctc-tile-box">
                  <span>Employer PF Contribution</span>
                  <strong>{money(ctcPf * 12)}</strong>
                  <small>{money(ctcPf)} / month (Statutory)</small>
                </div>

                <div className="ctc-tile-box">
                  <span>Annual Gratuity Provision</span>
                  <strong>{money(Math.round(ctcBasic * 12 * 0.0481))}</strong>
                  <small>4.81% of Basic (Accrued Annually)</small>
                </div>

                <div className="ctc-tile-box">
                  <span>Group Health &amp; Term Insurance</span>
                  <strong>{money((displayOtherDeductions || Math.round(finalMonthly * 0.08)) * 12)}</strong>
                  <small>{money(displayOtherDeductions || Math.round(finalMonthly * 0.08))} / month (Comprehensive Cover)</small>
                </div>
              </div>

              <div className="tax-advisory-box" style={{ marginTop: "1.75rem" }}>
                💡 <strong>Compensation Policy Note:</strong> Compensation reviews occur annually in April. Variable performance bonuses and long-term equity allocations (if applicable) are governed under separate incentive plan documents.
              </div>
            </article>
          ) : (
            <section className="dash-panel-card" style={{ padding: "3.5rem 2rem", margin: "1.5rem 0", background: "var(--card-bg, #ffffff)", borderRadius: "16px", border: "1px dashed var(--border-color, #cbd5e1)", textAlign: "center" }}>
              <div style={{ maxWidth: "560px", margin: "0 auto" }}>
                <div style={{ fontSize: "3.2rem", marginBottom: "1rem" }}>💼</div>
                <h3 style={{ fontSize: "1.35rem", fontWeight: "700", color: "var(--text-primary, #0f172a)", marginBottom: "0.5rem" }}>
                  Compensation Architecture Pending
                </h3>
                <p style={{ fontSize: "0.95rem", color: "var(--text-secondary, #64748b)", lineHeight: 1.6, marginBottom: "1.5rem" }}>
                  Your annualized Cost to Company (CTC) structure, allowances, and statutory benefits breakdown will appear here once assigned by the HR department.
                </p>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1.25rem", borderRadius: "9999px", background: "#f1f5f9", color: "#475569", fontSize: "0.85rem", fontWeight: "600" }}>
                  Status: Pending HR Setup
                </div>
              </div>
            </section>
          )
        )}

        {/* =====================================================
            TAB 3: TAX WITHHOLDING & YTD ANALYSIS
        ===================================================== */}
        {(activeTab === "all" || activeTab === "ytd") && (
          hasSalaryConfigured || hasRealPayslip ? (
            <article className="tax-intelligence-card" style={{ marginBottom: "2.5rem" }}>
              <div className="tax-hero-card">
                <div className="tax-hero-title">
                  <h3>Income Tax & Year-to-Date (YTD) Intelligence</h3>
                  <p>
                    Financial Year 2024-25 projection under the Central Board of Direct Taxes (CBDT) framework.
                  </p>
                </div>
                <div className="tax-regime-badge">
                  ✓ New Tax Regime (Section 115BAC)
                </div>
              </div>

              <div className="tax-grid-layout">
                {/* Column 1: Financial Year YTD Ledger */}
                <div className="tax-panel">
                  <h4>
                    Financial Year YTD Ledger
                    <span style={{ fontSize: "0.76rem", color: "#64748b", fontWeight: "normal" }}>
                      Apr 2024 – Present
                    </span>
                  </h4>

                  <div className="tax-item-row">
                    <span>Gross Compensation Earned YTD</span>
                    <strong>{money(displayGrossPay * 6)}</strong>
                  </div>

                  <div className="tax-item-row">
                    <span>Standard Deduction Applied</span>
                    <strong className="highlight-green">{money(Math.min(finalAnnual, 75000))}</strong>
                  </div>

                  <div className="tax-item-row">
                    <span>Employee PF Accumulation YTD</span>
                    <strong>{money(displayPf * 6)}</strong>
                  </div>

                  <div className="tax-item-row">
                    <span>Total Income Tax / TDS Withheld YTD</span>
                    <strong style={{ color: "#e11d48" }}>{money(displayTds * 6)}</strong>
                  </div>

                  <div className="tax-item-row">
                    <span>Professional Tax Paid YTD</span>
                    <strong>{money(displayPt * 6)}</strong>
                  </div>

                  {displayOtherDeductions > 0 && (
                    <div className="tax-item-row">
                      <span>Group Insurance &amp; Health Policy YTD</span>
                      <strong>{money(displayOtherDeductions * 6)}</strong>
                    </div>
                  )}

                  <div className="tax-item-row">
                    <span>Total Cumulative Deductions YTD</span>
                    <strong style={{ color: "#e11d48" }}>{money(displayTotalDeductions * 6)}</strong>
                  </div>

                  <div className="tax-item-row">
                    <span>Estimated Net Taxable Base</span>
                    <strong className="highlight-green">
                      {money(Math.max(0, finalAnnual - Math.min(finalAnnual, 75000)))}
                    </strong>
                  </div>
                </div>

                {/* Column 2: Tax Slabs & Deductions Guide */}
                <div className="tax-panel">
                  <h4>New Regime Tax Slabs (FY 2024-25)</h4>

                  <div className="tax-item-row">
                    <span>₹0 – ₹3,00,000</span>
                    <strong>NIL (0%)</strong>
                  </div>

                  <div className="tax-item-row">
                    <span>₹3,00,001 – ₹7,00,000</span>
                    <strong>5% (Rebate Eligible u/s 87A)</strong>
                  </div>

                  <div className="tax-item-row">
                    <span>₹7,00,001 – ₹10,00,000</span>
                    <strong>10%</strong>
                  </div>

                  <div className="tax-item-row">
                    <span>₹10,00,001 – ₹12,00,000</span>
                    <strong>15%</strong>
                  </div>

                  <div className="tax-item-row">
                    <span>₹12,00,001 – ₹15,00,000</span>
                    <strong>20%</strong>
                  </div>

                  <div className="tax-item-row">
                    <span>Above ₹15,00,000</span>
                    <strong>30%</strong>
                  </div>
                </div>
              </div>

              <div className="tax-advisory-box">
                📌 <strong>Tax Declarations & Proof Submission:</strong> Under the New Tax Regime, taxable income up to ₹7,75,000 (after the ₹75,000 standard deduction) incurs zero tax liability via the Section 87A rebate. For regime switches or investment declarations, contact the HR Finance team before the December window closes.
              </div>
            </article>
          ) : (
            <section className="dash-panel-card" style={{ padding: "3.5rem 2rem", margin: "1.5rem 0", background: "var(--card-bg, #ffffff)", borderRadius: "16px", border: "1px dashed var(--border-color, #cbd5e1)", textAlign: "center" }}>
              <div style={{ maxWidth: "560px", margin: "0 auto" }}>
                <div style={{ fontSize: "3.2rem", marginBottom: "1rem" }}>📊</div>
                <h3 style={{ fontSize: "1.35rem", fontWeight: "700", color: "var(--text-primary, #0f172a)", marginBottom: "0.5rem" }}>
                  Tax & YTD Ledger Inactive
                </h3>
                <p style={{ fontSize: "0.95rem", color: "var(--text-secondary, #64748b)", lineHeight: 1.6, marginBottom: "1.5rem" }}>
                  Tax projections under Section 115BAC and Year-to-Date tax withholdings will be automatically computed once your payroll cycles begin.
                </p>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1.25rem", borderRadius: "9999px", background: "#f1f5f9", color: "#475569", fontSize: "0.85rem", fontWeight: "600" }}>
                  Awaiting Active Payroll
                </div>
              </div>
            </section>
          )
        )}

        {/* =====================================================
            👤 PERSONAL & CONTACT DETAILS EDIT MODAL
        ===================================================== */}
        {showPersonalModal && (
          <div
            className="payroll-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setShowPersonalModal(false);
            }}
          >
            <div
              className="payroll-modal edit-payroll-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Personal and Contact Details"
            >
              <div className="payroll-modal-heading">
                <div>
                  <span className="page-kicker">Employee Dossier</span>
                  <h2>👤 Personal & Contact Details</h2>
                  <p>{employeeName} · {employeeCode || "Official Profile"}</p>
                </div>
                <button
                  type="button"
                  className="modal-close"
                  aria-label="Close dialog"
                  onClick={() => setShowPersonalModal(false)}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSavePersonalModal} style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ margin: "1rem 1.75rem 0.25rem", padding: "0.85rem 1.15rem", background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: "10px", fontSize: "0.82rem", color: "#92400e", lineHeight: 1.45 }}>
                  <strong style={{ color: "#78350f" }}>🔒 Statutory Payroll Records Protected:</strong> Name, ID, PAN, Bank Details, and Department are verified by Quadratic HR & Payroll. Contact credentials can be updated below.
                </div>

                {personalNotice && (
                  <div style={{ margin: "0.75rem 1.75rem 0", padding: "0.75rem 1rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", color: "#166534", fontSize: "0.85rem", fontWeight: "600" }}>
                    ✓ {personalNotice}
                  </div>
                )}

                <div className="payroll-edit-grid" style={{ paddingBottom: "1rem" }}>
                  <div className="payroll-edit-col">
                    <h4 className="payroll-edit-col-title">Identity & Work Placement</h4>
                    <div className="payroll-edit-field">
                      <label>Full Legal Name</label>
                      <input type="text" disabled value={employeeName} style={{ background: "#f1f5f9", color: "#64748b", cursor: "not-allowed" }} />
                    </div>
                    <div className="payroll-edit-field">
                      <label>Employee ID / Code</label>
                      <input type="text" disabled value={employeeCode} style={{ background: "#f1f5f9", color: "#64748b", cursor: "not-allowed" }} />
                    </div>
                    <div className="payroll-edit-field">
                      <label>Corporate Work Email</label>
                      <input type="email" disabled value={employeeEmail} style={{ background: "#f1f5f9", color: "#64748b", cursor: "not-allowed" }} />
                    </div>
                    <div className="payroll-edit-field">
                      <label>Department & Designation</label>
                      <input type="text" disabled value={`${department} · ${designation}`} style={{ background: "#f1f5f9", color: "#64748b", cursor: "not-allowed" }} />
                    </div>
                    <div className="payroll-edit-field">
                      <label>Date of Joining</label>
                      <input type="text" disabled value={dateOfJoining} style={{ background: "#f1f5f9", color: "#64748b", cursor: "not-allowed" }} />
                    </div>
                  </div>

                  <div className="payroll-edit-col">
                    <h4 className="payroll-edit-col-title">Personal Contact Credentials</h4>
                    <div className="payroll-edit-field">
                      <label htmlFor="p-phone">Mobile Phone</label>
                      <input
                        id="p-phone"
                        type="tel"
                        value={personalForm.phone}
                        onChange={(e) => setPersonalForm({ ...personalForm, phone: e.target.value })}
                        placeholder="+91 98765 43210"
                      />
                    </div>
                    <div className="payroll-edit-field">
                      <label htmlFor="p-email">Personal Email Address</label>
                      <input
                        id="p-email"
                        type="email"
                        value={personalForm.personalEmail}
                        onChange={(e) => setPersonalForm({ ...personalForm, personalEmail: e.target.value })}
                        placeholder="name@personal.com"
                      />
                    </div>
                    <div className="payroll-edit-field">
                      <label htmlFor="p-altphone">Alternate Phone</label>
                      <input
                        id="p-altphone"
                        type="tel"
                        value={personalForm.altPhone}
                        onChange={(e) => setPersonalForm({ ...personalForm, altPhone: e.target.value })}
                        placeholder="+91 ..."
                      />
                    </div>
                    <div className="payroll-edit-field">
                      <label>PAN / Bank Reference</label>
                      <input type="text" disabled value={`PAN: ${panNumber} | Bank: ${bankAccount}`} style={{ background: "#f1f5f9", color: "#64748b", cursor: "not-allowed", fontSize: "0.82rem" }} />
                    </div>
                    <div className="payroll-edit-field">
                      <label htmlFor="p-address">Residential Address</label>
                      <input
                        id="p-address"
                        type="text"
                        value={personalForm.address}
                        onChange={(e) => setPersonalForm({ ...personalForm, address: e.target.value })}
                        placeholder="Current residential city / address"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-actions" style={{ padding: "1rem 1.75rem 1.5rem", display: "flex", justifyContent: "flex-end", gap: "0.75rem", borderTop: "1px solid #f1f5f9" }}>
                  <button
                    type="button"
                    className="quiet-action"
                    onClick={() => setShowPersonalModal(false)}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={savingPersonal}
                    style={{
                      height: "44px",
                      padding: "0 1.5rem",
                      border: 0,
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                      color: "#ffffff",
                      fontSize: "0.88rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(13, 148, 136, 0.3)",
                    }}
                  >
                    {savingPersonal ? "Saving..." : "💾 Save Contact Details"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

/* =========================================================
   ROLE PROTECTION WRAPPER
========================================================= */

function EmployeePayroll() {
  const { user, employee } = useAuth();
  return <EmployeePayrollContent user={user} employee={employee} />;
}

export default EmployeePayroll;