import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import Loader from "../../components/common/Loader";
import {
  createEmployees,
  deleteEmployeeById,
  getAllEmployees,
  updateEmployeeById,
} from "../../services/employeeService";
import { getDepartments } from "../../services/departmentService";
import { getAllAttendance } from "../../services/hrService";
import { formatDate } from "../../utils/date";
import { calculateTenure, formatTenure, getTenureDecimals } from "../../utils/tenureUtils";
import { useSyncRefresh, broadcastDataChange } from "../../utils/syncManager";
import "./EmployeeManagement.css";

const AVATAR_PALETTES = [
  { bg: "#ede9fe", text: "#6d28d9" },
  { bg: "#e0f2fe", text: "#0369a1" },
  { bg: "#fef3c7", text: "#b45309" },
  { bg: "#fce7f3", text: "#be185d" },
  { bg: "#dcfce7", text: "#15803d" },
  { bg: "#ccfbf1", text: "#0f766e" },
  { bg: "#fee2e2", text: "#b91c1c" },
];

function getColorForString(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

function getInitials(firstName = "", lastName = "") {
  const f = firstName?.[0] || "";
  const l = lastName?.[0] || "";
  return `${f}${l}`.toUpperCase() || "EM";
}

const emptyForm = {
  employeeCode: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  department: "",
  designation: "",
  entity: "Quadratic Systems Inc.",
  function: "Engineering & Technology",
  costCenter: "CC-101-GEN",
  reportsTo: "",
  matrixManagerId: "",
  joiningDate: "",
  dateOfExit: "",
  employmentType: "Permanent",
  status: "Active",
  salary: "",
  bankName: "",
  accountNumber: "",
  ifsc: "",
  pan: "",
  uan: "",
  aadhaar: "",
  esiNumber: "",
  taxRegime: "New Regime",
  effectiveDate: "",
  changeReason: "",
  grantLogin: false,
  loginRole: "employee",
  loginPassword: "",
};

// Synthesized fallback employees if database is empty
const SAMPLE_EMPLOYEES = [
  {
    _id: "mock-emp-1",
    employeeCode: "DEMO-001",
    firstName: "Alex",
    lastName: "Morgan",
    email: "alex.morgan@hrms.com",
    phone: "+1 555-0192",
    employment: {
      department: "Engineering",
      designation: "Lead Systems Architect",
      joiningDate: "2023-03-15",
      employmentType: "Full Time",
      status: "Active",
    },
    isSample: true,
  },
  {
    _id: "mock-emp-2",
    employeeCode: "DEMO-002",
    firstName: "Sarah",
    lastName: "Chen",
    email: "sarah.chen@hrms.com",
    phone: "+1 555-0143",
    employment: {
      department: "Product",
      designation: "Principal Product Director",
      joiningDate: "2023-06-01",
      employmentType: "Full Time",
      status: "Active",
    },
    isSample: true,
  },
  {
    _id: "mock-emp-3",
    employeeCode: "DEMO-003",
    firstName: "Marcus",
    lastName: "Vance",
    email: "marcus.vance@hrms.com",
    phone: "+1 555-0188",
    employment: {
      department: "Operations",
      designation: "VP of People Operations",
      joiningDate: "2022-11-10",
      employmentType: "Full Time",
      status: "Active",
    },
    isSample: true,
  },
  {
    _id: "mock-emp-4",
    employeeCode: "DEMO-004",
    firstName: "Elena",
    lastName: "Rostova",
    email: "elena.rostova@hrms.com",
    phone: "+1 555-0122",
    employment: {
      department: "Design",
      designation: "Design Systems Lead",
      joiningDate: "2024-01-15",
      employmentType: "Contract",
      status: "Active",
    },
    isSample: true,
  },
  {
    _id: "mock-emp-5",
    employeeCode: "DEMO-005",
    firstName: "David",
    lastName: "Kim",
    email: "david.kim@hrms.com",
    phone: "+1 555-0167",
    employment: {
      department: "Marketing",
      designation: "Growth Marketing Manager",
      joiningDate: "2024-04-01",
      employmentType: "Part Time",
      status: "Inactive",
    },
    isSample: true,
  },
];

function EmployeeManagement() {
  const [apiEmployees, setApiEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [useSampleData, setUseSampleData] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [deptFilter, setDeptFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [tenureFilter, setTenureFilter] = useState("All");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attendance, setAttendance] = useState([]);
  const [showPassword, setShowPassword] = useState(false);

  // Profile Dossier Modal
  const [inspectedEmp, setInspectedEmp] = useState(null);

  const loadEmployees = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [empRes, deptRes, attRes] = await Promise.all([
        getAllEmployees(""),
        getDepartments().catch(() => ({ data: [] })),
        getAllAttendance().catch(() => ({ data: [] })),
      ]);

      const attList = attRes.data || attRes.records || [];
      setAttendance(Array.isArray(attList) ? attList : []);

      const records = empRes.data || empRes.employees || [];
      const rawList = Array.isArray(records) ? records : [];
      const list = rawList.map((emp) => {
        const code = emp.employeeCode || emp.employeeId || "";
        const fName = emp.firstName || emp.name?.split(" ")[0] || "";
        const lName = emp.lastName || (emp.name?.split(" ").slice(1).join(" ")) || "";
        const dept = emp.employment?.department || emp.department || "Engineering";
        const desig = emp.employment?.designation || emp.designation || "Developer";
        const jDate = emp.employment?.joiningDate || emp.joiningDate || "";
        const eType = emp.employment?.employmentType || emp.employmentType || "Full Time";
        const eStat = emp.employment?.status || emp.status || "Active";
        const uObj = emp.user || (emp.grantLogin ? { role: emp.loginRole || "employee", email: emp.email } : null);

        return {
          ...emp,
          _id: emp._id || emp.id,
          id: emp.id || emp._id,
          employeeCode: code,
          firstName: fName,
          lastName: lName,
          name: emp.name || `${fName} ${lName}`.trim(),
          email: emp.email || "",
          phone: emp.phone || "",
          user: uObj,
          employment: {
            department: dept,
            designation: desig,
            joiningDate: jDate,
            employmentType: eType,
            status: eStat,
            dateOfExit: emp.employment?.dateOfExit || emp.dateOfExit || null,
          },
        };
      });

      setApiEmployees(list);

      const deptList = deptRes.data || deptRes.departments || [];
      setDepartments(Array.isArray(deptList) ? deptList : []);

      if (list.length === 0) {
        setUseSampleData(true);
      } else {
        setUseSampleData(false);
      }
    } catch (requestError) {
      if (!silent) setError(requestError.message);
      setUseSampleData(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useSyncRefresh(() => loadEmployees(true), { interval: 4000, silent: true });

  // Active employees list
  const employees = useMemo(() => {
    if (apiEmployees.length > 0 && !useSampleData) {
      return apiEmployees;
    }
    if (useSampleData) {
      return SAMPLE_EMPLOYEES;
    }
    return [];
  }, [apiEmployees, useSampleData]);

  // Distinct department names for dropdown
  const departmentOptions = useMemo(() => {
    const set = new Set();
    departments.forEach((d) => {
      if (d.name) set.add(d.name);
    });
    employees.forEach((e) => {
      if (e.employment?.department) set.add(e.employment.department);
    });
    return Array.from(set);
  }, [departments, employees]);

  // Executive KPI Statistics
  const kpis = useMemo(() => {
    const total = employees.length;
    const active = employees.filter(
      (e) => (e.employment?.status || "Active").toLowerCase() === "active"
    ).length;
    const fullTimeCount = employees.filter(
      (e) => (e.employment?.employmentType || "Full Time").toLowerCase() === "full time"
    ).length;
    const fullTimeRatio = total > 0 ? Math.round((fullTimeCount / total) * 100) : 100;
    const deptCount = departmentOptions.length;

    // Real-time Shift Attendance calculation
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayRecords = attendance.filter((record) => {
      const recDate = record.date ? String(record.date).slice(0, 10) : "";
      const isToday = recDate === todayStr || (record.checkIn && String(record.checkIn).slice(0, 10) === todayStr);
      return isToday && Boolean(record.checkIn);
    });
    const presentToday = todayRecords.length;
    const onDutyNow = todayRecords.filter((r) => !r.checkOut).length;

    return {
      total,
      active,
      fullTimeRatio,
      deptCount,
      presentToday,
      onDutyNow,
    };
  }, [employees, departmentOptions, attendance]);

  // Filtered employees for directory table
  const visibleEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const statusMatches =
        statusFilter === "All" ||
        (employee.employment?.status || "Active") === statusFilter;

      const deptMatches =
        deptFilter === "All" ||
        employee.employment?.department === deptFilter;

      const typeMatches =
        typeFilter === "All" ||
        (employee.employment?.employmentType || "Full Time") === typeFilter;

      const q = search.trim().toLowerCase();
      if (!q) return statusMatches && deptMatches && typeMatches;

      const name = `${employee.firstName || ""} ${employee.lastName || ""}`.toLowerCase();
      const code = (employee.employeeCode || "").toLowerCase();
      const email = (employee.email || "").toLowerCase();
      const dept = (employee.employment?.department || "").toLowerCase();
      const desig = (employee.employment?.designation || "").toLowerCase();

      const textMatches =
        name.includes(q) ||
        code.includes(q) ||
        email.includes(q) ||
        dept.includes(q) ||
        desig.includes(q);

      let tenureMatches = true;
      if (tenureFilter !== "All") {
        const joinDate = employee.employment?.joiningDate;
        if (!joinDate) {
          tenureMatches = false;
        } else {
          const t = calculateTenure(joinDate, employee.employment?.dateOfExit);
          if (tenureFilter === "< 1 Year") tenureMatches = t.years === 0;
          else if (tenureFilter === "1-3 Years") tenureMatches = t.years >= 1 && t.years < 3;
          else if (tenureFilter === "3-5 Years") tenureMatches = t.years >= 3 && t.years < 5;
          else if (tenureFilter === "5+ Years") tenureMatches = t.years >= 5;
        }
      }

      return statusMatches && deptMatches && typeMatches && tenureMatches && textMatches;
    });
  }, [employees, statusFilter, deptFilter, typeFilter, tenureFilter, search]);

  const setField = (event) => {
    const { name, value } = event.target;
    let nextVal = value;
    if (name === "pan" || name === "ifsc") {
      nextVal = value.toUpperCase();
    }
    setForm((current) => ({ ...current, [name]: nextVal }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowPassword(false);
  };

  const employeeName = (employee) =>
    `${employee.firstName || ""} ${employee.lastName || ""}`.trim() ||
    employee.user?.name ||
    "Employee";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    const empCode = (form.employeeCode || "").trim();
    const joinDate = form.joiningDate || new Date().toISOString().slice(0, 10);
    const firstName = (form.firstName || "").trim();
    const email = (form.email || "").trim().toLowerCase();

    if (!firstName || !email) {
      setError("First name and work email are required.");
      return;
    }

    const payload = {
      employeeCode: empCode ? empCode.toUpperCase() : undefined,
      firstName: firstName,
      lastName: (form.lastName || "").trim(),
      email: email,
      phone: (form.phone || "").trim(),
      joiningDate: joinDate,
      reportsTo: form.reportsTo || null,
      matrixManagerId: form.matrixManagerId ? Number(form.matrixManagerId) : null,
      entity: (form.entity || "").trim() || "Quadratic Systems Inc.",
      function: (form.function || "").trim() || "Engineering & Technology",
      costCenter: (form.costCenter || "").trim() || "CC-101-GEN",
      salary: form.salary ? Number(form.salary) * 12 : undefined,
      effectiveDate: form.effectiveDate || new Date().toISOString().slice(0, 10),
      changeReason: (form.changeReason || "").trim() || (editingId ? "Administrative employee update" : "New hire creation"),
      grantLogin: form.grantLogin,
      loginRole: form.loginRole || "employee",
      loginPassword: form.loginPassword ? form.loginPassword.trim() : undefined,
      pan: (form.pan || "").trim().toUpperCase(),
      uan: (form.uan || "").trim(),
      aadhaar: (form.aadhaar || "").trim(),
      esiNumber: (form.esiNumber || "").trim(),
      taxRegime: form.taxRegime || "New Regime",
      banking: {
        bankName: (form.bankName || "").trim(),
        accountNumber: (form.accountNumber || "").trim(),
        ifsc: (form.ifsc || "").trim().toUpperCase(),
      },
      employment: {
        department: (form.department || "").trim() || "Engineering",
        designation: (form.designation || "").trim() || "Developer",
        entity: (form.entity || "").trim() || "Quadratic Systems Inc.",
        function: (form.function || "").trim() || "Engineering & Technology",
        costCenter: (form.costCenter || "").trim() || "CC-101-GEN",
        joiningDate: joinDate,
        dateOfExit: form.status !== "Active" && form.dateOfExit ? form.dateOfExit : null,
        employmentType: form.employmentType || "Permanent",
        status: form.status || "Active",
        salary: form.salary ? Number(form.salary) * 12 : undefined,
      },
    };

    try {
      setSaving(true);
      const canonicalCode = payload.employeeCode;
      if (canonicalCode) {
        sessionStorage.setItem("hrms_selected_employee_id", canonicalCode);
        localStorage.setItem("hrms_selected_employee_id", canonicalCode);
      }

      if (editingId) {
        try {
          const res = await updateEmployeeById(editingId, payload);
          const updatedRecord = res?.data || res?.employee || res;
          if (updatedRecord && (updatedRecord._id || updatedRecord.id || updatedRecord.employeeCode)) {
            setApiEmployees((prev) =>
              prev.map((e) =>
                (String(e.id || e._id) === String(editingId) || String(e.employeeCode) === String(canonicalCode))
                  ? { ...e, ...updatedRecord }
                  : e
              )
            );
            if (inspectedEmp && (String(inspectedEmp.id || inspectedEmp._id) === String(editingId) || String(inspectedEmp.employeeCode) === String(canonicalCode))) {
              setInspectedEmp((curr) => ({ ...curr, ...updatedRecord }));
            }
          }
          setNotice(`Employee record (${canonicalCode}) updated successfully.`);
        } catch (updateErr) {
          if (String(editingId).startsWith("mock-") || updateErr.message?.includes("not found")) {
            await createEmployees([payload]);
            setNotice(`Employee record (${canonicalCode}) created & saved successfully.`);
          } else {
            throw updateErr;
          }
        }
      } else {
        const res = await createEmployees([payload]);
        const createdList = Array.isArray(res?.data) ? res.data : Array.isArray(res?.employees) ? res.employees : Array.isArray(res) ? res : [res?.data || res];
        const createdRecord = createdList[0] || {
          ...payload,
          employeeCode: payload.employeeCode,
          _id: payload.employeeCode,
          name: `${payload.firstName} ${payload.lastName}`.trim(),
        };

        // Instantly reflect in state & turn off sample data
        setApiEmployees((prev) => [createdRecord, ...prev.filter((e) => (e.employeeCode || e._id) !== canonicalCode)]);
        setUseSampleData(false);
        setNotice(`New employee (${canonicalCode}) created successfully.`);
      }

      resetForm();
      await loadEmployees();
      setUseSampleData(false);
      broadcastDataChange();
      window.dispatchEvent(new CustomEvent("hrms:data_changed"));
    } catch (requestError) {
      console.error("Employee submission error:", requestError);
      setError(requestError.message || "Failed to save employee. Please check inputs and try again.");
    } finally {
      setSaving(false);
    }
  };

  const editEmployee = (employee) => {
    const editId = employee._id || employee.employeeCode || employee.id;
    setEditingId(editId);

    const reportsToVal =
      typeof employee.reportsTo === "object" && employee.reportsTo !== null
        ? (employee.reportsTo._id || employee.reportsTo.id || employee.reportsTo.employeeCode || "")
        : (employee.reportsTo || employee.employment?.reportsTo || "");

    setForm({
      employeeCode: employee.employeeCode || "",
      firstName: employee.firstName || "",
      lastName: employee.lastName || "",
      email: employee.email || "",
      phone: employee.phone || employee.phoneNumber || employee.personal?.phone || "",
      department: employee.employment?.department || employee.department || "",
      designation: employee.employment?.designation || employee.designation || "",
      entity: employee.entity || employee.employment?.entity || "Quadratic Systems Inc.",
      function: employee.function || employee.employment?.function || "Engineering & Technology",
      costCenter: employee.costCenter || employee.cost_center || employee.employment?.costCenter || "CC-101-GEN",
      reportsTo: reportsToVal,
      matrixManagerId: employee.matrixReportsTo?.id || employee.matrix_manager_id || employee.matrixManagerId || "",
      salary: (employee.employment?.salary || employee.salary)
        ? String(Math.round(Number(employee.employment?.salary || employee.salary) >= 120000 ? Number(employee.employment?.salary || employee.salary) / 12 : Number(employee.employment?.salary || employee.salary)))
        : "",
      joiningDate: employee.employment?.joiningDate
        ? new Date(employee.employment.joiningDate).toISOString().slice(0, 10)
        : (employee.joiningDate ? new Date(employee.joiningDate).toISOString().slice(0, 10) : ""),
      dateOfExit: employee.employment?.dateOfExit
        ? new Date(employee.employment.dateOfExit).toISOString().slice(0, 10)
        : (employee.dateOfExit ? new Date(employee.dateOfExit).toISOString().slice(0, 10) : ""),
      employmentType: employee.employment?.employmentType || employee.employmentType || "Permanent",
      status: employee.employment?.status || employee.status || "Active",
      bankName: employee.banking?.bankName || employee.bankName || "",
      accountNumber: employee.banking?.accountNumber || employee.accountNumber || "",
      ifsc: employee.banking?.ifsc || employee.ifsc || "",
      pan: employee.pan || employee.statutory?.pan || "",
      uan: employee.uan || employee.statutory?.uan || "",
      aadhaar: employee.aadhaar || employee.statutory?.aadhaar || "",
      esiNumber: employee.esiNumber || employee.esi_number || employee.statutory?.esiNumber || "",
      taxRegime: employee.taxRegime || employee.tax_regime || employee.statutory?.taxRegime || "New Regime",
      effectiveDate: new Date().toISOString().slice(0, 10),
      changeReason: "",
      grantLogin: !!employee.user,
      loginRole: employee.user?.role || "employee",
      loginPassword: "",
    });

    const formEl = document.getElementById("employee-form-card");
    if (formEl) formEl.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const removeEmployee = async (employee) => {
    if (!window.confirm(`Delete ${employeeName(employee)}?`)) return;
    try {
      await deleteEmployeeById(employee._id || employee.id);
      setNotice("Employee deleted successfully.");
      await loadEmployees();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (visibleEmployees.length === 0) return;
    const headers = [
      "Employee Code",
      "First Name",
      "Last Name",
      "Full Name",
      "Email",
      "Phone",
      "Department",
      "Designation",
      "Employment Type",
      "Status",
      "Joining Date",
      "Completed Years",
      "Current Tenure",
    ];

    const rows = visibleEmployees.map((e) => {
      const jDate = e.employment?.joiningDate;
      const t = jDate ? calculateTenure(jDate, e.employment?.dateOfExit) : null;
      return [
      `"${(e.employeeCode || "").replace(/"/g, '""')}"`,
      `"${(e.firstName || "").replace(/"/g, '""')}"`,
      `"${(e.lastName || "").replace(/"/g, '""')}"`,
      `"${employeeName(e).replace(/"/g, '""')}"`,
      `"${(e.email || "").replace(/"/g, '""')}"`,
      `"${(e.phone || "").replace(/"/g, '""')}"`,
      `"${(e.employment?.department || "").replace(/"/g, '""')}"`,
      `"${(e.employment?.designation || "").replace(/"/g, '""')}"`,
      `"${e.employment?.employmentType || "Full Time"}"`,
      `"${e.employment?.status || "Active"}"`,
      `"${jDate ? formatDate(jDate) : "-"}"`,
      `"${t ? t.years : "-"}"`,
      `"${t ? formatTenure(t) : "-"}"`,
    ]});

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Employee_Roster_Directory_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) return <Loader label="Loading executive workforce directory..." />;

  return (
    <>
      <EmployeeHeader />
      <main className="employee-management-hub">
        {/* Top Hero Command Banner */}
        <section className="emp-hero-banner">
          <div className="hero-left-content">
            <div className="hero-kicker-pill">
              <span className="pulsing-live-dot" />
              <span>HR Talent Lifecycle</span>
            </div>
            <h1>Workforce Directory & Employee Management</h1>
            <p>
              Manage employee profiles, onboarding records, departmental assignments,
              and organizational headcount.
            </p>
          </div>

          <div className="hero-actions-cluster">
            <button
              type="button"
              className="hero-btn primary"
              onClick={() => {
                resetForm();
                const formEl = document.getElementById("employee-form-card");
                if (formEl) formEl.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <span>+</span> Add Employee
            </button>

            <button
              type="button"
              className="hero-btn secondary"
              onClick={handleExportCSV}
              disabled={visibleEmployees.length === 0}
              title="Download directory roster as CSV"
            >
              <span>📥</span> Export Roster (CSV)
            </button>

            <Link
              to="/hr/organization"
              className="hero-btn secondary"
              title="View Visual Organization Flowchart"
              style={{ textDecoration: "none" }}
            >
              <span>🌳</span> Org Hierarchy
            </Link>

            <button
              type="button"
              className="hero-btn secondary"
              onClick={loadEmployees}
              title="Refresh employee directory"
            >
              🔄 Refresh
            </button>
          </div>
        </section>

        {/* Global Alert / Notice */}
        {error && (
          <div className="hr-inline-error" role="alert" style={{ marginBottom: "1.5rem" }}>
            ⚠️ {error}
          </div>
        )}
        {notice && (
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: "8px",
              color: "#065f46",
              fontWeight: "600",
              fontSize: "0.88rem",
              marginBottom: "1.5rem",
            }}
            role="status"
          >
            ✓ {notice}
          </div>
        )}

        {/* Demo Indicator banner if using synthesized preview */}
        {useSampleData && (
          <div
            style={{
              padding: "0.75rem 1.15rem",
              background: "#f0fdfa",
              border: "1px solid #ccfbf1",
              borderRadius: "12px",
              color: "#0f766e",
              fontSize: "0.84rem",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1.5rem",
            }}
          >
            <span>
              💡 Previewing realistic workforce directory records. Create a record to populate your database!
            </span>
            <button
              type="button"
              onClick={() => setUseSampleData(false)}
              style={{
                background: "transparent",
                border: "1px solid #0d9488",
                borderRadius: "6px",
                padding: "0.25rem 0.75rem",
                color: "#0d9488",
                fontSize: "0.78rem",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Show Live Backend Only
            </button>
          </div>
        )}

        {/* 4 Executive KPI Cards */}
        <section className="emp-kpi-grid">
          {/* Card 1: Total Headcount */}
          <div className="kpi-card-box teal">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Total Workforce</span>
              <div className="kpi-icon-pod teal">👥</div>
            </div>
            <div className="kpi-stat-row">
              <strong className="kpi-big-num">{kpis.total}</strong>
              <span className="kpi-badge-chip neutral">{kpis.active} Active</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar teal" style={{ width: "100%" }} />
            </div>
            <small className="kpi-subtext">
              {kpis.active} active on payroll · {kpis.total - kpis.active} offboarding/notice
            </small>
          </div>

          {/* Card 2: On-Duty Today */}
          <div className="kpi-card-box emerald">
            <div className="kpi-card-head">
              <span className="kpi-title-text">On-Duty Today</span>
              <div className="kpi-icon-pod emerald">⏱️</div>
            </div>
            <div className="kpi-stat-row">
              <strong className="kpi-big-num">{kpis.presentToday}</strong>
              <span className={`kpi-badge-chip ${kpis.presentToday > 0 ? "positive" : "neutral"}`}>
                {kpis.presentToday > 0 ? `${kpis.presentToday} Clocked In` : "0 Clocked In"}
              </span>
            </div>
            <div className="kpi-progress-rail">
              <div
                className="kpi-progress-bar emerald"
                style={{
                  width: `${
                    kpis.active > 0
                      ? Math.min(100, Math.round((kpis.presentToday / kpis.active) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>
            <small className="kpi-subtext">
              {kpis.presentToday} of {kpis.active} active staff clocked in today ({kpis.onDutyNow} active shift)
            </small>
          </div>

          {/* Card 3: Departments */}
          <div className="kpi-card-box blue">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Departments</span>
              <div className="kpi-icon-pod blue">🏢</div>
            </div>
            <div className="kpi-stat-row">
              <strong className="kpi-big-num">{kpis.deptCount}</strong>
              <span className="kpi-badge-chip neutral">Divisions</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar blue" style={{ width: "85%" }} />
            </div>
            <small className="kpi-subtext">Cross-functional corporate business units</small>
          </div>

          {/* Card 4: Full-Time Ratio */}
          <div className="kpi-card-box purple">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Full-Time Ratio</span>
              <div className="kpi-icon-pod purple">⚡</div>
            </div>
            <div className="kpi-stat-row">
              <strong className="kpi-big-num">{kpis.fullTimeRatio}%</strong>
              <span className="kpi-badge-chip positive">Permanent</span>
            </div>
            <div className="kpi-progress-rail">
              <div
                className="kpi-progress-bar purple"
                style={{ width: `${kpis.fullTimeRatio}%` }}
              />
            </div>
            <small className="kpi-subtext">Standard permanent employment density</small>
          </div>
        </section>

        {/* Main 2-Column Equal-Height Split */}
        <section className="employee-management-layout">
          {/* Column 1: Add / Edit Employee Form */}
          <div id="employee-form-card" className="panel-card-container employee-form-panel">
            <div className="form-panel-header">
              <div>
                <h2>{editingId ? "Edit Employee Profile" : "Register New Employee"}</h2>
                <p>
                  {editingId
                    ? "Modify employee details, job title, and department."
                    : "Fill in the employee credentials to add them to payroll."}
                </p>
              </div>
              {editingId && (
                <button
                  type="button"
                  className="btn-cancel-edit"
                  onClick={resetForm}
                  title="Cancel editing"
                >
                  ✕ Cancel
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="employee-form-grid">
                <div className="emp-input-field">
                  <label htmlFor="form-emp-code">Employee Code (Auto-generated if blank)</label>
                  <input
                    id="form-emp-code"
                    name="employeeCode"
                    value={form.employeeCode}
                    onChange={setField}
                    placeholder="e.g. EMP001 (or auto-assigned)"
                  />
                </div>

                <div className="emp-input-field">
                  <label htmlFor="form-joining-date">Joining Date *</label>
                  <input
                    id="form-joining-date"
                    name="joiningDate"
                    type="date"
                    value={form.joiningDate}
                    onChange={setField}
                    required
                  />
                </div>

                <div className="emp-input-field">
                  <label htmlFor="form-first-name">First Name *</label>
                  <input
                    id="form-first-name"
                    name="firstName"
                    value={form.firstName}
                    onChange={setField}
                    placeholder="e.g. Alex"
                    required
                  />
                </div>

                <div className="emp-input-field">
                  <label htmlFor="form-last-name">Last Name</label>
                  <input
                    id="form-last-name"
                    name="lastName"
                    value={form.lastName}
                    onChange={setField}
                    placeholder="e.g. Morgan"
                  />
                </div>

                <div className="emp-input-field full-col">
                  <label htmlFor="form-email">Work Email *</label>
                  <input
                    id="form-email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={setField}
                    placeholder="alex.morgan@company.com"
                    required
                  />
                </div>

                <div className="emp-input-field full-col">
                  <label htmlFor="form-phone">Phone Number</label>
                  <input
                    id="form-phone"
                    name="phone"
                    value={form.phone}
                    onChange={setField}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div className="emp-input-field">
                  <label htmlFor="form-entity">Corporate Entity</label>
                  <input
                    id="form-entity"
                    name="entity"
                    value={form.entity}
                    onChange={setField}
                    placeholder="e.g. Quadratic Systems Inc."
                  />
                </div>

                <div className="emp-input-field">
                  <label htmlFor="form-function">Function / Business Line</label>
                  <input
                    id="form-function"
                    name="function"
                    value={form.function}
                    onChange={setField}
                    placeholder="e.g. Engineering & Technology"
                  />
                </div>

                <div className="emp-input-field">
                  <label htmlFor="form-cost-center">Cost Center Code</label>
                  <input
                    id="form-cost-center"
                    name="costCenter"
                    value={form.costCenter}
                    onChange={setField}
                    placeholder="e.g. CC-101-GEN"
                  />
                </div>

                <div className="emp-input-field">
                  <label htmlFor="form-dept">Department</label>
                  <input
                    id="form-dept"
                    name="department"
                    list="dept-options"
                    value={form.department}
                    onChange={setField}
                    placeholder="Select or enter"
                  />
                  <datalist id="dept-options">
                    {departmentOptions.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>

                <div className="emp-input-field">
                  <label htmlFor="form-desig">Designation</label>
                  <input
                    id="form-desig"
                    name="designation"
                    value={form.designation}
                    onChange={setField}
                    placeholder="e.g. Senior Engineer"
                  />
                </div>

                <div className="emp-input-field">
                  <label htmlFor="form-reportsTo">Primary Reporting Manager</label>
                  <select
                    id="form-reportsTo"
                    name="reportsTo"
                    value={String(form.reportsTo || "")}
                    onChange={setField}
                  >
                    <option value="">-- No Manager (Root) --</option>
                    {employees
                      .filter(
                        (e) =>
                          String(e._id) !== String(editingId) &&
                          String(e.id) !== String(editingId) &&
                          String(e.employeeCode) !== String(editingId)
                      )
                      .map((emp) => (
                        <option key={emp._id || emp.id} value={String(emp.id || emp._id)}>
                          {emp.name || `${emp.firstName} ${emp.lastName}`} ({emp.employeeCode})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="emp-input-field">
                  <label htmlFor="form-matrix-mgr">Matrix Reporting Manager</label>
                  <select
                    id="form-matrix-mgr"
                    name="matrixManagerId"
                    value={String(form.matrixManagerId || "")}
                    onChange={setField}
                  >
                    <option value="">-- No Matrix Manager --</option>
                    {employees
                      .filter(
                        (e) =>
                          String(e._id) !== String(editingId) &&
                          String(e.id) !== String(editingId) &&
                          String(e.employeeCode) !== String(editingId)
                      )
                      .map((emp) => (
                        <option key={emp._id || emp.id} value={String(emp.id || emp._id)}>
                          {emp.name || `${emp.firstName} ${emp.lastName}`} ({emp.employeeCode})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="emp-input-field">
                  <label htmlFor="form-type">Employment Type</label>
                  <select
                    id="form-type"
                    name="employmentType"
                    value={form.employmentType}
                    onChange={setField}
                  >
                    <option value="Permanent">Permanent</option>
                    <option value="Consultant">Consultant</option>
                    <option value="Contract">Contract</option>
                    <option value="Intern">Intern</option>
                  </select>
                </div>

                <div className="emp-input-field">
                  <label htmlFor="form-salary">Monthly Gross Salary (₹)</label>
                  <input
                    id="form-salary"
                    name="salary"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 50000"
                    value={form.salary}
                    onChange={setField}
                  />
                  {form.salary && Number(form.salary) > 0 && (
                    <small style={{ color: "#64748b", marginTop: "4px", display: "block", fontSize: "0.78rem" }}>
                      Annual CTC: ₹{(Number(form.salary) * 12).toLocaleString("en-IN")}
                    </small>
                  )}
                </div>

                <div className="emp-input-field">
                  <label htmlFor="form-status">Status</label>
                  <select
                    id="form-status"
                    name="status"
                    value={form.status}
                    onChange={setField}
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>

                {form.status === "Inactive" && (
                  <div className="emp-input-field">
                    <label htmlFor="form-date-of-exit">Date of Exit *</label>
                    <input
                      id="form-date-of-exit"
                      name="dateOfExit"
                      type="date"
                      value={form.dateOfExit}
                      onChange={setField}
                      required={form.status === "Inactive"}
                    />
                  </div>
                )}
              </div>

              {/* Editing History Tracking Callout */}
              {editingId && (
                <div style={{ marginTop: "1rem", padding: "1rem 1.25rem", background: "#f8fafc", borderRadius: "12px", border: "1px solid #cbd5e1" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                    <strong style={{ fontSize: "0.88rem", color: "#0f172a", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      📜 Career & Compensation Change Audit
                    </strong>
                    <span style={{ fontSize: "0.72rem", background: "#e0e7ff", color: "#4338ca", padding: "0.2rem 0.55rem", borderRadius: "999px", fontWeight: 750 }}>
                      EMP-009 History Tracker
                    </span>
                  </div>
                  <p style={{ margin: "0 0 0.85rem", color: "#64748b", fontSize: "0.8rem", lineHeight: 1.4 }}>
                    Any revisions to designation, department, reporting manager, or monthly salary will be automatically logged to the PostgreSQL employee history ledger.
                  </p>
                  <div className="employee-form-grid" style={{ marginBottom: 0 }}>
                    <div className="emp-input-field">
                      <label htmlFor="form-effective-date">Effective Date of Change *</label>
                      <input
                        id="form-effective-date"
                        name="effectiveDate"
                        type="date"
                        value={form.effectiveDate || new Date().toISOString().slice(0, 10)}
                        onChange={setField}
                      />
                    </div>
                    <div className="emp-input-field full-col">
                      <label htmlFor="form-change-reason">Reason / Promotion / Transfer Notes</label>
                      <input
                        id="form-change-reason"
                        name="changeReason"
                        value={form.changeReason}
                        onChange={setField}
                        placeholder="e.g. Annual merit appraisal promotion to Senior Architect"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Statutory & Banking Details Block */}
              <div className="emp-statutory-access-block">
                <div className="emp-statutory-header">
                  <h4 className="emp-statutory-title">
                    💳 Statutory & Banking Identifiers
                  </h4>
                  <span className="emp-statutory-pill">HR Managed</span>
                </div>
                <div className="emp-statutory-grid">
                  <div className="emp-input-field">
                    <label htmlFor="form-bank-name">Primary Salary Bank</label>
                    <input
                      id="form-bank-name"
                      name="bankName"
                      value={form.bankName}
                      onChange={setField}
                      placeholder="e.g. AXIS Bank / HDFC Bank"
                    />
                  </div>

                  <div className="emp-input-field">
                    <label htmlFor="form-account-num">Salary Account Number</label>
                    <input
                      id="form-account-num"
                      name="accountNumber"
                      value={form.accountNumber}
                      onChange={setField}
                      placeholder="e.g. 50100234912384"
                      className="emp-code-input"
                    />
                  </div>

                  <div className="emp-input-field">
                    <label htmlFor="form-ifsc">IFSC Branch Code</label>
                    <input
                      id="form-ifsc"
                      name="ifsc"
                      value={form.ifsc}
                      onChange={setField}
                      placeholder="e.g. HDFC0001234"
                      className="emp-code-input"
                    />
                  </div>

                  <div className="emp-input-field">
                    <label htmlFor="form-pan">Income Tax PAN</label>
                    <input
                      id="form-pan"
                      name="pan"
                      value={form.pan}
                      onChange={setField}
                      placeholder="e.g. ABCDE1234F"
                      className="emp-code-input"
                    />
                  </div>

                  <div className="emp-input-field">
                    <label htmlFor="form-aadhaar">Aadhaar Card (UIDAI)</label>
                    <input
                      id="form-aadhaar"
                      name="aadhaar"
                      value={form.aadhaar}
                      onChange={setField}
                      placeholder="e.g. 9876 5432 1098"
                      className="emp-code-input"
                    />
                  </div>

                  <div className="emp-input-field">
                    <label htmlFor="form-uan">Provident Fund (UAN)</label>
                    <input
                      id="form-uan"
                      name="uan"
                      value={form.uan}
                      onChange={setField}
                      placeholder="e.g. 101293847561"
                      className="emp-code-input"
                    />
                  </div>

                  <div className="emp-input-field">
                    <label htmlFor="form-esi">ESI Number (ESIC)</label>
                    <input
                      id="form-esi"
                      name="esiNumber"
                      value={form.esiNumber}
                      onChange={setField}
                      placeholder="e.g. 31000123450000001"
                      className="emp-code-input"
                    />
                  </div>

                  <div className="emp-input-field">
                    <label htmlFor="form-tax-regime">Income Tax Regime Declaration</label>
                    <select
                      id="form-tax-regime"
                      name="taxRegime"
                      value={form.taxRegime}
                      onChange={setField}
                    >
                      <option value="New Regime">New Tax Regime (Sec 115BAC - Default)</option>
                      <option value="Old Regime">Old Tax Regime (Deductions & Exemptions)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Portal Login Access Section */}
              <div className="emp-login-access-block">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <label className="grant-login-label">
                    <input
                      type="checkbox"
                      name="grantLogin"
                      checked={form.grantLogin}
                      onChange={(e) => setForm((prev) => ({ ...prev, grantLogin: e.target.checked }))}
                      style={{ width: "16px", height: "16px", accentColor: "#4f46e5" }}
                    />
                    🔑 Grant / Manage Portal Login Access
                  </label>
                  {editingId && (
                    <span
                      className="emp-login-badge-pill"
                      style={{
                        background: form.grantLogin ? "#dcfce7" : "#fee2e2",
                        color: form.grantLogin ? "#15803d" : "#b91c1c",
                      }}
                    >
                      {form.grantLogin ? "Portal Active" : "No Login Linked"}
                    </span>
                  )}
                </div>

                {form.grantLogin && (
                  <div className="emp-form-grid" style={{ marginTop: "0.75rem" }}>
                    <div className="emp-input-field">
                      <label htmlFor="form-login-role">System Role *</label>
                      <select
                        id="form-login-role"
                        name="loginRole"
                        value={form.loginRole}
                        onChange={setField}
                      >
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                        <option value="hr">HR</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>

                    <div className="emp-input-field">
                      <label htmlFor="form-login-password">
                        {editingId ? "Reset Password (Optional)" : "Set Password *"}
                      </label>
                      <div className="password-input-wrapper">
                        <input
                          id="form-login-password"
                          name="loginPassword"
                          type={showPassword ? "text" : "password"}
                          value={form.loginPassword}
                          onChange={setField}
                          placeholder={editingId ? "Leave blank to keep current" : "e.g. Password@123"}
                        />
                        <button
                          type="button"
                          className="btn-password-toggle"
                          onClick={() => setShowPassword((prev) => !prev)}
                          title={showPassword ? "Hide password" : "Show password"}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          ) : (
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-submit-row">
                <button
                  type="submit"
                  className="btn-save-employee"
                  disabled={saving}
                >
                  {saving
                    ? "Saving Record..."
                    : editingId
                    ? "Update Employee Record"
                    : "Create Employee"}
                </button>
              </div>
            </form>
          </div>

          {/* Column 2: Employee Directory Table */}
          <div className="panel-card-container employee-directory-panel">
            <div className="directory-panel-header">
              <div className="directory-header-info">
                <h2>Workforce Directory</h2>
                <p>
                  Showing {visibleEmployees.length} of {employees.length} employee records
                </p>
              </div>

              <div className="directory-toolbar-filters">
                {/* Search Box */}
                <div className="emp-search-wrap">
                  <svg
                    className="emp-search-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    className="emp-search-input"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, code, dept..."
                    aria-label="Search employee directory"
                  />
                  {search && (
                    <button
                      type="button"
                      className="emp-search-clear"
                      onClick={() => setSearch("")}
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Department Filter */}
                {departmentOptions.length > 0 && (
                  <select
                    className="emp-filter-select"
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                    aria-label="Filter by department"
                  >
                    <option value="All">All Departments</option>
                    {departmentOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                )}

                {/* Status Filter */}
                <select
                  className="emp-filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by status"
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>

                {/* Type Filter */}
                <select
                  className="emp-filter-select"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  aria-label="Filter by employment type"
                >
                  <option value="All">All Types</option>
                  <option value="Full Time">Full Time</option>
                  <option value="Part Time">Part Time</option>
                  <option value="Contract">Contract</option>
                  <option value="Intern">Intern</option>
                </select>

                {/* Tenure Filter */}
                <select
                  className="emp-filter-select"
                  value={tenureFilter}
                  onChange={(e) => setTenureFilter(e.target.value)}
                  aria-label="Filter by tenure"
                >
                  <option value="All">All Tenures</option>
                  <option value="< 1 Year">&lt; 1 Year</option>
                  <option value="1-3 Years">1-3 Years</option>
                  <option value="3-5 Years">3-5 Years</option>
                  <option value="5+ Years">5+ Years</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="emp-table-wrapper">
              <table className="modern-emp-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Code</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Employment</th>
                    <th>Joined</th>
                    <th>Tenure</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEmployees.length === 0 ? (
                    <tr>
                      <td colSpan="9">
                        <div className="emp-empty-box">
                          <span className="emp-empty-icon">👥</span>
                          <h4>No Employees Found</h4>
                          <p>
                            No employee records match your search and filter criteria.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    visibleEmployees.map((employee, index) => {
                      const name = employeeName(employee);
                      const palette = getColorForString(name);
                      const status = (employee.employment?.status || "Active").toLowerCase();
                      const empType = (employee.employment?.employmentType || "Full Time").toLowerCase();

                      return (
                        <tr key={employee._id || employee.id || index}>
                          <td>
                            <div className="emp-avatar-cell">
                              <div
                                className="emp-table-avatar"
                                style={{
                                  backgroundColor: palette.bg,
                                  color: palette.text,
                                }}
                              >
                                {getInitials(employee.firstName, employee.lastName)}
                              </div>
                              <div className="emp-meta-block">
                                <strong className="emp-primary-name">{name}</strong>
                                <span className="emp-sub-email">{employee.email}</span>
                                {employee.user ? (
                                  <span className="emp-login-badge" style={{ fontSize: "0.7rem", color: "#16a34a", display: "inline-flex", alignItems: "center", gap: "3px", fontWeight: "600", marginTop: "2px" }}>
                                    🔑 {employee.user.role ? employee.user.role.toUpperCase() : "LOGIN ENABLED"}
                                  </span>
                                ) : (
                                  <span className="emp-login-badge" style={{ fontSize: "0.7rem", color: "#94a3b8", display: "inline-flex", alignItems: "center", gap: "3px", marginTop: "2px" }}>
                                    ⚠️ No Login Account
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td>
                            <span className="emp-code-pill">
                              {employee.employeeCode || "-"}
                            </span>
                          </td>

                          <td>
                            {employee.employment?.department ? (
                              <span className="emp-dept-chip">
                                {employee.employment.department}
                              </span>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>-</span>
                            )}
                          </td>

                          <td>
                            <strong style={{ fontSize: "0.84rem", color: "#1e293b" }}>
                              {employee.employment?.designation || "-"}
                            </strong>
                          </td>

                          <td>
                            <span
                              className={`emp-type-pill ${
                                empType.includes("contract")
                                  ? "contract"
                                  : empType.includes("intern")
                                  ? "intern"
                                  : ""
                              }`}
                            >
                              {employee.employment?.employmentType || "Full Time"}
                            </span>
                          </td>

                          <td>
                            <span style={{ fontSize: "0.82rem", color: "#475569" }}>
                              {employee.employment?.joiningDate
                                ? formatDate(employee.employment.joiningDate)
                                : "-"}
                            </span>
                          </td>

                          <td>
                            <span style={{ fontSize: "0.82rem", color: "#0d9488", fontWeight: 600 }}>
                              {employee.employment?.joiningDate
                                ? getTenureDecimals(calculateTenure(employee.employment.joiningDate, employee.employment?.dateOfExit))
                                : "-"}
                            </span>
                          </td>

                          <td>
                            <span className={`emp-status-pill ${status}`}>
                              <span className="pulse-dot" />
                              {employee.employment?.status || "Active"}
                            </span>
                          </td>

                          <td>
                            <div className="emp-actions-wrap">
                              <button
                                type="button"
                                className="btn-profile-emp"
                                onClick={() => setInspectedEmp(employee)}
                                title="View employee dossier"
                              >
                                Dossier
                              </button>
                              <button
                                type="button"
                                className="btn-edit-emp"
                                onClick={() => editEmployee(employee)}
                                title="Edit employee record"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn-del-emp"
                                onClick={() => removeEmployee(employee)}
                                title="Delete employee"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Profile Dossier Modal */}
        {inspectedEmp && (
          <div
            className="profile-modal-backdrop"
            onClick={() => setInspectedEmp(null)}
          >
            <div
              className="profile-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="profile-modal-header">
                <div className="profile-header-meta">
                  <div
                    className="profile-big-avatar"
                    style={{
                      backgroundColor: getColorForString(employeeName(inspectedEmp)).bg,
                      color: getColorForString(employeeName(inspectedEmp)).text,
                    }}
                  >
                    {getInitials(inspectedEmp.firstName, inspectedEmp.lastName)}
                  </div>
                  <div className="profile-header-titles">
                    <h3>{employeeName(inspectedEmp)}</h3>
                    <p>
                      {inspectedEmp.employment?.designation || "Staff"} &bull;{" "}
                      {inspectedEmp.employment?.department || "General"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="profile-close-btn"
                  onClick={() => setInspectedEmp(null)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="profile-modal-body">
                <div className="profile-info-grid">
                  <div className="profile-field-item">
                    <span>Employee Code</span>
                    <strong>{inspectedEmp.employeeCode || "-"}</strong>
                  </div>

                  <div className="profile-field-item">
                    <span>Status</span>
                    <strong style={{ textTransform: "capitalize" }}>
                      {inspectedEmp.employment?.status || "Active"}
                    </strong>
                  </div>

                  <div className="profile-field-item">
                    <span>Email Address</span>
                    <strong>{inspectedEmp.email || "-"}</strong>
                  </div>

                  <div className="profile-field-item">
                    <span>Phone Number</span>
                    <strong>{inspectedEmp.phone || "Not specified"}</strong>
                  </div>

                  <div className="profile-field-item">
                    <span>Reporting Manager</span>
                    <strong>
                      {(() => {
                        const ref = inspectedEmp.reportsTo || inspectedEmp.managerId || inspectedEmp.employment?.reportsTo;
                        if (!ref) return "Not assigned";
                        if (typeof ref === "object") {
                          const n = ref.name || `${ref.firstName || ""} ${ref.lastName || ""}`.trim();
                          const c = ref.employeeCode || ref.code;
                          return n && c ? `${n} (${c})` : n || c || "Not assigned";
                        }
                        if (typeof ref === "string" || typeof ref === "number") {
                          const refStr = String(ref);
                          if (/\(EMP\d+\)/i.test(refStr)) return refStr;
                          const found = employees.find(e =>
                            (e._id && String(e._id) === refStr) ||
                            (e.id && String(e.id) === refStr) ||
                            (e.employeeCode && String(e.employeeCode).toUpperCase() === refStr.toUpperCase())
                          );
                          if (found) {
                            const n = found.name || `${found.firstName || ""} ${found.lastName || ""}`.trim();
                            const c = found.employeeCode || "";
                            return c ? `${n} (${c})` : n;
                          }
                          return refStr;
                        }
                        return "Not assigned";
                      })()}
                    </strong>
                  </div>

                  <div className="profile-field-item">
                    <span>Employment Type</span>
                    <strong>{inspectedEmp.employment?.employmentType || "Full Time"}</strong>
                  </div>

                  <div className="profile-field-item">
                    <span>Date of Joining</span>
                    <strong>
                      {inspectedEmp.employment?.joiningDate || inspectedEmp.joiningDate
                        ? formatDate(inspectedEmp.employment?.joiningDate || inspectedEmp.joiningDate)
                        : "-"}
                    </strong>
                  </div>

                  <div className="profile-field-item">
                    <span>Current Tenure</span>
                    <strong style={{ color: "#0d9488" }}>
                      {inspectedEmp.employment?.joiningDate || inspectedEmp.joiningDate
                        ? formatTenure(calculateTenure(inspectedEmp.employment?.joiningDate || inspectedEmp.joiningDate, inspectedEmp.employment?.dateOfExit))
                        : "Not recorded"}
                    </strong>
                  </div>
                </div>

                <div className="profile-quick-navs">
                  <Link
                    to={`/employee/profile?id=${inspectedEmp.employeeCode || inspectedEmp._id}`}
                    className="profile-nav-link"
                    style={{ background: "#0f766e", color: "#ffffff", fontWeight: 700 }}
                    onClick={() => {
                      const code = inspectedEmp.employeeCode || inspectedEmp._id;
                      if (code) {
                        sessionStorage.setItem("hrms_selected_employee_id", code);
                        localStorage.setItem("hrms_selected_employee_id", code);
                      }
                    }}
                  >
                    <span>👤</span> Open Full Profile Tab
                  </Link>
                  <Link to="/hr/documents" className="profile-nav-link">
                    <span>📄</span> View Documents
                  </Link>
                  <Link to="/hr/timesheets" className="profile-nav-link">
                    <span>🕒</span> View Timesheets
                  </Link>
                  <Link to="/hr/dashboard" className="profile-nav-link">
                    <span>🏖️</span> Leave Records
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default EmployeeManagement;
