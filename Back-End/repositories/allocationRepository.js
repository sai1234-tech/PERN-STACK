import pool from "../config/db.js";

export const initAllocationTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS project_allocations (
            id SERIAL PRIMARY KEY,
            emp_id VARCHAR(100) NOT NULL,
            employee_name VARCHAR(150) NOT NULL,
            employee_code VARCHAR(50) DEFAULT '',
            department VARCHAR(100) DEFAULT '',
            role VARCHAR(100) DEFAULT '',
            project_name VARCHAR(150) DEFAULT '',
            client_name VARCHAR(150) DEFAULT 'Enterprise Client',
            status VARCHAR(50) DEFAULT 'Allocated',
            billability VARCHAR(50) DEFAULT 'Billable',
            allocation_percentage INT DEFAULT 100,
            start_date DATE DEFAULT CURRENT_DATE,
            end_date DATE,
            sow_number VARCHAR(100) DEFAULT '',
            notes TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        ALTER TABLE project_allocations ADD COLUMN IF NOT EXISTS sow_number VARCHAR(100) DEFAULT '';
        CREATE INDEX IF NOT EXISTS idx_allocations_emp_id ON project_allocations(emp_id);
        DELETE FROM project_allocations WHERE emp_id IN ('EMP-101', 'EMP-102', 'EMP-103', 'EMP-104');
    `;
    await pool.query(queryText);
};

export const formatAllocation = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        empId: row.emp_id,
        employeeName: row.employee_name,
        employeeCode: row.employee_code || "",
        department: row.department || "",
        role: row.role || "",
        projectName: row.project_name || "",
        clientName: row.client_name || "Enterprise Client",
        status: row.status || "Allocated",
        billability: row.billability || "Billable",
        allocationPercentage: Number(row.allocation_percentage) || 100,
        startDate: row.start_date || null,
        endDate: row.end_date || null,
        sowNumber: row.sow_number || "",
        notes: row.notes || "",
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
};

export const findAllAllocations = async () => {
    try {
        await pool.query("DELETE FROM project_allocations WHERE emp_id IN ('EMP-101', 'EMP-102', 'EMP-103', 'EMP-104');");
        await pool.query(`
            UPDATE project_allocations
            SET status = 'Bench', project_name = '', sow_number = '', billability = 'Internal', allocation_percentage = 0
            WHERE project_name IN (
                'Project Titan',
                'Project Phoenix',
                'Project Apollo',
                'Project Titan (Cloud Transformation)',
                'Project Phoenix (Core Banking Migration)',
                'Project Apollo (AI Automation Engine)'
            );
        `);
        await pool.query(`
            UPDATE project_allocations
            SET status = 'Allocated',
                project_name = 'HMRS',
                sow_number = 'SOW',
                billability = 'Billable',
                allocation_percentage = 100
            WHERE (UPPER(employee_code) = 'EMP175' OR LOWER(employee_name) LIKE '%kushangala%')
              AND COALESCE(project_name, '') = ''
              AND COALESCE(notes, '') <> 'RELEASED_TO_BENCH';
        `);
    } catch (_) {}
    const queryText = `
        SELECT * FROM project_allocations
        ORDER BY updated_at DESC, id DESC;
    `;
    const { rows } = await pool.query(queryText);
    return rows.map(formatAllocation);
};

export const findAllocationByEmpId = async (empId) => {
    const queryText = `
        SELECT * FROM project_allocations
        WHERE emp_id = $1
        ORDER BY id DESC LIMIT 1;
    `;
    const { rows } = await pool.query(queryText, [String(empId)]);
    return formatAllocation(rows[0]);
};

export const upsertAllocationRecord = async ({
    empId,
    employeeName,
    employeeCode = "",
    department = "",
    role = "",
    projectName = "",
    clientName = "Enterprise Client",
    status = "Allocated",
    billability = "Billable",
    allocationPercentage = 100,
    startDate = null,
    endDate = null,
    sowNumber = "",
    notes = ""
}) => {
    const checkQuery = `
        SELECT * FROM project_allocations
        WHERE emp_id = $1
           OR ($2 <> '' AND UPPER(employee_code) = UPPER($2))
        ORDER BY updated_at DESC, id DESC;
    `;
    const checkRes = await pool.query(checkQuery, [String(empId), String(employeeCode || "").trim()]);

    if (checkRes.rows.length > 0) {
        const primaryId = checkRes.rows[0].id;
        if (checkRes.rows.length > 1) {
            const duplicateIds = checkRes.rows.slice(1).map((r) => r.id);
            await pool.query(`DELETE FROM project_allocations WHERE id = ANY($1::int[]);`, [duplicateIds]).catch(() => {});
        }
        const updateQuery = `
            UPDATE project_allocations
            SET 
                emp_id = $1,
                employee_name = COALESCE($2, employee_name),
                employee_code = COALESCE($3, employee_code),
                department = COALESCE($4, department),
                role = COALESCE($5, role),
                project_name = $6,
                client_name = $7,
                status = $8,
                billability = $9,
                allocation_percentage = $10,
                start_date = COALESCE($11, start_date),
                end_date = $12,
                sow_number = COALESCE($13, sow_number),
                notes = $14,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $15
            RETURNING *;
        `;
        const values = [
            String(empId),
            employeeName,
            employeeCode,
            department,
            role,
            projectName,
            clientName,
            status,
            billability,
            allocationPercentage,
            startDate,
            endDate,
            sowNumber,
            notes,
            primaryId
        ];
        const { rows } = await pool.query(updateQuery, values);
        return formatAllocation(rows[0]);
    } else {
        const insertQuery = `
            INSERT INTO project_allocations (
                emp_id, employee_name, employee_code, department, role,
                project_name, client_name, status, billability,
                allocation_percentage, start_date, end_date, sow_number, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, CURRENT_DATE), $12, $13, $14)
            RETURNING *;
        `;
        const values = [
            String(empId),
            employeeName,
            employeeCode,
            department,
            role,
            projectName,
            clientName,
            status,
            billability,
            allocationPercentage,
            startDate,
            endDate,
            sowNumber,
            notes
        ];
        const { rows } = await pool.query(insertQuery, values);
        return formatAllocation(rows[0]);
    }
};

export const updateAllocationStatusRecord = async (id, status, projectName) => {
    let queryText = `
        UPDATE project_allocations
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 OR emp_id = $2::text
        RETURNING *;
    `;
    let values = [status, id];

    if (projectName !== undefined) {
        queryText = `
            UPDATE project_allocations
            SET status = $1, project_name = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 OR emp_id = $3::text
            RETURNING *;
        `;
        values = [status, projectName, id];
    }

    const { rows } = await pool.query(queryText, values);
    return formatAllocation(rows[0]);
};

export const deleteAllocationRecord = async (id) => {
    const queryText = `
        DELETE FROM project_allocations
        WHERE id = $1 OR emp_id = $1::text
        RETURNING *;
    `;
    const { rows } = await pool.query(queryText, [id]);
    return formatAllocation(rows[0]);
};
