import pool from "../config/db.js";
import { logAuditRecord } from "../repositories/auditRepository.js";

/**
 * 22-Stage Employee Lifecycle Workflow Master Specification
 */
export const LIFECYCLE_STAGES = [
  // ── Phase 1: Talent Acquisition & Preboarding (Stages 1–11) ──
  {
    stageNumber: 1,
    id: "manpower_request",
    title: "Manpower Request",
    phase: "Talent Acquisition",
    description: "Department requests a new employee headcount based on project or team requirements.",
    owner: "Department Head / Hiring Manager",
    allowedRoles: ["manager", "hiring_manager", "hr", "admin"],
    approvalRules: "Approved by Department Head and Finance for headcount budget authorization.",
    notification: "Email and in-app notification sent to HR Talent Acquisition Lead.",
    dbEntity: "candidates (requisition context) / departments",
    auditAction: "REQUISITION_REQUESTED",
  },
  {
    stageNumber: 2,
    id: "requisition_approval",
    title: "Requisition Approval",
    phase: "Talent Acquisition",
    description: "Manager and HR approve the hiring request, job description, and salary band.",
    owner: "HR Manager & Hiring Manager",
    allowedRoles: ["hr", "hr_manager", "admin", "super_admin"],
    approvalRules: "Dual sign-off required: Hiring Manager validates technical skills, HR verifies budget & band.",
    notification: "Job code issued; requisition published to hiring pipeline.",
    dbEntity: "candidates (status = 'Applied')",
    auditAction: "REQUISITION_APPROVED",
  },
  {
    stageNumber: 3,
    id: "candidate_sourcing",
    title: "Candidate Sourcing",
    phase: "Talent Acquisition",
    description: "HR sources, screens, and shortlists prospective applicants across portals.",
    owner: "Recruiter / TA",
    allowedRoles: ["recruiter", "talent_acquisition", "hr", "admin"],
    approvalRules: "Recruiter initial screening review on skills, experience, and notice period.",
    notification: "Candidate receives application receipt acknowledgement.",
    dbEntity: "candidates (status = 'Screening')",
    auditAction: "CANDIDATE_SOURCED",
  },
  {
    stageNumber: 4,
    id: "interview_rounds",
    title: "Interview Rounds",
    phase: "Talent Acquisition",
    description: "Interview rounds (Technical, Coding, System Design, HR culture fit) and feedback are recorded.",
    owner: "Interview Panel & Hiring Manager",
    allowedRoles: ["manager", "hiring_manager", "hr", "admin"],
    approvalRules: "Interviewer score rating >= 3.5 / 5.0 and recommendation to hire.",
    notification: "Calendar invites sent to candidate; feedback prompt sent to interview panel.",
    dbEntity: "candidates (status = 'Interview')",
    auditAction: "INTERVIEW_FEEDBACK_RECORDED",
  },
  {
    stageNumber: 5,
    id: "selection",
    title: "Selection",
    phase: "Talent Acquisition",
    description: "The final candidate is selected and recommended for corporate offer.",
    owner: "Hiring Manager & HR",
    allowedRoles: ["manager", "hiring_manager", "hr", "admin"],
    approvalRules: "Hiring Manager final recommendation + HR Business Partner concurrence.",
    notification: "Selection notification to candidate and internal hiring squad.",
    dbEntity: "candidates (status = 'Selected')",
    auditAction: "CANDIDATE_SELECTED",
  },
  {
    stageNumber: 6,
    id: "offer_issuance",
    title: "Offer Generation",
    phase: "Talent Acquisition",
    description: "HR generates and sends the formal digital offer letter with CTC breakup.",
    owner: "HR Manager / TA",
    allowedRoles: ["hr", "hr_manager", "admin"],
    approvalRules: "Compensation band checked against company salary structure by HR Lead.",
    notification: "Digital offer letter dispatched via email with secure review link.",
    dbEntity: "candidates (status = 'Offered')",
    auditAction: "OFFER_LETTER_GENERATED",
  },
  {
    stageNumber: 7,
    id: "offer_acceptance",
    title: "Offer Acceptance",
    phase: "Preboarding",
    description: "Candidate accepts or declines the offer with signed acceptance documentation.",
    owner: "Candidate",
    allowedRoles: ["candidate", "hr", "recruiter"],
    approvalRules: "Signed digital acceptance letter received before expiry date.",
    notification: "Instant notification dispatched to HR Recruiter and Hiring Manager.",
    dbEntity: "candidates (status = 'Offer Accepted')",
    auditAction: "OFFER_ACCEPTED",
  },
  {
    stageNumber: 8,
    id: "preboarding",
    title: "Preboarding Coordination",
    phase: "Preboarding",
    description: "HR collects initial details, coordinates IT provisioning, and prepares joining kit.",
    owner: "HR Operations & IT Admin",
    allowedRoles: ["hr_admin", "hr_operations", "hr", "it_admin", "admin"],
    approvalRules: "Laptop & asset tagged, corporate email queued, welcome buddy assigned.",
    notification: "Preboarding checklist checklist sent to IT and candidate.",
    dbEntity: "candidates / clearances",
    auditAction: "PREBOARDING_TASKS_INITIALIZED",
  },
  {
    stageNumber: 9,
    id: "documents_submission",
    title: "Documents Verification",
    phase: "Preboarding",
    description: "Candidate submits mandatory statutory documents (Aadhaar, PAN, certificates, relieving letter).",
    owner: "Candidate & HR Compliance",
    allowedRoles: ["candidate", "hr", "hr_admin", "admin"],
    approvalRules: "HR compliance verification of identity, educational certificates, and tax PAN.",
    notification: "Upload reminder / Document verification clearance notification.",
    dbEntity: "employee_documents",
    auditAction: "COMPLIANCE_DOCS_VERIFIED",
  },
  {
    stageNumber: 10,
    id: "bgv_tracking",
    title: "Background Verification (BGV)",
    phase: "Preboarding",
    description: "Background verification is initiated, monitored, and cleared via accredited agency.",
    owner: "BGV Partner & HR Compliance",
    allowedRoles: ["hr", "hr_admin", "admin"],
    approvalRules: "Identity, permanent address, previous employment, and criminal record verified clear.",
    notification: "BGV summary status sent to HR Manager (Clear / Flagged).",
    dbEntity: "candidates (bgv_status = 'Clear')",
    auditAction: "BGV_VERIFICATION_CLEARED",
  },
  {
    stageNumber: 11,
    id: "joining_confirmation",
    title: "Joining Confirmation",
    phase: "Preboarding",
    description: "Final joining date, office location, reporting details, and induction time are confirmed.",
    owner: "HR Operations & Reporting Manager",
    allowedRoles: ["hr", "hr_admin", "admin"],
    approvalRules: "Confirmed workstation, access credentials, and reporting manager presence.",
    notification: "First-day joining itinerary and calendar invite sent to joiner.",
    dbEntity: "candidates (joining_date confirmed)",
    auditAction: "JOINING_CONFIRMED",
  },

  // ── Phase 2: Joining & Onboarding (Stages 12–14) ──
  {
    stageNumber: 12,
    id: "employee_id_generation",
    title: "Employee ID Generation",
    phase: "Joining & Onboarding",
    description: "A permanent unique employee ID (e.g. EMP-2024-XXX) is generated and locked.",
    owner: "System Engine / HR Admin",
    allowedRoles: ["hr", "admin", "super_admin"],
    approvalRules: "Sequential validation ensuring no collision across enterprise database.",
    notification: "Employee ID assigned and confirmed in employee master.",
    dbEntity: "employees (employee_code UNIQUE)",
    auditAction: "EMPLOYEE_CODE_ASSIGNED",
  },
  {
    stageNumber: 13,
    id: "onboarding_orchestration",
    title: "Onboarding & Account Access",
    phase: "Joining & Onboarding",
    description: "Account credentials created, handbook/policies acknowledged, and employee profile initialized.",
    owner: "IT Admin & HR Operations",
    allowedRoles: ["hr", "it_admin", "admin", "super_admin"],
    approvalRules: "SSO/Workspace credentials dispatched; employee profile active in directory.",
    notification: "Welcome email with login credentials and onboarding checklist delivered.",
    dbEntity: "users (id) -> employees (user_id)",
    auditAction: "ACCOUNT_PROVISIONED_AND_ONBOARDED",
  },
  {
    stageNumber: 14,
    id: "project_allocation",
    title: "Client & Project Allocation",
    phase: "Joining & Onboarding",
    description: "Employee is assigned to an active client, billable project, SOW, and reporting manager.",
    owner: "Delivery Manager / RMO",
    allowedRoles: ["manager", "hiring_manager", "hr", "admin"],
    approvalRules: "Project allocation signed off by Delivery Manager and Resource Management.",
    notification: "Project assignment notice sent to employee, client manager, and payroll team.",
    dbEntity: "project_allocations (employee_id, project_name, client_name)",
    auditAction: "PROJECT_ALLOCATED",
  },

  // ── Phase 3: Active Employment & Lifecycle (Stages 15–18) ──
  {
    stageNumber: 15,
    id: "attendance_leave",
    title: "Attendance & Leave Operations",
    phase: "Active Employment",
    description: "Daily biometric/punch station attendance, shift rosters, holidays, and leave balances are managed.",
    owner: "Employee & Reporting Manager",
    allowedRoles: ["employee", "manager", "hr", "admin"],
    approvalRules: "Manager approval required for leave applications and attendance regularizations.",
    notification: "Push notifications for attendance regularizations and leave approvals.",
    dbEntity: "attendance / leaves / leave_types",
    auditAction: "ATTENDANCE_LEAVE_PROCESSED",
  },
  {
    stageNumber: 16,
    id: "payroll_inputs",
    title: "Payroll Inputs & Pay Run",
    phase: "Active Employment",
    description: "Attendance hours, leaves, LOP, overtime, and statutory deductions feed into monthly payroll.",
    owner: "Payroll / Finance Lead",
    allowedRoles: ["payroll", "finance", "hr", "admin"],
    approvalRules: "Payroll Lead computation + Finance Director sign-off prior to disbursement.",
    notification: "Digital payslip notification dispatched to employee upon bank transfer.",
    dbEntity: "payrolls (employee_id, net_salary, status = 'Paid')",
    auditAction: "PAYROLL_RUN_DISBURSED",
  },
  {
    stageNumber: 17,
    id: "performance_okr",
    title: "Performance & OKR Reviews",
    phase: "Active Employment",
    description: "Quarterly OKR goals, self-evaluations, manager reviews, and appraisal ratings are recorded.",
    owner: "Employee & Reporting Manager",
    allowedRoles: ["employee", "manager", "hr", "admin"],
    approvalRules: "Reporting Manager evaluation score and HR normalization sign-off.",
    notification: "Appraisal cycle open notification; final performance score publication.",
    dbEntity: "okrs (employee_id, score, manager_feedback)",
    auditAction: "OKR_PERFORMANCE_RATED",
  },
  {
    stageNumber: 18,
    id: "transfer_promotion",
    title: "Transfer / Promotion",
    phase: "Active Employment",
    description: "Department change, designation upgrade, salary revisions, or reporting manager updates are recorded.",
    owner: "HR Manager & Leadership",
    allowedRoles: ["hr", "hr_manager", "admin", "super_admin"],
    approvalRules: "Department Head recommendation + HR Leadership compensation band approval.",
    notification: "Official promotion/transfer letter issued; directory hierarchy updated.",
    dbEntity: "employees (designation, department, salary) + audit_logs",
    auditAction: "EMPLOYEE_PROMOTION_OR_TRANSFER",
  },

  // ── Phase 4: Offboarding & Separation (Stages 19–22) ──
  {
    stageNumber: 19,
    id: "resignation_submission",
    title: "Resignation & Notice Period",
    phase: "Offboarding & Separation",
    description: "Employee submits resignation letter; notice period and last working day (LWD) are tracked.",
    owner: "Employee & Reporting Manager",
    allowedRoles: ["employee", "manager", "hr", "admin"],
    approvalRules: "Manager initial review & discussion + HR Operations exit sign-off.",
    notification: "Alert sent to Manager, HR, and IT with official Last Working Day.",
    dbEntity: "resignations (employee_id, notice_period_days, status)",
    auditAction: "RESIGNATION_SUBMITTED",
  },
  {
    stageNumber: 20,
    id: "clearance_workflow",
    title: "Multi-Department Exit Clearance",
    phase: "Offboarding & Separation",
    description: "IT assets returned, email/SSO revoked, Finance loans settled, and HR exit interview completed.",
    owner: "IT, Finance, Admin & HR Ops",
    allowedRoles: ["it_admin", "payroll", "finance", "hr", "admin"],
    approvalRules: "All 4 departments (IT hardware, Finance dues, Facilities badge, HR interview) must clear.",
    notification: "Department clearance task reminders and completion certificates.",
    dbEntity: "clearances (employee_id, assets, it_access, finance)",
    auditAction: "EXIT_CLEARANCE_COMPLETED",
  },
  {
    stageNumber: 21,
    id: "ff_settlement",
    title: "Full & Final (F&F) Settlement",
    phase: "Offboarding & Separation",
    description: "Final salary, leave encashment, notice period buyout/waiver, and recovery calculations prepared.",
    owner: "Payroll / Finance Lead",
    allowedRoles: ["payroll", "finance", "hr", "admin"],
    approvalRules: "Finance Head review and audit sign-off on net settlement balance.",
    notification: "F&F statement and bank disbursement advice issued to former employee.",
    dbEntity: "clearances (final_settlement) + payrolls",
    auditAction: "FINAL_SETTLEMENT_PROCESSED",
  },
  {
    stageNumber: 22,
    id: "exit_documents",
    title: "Exit Documents & Certificates",
    phase: "Offboarding & Separation",
    description: "Relieving letter, experience certificate, and PF transfer forms are issued and archived.",
    owner: "HR Operations",
    allowedRoles: ["hr", "hr_admin", "admin"],
    approvalRules: "Verification that 100% of clearances and F&F settlement are cleared.",
    notification: "Digital Relieving Letter and Experience Certificate emailed to employee.",
    dbEntity: "clearances (relieving_letter) + employee_documents",
    auditAction: "EXIT_DOCUMENTS_ISSUED",
  },
];

/**
 * Controller: Get the full 22-Stage Master Blueprint
 */
export const getLifecycleStages = (_req, res) => {
  return res.status(200).json({
    success: true,
    totalStages: LIFECYCLE_STAGES.length,
    phases: [
      { id: "p1", name: "Talent Acquisition & Preboarding", stages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
      { id: "p2", name: "Joining & Onboarding", stages: [12, 13, 14] },
      { id: "p3", name: "Active Employment & Lifecycle", stages: [15, 16, 17, 18] },
      { id: "p4", name: "Offboarding & Separation", stages: [19, 20, 21, 22] },
    ],
    stages: LIFECYCLE_STAGES,
  });
};

/**
 * Controller: Get live Employee Lifecycle status joined across all 22 stages
 */
export const getEmployeeLifecycle = async (req, res) => {
  const { employeeId } = req.params;

  try {
    // 1. Fetch Employee record (supports numeric ID, user_id, or alphanumeric employee_code)
    let empRes;
    const isNumeric = /^\d+$/.test(String(employeeId).trim());
    if (isNumeric) {
      empRes = await pool.query(
        `SELECT e.*, u.email as user_email, u.role as user_role, u.is_active as user_active
         FROM employees e
         LEFT JOIN users u ON u.id = e.user_id
         WHERE e.id = $1 OR e.user_id = $1`,
        [Number(employeeId)]
      );
    } else {
      empRes = await pool.query(
        `SELECT e.*, u.email as user_email, u.role as user_role, u.is_active as user_active
         FROM employees e
         LEFT JOIN users u ON u.id = e.user_id
         WHERE LOWER(e.employee_code) = LOWER($1) OR LOWER(e.email) = LOWER($1)`,
        [String(employeeId).trim()]
      );
    }

    if (empRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Employee record not found" });
    }

    const employee = empRes.rows[0];
    const actualEmpId = employee.id;

    // 2. Fetch linked candidate record (if any)
    const candRes = await pool.query(
      `SELECT * FROM candidates WHERE LOWER(email) = LOWER($1) ORDER BY id DESC LIMIT 1`,
      [employee.email]
    );
    const candidate = candRes.rows[0] || null;

    // 3. Fetch linked project allocations
    const projRes = await pool.query(
      `SELECT * FROM project_allocations WHERE employee_code = $1 OR emp_id = $2 ORDER BY start_date DESC`,
      [employee.employee_code, String(actualEmpId)]
    );
    const allocations = projRes.rows;

    // 4. Fetch attendance summary
    const attRes = await pool.query(
      `SELECT COUNT(*) as total_punches, MAX(date) as last_punch_date FROM attendance WHERE employee_id = $1`,
      [actualEmpId]
    );
    const attendanceStats = attRes.rows[0];

    // 5. Fetch leave applications
    const leaveRes = await pool.query(
      `SELECT * FROM leaves WHERE employee_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [actualEmpId]
    );
    const leaves = leaveRes.rows;

    // 6. Fetch payroll history
    const payRes = await pool.query(
      `SELECT * FROM payrolls WHERE employee_id = $1 ORDER BY id DESC LIMIT 3`,
      [actualEmpId]
    );
    const payrolls = payRes.rows;

    // 7. Fetch OKRs / performance
    const okrRes = await pool.query(
      `SELECT * FROM okrs WHERE employee_id = $1 ORDER BY id DESC LIMIT 5`,
      [actualEmpId]
    );
    const okrs = okrRes.rows;

    // 8. Fetch Resignation / Separation records
    const resigRes = await pool.query(
      `SELECT * FROM resignations WHERE employee_id = $1 ORDER BY id DESC LIMIT 1`,
      [actualEmpId]
    );
    const resignation = resigRes.rows[0] || null;

    // 9. Fetch Clearances
    const clearRes = await pool.query(
      `SELECT * FROM clearances WHERE employee_id = $1 ORDER BY id DESC LIMIT 1`,
      [actualEmpId]
    );
    const clearance = clearRes.rows[0] || null;

    // 10. Fetch Audit Logs
    const auditRes = await pool.query(
      `SELECT * FROM audit_logs 
       WHERE (LOWER(entity_type) IN ('employee', 'lifecycle') AND (entity_id = $1 OR entity_id = $2 OR entity_id = $3))
          OR (LOWER(entity_type) = 'candidate' AND (entity_id = $4 OR entity_id = $5))
          OR (LOWER(entity_type) = 'user' AND entity_id = $2)
          OR (entity_id = $3)
       ORDER BY created_at DESC LIMIT 25`,
      [
        String(actualEmpId),
        employee.user_id ? String(employee.user_id) : "-1",
        employee.employee_code || "UNKNOWN",
        candidate ? String(candidate.id) : "-1",
        candidate?.candidate_id ? String(candidate.candidate_id) : "-1",
      ]
    );
    const audits = auditRes.rows;

    // 11. Compute live status for all 22 Stages
    const isSeparated = employee.status?.toLowerCase() === "inactive" || employee.status?.toLowerCase() === "terminated";
    const hasResignation = Boolean(resignation);

    const stagesEvaluation = LIFECYCLE_STAGES.map((st) => {
      let status = "Completed";
      let details = "";
      let completedAt = employee.joining_date;

      switch (st.stageNumber) {
        // Pre-joining / Sourcing stages
        case 1:
        case 2:
          status = "Completed";
          details = `Requisition approved for ${employee.department} - ${employee.designation}`;
          break;
        case 3:
        case 4:
        case 5:
          status = "Completed";
          details = candidate ? `Candidate ${candidate.name} screened and selected` : "Selected via direct employment";
          break;
        case 6:
        case 7:
          status = "Completed";
          details = candidate ? `Offer letter accepted with CTC band` : "Offer accepted upon hiring";
          break;
        case 8:
          status = "Completed";
          details = "Preboarding checklist coordinated (IT, credentials, induction buddy)";
          break;
        case 9:
          status = "Completed";
          details = "Mandatory identity & compliance documents archived";
          break;
        case 10:
          status = candidate?.bgv_status?.toLowerCase() === "flagged" ? "Rejected" : "Completed";
          details = candidate?.bgv_status ? `BGV Status: ${candidate.bgv_status}` : "Background verification cleared";
          break;
        case 11:
          status = "Completed";
          details = `Joined on ${employee.joining_date ? new Date(employee.joining_date).toLocaleDateString() : "Active"}`;
          break;

        // Onboarding stages
        case 12:
          status = "Completed";
          details = `Unique Code: ${employee.employee_code}`;
          break;
        case 13:
          status = employee.user_active ? "Completed" : "In Progress";
          details = employee.user_email ? `Workspace User: ${employee.user_email} (Role: ${employee.user_role})` : "Active";
          break;
        case 14:
          status = allocations.length > 0 ? "Completed" : "In Progress";
          details = allocations.length > 0 
            ? `Assigned to: ${allocations[0].project_name} (Client: ${allocations[0].client_name})`
            : "On Internal Bench / Awaiting project assignment";
          break;

        // Active Employment stages
        case 15:
          status = Number(attendanceStats.total_punches) > 0 ? "Completed" : "In Progress";
          details = `${attendanceStats.total_punches} total attendance records. Latest: ${attendanceStats.last_punch_date || "Today"}`;
          break;
        case 16:
          status = payrolls.length > 0 ? "Completed" : "In Progress";
          details = payrolls.length > 0 
            ? `Latest Net Pay: ₹${Number(payrolls[0].net_salary).toLocaleString()} (${payrolls[0].status})`
            : "Active in salary master";
          break;
        case 17:
          status = okrs.length > 0 ? "Completed" : "In Progress";
          details = okrs.length > 0 
            ? `Active Goals: ${okrs.length} OKRs logged. Rating: ${okrs[0].score || "Pending"}/5`
            : "Goal setting cycle in progress";
          break;
        case 18:
          status = "Completed";
          details = `Active Grade: ${employee.designation} in ${employee.department}`;
          break;

        // Offboarding stages
        case 19:
          if (hasResignation) {
            status = resignation.status === "Approved" ? "Completed" : "In Progress";
            details = `Resignation ${resignation.status}. Notice: ${resignation.notice_period_days || 30} days`;
          } else {
            status = "Pending";
            details = "Employee currently in active standing (no resignation submitted)";
          }
          break;
        case 20:
          if (clearance) {
            const isFull = clearance.assets?.status === "cleared" && clearance.it_access?.status === "cleared" && clearance.finance?.status === "cleared";
            status = isFull ? "Completed" : "In Progress";
            details = isFull ? "All 4 departments (IT, Finance, Admin, HR) cleared" : "Department clearances in progress";
          } else {
            status = "Pending";
            details = "Exit clearances not initiated";
          }
          break;
        case 21:
          if (clearance?.final_settlement?.status === "processed" || isSeparated) {
            status = "Completed";
            details = "Full & Final settlement computed and disbursed";
          } else if (hasResignation) {
            status = "In Progress";
            details = "Settlement calculations pending final clearance";
          } else {
            status = "Pending";
            details = "F&F settlement inputs not applicable for active employee";
          }
          break;
        case 22:
          if (clearance?.relieving_letter?.issued || isSeparated) {
            status = "Completed";
            details = "Relieving letter and experience certificate issued";
          } else if (hasResignation) {
            status = "In Progress";
            details = "Relieving letter awaiting clearance sign-off";
          } else {
            status = "Pending";
            details = "Exit documents pending separation";
          }
          break;
        default:
          status = "Pending";
      }

      // Check if this stage has an explicit transition in audit history
      const stageAudit = audits.find((a) => {
        try {
          const det = typeof a.details === "string" ? JSON.parse(a.details) : a.details;
          return Number(det?.stageNumber) === st.stageNumber;
        } catch {
          return false;
        }
      });

      if (stageAudit) {
        try {
          const det = typeof stageAudit.details === "string" ? JSON.parse(stageAudit.details) : stageAudit.details;
          if (det.status) status = det.status;
          if (det.notes) details = `${det.notes} (Updated by ${det.updatedBy || "HR"})`;
          completedAt = stageAudit.created_at;
        } catch {
          // fallback to standard calculation
        }
      }

      return {
        ...st,
        status,
        details,
        completedAt,
      };
    });

    const completedCount = stagesEvaluation.filter((s) => s.status === "Completed").length;
    const progressPct = Math.round((completedCount / LIFECYCLE_STAGES.length) * 100);

    return res.status(200).json({
      success: true,
      employee: {
        id: employee.id,
        code: employee.employee_code,
        name: `${employee.first_name} ${employee.last_name || ""}`.trim(),
        email: employee.email,
        department: employee.department,
        designation: employee.designation,
        status: employee.status,
        joiningDate: employee.joining_date,
      },
      summary: {
        totalStages: 22,
        completedCount,
        progressPct,
        currentStage: hasResignation ? (isSeparated ? 22 : 20) : 15,
        currentStageName: hasResignation ? (isSeparated ? "Exit Documents" : "Exit Clearance") : "Attendance & Leave Operations",
        isSeparated,
      },
      stages: stagesEvaluation,
      auditHistory: audits,
      linkedEntities: {
        candidateId: candidate?.id || null,
        userId: employee.user_id,
        allocationsCount: allocations.length,
        punchesCount: Number(attendanceStats.total_punches),
        payrollsCount: payrolls.length,
        hasResignation,
        hasClearance: Boolean(clearance),
      },
    });
  } catch (error) {
    console.error("Error fetching employee lifecycle:", error);
    return res.status(500).json({ success: false, message: "Failed to retrieve employee lifecycle" });
  }
};

/**
 * Controller: Advance / Transition Employee Lifecycle Stage
 */
export const advanceLifecycleStage = async (req, res) => {
  const { employeeId, stageNumber, status, notes } = req.body;

  try {
    const stage = LIFECYCLE_STAGES.find((s) => s.stageNumber === Number(stageNumber));
    if (!stage) {
      return res.status(400).json({ success: false, message: "Invalid stage number" });
    }

    // Log the lifecycle transition in audit logs
    const auditRecord = await logAuditRecord({
      userId: req.user?.id || 1,
      action: `LIFECYCLE_STAGE_${stageNumber}_${stage.id.toUpperCase()}`,
      entityType: "employee",
      entityId: employeeId,
      details: {
        stageNumber,
        stageTitle: stage.title,
        status: status || "Completed",
        notes: notes || "Workflow stage advanced by authorized personnel",
        updatedBy: req.user?.name || req.user?.email || "HR Operator",
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      success: true,
      message: `Stage ${stageNumber} (${stage.title}) updated successfully to ${status || "Completed"}.`,
      audit: auditRecord,
    });
  } catch (error) {
    console.error("Error advancing lifecycle stage:", error);
    return res.status(500).json({ success: false, message: "Failed to advance lifecycle stage" });
  }
};
