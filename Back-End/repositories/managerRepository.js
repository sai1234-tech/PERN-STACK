import pool from "../config/db.js";

// Helper to get team members for a manager
export const getTeamMemberIds = async (userId, email) => {
    // 1. Find manager employee record
    let managerEmp = null;
    const mgrUserRes = await pool.query(
        `SELECT * FROM employees WHERE user_id = $1 OR LOWER(email) = LOWER($2) LIMIT 1;`,
        [userId, email ? email.trim().toLowerCase() : ""]
    );
    if (mgrUserRes.rows.length > 0) {
        managerEmp = mgrUserRes.rows[0];
    }

    const managerEmpId = managerEmp ? managerEmp.id : null;

    // 2. Find direct team members
    const teamMembersRes = await pool.query(
        `SELECT id, first_name, last_name, employee_code, profile_photo, email, employment
         FROM employees
         WHERE (reports_to IS NOT NULL AND (reports_to = $1 OR reports_to = $2))
            OR (user_id IS NOT NULL AND user_id = $2 AND id != COALESCE($1, 0))
            OR (employment->>'manager' = $1::text OR employment->>'manager' = $2::text);`,
        [managerEmpId || 0, userId || 0]
    );

    const teamMembers = teamMembersRes.rows.map((emp) => ({
        _id: emp.id,
        id: emp.id,
        firstName: emp.first_name,
        lastName: emp.last_name || "",
        employeeCode: emp.employee_code,
        profilePhoto: emp.profile_photo || "",
        email: emp.email,
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
export const getTeamTimesheetsRepo = async (userId, email) => {
    const { teamIds } = await getTeamMemberIds(userId, email);

    if (teamIds.length === 0) return [];

    const queryText = `
        SELECT 
            t.*,
            e.id AS emp_id, e.first_name, e.last_name, e.profile_photo, e.employee_code
        FROM timesheets t
        JOIN employees e ON t.employee_id = e.id
        WHERE t.employee_id = ANY($1::int[])
          AND LOWER(t.status) = 'submitted'
        ORDER BY t.date DESC;
    `;

    const { rows } = await pool.query(queryText, [teamIds]);

    return rows.map((r) => ({
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
        submittedAt: r.submitted_at
    }));
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

    const queryText = `
        UPDATE timesheets
        SET status = $1,
            review_comment = $2,
            reviewed_by = $3,
            reviewed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *;
    `;

    const { rows } = await pool.query(queryText, [
        status,
        reviewComment || `Timesheet ${status} by Manager`,
        managerUserId,
        id
    ]);

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
            reviewedAt: updated.reviewed_at
        }
    };
};

// ==========================================
// 6. GET ACTIVE PROJECTS DATA
// ==========================================
export const getActiveProjectsRepo = async (userId, email) => {
    const { teamIds } = await getTeamMemberIds(userId, email);

    if (teamIds.length === 0) {
        return [
            {
                name: "GodavariDelta",
                client: "Internal",
                totalHours: 8,
                recentTasks: ["ApiIntegration", "Working on this"],
                activeMembers: []
            }
        ];
    }

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

    const projectsMap = {};

    rows.forEach((ts) => {
        const projName = ts.project || "GodavariDelta";
        const clientName = ts.client || "Internal";

        if (!projectsMap[projName]) {
            projectsMap[projName] = {
                name: projName,
                client: clientName,
                totalHours: 0,
                recentTasks: [],
                activeMembersMap: new Map()
            };
        }

        projectsMap[projName].totalHours += Number(ts.hours || 0);

        const taskName = ts.task || ts.description || "ApiIntegration";
        if (
            taskName &&
            projectsMap[projName].recentTasks.length < 5 &&
            !projectsMap[projName].recentTasks.includes(taskName)
        ) {
            projectsMap[projName].recentTasks.push(taskName);
        }

        if (ts.emp_id) {
            projectsMap[projName].activeMembersMap.set(String(ts.emp_id), {
                _id: ts.emp_id,
                id: ts.emp_id,
                firstName: ts.first_name,
                lastName: ts.last_name || "",
                profilePhoto: ts.profile_photo || "",
                employeeCode: ts.employee_code
            });
        }
    });

    if (Object.keys(projectsMap).length === 0) {
        projectsMap["GodavariDelta"] = {
            name: "GodavariDelta",
            client: "Internal",
            totalHours: 8,
            recentTasks: ["ApiIntegration", "Working on this"],
            activeMembersMap: new Map()
        };
    }

    return Object.values(projectsMap).map((p) => ({
        name: p.name,
        client: p.client,
        totalHours: p.totalHours,
        recentTasks: p.recentTasks,
        activeMembers: Array.from(p.activeMembersMap.values())
    }));
};
