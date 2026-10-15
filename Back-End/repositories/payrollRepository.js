import pool from "../config/db.js";

export const initPayrollTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS payrolls (
            id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            month DATE NOT NULL,
            basic_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
            allowances NUMERIC(12, 2) DEFAULT 0,
            bonus NUMERIC(12, 2) DEFAULT 0,
            tax NUMERIC(12, 2) DEFAULT 0,
            pf NUMERIC(12, 2) DEFAULT 0,
            deduction NUMERIC(12, 2) DEFAULT 0,
            gross_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
            total_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
            net_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
            status VARCHAR(20) DEFAULT 'generated',
            generated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_employee_month UNIQUE (employee_id, month)
        );

        CREATE INDEX IF NOT EXISTS idx_payrolls_employee_month ON payrolls(employee_id, month);

        ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS basic_salary NUMERIC(12, 2) DEFAULT 0;
        ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS allowances NUMERIC(12, 2) DEFAULT 0;
        ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS bonus NUMERIC(12, 2) DEFAULT 0;
        ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS tax NUMERIC(12, 2) DEFAULT 0;
        ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS pf NUMERIC(12, 2) DEFAULT 0;
        ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS deduction NUMERIC(12, 2) DEFAULT 0;
        ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS gross_salary NUMERIC(12, 2) DEFAULT 0;
        ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS total_deductions NUMERIC(12, 2) DEFAULT 0;
        ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS net_salary NUMERIC(12, 2) DEFAULT 0;
        ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'generated';
    `;
    await pool.query(queryText);
};

export const formatPayrollRecord = (row) => {
    if (!row) return null;

    const basicSalary = Number(row.basic_salary || 0);
    const allowances = Number(row.allowances || 0);
    const bonus = Number(row.bonus || 0);
    const tax = Number(row.tax || 0);
    const pf = Number(row.pf || 0);
    const deduction = Number(row.deduction || 0);
    const grossSalary = Number(row.gross_salary || (basicSalary + allowances + bonus));
    const totalDeductions = Number(row.total_deductions ?? (tax + pf + deduction));
    const netSalary = Number(row.net_salary ?? Math.max(0, grossSalary - totalDeductions));
    const annualSalary = grossSalary * 12;

    const employeeObj = row.employee_code ? {
        _id: row.employee_id,
        id: row.employee_id,
        employeeCode: row.employee_code || "",
        firstName: row.first_name || "",
        lastName: row.last_name || "",
        name: `${row.first_name || ""} ${row.last_name || ""}`.trim(),
        email: row.email || "",
        phone: row.phone || "",
        employment: {
            department: row.department || "Engineering",
            designation: row.designation || "Developer",
            joiningDate: row.joining_date || "",
            employmentType: row.employment_type || "Full Time",
            status: row.employment_status || "Active",
        }
    } : row.employee_id;

    return {
        _id: row.id,
        id: row.id,
        employee: employeeObj,
        month: row.month,
        annualSalary,
        monthlySalary: grossSalary,
        basicSalary,
        allowances,
        bonus,
        tax,
        pf,
        deduction,
        totalDeductions,
        grossSalary,
        netSalary,
        status: row.status,
        generatedBy: row.generated_by,
        generatedAt: row.generated_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

export const findPayrollByEmployeeAndMonth = async (employeeId, month) => {
    const queryText = `
        SELECT 
            p.*,
            e.employee_code, e.first_name, e.last_name, e.email, e.phone,
            e.employment->>'department' as department,
            e.employment->>'designation' as designation,
            e.employment->>'joiningDate' as joining_date,
            e.employment->>'employmentType' as employment_type,
            e.employment->>'status' as employment_status
        FROM payrolls p
        LEFT JOIN employees e ON p.employee_id = e.id
        WHERE p.employee_id = $1 AND p.month = $2;
    `;
    const { rows } = await pool.query(queryText, [employeeId, month]);
    return rows[0] ? formatPayrollRecord(rows[0]) : null;
};

export const upsertPayrollRecord = async (data) => {
    const {
        employeeId,
        month,
        basicSalary,
        allowances,
        bonus,
        tax,
        pf,
        deduction,
        grossSalary,
        totalDeductions,
        netSalary,
        generatedBy,
        status = "generated"
    } = data;

    const queryText = `
        INSERT INTO payrolls (
            employee_id, month, basic_salary, allowances, bonus, tax, pf,
            deduction, gross_salary, total_deductions, net_salary, generated_by, status, generated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
        ON CONFLICT (employee_id, month)
        DO UPDATE SET
            basic_salary = EXCLUDED.basic_salary,
            allowances = EXCLUDED.allowances,
            bonus = EXCLUDED.bonus,
            tax = EXCLUDED.tax,
            pf = EXCLUDED.pf,
            deduction = EXCLUDED.deduction,
            gross_salary = EXCLUDED.gross_salary,
            total_deductions = EXCLUDED.total_deductions,
            net_salary = EXCLUDED.net_salary,
            generated_by = EXCLUDED.generated_by,
            status = EXCLUDED.status,
            generated_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *;
    `;

    const values = [
        employeeId,
        month,
        basicSalary,
        allowances,
        bonus,
        tax,
        pf,
        deduction,
        grossSalary,
        totalDeductions,
        netSalary,
        generatedBy,
        status
    ];

    const { rows } = await pool.query(queryText, values);
    return formatPayrollRecord(rows[0]);
};

export const updatePayrollAmounts = async (id, amounts) => {
    const queryText = `
        UPDATE payrolls
        SET 
            basic_salary = $1,
            allowances = $2,
            bonus = $3,
            tax = $4,
            pf = $5,
            deduction = $6,
            gross_salary = $7,
            total_deductions = $8,
            net_salary = $9,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $10
        RETURNING *;
    `;
    const values = [
        amounts.basicSalary,
        amounts.allowances,
        amounts.bonus,
        amounts.tax,
        amounts.pf,
        amounts.deduction,
        amounts.grossSalary,
        amounts.totalDeductions,
        amounts.netSalary,
        id
    ];
    const { rows } = await pool.query(queryText, values);
    return rows[0] ? formatPayrollRecord(rows[0]) : null;
};

export const findAllPayrollsByMonth = async (month, employeeId = null) => {
    let queryText = `
        SELECT 
            p.*,
            e.employee_code, e.first_name, e.last_name, e.email, e.phone,
            e.employment->>'department' as department,
            e.employment->>'designation' as designation,
            e.employment->>'joiningDate' as joining_date,
            e.employment->>'employmentType' as employment_type,
            e.employment->>'status' as employment_status
        FROM payrolls p
        LEFT JOIN employees e ON p.employee_id = e.id
        WHERE p.month = $1
    `;
    const values = [month];
    if (employeeId) {
        queryText += ` AND p.employee_id = $2`;
        values.push(employeeId);
    }
    queryText += ` ORDER BY p.created_at DESC;`;

    const { rows } = await pool.query(queryText, values);
    return rows.map(formatPayrollRecord);
};

export const findPayrollById = async (id) => {
    const queryText = `
        SELECT 
            p.*,
            e.employee_code, e.first_name, e.last_name, e.email, e.phone,
            e.employment->>'department' as department,
            e.employment->>'designation' as designation,
            e.employment->>'joiningDate' as joining_date,
            e.employment->>'employmentType' as employment_type,
            e.employment->>'status' as employment_status
        FROM payrolls p
        LEFT JOIN employees e ON p.employee_id = e.id
        WHERE p.id = $1;
    `;
    const { rows } = await pool.query(queryText, [id]);
    return rows[0] ? formatPayrollRecord(rows[0]) : null;
};

export const updatePayrollRecordById = async (id, data) => {
    const queryText = `
        UPDATE payrolls
        SET 
            basic_salary = COALESCE($1, basic_salary),
            allowances = COALESCE($2, allowances),
            bonus = COALESCE($3, bonus),
            tax = COALESCE($4, tax),
            pf = COALESCE($5, pf),
            deduction = COALESCE($6, deduction),
            gross_salary = COALESCE($7, gross_salary),
            total_deductions = COALESCE($8, total_deductions),
            net_salary = COALESCE($9, net_salary),
            status = COALESCE($10, status),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $11
        RETURNING *;
    `;
    const values = [
        data.basicSalary !== undefined ? data.basicSalary : null,
        data.allowances !== undefined ? data.allowances : null,
        data.bonus !== undefined ? data.bonus : null,
        data.tax !== undefined ? data.tax : null,
        data.pf !== undefined ? data.pf : null,
        data.deduction !== undefined ? data.deduction : null,
        data.grossSalary !== undefined ? data.grossSalary : null,
        data.totalDeductions !== undefined ? data.totalDeductions : null,
        data.netSalary !== undefined ? data.netSalary : null,
        data.status !== undefined ? data.status : null,
        id
    ];
    const { rows } = await pool.query(queryText, values);
    if (!rows[0]) return null;
    return findPayrollById(id);
};

