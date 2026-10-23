import pool from "../config/db.js";

/**
 * Initialize Client, Project/SOW Master, Rate-Card, and Transition Tables
 */
export const initClientTables = async () => {
    const queryText = `
        -- 1. Client Master Table
        CREATE TABLE IF NOT EXISTS clients (
            id SERIAL PRIMARY KEY,
            client_code VARCHAR(50) UNIQUE NOT NULL,
            client_name VARCHAR(150) NOT NULL,
            account_owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            account_owner_name VARCHAR(150) DEFAULT '',
            client_manager_name VARCHAR(100) DEFAULT '',
            client_manager_email VARCHAR(150) DEFAULT '',
            status VARCHAR(50) DEFAULT 'Active',
            msa_reference VARCHAR(100) DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- 2. Client Project & SOW Master Table
        CREATE TABLE IF NOT EXISTS client_projects (
            id SERIAL PRIMARY KEY,
            project_code VARCHAR(50) UNIQUE NOT NULL,
            client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
            client_name VARCHAR(150) NOT NULL,
            project_name VARCHAR(150) NOT NULL,
            sow_number VARCHAR(100) NOT NULL,
            billing_type VARCHAR(50) DEFAULT 'T&M',
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            delivery_manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            delivery_manager_name VARCHAR(150) DEFAULT '',
            budgeted_hours NUMERIC(10, 2) DEFAULT 0.00,
            status VARCHAR(50) DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- 3. Restricted Commercial Rate-Card Table
        CREATE TABLE IF NOT EXISTS client_rate_cards (
            id SERIAL PRIMARY KEY,
            client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
            project_id INTEGER REFERENCES client_projects(id) ON DELETE CASCADE,
            client_name VARCHAR(150) NOT NULL,
            project_name VARCHAR(150) NOT NULL,
            sow_number VARCHAR(100) DEFAULT '',
            role_title VARCHAR(100) NOT NULL,
            hourly_billing_rate NUMERIC(10, 2) NOT NULL,
            monthly_billing_rate NUMERIC(10, 2) DEFAULT 0.00,
            currency VARCHAR(10) DEFAULT 'USD',
            effective_date DATE DEFAULT CURRENT_DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- 4. Resource Transition & Replacement Tracker Table
        CREATE TABLE IF NOT EXISTS resource_transitions (
            id SERIAL PRIMARY KEY,
            allocation_id INTEGER REFERENCES project_allocations(id) ON DELETE SET NULL,
            emp_id VARCHAR(100) NOT NULL,
            employee_name VARCHAR(150) NOT NULL,
            client_name VARCHAR(150) NOT NULL,
            project_name VARCHAR(150) NOT NULL,
            sow_number VARCHAR(100) DEFAULT '',
            transition_type VARCHAR(50) NOT NULL DEFAULT 'Roll-off',
            replacement_emp_id VARCHAR(100) DEFAULT '',
            replacement_emp_name VARCHAR(150) DEFAULT '',
            kt_start_date DATE,
            kt_end_date DATE,
            kt_status VARCHAR(50) DEFAULT 'In Progress',
            client_approval_status VARCHAR(50) DEFAULT 'Pending',
            notes TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_client_code ON clients(client_code);
        CREATE INDEX IF NOT EXISTS idx_project_code ON client_projects(project_code);
        CREATE INDEX IF NOT EXISTS idx_transitions_emp_id ON resource_transitions(emp_id);
    `;

    await pool.query(queryText);

    // Seed initial baseline records if table is empty
    await seedClientMasterDefaults();
};

const seedClientMasterDefaults = async () => {
    try {
        const checkClient = await pool.query("SELECT COUNT(*) FROM clients;");
        if (parseInt(checkClient.rows[0].count, 10) === 0) {
            // Seed Clients
            await pool.query(`
                INSERT INTO clients (client_code, client_name, account_owner_name, client_manager_name, client_manager_email, status, msa_reference)
                VALUES 
                ('CLT-MSFT-001', 'Microsoft Enterprise Services', 'Meera Nair (VP Operations)', 'Sarah Connor', 'sconnor@microsoft.com', 'Active', 'MSA-2025-MSFT-GLOBAL'),
                ('CLT-AWS-002', 'Amazon Web Services (AWS)', 'Vikas Guru (Delivery Lead)', 'David Miller', 'dmiller@amazon.com', 'Active', 'MSA-2024-AWS-CLOUD'),
                ('CLT-QUAD-003', 'Quadratic Cloud Solutions', 'System Administrator', 'Alex Vance', 'avance@quadratics.com', 'Active', 'MSA-2026-QUAD-INTERNAL');
            `);
        }

        const checkProjects = await pool.query("SELECT COUNT(*) FROM client_projects;");
        if (parseInt(checkProjects.rows[0].count, 10) === 0) {
            const msftClient = await pool.query("SELECT id FROM clients WHERE client_code = 'CLT-MSFT-001' LIMIT 1;");
            const awsClient = await pool.query("SELECT id FROM clients WHERE client_code = 'CLT-AWS-002' LIMIT 1;");
            const quadClient = await pool.query("SELECT id FROM clients WHERE client_code = 'CLT-QUAD-003' LIMIT 1;");

            const msftId = msftClient.rows[0]?.id || 1;
            const awsId = awsClient.rows[0]?.id || 2;
            const quadId = quadClient.rows[0]?.id || 3;

            await pool.query(`
                INSERT INTO client_projects (project_code, client_id, client_name, project_name, sow_number, billing_type, start_date, end_date, delivery_manager_name, budgeted_hours, status)
                VALUES
                ('PRJ-TITAN-01', $1, 'Microsoft Enterprise Services', 'Project Titan (Cloud Transformation)', 'SOW-2026-ENG-001', 'T&M', '2026-01-01', '2026-12-31', 'Vikas Guru', 1600.00, 'Active'),
                ('PRJ-PHOENIX-02', $2, 'Amazon Web Services (AWS)', 'Project Phoenix (Core Banking Migration)', 'SOW-2026-FIN-002', 'Fixed Price', '2026-02-15', '2026-11-30', 'Vikas Guru', 1200.00, 'Active'),
                ('PRJ-APOLLO-03', $3, 'Quadratic Cloud Solutions', 'Project Apollo (AI Automation Engine)', 'SOW-2026-AI-003', 'T&M', '2026-03-01', '2026-10-31', 'Ananya Sharma', 800.00, 'Active');
            `, [msftId, awsId, quadId]);
        }

        const checkRateCards = await pool.query("SELECT COUNT(*) FROM client_rate_cards;");
        if (parseInt(checkRateCards.rows[0].count, 10) === 0) {
            const pTitan = await pool.query("SELECT id, client_id FROM client_projects WHERE project_code = 'PRJ-TITAN-01' LIMIT 1;");
            const pPhoenix = await pool.query("SELECT id, client_id FROM client_projects WHERE project_code = 'PRJ-PHOENIX-02' LIMIT 1;");

            if (pTitan.rows.length > 0 && pPhoenix.rows.length > 0) {
                await pool.query(`
                    INSERT INTO client_rate_cards (client_id, project_id, client_name, project_name, sow_number, role_title, hourly_billing_rate, monthly_billing_rate, currency)
                    VALUES
                    ($1, $2, 'Microsoft Enterprise Services', 'Project Titan (Cloud Transformation)', 'SOW-2026-ENG-001', 'Lead Cloud Architect', 115.00, 18400.00, 'USD'),
                    ($1, $2, 'Microsoft Enterprise Services', 'Project Titan (Cloud Transformation)', 'SOW-2026-ENG-001', 'Senior Full Stack Engineer', 90.00, 14400.00, 'USD'),
                    ($3, $4, 'Amazon Web Services (AWS)', 'Project Phoenix (Core Banking Migration)', 'SOW-2026-FIN-002', 'DevOps / SRE Specialist', 105.00, 16800.00, 'USD'),
                    ($3, $4, 'Amazon Web Services (AWS)', 'Project Phoenix (Core Banking Migration)', 'SOW-2026-FIN-002', 'UI/UX Design Consultant', 75.00, 12000.00, 'USD');
                `, [pTitan.rows[0].client_id, pTitan.rows[0].id, pPhoenix.rows[0].client_id, pPhoenix.rows[0].id]);
            }
        }

        const checkTransitions = await pool.query("SELECT COUNT(*) FROM resource_transitions;");
        if (parseInt(checkTransitions.rows[0].count, 10) === 0) {
            await pool.query(`
                INSERT INTO resource_transitions (emp_id, employee_name, client_name, project_name, sow_number, transition_type, replacement_emp_id, replacement_emp_name, kt_start_date, kt_end_date, kt_status, client_approval_status, notes)
                VALUES
                ('EMP-101', 'Aisha Sharma', 'Microsoft Enterprise Services', 'Project Titan (Cloud Transformation)', 'SOW-2026-ENG-001', 'Replacement', 'EMP-102', 'Rohan Das', '2026-10-15', '2026-10-31', 'In Progress', 'Approved', 'Planned roll-off for promotion; Rohan Das undergoing 2-week client shadowing.'),
                ('EMP-104', 'Karan Singh', 'Amazon Web Services (AWS)', 'Project Phoenix (Core Banking Migration)', 'SOW-2026-FIN-002', 'Roll-off', '', '', '2026-10-25', '2026-11-05', 'Scheduled', 'Pending', 'Project milestone complete; resource scheduled for release back to bench.');
            `);
        }
    } catch (seedErr) {
        console.warn("Client Master defaults notice:", seedErr.message);
    }
};

/* -------------------------------------------------------------
   CLIENT MASTER CRUD
------------------------------------------------------------- */
export const findAllClients = async () => {
    const { rows } = await pool.query("SELECT * FROM clients ORDER BY client_code ASC;");
    return rows;
};

export const findClientById = async (id) => {
    const { rows } = await pool.query("SELECT * FROM clients WHERE id = $1;", [id]);
    return rows[0] || null;
};

export const createClientRecord = async ({
    clientCode,
    clientName,
    accountOwnerId = null,
    accountOwnerName = "",
    clientManagerName = "",
    clientManagerEmail = "",
    status = "Active",
    msaReference = ""
}) => {
    const query = `
        INSERT INTO clients (client_code, client_name, account_owner_id, account_owner_name, client_manager_name, client_manager_email, status, msa_reference)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
    `;
    const { rows } = await pool.query(query, [
        clientCode,
        clientName,
        accountOwnerId,
        accountOwnerName,
        clientManagerName,
        clientManagerEmail,
        status,
        msaReference
    ]);
    return rows[0];
};

export const updateClientRecord = async (id, fields) => {
    const {
        clientCode,
        clientName,
        accountOwnerId,
        accountOwnerName,
        clientManagerName,
        clientManagerEmail,
        status,
        msaReference
    } = fields;

    const query = `
        UPDATE clients
        SET
            client_code = COALESCE($1, client_code),
            client_name = COALESCE($2, client_name),
            account_owner_id = COALESCE($3, account_owner_id),
            account_owner_name = COALESCE($4, account_owner_name),
            client_manager_name = COALESCE($5, client_manager_name),
            client_manager_email = COALESCE($6, client_manager_email),
            status = COALESCE($7, status),
            msa_reference = COALESCE($8, msa_reference),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $9
        RETURNING *;
    `;
    const { rows } = await pool.query(query, [
        clientCode,
        clientName,
        accountOwnerId,
        accountOwnerName,
        clientManagerName,
        clientManagerEmail,
        status,
        msaReference,
        id
    ]);
    return rows[0];
};

export const deleteClientRecord = async (id) => {
    const { rowCount } = await pool.query("DELETE FROM clients WHERE id = $1;", [id]);
    return rowCount > 0;
};

/* -------------------------------------------------------------
   PROJECT & SOW MASTER CRUD
------------------------------------------------------------- */
export const findAllClientProjects = async () => {
    const { rows } = await pool.query("SELECT * FROM client_projects ORDER BY project_code ASC;");
    return rows;
};

export const createClientProjectRecord = async ({
    projectCode,
    clientId,
    clientName,
    projectName,
    sowNumber,
    billingType = "T&M",
    startDate,
    endDate,
    deliveryManagerId = null,
    deliveryManagerName = "",
    budgetedHours = 0,
    status = "Active"
}) => {
    const query = `
        INSERT INTO client_projects (
            project_code, client_id, client_name, project_name, sow_number,
            billing_type, start_date, end_date, delivery_manager_id, delivery_manager_name,
            budgeted_hours, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *;
    `;
    const { rows } = await pool.query(query, [
        projectCode,
        clientId,
        clientName,
        projectName,
        sowNumber,
        billingType,
        startDate,
        endDate,
        deliveryManagerId,
        deliveryManagerName,
        budgetedHours,
        status
    ]);
    return rows[0];
};

export const updateClientProjectRecord = async (id, fields) => {
    const {
        projectCode,
        clientName,
        projectName,
        sowNumber,
        billingType,
        startDate,
        endDate,
        deliveryManagerName,
        budgetedHours,
        status
    } = fields;

    const query = `
        UPDATE client_projects
        SET
            project_code = COALESCE($1, project_code),
            client_name = COALESCE($2, client_name),
            project_name = COALESCE($3, project_name),
            sow_number = COALESCE($4, sow_number),
            billing_type = COALESCE($5, billing_type),
            start_date = COALESCE($6, start_date),
            end_date = COALESCE($7, end_date),
            delivery_manager_name = COALESCE($8, delivery_manager_name),
            budgeted_hours = COALESCE($9, budgeted_hours),
            status = COALESCE($10, status),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $11
        RETURNING *;
    `;
    const { rows } = await pool.query(query, [
        projectCode,
        clientName,
        projectName,
        sowNumber,
        billingType,
        startDate,
        endDate,
        deliveryManagerName,
        budgetedHours,
        status,
        id
    ]);
    return rows[0];
};

export const deleteClientProjectRecord = async (id) => {
    const { rowCount } = await pool.query("DELETE FROM client_projects WHERE id = $1;", [id]);
    return rowCount > 0;
};

/* -------------------------------------------------------------
   RESTRICTED RATE-CARD CRUD
------------------------------------------------------------- */
export const findAllRateCards = async () => {
    const { rows } = await pool.query("SELECT * FROM client_rate_cards ORDER BY id DESC;");
    return rows;
};

export const createRateCardRecord = async ({
    clientId,
    projectId,
    clientName,
    projectName,
    sowNumber = "",
    roleTitle,
    hourlyBillingRate,
    monthlyBillingRate = 0,
    currency = "USD",
    effectiveDate = new Date()
}) => {
    const query = `
        INSERT INTO client_rate_cards (
            client_id, project_id, client_name, project_name, sow_number,
            role_title, hourly_billing_rate, monthly_billing_rate, currency, effective_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *;
    `;
    const { rows } = await pool.query(query, [
        clientId,
        projectId,
        clientName,
        projectName,
        sowNumber,
        roleTitle,
        hourlyBillingRate,
        monthlyBillingRate,
        currency,
        effectiveDate
    ]);
    return rows[0];
};

export const deleteRateCardRecord = async (id) => {
    const { rowCount } = await pool.query("DELETE FROM client_rate_cards WHERE id = $1;", [id]);
    return rowCount > 0;
};

/* -------------------------------------------------------------
   TRANSITION & REPLACEMENT TRACKER CRUD
------------------------------------------------------------- */
export const findAllTransitions = async () => {
    const { rows } = await pool.query("SELECT * FROM resource_transitions ORDER BY id DESC;");
    return rows;
};

export const createTransitionRecord = async ({
    allocationId = null,
    empId,
    employeeName,
    clientName,
    projectName,
    sowNumber = "",
    transitionType = "Roll-off",
    replacementEmpId = "",
    replacementEmpName = "",
    ktStartDate = null,
    ktEndDate = null,
    ktStatus = "In Progress",
    clientApprovalStatus = "Pending",
    notes = ""
}) => {
    const query = `
        INSERT INTO resource_transitions (
            allocation_id, emp_id, employee_name, client_name, project_name, sow_number,
            transition_type, replacement_emp_id, replacement_emp_name,
            kt_start_date, kt_end_date, kt_status, client_approval_status, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *;
    `;
    const { rows } = await pool.query(query, [
        allocationId,
        empId,
        employeeName,
        clientName,
        projectName,
        sowNumber,
        transitionType,
        replacementEmpId,
        replacementEmpName,
        ktStartDate,
        ktEndDate,
        ktStatus,
        clientApprovalStatus,
        notes
    ]);
    return rows[0];
};

export const updateTransitionRecord = async (id, fields) => {
    const {
        transitionType,
        replacementEmpId,
        replacementEmpName,
        ktStartDate,
        ktEndDate,
        ktStatus,
        clientApprovalStatus,
        notes
    } = fields;

    const query = `
        UPDATE resource_transitions
        SET
            transition_type = COALESCE($1, transition_type),
            replacement_emp_id = COALESCE($2, replacement_emp_id),
            replacement_emp_name = COALESCE($3, replacement_emp_name),
            kt_start_date = COALESCE($4, kt_start_date),
            kt_end_date = COALESCE($5, kt_end_date),
            kt_status = COALESCE($6, kt_status),
            client_approval_status = COALESCE($7, client_approval_status),
            notes = COALESCE($8, notes),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $9
        RETURNING *;
    `;
    const { rows } = await pool.query(query, [
        transitionType,
        replacementEmpId,
        replacementEmpName,
        ktStartDate,
        ktEndDate,
        ktStatus,
        clientApprovalStatus,
        notes,
        id
    ]);
    return rows[0];
};
