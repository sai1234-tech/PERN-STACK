import { WORKFORCE_DIRECTORY } from "./workforceDirectory";

// Dictionary of verified accounts & registered team members
const KNOWN_ACCOUNTS = {
  "narsimhakushangala@gmail.com": {
    firstName: "Narsimha",
    lastName: "Kushangala",
    department: "Engineering",
    designation: "Software Engineer",
    role: "employee",
  },
  "simhavahiniganesh@gmail.com": {
    firstName: "Simhavahini",
    lastName: "Ganesh",
    department: "Operations",
    designation: "Operations Specialist",
    role: "employee",
  },
  "anuradha@quadratics.com": {
    firstName: "AnuRadha",
    lastName: "Kushagala",
    department: "Engineering",
    designation: "Software Engineer",
    role: "employee",
  },
  "saikirankushangala@gmail.com": {
    firstName: "SaiKiran",
    lastName: "Kushangala",
    department: "Engineering",
    designation: "Full Stack Engineer",
    role: "employee",
  },
  "kirankushangala@gmail.com": {
    firstName: "Sai Kiran",
    lastName: "Kushangala",
    department: "Engineering",
    designation: "Software Engineer",
    role: "employee",
  },
  "sandhyakushangala@quadratics.com": {
    firstName: "Sandhya",
    lastName: "Rani",
    department: "Engineering",
    designation: "Software Engineer",
    role: "employee",
    salary: 660000,
  },
  "skushangala@quadratics.com": {
    firstName: "SaiKiran",
    lastName: "Kushangala",
    department: "Engineering",
    designation: "Full Stack Engineer",
    role: "employee",
    salary: 900000,
  },
  "manager@hrms.com": {
    firstName: "Demo",
    lastName: "Manager",
    department: "Engineering",
    designation: "Engineering Manager",
    role: "manager",
  },
  "admin@hrms.com": {
    firstName: "System",
    lastName: "Administrator",
    department: "Executive Leadership",
    designation: "Chief Administrator",
    role: "admin",
  },
  "hr@hrms.com": {
    firstName: "Priya",
    lastName: "Nair",
    department: "Human Resources",
    designation: "HR Manager",
    role: "hr",
  },
  "ananyavarma.hr@company.com": {
    firstName: "Ananya",
    lastName: "Varma",
    department: "Human Resources",
    designation: "HR Lead & Operations Manager",
    role: "hr",
  },
  "employee@hrms.com": {
    firstName: "Demo",
    lastName: "Employee",
    department: "Engineering",
    designation: "Frontend Engineer",
    role: "employee",
  },
  "vikasguru@gmail.com": {
    firstName: "Vikas",
    lastName: "Guru",
    department: "Engineering",
    designation: "Team Manager",
    role: "manager",
  },
  "gvikas@quadratics.com": {
    firstName: "Vikas",
    lastName: "Guru",
    department: "Engineering",
    designation: "Team Manager",
    role: "manager",
  },
};

function capitalize(str = "") {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function deriveNameFromEmail(email = "") {
  if (!email) return { firstName: "Employee", lastName: "" };
  const localPart = email.split("@")[0] || "";

  // If camelCase (e.g. simhavahiniGanesh)
  const splitCamel = localPart.replace(/([a-z])([A-Z])/g, "$1 $2");
  if (splitCamel.includes(" ")) {
    const parts = splitCamel.split(" ").filter(Boolean);
    return {
      firstName: capitalize(parts[0]),
      lastName: parts.slice(1).map(capitalize).join(" "),
    };
  }

  // If separated by dot, hyphen, or underscore
  if (/[._-]/.test(localPart)) {
    const parts = localPart.split(/[._-]+/).filter(Boolean);
    return {
      firstName: capitalize(parts[0]),
      lastName: parts.slice(1).map(capitalize).join(" "),
    };
  }

  // Fallback for compound strings like sandhyakushangala or saikirankushangala
  const lower = localPart.toLowerCase();
  if (lower.startsWith("sandhya") && lower.length > 7) {
    return {
      firstName: "Sandhya",
      lastName: capitalize(lower.slice(7)),
    };
  }
  if (lower.startsWith("kushangala") && lower.length > 10) {
    return {
      firstName: capitalize(lower.slice(10)),
      lastName: "Kushangala",
    };
  }

  // Fallback for single continuous string (e.g. narsimhakushangala)
  return {
    firstName: capitalize(localPart),
    lastName: "",
  };
}

export function getDemoFallbackSession(email = "") {
  const cleanEmail = (email || "").trim().toLowerCase();
  const known = KNOWN_ACCOUNTS[cleanEmail];

  let firstName = "";
  let lastName = "";
  let role = "employee";
  let department = "Engineering";
  let designation = "Software Engineer";

  if (known) {
    firstName = known.firstName;
    lastName = known.lastName;
    role = known.role || "employee";
    department = known.department;
    designation = known.designation;
  } else if (cleanEmail.includes("vikas") || cleanEmail.includes("manager") || cleanEmail === "vikasguru@gmail.com" || cleanEmail === "gvikas@quadratics.com") {
    firstName = cleanEmail.includes("vikas") ? "Vikas" : "Demo";
    lastName = cleanEmail.includes("vikas") ? "Guru" : "Manager";
    role = "manager";
    department = "Engineering";
    designation = "Team Manager";
  } else if (cleanEmail.includes("admin")) {
    firstName = "System";
    lastName = "Administrator";
    role = "admin";
    department = "Executive Leadership";
    designation = "System Administrator";
  } else if (cleanEmail.includes("hr")) {
    firstName = "HR";
    lastName = "Manager";
    role = "hr";
    department = "Human Resources";
    designation = "HR Manager";
  } else {
    const derived = deriveNameFromEmail(cleanEmail);
    firstName = derived.firstName;
    lastName = derived.lastName;
    role = "employee";
  }

  const fullName = `${firstName} ${lastName}`.trim();
  const employeeCode = `EMP-${Math.abs(cleanEmail.split("").reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0) % 9000 + 1000)}`;

  return {
    token: `demo-token-${role}-${Date.now()}`,
    user: {
      _id: `user-${cleanEmail.replace(/[^a-z0-9]/g, "")}`,
      name: fullName,
      email: cleanEmail || "employee@hrms.com",
      role: role,
      isDemo: true,
    },
    employee: {
      _id: `emp-${cleanEmail.replace(/[^a-z0-9]/g, "")}`,
      employeeCode: employeeCode,
      firstName: firstName,
      lastName: lastName,
      name: fullName,
      email: cleanEmail || "employee@hrms.com",
      phone: "+91 98000 00000",
      salary: known?.salary || 660000,
      employment: {
        department: department,
        designation: designation,
        status: "Active",
        employmentType: "Full Time Permanent",
        joiningDate: "2023-01-15",
        salary: known?.salary || 660000,
      },
    },
  };
}

export function handleDemoApi(endpoint, options = {}) {
  const norm = endpoint.toLowerCase();
  const method = (options.method || "GET").toUpperCase();

  console.info(`[Demo Mode API] Handled ${method} ${endpoint}`);

  // Current session user / employee resolution (CRITICAL: Must return the logged-in user, not random)
  if (norm.includes("/employee/me") || norm.includes("/auth/me")) {
    const userStr = sessionStorage.getItem("hrms_user");
    const empStr = sessionStorage.getItem("hrms_employee");
    const user = userStr ? JSON.parse(userStr) : null;
    const employee = empStr ? JSON.parse(empStr) : user;

    return {
      success: true,
      data: employee || user,
      employee: employee || user,
      user: user,
    };
  }

  if (norm.includes("/auth/admin-summary")) {
    return {
      success: true,
      data: {
        totalEmployees: 16,
        activeEmployees: 15,
        onLeaveToday: 1,
        pendingTimesheets: 3,
        totalDepartments: 5,
        activeProjects: 8,
        monthlyPayroll: 1845000,
        systemStatus: "Healthy (Demo Mode)",
        recentAudits: [
          { id: "aud-1", action: "Timesheet Approved", user: "HR Team", timestamp: new Date().toISOString() },
          { id: "aud-2", action: "Profile Updated", user: "Self Service", timestamp: new Date().toISOString() },
          { id: "aud-3", action: "Leave Request Approved", user: "Manager", timestamp: new Date().toISOString() },
        ],
      },
    };
  }

  // Directory list & Employee Management CRUD (only when querying collection of employees, NOT /employee/me)
  if (norm.includes("/employees") || norm.includes("/workforce") || norm === "/employee" || norm === "/api/v1/employee") {
    const customEmpsStr = localStorage.getItem("hrms_custom_employees");
    let customEmps = customEmpsStr ? JSON.parse(customEmpsStr) : [];

    if (method === "POST") {
      const parsedBody = options.body ? JSON.parse(options.body) : [];
      const payload = Array.isArray(parsedBody) ? parsedBody : [parsedBody];
      const newlyCreatedList = [];

      payload.forEach((newEmp) => {
        const id = newEmp._id || `custom-emp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const code = (newEmp.employeeCode || newEmp.employeeId || "").trim().toUpperCase() || `EMP${Math.floor(100 + Math.random() * 900)}`;
        const email = (newEmp.email || "").trim().toLowerCase();
        const dept = newEmp.employment?.department || newEmp.department || "Engineering";
        const desig = newEmp.employment?.designation || newEmp.designation || "Developer";
        const jDate = newEmp.employment?.joiningDate || newEmp.joiningDate || new Date().toISOString().slice(0, 10);
        const empType = newEmp.employment?.employmentType || newEmp.employmentType || "Full Time";
        const empStatus = newEmp.employment?.status || newEmp.status || "Active";

        const formattedEmp = {
          _id: id,
          id: id,
          employeeCode: code,
          firstName: newEmp.firstName || "Employee",
          lastName: newEmp.lastName || "",
          name: `${newEmp.firstName || ""} ${newEmp.lastName || ""}`.trim() || "Employee",
          email: email,
          phone: newEmp.phone || "",
          reportsTo: newEmp.reportsTo || null,
          grantLogin: !!newEmp.grantLogin,
          loginRole: newEmp.loginRole || "employee",
          salary: newEmp.salary !== undefined ? newEmp.salary : newEmp.employment?.salary,
          user: newEmp.grantLogin ? { role: newEmp.loginRole || "employee", email: email } : null,
          employment: {
            department: dept,
            designation: desig,
            status: empStatus,
            employmentType: empType,
            joiningDate: jDate,
            salary: newEmp.salary !== undefined ? newEmp.salary : newEmp.employment?.salary,
          },
        };

        const existingIdx = customEmps.findIndex(
          (e) => (email && e.email?.toLowerCase() === email) || (code && e.employeeCode?.toUpperCase() === code)
        );

        if (existingIdx >= 0) {
          customEmps[existingIdx] = { ...customEmps[existingIdx], ...formattedEmp, _id: customEmps[existingIdx]._id || id };
          newlyCreatedList.push(customEmps[existingIdx]);
        } else {
          newlyCreatedList.push(formattedEmp);
          customEmps.unshift(formattedEmp);
        }
      });

      localStorage.setItem("hrms_custom_employees", JSON.stringify(customEmps));
      window.dispatchEvent(new CustomEvent("hrms:data_changed"));

      return {
        success: true,
        message: "Employee saved successfully",
        data: newlyCreatedList,
        employees: newlyCreatedList,
      };
    }

    if (method === "PUT" || method === "PATCH") {
      const idToUpdate = norm.split("/").pop();
      const updateData = options.body ? JSON.parse(options.body) : {};

      customEmps = customEmps.map((emp) => {
        if (emp._id === idToUpdate || emp.id === idToUpdate) {
          return {
            ...emp,
            ...updateData,
            name: updateData.name || `${updateData.firstName || emp.firstName} ${updateData.lastName || emp.lastName}`.trim(),
            salary: updateData.salary !== undefined ? updateData.salary : (updateData.employment?.salary !== undefined ? updateData.employment.salary : emp.salary),
            employment: {
              ...emp.employment,
              ...(updateData.employment || {}),
              salary: updateData.salary !== undefined ? updateData.salary : (updateData.employment?.salary !== undefined ? updateData.employment.salary : emp.employment?.salary),
            },
          };
        }
        return emp;
      });

      localStorage.setItem("hrms_custom_employees", JSON.stringify(customEmps));
      window.dispatchEvent(new CustomEvent("hrms:data_changed"));

      return {
        success: true,
        message: "Employee updated successfully",
        data: customEmps,
      };
    }

    if (method === "DELETE") {
      const idToDelete = norm.split("/").pop();
      customEmps = customEmps.filter((e) => e._id !== idToDelete && e.id !== idToDelete);
      localStorage.setItem("hrms_custom_employees", JSON.stringify(customEmps));
      window.dispatchEvent(new CustomEvent("hrms:data_changed"));
      return { success: true, message: "Employee deleted successfully" };
    }

    const defaultFormatted = WORKFORCE_DIRECTORY.map((emp) => ({
      _id: emp.id,
      id: emp.id,
      employeeCode: emp.employeeCode,
      firstName: emp.firstName,
      lastName: emp.lastName,
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      reportsTo: emp.reportsTo || null,
      employment: {
        department: emp.department,
        designation: emp.designation,
        status: emp.status,
        employmentType: emp.employmentType,
        joiningDate: emp.dateOfJoining,
      },
    }));

    const combined = [...customEmps, ...defaultFormatted];

    return {
      success: true,
      data: combined,
      employees: combined,
    };
  }

  if (norm.includes("/department")) {
    return {
      success: true,
      data: [
        { _id: "d1", name: "Engineering", code: "ENG", headCount: 6, manager: "Dr. Sanjay Verma" },
        { _id: "d2", name: "Product & Design", code: "PRD", headCount: 3, manager: "Meera Krishnan" },
        { _id: "d3", name: "Human Resources", code: "HR", headCount: 2, manager: "Priya Nair" },
        { _id: "d4", name: "Finance & Accounts", code: "FIN", headCount: 2, manager: "Rajesh Iyer" },
        { _id: "d5", name: "Executive Leadership", code: "EXE", headCount: 3, manager: "Dr. Arvind Swaminathan" },
      ],
    };
  }

  // User-scoped demo storage key resolution
  const getUserAttKey = () => {
    try {
      const uStr = sessionStorage.getItem("hrms_user") || sessionStorage.getItem("hrms_employee");
      const uObj = uStr ? JSON.parse(uStr) : null;
      const keyId = uObj?.email || uObj?._id || uObj?.id || "default";
      return `hrms_demo_attendance_${String(keyId).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    } catch (e) {
      return "hrms_demo_attendance_default";
    }
  };

  // Interactive Clock In handling
  if (norm.includes("/attendance/check-in")) {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const attKey = getUserAttKey();
    const existingStr = localStorage.getItem(attKey);
    let history = existingStr ? JSON.parse(existingStr) : [];

    let todayRecord = history.find((r) => (r.date || "").startsWith(today));
    if (!todayRecord) {
      todayRecord = {
        _id: `att-demo-${Date.now()}`,
        id: `att-demo-${Date.now()}`,
        date: today,
        checkIn: now.toISOString(),
        checkOut: null,
        status: "Present",
        workingHours: 0,
      };
      history.unshift(todayRecord);
    } else if (!todayRecord.checkIn) {
      todayRecord.checkIn = now.toISOString();
    }

    localStorage.setItem(attKey, JSON.stringify(history));
    window.dispatchEvent(new CustomEvent("hrms:data_changed"));

    return {
      success: true,
      message: "Check-in successful",
      data: {
        attendance: todayRecord,
      },
    };
  }

  // Interactive Clock Out handling
  if (norm.includes("/attendance/check-out")) {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const attKey = getUserAttKey();
    const existingStr = localStorage.getItem(attKey);
    let history = existingStr ? JSON.parse(existingStr) : [];

    let todayRecord = history.find((r) => (r.date || "").startsWith(today));
    if (todayRecord) {
      todayRecord.checkOut = now.toISOString();
      const inTime = new Date(todayRecord.checkIn).getTime();
      const outTime = now.getTime();
      const diffHours = Math.max(0.1, Number(((outTime - inTime) / (1000 * 60 * 60)).toFixed(2)));
      todayRecord.workingHours = diffHours;
      todayRecord.status = "Completed";
    }

    localStorage.setItem(attKey, JSON.stringify(history));
    window.dispatchEvent(new CustomEvent("hrms:data_changed"));

    return {
      success: true,
      message: "Check-out successful",
      data: {
        attendance: todayRecord,
      },
    };
  }

  // Today's attendance query
  if (norm.includes("/attendance/today")) {
    const today = new Date().toISOString().slice(0, 10);
    const attKey = getUserAttKey();
    const existingStr = localStorage.getItem(attKey);
    const history = existingStr ? JSON.parse(existingStr) : [];
    const todayRecord = history.find((r) => (r.date || "").startsWith(today));

    if (todayRecord && todayRecord.checkIn) {
      return {
        success: true,
        data: {
          attendance: todayRecord,
        },
        attendance: todayRecord,
      };
    }

    return {
      success: true,
      data: null,
      message: "No attendance found for today",
    };
  }

  // History & ledger query
  if (norm.includes("/attendance")) {
    const attKey = getUserAttKey();
    const existingStr = localStorage.getItem(attKey);
    let history = existingStr ? JSON.parse(existingStr) : [];

    return {
      success: true,
      data: history,
      records: history,
    };
  }

  if (norm.includes("/timesheet")) {
    const today = new Date().toISOString().slice(0, 10);
    return {
      success: true,
      data: {
        entries: [
          { id: "ts-1", date: today, hours: 8, project: "HRMS Enterprise Portal", task: "Feature testing & review", status: "submitted" },
          { id: "ts-2", date: "2026-09-21", hours: 8, project: "HRMS Enterprise Portal", task: "Core UI Flow", status: "approved" },
          { id: "ts-3", date: "2026-09-20", hours: 8, project: "Platform Architecture", task: "Vite and Netlify Deployment", status: "approved" },
        ],
        status: "submitted",
        totalHours: 40,
      },
    };
  }

  // LEAVES API
  if (norm.includes("/leaves/types") || norm.includes("/leave/types")) {
    const types = [
      { _id: "lt-1", id: 1, name: "Casual Leave", code: "CL", daysAllowed: 12, annualAllocation: 12, annual_allocation: 12, isPaid: true },
      { _id: "lt-2", id: 2, name: "Sick Leave", code: "SL", daysAllowed: 12, annualAllocation: 12, annual_allocation: 12, isPaid: true },
      { _id: "lt-3", id: 3, name: "Paid Privilege Leave", code: "PL", daysAllowed: 18, annualAllocation: 18, annual_allocation: 18, isPaid: true },
      { _id: "lt-4", id: 4, name: "Work From Home", code: "WFH", daysAllowed: 24, annualAllocation: 24, annual_allocation: 24, isPaid: true },
    ];
    return {
      success: true,
      data: types,
      types: types,
      leaveTypes: types,
    };
  }

  if (norm.includes("/leaves/balance") || norm.includes("/leave/balance")) {
    const balances = [
      {
        leaveType: { _id: "lt-1", id: 1, name: "Casual Leave", code: "CL", annualAllocation: 12 },
        annualAllocation: 12,
        annual_allocation: 12,
        total: 12,
        used: 0,
        pending: 0,
        available: 12,
        remaining: 12
      },
      {
        leaveType: { _id: "lt-2", id: 2, name: "Sick Leave", code: "SL", annualAllocation: 12 },
        annualAllocation: 12,
        annual_allocation: 12,
        total: 12,
        used: 0,
        pending: 0,
        available: 12,
        remaining: 12
      },
      {
        leaveType: { _id: "lt-3", id: 3, name: "Paid Privilege Leave", code: "PL", annualAllocation: 18 },
        annualAllocation: 18,
        annual_allocation: 18,
        total: 18,
        used: 0,
        pending: 0,
        available: 18,
        remaining: 18
      },
      {
        leaveType: { _id: "lt-4", id: 4, name: "Work From Home", code: "WFH", annualAllocation: 24 },
        annualAllocation: 24,
        annual_allocation: 24,
        total: 24,
        used: 0,
        pending: 0,
        available: 24,
        remaining: 24
      },
    ];
    return {
      success: true,
      data: balances,
      balance: balances,
    };
  }

  if (norm.includes("/leaves") || norm.includes("/leave")) {
    if (method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE") {
      window.dispatchEvent(new CustomEvent("hrms:data_changed"));
      return { success: true, message: "Leave action saved successfully" };
    }

    const requests = [
      {
        _id: "lv-1",
        id: "lv-1",
        leaveType: { _id: "lt-1", name: "Casual Leave", code: "CL" },
        startDate: "2026-09-28",
        endDate: "2026-09-29",
        days: 2,
        reason: "Family engagement",
        status: "Approved",
        appliedAt: "2026-09-18T10:30:00Z",
      },
      {
        _id: "lv-2",
        id: "lv-2",
        leaveType: { _id: "lt-2", name: "Sick Leave", code: "SL" },
        startDate: "2026-09-12",
        endDate: "2026-09-12",
        days: 1,
        reason: "Medical appointment",
        status: "Approved",
        appliedAt: "2026-09-11T09:15:00Z",
      },
      {
        _id: "lv-3",
        id: "lv-3",
        leaveType: { _id: "lt-4", name: "Work From Home", code: "WFH" },
        startDate: "2026-09-04",
        endDate: "2026-09-05",
        days: 2,
        reason: "Home internet installation",
        status: "Approved",
        appliedAt: "2026-09-02T14:00:00Z",
      },
    ];

    return {
      success: true,
      data: requests,
      leaves: requests,
      records: requests,
    };
  }

  // PAYROLL API
  if (norm.includes("/payroll")) {
    let customPayrolls = [];
    try {
      customPayrolls = JSON.parse(localStorage.getItem("hrms_custom_payroll") || "[]");
    } catch (e) {
      customPayrolls = [];
    }

    const currentPeriod = new Date().toISOString().slice(0, 7);

    const deriveBreakdown = (salaryInput) => {
      const num = Number(salaryInput || 0);
      const annual = num > 0 && num < 300000 ? num * 12 : num;
      const monthly = Math.round(annual / 12);
      const basic = Math.round(monthly * 0.5);
      const allow = Math.round(monthly * 0.5);
      const pf = monthly > 0 ? Math.min(Math.round(basic * 0.12), 3600) : 0;
      const tax = monthly > 0 ? 200 : 0;
      const ded = Math.round(monthly * 0.08);
      const totalDed = pf + tax + ded;
      const net = Math.max(0, monthly - totalDed);
      return { annual, monthly, basic, allow, pf, tax, ded, totalDed, net };
    };

    // 1. HR Update/Save Payroll Record
    if (
      (method === "PUT" || method === "POST") &&
      (norm.includes("/records") || norm.includes("/record") || norm.includes("/employees/"))
    ) {
      const body = options.body ? JSON.parse(options.body) : {};
      const empId = String(body.employeeId || body.id || norm.split("/").pop());
      const pMonth = body.month || currentPeriod;

      const basic = Number(body.basicSalary || 0);
      const allow = Number(body.allowances || 0);
      const bonus = Number(body.bonus || 0);
      const tax = Number(body.tax || 0);
      const pf = Number(body.pf || 0);
      const deduction = Number(body.deduction || body.otherDeductions || 0);

      const grossSalary = body.grossSalary !== undefined ? Number(body.grossSalary) : (basic + allow + bonus);
      const totalDeductions = body.totalDeductions !== undefined ? Number(body.totalDeductions) : (tax + pf + deduction);
      const netSalary = body.netSalary !== undefined ? Number(body.netSalary) : Math.max(0, grossSalary - totalDeductions);
      const status = body.status || "generated";

      const targetEmp = customEmps.find((e) =>
        String(e._id) === String(empId) ||
        String(e.id) === String(empId) ||
        String(e.employeeCode) === String(empId) ||
        (body.employee?.email && e.email?.toLowerCase() === body.employee.email.toLowerCase())
      ) || body.employee;

      const updatedRecord = {
        _id: `pay-${empId}-${pMonth}`,
        id: `pay-${empId}-${pMonth}`,
        employeeId: empId,
        employee: targetEmp,
        month: pMonth,
        annualSalary: grossSalary * 12,
        monthlySalary: grossSalary,
        basicSalary: basic,
        allowances: allow,
        bonus: bonus,
        tax: tax,
        pf: pf,
        deduction: deduction,
        otherDeductions: deduction,
        grossSalary,
        totalDeductions,
        netSalary,
        status,
        generatedAt: new Date().toISOString(),
        earnings: { basicSalary: basic, allowances: allow, bonus },
        deductions: { tax, pf, otherDeductions: deduction },
      };

      const existingIndex = customPayrolls.findIndex(
        (p) => String(p.employeeId) === empId && String(p.month).slice(0, 7) === String(pMonth).slice(0, 7)
      );

      if (existingIndex >= 0) {
        customPayrolls[existingIndex] = { ...customPayrolls[existingIndex], ...updatedRecord };
      } else {
        customPayrolls.unshift(updatedRecord);
      }

      localStorage.setItem("hrms_custom_payroll", JSON.stringify(customPayrolls));

      if (grossSalary > 0) {
        customEmps = customEmps.map((e) => {
          if (
            String(e._id) === String(empId) ||
            String(e.id) === String(empId) ||
            String(e.employeeCode) === String(empId) ||
            (body.employee?.email && e.email?.toLowerCase() === body.employee.email.toLowerCase())
          ) {
            return {
              ...e,
              salary: grossSalary * 12,
              employment: { ...(e.employment || {}), salary: grossSalary * 12 },
            };
          }
          return e;
        });
        localStorage.setItem("hrms_custom_employees", JSON.stringify(customEmps));

        // Sync active session employee if it matches this employee
        try {
          const storedEmp = JSON.parse(sessionStorage.getItem("hrms_employee") || "null");
          if (
            storedEmp &&
            (String(storedEmp.id) === String(empId) ||
              String(storedEmp._id) === String(empId) ||
              String(storedEmp.employeeCode) === String(empId) ||
              (body.employee?.email && storedEmp.email?.toLowerCase() === body.employee.email.toLowerCase()))
          ) {
            storedEmp.salary = grossSalary * 12;
            if (storedEmp.employment) storedEmp.employment.salary = grossSalary * 12;
            sessionStorage.setItem("hrms_employee", JSON.stringify(storedEmp));
          }
        } catch (e) {}
      }

      window.dispatchEvent(new CustomEvent("hrms_data_updated", { detail: { category: "payroll" } }));
      window.dispatchEvent(new CustomEvent("hrms:data_changed"));

      return {
        success: true,
        message: "Payroll record updated successfully",
        data: updatedRecord,
      };
    }

    // 2. HR Update Salary
    if (method === "PATCH" && norm.includes("/salary")) {
      const empId = norm.split("/employees/")[1]?.split("/")[0];
      const body = options.body ? JSON.parse(options.body) : {};
      const newSal = Number(body.salary || 0);
      const b = deriveBreakdown(newSal);

      customEmps = customEmps.map((e) => {
        if (String(e._id) === String(empId) || String(e.id) === String(empId) || String(e.employeeCode) === String(empId)) {
          return {
            ...e,
            salary: b.annual,
            employment: { ...(e.employment || {}), salary: b.annual },
          };
        }
        return e;
      });
      localStorage.setItem("hrms_custom_employees", JSON.stringify(customEmps));

      // Synchronize matching record in customPayrolls
      const pMonth = body.month || currentPeriod;
      const updatedPayroll = {
        _id: `pay-${empId}-${pMonth}`,
        id: `pay-${empId}-${pMonth}`,
        employeeId: empId,
        month: pMonth,
        basicSalary: b.basic,
        allowances: b.allow,
        bonus: 0,
        tax: b.tax,
        pf: b.pf,
        deduction: b.ded,
        otherDeductions: b.ded,
        grossSalary: b.monthly,
        totalDeductions: b.totalDed,
        netSalary: b.net,
        status: "generated",
        generatedAt: new Date().toISOString(),
        earnings: { basicSalary: b.basic, allowances: b.allow, bonus: 0 },
        deductions: { tax: b.tax, pf: b.pf, otherDeductions: b.ded },
      };

      const existingIndex = customPayrolls.findIndex(
        (p) => String(p.employeeId) === String(empId) && String(p.month).slice(0, 7) === String(pMonth).slice(0, 7)
      );

      if (existingIndex >= 0) {
        customPayrolls[existingIndex] = { ...customPayrolls[existingIndex], ...updatedPayroll };
      } else {
        customPayrolls.unshift(updatedPayroll);
      }
      localStorage.setItem("hrms_custom_payroll", JSON.stringify(customPayrolls));

      // Sync active session employee if it matches this employee
      try {
        const storedEmp = JSON.parse(sessionStorage.getItem("hrms_employee") || "null");
        if (storedEmp && (String(storedEmp.id) === String(empId) || String(storedEmp._id) === String(empId) || String(storedEmp.employeeCode) === String(empId))) {
          storedEmp.salary = b.annual;
          if (storedEmp.employment) storedEmp.employment.salary = b.annual;
          sessionStorage.setItem("hrms_employee", JSON.stringify(storedEmp));
        }
      } catch (e) {}

      window.dispatchEvent(new CustomEvent("hrms_data_updated", { detail: { category: "payroll" } }));
      window.dispatchEvent(new CustomEvent("hrms:data_changed"));
      return { success: true, message: "Salary updated successfully" };
    }

    // 3. HR Generate Payroll
    if (method === "POST" && norm.includes("/generate")) {
      const body = options.body ? JSON.parse(options.body) : {};
      const targetMonth = body.month || currentPeriod;

      const generated = customEmps.map((emp) => {
        const empSalary = emp.employment?.salary || emp.salary || 0;
        const b = deriveBreakdown(empSalary);
        const record = {
          _id: `pay-${emp._id || emp.id}-${targetMonth}`,
          id: `pay-${emp._id || emp.id}-${targetMonth}`,
          employeeId: emp._id || emp.id,
          employee: emp,
          month: targetMonth,
          basicSalary: b.basic,
          allowances: b.allow,
          bonus: 0,
          tax: b.tax,
          pf: b.pf,
          deduction: b.ded,
          otherDeductions: b.ded,
          grossSalary: b.monthly,
          totalDeductions: b.totalDed,
          netSalary: b.net,
          status: "generated",
          generatedAt: new Date().toISOString(),
          earnings: { basicSalary: b.basic, allowances: b.allow, bonus: 0 },
          deductions: { tax: b.tax, pf: b.pf, otherDeductions: b.ded },
        };
        return record;
      });

      customPayrolls = generated;
      localStorage.setItem("hrms_custom_payroll", JSON.stringify(customPayrolls));
      window.dispatchEvent(new CustomEvent("hrms:data_changed"));

      return {
        success: true,
        message: `Payroll generated for ${generated.length} employees`,
        data: generated,
      };
    }

    // 4. Employee Self-Service: /payroll/my/salary or /payroll/my/payslip
    if (norm.includes("/my/salary") || norm.includes("/my/payslip")) {
      let authUser = null;
      try {
        authUser = JSON.parse(
          sessionStorage.getItem("hrms_user") ||
          sessionStorage.getItem("hrms_employee") ||
          localStorage.getItem("hrms_user") ||
          localStorage.getItem("user") ||
          sessionStorage.getItem("user") ||
          "null"
        );
      } catch (e) {}

      const userEmail = (authUser?.email || "").toLowerCase().trim();
      const matchedEmp = customEmps.find((e) => e.email?.toLowerCase().trim() === userEmail) || authUser;

      const requestedMonth = (endpoint.split("month=")[1] || currentPeriod).slice(0, 7);

      const existingRecord = customPayrolls.find(
        (p) => (String(p.employeeId) === String(matchedEmp?._id || matchedEmp?.id) || p.employee?.email === userEmail) &&
               String(p.month).slice(0, 7) === requestedMonth
      );

      if (existingRecord) {
        return {
          success: true,
          data: existingRecord,
          payslip: existingRecord,
          payroll: existingRecord,
        };
      }

      // If no generated record, derive dynamically from matched employee's real salary
      const configuredSalary = matchedEmp?.employment?.salary || matchedEmp?.salary || 0;

      if (!configuredSalary || Number(configuredSalary) <= 0) {
        const emptyState = {
          month: requestedMonth,
          employee: matchedEmp,
          basicSalary: 0,
          allowances: 0,
          bonus: 0,
          tax: 0,
          pf: 0,
          deduction: 0,
          otherDeductions: 0,
          grossSalary: 0,
          totalDeductions: 0,
          netSalary: 0,
          status: "not_generated",
          message: "Salary not configured",
        };
        return {
          success: true,
          data: emptyState,
          payslip: emptyState,
          payroll: emptyState,
        };
      }

      const b = deriveBreakdown(configuredSalary);
      const dynamicSummary = {
        _id: `pay-${matchedEmp?._id || "my"}-${requestedMonth}`,
        id: `pay-${matchedEmp?._id || "my"}-${requestedMonth}`,
        month: requestedMonth,
        employee: matchedEmp,
        basicSalary: b.basic,
        allowances: b.allow,
        bonus: 0,
        tax: b.tax,
        pf: b.pf,
        deduction: b.ded,
        otherDeductions: b.ded,
        grossSalary: b.monthly,
        totalDeductions: b.totalDed,
        netSalary: b.net,
        status: "not_generated",
        message: "Awaiting payroll run",
        earnings: { basicSalary: b.basic, allowances: b.allow, bonus: 0 },
        deductions: { tax: b.tax, pf: b.pf, otherDeductions: b.ded },
      };

      return {
        success: true,
        data: dynamicSummary,
        payslip: dynamicSummary,
        payroll: dynamicSummary,
      };
    }

    // 5. Default GET /payroll: HR Register
    const targetMonth = (endpoint.split("month=")[1] || currentPeriod).slice(0, 7);
    const records = customEmps.map((emp) => {
      const match = customPayrolls.find(
        (p) => String(p.employeeId) === String(emp._id || emp.id) && String(p.month).slice(0, 7) === targetMonth
      );
      if (match) return match;
      const b = deriveBreakdown(emp.employment?.salary || emp.salary || 0);
      return {
        _id: `pay-${emp._id || emp.id}-${targetMonth}`,
        id: `pay-${emp._id || emp.id}-${targetMonth}`,
        employeeId: emp._id || emp.id,
        employee: emp,
        month: targetMonth,
        basicSalary: b.basic,
        allowances: b.allow,
        bonus: 0,
        tax: b.tax,
        pf: b.pf,
        deduction: b.ded,
        otherDeductions: b.ded,
        grossSalary: b.monthly,
        totalDeductions: b.totalDed,
        netSalary: b.net,
        status: b.monthly > 0 ? "generated" : "not_generated",
        earnings: { basicSalary: b.basic, allowances: b.allow, bonus: 0 },
        deductions: { tax: b.tax, pf: b.pf, otherDeductions: b.ded },
      };
    });

    return {
      success: true,
      data: records,
      records: records,
    };
  }

  // DOCUMENTS API
  if (norm.includes("/documents/types") || norm.includes("/document/types")) {
    const types = [
      "Aadhaar / National ID",
      "PAN Card",
      "Passport",
      "Academic Degree",
      "Offer Letter",
      "Relieving Letter",
    ];
    return {
      success: true,
      data: types,
    };
  }

  if (norm.includes("/documents") || norm.includes("/document")) {
    if (method === "POST" || method === "PUT" || method === "DELETE") {
      window.dispatchEvent(new CustomEvent("hrms:data_changed"));
      return { success: true, message: "Document saved successfully" };
    }

    const docs = [
      {
        _id: "doc-1",
        id: "doc-1",
        documentType: "Aadhaar / National ID",
        documentName: "Aadhaar_National_ID.pdf",
        status: "verified",
        uploadedAt: "2026-08-10T10:00:00Z",
      },
      {
        _id: "doc-2",
        id: "doc-2",
        documentType: "PAN Card",
        documentName: "PAN_Card_Verified.pdf",
        status: "verified",
        uploadedAt: "2026-08-10T10:05:00Z",
      },
      {
        _id: "doc-3",
        id: "doc-3",
        documentType: "Academic Degree",
        documentName: "Bachelor_Degree_Certificate.pdf",
        status: "approved",
        uploadedAt: "2026-08-12T15:30:00Z",
      },
    ];

    return {
      success: true,
      data: docs,
      documents: docs,
    };
  }

  // TICKETS / HELPDESK API
  if (norm.includes("/ticket")) {
    const tickets = [
      {
        _id: "t-1",
        id: "t-1",
        ticketNumber: "TICK-101",
        title: "VPN Profile Setup for Remote Work",
        category: "IT Support",
        priority: "Medium",
        status: "Resolved",
        createdAt: "2026-09-15T09:00:00Z",
      },
      {
        _id: "t-2",
        id: "t-2",
        ticketNumber: "TICK-102",
        title: "Tax Deduction Certificate Request",
        category: "Finance & Payroll",
        priority: "Low",
        status: "In Progress",
        createdAt: "2026-09-18T11:20:00Z",
      },
    ];

    return {
      success: true,
      data: tickets,
      tickets: tickets,
    };
  }

  // PERFORMANCE API
  if (norm.includes("/performance")) {
    const existingStr = localStorage.getItem("hrms_demo_okrs");
    let okrs = existingStr ? JSON.parse(existingStr) : [];
    
    // Create OKR
    if (method === "POST") {
      try {
        const body = options.body ? JSON.parse(options.body) : {};
        const employeeStr = sessionStorage.getItem("hrms_employee") || sessionStorage.getItem("hrms_user");
        const emp = employeeStr ? JSON.parse(employeeStr) : { firstName: "Demo", lastName: "User", email: "demo@example.com" };
        
        const newOkr = {
          _id: `okr-demo-${Date.now()}`,
          objective: body.objective || "Sample Objective",
          result: "Pending Review",
          score: 0,
          employee: {
            _id: emp._id || emp.id,
            firstName: emp.firstName,
            lastName: emp.lastName,
            email: emp.email
          },
          createdAt: new Date().toISOString(),
        };
        okrs.push(newOkr);
        localStorage.setItem("hrms_demo_okrs", JSON.stringify(okrs));
        window.dispatchEvent(new CustomEvent("hrms:data_changed"));
        
        return { success: true, data: newOkr };
      } catch (e) {
        console.error(e);
      }
    }
    
    // Rate OKR
    if (method === "PUT" && norm.includes("/rate")) {
      const parts = norm.split("/");
      const id = parts[parts.indexOf("performance") + 1];
      const body = options.body ? JSON.parse(options.body) : {};
      
      let updatedOkr = null;
      okrs = okrs.map(o => {
        if (o._id === id) {
          updatedOkr = { ...o, score: body.score, feedback: body.feedback || "", result: "Reviewed" };
          return updatedOkr;
        }
        return o;
      });
      localStorage.setItem("hrms_demo_okrs", JSON.stringify(okrs));
      window.dispatchEvent(new CustomEvent("hrms:data_changed"));
      
      return { success: true, data: updatedOkr };
    }

    // Get My or All OKRs
    if (method === "GET") {
      // Sort by descending createdAt
      const sortedOkrs = [...okrs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      if (norm.includes("/my")) {
        const empStr = sessionStorage.getItem("hrms_employee") || sessionStorage.getItem("hrms_user");
        const user = empStr ? JSON.parse(empStr) : null;
        
        const myOkrs = sortedOkrs.filter(o => {
          if (!user) return true; // fallback
          return o.employee._id === user._id || o.employee._id === user.id;
        });
        return { success: true, data: myOkrs };
      }
      
      console.log("Demo API returning all OKRs for Manager:", sortedOkrs);
      // All
      return { success: true, data: sortedOkrs };
    }
  }

  // Fallback for any other endpoint
  return {
    success: true,
    data: {},
    message: "Action simulated successfully in Demo Mode",
  };
}
