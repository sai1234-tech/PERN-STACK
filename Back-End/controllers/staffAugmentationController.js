import pool from "../config/db.js";

// 1. Staff Augmentation Operational & Commercial Overview
export const getStaffAugOverview = async (req, res, next) => {
    try {
        const userRole = String(req.user?.role || "").toLowerCase().trim();
        const canViewCommercials = ["admin", "super_admin", "finance", "payroll", "leadership"].includes(userRole);

        const [
            clientsRes,
            projectsRes,
            allocationsRes,
            transitionsRes,
            rateCardsRes
        ] = await Promise.all([
            pool.query(`SELECT COUNT(*)::INTEGER as count FROM clients WHERE status = 'Active'`),
            pool.query(`
                SELECT 
                    COUNT(*)::INTEGER as total_projects,
                    COUNT(*) FILTER (WHERE status = 'Active')::INTEGER as active_projects,
                    COUNT(*) FILTER (WHERE end_date <= CURRENT_DATE + INTERVAL '30 days' AND status = 'Active')::INTEGER as expiring_sows
                FROM client_projects
            `),
            pool.query(`
                SELECT 
                    COUNT(*)::INTEGER as total_allocations,
                    COUNT(*) FILTER (WHERE billability = 'Billable')::INTEGER as billable_count,
                    COUNT(*) FILTER (WHERE billability = 'Shadow')::INTEGER as shadow_count,
                    COUNT(*) FILTER (WHERE billability = 'Bench' OR status = 'Bench')::INTEGER as bench_count
                FROM project_allocations
            `),
            pool.query(`
                SELECT 
                    COUNT(*)::INTEGER as total_transitions,
                    COUNT(*) FILTER (WHERE kt_status = 'In Progress')::INTEGER as active_transitions
                FROM resource_transitions
            `),
            pool.query(`SELECT COUNT(*)::INTEGER as count FROM client_rate_cards`)
        ]);

        const clientCount = clientsRes.rows[0].count;
        const projectStats = projectsRes.rows[0];
        const allocStats = allocationsRes.rows[0];
        const transitionStats = transitionsRes.rows[0];
        const rateCardCount = rateCardsRes.rows[0].count;

        const totalTracked = (allocStats.billable_count + allocStats.shadow_count + allocStats.bench_count) || 1;
        const billabilityPercentage = ((allocStats.billable_count / totalTracked) * 100).toFixed(1);

        res.status(200).json({
            success: true,
            role: userRole,
            canViewCommercials,
            metrics: {
                activeClients: clientCount,
                totalProjects: projectStats.total_projects,
                activeSows: projectStats.active_projects,
                expiringSows30Days: projectStats.expiring_sows,
                totalAllocations: allocStats.total_allocations,
                billableHeadcount: allocStats.billable_count,
                shadowHeadcount: allocStats.shadow_count,
                benchHeadcount: allocStats.bench_count,
                billabilityPercentage: `${billabilityPercentage}%`,
                activeTransitions: transitionStats.active_transitions,
                totalRateCards: rateCardCount,
                commercialProtection: canViewCommercials ? "UNMASKED_ACCESS" : "RESTRICTED_AND_MASKED"
            }
        });
    } catch (err) {
        next(err);
    }
};

// 2. Comprehensive 16-Stage Hire-to-Retire Lifecycle Trace for an Employee
export const getLifecycleTrace = async (req, res, next) => {
    try {
        const { id } = req.params; // Can be candidate_id or employee_code or id

        // 1. Check Employee
        const empRes = await pool.query(
            `SELECT * FROM employees WHERE id::text = $1 OR employee_code = $1 OR email = $1 LIMIT 1`,
            [id]
        );
        const employee = empRes.rows[0] || null;

        // 2. Check Candidate (direct or via employee email)
        const candRes = await pool.query(
            `SELECT * FROM candidates WHERE id::text = $1 OR candidate_id = $1 OR email = $1 OR (email = $2 AND $2 IS NOT NULL) LIMIT 1`,
            [id, employee?.email || null]
        );
        const candidate = candRes.rows[0] || null;

        const empId = employee?.id;
        const empCode = employee?.employee_code || id;

        // 3. Parallel Stage Queries
        const [
            bgvRes,
            preboardRes,
            allocRes,
            attRes,
            timesheetRes,
            leaveRes,
            payrollRes,
            ticketRes,
            perfRes,
            resigRes,
            clearanceRes,
            exitDocRes
        ] = await Promise.all([
            candidate ? pool.query(`SELECT * FROM bgv_verifications WHERE candidate_id = $1`, [candidate.id]) : { rows: [] },
            candidate ? pool.query(`SELECT * FROM preboarding_tasks WHERE candidate_id = $1`, [candidate.candidate_id || candidate.id.toString()]) : { rows: [] },
            empId ? pool.query(`SELECT * FROM project_allocations WHERE emp_id = $1 OR employee_code = $2`, [empId.toString(), empCode]) : { rows: [] },
            empId ? pool.query(`SELECT * FROM attendance WHERE employee_id = $1 ORDER BY date DESC LIMIT 5`, [employee.user_id || empId]) : { rows: [] },
            empId ? pool.query(`SELECT * FROM timesheets WHERE employee_id = $1 ORDER BY date DESC LIMIT 5`, [empId]) : { rows: [] },
            empId ? pool.query(`SELECT * FROM leaves WHERE employee_id = $1 ORDER BY id DESC LIMIT 5`, [empId]) : { rows: [] },
            empId ? pool.query(`SELECT * FROM payroll_inputs WHERE employee_id = $1 ORDER BY id DESC LIMIT 3`, [empId]) : { rows: [] },
            empId ? pool.query(`SELECT * FROM tickets WHERE emp_id = $1 OR emp_id = $2 ORDER BY id DESC LIMIT 5`, [empId.toString(), empCode]) : { rows: [] },
            empId ? pool.query(`SELECT * FROM okrs WHERE employee_id = $1 ORDER BY id DESC LIMIT 3`, [empId]) : { rows: [] },
            empId ? pool.query(`SELECT * FROM resignations WHERE employee_id = $1 ORDER BY id DESC LIMIT 1`, [empId]) : { rows: [] },
            empId ? pool.query(`SELECT * FROM clearances WHERE employee_id = $1 ORDER BY id DESC LIMIT 1`, [empId]) : { rows: [] },
            empId ? pool.query(`SELECT * FROM exit_documents WHERE employee_id = $1 ORDER BY id DESC`, [empId]) : { rows: [] }
        ]);

        const clr = clearanceRes.rows[0] || null;
        const clrStatus = clr ? (clr.relieving_letter?.issued ? "COMPLETED" : "CLEARED") : "NOT_INITIATED";
        const fnfStatus = (clr?.final_settlement?.status?.toLowerCase() === "processed") ? "SETTLED" : "PENDING";

        const pipelineStages = [
            { stage: 1, name: "Recruitment", status: candidate ? "COMPLETED" : "NOT_STARTED", details: candidate ? `Candidate: ${candidate.name} (${candidate.status})` : null },
            { stage: 2, name: "Offer", status: candidate?.status === "Selected" || candidate?.stage === "Offered" || candidate?.status === "Hired" ? "COMPLETED" : (candidate ? "IN_PROGRESS" : "NOT_STARTED"), details: candidate ? `Role: ${candidate.role || candidate.designation || "Architect"}` : null },
            { stage: 3, name: "BGV", status: candidate?.bgv_status === "Verified" || bgvRes.rows.some(b => b.status === "Verified" || b.status === "Cleared") ? "COMPLETED" : "PENDING", details: bgvRes.rows[0] || candidate?.bgv_notes || null },
            { stage: 4, name: "Preboarding", status: preboardRes.rows.length > 0 ? (preboardRes.rows.every(t => t.status === "Completed") ? "COMPLETED" : "IN_PROGRESS") : "NOT_STARTED", details: `${preboardRes.rows.filter(t => t.status === "Completed").length}/${preboardRes.rows.length} tasks completed` },
            { stage: 5, name: "Onboarding", status: employee ? "COMPLETED" : "PENDING", details: employee ? `Converted to Master ${employee.employee_code}` : null },
            { stage: 6, name: "Employee Master", status: employee ? "ACTIVE" : "NOT_FOUND", details: employee ? { code: employee.employee_code, email: employee.email, pan: employee.pan ? "VERIFIED" : "PENDING" } : null },
            { stage: 7, name: "Client/Project Deployment", status: allocRes.rows.length > 0 ? "ALLOCATED" : "ON_BENCH", details: allocRes.rows[0] ? `Client: ${allocRes.rows[0].client_name} | SOW: ${allocRes.rows[0].sow_number || "SOW-GEN"} | Billability: ${allocRes.rows[0].billability}` : null },
            { stage: 8, name: "Attendance/Timesheet", status: timesheetRes.rows.length > 0 ? "ACTIVE" : "PENDING", details: `${attRes.rows.length} punches, ${timesheetRes.rows.length} timesheets recorded` },
            { stage: 9, name: "Leave", status: leaveRes.rows.length > 0 ? "REQUESTED" : "NO_REQUESTS", details: leaveRes.rows[0] || null },
            { stage: 10, name: "Payroll Inputs", status: payrollRes.rows.length > 0 ? "PROCESSED" : "PENDING", details: payrollRes.rows[0] || null },
            { stage: 11, name: "Helpdesk", status: ticketRes.rows.length > 0 ? "LOGGED" : "CLEAN", details: ticketRes.rows[0] || null },
            { stage: 12, name: "Performance", status: perfRes.rows.length > 0 ? "REVIEWED" : "PENDING", details: perfRes.rows[0] || null },
            { stage: 13, name: "Resignation", status: resigRes.rows.length > 0 ? String(resigRes.rows[0].status || "").toUpperCase() : "NONE", details: resigRes.rows[0] || null },
            { stage: 14, name: "Clearance", status: clrStatus, details: clr },
            { stage: 15, name: "F&F Inputs", status: fnfStatus, details: clr?.final_settlement || null },
            { stage: 16, name: "Exit Documents", status: exitDocRes.rows.length > 0 ? "ISSUED" : "PENDING", details: exitDocRes.rows.map(d => ({ type: d.doc_type || d.document_type, ref: d.doc_code || d.document_reference, sha256: (d.sha256 || d.checksum)?.slice(0, 16) + "..." })) }
        ];

        res.status(200).json({
            success: true,
            id,
            employee,
            candidate,
            totalStages: 16,
            pipelineStages
        });
    } catch (err) {
        next(err);
    }
};
