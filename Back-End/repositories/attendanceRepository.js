import pool from "../config/db.js";

export const initAttendanceTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS attendance (
            id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            date DATE NOT NULL,
            check_in TIMESTAMP,
            check_out TIMESTAMP,
            working_hours NUMERIC(5, 2) DEFAULT 0,
            status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'half-day')),
            is_late BOOLEAN DEFAULT FALSE,
            late_minutes INTEGER DEFAULT 0,
            overtime_hours NUMERIC(5, 2) DEFAULT 0,
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_employee_date UNIQUE (employee_id, date)
        );
    `;
    await pool.query(queryText);
};

export const findAttendanceByEmployeeAndDate = async (employeeId, date) => {
    const queryText = `
        SELECT * FROM attendance 
        WHERE employee_id = $1 AND date = $2;
    `;
    const { rows } = await pool.query(queryText, [employeeId, date]);
    return rows[0];
};

export const findAttendanceById = async (id) => {
    const queryText = `
        SELECT a.*, u.name as employee_name, u.email as employee_email, u.role as employee_role
        FROM attendance a
        JOIN users u ON a.employee_id = u.id
        WHERE a.id = $1;
    `;
    const { rows } = await pool.query(queryText, [id]);
    return rows[0];
};

export const createAttendanceRecord = async ({
    employeeId,
    date,
    checkIn,
    status = "present",
    isLate = false,
    lateMinutes = 0,
    remarks = ""
}) => {
    const queryText = `
        INSERT INTO attendance (
            employee_id, date, check_in, check_out, working_hours, 
            status, is_late, late_minutes, overtime_hours, remarks
        )
        VALUES ($1, $2, $3, NULL, 0, $4, $5, $6, 0, $7)
        RETURNING *;
    `;
    const values = [employeeId, date, checkIn, status, isLate, lateMinutes, remarks];
    const { rows } = await pool.query(queryText, values);
    return rows[0];
};

export const updateAttendanceRecord = async (id, fields) => {
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
        UPDATE attendance 
        SET ${setClauses.join(", ")}
        WHERE id = $${values.length}
        RETURNING *;
    `;

    const { rows } = await pool.query(queryText, values);
    return rows[0];
};

export const autoCloseUnclosedPastRecords = async (employeeId, todayDate) => {
    const selectQuery = `
        SELECT * FROM attendance
        WHERE employee_id = $1 AND date < $2 AND check_out IS NULL;
    `;
    const { rows: unclosedRecords } = await pool.query(selectQuery, [employeeId, todayDate]);

    for (const record of unclosedRecords) {
        const checkInTime = new Date(record.check_in || record.date);
        const defaultCheckOut = new Date(record.date);
        defaultCheckOut.setHours(18, 30, 0, 0);

        const computedCheckOut = checkInTime > defaultCheckOut
            ? new Date(checkInTime.getTime() + 8 * 60 * 60 * 1000)
            : defaultCheckOut;

        const diffHours = Math.max(0, (computedCheckOut.getTime() - checkInTime.getTime()) / (1000 * 60 * 60));
        const workingHours = Number(diffHours.toFixed(2)) || 8.0;
        const overtimeHours = workingHours > 8 ? Number((workingHours - 8).toFixed(2)) : 0;
        const status = record.status === "absent" ? "absent" : "present";

        await updateAttendanceRecord(record.id, {
            check_out: computedCheckOut,
            working_hours: workingHours,
            overtime_hours: overtimeHours,
            status,
            remarks: "Auto-closed past unclosed shift"
        });
    }
};

export const findAttendanceHistoryByEmployee = async (employeeId) => {
    const queryText = `
        SELECT * FROM attendance 
        WHERE employee_id = $1 
        ORDER BY date DESC;
    `;
    const { rows } = await pool.query(queryText, [employeeId]);
    return rows;
};

export const findAllAttendanceRecords = async () => {
    const queryText = `
        SELECT 
            a.*, 
            COALESCE(u.id, e.user_id) as user_id, 
            COALESCE(u.name, TRIM(CONCAT(e.first_name, ' ', e.last_name))) as employee_name, 
            COALESCE(u.email, e.email) as employee_email, 
            COALESCE(u.role, 'employee') as employee_role,
            e.employee_code,
            e.first_name,
            e.last_name,
            e.profile_photo,
            e.employment->>'department' as department,
            e.employment->>'designation' as designation
        FROM attendance a
        LEFT JOIN users u ON a.employee_id = u.id
        LEFT JOIN employees e ON (e.user_id = u.id OR (u.id IS NULL AND a.employee_id = e.id))
        ORDER BY a.date DESC, a.check_in DESC;
    `;
    const { rows } = await pool.query(queryText);
    return rows;
};

export const findMonthlyAttendanceReport = async (startDate, endDate) => {
    const queryText = `
        SELECT 
            a.*, 
            COALESCE(u.id, e.user_id) as user_id, 
            COALESCE(u.name, TRIM(CONCAT(e.first_name, ' ', e.last_name))) as employee_name, 
            COALESCE(u.email, e.email) as employee_email, 
            COALESCE(u.role, 'employee') as employee_role,
            e.employee_code,
            e.first_name,
            e.last_name,
            e.profile_photo,
            e.employment->>'department' as department,
            e.employment->>'designation' as designation
        FROM attendance a
        LEFT JOIN users u ON a.employee_id = u.id
        LEFT JOIN employees e ON (e.user_id = u.id OR (u.id IS NULL AND a.employee_id = e.id))
        WHERE a.date >= $1 AND a.date <= $2
        ORDER BY a.date ASC;
    `;
    const { rows } = await pool.query(queryText, [startDate, endDate]);
    return rows;
};

export const getEmployeeAttendanceSummary = async (employeeId) => {
    const queryText = `
        SELECT 
            COUNT(*)::INTEGER as "totalDays",
            COUNT(*) FILTER (WHERE status = 'present')::INTEGER as "presentDays",
            COUNT(*) FILTER (WHERE status = 'absent')::INTEGER as "absentDays",
            COUNT(*) FILTER (WHERE status = 'late')::INTEGER as "lateDays",
            COUNT(*) FILTER (WHERE status = 'half-day')::INTEGER as "halfDays",
            COALESCE(ROUND(SUM(working_hours), 2), 0)::FLOAT as "totalWorkingHours",
            COALESCE(ROUND(SUM(overtime_hours), 2), 0)::FLOAT as "totalOvertimeHours",
            COALESCE(SUM(late_minutes), 0)::INTEGER as "totalLateMinutes"
        FROM attendance
        WHERE employee_id = $1;
    `;
    const { rows } = await pool.query(queryText, [employeeId]);
    return rows[0];
};

export const getMonthlyAttendanceSummary = async (startDate, endDate) => {
    const queryText = `
        SELECT 
            u.id as "employee_id",
            u.name as "employee_name",
            u.email as "employee_email",
            u.role as "employee_role",
            COUNT(a.id)::INTEGER as "totalDays",
            COUNT(a.id) FILTER (WHERE a.status = 'present')::INTEGER as "presentDays",
            COUNT(a.id) FILTER (WHERE a.status = 'absent')::INTEGER as "absentDays",
            COUNT(a.id) FILTER (WHERE a.status = 'late')::INTEGER as "lateDays",
            COUNT(a.id) FILTER (WHERE a.status = 'half-day')::INTEGER as "halfDays",
            COALESCE(ROUND(SUM(a.working_hours), 2), 0)::FLOAT as "totalWorkingHours",
            COALESCE(ROUND(SUM(a.overtime_hours), 2), 0)::FLOAT as "totalOvertimeHours",
            COALESCE(SUM(a.late_minutes), 0)::INTEGER as "totalLateMinutes"
        FROM users u
        LEFT JOIN attendance a ON u.id = a.employee_id AND a.date >= $1 AND a.date <= $2
        GROUP BY u.id, u.name, u.email, u.role
        ORDER BY u.id ASC;
    `;
    const { rows } = await pool.query(queryText, [startDate, endDate]);
    return rows;
};

export const autoCloseMissingClockoutsPolicy = async (todayDate) => {
    const selectQuery = `
        SELECT * FROM attendance
        WHERE date < $1 AND check_in IS NOT NULL AND check_out IS NULL;
    `;
    const { rows: unclosedRecords } = await pool.query(selectQuery, [todayDate]);

    let closedCount = 0;
    for (const record of unclosedRecords) {
        const autoCheckOut = new Date(record.date);
        autoCheckOut.setHours(18, 30, 0, 0);

        const checkInTime = new Date(record.check_in);
        const diffHours = Math.max(0, (autoCheckOut.getTime() - checkInTime.getTime()) / (1000 * 60 * 60));
        const workingHours = Number(diffHours.toFixed(2)) || 8.0;

        await updateAttendanceRecord(record.id, {
            check_out: autoCheckOut,
            working_hours: workingHours,
            remarks: "Auto-closed by System EOD Shift Policy (06:30 PM IST)"
        });
        closedCount++;
    }

    return closedCount;
};
