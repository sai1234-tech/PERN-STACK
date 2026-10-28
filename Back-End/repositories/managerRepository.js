import pool from "../config/db.js";

const EXCLUDED_TEAM_NAMES = new Set([
    "systemadmin",
    "system admin",
    "adminuser",
    "admin user",
    "admindemo",
    "admin demo",
    "hrmanager",
    "hr manager",
    "teammanager",
    "team manager",
    "johnmanager",
    "john manager",
    "hradmin",
    "hr admin",
    "employeedemo",
    "employee demo",
    "testemployeeuser",
    "test employee user",
    "sarahsmith",
    "sarah smith",
    "saikumarr",
    "sai kumarr",
]);

const EXCLUDED_TEAM_EMAILS = new Set([
    "admin@company.com",
    "admin@example.com",
    "admin@hrms.com",
    "hr@company.com",
    "hr@hrms.com",
    "manager@company.com",
    "manager@hrms.com",
    "employee@hrms.com",
    "sarah.smith@company.com",
    "saikumarr@gmail.com",
]);

const EXCLUDED_TEAM_CODES = new Set([
    "EMP0003",
    "EMP009",
    "EMP010",
    "EMP011",
    "EMP013",
    "EMP014",
    "EMP015",
    "EMP016",
    "EMP017",
    "EMP018",
    "EMP019",
    "EMP020",
]);

const isExcludedSystemAccount = (emp) => {
    if (!emp) return true;
    const fullName = `${emp.first_name || ""} ${emp.last_name || ""}`.trim().toLowerCase();
    const cleanName = fullName.replace(/[^a-z0-9]/g, "");
    if (EXCLUDED_TEAM_NAMES.has(fullName) || EXCLUDED_TEAM_NAMES.has(cleanName)) return true;

    const email = String(emp.email || "").trim().toLowerCase();
    if (EXCLUDED_TEAM_EMAILS.has(email) || (email.startsWith("emp_") && email.endsWith("@hrms.com"))) return true;

    const code = String(emp.employee_code || "").trim().toUpperCase();
    if (EXCLUDED_TEAM_CODES.has(code)) return true;

    return false;
};

const queryDirectReportsForManagers = async (mgrRows, extraUserIds = [], matchVikasAlias = false) => {
    const mgrEmpIds = Array.from(new Set(mgrRows.map((r) => Number(r.id)).filter(Boolean)));
    const mgrUserIds = Array.from(
        new Set([...mgrRows.map((r) => Number(r.user_id)).filter(Boolean), ...extraUserIds.map(Number).filter(Boolean)])
    );
    const allNumericIds = Array.from(new Set([...mgrEmpIds, ...mgrUserIds]));

    const mgrTokens = Array.from(
        new Set([
            ...allNumericIds.map((id) => String(id).toUpperCase()),
            ...mgrRows.map((r) => String(r.employee_code || "").trim().toUpperCase()).filter(Boolean),
            ...mgrRows.map((r) => String(r.email || "").trim().toUpperCase()).filter(Boolean),
            ...mgrRows
                .map((r) => `${r.first_name || ""} ${r.last_name || ""}`.trim().toUpperCase())
                .filter(Boolean),
            ...(matchVikasAlias ? ["VIKAS GURU", "VIKAS", "GVIKAS@QUADRATICS.COM", "VIKASGURU@GMAIL.COM"] : []),
        ])
    );

    if (allNumericIds.length === 0 && mgrTokens.length === 0) {
        return [];
    }

    const res = await pool.query(
        `SELECT id, first_name, last_name, employee_code, profile_photo, email, employment, reports_to, matrix_manager_id
         FROM employees
         WHERE NOT (id = ANY($1::int[]))
           AND (
               (reports_to IS NOT NULL AND reports_to = ANY($2::int[]))
               OR (matrix_manager_id IS NOT NULL AND matrix_manager_id = ANY($2::int[]))
               OR UPPER(COALESCE(employment->>'reportsTo', '')) = ANY($3::text[])
               OR UPPER(COALESCE(employment->>'matrixReportsTo', '')) = ANY($3::text[])
               OR UPPER(COALESCE(employment->>'manager', '')) = ANY($3::text[])
               OR ($4 = true AND LOWER(COALESCE(employment->>'reportingManager', '')) LIKE '%vikas%')
           )
         ORDER BY id ASC;`,
        [mgrEmpIds.length > 0 ? mgrEmpIds : [0], allNumericIds.length > 0 ? allNumericIds : [0], mgrTokens, matchVikasAlias]
    );

    return res.rows.filter((emp) => !isExcludedSystemAccount(emp));
};

// Helper to get team members mapped in HR for a manager
export const getTeamMemberIds = async (userId, email) => {
    const cleanEmail = email ? email.trim().toLowerCase() : "";
    const isVikasUser =
        cleanEmail.includes("vikas") ||
        cleanEmail === "gvikas@quadratics.com" ||
        cleanEmail === "vikasguru@gmail.com" ||
        Number(userId) === 17 ||
        Number(userId) === 19;

    const aliasEmail =
        cleanEmail === "vikasguru@gmail.com"
            ? "gvikas@quadratics.com"
            : cleanEmail === "gvikas@quadratics.com"
            ? "vikasguru@gmail.com"
            : cleanEmail;

    // 1. Find manager employee record(s) for current user
    const mgrUserRes = await pool.query(
        `SELECT * FROM employees
         WHERE user_id = $1
            OR ($2 <> '' AND LOWER(email) = LOWER($2))
            OR ($3 <> '' AND LOWER(email) = LOWER($3))
            OR ($4 = true AND (LOWER(email) IN ('gvikas@quadratics.com', 'vikasguru@gmail.com') OR LOWER(first_name) LIKE '%vikas%' OR user_id IN (17, 19)));`,
        [userId || 0, cleanEmail, aliasEmail, isVikasUser]
    );

    let managerRows = mgrUserRes.rows;
    let managerEmp = managerRows[0] || null;
    let managerEmpId = managerEmp ? managerEmp.id : null;

    // 2. Find direct team members mapped to this manager in HR
    let directRows = await queryDirectReportsForManagers(
        managerRows,
        userId ? [Number(userId)] : [],
        isVikasUser
    );

    // 3. If logged in as HR/Admin (who has 0 direct reports of their own), resolve the Team Manager's (Vikas Guru) HR-mapped team so HR and Manager views show the exact same mapped employees
    if (directRows.length === 0 && !isVikasUser) {
        const vikasMgrRes = await pool.query(
            `SELECT * FROM employees
             WHERE LOWER(email) IN ('gvikas@quadratics.com', 'vikasguru@gmail.com')
                OR LOWER(first_name) LIKE '%vikas%'
                OR user_id IN (17, 19);`
        );
        if (vikasMgrRes.rows.length > 0) {
            if (!managerEmp) {
                managerEmp = vikasMgrRes.rows[0];
                managerEmpId = managerEmp.id;
            }
            directRows = await queryDirectReportsForManagers(vikasMgrRes.rows, [17, 19], true);
        }
    }

    const teamMembers = directRows.map((emp) => ({
        _id: emp.id,
        id: emp.id,
        firstName: emp.first_name,
        lastName: emp.last_name || "",
        employeeCode: emp.employee_code,
        profilePhoto: emp.profile_photo || "",
        email: emp.email,
        reportsTo: emp.reports_to,
        matrixManagerId: emp.matrix_manager_id,
        employment: emp.employment || {}
    }));

    const teamIds = teamMembers.map((emp) => emp.id);

    return { managerEmp, managerEmpId, teamMembers, teamIds };
};

// ==========================================
// 1. GET TEAM OVERVIEW DATA
// ==========================================
export const getTeamOverviewRepo = async (userId, email) => {
    const { teamMembers, teamIds } = await getTeamMemberIds(userId, email);

    if (teamIds.length === 0) {
        return {
            teamSize: 0,
            teamMembers: [],
            pendingLeaves: 0,
            pendingTimesheets: 0
        };
    }

    // Pending Leaves Count
    const leaveRes = await pool.query(
        `SELECT COUNT(*)::INTEGER as count FROM leaves
         WHERE employee_id = ANY($1::int[])
           AND LOWER(status) IN ('pending', 'pending manager', 'pending_manager');`,
        [teamIds]
    );
    const pendingLeaves = leaveRes.rows[0].count;

    // Pending Timesheets Count
    const tsRes = await pool.query(
        `SELECT COUNT(*)::INTEGER as count FROM timesheets
         WHERE employee_id = ANY($1::int[])
           AND LOWER(status) = 'submitted';`,
        [teamIds]
    );
    const pendingTimesheets = tsRes.rows[0].count;

    return {
        teamSize: teamMembers.length,
        teamMembers,
        pendingLeaves,
        pendingTimesheets
    };
};

// ==========================================
// 2. GET TEAM LEAVES DATA
// ==========================================
export const getTeamLeavesRepo = async (userId, email, statusQuery) => {
    const { teamIds } = await getTeamMemberIds(userId, email);

    if (teamIds.length === 0) return [];

    let queryText = `
        SELECT 
            l.*,
            e.id AS emp_id, e.first_name, e.last_name, e.profile_photo, e.employee_code, e.email AS employee_email,
            lt.id AS lt_id, lt.name AS leave_type_name, lt.code AS leave_type_code
        FROM leaves l
        JOIN employees e ON l.employee_id = e.id
        JOIN leave_types lt ON l.leave_type_id = lt.id
        WHERE l.employee_id = ANY($1::int[])
    `;
    const values = [teamIds];

    if (statusQuery === "pending") {
        queryText += ` AND LOWER(l.status) IN ('pending', 'pending manager', 'pending_manager')`;
    } else if (statusQuery === "history") {
        queryText += ` AND LOWER(l.status) IN ('pending hr', 'approved', 'rejected', 'cancelled')`;
    }

    queryText += ` ORDER BY l.created_at DESC;`;

    const { rows } = await pool.query(queryText, values);

    return rows.map((r) => ({
        _id: r.id,
        id: r.id,
        employee: {
            _id: r.emp_id,
            id: r.emp_id,
            firstName: r.first_name,
            lastName: r.last_name || "",
            profilePhoto: r.profile_photo || "",
            employeeCode: r.employee_code,
            email: r.employee_email
        },
        leaveType: {
            _id: r.lt_id,
            id: r.lt_id,
            name: r.leave_type_name,
            code: r.leave_type_code
        },
        startDate: r.start_date,
        endDate: r.end_date,
        numberOfDays: Number(r.number_of_days),
        reason: r.reason,
        status: r.status,
        appliedAt: r.applied_at,
        managerApprovedBy: r.manager_approved_by,
        managerApprovedAt: r.manager_approved_at,
        managerRemarks: r.manager_remarks || "",
        hrApprovedBy: r.hr_approved_by,
        hrApprovedAt: r.hr_approved_at,
        hrRemarks: r.hr_remarks || "",
        rejectionReason: r.rejection_reason || "",
        document: r.document || "",
        createdAt: r.created_at,
        updatedAt: r.updated_at
    }));
};

// ==========================================
// 3. UPDATE TEAM LEAVE DATA
// ==========================================
export const updateTeamLeaveRepo = async (id, status, remarks, managerUserId) => {
    const leaveRes = await pool.query(`SELECT * FROM leaves WHERE id = $1;`, [id]);
    if (leaveRes.rows.length === 0) return { error: "NOT_FOUND" };

    const isApproveAction = ["approved", "Approved", "Pending HR", "pending hr"].includes(status);

    let queryText = "";
    let values = [];

    if (isApproveAction) {
        queryText = `
            UPDATE leaves 
            SET status = 'Pending HR',
                manager_approved_by = $1,
                manager_approved_at = CURRENT_TIMESTAMP,
                manager_remarks = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *;
        `;
        values = [managerUserId, remarks || "Approved by Manager, forwarded to HR", id];
    } else {
        queryText = `
            UPDATE leaves 
            SET status = 'Rejected',
                rejection_reason = $1,
                manager_remarks = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *;
        `;
        values = [remarks || "Rejected by Manager", id];
    }

    const { rows } = await pool.query(queryText, values);
    const updated = rows[0];

    // Fetch formatted leave with relations
    const fullRes = await pool.query(
        `SELECT 
            l.*,
            e.id AS emp_id, e.first_name, e.last_name, e.profile_photo, e.employee_code, e.email AS employee_email,
            lt.id AS lt_id, lt.name AS leave_type_name, lt.code AS leave_type_code
        FROM leaves l
        JOIN employees e ON l.employee_id = e.id
        JOIN leave_types lt ON l.leave_type_id = lt.id
        WHERE l.id = $1;`,
        [updated.id]
    );

    const r = fullRes.rows[0];
    const data = {
        _id: r.id,
        id: r.id,
        employee: {
            _id: r.emp_id,
            id: r.emp_id,
            firstName: r.first_name,
            lastName: r.last_name || "",
            profilePhoto: r.profile_photo || "",
            employeeCode: r.employee_code,
            email: r.employee_email
        },
        leaveType: {
            _id: r.lt_id,
            id: r.lt_id,
            name: r.leave_type_name,
            code: r.leave_type_code
        },
        startDate: r.start_date,
        endDate: r.end_date,
        numberOfDays: Number(r.number_of_days),
        reason: r.reason,
        status: r.status,
        appliedAt: r.applied_at,
        managerApprovedBy: r.manager_approved_by,
        managerApprovedAt: r.manager_approved_at,
        managerRemarks: r.manager_remarks || "",
        rejectionReason: r.rejection_reason || "",
        isApproveAction
    };

    return { data, isApproveAction };
};

// ==========================================
// 4. GET TEAM TIMESHEETS DATA
// ==========================================
export const getTeamTimesheetsRepo = async (userId, email, statusQuery = "submitted") => {
    const { teamIds } = await getTeamMemberIds(userId, email);

    if (teamIds.length === 0) return [];

    let queryText = `
        SELECT 
            t.*,
            e.id AS emp_id, e.first_name, e.last_name, e.profile_photo, e.employee_code,
            u.name AS reviewer_user_name,
            m.first_name AS reviewer_first_name,
            m.last_name AS reviewer_last_name
        FROM timesheets t
        JOIN employees e ON t.employee_id = e.id
        LEFT JOIN users u ON t.reviewed_by = u.id
        LEFT JOIN employees m ON u.id = m.user_id
        WHERE t.employee_id = ANY($1::int[])
    `;
    const values = [teamIds];

    if (statusQuery && statusQuery !== "all") {
        if (["pending", "submitted"].includes(statusQuery.toLowerCase())) {
            queryText += ` AND LOWER(t.status) = 'submitted'`;
        } else if (statusQuery.toLowerCase() === "history") {
            queryText += ` AND LOWER(t.status) IN ('pending_hr', 'approved', 'rejected')`;
        } else {
            queryText += ` AND LOWER(t.status) = $2`;
            values.push(statusQuery.toLowerCase());
        }
    }

    queryText += ` ORDER BY t.date DESC;`;

    const { rows } = await pool.query(queryText, values);

    return rows.map((r) => {
        let revName = null;
        if (r.reviewer_first_name || r.reviewer_last_name) {
            revName = `${r.reviewer_first_name || ''} ${r.reviewer_last_name || ''}`.trim() + " (Team Manager)";
        } else if (r.reviewer_user_name) {
            revName = r.reviewer_user_name;
        }

        return {
            _id: r.id,
            id: r.id,
            employee: {
                _id: r.emp_id,
                id: r.emp_id,
                firstName: r.first_name,
                lastName: r.last_name || "",
                profilePhoto: r.profile_photo || "",
                employeeCode: r.employee_code
            },
            date: r.date,
            project: r.project || "",
            client: r.client || "",
            costCenter: r.cost_center || "",
            task: r.task || "",
            description: r.description || "",
            startTime: r.start_time,
            endTime: r.end_time,
            breakMinutes: Number(r.break_minutes || 0),
            entryMode: r.entry_mode || "manual",
            billable: r.billable !== false,
            hours: Number(r.hours || 0),
            status: r.status,
            submittedAt: r.submitted_at,
            reviewedBy: r.reviewed_by,
            reviewedAt: r.reviewed_at,
            reviewer: revName,
            reviewComment: r.review_comment || "",
            rejectionReason: r.review_comment || "",
            managerApprovedBy: r.manager_approved_by,
            managerApprovedAt: r.manager_approved_at,
            managerRemarks: r.manager_remarks || "",
            hrApprovedBy: r.hr_approved_by,
            hrApprovedAt: r.hr_approved_at,
            hrRemarks: r.hr_remarks || ""
        };
    });
};

// ==========================================
// 5. UPDATE TEAM TIMESHEET DATA
// ==========================================
export const updateTeamTimesheetRepo = async (id, status, reviewComment, managerUserId, email) => {
    const tsRes = await pool.query(`SELECT * FROM timesheets WHERE id = $1;`, [id]);
    if (tsRes.rows.length === 0) return { error: "NOT_FOUND" };

    const timesheet = tsRes.rows[0];
    const { managerEmpId, teamIds } = await getTeamMemberIds(managerUserId, email);

    if (!teamIds.includes(timesheet.employee_id)) {
        return { error: "FORBIDDEN" };
    }

    const isApproveAction = ["approved", "Approved", "pending_hr", "Pending HR"].includes(status);
    const finalStatus = isApproveAction ? "pending_hr" : "rejected";
    const comment = reviewComment || (isApproveAction ? "Approved by Manager, forwarded to HR" : "Rejected by Manager");

    let queryText = "";
    let values = [];

    if (isApproveAction) {
        queryText = `
            UPDATE timesheets
            SET status = $1,
                review_comment = $2,
                reviewed_by = $3,
                reviewed_at = CURRENT_TIMESTAMP,
                manager_approved_by = $3,
                manager_approved_at = CURRENT_TIMESTAMP,
                manager_remarks = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *;
        `;
        values = [finalStatus, comment, managerUserId, id];
    } else {
        queryText = `
            UPDATE timesheets
            SET status = $1,
                review_comment = $2,
                reviewed_by = $3,
                reviewed_at = CURRENT_TIMESTAMP,
                manager_remarks = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *;
        `;
        values = [finalStatus, comment, managerUserId, id];
    }

    const { rows } = await pool.query(queryText, values);
    const updated = rows[0];

    return {
        data: {
            _id: updated.id,
            id: updated.id,
            employee: updated.employee_id,
            date: updated.date,
            project: updated.project,
            client: updated.client,
            task: updated.task,
            hours: Number(updated.hours),
            status: updated.status,
            reviewComment: updated.review_comment,
            reviewedBy: updated.reviewed_by,
            reviewedAt: updated.reviewed_at,
            managerApprovedBy: updated.manager_approved_by,
            managerApprovedAt: updated.manager_approved_at,
            managerRemarks: updated.manager_remarks,
            hrApprovedBy: updated.hr_approved_by,
            hrApprovedAt: updated.hr_approved_at,
            hrRemarks: updated.hr_remarks,
            isApproveAction
        },
        isApproveAction
    };
};

// ==========================================
// 6. GET ACTIVE PROJECTS DATA (LIVE ALLOCATIONS + SOW MASTER + TIMESHEETS)
// ==========================================
export const getActiveProjectsRepo = async (userId, email) => {
    const { teamIds } = await getTeamMemberIds(userId, email);
    const projectsMap = {};

    // 1. Pull live project allocations from project_allocations (joined with employees)
    try {
        const allocQuery =
            teamIds.length > 0
                ? `
            SELECT pa.*, e.id AS resolved_emp_id, e.first_name, e.last_name, e.profile_photo, e.employee_code AS emp_code
            FROM project_allocations pa
            LEFT JOIN employees e
              ON e.id::text = pa.emp_id::text OR LOWER(e.employee_code) = LOWER(pa.employee_code)
            WHERE LOWER(COALESCE(pa.status, '')) = 'allocated'
              AND (e.id = ANY($1::int[]) OR $2 = true)
          `
                : `
            SELECT pa.*, e.id AS resolved_emp_id, e.first_name, e.last_name, e.profile_photo, e.employee_code AS emp_code
            FROM project_allocations pa
            LEFT JOIN employees e
              ON e.id::text = pa.emp_id::text OR LOWER(e.employee_code) = LOWER(pa.employee_code)
            WHERE LOWER(COALESCE(pa.status, '')) = 'allocated'
          `;
        const allocParams = teamIds.length > 0 ? [teamIds, true] : [];
        const { rows: allocRows } = await pool.query(allocQuery, allocParams);

        const dummyEmpIds = new Set(["EMP-101", "EMP-102", "EMP-103", "EMP-104"]);
        allocRows.forEach((pa) => {
            if (dummyEmpIds.has(String(pa.emp_id))) return;
            const projName = (pa.project_name || "").trim();
            if (!projName) return;
            const clientName = pa.client_name || (pa.sow_number ? `SOW: ${pa.sow_number}` : "Enterprise Client");

            if (!projectsMap[projName]) {
                projectsMap[projName] = {
                    name: projName,
                    client: clientName,
                    sowNumber: pa.sow_number || "",
                    totalHours: 0,
                    recentTasks: pa.sow_number ? [`Allocated under ${pa.sow_number}`] : ["Active Resource Allocation"],
                    activeMembersMap: new Map()
                };
            }

            const memberKey = String(pa.resolved_emp_id || pa.emp_id || pa.employee_code || pa.id);
            const fullNameParts = String(pa.employee_name || "").trim().split(" ");
            projectsMap[projName].activeMembersMap.set(memberKey, {
                _id: pa.resolved_emp_id || pa.emp_id,
                id: pa.resolved_emp_id || pa.emp_id,
                firstName: pa.first_name || fullNameParts[0] || "Team",
                lastName: pa.last_name || fullNameParts.slice(1).join(" ") || "",
                profilePhoto: pa.profile_photo || "",
                employeeCode: pa.emp_code || pa.employee_code || ""
            });
        });
    } catch (allocErr) {
        console.warn("getActiveProjectsRepo allocations lookup notice:", allocErr.message);
    }

    // 2. Pull live timesheets logged in the last 30 days
    if (teamIds.length > 0) {
        const queryText = `
            SELECT 
                t.*,
                e.id AS emp_id, e.first_name, e.last_name, e.profile_photo, e.employee_code
            FROM timesheets t
            JOIN employees e ON t.employee_id = e.id
            WHERE t.employee_id = ANY($1::int[])
              AND t.date >= (CURRENT_DATE - INTERVAL '30 days');
        `;

        const { rows } = await pool.query(queryText, [teamIds]);

        rows.forEach((ts) => {
            const rawProjName = (ts.project || "").trim();
            if (!rawProjName) return;
            // Match against existing allocated project name if formatted as "Project (SOW)"
            const matchedKey =
                Object.keys(projectsMap).find(
                    (k) =>
                        rawProjName.toLowerCase() === k.toLowerCase() ||
                        rawProjName.toLowerCase().includes(k.toLowerCase())
                ) || rawProjName;

            const clientName = ts.client || "Enterprise Client";

            if (!projectsMap[matchedKey]) {
                projectsMap[matchedKey] = {
                    name: matchedKey,
                    client: clientName,
                    totalHours: 0,
                    recentTasks: [],
                    activeMembersMap: new Map()
                };
            }

            projectsMap[matchedKey].totalHours += Number(ts.hours || 0);

            const taskName = (ts.task || ts.description || "").trim();
            if (
                taskName &&
                projectsMap[matchedKey].recentTasks.length < 5 &&
                !projectsMap[matchedKey].recentTasks.includes(taskName)
            ) {
                projectsMap[matchedKey].recentTasks.push(taskName);
            }

            if (ts.emp_id) {
                projectsMap[matchedKey].activeMembersMap.set(String(ts.emp_id), {
                    _id: ts.emp_id,
                    id: ts.emp_id,
                    firstName: ts.first_name,
                    lastName: ts.last_name || "",
                    profilePhoto: ts.profile_photo || "",
                    employeeCode: ts.employee_code
                });
            }
        });
    }

    return Object.values(projectsMap).map((p) => ({
        name: p.name,
        client: p.client,
        sowNumber: p.sowNumber || "",
        totalHours: p.totalHours,
        recentTasks: p.recentTasks,
        activeMembers: Array.from(p.activeMembersMap.values())
    }));
};
