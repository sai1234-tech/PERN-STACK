import fs from "fs";
import path from "path";
import crypto from "crypto";
import pool from "../config/db.js";
import { onboardCandidate } from "./candidateController.js";
import { updateCandidateStatusRecord } from "../repositories/candidateRepository.js";

/**
 * Additive lifecycle operations. Nothing here edits or replaces existing modules; existing
 * handlers/repositories are reused where they already do the job.
 */

const EXIT_DIR = path.join(process.cwd(), "uploads", "exit-documents");
const code = (p) => `${p}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
const lc = (v) => String(v || "").toLowerCase();
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const actor = async (req) => {
  const { rows } = await pool.query("SELECT id, name, email, role FROM users WHERE id = $1", [req.user.userId]);
  const emp = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.userId]);
  return { ...(rows[0] || { id: req.user.userId, name: "unknown", role: req.user.role }), employeeId: emp.rows[0]?.id ?? null };
};

const audit = async (a, req, action, entityType, entityId, details) =>
  pool.query(
    `INSERT INTO audit_logs (action, entity_type, entity_id, details, user_name, user_role, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [action, entityType, String(entityId), details, a.name, a.role, req.ip || ""]
  );

// ------------------------------------------------------------------ 1. PREBOARDING
const PREBOARDING_TASKS = [
  { t: "Collect statutory documents (Aadhaar, PAN, education, relieving letter)", c: "Documents", o: "hr", d: 3 },
  { t: "Initiate background verification", c: "BGV", o: "hr", d: 1 },
  { t: "Provision laptop, email and access", c: "IT", o: "it_admin", d: 5 },
  { t: "Confirm joining date and send joining kit", c: "HR", o: "hr", d: 2 }
];

export const startPreboarding = async (req, res, next) => {
  try {
    const a = await actor(req);
    const { rows } = await pool.query("SELECT * FROM candidates WHERE candidate_id = $1", [req.params.id]);
    const cand = rows[0];
    if (!cand) return res.status(404).json({ success: false, message: "Candidate not found" });
    if (cand.onboarded_employee_id) return res.status(409).json({ success: false, message: "Candidate already onboarded" });
    if (!["selected", "offered", "offer accepted"].includes(lc(cand.status))) {
      return res.status(409).json({ success: false, message: `Only Selected / Offered / Offer Accepted candidates can enter preboarding (current: ${cand.status})` });
    }
    await updateCandidateStatusRecord(cand.candidate_id, "Preboarding");
    for (const [i, t] of PREBOARDING_TASKS.entries()) {
      await pool.query(
        `INSERT INTO preboarding_tasks (task_code, candidate_id, title, category, owner_role, due_date)
         VALUES ($1,$2,$3,$4,$5, CURRENT_DATE + $6::int) ON CONFLICT (task_code) DO NOTHING`,
        [`PRE-${cand.candidate_id}-${i + 1}`, cand.candidate_id, t.t, t.c, t.o, t.d]
      );
    }
    await audit(a, req, "PREBOARDING_STARTED", "Candidate", cand.candidate_id, `Candidate moved from ${cand.status} to Preboarding`);
    const tasks = (await pool.query("SELECT * FROM preboarding_tasks WHERE candidate_id=$1 ORDER BY id", [cand.candidate_id])).rows;
    return res.status(201).json({ success: true, candidateId: cand.candidate_id, status: "Preboarding", tasks });
  } catch (e) { return next(e); }
};

export const getPreboarding = async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM preboarding_tasks WHERE candidate_id=$1 ORDER BY id", [req.params.id]);
    return res.json({ success: true, tasks: rows });
  } catch (e) { return next(e); }
};

export const updatePreboardingTask = async (req, res, next) => {
  try {
    const a = await actor(req);
    const status = req.body?.status;
    if (!["Pending", "Completed", "Waived"].includes(status)) return res.status(400).json({ success: false, message: "status must be Pending, Completed or Waived" });
    const { rows } = await pool.query(
      `UPDATE preboarding_tasks SET status=$1, completed_at = CASE WHEN $1='Pending' THEN NULL ELSE NOW() END,
              completed_by = CASE WHEN $1='Pending' THEN NULL ELSE $2 END WHERE id=$3 RETURNING *`,
      [status, a.name, req.params.taskId]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: "Task not found" });
    await audit(a, req, "PREBOARDING_TASK_UPDATED", "PreboardingTask", rows[0].task_code, `Status set to ${status}`);
    return res.json({ success: true, task: rows[0] });
  } catch (e) { return next(e); }
};

// ------------------------------------------------------------------ 2. GUARDED ONBOARDING (reuses existing handler)
export const onboardingGate = async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM candidates WHERE candidate_id = $1", [req.params.id]);
    const cand = rows[0];
    if (!cand) return res.status(404).json({ success: false, message: "Candidate not found" });
    const blockers = [];
    if (lc(cand.status) !== "preboarding") blockers.push(`Candidate must be in Preboarding (current: ${cand.status})`);
    const tasks = (await pool.query("SELECT * FROM preboarding_tasks WHERE candidate_id=$1", [cand.candidate_id])).rows;
    if (!tasks.length) blockers.push("No preboarding tasks exist");
    tasks.filter((t) => t.status === "Pending").forEach((t) => blockers.push(`Open preboarding task: ${t.title}`));
    if (!["verified", "cleared"].includes(lc(cand.bgv_status))) blockers.push(`BGV must be Verified/Cleared (current: ${cand.bgv_status})`);
    if (blockers.length) return res.status(409).json({ success: false, message: "Onboarding blocked", blockers });
    return next();
  } catch (e) { return next(e); }
};
export const completeOnboarding = onboardCandidate; // existing logic, run only after the gate passes

// ------------------------------------------------------------------ 3. ATTENDANCE REGULARIZATION
export const submitRegularization = async (req, res, next) => {
  try {
    const a = await actor(req);
    if (!a.employeeId) return res.status(404).json({ success: false, message: "Employee profile not found" });
    const { date, checkIn, checkOut, reason, status = "present" } = req.body || {};
    if (!date || !checkIn || !checkOut) return res.status(400).json({ success: false, message: "date, checkIn and checkOut are required" });
    if (!reason || reason.trim().length < 10) return res.status(400).json({ success: false, message: "A reason of at least 10 characters is required" });
    if (!["present", "half-day"].includes(status)) return res.status(400).json({ success: false, message: "status must be present or half-day" });
    const d = new Date(date), today = new Date(); today.setHours(0, 0, 0, 0);
    if (Number.isNaN(d.getTime()) || d >= new Date(today.getTime() + 0)) return res.status(400).json({ success: false, message: "Regularization is only allowed for past dates" });
    if ((today - d) / 86400000 > 30) return res.status(400).json({ success: false, message: "Regularization window is 30 days" });
    const ci = new Date(checkIn), co = new Date(checkOut);
    if (Number.isNaN(ci.getTime()) || Number.isNaN(co.getTime()) || co <= ci) return res.status(400).json({ success: false, message: "checkOut must be after checkIn" });
    try {
      const { rows } = await pool.query(
        `INSERT INTO attendance_regularizations (reg_code, employee_id, attendance_date, requested_check_in, requested_check_out, requested_status, reason, requested_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [code("REG"), a.employeeId, date, ci, co, status, reason.trim(), a.id]
      );
      await audit(a, req, "REGULARIZATION_SUBMITTED", "Attendance", rows[0].reg_code, `${date}: ${reason.trim()}`);
      return res.status(201).json({ success: true, data: rows[0] });
    } catch (e) {
      if (e.code === "23505") return res.status(409).json({ success: false, message: "A pending regularization already exists for this date" });
      throw e;
    }
  } catch (e) { return next(e); }
};

export const getMyRegularizations = async (req, res, next) => {
  try {
    const a = await actor(req);
    const { rows } = await pool.query("SELECT * FROM attendance_regularizations WHERE employee_id=$1 ORDER BY id DESC", [a.employeeId]);
    return res.json({ success: true, data: rows });
  } catch (e) { return next(e); }
};

export const listRegularizations = async (req, res, next) => {
  try {
    const a = await actor(req);
    const role = lc(a.role);
    const params = [];
    let where = "";
    if (req.query.status) { params.push(String(req.query.status).toUpperCase()); where = `WHERE r.status = $${params.length}`; }
    if (role === "manager") {
      params.push(a.employeeId);
      where += `${where ? " AND" : "WHERE"} e.reports_to = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT r.*, e.employee_code, e.first_name, e.last_name FROM attendance_regularizations r JOIN employees e ON e.id = r.employee_id ${where} ORDER BY r.id DESC`, params);
    return res.json({ success: true, data: rows });
  } catch (e) { return next(e); }
};

export const decideRegularization = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const a = await actor(req);
    const { decision, comments } = req.body || {};
    if (!["APPROVED", "REJECTED"].includes(decision)) { client.release(); return res.status(400).json({ success: false, message: "decision must be APPROVED or REJECTED" }); }
    if (!comments || !comments.trim()) { client.release(); return res.status(400).json({ success: false, message: "Decision comments are mandatory" }); }
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT r.*, e.reports_to FROM attendance_regularizations r JOIN employees e ON e.id=r.employee_id WHERE r.id=$1 FOR UPDATE OF r", [req.params.id]);
    const r = rows[0];
    if (!r) { await client.query("ROLLBACK"); client.release(); return res.status(404).json({ success: false, message: "Request not found" }); }
    if (r.status !== "PENDING") { await client.query("ROLLBACK"); client.release(); return res.status(409).json({ success: false, message: `Already ${r.status}` }); }
    if (a.employeeId && Number(a.employeeId) === Number(r.employee_id)) { await client.query("ROLLBACK"); client.release(); return res.status(403).json({ success: false, message: "You cannot decide your own request" }); }
    if (lc(a.role) === "manager" && Number(r.reports_to) !== Number(a.employeeId)) { await client.query("ROLLBACK"); client.release(); return res.status(403).json({ success: false, message: "Only the reporting manager, HR or admin can decide" }); }

    let before = null, after = null;
    if (decision === "APPROVED") {
      before = (await client.query("SELECT * FROM attendance WHERE employee_id=$1 AND date=$2", [r.employee_id, r.attendance_date])).rows[0] || null;
      const hours = Math.round(((new Date(r.requested_check_out) - new Date(r.requested_check_in)) / 3600000) * 100) / 100;
      after = (await client.query(
        `INSERT INTO attendance (employee_id, date, check_in, check_out, working_hours, status, is_late, late_minutes, remarks)
         VALUES ($1,$2,$3,$4,$5,$6,false,0,$7)
         ON CONFLICT (employee_id, date) DO UPDATE SET check_in=EXCLUDED.check_in, check_out=EXCLUDED.check_out,
           working_hours=EXCLUDED.working_hours, status=EXCLUDED.status, is_late=false, late_minutes=0, remarks=EXCLUDED.remarks, updated_at=NOW()
         RETURNING *`,
        [r.employee_id, r.attendance_date, r.requested_check_in, r.requested_check_out, hours, r.requested_status, `Regularized ${r.reg_code}: ${r.reason}`]
      )).rows[0];
    }
    const upd = (await client.query(
      `UPDATE attendance_regularizations SET status=$1, decided_by_user_id=$2, decided_by_name=$3, decided_by_role=$4,
         decision_comments=$5, decided_at=NOW(), before_snapshot=$6, after_snapshot=$7 WHERE id=$8 RETURNING *`,
      [decision, a.id, a.name, a.role, comments.trim(), before, after, r.id]
    )).rows[0];
    await client.query("COMMIT");
    await audit(a, req, `REGULARIZATION_${decision}`, "Attendance", r.reg_code, `${comments.trim()} | before=${JSON.stringify(before)}`);
    client.release();
    return res.json({ success: true, data: upd });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    client.release();
    return next(e);
  }
};

// ------------------------------------------------------------------ 4. PAYROLL INPUTS (real calculation)
const weekdaysBetween = (from, to) => {
  let n = 0;
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) { const w = d.getDay(); if (w !== 0 && w !== 6) n++; }
  return n;
};
const round2 = (n) => Math.round(n * 100) / 100;

export const generatePayrollInputs = async (req, res, next) => {
  try {
    const a = await actor(req);
    const m = /^(\d{4})-(\d{2})$/.exec(String(req.body?.month || ""));
    if (!m) return res.status(400).json({ success: false, message: "month must be YYYY-MM" });
    const year = Number(m[1]), mon = Number(m[2]);
    if (mon < 1 || mon > 12) return res.status(400).json({ success: false, message: "Invalid month" });
    const label = `${MONTHS[mon - 1]} ${year}`;
    const start = new Date(Date.UTC(year, mon - 1, 1)), end = new Date(Date.UTC(year, mon, 0));
    const daysInMonth = end.getUTCDate();
    const s = start.toISOString().slice(0, 10), e = end.toISOString().slice(0, 10);

    const ids = Array.isArray(req.body?.employeeIds) ? req.body.employeeIds.map(Number).filter(Boolean) : null;
    const emps = (ids
      ? await pool.query("SELECT * FROM employees WHERE id = ANY($1)", [ids])
      : await pool.query("SELECT * FROM employees WHERE status ILIKE 'active%'")).rows;

    const created = [], skipped = [];
    for (const emp of emps) {
      const annual = Number(emp.employment?.salary || 0);
      if (!annual) { skipped.push({ employeeCode: emp.employee_code, reason: "No salary on employment record" }); continue; }
      const inputCode = `PIN-${emp.employee_code}-${year}-${String(mon).padStart(2, "0")}`;
      const foreign = await pool.query("SELECT input_code FROM payroll_inputs WHERE employee_id=$1 AND month=$2 AND input_code <> $3 LIMIT 1", [emp.id, label, inputCode]);
      if (foreign.rows.length) { skipped.push({ employeeCode: emp.employee_code, reason: `Input already exists (${foreign.rows[0].input_code})` }); continue; }

      const monthlyGross = annual / 12;
      const basic = monthlyGross * 0.5, hra = basic * 0.5, special = monthlyGross - basic - hra;
      const pf = Math.min(basic, 15000) * 0.12;

      const leaves = (await pool.query(
        `SELECT l.start_date, l.end_date, COALESCE(t.is_paid,true) AS is_paid FROM leaves l LEFT JOIN leave_types t ON t.id=l.leave_type_id
         WHERE l.employee_id=$1 AND l.status='Approved' AND l.start_date <= $3 AND l.end_date >= $2`, [emp.id, s, e])).rows;
      const covered = new Set();
      let unpaidDays = 0;
      for (const l of leaves) {
        const from = new Date(Math.max(new Date(l.start_date), start)), to = new Date(Math.min(new Date(l.end_date), end));
        for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
          if (d.getDay() === 0 || d.getDay() === 6) continue;
          covered.add(d.toISOString().slice(0, 10));
        }
        if (!l.is_paid) unpaidDays += weekdaysBetween(from, to);
      }
      const absent = (await pool.query("SELECT date FROM attendance WHERE employee_id=$1 AND status='absent' AND date BETWEEN $2 AND $3", [emp.id, s, e])).rows
        .map((r) => new Date(r.date).toISOString().slice(0, 10)).filter((d) => !covered.has(d)).length;
      const lopDays = unpaidDays + absent;
      const otHours = Number((await pool.query("SELECT COALESCE(SUM(overtime_hours),0) AS h FROM attendance WHERE employee_id=$1 AND date BETWEEN $2 AND $3", [emp.id, s, e])).rows[0].h);
      const overtime = otHours * (basic / (daysInMonth * 8)) * 2;
      const lopAmt = lopDays * (monthlyGross / daysInMonth);
      const gross = basic + hra + special + overtime;
      const net = gross - pf - lopAmt;

      const { rows } = await pool.query(
        `INSERT INTO payroll_inputs (input_code, employee_id, employee_code, employee_name, month, year, basic_pay, hra, special_allowance,
           overtime_allowance, pf_deduction, tax_deduction, unpaid_leave_deductions, gross_earnings, net_payable, status, remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,$12,$13,$14,'Draft',$15)
         ON CONFLICT (input_code) DO UPDATE SET basic_pay=EXCLUDED.basic_pay, hra=EXCLUDED.hra, special_allowance=EXCLUDED.special_allowance,
           overtime_allowance=EXCLUDED.overtime_allowance, pf_deduction=EXCLUDED.pf_deduction, unpaid_leave_deductions=EXCLUDED.unpaid_leave_deductions,
           gross_earnings=EXCLUDED.gross_earnings, net_payable=EXCLUDED.net_payable, remarks=EXCLUDED.remarks
         WHERE payroll_inputs.status = 'Draft' RETURNING *`,
        [inputCode, emp.id, emp.employee_code, `${emp.first_name} ${emp.last_name}`.trim(), label, year, round2(basic), round2(hra), round2(special),
          round2(overtime), round2(pf), round2(lopAmt), round2(gross), round2(net),
          `Generated from salary ${annual}/yr; LOP days ${lopDays} (unpaid leave ${unpaidDays}, absent ${absent}); OT hours ${otHours}. TDS to be applied by payroll vendor.`]
      );
      if (!rows[0]) { skipped.push({ employeeCode: emp.employee_code, reason: "Existing input is no longer Draft (locked)" }); continue; }
      created.push({ ...rows[0], lop_days: lopDays });
    }
    await audit(a, req, "PAYROLL_INPUTS_GENERATED", "PayrollInput", label, `${created.length} generated, ${skipped.length} skipped`);
    return res.status(201).json({ success: true, month: label, generated: created.length, skipped, data: created });
  } catch (e) { return next(e); }
};

export const listPayrollInputs = async (req, res, next) => {
  try {
    const m = /^(\d{4})-(\d{2})$/.exec(String(req.query.month || ""));
    if (!m) return res.status(400).json({ success: false, message: "month must be YYYY-MM" });
    const label = `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
    const { rows } = await pool.query("SELECT * FROM payroll_inputs WHERE month=$1 ORDER BY employee_code", [label]);
    return res.json({ success: true, month: label, data: rows });
  } catch (e) { return next(e); }
};

// ------------------------------------------------------------------ 5. EXIT DOCUMENTS
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
const page = (title, body, ref) => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:Georgia,serif;max-width:720px;margin:48px auto;line-height:1.6;color:#111}h1{font-size:20px;text-align:center;letter-spacing:.05em}
.ref{font-size:12px;color:#555;text-align:right}table{border-collapse:collapse;width:100%}td{border:1px solid #bbb;padding:6px 10px}footer{margin-top:48px;font-size:11px;color:#666}</style></head>
<body><div class="ref">Ref: ${esc(ref)}<br>Date: ${fmt(new Date())}</div><h1>${esc(title)}</h1>${body}
<footer>This is a system-generated document. Verify authenticity using reference ${esc(ref)}.</footer></body></html>`;

export const generateExitDocuments = async (req, res, next) => {
  try {
    const a = await actor(req);
    const clearanceId = Number(req.body?.clearanceId);
    if (!clearanceId) return res.status(400).json({ success: false, message: "clearanceId is required" });
    const c = (await pool.query("SELECT * FROM clearances WHERE id=$1", [clearanceId])).rows[0];
    if (!c) return res.status(404).json({ success: false, message: "Clearance not found" });
    const r = (await pool.query("SELECT * FROM resignations WHERE id=$1", [c.resignation_id])).rows[0];
    const e = (await pool.query("SELECT * FROM employees WHERE id=$1", [c.employee_id])).rows[0];
    if (!r || !e) return res.status(404).json({ success: false, message: "Resignation or employee not found" });

    const blockers = [];
    if (lc(r.status) !== "approved") blockers.push(`Resignation must be approved (current: ${r.status})`);
    for (const k of ["assets", "it_access", "finance", "leave_attendance", "documents"]) {
      if (lc(c[k]?.status) !== "cleared") blockers.push(`Clearance '${k}' is ${c[k]?.status || "pending"}`);
    }
    if (lc(c.final_settlement?.status) !== "processed") blockers.push("Final settlement has not been processed");
    if (blockers.length) return res.status(409).json({ success: false, message: "Exit documents blocked", blockers });

    const lwd = r.approved_last_working_day || r.requested_last_working_day;
    const name = `${e.first_name} ${e.last_name}`.trim();
    const designation = e.employment?.designation || e.designation, dept = e.employment?.department || e.department;
    const co = e.entity || "Quadratic Systems Inc.";
    const lastInput = (await pool.query("SELECT month, gross_earnings, net_payable, status FROM payroll_inputs WHERE employee_id=$1 ORDER BY id DESC LIMIT 1", [e.id])).rows[0];

    const docs = {
      RELIEVING_LETTER: (ref) => page("Relieving Letter", `<p>This is to certify that <b>${esc(name)}</b> (Employee ID ${esc(e.employee_code)}), ${esc(designation)}, ${esc(dept)}, has been relieved from the services of ${esc(co)} with effect from the close of business on <b>${fmt(lwd)}</b>, following acceptance of the resignation submitted on ${fmt(r.resignation_date)}.</p><p>All company assets and access have been cleared as recorded in the exit clearance. We wish you success in your future endeavours.</p>`, ref),
      EXPERIENCE_CERTIFICATE: (ref) => page("Experience Certificate", `<p>This is to certify that <b>${esc(name)}</b> (Employee ID ${esc(e.employee_code)}) was employed with ${esc(co)} from <b>${fmt(e.joining_date)}</b> to <b>${fmt(lwd)}</b> as <b>${esc(designation)}</b> in the ${esc(dept)} department.</p><p>This certificate is issued on request and states employment facts only.</p>`, ref),
      FNF_STATEMENT: (ref) => page("Full &amp; Final Settlement Statement", `<table><tr><td>Employee</td><td>${esc(name)} (${esc(e.employee_code)})</td></tr><tr><td>Last working day</td><td>${fmt(lwd)}</td></tr><tr><td>Settlement status</td><td>${esc(c.final_settlement?.status)} on ${fmt(c.final_settlement?.processedAt)}</td></tr><tr><td>Settlement details recorded</td><td>${esc(c.final_settlement?.details || "—")}</td></tr><tr><td>Latest payroll input</td><td>${lastInput ? `${esc(lastInput.month)} — gross ${esc(lastInput.gross_earnings)}, net ${esc(lastInput.net_payable)} (${esc(lastInput.status)})` : "None on record"}</td></tr></table><p>Amounts are as recorded in the system; no figures have been estimated.</p>`, ref)
    };

    fs.mkdirSync(EXIT_DIR, { recursive: true });
    const issued = [];
    for (const [type, build] of Object.entries(docs)) {
      const existing = (await pool.query("SELECT * FROM exit_documents WHERE clearance_id=$1 AND doc_type=$2", [c.id, type])).rows[0];
      if (existing) { issued.push({ ...existing, reused: true }); continue; }
      const docCode = code(type === "FNF_STATEMENT" ? "FNF" : type === "RELIEVING_LETTER" ? "REL" : "EXP");
      const html = build(docCode);
      const file = path.join(EXIT_DIR, `${docCode}.html`);
      fs.writeFileSync(file, html);
      const sha = crypto.createHash("sha256").update(html).digest("hex");
      const row = (await pool.query(
        `INSERT INTO exit_documents (doc_code, employee_id, clearance_id, doc_type, file_path, sha256, issued_by_user_id, issued_by_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [docCode, e.id, c.id, type, file, sha, a.id, a.name])).rows[0];
      issued.push(row);
    }
    const rel = issued.find((d) => d.doc_type === "RELIEVING_LETTER");
    await pool.query("UPDATE clearances SET relieving_letter=$1, updated_at=NOW() WHERE id=$2",
      [JSON.stringify({ issued: true, issuedAt: new Date().toISOString(), documentUrl: `/api/lifecycle-ops/exit-documents/${rel.id}/download` }), c.id]);
    await audit(a, req, "EXIT_DOCUMENTS_ISSUED", "Employee", e.employee_code, issued.map((d) => d.doc_code).join(", "));
    return res.status(201).json({ success: true, data: issued.map(({ file_path, ...d }) => d) });
  } catch (err) { return next(err); }
};

export const listExitDocuments = async (req, res, next) => {
  try {
    const a = await actor(req);
    const empId = Number(req.params.employeeId);
    if (!["hr", "admin", "super_admin"].includes(lc(a.role)) && Number(a.employeeId) !== empId) return res.status(403).json({ success: false, message: "Not allowed" });
    const { rows } = await pool.query("SELECT id, doc_code, employee_id, clearance_id, doc_type, sha256, issued_by_name, issued_at FROM exit_documents WHERE employee_id=$1 ORDER BY id", [empId]);
    return res.json({ success: true, data: rows });
  } catch (e) { return next(e); }
};

export const downloadExitDocument = async (req, res, next) => {
  try {
    const a = await actor(req);
    const d = (await pool.query("SELECT * FROM exit_documents WHERE id=$1", [req.params.id])).rows[0];
    if (!d) return res.status(404).json({ success: false, message: "Document not found" });
    const allowed = ["hr", "admin", "super_admin"].includes(lc(a.role)) || Number(a.employeeId) === Number(d.employee_id);
    await pool.query(
      `INSERT INTO document_governance_audit (document_id, document_name, document_category, employee_id, user_id, user_name, user_role, action_type, access_granted, denial_reason, ip_address)
       VALUES ($1,$2,'SEPARATION_FULL_FINAL',$3,$4,$5,$6,'DOWNLOAD_REQUESTED',$7,$8,$9)`,
      [d.id, d.doc_code, d.employee_id, a.id, a.email || a.name, a.role, allowed, allowed ? "" : "Not owner / not HR", req.ip || ""]
    );
    if (!allowed) return res.status(403).json({ success: false, message: "Not allowed" });
    const html = fs.readFileSync(d.file_path, "utf-8");
    if (crypto.createHash("sha256").update(html).digest("hex") !== d.sha256) return res.status(500).json({ success: false, message: "Document integrity check failed" });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Document-SHA256", d.sha256);
    return res.send(html);
  } catch (e) { return next(e); }
};
