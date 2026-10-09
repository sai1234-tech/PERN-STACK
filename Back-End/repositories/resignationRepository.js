import pool from "../config/db.js";

export const initResignationTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS resignations (
            id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            resignation_date DATE NOT NULL DEFAULT CURRENT_DATE,
            notice_period_days INTEGER NOT NULL DEFAULT 90,
            requested_last_working_day DATE NOT NULL,
            approved_last_working_day DATE,
            reason_category VARCHAR(50) NOT NULL,
            reason_details TEXT NOT NULL,
            status VARCHAR(30) DEFAULT 'pending',
            hr_review_comment TEXT DEFAULT '',
            manager_review_comment TEXT DEFAULT '',
            manager_reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            reviewed_at TIMESTAMP,
            exit_interview_scheduled BOOLEAN DEFAULT FALSE,
            no_dues_cleared BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_resignations_employee_id ON resignations(employee_id);
        CREATE INDEX IF NOT EXISTS idx_resignations_status ON resignations(status);
    `;
    await pool.query(queryText);
};

export const formatResignation = (row) => {
    if (!row) return null;
    return {
        _id: row.id,
        id: row.id,
        employee: row.employee_code ? {
            _id: row.employee_id,
            id: row.employee_id,
            employeeCode: row.employee_code || "",
            firstName: row.first_name || "",
            lastName: row.last_name || "",
            email: row.email || "",
            profilePhoto: row.profile_photo || "",
            employment: {
                department: row.department || "",
                designation: row.designation || "",
            }
        } : row.employee_id,
        resignationDate: row.resignation_date,
        noticePeriodDays: Number(row.notice_period_days || 90),
        requestedLastWorkingDay: row.requested_last_working_day,
        approvedLastWorkingDay: row.approved_last_working_day || null,
        reasonCategory: row.reason_category,
        reasonDetails: row.reason_details,
        status: row.status,
        hrReviewComment: row.hr_review_comment || "",
        managerReviewComment: row.manager_review_comment || "",
        managerReviewedBy: row.manager_reviewed_by || null,
        reviewedBy: row.reviewed_by_name ? {
            _id: row.reviewed_by,
            id: row.reviewed_by,
            name: row.reviewed_by_name || "",
            email: row.reviewed_by_email || "",
            role: row.reviewed_by_role || "",
        } : row.reviewed_by || null,
        reviewedAt: row.reviewed_at || null,
        exitInterviewScheduled: !!row.exit_interview_scheduled,
        noDuesCleared: !!row.no_dues_cleared,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

export const findActiveResignationByEmployee = async (employeeId, activeStatuses = ["pending", "manager_approved", "under_review", "approved"]) => {
    const queryText = `
        SELECT * FROM resignations
        WHERE employee_id = $1 AND status = ANY($2)
        ORDER BY created_at DESC
        LIMIT 1;
    `;
    const { rows } = await pool.query(queryText, [employeeId, activeStatuses]);
    return rows[0] ? formatResignation(rows[0]) : null;
};

export const createResignationRecord = async (data) => {
    const {
        employeeId,
        resignationDate = new Date(),
        noticePeriodDays = 90,
        requestedLastWorkingDay,
        reasonCategory,
        reasonDetails,
        status = "pending",
        managerReviewComment = ""
    } = data;

    const queryText = `
        INSERT INTO resignations (
            employee_id, resignation_date, notice_period_days, requested_last_working_day,
            reason_category, reason_details, status, manager_review_comment
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
    `;

    const values = [
        employeeId,
        resignationDate,
        noticePeriodDays,
        requestedLastWorkingDay,
        reasonCategory,
        reasonDetails,
        status,
        managerReviewComment
    ];

    const { rows } = await pool.query(queryText, values);
    return formatResignation(rows[0]);
};

export const findResignationByEmployee = async (employeeId) => {
    const queryText = `
        SELECT 
            r.*,
            u.name as reviewed_by_name, u.email as reviewed_by_email, u.role as reviewed_by_role
        FROM resignations r
        LEFT JOIN users u ON r.reviewed_by = u.id
        WHERE r.employee_id = $1
        ORDER BY r.created_at DESC
        LIMIT 1;
    `;
    const { rows } = await pool.query(queryText, [employeeId]);
    return rows[0] ? formatResignation(rows[0]) : null;
};

export const findResignationById = async (id) => {
    const queryText = `
        SELECT 
            r.*,
            e.employee_code, e.first_name, e.last_name, e.email, e.profile_photo,
            e.employment->>'department' as department, e.employment->>'designation' as designation,
            u.name as reviewed_by_name, u.email as reviewed_by_email, u.role as reviewed_by_role
        FROM resignations r
        LEFT JOIN employees e ON r.employee_id = e.id
        LEFT JOIN users u ON r.reviewed_by = u.id
        WHERE r.id = $1;
    `;
    const { rows } = await pool.query(queryText, [id]);
    return rows[0] ? formatResignation(rows[0]) : null;
};

export const findAllResignationsAdmin = async (filter = {}, pagination = {}) => {
    let queryText = `
        SELECT 
            r.*,
            e.employee_code, e.first_name, e.last_name, e.email, e.profile_photo,
            e.employment->>'department' as department, e.employment->>'designation' as designation,
            u.name as reviewed_by_name, u.email as reviewed_by_email, u.role as reviewed_by_role
        FROM resignations r
        LEFT JOIN employees e ON r.employee_id = e.id
        LEFT JOIN users u ON r.reviewed_by = u.id
        WHERE 1=1
    `;
    const values = [];
    let paramIndex = 1;

    if (filter.status) {
        queryText += ` AND r.status = $${paramIndex}`;
        values.push(filter.status);
        paramIndex++;
    }

    const countQuery = `SELECT COUNT(*)::INTEGER as count FROM (` + queryText + `) sub;`;
    const { rows: countRows } = await pool.query(countQuery, values);
    const total = countRows[0].count;

    queryText += ` ORDER BY r.created_at DESC`;

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
        resignations: rows.map(formatResignation),
        total
    };
};

export const updateResignationRecord = async (id, fields) => {
    const fieldMapping = {
        status: "status",
        approvedLastWorkingDay: "approved_last_working_day",
        hrReviewComment: "hr_review_comment",
        managerReviewComment: "manager_review_comment",
        managerReviewedBy: "manager_reviewed_by",
        reviewedBy: "reviewed_by",
        reviewedAt: "reviewed_at",
        exitInterviewScheduled: "exit_interview_scheduled",
        noDuesCleared: "no_dues_cleared"
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
        UPDATE resignations
        SET ${setClauses.join(", ")}
        WHERE id = $${values.length}
        RETURNING *;
    `;

    const { rows } = await pool.query(queryText, values);
    return findResignationById(rows[0].id);
};
