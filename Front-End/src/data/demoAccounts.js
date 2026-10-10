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
  "employee@hrms.com": {
    firstName: "Demo",
    lastName: "Employee",
    department: "Engineering",
    designation: "Frontend Engineer",
    role: "employee",
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
  } else if (cleanEmail.includes("manager")) {
    firstName = "Demo";
    lastName = "Manager";
    role = "manager";
    department = "Engineering";
    designation = "Engineering Manager";
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
      employment: {
        department: department,
        designation: designation,
        status: "Active",
        employmentType: "Full Time Permanent",
        joiningDate: "2023-01-15",
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
          user: newEmp.grantLogin ? { role: newEmp.loginRole || "employee", email: email } : null,
          employment: {
            department: dept,
            designation: desig,
            status: empStatus,
            employmentType: empType,
            joiningDate: jDate,
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
            employment: {
              ...emp.employment,
              ...(updateData.employment || {}),
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

  // Interactive Clock In handling
  if (norm.includes("/attendance/check-in")) {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const existingStr = localStorage.getItem("hrms_demo_attendance");
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

    localStorage.setItem("hrms_demo_attendance", JSON.stringify(history));
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
    const existingStr = localStorage.getItem("hrms_demo_attendance");
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

    localStorage.setItem("hrms_demo_attendance", JSON.stringify(history));
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
    const existingStr = localStorage.getItem("hrms_demo_attendance");
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
    const existingStr = localStorage.getItem("hrms_demo_attendance");
    let history = existingStr ? JSON.parse(existingStr) : [];

    if (history.length === 0) {
      history = [
        { _id: "att-hist-1", id: "att-hist-1", date: "2026-09-21", checkIn: "2026-09-21T09:00:00.000Z", checkOut: "2026-09-21T18:00:00.000Z", status: "Present", workingHours: 8.5 },
        { _id: "att-hist-2", id: "att-hist-2", date: "2026-09-20", checkIn: "2026-09-20T09:12:00.000Z", checkOut: "2026-09-20T18:15:00.000Z", status: "Present", workingHours: 8.2 },
        { _id: "att-hist-3", id: "att-hist-3", date: "2026-09-19", checkIn: "2026-09-19T08:58:00.000Z", checkOut: "2026-09-19T18:05:00.000Z", status: "Present", workingHours: 8.1 },
      ];
      localStorage.setItem("hrms_demo_attendance", JSON.stringify(history));
    }

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
      { _id: "lt-1", id: "lt-1", name: "Casual Leave", code: "CL", daysAllowed: 12 },
      { _id: "lt-2", id: "lt-2", name: "Sick Leave", code: "SL", daysAllowed: 10 },
      { _id: "lt-3", id: "lt-3", name: "Paid Privilege Leave", code: "PL", daysAllowed: 18 },
      { _id: "lt-4", id: "lt-4", name: "Work From Home", code: "WFH", daysAllowed: 24 },
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
      { leaveType: { _id: "lt-1", name: "Casual Leave", code: "CL" }, total: 12, used: 4, remaining: 8 },
      { leaveType: { _id: "lt-2", name: "Sick Leave", code: "SL" }, total: 10, used: 2, remaining: 8 },
      { leaveType: { _id: "lt-3", name: "Paid Privilege Leave", code: "PL" }, total: 18, used: 3, remaining: 15 },
      { leaveType: { _id: "lt-4", name: "Work From Home", code: "WFH" }, total: 24, used: 6, remaining: 18 },
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
    const payload = {
      _id: "pay-sep-2026",
      id: "pay-sep-2026",
      month: "2026-09",
      basicSalary: 95000,
      allowances: 38000,
      bonus: 15000,
      tax: 12000,
      pf: 6000,
      otherDeductions: 0,
      totalDeductions: 18000,
      grossSalary: 148000,
      netSalary: 130000,
      status: "Generated",
      generatedAt: "2026-09-20T00:00:00.000Z",
      earnings: {
        basicSalary: 95000,
        allowances: 38000,
        bonus: 15000,
      },
      deductions: {
        tax: 12000,
        pf: 6000,
        otherDeductions: 0,
      },
    };

    return {
      success: true,
      data: payload,
      payslip: payload,
      payroll: payload,
      records: [payload],
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
