import pool from "../config/db.js";

// Initialize clearances table in PostgreSQL
export const initClearanceTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS clearances (
            id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            resignation_id INTEGER NOT NULL REFERENCES resignations(id) ON DELETE CASCADE,
            assets JSONB DEFAULT '{"status": "pending", "comments": "", "clearedBy": null, "clearedAt": null}'::jsonb,
            it_access JSONB DEFAULT '{"status": "pending", "comments": "", "clearedBy": null, "clearedAt": null}'::jsonb,
            finance JSONB DEFAULT '{"status": "pending", "comments": "", "clearedBy": null, "clearedAt": null}'::jsonb,
            leave_attendance JSONB DEFAULT '{"status": "pending", "comments": "", "clearedBy": null, "clearedAt": null}'::jsonb,
            documents JSONB DEFAULT '{"status": "pending", "comments": "", "clearedBy": null, "clearedAt": null}'::jsonb,
            final_settlement JSONB DEFAULT '{"status": "pending", "processedAt": null, "details": ""}'::jsonb,
            relieving_letter JSONB DEFAULT '{"issued": false, "issuedAt": null, "documentUrl": ""}'::jsonb,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_clearances_employee_id ON clearances(employee_id);
        CREATE INDEX IF NOT EXISTS idx_clearances_resignation_id ON clearances(resignation_id);
    `;
    await pool.query(queryText);
};

export const formatClearance = (row) => {
    if (!row) return null;

    const assets = row.assets || { status: "pending", comments: "" };
    const itAccess = row.it_access || row.itAccess || { status: "pending", comments: "" };
    const finance = row.finance || { status: "pending", comments: "" };
    const leaveAttendance = row.leave_attendance || row.leaveAttendance || { status: "pending", comments: "" };
    const documents = row.documents || { status: "pending", comments: "" };
    const finalSettlement = row.final_settlement || row.finalSettlement || { status: "pending" };
    const relievingLetter = row.relieving_letter || row.relievingLetter || { issued: false };

    const isFullyCleared =
        assets.status === "cleared" &&
        itAccess.status === "cleared" &&
        finance.status === "cleared" &&
        leaveAttendance.status === "cleared" &&
        documents.status === "cleared";

    return {
        _id: row.id,
        id: row.id,
        employee: row.employee_code ? {
            _id: row.employee_id,
            id: row.employee_id,
            firstName: row.first_name || "",
            lastName: row.last_name || "",
            employeeCode: row.employee_code || "",
            email: row.email || "",
            department: row.department || "",
            designation: row.designation || "",
            salary: Number(row.salary || 0),
            employment: {
                department: row.department || "",
                designation: row.designation || "",
                salary: Number(row.salary || 0)
            }
        } : row.employee_id,
        resignation: row.resignation_date ? {
            _id: row.resignation_id,
            id: row.resignation_id,
            resignationDate: row.resignation_date,
            requestedLastWorkingDay: row.requested_last_working_day,
            approvedLastWorkingDay: row.approved_last_working_day,
            status: row.resignation_status || "pending",
            reasonCategory: row.reason_category || ""
        } : row.resignation_id,
        assets,
        itAccess,
        finance,
        leaveAttendance,
        documents,
        finalSettlement,
        relievingLetter,
        isFullyCleared,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
};

export const findClearanceByResignationId = async (resignationId) => {
    const queryText = `
        SELECT 
            c.*,
            e.employee_code, e.first_name, e.last_name, e.email, 
            e.employment->>'department' as department, 
            e.employment->>'designation' as designation, 
            (e.employment->>'salary')::numeric as salary,
            r.resignation_date, r.requested_last_working_day, r.approved_last_working_day, r.status as resignation_status, r.reason_category
        FROM clearances c
        LEFT JOIN employees e ON c.employee_id = e.id
        LEFT JOIN resignations r ON c.resignation_id = r.id
        WHERE c.resignation_id = $1;
    `;
    const { rows } = await pool.query(queryText, [resignationId]);
    return rows[0] ? formatClearance(rows[0]) : null;
};

export const findClearanceByEmployeeId = async (employeeId) => {
    const queryText = `
        SELECT 
            c.*,
            e.employee_code, e.first_name, e.last_name, e.email, 
            e.employment->>'department' as department, 
            e.employment->>'designation' as designation, 
            (e.employment->>'salary')::numeric as salary,
            r.resignation_date, r.requested_last_working_day, r.approved_last_working_day, r.status as resignation_status, r.reason_category
        FROM clearances c
        LEFT JOIN employees e ON c.employee_id = e.id
        LEFT JOIN resignations r ON c.resignation_id = r.id
        WHERE c.employee_id = $1
        ORDER BY c.created_at DESC
        LIMIT 1;
    `;
    const { rows } = await pool.query(queryText, [employeeId]);
    return rows[0] ? formatClearance(rows[0]) : null;
};

export const findClearanceById = async (id) => {
    const queryText = `
        SELECT 
            c.*,
            e.employee_code, e.first_name, e.last_name, e.email, 
            e.employment->>'department' as department, 
            e.employment->>'designation' as designation, 
            (e.employment->>'salary')::numeric as salary,
            r.resignation_date, r.requested_last_working_day, r.approved_last_working_day, r.status as resignation_status, r.reason_category
        FROM clearances c
        LEFT JOIN employees e ON c.employee_id = e.id
        LEFT JOIN resignations r ON c.resignation_id = r.id
        WHERE c.id = $1;
    `;
    const { rows } = await pool.query(queryText, [id]);
    return rows[0] ? formatClearance(rows[0]) : null;
};

export const createClearanceRecord = async (employeeId, resignationId) => {
    const queryText = `
        INSERT INTO clearances (employee_id, resignation_id)
        VALUES ($1, $2)
        RETURNING *;
    `;
    const { rows } = await pool.query(queryText, [employeeId, resignationId]);
    return findClearanceById(rows[0].id);
};

export const findAllClearancesRepo = async () => {
    const queryText = `
        SELECT 
            c.*,
            e.employee_code, e.first_name, e.last_name, e.email, 
            e.employment->>'department' as department, 
            e.employment->>'designation' as designation, 
            (e.employment->>'salary')::numeric as salary,
            r.resignation_date, r.requested_last_working_day, r.approved_last_working_day, r.status as resignation_status, r.reason_category
        FROM clearances c
        LEFT JOIN employees e ON c.employee_id = e.id
        LEFT JOIN resignations r ON c.resignation_id = r.id
        ORDER BY c.created_at DESC;
    `;
    const { rows } = await pool.query(queryText);
    return rows.map(formatClearance);
};

export const updateClearanceCategoryRepo = async (id, category, categoryData) => {
    const colNameMap = {
        assets: "assets",
        itAccess: "it_access",
        finance: "finance",
        leaveAttendance: "leave_attendance",
        documents: "documents"
    };

    const dbCol = colNameMap[category];
    if (!dbCol) return null;

    const queryText = `
        UPDATE clearances
        SET ${dbCol} = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *;
    `;

    const { rows } = await pool.query(queryText, [JSON.stringify(categoryData), id]);
    return rows[0] ? findClearanceById(rows[0].id) : null;
};

export const updateFinalSettlementRepo = async (id, settlementData) => {
    const queryText = `
        UPDATE clearances
        SET final_settlement = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *;
    `;
    const { rows } = await pool.query(queryText, [JSON.stringify(settlementData), id]);
    return rows[0] ? findClearanceById(rows[0].id) : null;
};

export const updateRelievingLetterRepo = async (id, relievingLetterData) => {
    const queryText = `
        UPDATE clearances
        SET relieving_letter = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *;
    `;
    const { rows } = await pool.query(queryText, [JSON.stringify(relievingLetterData), id]);
    return rows[0] ? findClearanceById(rows[0].id) : null;
};
