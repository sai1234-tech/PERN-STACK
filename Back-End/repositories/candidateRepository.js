import pool from "../config/db.js";

export const initCandidateTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS candidates (
            id SERIAL PRIMARY KEY,
            candidate_id VARCHAR(50) UNIQUE NOT NULL,
            name VARCHAR(150) NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(50) DEFAULT '',
            skills TEXT DEFAULT '',
            experience VARCHAR(50) DEFAULT '',
            status VARCHAR(50) DEFAULT 'Applied',
            bgv_status VARCHAR(50) DEFAULT 'Pending',
            bgv_notes TEXT DEFAULT '',
            onboarded_employee_id VARCHAR(50) DEFAULT NULL,
            department VARCHAR(100) DEFAULT 'Engineering',
            designation VARCHAR(100) DEFAULT 'Software Engineer',
            manager VARCHAR(150) DEFAULT '',
            joining_date DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
        CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
    `;
    await pool.query(queryText);
};

export const formatCandidate = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        candidate_id: row.candidate_id,
        candidateId: row.candidate_id,
        name: row.name,
        email: row.email,
        phone: row.phone || "",
        skills: row.skills || "",
        experience: row.experience || "",
        status: row.status || "Applied",
        bgvStatus: row.bgv_status || "Pending",
        bgvNotes: row.bgv_notes || "",
        onboardedEmployeeId: row.onboarded_employee_id || null,
        department: row.department || "Engineering",
        designation: row.designation || "Software Engineer",
        manager: row.manager || "",
        joiningDate: row.joining_date || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
};

export const findAllCandidates = async () => {
    const queryText = `
        SELECT * FROM candidates
        ORDER BY id ASC;
    `;
    const { rows } = await pool.query(queryText);
    return rows.map(formatCandidate);
};

export const findCandidateByCandidateId = async (candidateId) => {
    const queryText = `
        SELECT * FROM candidates
        WHERE candidate_id = $1 OR id::text = $1
        LIMIT 1;
    `;
    const { rows } = await pool.query(queryText, [candidateId]);
    return formatCandidate(rows[0]);
};

export const createCandidateRecord = async ({
    name,
    email,
    phone = "",
    skills = "",
    experience = "",
    status = "Applied",
    department = "Engineering",
    designation = "Software Engineer",
    manager = "",
    joiningDate = null
}) => {
    // Generate sequential CAND-xxx id
    const countRes = await pool.query(`SELECT COUNT(*)::INTEGER as count FROM candidates;`);
    const nextSeq = (countRes.rows[0].count || 0) + 1;
    const candidateId = `CAND-${String(nextSeq).padStart(3, "0")}`;

    const skillsStr = Array.isArray(skills) ? skills.join(", ") : String(skills || "").trim();
    const phoneStr = String(phone || "").trim();
    const expStr = String(experience || "").trim();

    const queryText = `
        INSERT INTO candidates (
            candidate_id, name, email, phone, skills, experience,
            status, department, designation, manager, joining_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *;
    `;
    const values = [
        candidateId,
        String(name || "").trim(),
        String(email || "").toLowerCase().trim(),
        phoneStr,
        skillsStr,
        expStr,
        status,
        department,
        designation,
        manager,
        joiningDate
    ];
    const { rows } = await pool.query(queryText, values);
    return formatCandidate(rows[0]);
};

export const updateCandidateStatusRecord = async (candidateId, status) => {
    const queryText = `
        UPDATE candidates
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE candidate_id = $2 OR id::text = $2
        RETURNING *;
    `;
    const { rows } = await pool.query(queryText, [status, candidateId]);
    return formatCandidate(rows[0]);
};

export const updateCandidateBgvRecord = async (candidateId, bgvStatus, bgvNotes = "") => {
    const queryText = `
        UPDATE candidates
        SET bgv_status = $1, bgv_notes = $2, updated_at = CURRENT_TIMESTAMP
        WHERE candidate_id = $3 OR id::text = $3
        RETURNING *;
    `;
    const { rows } = await pool.query(queryText, [bgvStatus, bgvNotes, candidateId]);
    return formatCandidate(rows[0]);
};

export const markCandidateOnboarded = async (candidateId, employeeCode, onboardForm = {}) => {
    const queryText = `
        UPDATE candidates
        SET 
            status = 'Hired',
            onboarded_employee_id = $1,
            department = COALESCE($2, department),
            designation = COALESCE($3, designation),
            manager = COALESCE($4, manager),
            joining_date = COALESCE($5, joining_date),
            bgv_status = 'Verified',
            updated_at = CURRENT_TIMESTAMP
        WHERE candidate_id = $6 OR id::text = $6
        RETURNING *;
    `;
    const values = [
        employeeCode,
        onboardForm.department || null,
        onboardForm.designation || null,
        onboardForm.manager || null,
        onboardForm.joiningDate || null,
        candidateId
    ];
    const { rows } = await pool.query(queryText, values);
    return formatCandidate(rows[0]);
};

export const seedDefaultCandidates = async () => {
    const countRes = await pool.query(`SELECT COUNT(*)::INTEGER as count FROM candidates;`);
    if (countRes.rows[0].count === 0) {
        const seedData = [
            { id: "CAND-001", name: "Aisha Sharma", email: "aisha.sharma@example.com", phone: "+91 98765 43210", skills: "React, Node.js, AWS", experience: "5 Years", status: "Interview", bgv: "Initiated" },
            { id: "CAND-002", name: "Rohan Das", email: "rohan.das@example.com", phone: "+91 87654 32109", skills: "Python, Django, PostgreSQL", experience: "3 Years", status: "Applied", bgv: "Pending" },
            { id: "CAND-003", name: "Sneha Patel", email: "sneha.patel@example.com", phone: "+91 76543 21098", skills: "Figma, UI/UX, CSS", experience: "4 Years", status: "Selected", bgv: "Verified" },
            { id: "CAND-004", name: "Vikram Malhotra", email: "vikram.m@example.com", phone: "+91 91234 56789", skills: "DevOps, Kubernetes, Docker", experience: "6 Years", status: "Screening", bgv: "Pending" },
        ];

        for (const c of seedData) {
            await pool.query(
                `INSERT INTO candidates (candidate_id, name, email, phone, skills, experience, status, bgv_status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (candidate_id) DO NOTHING;`,
                [c.id, c.name, c.email, c.phone, c.skills, c.experience, c.status, c.bgv]
            );
        }
    }
};
