import pool from "../config/db.js";

export const initTimesheetTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS timesheets (
            id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            date DATE NOT NULL,
            project VARCHAR(255) DEFAULT '',
            client VARCHAR(255) DEFAULT '',
            cost_center VARCHAR(255) DEFAULT '',
            task VARCHAR(255) NOT NULL,
            description TEXT DEFAULT '',
            start_time TIMESTAMP,
            end_time TIMESTAMP,
            break_minutes INTEGER DEFAULT 0,
            entry_mode VARCHAR(20) DEFAULT 'manual',
            billable BOOLEAN DEFAULT TRUE,
            hours NUMERIC(5, 2) NOT NULL,
            status VARCHAR(20) DEFAULT 'draft',
            submitted_at TIMESTAMP,
            reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            reviewed_at TIMESTAMP,
            review_comment TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_timesheets_employee_date ON timesheets(employee_id, date);
        CREATE INDEX IF NOT EXISTS idx_timesheets_status_date ON timesheets(status, date);

        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS project VARCHAR(255) DEFAULT '';
        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS client VARCHAR(255) DEFAULT '';
        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS cost_center VARCHAR(255) DEFAULT '';
        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS task VARCHAR(255) DEFAULT '';
        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS start_time TIMESTAMP;
        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS end_time TIMESTAMP;
        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS break_minutes INTEGER DEFAULT 0;
        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS entry_mode VARCHAR(20) DEFAULT 'manual';
        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS billable BOOLEAN DEFAULT TRUE;
        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS hours NUMERIC(5, 2) DEFAULT 0;
        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';
        ALTER TABLE timesheets ALTER COLUMN status TYPE VARCHAR(50);
        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;
        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS reviewed_by INTEGER;
        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS review_comment TEXT DEFAULT '';
        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS manager_approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMP;
        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS manager_remarks TEXT DEFAULT '';
        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS hr_approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS hr_approved_at TIMESTAMP;
        ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS hr_remarks TEXT DEFAULT '';
    `;
    await pool.query(queryText);
};

export const formatTimesheet = (row) => {
    if (!row) return null;
    let reviewerName = null;
    if (row.reviewer_first_name || row.reviewer_last_name) {
        const full = `${row.reviewer_first_name || ''} ${row.reviewer_last_name || ''}`.trim();
        const desig = row.reviewer_designation ? ` (${row.reviewer_designation})` : '';
        reviewerName = `${full}${desig}`;
    } else if (row.reviewer_name) {
        reviewerName = row.reviewer_name;
    } else if (row.reviewer_user_name) {
        reviewerName = row.reviewer_user_name;
    } else if (row.reviewed_by) {
        reviewerName = `Reviewer #${row.reviewed_by}`;
    }

    let managerApproverName = null;
    if (row.manager_first_name || row.manager_last_name) {
        managerApproverName = `${row.manager_first_name || ''} ${row.manager_last_name || ''}`.trim();
    } else if (row.manager_user_name) {
        managerApproverName = row.manager_user_name;
    }

    let hrApproverName = null;
    if (row.hr_first_name || row.hr_last_name) {
        hrApproverName = `${row.hr_first_name || ''} ${row.hr_last_name || ''}`.trim();
    } else if (row.hr_user_name) {
        hrApproverName = row.hr_user_name;
    }

    return {
        _id: row.id,
        id: row.id,
        employee: row.employee_id,
        date: row.date,
        project: row.project || "",
        client: row.client || "",
        costCenter: row.cost_center || "",
        task: row.task || "",
        description: row.description || "",
        startTime: row.start_time || null,
        endTime: row.end_time || null,
        breakMinutes: Number(row.break_minutes || 0),
        entryMode: row.entry_mode || "manual",
        billable: row.billable !== false,
        hours: Number(row.hours || 0),
        status: row.status || "draft",
        submittedAt: row.submitted_at || null,
        reviewedBy: row.reviewed_by || null,
        reviewedAt: row.reviewed_at || null,
        reviewComment: row.review_comment || "",
        rejectionReason: row.review_comment || "",
        reviewer: reviewerName,
        managerApprovedBy: row.manager_approved_by || null,
        managerApprovedAt: row.manager_approved_at || null,
        managerRemarks: row.manager_remarks || "",
        managerApproverName,
        hrApprovedBy: row.hr_approved_by || null,
        hrApprovedAt: row.hr_approved_at || null,
        hrRemarks: row.hr_remarks || "",
        hrApproverName,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

export const createTimesheetRecord = async (data) => {
    const {
        employeeId,
        date,
        project = "",
        client = "",
        costCenter = "",
        task,
        description = "",
        startTime = null,
        endTime = null,
        breakMinutes = 0,
        entryMode = "manual",
        billable = true,
        hours,
        status = "draft"
    } = data;

    const queryText = `
        INSERT INTO timesheets (
            employee_id, date, project, client, cost_center, task, description,
            start_time, end_time, break_minutes, entry_mode, billable, hours, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *;
    `;

    const values = [
        employeeId,
        date,
        project,
        client,
        costCenter,
        task,
        description,
        startTime,
        endTime,
        breakMinutes,
        entryMode,
        billable,
        hours,
        status
    ];

    const { rows } = await pool.query(queryText, values);
    return formatTimesheet(rows[0]);
};

export const bulkCreateTimesheetRecords = async (documents) => {
    const inserted = [];
    for (const doc of documents) {
        const item = await createTimesheetRecord(doc);
        inserted.push(item);
    }
    return inserted;
};

export const findTimesheetsByEmployee = async (employeeId, filter = {}, pagination = {}) => {
    let queryText = `SELECT * FROM timesheets WHERE employee_id = $1`;
    const values = [employeeId];
    let paramIndex = 2;

    if (filter.status) {
        queryText += ` AND status = $${paramIndex}`;
        values.push(filter.status);
        paramIndex++;
    }

    if (filter.fromDate) {
        queryText += ` AND date >= $${paramIndex}`;
        values.push(filter.fromDate);
        paramIndex++;
    }

    if (filter.toDate) {
        queryText += ` AND date <= $${paramIndex}`;
        values.push(filter.toDate);
        paramIndex++;
    }

    // Count query
    const countQuery = queryText.replace("SELECT *", "SELECT COUNT(*)::INTEGER as count");
    const { rows: countRows } = await pool.query(countQuery, values);
    const total = countRows[0].count;

    queryText += ` ORDER BY date DESC, created_at DESC`;

    if (pagination.limit) {
        queryText += ` LIMIT $${paramIndex}`;
        values.push(pagination.limit);
        paramIndex++;
    }

    if (pagination.skip) {
        queryText += ` OFFSET $${paramIndex}`;
        values.push(pagination.skip);
        paramIndex++;
    }

    const { rows } = await pool.query(queryText, values);
    return {
        timesheets: rows.map(formatTimesheet),
        total
    };
};

export const findTimesheetsInDateRange = async (employeeId, startDate, endDate) => {
    const queryText = `
        SELECT t.*,
               u.name AS reviewer_user_name,
               m.first_name AS reviewer_first_name,
               m.last_name AS reviewer_last_name,
               m.designation AS reviewer_designation,
               mu.name AS manager_user_name,
               me.first_name AS manager_first_name,
               me.last_name AS manager_last_name,
               hu.name AS hr_user_name,
               he.first_name AS hr_first_name,
               he.last_name AS hr_last_name
        FROM timesheets t
        LEFT JOIN users u ON t.reviewed_by = u.id
        LEFT JOIN employees m ON u.id = m.user_id
        LEFT JOIN users mu ON t.manager_approved_by = mu.id
        LEFT JOIN employees me ON mu.id = me.user_id
        LEFT JOIN users hu ON t.hr_approved_by = hu.id
        LEFT JOIN employees he ON hu.id = he.user_id
        WHERE t.employee_id = $1 AND t.date >= $2 AND t.date <= $3
        ORDER BY t.date ASC, t.created_at ASC;
    `;
    const { rows } = await pool.query(queryText, [employeeId, startDate, endDate]);
    return rows.map(formatTimesheet);
};

export const findTimesheetsByDate = async (employeeId, date) => {
    const queryText = `
        SELECT t.*,
               u.name AS reviewer_user_name,
               m.first_name AS reviewer_first_name,
               m.last_name AS reviewer_last_name,
               m.designation AS reviewer_designation
        FROM timesheets t
        LEFT JOIN users u ON t.reviewed_by = u.id
        LEFT JOIN employees m ON u.id = m.user_id
        WHERE t.employee_id = $1 AND t.date = $2;
    `;
    const { rows } = await pool.query(queryText, [employeeId, date]);
    return rows.map(formatTimesheet);
};

export const findExactDuplicateTimesheet = async ({ employeeId, date, project, client, costCenter, task, startTime, endTime, hours }) => {
    let queryText = `
        SELECT * FROM timesheets
        WHERE employee_id = $1 AND date = $2 AND task = $3
        AND COALESCE(project, '') = $4 AND COALESCE(client, '') = $5 AND COALESCE(cost_center, '') = $6
    `;
    const values = [employeeId, date, task, project || "", client || "", costCenter || ""];
    let paramIndex = 7;

    if (startTime && endTime) {
        queryText += ` AND start_time = $${paramIndex} AND end_time = $${paramIndex + 1}`;
        values.push(startTime, endTime);
    } else {
        queryText += ` AND hours = $${paramIndex}`;
        values.push(hours);
    }

    const { rows } = await pool.query(queryText, values);
    return rows[0] ? formatTimesheet(rows[0]) : null;
};

export const findTimesheetById = async (id, employeeId = null) => {
    let queryText = `
        SELECT t.*,
               u.name AS reviewer_user_name,
               m.first_name AS reviewer_first_name,
               m.last_name AS reviewer_last_name,
               m.designation AS reviewer_designation,
               mu.name AS manager_user_name,
               me.first_name AS manager_first_name,
               me.last_name AS manager_last_name,
               hu.name AS hr_user_name,
               he.first_name AS hr_first_name,
               he.last_name AS hr_last_name
        FROM timesheets t
        LEFT JOIN users u ON t.reviewed_by = u.id
        LEFT JOIN employees m ON u.id = m.user_id
        LEFT JOIN users mu ON t.manager_approved_by = mu.id
        LEFT JOIN employees me ON mu.id = me.user_id
        LEFT JOIN users hu ON t.hr_approved_by = hu.id
        LEFT JOIN employees he ON hu.id = he.user_id
        WHERE t.id = $1
    `;
    const values = [id];
    if (employeeId) {
        queryText += ` AND t.employee_id = $2`;
        values.push(employeeId);
    }
    const { rows } = await pool.query(queryText, values);
    return rows[0] ? formatTimesheet(rows[0]) : null;
};

export const updateTimesheetRecord = async (id, fields) => {
    const fieldMapping = {
        employee: "employee_id",
        date: "date",
        project: "project",
        client: "client",
        costCenter: "cost_center",
        task: "task",
        description: "description",
        startTime: "start_time",
        endTime: "end_time",
        breakMinutes: "break_minutes",
        entryMode: "entry_mode",
        billable: "billable",
        hours: "hours",
        status: "status",
        submittedAt: "submitted_at",
        reviewedBy: "reviewed_by",
        reviewedAt: "reviewed_at",
        reviewComment: "review_comment",
        managerApprovedBy: "manager_approved_by",
        managerApprovedAt: "manager_approved_at",
        managerRemarks: "manager_remarks",
        hrApprovedBy: "hr_approved_by",
        hrApprovedAt: "hr_approved_at",
        hrRemarks: "hr_remarks"
    };

    const keys = Object.keys(fields);
    if (keys.length === 0) return null;

    const setClauses = [];
    const values = [];

    keys.forEach((key, index) => {
        const colName = fieldMapping[key] || key;
        setClauses.push(`${colName} = $${index + 1}`);
        values.push(fields[key]);
    });

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const queryText = `
        UPDATE timesheets
        SET ${setClauses.join(", ")}
        WHERE id = $${values.length}
        RETURNING *;
    `;

    const { rows } = await pool.query(queryText, values);
    return rows[0] ? formatTimesheet(rows[0]) : null;
};

export const deleteTimesheetRecord = async (id, employeeId) => {
    const queryText = `DELETE FROM timesheets WHERE id = $1 AND employee_id = $2 RETURNING *;`;
    const { rows } = await pool.query(queryText, [id, employeeId]);
    return rows[0] ? formatTimesheet(rows[0]) : null;
};

export const submitWeekTimesheets = async (employeeId, startDate, endDate) => {
    const queryText = `
        UPDATE timesheets
        SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP, reviewed_by = NULL, reviewed_at = NULL, review_comment = ''
        WHERE employee_id = $1 AND date >= $2 AND date <= $3 AND status IN ('draft', 'rejected')
        RETURNING *;
    `;
    const { rows } = await pool.query(queryText, [employeeId, startDate, endDate]);
    return rows.map(formatTimesheet);
};

export const findAllTimesheetsAdmin = async (filter = {}, pagination = {}) => {
    let queryText = `
        SELECT 
            t.*,
            e.employee_code, e.first_name, e.last_name, e.email as employee_email,
            e.employment->>'department' as department, e.employment->>'designation' as designation,
            u.name as reviewer_name, u.email as reviewer_email, u.role as reviewer_role,
            mu.name as manager_user_name, me.first_name as manager_first_name, me.last_name as manager_last_name,
            hu.name as hr_user_name, he.first_name as hr_first_name, he.last_name as hr_last_name
        FROM timesheets t
        LEFT JOIN employees e ON t.employee_id = e.id
        LEFT JOIN users u ON t.reviewed_by = u.id
        LEFT JOIN users mu ON t.manager_approved_by = mu.id
        LEFT JOIN employees me ON mu.id = me.user_id
        LEFT JOIN users hu ON t.hr_approved_by = hu.id
        LEFT JOIN employees he ON hu.id = he.user_id
        WHERE 1=1
    `;
    const values = [];
    let paramIndex = 1;

    if (filter.status) {
        queryText += ` AND t.status = $${paramIndex}`;
        values.push(filter.status);
        paramIndex++;
    }

    if (filter.employeeId) {
        queryText += ` AND t.employee_id = $${paramIndex}`;
        values.push(filter.employeeId);
        paramIndex++;
    }

    if (filter.teamIds && Array.isArray(filter.teamIds) && filter.teamIds.length > 0) {
        queryText += ` AND t.employee_id = ANY($${paramIndex}::int[])`;
        values.push(filter.teamIds);
        paramIndex++;
    }

    if (filter.fromDate) {
        queryText += ` AND t.date >= $${paramIndex}`;
        values.push(filter.fromDate);
        paramIndex++;
    }

    if (filter.toDate) {
        queryText += ` AND t.date <= $${paramIndex}`;
        values.push(filter.toDate);
        paramIndex++;
    }

    const countQuery = `SELECT COUNT(*)::INTEGER as count FROM (` + queryText + `) sub;`;
    const { rows: countRows } = await pool.query(countQuery, values);
    const total = countRows[0].count;

    queryText += ` ORDER BY t.date DESC, t.created_at DESC`;

    if (pagination.limit) {
        queryText += ` LIMIT $${paramIndex}`;
        values.push(pagination.limit);
        paramIndex++;
    }

    if (pagination.skip) {
        queryText += ` OFFSET $${paramIndex}`;
        values.push(pagination.skip);
        paramIndex++;
    }

    const { rows } = await pool.query(queryText, values);

    const timesheets = rows.map((r) => {
        const formatted = formatTimesheet(r);
        formatted.employee = {
            _id: r.employee_id,
            id: r.employee_id,
            employeeCode: r.employee_code || "",
            firstName: r.first_name || "",
            lastName: r.last_name || "",
            email: r.employee_email || "",
            employment: {
                department: r.department || "",
                designation: r.designation || "",
            },
        };
        formatted.reviewedBy = r.reviewed_by ? {
            _id: r.reviewed_by,
            id: r.reviewed_by,
            name: r.reviewer_name || "",
            email: r.reviewer_email || "",
            role: r.reviewer_role || "",
        } : null;
        return formatted;
    });

    return { timesheets, total };
};
