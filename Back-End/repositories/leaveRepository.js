import pool from "../config/db.js";

// Initialize leave_types and leaves tables in PostgreSQL
export const initLeaveTables = async () => {
    const leaveTypesQuery = `
        CREATE TABLE IF NOT EXISTS leave_types (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) UNIQUE NOT NULL,
            code VARCHAR(50) UNIQUE NOT NULL,
            annual_allocation NUMERIC(5, 2) NOT NULL DEFAULT 12,
            is_paid BOOLEAN DEFAULT TRUE,
            is_active BOOLEAN DEFAULT TRUE,
            description TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;
    await pool.query(leaveTypesQuery);

    const leavesQuery = `
        CREATE TABLE IF NOT EXISTS leaves (
            id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            leave_type_id INTEGER NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            number_of_days NUMERIC(5, 2) NOT NULL,
            reason TEXT NOT NULL,
            status VARCHAR(50) DEFAULT 'Pending Manager' CHECK (status IN ('Pending', 'Pending Manager', 'Pending HR', 'Approved', 'Rejected', 'Cancelled')),
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            manager_approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            manager_approved_at TIMESTAMP,
            manager_remarks TEXT DEFAULT '',
            hr_approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            hr_approved_at TIMESTAMP,
            hr_remarks TEXT DEFAULT '',
            approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            approved_at TIMESTAMP,
            rejection_reason TEXT DEFAULT '',
            cancelled_at TIMESTAMP,
            cancelled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            document TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;
    await pool.query(leavesQuery);

    // Seed default leave types if table is empty
    const { rows } = await pool.query(`SELECT COUNT(*)::INTEGER as count FROM leave_types;`);
    if (rows[0].count === 0) {
        const seedQuery = `
            INSERT INTO leave_types (name, code, annual_allocation, is_paid, is_active, description)
            VALUES 
                ('Casual Leave', 'CL', 12, true, true, 'Standard casual leave'),
                ('Sick Leave', 'SL', 12, true, true, 'Medical & sick leave'),
                ('Earned Leave', 'EL', 15, true, true, 'Privilege / earned leave'),
                ('Paid Privilege Leave', 'PL', 18, true, true, 'Paid privilege leave'),
                ('Work From Home', 'WFH', 48, true, true, 'Remote work allowance'),
                ('Optional Holiday', 'OH', 3, true, true, 'Restricted or optional holiday')
            ON CONFLICT DO NOTHING;
        `;
        await pool.query(seedQuery);
    }
};

// ==========================================
// LEAVE TYPE REPOSITORY METHODS
// ==========================================
export const createLeaveTypeRecord = async (data) => {
    const { name, code, annualAllocation, isPaid = true, description = "", isActive = true } = data;
    const queryText = `
        INSERT INTO leave_types (name, code, annual_allocation, is_paid, is_active, description)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
    `;
    const { rows } = await pool.query(queryText, [
        name.trim(),
        code.trim().toUpperCase(),
        annualAllocation,
        isPaid,
        isActive,
        description.trim()
    ]);
    return rows[0];
};

export const findLeaveTypeById = async (id) => {
    const queryText = `SELECT * FROM leave_types WHERE id = $1;`;
    const { rows } = await pool.query(queryText, [id]);
    return rows[0];
};

export const findLeaveTypeByCodeOrName = async (identifier) => {
    const queryText = `
        SELECT * FROM leave_types 
        WHERE (UPPER(code) = UPPER($1) OR LOWER(name) = LOWER($1)) AND is_active = true;
    `;
    const { rows } = await pool.query(queryText, [identifier]);
    return rows[0];
};

export const findAllLeaveTypes = async (onlyActive = true) => {
    let queryText = `SELECT * FROM leave_types`;
    if (onlyActive) queryText += ` WHERE is_active = true`;
    queryText += ` ORDER BY name ASC;`;
    const { rows } = await pool.query(queryText);
    return rows;
};

export const updateLeaveTypeRecord = async (id, fields) => {
    const keys = Object.keys(fields);
    if (keys.length === 0) return null;

    const setClauses = [];
    const values = [];

    keys.forEach((key, index) => {
        setClauses.push(`${key} = $${index + 1}`);
        values.push(fields[key]);
    });

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const queryText = `
        UPDATE leave_types 
        SET ${setClauses.join(", ")}
        WHERE id = $${values.length}
        RETURNING *;
    `;

    const { rows } = await pool.query(queryText, values);
    return rows[0];
};

// ==========================================
// LEAVE REPOSITORY METHODS
// ==========================================
export const createLeaveRecord = async (data) => {
    const {
        employeeId,
        leaveTypeId,
        startDate,
        endDate,
        numberOfDays,
        reason,
        document = "",
        status = "Pending Manager"
    } = data;

    const queryText = `
        INSERT INTO leaves (
            employee_id, leave_type_id, start_date, end_date, 
            number_of_days, reason, document, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
    `;

    const values = [
        employeeId,
        leaveTypeId,
        startDate,
        endDate,
        numberOfDays,
        reason.trim(),
        document,
        status
    ];

    const { rows } = await pool.query(queryText, values);
    return rows[0];
};

export const findLeaveById = async (id) => {
    const queryText = `
        SELECT 
            l.*,
            e.employee_code, e.first_name AS employee_first_name, e.last_name AS employee_last_name, e.email AS employee_email,
            e.reports_to,
            rep_mgr.first_name AS reporting_manager_first_name, rep_mgr.last_name AS reporting_manager_last_name, rep_mgr.email AS reporting_manager_email,
            e.hr_id,
            COALESCE(hr_emp.first_name, e.employment->>'hrPartnerName', 'Lakshmi') AS assigned_hr_first_name,
            COALESCE(hr_emp.last_name, '') AS assigned_hr_last_name,
            COALESCE(hr_emp.email, e.employment->>'hrPartnerEmail', 'lragula@quadratics.com') AS assigned_hr_email,
            lt.name AS leave_type_name, lt.code AS leave_type_code, lt.annual_allocation, lt.is_paid,
            u.name AS approved_by_name, u.email AS approved_by_email, u.role AS approved_by_role,
            mu.name AS manager_approved_by_name, mu.email AS manager_approved_by_email,
            hu.name AS hr_approved_by_name, hu.email AS hr_approved_by_email
        FROM leaves l
        JOIN employees e ON l.employee_id = e.id
        LEFT JOIN employees rep_mgr ON e.reports_to = rep_mgr.id
        LEFT JOIN employees hr_emp ON e.hr_id = hr_emp.id
        JOIN leave_types lt ON l.leave_type_id = lt.id
        LEFT JOIN users u ON l.approved_by = u.id
        LEFT JOIN users mu ON l.manager_approved_by = mu.id
        LEFT JOIN users hu ON l.hr_approved_by = hu.id
        WHERE l.id = $1;
    `;
    const { rows } = await pool.query(queryText, [id]);
    return rows[0];
};

export const findOverlappingLeave = async (employeeId, startDate, endDate, excludeLeaveId = null) => {
    let queryText = `
        SELECT * FROM leaves
        WHERE employee_id = $1 
          AND status IN ('Pending', 'Approved', 'Pending Manager', 'Pending HR')
          AND start_date <= $3
          AND end_date >= $2
    `;
    const values = [employeeId, startDate, endDate];

    if (excludeLeaveId) {
        queryText += ` AND id != $4`;
        values.push(excludeLeaveId);
    }

    const { rows } = await pool.query(queryText, values);
    return rows[0];
};

export const findEmployeeLeavesForYear = async (employeeId, year, leaveTypeId = null) => {
    const startDate = `${year}-01-01`;
    const endDate = `${year + 1}-01-01`;

    let queryText = `
        SELECT l.*, lt.name as leave_type_name, lt.code as leave_type_code, lt.annual_allocation
        FROM leaves l
        JOIN leave_types lt ON l.leave_type_id = lt.id
        WHERE l.employee_id = $1
          AND l.status IN ('Approved', 'Pending', 'Pending Manager', 'Pending HR')
          AND l.start_date >= $2 AND l.start_date < $3
    `;
    const values = [employeeId, startDate, endDate];

    if (leaveTypeId) {
        queryText += ` AND l.leave_type_id = $4`;
        values.push(leaveTypeId);
    }

    const { rows } = await pool.query(queryText, values);
    return rows;
};

export const findLeavesByEmployee = async (employeeId) => {
    const queryText = `
        SELECT 
            l.*,
            e.employee_code, e.first_name AS employee_first_name, e.last_name AS employee_last_name, e.email AS employee_email,
            e.reports_to,
            rep_mgr.first_name AS reporting_manager_first_name, rep_mgr.last_name AS reporting_manager_last_name, rep_mgr.email AS reporting_manager_email,
            e.hr_id,
            COALESCE(hr_emp.first_name, e.employment->>'hrPartnerName', 'Lakshmi') AS assigned_hr_first_name,
            COALESCE(hr_emp.last_name, '') AS assigned_hr_last_name,
            COALESCE(hr_emp.email, e.employment->>'hrPartnerEmail', 'lragula@quadratics.com') AS assigned_hr_email,
            lt.name AS leave_type_name, lt.code AS leave_type_code, lt.annual_allocation, lt.is_paid,
            u.name AS approved_by_name, u.email AS approved_by_email, u.role AS approved_by_role,
            mu.name AS manager_approved_by_name, mu.email AS manager_approved_by_email,
            hu.name AS hr_approved_by_name, hu.email AS hr_approved_by_email
        FROM leaves l
        JOIN employees e ON l.employee_id = e.id
        LEFT JOIN employees rep_mgr ON e.reports_to = rep_mgr.id
        LEFT JOIN employees hr_emp ON e.hr_id = hr_emp.id
        JOIN leave_types lt ON l.leave_type_id = lt.id
        LEFT JOIN users u ON l.approved_by = u.id
        LEFT JOIN users mu ON l.manager_approved_by = mu.id
        LEFT JOIN users hu ON l.hr_approved_by = hu.id
        WHERE l.employee_id = $1
        ORDER BY l.created_at DESC;
    `;
    const { rows } = await pool.query(queryText, [employeeId]);
    return rows;
};

export const findAllLeaves = async (filters = {}) => {
    const { status, employeeId, leaveTypeId, startDate, endDate, reportingManagerId } = filters;
    let queryText = `
        SELECT 
            l.*,
            e.employee_code, e.first_name AS employee_first_name, e.last_name AS employee_last_name, e.email AS employee_email,
            e.reports_to,
            rep_mgr.first_name AS reporting_manager_first_name, rep_mgr.last_name AS reporting_manager_last_name, rep_mgr.email AS reporting_manager_email,
            e.hr_id,
            COALESCE(hr_emp.first_name, e.employment->>'hrPartnerName', 'Lakshmi') AS assigned_hr_first_name,
            COALESCE(hr_emp.last_name, '') AS assigned_hr_last_name,
            COALESCE(hr_emp.email, e.employment->>'hrPartnerEmail', 'lragula@quadratics.com') AS assigned_hr_email,
            lt.name AS leave_type_name, lt.code AS leave_type_code, lt.annual_allocation, lt.is_paid,
            u.name AS approved_by_name, u.email AS approved_by_email, u.role AS approved_by_role,
            mu.name AS manager_approved_by_name, mu.email AS manager_approved_by_email,
            hu.name AS hr_approved_by_name, hu.email AS hr_approved_by_email
        FROM leaves l
        JOIN employees e ON l.employee_id = e.id
        LEFT JOIN employees rep_mgr ON e.reports_to = rep_mgr.id
        LEFT JOIN employees hr_emp ON e.hr_id = hr_emp.id
        JOIN leave_types lt ON l.leave_type_id = lt.id
        LEFT JOIN users u ON l.approved_by = u.id
        LEFT JOIN users mu ON l.manager_approved_by = mu.id
        LEFT JOIN users hu ON l.hr_approved_by = hu.id
        WHERE 1=1
    `;
    const values = [];

    if (status) {
        values.push(status);
        queryText += ` AND LOWER(l.status) = LOWER($${values.length})`;
    }

    if (employeeId) {
        values.push(employeeId);
        queryText += ` AND l.employee_id = $${values.length}`;
    }

    if (reportingManagerId) {
        values.push(reportingManagerId);
        queryText += ` AND e.reports_to = $${values.length}`;
    }

    if (leaveTypeId) {
        values.push(leaveTypeId);
        queryText += ` AND l.leave_type_id = $${values.length}`;
    }

    if (startDate) {
        values.push(startDate);
        queryText += ` AND l.start_date >= $${values.length}`;
    }

    if (endDate) {
        values.push(endDate);
        queryText += ` AND l.start_date <= $${values.length}`;
    }

    queryText += ` ORDER BY l.created_at DESC;`;
    const { rows } = await pool.query(queryText, values);
    return rows;
};

export const updateLeaveRecord = async (id, fields) => {
    const keys = Object.keys(fields);
    if (keys.length === 0) return null;

    const setClauses = [];
    const values = [];

    keys.forEach((key, index) => {
        setClauses.push(`${key} = $${index + 1}`);
        values.push(fields[key]);
    });

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const queryText = `
        UPDATE leaves 
        SET ${setClauses.join(", ")}
        WHERE id = $${values.length}
        RETURNING *;
    `;

    const { rows } = await pool.query(queryText, values);
    return rows[0];
};
