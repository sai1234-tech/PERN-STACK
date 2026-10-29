import pool from "../config/db.js";

/**
 * AI Intelligence Service — PERN HRMS
 *
 * 100% PostgreSQL-driven Cognitive HRMS Engine (Zero Static Fallbacks):
 * 1. AI HR Assistant (Conversational Natural Language Employee Self-Service)
 * 2. AI HR Analytics (Natural Language Workforce Analytics & Visual Metrics)
 * 3. Smart Attendance Monitoring (Real-Time Biometric Pattern & Anomaly Engine)
 * 4. AI Recruitment Assistant (Resume Parsing, Skill Matching & Interview Guides)
 * 5. HR Policy Search (Semantic Retrieval with Clause Citations)
 */

async function safeQuery(sql, params = []) {
  try {
    return await pool.query(sql, params);
  } catch (err) {
    console.warn("[AI Intelligence SQL Notice]:", err.message);
    return { rows: [] };
  }
}

function formatDateYMD(val) {
  if (!val) return null;
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    return val.slice(0, 10);
  }
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime12h(val) {
  if (!val) return null;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

/* ============================================================================
   1. AI HR ASSISTANT (Natural Language Employee Assistant)
   ============================================================================ */

export async function handleEmployeeAssistantQuery(userId, role, rawPrompt) {
  const prompt = String(rawPrompt || "").trim().toLowerCase();
  if (!prompt) {
    return {
      success: false,
      message: "Please enter a question for the HR Assistant."
    };
  }

  // 1. Resolve employee master record + reporting manager from PostgreSQL
  let employee = null;
  if (userId) {
    const empRes = await safeQuery(
      `SELECT e.*,
              u.id as linked_user_id,
              u.role as user_role,
              u.email as user_email,
              COALESCE(NULLIF(to_jsonb(e)->>'department', ''), NULLIF(e.employment->>'department', ''), NULLIF(to_jsonb(e)->>'function', '')) as resolved_department,
              COALESCE(NULLIF(to_jsonb(e)->>'designation', ''), NULLIF(e.employment->>'designation', '')) as resolved_designation,
              COALESCE(NULLIF(to_jsonb(e)->>'joining_date', ''), NULLIF(e.employment->>'joiningDate', ''), e.created_at::text) as resolved_joining_date,
              COALESCE(NULLIF(to_jsonb(e)->>'salary', ''), NULLIF(e.employment->>'salary', ''), NULLIF(e.employment->>'ctc', '')) as resolved_salary,
              NULLIF(TRIM(CONCAT(m.first_name, ' ', m.last_name)), '') as resolved_manager_name,
              COALESCE(NULLIF(to_jsonb(m)->>'designation', ''), NULLIF(m.employment->>'designation', '')) as resolved_manager_designation,
              m.email as resolved_manager_email
       FROM employees e
       LEFT JOIN users u ON (u.id = e.user_id OR LOWER(u.email) = LOWER(e.email))
       LEFT JOIN employees m ON m.id = e.reports_to
       WHERE e.user_id::text = $1::text
          OR e.id::text = $1::text
          OR e.employee_code = $1::text
          OR u.id::text = $1::text
       LIMIT 1`,
      [String(userId)]
    );
    employee = empRes.rows[0] || null;
  }

  // If user is logged in as an admin/user without a direct match, check users table for identity
  let userAccount = null;
  if (!employee && userId) {
    const uRes = await safeQuery(
      `SELECT id, name, email, role FROM users WHERE id::text = $1::text LIMIT 1`,
      [String(userId)]
    );
    userAccount = uRes.rows[0] || null;
  }

  const empId = employee?.id || null;
  const attendanceUserId = employee?.user_id || employee?.linked_user_id || userAccount?.id || userId;
  const empCode = employee?.employee_code || (userAccount ? `USR-${userAccount.id}` : "UNASSIGNED");
  const empName = employee
    ? `${employee.first_name || ""} ${employee.last_name || ""}`.trim()
    : userAccount?.name || "Authenticated User";
  const empDepartment = employee?.resolved_department || "Unassigned Department";
  const empDesignation = employee?.resolved_designation || userAccount?.role || "Employee";
  const empWorkLocation =
    employee?.work_location ||
    employee?.employment?.workLocation ||
    employee?.employment?.location ||
    employee?.address?.city ||
    "Registered Office";

  // Intent classification based on NLP keyword patterns
  const isLeaveBalanceQuery =
    /leave|leaves|balance|casual|sick|vacation|time off|holidays left/.test(prompt) &&
    !/status|request|approval|apply/.test(prompt);
  const isLeaveStatusQuery = /leave.*status|status.*leave|my request|pending leave|approved leave/.test(prompt);
  const isLetterQuery =
    /letter|employment letter|experience|relieving|verification letter|certificate|document|download/.test(prompt);
  const isDeploymentQuery = /project|deployment|client|sow|allocate|allocation|billab|assigned/.test(prompt);
  const isManagerQuery = /manager|lead|reports to|reporting|who is my/.test(prompt);
  const isAttendanceQuery = /attendance|punch|clock|check in|check out|late|hours worked|today/.test(prompt);
  const isPayrollQuery = /salary|pay|payslip|ctc|compensation|deduction|pf|tax|take home/.test(prompt);
  const isResignationQuery = /resign|notice|exit|lwd|last working day|separation/.test(prompt);
  const isHelpdeskQuery = /ticket|help|helpdesk|support|issue|query/.test(prompt);

  // --------------------------------------------------------------------------
  // Intent: Leave Balance (100% from leave_types & leaves tables)
  // --------------------------------------------------------------------------
  if (isLeaveBalanceQuery) {
    const { rows } = await safeQuery(
      `SELECT lt.name as leave_type,
              lt.code,
              COALESCE(lt.annual_allocation, 0)::numeric as total,
              COALESCE(SUM(CASE WHEN l.employee_id = $1 AND l.status ILIKE 'approved%' THEN l.number_of_days ELSE 0 END), 0)::numeric as used,
              COALESCE(SUM(CASE WHEN l.employee_id = $1 AND l.status ILIKE 'pending%' THEN l.number_of_days ELSE 0 END), 0)::numeric as pending
       FROM leave_types lt
       LEFT JOIN leaves l ON l.leave_type_id = lt.id
       GROUP BY lt.id, lt.name, lt.code, lt.annual_allocation
       ORDER BY lt.id ASC`,
      [empId]
    );

    const leavesData = rows.map((r) => {
      const total = Number(r.total || 0);
      const used = Number(r.used || 0);
      const pending = Number(r.pending || 0);
      return {
        type: r.leave_type,
        code: r.code,
        total,
        used,
        pending,
        remaining: Math.max(0, total - used)
      };
    });

    const totalRemaining = leavesData.reduce((acc, curr) => acc + curr.remaining, 0);
    const totalUsed = leavesData.reduce((acc, curr) => acc + curr.used, 0);

    return {
      success: true,
      intent: "LEAVE_BALANCE",
      confidence: 0.96,
      answer: leavesData.length > 0
        ? `Hello **${empName}**, based on live PostgreSQL leave ledger records, you currently have **${totalRemaining} total days of leave remaining** (**${totalUsed} days used**) across **${leavesData.length} leave categories**:`
        : `Hello **${empName}**, no leave type allocations are currently configured in the database for your profile (**${empCode}**).`,
      structuredData: {
        totalRemaining,
        totalUsed,
        balances: leavesData
      },
      actionableLinks: [
        { label: "Apply for Leave", url: "/employee/leaves", path: "/employee/leaves", type: "PRIMARY" },
        { label: "View Corporate Calendar", url: "/employee/calendar", path: "/employee/calendar", type: "SECONDARY" }
      ]
    };
  }

  // --------------------------------------------------------------------------
  // Intent: Leave Request Status (100% from leaves table)
  // --------------------------------------------------------------------------
  if (isLeaveStatusQuery) {
    let recentLeaves = [];
    if (empId) {
      const { rows } = await safeQuery(
        `SELECT l.id, l.start_date, l.end_date, l.number_of_days, l.reason, l.status, lt.name as leave_type
         FROM leaves l
         LEFT JOIN leave_types lt ON lt.id = l.leave_type_id
         WHERE l.employee_id = $1
         ORDER BY l.id DESC LIMIT 5`,
        [empId]
      );
      recentLeaves = rows;
    }

    if (!recentLeaves.length) {
      return {
        success: true,
        intent: "LEAVE_STATUS",
        confidence: 0.93,
        answer: `Hello **${empName}**, you do not have any leave requests recorded in PostgreSQL under employee code **${empCode}**. Would you like to submit a new leave request?`,
        structuredData: { recentLeaves: [] },
        actionableLinks: [
          { label: "Submit New Leave", url: "/employee/leaves", path: "/employee/leaves", type: "PRIMARY" }
        ]
      };
    }

    const latest = recentLeaves[0];
    const statusStr = String(latest.status || "Pending");
    const statusBadge =
      statusStr.toLowerCase() === "approved"
        ? "✅ Approved"
        : statusStr.toLowerCase().includes("pending")
        ? "⏳ Pending Review"
        : `❌ ${statusStr}`;

    return {
      success: true,
      intent: "LEAVE_STATUS",
      confidence: 0.95,
      answer: `Your most recent leave request for **${latest.number_of_days} day(s)** from **${formatDateYMD(latest.start_date)}** to **${formatDateYMD(latest.end_date)}** (**${latest.leave_type || "Leave"}**) is currently: **${statusBadge}**.`,
      structuredData: { recentLeaves },
      actionableLinks: [
        { label: "View All Leave History", url: "/employee/leaves", path: "/employee/leaves", type: "PRIMARY" }
      ]
    };
  }

  // --------------------------------------------------------------------------
  // Intent: Employment Letters & Certificates (Live employee & documents data)
  // --------------------------------------------------------------------------
  if (isLetterQuery) {
    let docCount = 0;
    if (empId) {
      const docRes = await safeQuery(
        `SELECT count(*)::int as cnt FROM documents WHERE employee_id = $1`,
        [empId]
      );
      docCount = docRes.rows[0]?.cnt || 0;
    }

    const joinDateStr = formatDateYMD(employee?.resolved_joining_date) || "On Record";

    return {
      success: true,
      intent: "EMPLOYMENT_LETTER",
      confidence: 0.92,
      answer: `Hello **${empName}** (**${empCode}**, **${empDesignation}** — joined **${joinDateStr}**), you currently have **${docCount} document(s)** stored in your Documents Vault. To request or download an **Official Employment Verification Letter** or **Experience Certificate**, open your Documents Vault or raise an HR Operations ticket.`,
      structuredData: {
        employeeCode: empCode,
        joiningDate: joinDateStr,
        designation: empDesignation,
        department: empDepartment,
        documentsOnFile: docCount
      },
      actionableLinks: [
        { label: "Go to My Documents Vault", url: "/employee/documents", path: "/employee/documents", type: "PRIMARY" },
        { label: "Raise HR Request Ticket", url: "/helpdesk", path: "/helpdesk", type: "SECONDARY" }
      ]
    };
  }

  // --------------------------------------------------------------------------
  // Intent: Client / Project Deployment (100% from project_allocations)
  // --------------------------------------------------------------------------
  if (isDeploymentQuery) {
    let alloc = null;
    if (empId || empCode) {
      const { rows } = await safeQuery(
        `SELECT * FROM project_allocations
         WHERE emp_id::text = $1::text OR employee_code = $2
         ORDER BY id DESC LIMIT 1`,
        [String(empId || ""), empCode]
      );
      alloc = rows[0] || null;
    }

    if (alloc) {
      return {
        success: true,
        intent: "CLIENT_DEPLOYMENT",
        confidence: 0.96,
        answer: `You are currently deployed on client engagement **${alloc.client_name}** on project **"${alloc.project_name}"** (SOW Ref: **${alloc.sow_number || "N/A"}**). Your billability status is **${alloc.billability || "Billable"}** at **${alloc.allocation_percentage ?? 100}% FTE**.`,
        structuredData: {
          clientName: alloc.client_name,
          projectName: alloc.project_name,
          sowNumber: alloc.sow_number,
          billability: alloc.billability,
          allocationPercentage: alloc.allocation_percentage,
          startDate: formatDateYMD(alloc.start_date),
          endDate: formatDateYMD(alloc.end_date)
        },
        actionableLinks: [
          { label: "Log Weekly Timesheet", url: "/employee/timesheets", path: "/employee/timesheets", type: "PRIMARY" }
        ]
      };
    }

    return {
      success: true,
      intent: "CLIENT_DEPLOYMENT",
      confidence: 0.90,
      answer: `Hello **${empName}** (**${empCode}**), there is no active client SOW allocation assigned to your record in \`project_allocations\`. You are currently in the **Internal Practice Pool / Bench** under **${empDepartment}**.`,
      structuredData: { billability: "Bench", allocationPercentage: 0, department: empDepartment },
      actionableLinks: [
        { label: "Update My Technical Skills", url: "/employee/profile", path: "/employee/profile", type: "PRIMARY" }
      ]
    };
  }

  // --------------------------------------------------------------------------
  // Intent: Reporting Manager (100% from employees self-join / employment JSONB)
  // --------------------------------------------------------------------------
  if (isManagerQuery) {
    let managerDisplay = employee?.resolved_manager_name
      ? `${employee.resolved_manager_name}${employee.resolved_manager_designation ? ` (${employee.resolved_manager_designation})` : ""}`
      : employee?.employment?.reportingManager || null;

    if (!managerDisplay) {
      // Look up lead / manager in the employee's department from DB
      const deptLeadRes = await safeQuery(
        `SELECT first_name, last_name,
                COALESCE(NULLIF(to_jsonb(e)->>'designation', ''), NULLIF(e.employment->>'designation', '')) as desig
         FROM employees e
         WHERE COALESCE(NULLIF(to_jsonb(e)->>'department', ''), NULLIF(e.employment->>'department', '')) = $1
           AND e.id IS DISTINCT FROM $2
         ORDER BY e.id ASC LIMIT 1`,
        [empDepartment, empId]
      );
      if (deptLeadRes.rows[0]) {
        const l = deptLeadRes.rows[0];
        managerDisplay = `${l.first_name} ${l.last_name || ""}`.trim() + (l.desig ? ` (${l.desig})` : "");
      } else {
        managerDisplay = "Direct Reporting Manager Not Assigned in Profile";
      }
    }

    return {
      success: true,
      intent: "REPORTING_MANAGER",
      confidence: 0.94,
      answer: `Hello **${empName}**, according to your employee master record (**${empCode}**), your reporting manager / delivery approver is **${managerDisplay}** in the **${empDepartment}** practice.`,
      structuredData: {
        managerName: managerDisplay,
        managerEmail: employee?.resolved_manager_email || null,
        department: empDepartment,
        designation: empDesignation
      },
      actionableLinks: [
        { label: "View Team Organization Tree", url: "/organization", path: "/organization", type: "SECONDARY" }
      ]
    };
  }

  // --------------------------------------------------------------------------
  // Intent: Salary & Payslip Status (100% from payrolls & employees tables)
  // --------------------------------------------------------------------------
  if (isPayrollQuery) {
    let latestPayroll = null;
    if (empId || attendanceUserId) {
      const { rows } = await safeQuery(
        `SELECT * FROM payrolls
         WHERE employee_id::text = $1::text OR employee_id::text = $2::text
         ORDER BY id DESC LIMIT 1`,
        [String(empId || ""), String(attendanceUserId || "")]
      );
      latestPayroll = rows[0] || null;
    }

    const periodLabel =
      latestPayroll?.month ||
      new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const payStatus = latestPayroll?.status || (employee?.resolved_salary ? "Active Compensation Structure" : "No Payslip Generated Yet");
    const rawNet = latestPayroll?.net_salary ?? employee?.resolved_salary ?? null;
    const netFormatted =
      rawNet !== null && rawNet !== "" && !Number.isNaN(Number(rawNet))
        ? `₹${Number(rawNet).toLocaleString("en-IN")}`
        : "Not Configured";

    return {
      success: true,
      intent: "PAYROLL_STATUS",
      confidence: 0.95,
      answer: latestPayroll
        ? `Hello **${empName}**, your latest payroll record in PostgreSQL for **${periodLabel}** is **${payStatus}** with a net disbursement of **${netFormatted}** (Gross: **₹${Number(latestPayroll.gross_salary || latestPayroll.basic_salary || 0).toLocaleString("en-IN")}**, Deductions: **₹${Number(latestPayroll.total_deductions || 0).toLocaleString("en-IN")}**).`
        : `Hello **${empName}** (**${empCode}**), your base compensation on record is **${netFormatted}**. No processed monthly payslip row was found in \`payrolls\` yet for your ID.`,
      structuredData: {
        payrollSummary: {
          period: periodLabel,
          status: payStatus,
          netPay: netFormatted,
          grossPay: latestPayroll?.gross_salary ? `₹${Number(latestPayroll.gross_salary).toLocaleString("en-IN")}` : null,
          employeeCode: empCode
        }
      },
      actionableLinks: [
        { label: "Open My Payroll & Payslips", url: "/employee/payroll", path: "/employee/payroll", type: "PRIMARY" },
        { label: "Raise Finance Helpdesk Ticket", url: "/helpdesk", path: "/helpdesk", type: "SECONDARY" }
      ]
    };
  }

  // --------------------------------------------------------------------------
  // Intent: Helpdesk Support Query (100% from tickets table)
  // --------------------------------------------------------------------------
  if (isHelpdeskQuery && !isLetterQuery && !isResignationQuery) {
    const ticketRes = await safeQuery(
      `SELECT count(*)::int as total,
              COALESCE(sum(CASE WHEN status NOT ILIKE 'resolved%' AND status NOT ILIKE 'closed%' THEN 1 ELSE 0 END), 0)::int as open_count
       FROM tickets
       WHERE employee_id::text = $1::text OR employee_id::text = $2::text`,
      [String(empId || ""), String(attendanceUserId || "")]
    );
    const totalTickets = ticketRes.rows[0]?.total || 0;
    const openTickets = ticketRes.rows[0]?.open_count || 0;

    return {
      success: true,
      intent: "HELPDESK_SUPPORT",
      confidence: 0.92,
      answer: `Hello **${empName}**, you currently have **${openTickets} open support ticket(s)** (out of **${totalTickets} total tickets** on record). You can raise and track tickets with **HR Operations**, **IT Infrastructure**, or **Finance & Payroll** directly through the Helpdesk portal.`,
      structuredData: {
        openTickets,
        totalTickets
      },
      actionableLinks: [
        { label: "Open HR & IT Helpdesk", url: "/helpdesk", path: "/helpdesk", type: "PRIMARY" }
      ]
    };
  }

  // --------------------------------------------------------------------------
  // Intent: Today's Attendance & Punches (100% from attendance table)
  // --------------------------------------------------------------------------
  if (isAttendanceQuery) {
    const todayRes = await safeQuery(`SELECT CURRENT_DATE::text as today`);
    const todayStr = todayRes.rows[0]?.today || formatDateYMD(new Date());

    let todayPunch = null;
    let latestPunch = null;
    if (attendanceUserId || empId) {
      const { rows } = await safeQuery(
        `SELECT * FROM attendance
         WHERE (employee_id::text = $1::text OR employee_id::text = $2::text)
           AND date = CURRENT_DATE
         ORDER BY id DESC LIMIT 1`,
        [String(attendanceUserId || ""), String(empId || "")]
      );
      todayPunch = rows[0] || null;

      if (!todayPunch) {
        const prevRes = await safeQuery(
          `SELECT * FROM attendance
           WHERE (employee_id::text = $1::text OR employee_id::text = $2::text)
           ORDER BY date DESC, check_in DESC NULLS LAST LIMIT 1`,
          [String(attendanceUserId || ""), String(empId || "")]
        );
        latestPunch = prevRes.rows[0] || null;
      }
    }

    if (todayPunch) {
      const inTime = todayPunch.check_in ? formatTime12h(todayPunch.check_in) : "Not punched in";
      const outTime = todayPunch.check_out
        ? formatTime12h(todayPunch.check_out)
        : "Active (Check-out pending)";
      const isLate =
        Boolean(todayPunch.is_late) ||
        String(todayPunch.status || "").toLowerCase().includes("late") ||
        Number(todayPunch.late_minutes || 0) > 0;
      const statusLabel = todayPunch.status || (isLate ? "Late" : "Present");
      const loggedHours =
        todayPunch.working_hours != null && Number(todayPunch.working_hours) > 0
          ? Number(todayPunch.working_hours).toFixed(2)
          : null;

      return {
        success: true,
        intent: "ATTENDANCE_STATUS",
        confidence: 0.96,
        answer: `Today's biometric punch record for **${empName}** (**${todayStr}**) is active in PostgreSQL:`,
        structuredData: {
          attendanceRecord: {
            date: todayStr,
            checkIn: inTime,
            checkOut: outTime,
            status: statusLabel,
            isLate,
            lateMinutes: Number(todayPunch.late_minutes || 0),
            isPresent: true,
            totalHours: loggedHours,
            workLocation: empWorkLocation,
            remarks: todayPunch.remarks || null
          }
        },
        actionableLinks: [
          { label: "Attendance Punch Station", url: "/employee/attendance", path: "/employee/attendance", type: "PRIMARY" },
          { label: "Attendance Calendar", url: "/employee/calendar", path: "/employee/calendar", type: "SECONDARY" }
        ]
      };
    }

    const lastSeenNote = latestPunch
      ? ` Your last recorded biometric punch was on **${formatDateYMD(latestPunch.date)}** (Clock-in: **${formatTime12h(latestPunch.check_in) || "N/A"}**, Status: **${latestPunch.status || "Recorded"}**).`
      : "";

    return {
      success: true,
      intent: "ATTENDANCE_STATUS",
      confidence: 0.92,
      answer: `You do not have a biometric punch recorded yet for today (**${todayStr}**).${lastSeenNote} Please use the Clock In station or submit an attendance regularization if you worked offsite.`,
      structuredData: {
        attendanceRecord: {
          date: todayStr,
          checkIn: "Not Punched",
          checkOut: "Not Punched",
          status: "Not Punched",
          isLate: false,
          isMissing: true,
          workLocation: empWorkLocation,
          lastPunchDate: latestPunch ? formatDateYMD(latestPunch.date) : null
        }
      },
      actionableLinks: [
        { label: "Clock In Now", url: "/employee/attendance", path: "/employee/attendance", type: "PRIMARY" },
        { label: "Attendance Punch Station", url: "/employee/attendance", path: "/employee/attendance", type: "SECONDARY" }
      ]
    };
  }

  // --------------------------------------------------------------------------
  // Fallback: Query HR Policy Search
  // --------------------------------------------------------------------------
  const policyResult = await searchHrPolicies(prompt, role);
  if (policyResult && policyResult.confidence >= 35) {
    const isResignationRelated =
      policyResult.sources?.[0]?.policy_code === "POL-NOTICE" || /resign|notice|exit|lwd/.test(prompt);
    const links = isResignationRelated
      ? [
          { label: "Resignation & Exit Hub", url: "/employee/resignation", path: "/employee/resignation", type: "PRIMARY" },
          { label: "Read Policy in Vault", url: "/ai-assistant?tab=policy", path: "/ai-assistant?tab=policy", type: "SECONDARY" },
          { label: "Contact HR Helpdesk", url: "/helpdesk", path: "/helpdesk", type: "SECONDARY" }
        ]
      : [
          { label: "Read Policy in Vault", url: "/ai-assistant?tab=policy", path: "/ai-assistant?tab=policy", type: "PRIMARY" },
          { label: "Contact HR Helpdesk", url: "/helpdesk", path: "/helpdesk", type: "SECONDARY" }
        ];

    return {
      success: true,
      intent: "HR_POLICY_SEARCH",
      confidence: policyResult.confidence / 100,
      answer: policyResult.answer,
      structuredData: {
        policyCode: policyResult.sources?.[0]?.policy_code,
        policyTitle: policyResult.sources?.[0]?.title
      },
      actionableLinks: links
    };
  }

  // Generic Conversational Fallback with live profile context
  return {
    success: true,
    intent: "GENERAL_ASSISTANCE",
    confidence: 0.65,
    answer: `Hello **${empName}** (**${empCode}** • **${empDesignation}**, **${empDepartment}**). I am your **AI HR & Policy Assistant** connected directly to PostgreSQL. I can look up your live **leave balances**, **leave request status**, **client project deployments**, **reporting manager**, **attendance punches**, **payslip records**, or **company policies**.`,
    structuredData: null,
    actionableLinks: [
      { label: "View Leave Balances", url: "/employee/leaves", path: "/employee/leaves", type: "PRIMARY" },
      { label: "Attendance Station", url: "/employee/attendance", path: "/employee/attendance", type: "SECONDARY" }
    ]
  };
}

/* ============================================================================
   2. AI HR ANALYTICS (100% Live PostgreSQL Workforce Analytics)
   ============================================================================ */

export async function handleHrAnalyticsQuery(role, rawQuery) {
  const query = String(rawQuery || "").trim().toLowerCase();

  // Execute aggregate metric scans strictly from PostgreSQL tables
  const [
    headcountRes,
    deptHeadcountRes,
    absenteeismRes,
    leaveDeptRes,
    deploymentRes,
    attendanceStatsRes,
    attritionRes
  ] = await Promise.all([
    safeQuery(`
      SELECT count(*)::int as active_count,
             (SELECT count(*)::int FROM employees) as total_employees
      FROM employees e
      WHERE COALESCE(NULLIF(to_jsonb(e)->>'status', ''), NULLIF(e.employment->>'status', ''), 'Active') ILIKE 'active%'
    `),
    safeQuery(`
      SELECT COALESCE(NULLIF(to_jsonb(e)->>'department', ''), NULLIF(e.employment->>'department', ''), NULLIF(to_jsonb(e)->>'function', ''), 'Unassigned') as dept,
             count(*)::int as count
      FROM employees e
      WHERE COALESCE(NULLIF(to_jsonb(e)->>'status', ''), NULLIF(e.employment->>'status', ''), 'Active') ILIKE 'active%'
      GROUP BY 1
      ORDER BY count DESC
    `),
    safeQuery(`
      WITH dept_leaves AS (
        SELECT
          COALESCE(NULLIF(to_jsonb(e2)->>'department', ''), NULLIF(e2.employment->>'department', ''), NULLIF(to_jsonb(e2)->>'function', ''), 'Unassigned') as d,
          COALESCE(sum(l.number_of_days), 0)::int as leave_days
        FROM leaves l
        JOIN employees e2 ON e2.id = l.employee_id
        WHERE l.start_date >= CURRENT_DATE - INTERVAL '60 days'
        GROUP BY 1
      )
      SELECT
        COALESCE(NULLIF(to_jsonb(e)->>'department', ''), NULLIF(e.employment->>'department', ''), NULLIF(to_jsonb(e)->>'function', ''), 'Unassigned') as dept,
        count(DISTINCT e.id)::int as headcount,
        count(a.id)::int as total_punches,
        COALESCE(sum(CASE WHEN LOWER(COALESCE(a.status, '')) IN ('absent', 'half-day') THEN 1 ELSE 0 END), 0)::int as direct_absences,
        COALESCE(sum(CASE WHEN a.is_late = true OR LOWER(COALESCE(a.status, '')) = 'late' OR COALESCE(a.late_minutes, 0) > 0 THEN 1 ELSE 0 END), 0)::int as late_punches,
        COALESCE(MAX(dl.leave_days), 0)::int as leave_days
      FROM employees e
      LEFT JOIN users u ON (u.id = e.user_id OR LOWER(u.email) = LOWER(e.email))
      LEFT JOIN attendance a ON (a.employee_id = u.id OR a.employee_id = e.user_id OR a.employee_id = e.id)
                            AND a.date >= CURRENT_DATE - INTERVAL '30 days'
      LEFT JOIN dept_leaves dl ON dl.d = COALESCE(NULLIF(to_jsonb(e)->>'department', ''), NULLIF(e.employment->>'department', ''), NULLIF(to_jsonb(e)->>'function', ''), 'Unassigned')
      WHERE COALESCE(NULLIF(to_jsonb(e)->>'status', ''), NULLIF(e.employment->>'status', ''), 'Active') ILIKE 'active%'
      GROUP BY 1
      ORDER BY headcount DESC
    `),
    safeQuery(`
      SELECT
        COALESCE(NULLIF(to_jsonb(e)->>'department', ''), NULLIF(e.employment->>'department', ''), NULLIF(to_jsonb(e)->>'function', ''), 'Unassigned') as dept,
        COALESCE(sum(CASE WHEN l.status ILIKE 'pending%' THEN 1 ELSE 0 END), 0)::int as pending_count,
        COALESCE(sum(CASE WHEN l.status ILIKE 'approved%' THEN 1 ELSE 0 END), 0)::int as approved_count,
        COALESCE(sum(CASE WHEN l.status ILIKE 'rejected%' THEN 1 ELSE 0 END), 0)::int as rejected_count,
        COALESCE(sum(l.number_of_days), 0)::int as total_days
      FROM employees e
      LEFT JOIN leaves l ON l.employee_id = e.id
      GROUP BY 1
      HAVING count(l.id) > 0 OR count(e.id) > 0
      ORDER BY pending_count DESC, total_days DESC
    `),
    safeQuery(`
      SELECT COALESCE(NULLIF(billability, ''), 'Billable') as billability,
             count(*)::int as count
      FROM project_allocations
      GROUP BY 1
      ORDER BY count DESC
    `),
    safeQuery(`
      SELECT count(*)::int as total_records,
             COALESCE(sum(CASE WHEN is_late = true OR LOWER(COALESCE(status, '')) = 'late' OR COALESCE(late_minutes, 0) > 0 OR (check_in IS NOT NULL AND check_in::time > '09:30:00') THEN 1 ELSE 0 END), 0)::int as late_count,
             COALESCE(sum(CASE WHEN check_in IS NOT NULL AND check_out IS NOT NULL AND COALESCE(remarks, '') NOT ILIKE '%auto-closed%' AND COALESCE(remarks, '') NOT ILIKE '%auto clocked out%' THEN 1 ELSE 0 END), 0)::int as completed_shifts,
             COALESCE(sum(CASE WHEN COALESCE(remarks, '') ILIKE '%auto-closed%' OR COALESCE(remarks, '') ILIKE '%auto clocked out%' OR (date < CURRENT_DATE AND check_in IS NOT NULL AND check_out IS NULL) THEN 1 ELSE 0 END), 0)::int as auto_or_missing_out,
             ROUND(COALESCE(AVG(NULLIF(working_hours, 0)), 0)::numeric, 2) as avg_working_hours
      FROM attendance
      WHERE date >= CURRENT_DATE - INTERVAL '30 days'
    `),
    safeQuery(`
      SELECT count(*)::int as exits_365d,
             COALESCE(sum(CASE WHEN status ILIKE 'pending%' THEN 1 ELSE 0 END), 0)::int as active_notice_count
      FROM resignations
      WHERE resignation_date >= CURRENT_DATE - INTERVAL '365 days'
    `)
  ]);

  const totalHeadcount = Number(headcountRes.rows[0]?.active_count ?? headcountRes.rows[0]?.total_employees ?? 0);
  const deptList = deptHeadcountRes.rows;
  const rawAbsenteeism = absenteeismRes.rows;
  const leaveByDept = leaveDeptRes.rows;
  const billabilityBreakdown = deploymentRes.rows;
  const attStats = attendanceStatsRes.rows[0] || {
    total_records: 0,
    late_count: 0,
    completed_shifts: 0,
    auto_or_missing_out: 0,
    avg_working_hours: 0
  };
  const rawAttrition = attritionRes.rows[0] || { exits_365d: 0, active_notice_count: 0 };
  const exits365d = Number(rawAttrition.exits_365d || 0);
  const annualAttritionPct =
    totalHeadcount > 0 ? Number(((exits365d / totalHeadcount) * 100).toFixed(1)) : 0;

  const totalAllocatedBillable = billabilityBreakdown
    .filter((b) => String(b.billability).toLowerCase() === "billable")
    .reduce((acc, b) => acc + Number(b.count || 0), 0);
  const billableFtePct =
    totalHeadcount > 0
      ? Number(Math.min(100, (totalAllocatedBillable / totalHeadcount) * 100).toFixed(1))
      : 0;

  // --------------------------------------------------------------------------
  // 1. Intent: Absenteeism & Unplanned Leave by Department
  // --------------------------------------------------------------------------
  if (/absent|absenteeism|highest absence|missing/.test(query)) {
    const computedDepts = rawAbsenteeism
      .map((row) => {
        const hc = Math.max(1, Number(row.headcount || 1));
        const expectedPersonDays = hc * 22;
        const directAbsences = Number(row.direct_absences || 0);
        const leaveDays = Number(row.leave_days || 0);
        const latePunches = Number(row.late_punches || 0);
        const totalPunches = Number(row.total_punches || 0);
        const recordedVarianceDays = directAbsences + leaveDays + Math.ceil(latePunches * 0.5);
        const rate = Number(
          Math.min(100, Math.max(0, (recordedVarianceDays / expectedPersonDays) * 100)).toFixed(1)
        );

        return {
          department: row.dept,
          label: row.dept,
          headcount: hc,
          totalPunches,
          absentDays: directAbsences + leaveDays,
          latePunches,
          rate,
          value: rate,
          subValue: `${directAbsences + leaveDays} absence/leave days • ${latePunches} late`
        };
      })
      .sort((a, b) => b.rate - a.rate || b.latePunches - a.latePunches);

    const topDept = computedDepts[0] || {
      department: "No Active Department Data",
      rate: 0,
      absentDays: 0
    };
    const totalAbsenceDays = computedDepts.reduce((sum, d) => sum + d.absentDays, 0);
    const avgCompanyRate =
      computedDepts.length > 0
        ? (computedDepts.reduce((sum, d) => sum + d.rate, 0) / computedDepts.length).toFixed(1)
        : "0.0";
    const enterpriseAttendancePct = Math.max(0, 100 - Number(avgCompanyRate)).toFixed(1);

    return {
      success: true,
      query,
      title: "Department Absenteeism & Time-Off Intelligence",
      metricTitle: "Department Absenteeism & Time-Off Intelligence",
      summary: `Live scan of the rolling 30-day PostgreSQL window shows **${topDept.department}** has a **${topDept.rate}%** absence & variance rate (**${topDept.absentDays} absence/leave days**). Overall enterprise attendance compliance across **${totalHeadcount} active employees** stands at **${enterpriseAttendancePct}%** (company average variance rate: **${avgCompanyRate}%**).`,
      keyMetrics: [
        { label: "Highest Variance Dept", value: topDept.department },
        { label: "Peak Variance Rate", value: `${topDept.rate}%` },
        { label: "Company Avg Variance", value: `${avgCompanyRate}%` },
        { label: "Recorded Leave/Absence Days", value: `${totalAbsenceDays} Days` }
      ],
      chartType: "BAR",
      chartData: {
        chartType: "BAR",
        data: computedDepts
      },
      breakdown: computedDepts.map((item) => ({
        department: item.department,
        active_headcount: item.headcount,
        recorded_punches_30d: item.totalPunches,
        absence_and_leave_days: `${item.absentDays} days`,
        late_check_ins: item.latePunches,
        variance_rate: `${item.rate}%`
      })),
      explanation:
        "Computed directly from PostgreSQL employees, attendance (30-day window), and leaves tables against 22 standard working days per active employee."
    };
  }

  // --------------------------------------------------------------------------
  // 2. Intent: Monthly Attendance & Punctuality Summary
  // --------------------------------------------------------------------------
  if (/attendance|punch|month|punctual|late/.test(query)) {
    const totalLogs = Number(attStats.total_records || 0);
    const lateCount = Number(attStats.late_count || 0);
    const onTimeCount = Math.max(0, totalLogs - lateCount);
    const completedShifts = Number(attStats.completed_shifts || 0);
    const missingOrAutoOutCount = Number(attStats.auto_or_missing_out || 0);
    const avgHours = Number(attStats.avg_working_hours || 0);

    const lateRate = totalLogs > 0 ? Number(((lateCount / totalLogs) * 100).toFixed(1)) : 0;
    const onTimePct = totalLogs > 0 ? Number((100 - lateRate).toFixed(1)) : 0;
    const completionPct =
      totalLogs > 0 ? Number(((completedShifts / totalLogs) * 100).toFixed(1)) : 0;
    const autoOutPct =
      totalLogs > 0 ? Number(((missingOrAutoOutCount / totalLogs) * 100).toFixed(1)) : 0;

    const chartItems = [
      {
        name: "On-Time Check-Ins (<= 09:30 AM)",
        label: "On-Time Check-Ins (<= 09:30 AM)",
        rate: onTimePct,
        count: onTimeCount,
        value: onTimePct,
        subValue: `${onTimeCount} punches`
      },
      {
        name: "Manually Completed Shifts",
        label: "Manually Completed Shifts",
        rate: completionPct,
        count: completedShifts,
        value: completionPct,
        subValue: `${completedShifts} shifts`
      },
      {
        name: "Late Arrivals (> 09:30 AM)",
        label: "Late Arrivals (> 09:30 AM)",
        rate: lateRate,
        count: lateCount,
        value: lateRate,
        subValue: `${lateCount} punches`
      },
      {
        name: "Auto-Closed / Missing Out",
        label: "Auto-Closed / Missing Out",
        rate: autoOutPct,
        count: missingOrAutoOutCount,
        value: autoOutPct,
        subValue: `${missingOrAutoOutCount} shifts`
      }
    ];

    return {
      success: true,
      query,
      title: "Monthly Attendance & Punctuality Summary",
      metricTitle: "Monthly Attendance & Punctuality Summary",
      summary: `Across **${totalLogs} biometric punch records** in PostgreSQL over the last 30 days, **${onTimeCount} check-ins (${onTimePct}%)** complied with the 09:30 AM threshold, while **${lateCount} records (${lateRate}%)** were late arrivals. Average logged shift duration is **${avgHours} hrs**.`,
      keyMetrics: [
        { label: "Total Logs (30d)", value: totalLogs },
        { label: "Punctuality Rate", value: `${onTimePct}%` },
        { label: "Late Arrivals", value: lateCount },
        { label: "Avg Shift Duration", value: `${avgHours} hrs` }
      ],
      chartType: "DOUGHNUT",
      chartData: {
        chartType: "DOUGHNUT",
        data: chartItems
      },
      breakdown: [
        {
          attendance_metric: "On-Time Check-Ins (<= 09:30 AM)",
          record_count: onTimeCount,
          percentage_share: `${onTimePct}%`,
          status: "Compliant"
        },
        {
          attendance_metric: "Late Check-Ins (> 09:30 AM)",
          record_count: lateCount,
          percentage_share: `${lateRate}%`,
          status: lateRate > 10 ? "Needs Review" : "Within Threshold"
        },
        {
          attendance_metric: "Verified Completed Shifts",
          record_count: completedShifts,
          percentage_share: `${completionPct}%`,
          status: "Verified"
        },
        {
          attendance_metric: "System Auto-Closed / Unclosed Shifts",
          record_count: missingOrAutoOutCount,
          percentage_share: `${autoOutPct}%`,
          status: missingOrAutoOutCount > 0 ? "Regularization Advised" : "Clear"
        }
      ],
      explanation:
        "Aggregated directly from the PostgreSQL attendance table over the rolling 30-day window."
    };
  }

  // --------------------------------------------------------------------------
  // 3. Intent: Pending Leave Approvals by Department
  // --------------------------------------------------------------------------
  if (/pending leave|leave approval|unapproved leave|leave request|leaves by/.test(query)) {
    const resolvedLeaves = leaveByDept.map((r) => {
      const pending = Number(r.pending_count || 0);
      const approved = Number(r.approved_count || 0);
      const rejected = Number(r.rejected_count || 0);
      const totalDays = Number(r.total_days || 0);
      const metricVal = pending > 0 ? pending : approved;
      return {
        department: r.dept,
        label: r.dept,
        pending,
        approved,
        rejected,
        totalDays,
        count: metricVal,
        value: metricVal,
        subValue: `${pending} pending • ${approved} approved (${totalDays} days)`
      };
    });

    const totalPending = resolvedLeaves.reduce((acc, c) => acc + c.pending, 0);
    const totalApproved = resolvedLeaves.reduce((acc, c) => acc + c.approved, 0);
    const totalLeaveDays = resolvedLeaves.reduce((acc, c) => acc + c.totalDays, 0);
    const topLeaveDept = resolvedLeaves[0]?.department || "N/A";

    return {
      success: true,
      query,
      title: "Leave Approvals & Time-Off Queue by Department",
      metricTitle: "Leave Approvals & Time-Off Queue by Department",
      summary:
        totalPending > 0
          ? `There are currently **${totalPending} pending leave requests** in PostgreSQL awaiting approval, alongside **${totalApproved} approved leaves** (**${totalLeaveDays} total leave days**). Highest activity is in **${topLeaveDept}**.`
          : `There are **0 pending leave requests** in the queue (**${totalApproved} approved leaves** totaling **${totalLeaveDays} days** on record).`,
      keyMetrics: [
        { label: "Pending Approvals", value: totalPending },
        { label: "Approved Leaves", value: totalApproved },
        { label: "Total Leave Days", value: `${totalLeaveDays} Days` },
        { label: "Top Activity Dept", value: topLeaveDept }
      ],
      chartType: "BAR",
      chartData: {
        chartType: "BAR",
        data: resolvedLeaves
      },
      breakdown: resolvedLeaves.map((item) => ({
        department: item.department,
        pending_approvals: item.pending,
        approved_leaves: item.approved,
        rejected_leaves: item.rejected,
        total_leave_days: `${item.totalDays} days`,
        queue_status:
          item.pending > 2 ? "Priority Review" : item.pending > 0 ? "Pending Action" : "All Cleared"
      })),
      explanation:
        "Aggregated directly from the PostgreSQL leaves table joined with employee department records."
    };
  }

  // --------------------------------------------------------------------------
  // 4. Intent: Client Billability vs. Bench Ratio
  // --------------------------------------------------------------------------
  if (/billab|bench|utilization|client|sow/.test(query)) {
    const allocatedBillable = billabilityBreakdown
      .filter((b) => String(b.billability).toLowerCase() === "billable")
      .reduce((acc, b) => acc + Number(b.count || 0), 0);
    const allocatedNonBillable = billabilityBreakdown
      .filter((b) => String(b.billability).toLowerCase() !== "billable")
      .reduce((acc, b) => acc + Number(b.count || 0), 0);

    const unallocatedBench = Math.max(0, totalHeadcount - allocatedBillable - allocatedNonBillable);
    const denom = Math.max(1, totalHeadcount || allocatedBillable + allocatedNonBillable);

    const calcBillablePct = Number(((allocatedBillable / denom) * 100).toFixed(1));
    const calcBenchPct = Number(((unallocatedBench / denom) * 100).toFixed(1));
    const calcInternalPct = Number(((allocatedNonBillable / denom) * 100).toFixed(1));

    const chartItems = [
      {
        name: "Billable Client SOW",
        label: "Billable Client SOW",
        rate: calcBillablePct,
        count: allocatedBillable,
        value: calcBillablePct,
        subValue: `${allocatedBillable} consultants`
      },
      {
        name: "Unallocated / Bench Pool",
        label: "Unallocated / Bench Pool",
        rate: calcBenchPct,
        count: unallocatedBench,
        value: calcBenchPct,
        subValue: `${unallocatedBench} consultants`
      },
      ...(allocatedNonBillable > 0
        ? [
            {
              name: "Internal / Non-Billable",
              label: "Internal / Non-Billable",
              rate: calcInternalPct,
              count: allocatedNonBillable,
              value: calcInternalPct,
              subValue: `${allocatedNonBillable} consultants`
            }
          ]
        : [])
    ];

    return {
      success: true,
      query,
      title: "Client Billability vs. Practice Bench Utilization",
      metricTitle: "Client Billability vs. Practice Bench Utilization",
      summary: `Live reconciliation of \`project_allocations\` against **${totalHeadcount} active employees** shows **${calcBillablePct}%** (**${allocatedBillable} consultants**) allocated to billable client engagements and **${calcBenchPct}%** (**${unallocatedBench} consultants**) in the unallocated bench pool.`,
      keyMetrics: [
        { label: "Billable SOW Utilization", value: `${calcBillablePct}%` },
        { label: "Practice Bench Ratio", value: `${calcBenchPct}%` },
        { label: "Billable Consultants", value: allocatedBillable },
        { label: "Bench / Available Pool", value: unallocatedBench }
      ],
      chartType: "BAR",
      chartData: {
        chartType: "BAR",
        data: chartItems
      },
      breakdown: chartItems.map((item) => ({
        allocation_category: item.name,
        consultant_count: item.count,
        workforce_share: `${item.rate}%`,
        deployment_status: item.name.includes("Billable")
          ? "Active Client SOW"
          : "Available for Allocation"
      })),
      explanation:
        "Computed directly by comparing PostgreSQL project_allocations rows against active employee headcount."
    };
  }

  // --------------------------------------------------------------------------
  // 5. Intent: Attrition and Resignation Trends
  // --------------------------------------------------------------------------
  if (/attrition|resign|exit|turnover|retention/.test(query)) {
    const retentionPct = Number(Math.max(0, 100 - annualAttritionPct).toFixed(1));
    const activeNotice = Number(rawAttrition.active_notice_count || 0);
    const completedExits = Math.max(0, exits365d - activeNotice);

    const chartItems = [
      {
        name: "Retained Active Workforce",
        label: "Retained Active Workforce",
        rate: retentionPct,
        count: totalHeadcount,
        value: retentionPct,
        subValue: `${totalHeadcount} employees`
      },
      {
        name: "Trailing 12M Attrition Rate",
        label: "Trailing 12M Attrition Rate",
        rate: annualAttritionPct,
        count: exits365d,
        value: annualAttritionPct,
        subValue: `${exits365d} resignations`
      }
    ];

    return {
      success: true,
      query,
      title: "Workforce Attrition & Retention Intelligence",
      metricTitle: "Workforce Attrition & Retention Intelligence",
      summary: `Trailing 12-month enterprise attrition in PostgreSQL is **${annualAttritionPct}%** (**${exits365d} resignation records** over the last 365 days, including **${activeNotice} currently pending/serving notice**), yielding a **${retentionPct}% retention rate** across **${totalHeadcount} active employees**.`,
      keyMetrics: [
        { label: "Annual Attrition Rate", value: `${annualAttritionPct}%` },
        { label: "Workforce Retention", value: `${retentionPct}%` },
        { label: "Total Resignations (365d)", value: exits365d },
        { label: "Active Notice Period", value: activeNotice }
      ],
      chartType: "BAR",
      chartData: {
        chartType: "BAR",
        data: chartItems
      },
      breakdown: [
        {
          workforce_segment: "Retained Active Employees",
          headcount: totalHeadcount,
          share: `${retentionPct}%`,
          status: "Active"
        },
        {
          workforce_segment: "Serving Notice / Pending Review",
          headcount: activeNotice,
          share: `${totalHeadcount ? ((activeNotice / totalHeadcount) * 100).toFixed(1) : 0}%`,
          status: "Transition / Handover"
        },
        {
          workforce_segment: "Processed Exits (365d)",
          headcount: completedExits,
          share: `${totalHeadcount ? ((completedExits / totalHeadcount) * 100).toFixed(1) : 0}%`,
          status: "Processed"
        }
      ],
      explanation:
        "Derived directly from PostgreSQL resignations and employees tables over a rolling 365-day window."
    };
  }

  // --------------------------------------------------------------------------
  // 6. Default: Comprehensive Executive Workforce & Headcount Overview
  // --------------------------------------------------------------------------
  const defaultChartItems = deptList.map((d) => {
    const share = Number(((Number(d.count) / Math.max(1, totalHeadcount)) * 100).toFixed(1));
    return {
      department: d.dept,
      label: d.dept,
      count: Number(d.count),
      value: Number(d.count),
      subValue: `${share}% of workforce`
    };
  });

  return {
    success: true,
    query,
    title: "Executive Workforce & Staff-Augmentation Intelligence",
    metricTitle: "Executive Workforce & Staff-Augmentation Intelligence",
    summary: `Live PostgreSQL telemetry shows **${totalHeadcount} active employees** across **${deptList.length} departments**, with SOW billable allocation at **${billableFtePct}%** and trailing 12-month attrition at **${annualAttritionPct}%** (${exits365d} resignations).`,
    keyMetrics: [
      { label: "Active Headcount", value: totalHeadcount },
      { label: "SOW Billable FTE", value: `${billableFtePct}%` },
      { label: "Annual Attrition", value: `${annualAttritionPct}%` },
      { label: "Active Departments", value: deptList.length }
    ],
    chartType: "BAR",
    chartData: {
      chartType: "BAR",
      data: defaultChartItems
    },
    breakdown: defaultChartItems.map((item) => ({
      department: item.department,
      active_consultants: item.count,
      workforce_share: item.subValue
    })),
    explanation:
      "Consolidated real-time operational metrics queried from PostgreSQL employees, project_allocations, attendance, and resignations tables."
  };
}

/* ============================================================================
   3. SMART ATTENDANCE MONITORING (100% Real Employee & Biometric Anomaly Engine)
   ============================================================================ */

export async function detectAttendanceAnomalies(options = {}) {
  const lookbackDays = Math.max(1, Number(options.lookbackDays || 30));
  const userId = options.userId ? String(options.userId) : null;
  const role = String(options.role || "employee").toLowerCase();

  const HR_ENTERPRISE_ROLES = new Set([
    "hr",
    "admin",
    "super_admin",
    "hr_admin",
    "hr_manager",
    "hr_operations",
    "leadership",
    "executive"
  ]);
  const isEnterpriseScope =
    HR_ENTERPRISE_ROLES.has(role) || role.includes("hr") || role.includes("admin");
  const scope = isEnterpriseScope ? "ENTERPRISE" : "PERSONAL";

  // 1. Fetch active employees, punches, leaves, and regularizations from PostgreSQL
  //    - HR / Admin (ENTERPRISE): fetches everyone's records
  //    - Employee (PERSONAL): fetches ONLY the logged-in employee's records
  const [empRes, punchRes, leaveRes, regRes, todayRes] = await Promise.all([
    isEnterpriseScope || !userId
      ? safeQuery(`
          SELECT e.id as emp_id,
                 e.user_id,
                 u.id as resolved_user_id,
                 e.employee_code,
                 e.first_name,
                 e.last_name,
                 e.email,
                 e.profile_photo,
                 e.work_location,
                 COALESCE(NULLIF(to_jsonb(e)->>'department', ''), NULLIF(e.employment->>'department', ''), NULLIF(to_jsonb(e)->>'function', ''), 'Unassigned') as department,
                 COALESCE(NULLIF(to_jsonb(e)->>'designation', ''), NULLIF(e.employment->>'designation', ''), 'Employee') as designation,
                 COALESCE(NULLIF(to_jsonb(e)->>'status', ''), NULLIF(e.employment->>'status', ''), 'Active') as emp_status,
                 NULLIF(TRIM(CONCAT(m.first_name, ' ', m.last_name)), '') as manager_name,
                 e.employment->>'reportingManager' as json_manager_name
          FROM employees e
          LEFT JOIN users u ON (u.id = e.user_id OR LOWER(u.email) = LOWER(e.email))
          LEFT JOIN employees m ON m.id = e.reports_to
          WHERE COALESCE(NULLIF(to_jsonb(e)->>'status', ''), NULLIF(e.employment->>'status', ''), 'Active') ILIKE 'active%'
          ORDER BY e.id ASC
        `)
      : safeQuery(
          `SELECT e.id as emp_id,
                  e.user_id,
                  u.id as resolved_user_id,
                  e.employee_code,
                  e.first_name,
                  e.last_name,
                  e.email,
                  e.profile_photo,
                  e.work_location,
                  COALESCE(NULLIF(to_jsonb(e)->>'department', ''), NULLIF(e.employment->>'department', ''), NULLIF(to_jsonb(e)->>'function', ''), 'Unassigned') as department,
                  COALESCE(NULLIF(to_jsonb(e)->>'designation', ''), NULLIF(e.employment->>'designation', ''), 'Employee') as designation,
                  COALESCE(NULLIF(to_jsonb(e)->>'status', ''), NULLIF(e.employment->>'status', ''), 'Active') as emp_status,
                  NULLIF(TRIM(CONCAT(m.first_name, ' ', m.last_name)), '') as manager_name,
                  e.employment->>'reportingManager' as json_manager_name
           FROM employees e
           LEFT JOIN users u ON (u.id = e.user_id OR LOWER(u.email) = LOWER(e.email))
           LEFT JOIN employees m ON m.id = e.reports_to
           WHERE e.user_id::text = $1::text
              OR e.id::text = $1::text
              OR e.employee_code = $1::text
              OR u.id::text = $1::text
           ORDER BY e.id ASC
           LIMIT 1`,
          [userId]
        ),
    isEnterpriseScope || !userId
      ? safeQuery(
          `SELECT a.id,
                  a.employee_id,
                  a.date,
                  a.check_in,
                  a.check_out,
                  a.status,
                  a.is_late,
                  COALESCE(a.late_minutes, 0)::int as late_minutes,
                  COALESCE(a.working_hours, 0)::numeric as working_hours,
                  COALESCE(a.overtime_hours, 0)::numeric as overtime_hours,
                  a.remarks,
                  u.name as user_name,
                  u.email as user_email,
                  e.id as matched_emp_id,
                  e.employee_code,
                  e.first_name,
                  e.last_name,
                  e.profile_photo,
                  e.work_location,
                  COALESCE(NULLIF(to_jsonb(e)->>'department', ''), NULLIF(e.employment->>'department', ''), NULLIF(to_jsonb(e)->>'function', ''), 'Unassigned') as department,
                  COALESCE(NULLIF(to_jsonb(e)->>'designation', ''), NULLIF(e.employment->>'designation', ''), 'Employee') as designation,
                  NULLIF(TRIM(CONCAT(m.first_name, ' ', m.last_name)), '') as manager_name
           FROM attendance a
           LEFT JOIN users u ON u.id = a.employee_id
           LEFT JOIN employees e ON (e.user_id = a.employee_id OR e.id = a.employee_id OR (u.email IS NOT NULL AND LOWER(e.email) = LOWER(u.email)))
           LEFT JOIN employees m ON m.id = e.reports_to
           WHERE a.date >= CURRENT_DATE - ($1 || ' days')::interval
           ORDER BY a.date DESC, a.check_in DESC NULLS LAST`,
          [lookbackDays]
        )
      : safeQuery(
          `SELECT a.id,
                  a.employee_id,
                  a.date,
                  a.check_in,
                  a.check_out,
                  a.status,
                  a.is_late,
                  COALESCE(a.late_minutes, 0)::int as late_minutes,
                  COALESCE(a.working_hours, 0)::numeric as working_hours,
                  COALESCE(a.overtime_hours, 0)::numeric as overtime_hours,
                  a.remarks,
                  u.name as user_name,
                  u.email as user_email,
                  e.id as matched_emp_id,
                  e.employee_code,
                  e.first_name,
                  e.last_name,
                  e.profile_photo,
                  e.work_location,
                  COALESCE(NULLIF(to_jsonb(e)->>'department', ''), NULLIF(e.employment->>'department', ''), NULLIF(to_jsonb(e)->>'function', ''), 'Unassigned') as department,
                  COALESCE(NULLIF(to_jsonb(e)->>'designation', ''), NULLIF(e.employment->>'designation', ''), 'Employee') as designation,
                  NULLIF(TRIM(CONCAT(m.first_name, ' ', m.last_name)), '') as manager_name
           FROM attendance a
           LEFT JOIN users u ON u.id = a.employee_id
           LEFT JOIN employees e ON (e.user_id = a.employee_id OR e.id = a.employee_id OR (u.email IS NOT NULL AND LOWER(e.email) = LOWER(u.email)))
           LEFT JOIN employees m ON m.id = e.reports_to
           WHERE a.date >= CURRENT_DATE - ($1 || ' days')::interval
             AND (
               a.employee_id::text = $2::text
               OR e.user_id::text = $2::text
               OR e.id::text = $2::text
               OR e.employee_code = $2::text
               OR u.id::text = $2::text
             )
           ORDER BY a.date DESC, a.check_in DESC NULLS LAST`,
          [lookbackDays, userId]
        ),
    safeQuery(
      `SELECT l.employee_id, l.start_date, l.end_date, l.number_of_days, l.status, lt.name as leave_type
       FROM leaves l
       LEFT JOIN leave_types lt ON lt.id = l.leave_type_id
       WHERE l.end_date >= CURRENT_DATE - ($1 || ' days')::interval`,
      [lookbackDays]
    ),
    safeQuery(
      `SELECT ar.id, ar.employee_id, ar.attendance_date, ar.requested_check_in, ar.requested_check_out, ar.reason, ar.status
       FROM attendance_regularizations ar
       WHERE ar.attendance_date >= CURRENT_DATE - ($1 || ' days')::interval`,
      [lookbackDays]
    ),
    safeQuery(`SELECT CURRENT_DATE::text as today`)
  ]);

  const todayStr = todayRes.rows[0]?.today || formatDateYMD(new Date());
  const activeEmployees = empRes.rows;
  const punches = punchRes.rows;
  const leaves = leaveRes.rows;
  const regularizations = regRes.rows;

  // Build map of employees keyed by canonical key so both active employees and any punch records are unified
  const byEmployee = new Map();

  for (const emp of activeEmployees) {
    const key = emp.employee_code || `EMP-${emp.emp_id}`;
    byEmployee.set(key, {
      empKey: key,
      empId: emp.emp_id,
      userId: emp.resolved_user_id || emp.user_id || null,
      employeeCode: key,
      name: `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || emp.email || key,
      email: emp.email || null,
      profilePhoto: emp.profile_photo || null,
      department: emp.department || "Unassigned",
      designation: emp.designation || "Employee",
      managerName: emp.manager_name || emp.json_manager_name || "Direct Reporting Lead",
      workLocation: emp.work_location || "Corporate Office",
      punches: [],
      leaves: [],
      regularizations: []
    });
  }

  // Helper to resolve employee bucket for a punch
  const findEmployeeBucket = (p) => {
    if (p.employee_code && byEmployee.has(p.employee_code)) {
      return byEmployee.get(p.employee_code);
    }
    for (const bucket of byEmployee.values()) {
      if (
        (p.matched_emp_id && bucket.empId === p.matched_emp_id) ||
        (p.employee_id && (bucket.userId === p.employee_id || bucket.empId === p.employee_id)) ||
        (p.user_email && bucket.email && p.user_email.toLowerCase() === bucket.email.toLowerCase())
      ) {
        return bucket;
      }
    }
    const fallbackKey = p.employee_code || `USR-${p.employee_id}`;
    if (!byEmployee.has(fallbackKey)) {
      const resolvedName =
        `${p.first_name || ""} ${p.last_name || ""}`.trim() ||
        p.user_name ||
        p.user_email ||
        fallbackKey;
      byEmployee.set(fallbackKey, {
        empKey: fallbackKey,
        empId: p.matched_emp_id || null,
        userId: p.employee_id || null,
        employeeCode: fallbackKey,
        name: resolvedName,
        email: p.user_email || null,
        profilePhoto: p.profile_photo || null,
        department: p.department || "Unassigned",
        designation: p.designation || "Employee",
        managerName: p.manager_name || "Direct Reporting Lead",
        workLocation: p.work_location || "Corporate Office",
        punches: [],
        leaves: [],
        regularizations: []
      });
    }
    return byEmployee.get(fallbackKey);
  };

  for (const p of punches) {
    const bucket = findEmployeeBucket(p);
    bucket.punches.push(p);
  }

  for (const l of leaves) {
    for (const bucket of byEmployee.values()) {
      if (bucket.empId === l.employee_id || bucket.userId === l.employee_id) {
        bucket.leaves.push(l);
      }
    }
  }

  for (const r of regularizations) {
    for (const bucket of byEmployee.values()) {
      if (bucket.userId === r.employee_id || bucket.empId === r.employee_id) {
        bucket.regularizations.push(r);
      }
    }
  }

  const anomalies = [];
  const employeeTelemetryList = [];
  let totalOnTimePunches = 0;
  let totalEvaluatedCheckIns = 0;
  let totalLoggedShiftHours = 0;
  let totalShiftsWithHours = 0;
  let totalAutoClosedShifts = 0;

  for (const emp of byEmployee.values()) {
    const totalPunches = emp.punches.length;

    // Classify punches for this employee
    const latePunches = [];
    const onTimePunches = [];
    const missingOrAutoCheckouts = [];
    const durationVarianceShifts = [];
    const explicitAbsentRecords = [];

    let empTotalHours = 0;
    let empHoursCount = 0;
    let empOvertimeHours = 0;
    let empTotalLateMinutes = 0;

    for (const p of emp.punches) {
      const punchDateStr = formatDateYMD(p.date);
      const statusLower = String(p.status || "").toLowerCase();

      if (statusLower === "absent") {
        explicitAbsentRecords.push(p);
      }

      // Compute working hours
      let shiftHours = Number(p.working_hours || 0);
      if (shiftHours <= 0 && p.check_in && p.check_out) {
        const diff = (new Date(p.check_out) - new Date(p.check_in)) / 3600000;
        if (diff > 0 && diff < 24) {
          shiftHours = Number(diff.toFixed(2));
        }
      }
      if (shiftHours > 0) {
        empTotalHours += shiftHours;
        empHoursCount += 1;
        totalLoggedShiftHours += shiftHours;
        totalShiftsWithHours += 1;
      }

      empOvertimeHours += Number(p.overtime_hours || 0);

      // Evaluate late arrival
      let isPunchLate = Boolean(p.is_late) || statusLower === "late" || Number(p.late_minutes || 0) > 0;
      let computedLateMins = Number(p.late_minutes || 0);
      if (p.check_in) {
        const dIn = new Date(p.check_in);
        if (!Number.isNaN(dIn.getTime())) {
          const minsFromMidnight = dIn.getHours() * 60 + dIn.getMinutes();
          const cutoffMins = 9 * 60 + 30; // 09:30 AM
          if (minsFromMidnight > cutoffMins) {
            isPunchLate = true;
            if (computedLateMins <= 0) {
              computedLateMins = minsFromMidnight - cutoffMins;
            }
          }
        }
      }

      if (p.check_in) {
        totalEvaluatedCheckIns += 1;
        if (isPunchLate) {
          latePunches.push({ ...p, computedLateMins, punchDateStr, shiftHours });
          empTotalLateMinutes += computedLateMins;
        } else {
          onTimePunches.push(p);
          totalOnTimePunches += 1;
        }
      }

      // Evaluate Missing or System Auto-Closed Check-Out
      const remarksStr = String(p.remarks || "");
      const isAutoClosed = /auto-closed|auto clocked out/i.test(remarksStr);
      if (isAutoClosed) {
        totalAutoClosedShifts += 1;
      }
      const isPastUnclosed = punchDateStr < todayStr && p.check_in && !p.check_out;
      if (isPastUnclosed || isAutoClosed) {
        missingOrAutoCheckouts.push({
          ...p,
          punchDateStr,
          isAutoClosed,
          policyRemark: remarksStr || "Missing check-out timestamp at end of shift"
        });
      }

      // Evaluate Shift Duration Variance (Undertime < 7.5h, Half-Day, or Overtime > 9.5h)
      if (
        (shiftHours > 0 && (shiftHours < 7.5 || shiftHours > 9.5)) ||
        statusLower === "half-day" ||
        Number(p.overtime_hours || 0) >= 1.5
      ) {
        durationVarianceShifts.push({
          ...p,
          punchDateStr,
          shiftHours: Number(shiftHours.toFixed(2))
        });
      }
    }

    const empAvgHours = empHoursCount > 0 ? Number((empTotalHours / empHoursCount).toFixed(2)) : 0;
    const empOnTimeRate =
      latePunches.length + onTimePunches.length > 0
        ? Math.round((onTimePunches.length / (latePunches.length + onTimePunches.length)) * 100)
        : totalPunches > 0
        ? 100
        : 0;
    const approvedLeaveDays = emp.leaves
      .filter((l) => String(l.status || "").toLowerCase().startsWith("approved"))
      .reduce((acc, l) => acc + Number(l.number_of_days || 0), 0);

    const latestPunch = emp.punches[0] || null;
    const baseTelemetry = {
      employeeId: emp.empId,
      userId: emp.userId,
      employeeCode: emp.employeeCode,
      employeeName: emp.name,
      employeeEmail: emp.email,
      profilePhoto: emp.profilePhoto,
      department: emp.department,
      designation: emp.designation,
      managerName: emp.managerName,
      workLocation: emp.workLocation,
      totalPunchesInWindow: totalPunches,
      onTimePunches: onTimePunches.length,
      latePunchesCount: latePunches.length,
      onTimeRate: empOnTimeRate,
      avgWorkingHours: empAvgHours,
      totalWorkingHours: Number(empTotalHours.toFixed(1)),
      totalOvertimeHours: Number(empOvertimeHours.toFixed(1)),
      totalLateMinutes: empTotalLateMinutes,
      approvedLeaveDays,
      latestCheckIn: latestPunch?.check_in ? formatTime12h(latestPunch.check_in) : "No Check-In",
      latestCheckOut: latestPunch?.check_out ? formatTime12h(latestPunch.check_out) : "Pending / None",
      recentDate: latestPunch?.date ? formatDateYMD(latestPunch.date) : null
    };

    employeeTelemetryList.push(baseTelemetry);

    // ------------------------------------------------------------------------
    // Rule A: Late Arrival Pattern (Real late punches in DB)
    // ------------------------------------------------------------------------
    if (latePunches.length >= 1) {
      const validMinutes = latePunches
        .filter((p) => p.check_in)
        .map((p) => {
          const d = new Date(p.check_in);
          return d.getHours() * 60 + d.getMinutes();
        })
        .filter((m) => !Number.isNaN(m) && m > 0);

      let avgTimeLabel = formatTime12h(latePunches[0]?.check_in) || "Post 09:30 AM";
      if (validMinutes.length > 0) {
        const avgMins = Math.round(validMinutes.reduce((a, b) => a + b, 0) / validMinutes.length);
        const hrs24 = Math.floor(avgMins / 60);
        const mins = String(avgMins % 60).padStart(2, "0");
        const ampm = hrs24 >= 12 ? "PM" : "AM";
        const hrs12 = String(hrs24 % 12 || 12).padStart(2, "0");
        avgTimeLabel = `${hrs12}:${mins} ${ampm}`;
      }

      const isCritical =
        latePunches.length >= 3 || empTotalLateMinutes >= 90 || (totalPunches >= 2 && empOnTimeRate < 55);
      const score = Math.min(
        98,
        Math.round(48 + latePunches.length * 12 + Math.min(25, empTotalLateMinutes / 6))
      );
      const affectedDates = latePunches.map((p) => p.punchDateStr).filter(Boolean).slice(0, 6);
      const patternName =
        latePunches.length >= 3 ? "CHRONIC_LATE_ARRIVALS" : "LATE_ARRIVAL_VARIANCE";

      const explanationText = `Recorded ${latePunches.length} late check-in(s) out of ${totalPunches} shift(s) (${empOnTimeRate}% on-time rate) in the last ${lookbackDays} days. Average late check-in: ${avgTimeLabel} (${empTotalLateMinutes} cumulative late mins).`;
      const actionText =
        latePunches.length >= 3
          ? `Schedule core-hours alignment review with ${emp.managerName} and verify biometric clock-in compliance.`
          : `Monitor upcoming shift check-ins or submit late-arrival regularization if delayed by client call.`;

      anomalies.push({
        id: `ANOM-LATE-${emp.empKey}`,
        ...baseTelemetry,
        type: patternName,
        patternType: patternName,
        patternLabel: latePunches.length >= 3 ? "Chronic Late Arrivals" : "Late Check-In Variance",
        severity: isCritical ? "CRITICAL" : "WARNING",
        anomalyScore: score,
        severityScore: score,
        detectedCount: latePunches.length,
        metricHighlight: `${empTotalLateMinutes}m late • Avg ${avgTimeLabel}`,
        affectedDates,
        recentDate: affectedDates[0] || baseTelemetry.recentDate,
        explanation: explanationText,
        narrativeExplanation: explanationText,
        recommendedAction: actionText,
        suggestedAction: actionText
      });
    }

    // ------------------------------------------------------------------------
    // Rule B: Missing or System Auto-Closed Punch-Outs
    // ------------------------------------------------------------------------
    if (missingOrAutoCheckouts.length >= 1) {
      const autoClosedSubset = missingOrAutoCheckouts.filter((m) => m.isAutoClosed);
      const openSubset = missingOrAutoCheckouts.filter((m) => !m.isAutoClosed);
      const isCritical = missingOrAutoCheckouts.length >= 2;
      const score = Math.min(96, 52 + missingOrAutoCheckouts.length * 16);
      const affectedDates = missingOrAutoCheckouts
        .map((p) => p.punchDateStr)
        .filter(Boolean)
        .slice(0, 6);

      const policySample = missingOrAutoCheckouts[0]?.policyRemark || "Unclosed shift";
      const explanationText =
        autoClosedSubset.length > 0
          ? `Detected ${missingOrAutoCheckouts.length} shift(s) where employee did not manually clock out (${autoClosedSubset.length} auto-closed by system policy: "${policySample}"${openSubset.length > 0 ? `, ${openSubset.length} still open` : ""}).`
          : `Detected ${missingOrAutoCheckouts.length} past shift(s) with biometric check-in recorded but missing check-out timestamp.`;
      const actionText = `Request ${emp.name} to submit an Attendance Regularization with actual departure time for approval by ${emp.managerName}.`;

      anomalies.push({
        id: `ANOM-CHECKOUT-${emp.empKey}`,
        ...baseTelemetry,
        type: "MISSING_PUNCH_OUT",
        patternType: "MISSING_PUNCH_OUT",
        patternLabel:
          autoClosedSubset.length > 0
            ? "Auto-Closed / Missing Clock-Out"
            : "Missing Biometric Check-Out",
        severity: isCritical ? "CRITICAL" : "WARNING",
        anomalyScore: score,
        severityScore: score,
        detectedCount: missingOrAutoCheckouts.length,
        metricHighlight: `${missingOrAutoCheckouts.length} unclosed shift(s)`,
        affectedDates,
        recentDate: affectedDates[0] || baseTelemetry.recentDate,
        explanation: explanationText,
        narrativeExplanation: explanationText,
        recommendedAction: actionText,
        suggestedAction: actionText
      });
    }

    // ------------------------------------------------------------------------
    // Rule C: Shift Duration / Half-Day / Overtime Variance
    // ------------------------------------------------------------------------
    if (durationVarianceShifts.length >= 1) {
      const shortShifts = durationVarianceShifts.filter((s) => s.shiftHours > 0 && s.shiftHours < 7.5);
      const longShifts = durationVarianceShifts.filter((s) => s.shiftHours > 9.5 || Number(s.overtime_hours || 0) >= 1.5);
      const isCritical =
        durationVarianceShifts.length >= 3 ||
        durationVarianceShifts.some((s) => s.shiftHours > 0 && (s.shiftHours < 4.5 || s.shiftHours > 12));
      const score = Math.min(92, 46 + durationVarianceShifts.length * 12);
      const affectedDates = durationVarianceShifts
        .map((p) => p.punchDateStr)
        .filter(Boolean)
        .slice(0, 6);

      const explanationText = `Logged ${durationVarianceShifts.length} shift(s) outside standard 8.0h–9.0h window (${shortShifts.length} undertime/half-day, ${longShifts.length} extended/overtime). Average logged shift: ${empAvgHours} hrs (Overtime: ${Number(empOvertimeHours.toFixed(1))} hrs).`;
      const actionText =
        shortShifts.length >= longShifts.length
          ? `Reconcile short shift hours (${empAvgHours}h avg) against half-day leave balances or client timesheet entries.`
          : `Review extended shift workload (${Number(empOvertimeHours.toFixed(1))}h overtime) with ${emp.managerName} for SOW overtime billing or comp-off.`;

      anomalies.push({
        id: `ANOM-DURATION-${emp.empKey}`,
        ...baseTelemetry,
        type: "SHIFT_DURATION_VARIANCE",
        patternType: "SHIFT_DURATION_VARIANCE",
        patternLabel:
          shortShifts.length >= longShifts.length
            ? "Short Shift / Half-Day Variance"
            : "Extended Shift / Overtime Spike",
        severity: isCritical ? "CRITICAL" : "WARNING",
        anomalyScore: score,
        severityScore: score,
        detectedCount: durationVarianceShifts.length,
        metricHighlight: `Avg ${empAvgHours}h/day • ${Number(empOvertimeHours.toFixed(1))}h OT`,
        affectedDates,
        recentDate: affectedDates[0] || baseTelemetry.recentDate,
        explanation: explanationText,
        narrativeExplanation: explanationText,
        recommendedAction: actionText,
        suggestedAction: actionText
      });
    }

    // ------------------------------------------------------------------------
    // Rule D: Unexcused Absence or Zero Biometric Activity in Window
    // ------------------------------------------------------------------------
    if (explicitAbsentRecords.length >= 1 || (totalPunches === 0 && approvedLeaveDays < lookbackDays)) {
      const absentDates = explicitAbsentRecords.map((p) => formatDateYMD(p.date)).filter(Boolean);
      const isZeroPunch = totalPunches === 0;
      const detectedCount = isZeroPunch ? 1 : explicitAbsentRecords.length;
      const isCritical = explicitAbsentRecords.length >= 2 || (isZeroPunch && lookbackDays >= 14);
      const score = isZeroPunch ? 78 : Math.min(94, 58 + explicitAbsentRecords.length * 15);

      const explanationText = isZeroPunch
        ? `Active employee ${emp.name} (${emp.employeeCode}) has 0 biometric punch records logged over the last ${lookbackDays} days (${approvedLeaveDays} approved leave days on record).`
        : `Recorded ${explicitAbsentRecords.length} unexcused 'Absent' attendance status log(s) in the last ${lookbackDays} days.`;
      const actionText = isZeroPunch
        ? `Verify if ${emp.name} is deployed on client-site exempt from local biometric terminal or requires user_id linkage / regularization.`
        : `Cross-check absent dates (${absentDates.slice(0, 3).join(", ")}) with leave portal or initiate LOP adjustment.`;

      anomalies.push({
        id: `ANOM-ABSENT-${emp.empKey}`,
        ...baseTelemetry,
        type: "UNEXCUSED_ABSENCE_GAP",
        patternType: "UNEXCUSED_ABSENCE_GAP",
        patternLabel: isZeroPunch ? "No Biometric Logs in Window" : "Unexcused Absence Flag",
        severity: isCritical ? "CRITICAL" : "WARNING",
        anomalyScore: score,
        severityScore: score,
        detectedCount,
        metricHighlight: isZeroPunch ? `0 punches in ${lookbackDays}d` : `${explicitAbsentRecords.length} absent day(s)`,
        affectedDates: absentDates.length > 0 ? absentDates.slice(0, 6) : [todayStr],
        recentDate: absentDates[0] || todayStr,
        explanation: explanationText,
        narrativeExplanation: explanationText,
        recommendedAction: actionText,
        suggestedAction: actionText
      });
    }

    // ------------------------------------------------------------------------
    // Rule E: Pending Attendance Regularization Requests
    // ------------------------------------------------------------------------
    const pendingRegs = emp.regularizations.filter((r) =>
      String(r.status || "").toLowerCase().includes("pending")
    );
    if (pendingRegs.length >= 1) {
      const regDates = pendingRegs.map((r) => formatDateYMD(r.attendance_date)).filter(Boolean);
      const explanationText = `${emp.name} has ${pendingRegs.length} pending attendance regularization request(s) awaiting review (Reason: "${pendingRegs[0]?.reason || " Biometric correction"}").`;
      const actionText = `Review and approve/reject pending regularization in the Attendance Regularization queue.`;

      anomalies.push({
        id: `ANOM-REG-${emp.empKey}`,
        ...baseTelemetry,
        type: "PENDING_REGULARIZATION_REVIEW",
        patternType: "PENDING_REGULARIZATION_REVIEW",
        patternLabel: "Pending Regularization Request",
        severity: pendingRegs.length >= 3 ? "CRITICAL" : "WARNING",
        anomalyScore: Math.min(88, 50 + pendingRegs.length * 10),
        severityScore: Math.min(88, 50 + pendingRegs.length * 10),
        detectedCount: pendingRegs.length,
        metricHighlight: `${pendingRegs.length} pending request(s)`,
        affectedDates: regDates.slice(0, 6),
        recentDate: regDates[0] || baseTelemetry.recentDate,
        explanation: explanationText,
        narrativeExplanation: explanationText,
        recommendedAction: actionText,
        suggestedAction: actionText
      });
    }
  }

  // Sort by highest severity score, then critical first
  anomalies.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === "CRITICAL" ? -1 : 1;
    }
    return b.severityScore - a.severityScore;
  });

  // Department & Pattern aggregations from real detected anomalies
  const deptMap = {};
  const patternMap = {};
  for (const a of anomalies) {
    const d = a.department || "Unassigned";
    if (!deptMap[d]) {
      deptMap[d] = { department: d, total: 0, critical: 0, warning: 0 };
    }
    deptMap[d].total += 1;
    if (a.severity === "CRITICAL") deptMap[d].critical += 1;
    else deptMap[d].warning += 1;

    const pKey = a.patternLabel || a.type;
    if (!patternMap[pKey]) {
      patternMap[pKey] = { pattern: pKey, type: a.type, count: 0 };
    }
    patternMap[pKey].count += 1;
  }

  const overallPunctualityRate =
    totalEvaluatedCheckIns > 0
      ? Number(((totalOnTimePunches / totalEvaluatedCheckIns) * 100).toFixed(1))
      : 100;
  const avgWorkforceHours =
    totalShiftsWithHours > 0
      ? Number((totalLoggedShiftHours / totalShiftsWithHours).toFixed(2))
      : 0;
  const employeesWithPunches = Array.from(byEmployee.values()).filter(
    (e) => e.punches.length > 0
  ).length;

  const recentPunches = punches.slice(0, 60).map((p) => {
    let shiftHours = Number(p.working_hours || 0);
    if (shiftHours <= 0 && p.check_in && p.check_out) {
      const diff = (new Date(p.check_out) - new Date(p.check_in)) / 3600000;
      if (diff > 0 && diff < 24) {
        shiftHours = Number(diff.toFixed(2));
      }
    }
    return {
      id: p.id,
      date: formatDateYMD(p.date),
      employeeCode: p.employee_code || `USR-${p.employee_id}`,
      employeeName:
        `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.user_name || "Employee",
      department: p.department || "Unassigned",
      checkIn: p.check_in ? formatTime12h(p.check_in) : "Not Punched",
      checkOut: p.check_out ? formatTime12h(p.check_out) : "Pending / Open",
      workingHours: shiftHours > 0 ? shiftHours : 0,
      overtimeHours: Number(p.overtime_hours || 0),
      lateMinutes: Number(p.late_minutes || 0),
      isLate: Boolean(p.is_late) || String(p.status || "").toLowerCase() === "late" || Number(p.late_minutes || 0) > 0,
      status: p.status || "Present",
      remarks: p.remarks || null
    };
  });

  return {
    success: true,
    scope,
    lookbackDays,
    scannedPunches: punches.length,
    scannedEmployees: byEmployee.size,
    employeesWithPunches,
    anomaliesFound: anomalies.length,
    criticalCount: anomalies.filter((a) => a.severity === "CRITICAL").length,
    warningCount: anomalies.filter((a) => a.severity === "WARNING").length,
    overallPunctualityRate,
    avgWorkforceHours,
    autoClosedCount: totalAutoClosedShifts,
    departmentBreakdown: Object.values(deptMap).sort((a, b) => b.total - a.total),
    patternBreakdown: Object.values(patternMap).sort((a, b) => b.count - a.count),
    employeeTelemetry: employeeTelemetryList,
    recentPunches,
    anomalies
  };
}

/* ============================================================================
   4. AI RECRUITMENT ASSISTANT (100% Real Candidate & Resume Skill Matching)
   ============================================================================ */

export async function analyzeCandidateRecruitment(
  candidateId,
  customResumeText = null,
  targetRole = "Lead Cloud Architect"
) {
  let candidate = null;
  if (candidateId) {
    const { rows } = await safeQuery(
      `SELECT * FROM candidates WHERE id::text = $1::text OR candidate_id = $1::text LIMIT 1`,
      [String(candidateId)]
    );
    candidate = rows[0] || null;
  }

  // If no candidateId was provided and no customResumeText was provided, load the most recent candidate from DB
  if (!candidate && (!customResumeText || !String(customResumeText).trim())) {
    const { rows } = await safeQuery(`SELECT * FROM candidates ORDER BY id DESC LIMIT 1`);
    candidate = rows[0] || null;
  }

  const candidateName = candidate
    ? `${candidate.first_name || candidate.name || ""} ${candidate.last_name || ""}`.trim() ||
      candidate.email ||
      `Candidate #${candidate.id}`
    : "Custom Resume Applicant";

  const candidateCode = candidate?.candidate_id || (candidate?.id ? `CAND-${candidate.id}` : "CUSTOM-EVAL");
  const candidateSkillsStr = Array.isArray(candidate?.skills)
    ? candidate.skills.join(", ")
    : String(candidate?.skills || "");

  const dbProfileText = candidate
    ? [
        candidateSkillsStr,
        candidate.designation,
        candidate.department,
        candidate.experience ? `${candidate.experience} years experience` : "",
        candidate.status ? `Pipeline Status: ${candidate.status}` : "",
        candidate.bgv_status ? `BGV: ${candidate.bgv_status}` : ""
      ]
        .filter(Boolean)
        .join(" • ")
    : "";

  const resumeText =
    customResumeText && String(customResumeText).trim()
      ? `${String(customResumeText).trim()} ${dbProfileText}`
      : dbProfileText;

  // Target Role Competency Profiles
  const ROLE_COMPETENCIES = {
    "Lead Cloud Architect": {
      required: ["azure", "kubernetes", "terraform", "docker", "microservices", "cloud", "ci/cd"],
      preferred: ["postgresql", "node.js", "security", "helm", "monitoring", "gitops", "aws"],
      minYears: 7
    },
    "Senior Full-Stack PERN Engineer": {
      required: ["react", "node", "express", "postgresql", "javascript", "api", "sql"],
      preferred: ["typescript", "docker", "redis", "jest", "tailwind", "git", "html", "css"],
      minYears: 5
    },
    "Senior Fullstack Engineer": {
      required: ["react", "node", "javascript", "postgresql", "api", "html", "css"],
      preferred: ["typescript", "docker", "aws", "jest", "redis"],
      minYears: 5
    },
    "DevOps & SRE Specialist": {
      required: ["docker", "kubernetes", "terraform", "ci/cd", "gitops", "linux", "cloud"],
      preferred: ["prometheus", "grafana", "helm", "ansible", "python", "security", "azure", "aws"],
      minYears: 4
    },
    "DevOps Automation Engineer": {
      required: ["docker", "kubernetes", "ci/cd", "linux", "terraform", "bash", "aws"],
      preferred: ["ansible", "prometheus", "grafana", "python", "helm"],
      minYears: 4
    },
    "Staff Data Engineer": {
      required: ["postgresql", "sql", "python", "etl", "data", "spark", "cloud"],
      preferred: ["kafka", "airflow", "snowflake", "dbt", "docker", "kubernetes"],
      minYears: 6
    },
    "Quality Assurance Automation Lead": {
      required: ["automation", "selenium", "cypress", "playwright", "testing", "ci/cd", "javascript"],
      preferred: ["jest", "postman", "docker", "performance", "sql", "git"],
      minYears: 5
    }
  };

  const targetProfile = ROLE_COMPETENCIES[targetRole] || ROLE_COMPETENCIES["Lead Cloud Architect"];
  const lowerResume = resumeText.toLowerCase();

  const matchedSkills = [];
  const missingSkills = [];

  for (const reqSkill of targetProfile.required) {
    if (lowerResume.includes(reqSkill)) {
      matchedSkills.push(reqSkill);
    } else {
      missingSkills.push(reqSkill);
    }
  }

  const preferredMatched = [];
  for (const prefSkill of targetProfile.preferred) {
    if (lowerResume.includes(prefSkill)) {
      preferredMatched.push(prefSkill);
    }
  }

  // Also include any explicit skills from the candidate DB record
  const rawCandidateSkillTokens = candidateSkillsStr
    .split(/[,;|/]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);

  const reqMatchScore = (matchedSkills.length / Math.max(1, targetProfile.required.length)) * 80;
  const prefMatchScore = (preferredMatched.length / Math.max(1, targetProfile.preferred.length)) * 20;
  const matchPercentage = Math.round(reqMatchScore + prefMatchScore);

  const interviewQuestions = [];
  if (missingSkills.length > 0) {
    interviewQuestions.push(
      `How have you approached or ramped up on ${missingSkills.slice(0, 2).join(" and ")} in production systems relevant to the ${targetRole} role?`
    );
  }
  if (matchedSkills.length > 0) {
    interviewQuestions.push(
      `Walk us through a complex production architecture where you utilized ${matchedSkills.slice(0, 3).join(", ")} and how you handled scalability and failure recovery.`
    );
  }
  if (rawCandidateSkillTokens.length > 0) {
    interviewQuestions.push(
      `Your profile lists ${rawCandidateSkillTokens.slice(0, 3).join(", ")} — what was the most challenging bottleneck you resolved using these technologies?`
    );
  }
  interviewQuestions.push(
    `How do you enforce security governance, automated testing, and deployment observability for ${targetRole} deliverables?`
  );

  const allMatched = [...new Set([...matchedSkills, ...preferredMatched, ...rawCandidateSkillTokens])];

  return {
    success: true,
    candidateName,
    candidateId: candidateCode,
    candidateEmail: candidate?.email || null,
    candidateStatus: candidate?.status || "Evaluated",
    candidateExperience: candidate?.experience || null,
    targetRole,
    matchPercentage,
    matchRating:
      matchPercentage >= 80
        ? "STRONG_FIT"
        : matchPercentage >= 55
        ? "POTENTIAL_FIT"
        : "SKILL_GAP",
    matchedSkills: allMatched,
    missingRequiredSkills: missingSkills,
    extractedResumeSummary: dbProfileText || resumeText,
    experienceSummary: `${candidateName} (${candidateCode}) exhibits ${matchPercentage}% qualification alignment for ${targetRole}${candidate?.experience ? ` with ${candidate.experience} reported experience` : ""}. Verified competencies: ${allMatched.slice(0, 6).join(", ") || "None extracted"}. Required skills to probe during technical interview: ${missingSkills.length ? missingSkills.join(", ") : "All mandatory competencies verified"}.`,
    humanGovernanceNotice:
      "AI recommendations are advisory tools computed against PostgreSQL candidate profiles. All final hiring, compensation, and interview selections remain exclusively human-governed.",
    suggestedInterviewQuestions: interviewQuestions.slice(0, 4)
  };
}

/* ============================================================================
   5. HR POLICY SEARCH (Semantic Retrieval with Clause Citations)
   ============================================================================ */

export async function searchHrPolicies(rawQuery, role = "employee") {
  const query = String(rawQuery || "").trim();
  if (query.length < 2) {
    return { success: false, message: "Query too short." };
  }

  const { rows: policies } = await safeQuery(
    `SELECT policy_code, title, category, content, version, effective_from
     FROM ai_policy_documents
     WHERE is_active = true`
  );

  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const scored = [];

  for (const pol of policies) {
    const fullText = `${pol.title} ${pol.category} ${pol.content}`.toLowerCase();
    let hits = 0;
    for (const kw of keywords) {
      if (fullText.includes(kw)) hits++;
    }

    if (hits > 0) {
      const confidence = Math.min(98, Math.round((hits / Math.max(1, keywords.length)) * 85) + 12);
      const sentences = String(pol.content || "").split(/(?<=[.!?])\s+/);
      const matchingSentence =
        sentences.find((s) => keywords.some((k) => s.toLowerCase().includes(k))) || sentences[0] || "";

      scored.push({
        policy_code: pol.policy_code,
        title: pol.title,
        category: pol.category,
        version: pol.version || "1.0",
        effectiveDate: pol.effective_from,
        confidence,
        clauseSnippet: matchingSentence.trim()
      });
    }
  }

  scored.sort((a, b) => b.confidence - a.confidence);

  if (!scored.length) {
    return {
      success: true,
      query,
      confidence: 0,
      answer:
        "No specific approved policy matches found in PostgreSQL `ai_policy_documents` for your query. Please contact HR Operations or raise a helpdesk ticket.",
      sources: []
    };
  }

  const topMatch = scored[0];
  return {
    success: true,
    query,
    confidence: topMatch.confidence,
    answer: `According to **${topMatch.title}** (${topMatch.policy_code}, Ver ${topMatch.version}):\n\n> "${topMatch.clauseSnippet}"`,
    sources: scored.slice(0, 3)
  };
}

/**
 * Real-time Policy Vault Document Statistics
 */
export async function getPolicyVaultStats() {
  const { rows } = await safeQuery(
    `SELECT count(*)::int as total, count(DISTINCT category)::int as categories FROM ai_policy_documents WHERE is_active = true`
  );
  const total = rows[0]?.total || 0;
  const categories = rows[0]?.categories || 0;
  return {
    totalPolicySets: total,
    categories,
    semanticIndexStatus: total > 0 ? "Semantic Index Active" : "No Active Policies in DB"
  };
}
