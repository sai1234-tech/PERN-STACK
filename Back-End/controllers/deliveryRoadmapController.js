import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

// Evaluate one deliverable against the running system (no stored status – always live).
const evaluate = async (d) => {
  try {
    if (d.evidence_type === "FILE") {
      const p = path.resolve(REPO_ROOT, d.evidence_ref);
      if (!p.startsWith(REPO_ROOT)) return { live: false, evidence: "invalid path" };
      const ok = fs.existsSync(p);
      return { live: ok, evidence: ok ? `file: ${d.evidence_ref}` : `missing file: ${d.evidence_ref}` };
    }
    if (!/^[a-z_][a-z0-9_]*$/.test(d.evidence_ref)) return { live: false, evidence: "invalid table name" };
    const reg = await pool.query("SELECT to_regclass($1) AS t", [`public.${d.evidence_ref}`]);
    if (!reg.rows[0].t) return { live: false, evidence: `table ${d.evidence_ref} not found` };
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${d.evidence_ref}`);
    const n = rows[0].n;
    return { live: n >= d.min_rows, rows: n, evidence: `${d.evidence_ref}: ${n} rows` };
  } catch (e) {
    return { live: false, evidence: `error: ${e.message}` };
  }
};

const buildRoadmap = async () => {
  const [phases, deliverables, signoffs] = await Promise.all([
    pool.query("SELECT * FROM delivery_phases ORDER BY phase_no"),
    pool.query("SELECT * FROM delivery_deliverables ORDER BY phase_no, sort_order"),
    pool.query("SELECT DISTINCT ON (phase_no) * FROM delivery_phase_signoffs ORDER BY phase_no, signed_at DESC")
  ]);
  const evaluated = await Promise.all(
    deliverables.rows.map(async (d) => ({ ...d, ...(await evaluate(d)), status: undefined }))
  );
  evaluated.forEach((d) => (d.status = d.live ? "DELIVERED" : "PENDING"));

  const out = phases.rows.map((p) => {
    const items = evaluated.filter((d) => d.phase_no === p.phase_no);
    const done = items.filter((d) => d.live).length;
    const so = signoffs.rows.find((s) => s.phase_no === p.phase_no) || null;
    return {
      ...p,
      deliverables: items,
      delivered: done,
      total: items.length,
      completion_pct: items.length ? Math.round((done / items.length) * 100) : 0,
      latest_signoff: so
    };
  });
  return out;
};

export const getRoadmap = async (req, res, next) => {
  try {
    const phases = await buildRoadmap();
    const total = phases.reduce((a, p) => a + p.total, 0);
    const delivered = phases.reduce((a, p) => a + p.delivered, 0);
    const [polRes, guardRes, logRes] = await Promise.all([
      pool.query("SELECT count(*)::int AS n FROM ai_policy_documents WHERE is_active").catch(() => ({ rows: [{ n: 0 }] })),
      pool.query("SELECT count(*)::int AS n FROM ai_guardrail_rules WHERE is_active").catch(() => ({ rows: [{ n: 0 }] })),
      pool.query("SELECT count(*)::int AS n FROM ai_interaction_logs").catch(() => ({ rows: [{ n: 0 }] }))
    ]);
    return res.json({
      success: true,
      generated_at: new Date().toISOString(),
      overall: {
        delivered,
        total,
        completion_pct: total ? Math.round((delivered / total) * 100) : 0
      },
      telemetry: {
        total_phases: phases.length,
        policy_count: polRes.rows[0]?.n || 0,
        guardrail_count: guardRes.rows[0]?.n || 0,
        log_count: logRes.rows[0]?.n || 0
      },
      phases
    });
  } catch (e) {
    return next(e);
  }
};

export const signOffPhase = async (req, res, next) => {
  try {
    const phaseNo = Number(req.params.phaseNo);
    const { decision = "APPROVED", comments = "" } = req.body || {};
    if (!["APPROVED", "REJECTED"].includes(decision)) {
      return res.status(400).json({ success: false, message: "decision must be APPROVED or REJECTED" });
    }
    const phases = await buildRoadmap();
    const phase = phases.find((p) => p.phase_no === phaseNo);
    if (!phase) return res.status(404).json({ success: false, message: "Phase not found" });
    if (decision === "APPROVED" && phase.delivered < phase.total) {
      return res.status(409).json({
        success: false,
        message: `Cannot approve: ${phase.total - phase.delivered} deliverable(s) are still pending`,
        pending: phase.deliverables.filter((d) => !d.live).map((d) => d.deliverable_code)
      });
    }
    const u = await pool.query("SELECT name FROM users WHERE id = $1", [req.user.userId]);
    const name = u.rows[0]?.name || "unknown";
    const { rows } = await pool.query(
      `INSERT INTO delivery_phase_signoffs (phase_no, decision, signed_by_id, signed_by_name, signed_by_role, comments)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [phaseNo, decision, String(req.user.userId), name, req.user.role, comments]
    );
    await pool.query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, details, user_name, user_role, ip_address)
       VALUES ($1,'DELIVERY_PHASE',$2,$3,$4,$5,$6)`,
      [`PHASE_${decision}`, String(phaseNo), comments || `Phase ${phaseNo} ${decision}`, name, req.user.role, req.ip]
    );
    return res.status(201).json({ success: true, signoff: rows[0] });
  } catch (e) {
    return next(e);
  }
};

export const createPhase = async (req, res, next) => {
  try {
    const { phase_no, name, scope, outcome } = req.body || {};
    const phaseNo = Number(phase_no);
    if (isNaN(phaseNo) || !name || !scope || !outcome) {
      return res.status(400).json({ success: false, message: "phase_no, name, scope, and outcome are required" });
    }
    const existing = await pool.query("SELECT id FROM delivery_phases WHERE phase_no = $1", [phaseNo]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: `Phase ${phaseNo} already exists` });
    }
    const { rows } = await pool.query(
      `INSERT INTO delivery_phases (phase_no, name, scope, outcome)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [phaseNo, name.trim(), scope.trim(), outcome.trim()]
    );
    const u = await pool.query("SELECT name FROM users WHERE id = $1", [req.user.userId]);
    const userName = u.rows[0]?.name || "HR Admin";
    await pool.query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, details, user_name, user_role, ip_address)
       VALUES ('CREATE_DELIVERY_PHASE', 'DELIVERY_PHASE', $1, $2, $3, $4, $5)`,
      [String(phaseNo), `Created phase ${phaseNo}: ${name}`, userName, req.user.role, req.ip]
    );
    return res.status(201).json({ success: true, phase: rows[0] });
  } catch (e) {
    return next(e);
  }
};

export const createDeliverable = async (req, res, next) => {
  try {
    const { phase_no, deliverable_code, title, description, evidence_type, evidence_ref, min_rows = 1, ui_route, api_route } = req.body || {};
    const phaseNo = Number(phase_no);
    if (isNaN(phaseNo) || !deliverable_code || !title || !evidence_type || !evidence_ref) {
      return res.status(400).json({ success: false, message: "phase_no, deliverable_code, title, evidence_type, and evidence_ref are required" });
    }
    if (!["TABLE", "FILE"].includes(evidence_type)) {
      return res.status(400).json({ success: false, message: "evidence_type must be TABLE or FILE" });
    }
    const phaseCheck = await pool.query("SELECT id FROM delivery_phases WHERE phase_no = $1", [phaseNo]);
    if (phaseCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Phase ${phaseNo} not found` });
    }
    const codeCheck = await pool.query("SELECT id FROM delivery_deliverables WHERE deliverable_code = $1", [deliverable_code.trim().toUpperCase()]);
    if (codeCheck.rows.length > 0) {
      return res.status(409).json({ success: false, message: `Deliverable code ${deliverable_code} already exists` });
    }
    const sortRes = await pool.query("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort FROM delivery_deliverables WHERE phase_no = $1", [phaseNo]);
    const sortOrder = sortRes.rows[0]?.next_sort || 1;
    const { rows } = await pool.query(
      `INSERT INTO delivery_deliverables (phase_no, deliverable_code, title, description, evidence_type, evidence_ref, min_rows, ui_route, api_route, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [phaseNo, deliverable_code.trim().toUpperCase(), title.trim(), description || "", evidence_type, evidence_ref.trim(), Number(min_rows) || 1, ui_route || null, api_route || null, sortOrder]
    );
    const u = await pool.query("SELECT name FROM users WHERE id = $1", [req.user.userId]);
    const userName = u.rows[0]?.name || "HR Admin";
    await pool.query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, details, user_name, user_role, ip_address)
       VALUES ('CREATE_DELIVERY_DELIVERABLE', 'DELIVERY_DELIVERABLE', $1, $2, $3, $4, $5)`,
      [deliverable_code.trim().toUpperCase(), `Created deliverable ${deliverable_code}: ${title} in Phase ${phaseNo}`, userName, req.user.role, req.ip]
    );
    return res.status(201).json({ success: true, deliverable: rows[0] });
  } catch (e) {
    return next(e);
  }
};

export const deletePhase = async (req, res, next) => {
  try {
    const phaseNo = Number(req.params.phaseNo);
    if (isNaN(phaseNo)) return res.status(400).json({ success: false, message: "Invalid phase number" });
    await pool.query("DELETE FROM delivery_phase_signoffs WHERE phase_no = $1", [phaseNo]);
    await pool.query("DELETE FROM delivery_deliverables WHERE phase_no = $1", [phaseNo]);
    const { rowCount } = await pool.query("DELETE FROM delivery_phases WHERE phase_no = $1", [phaseNo]);
    if (rowCount === 0) return res.status(404).json({ success: false, message: `Phase ${phaseNo} not found` });
    const u = await pool.query("SELECT name FROM users WHERE id = $1", [req.user.userId]);
    const userName = u.rows[0]?.name || "HR Admin";
    await pool.query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, details, user_name, user_role, ip_address)
       VALUES ('DELETE_DELIVERY_PHASE', 'DELIVERY_PHASE', $1, $2, $3, $4, $5)`,
      [String(phaseNo), `Deleted phase ${phaseNo} and its deliverables`, userName, req.user.role, req.ip]
    );
    return res.json({ success: true, message: `Phase ${phaseNo} removed successfully` });
  } catch (e) {
    return next(e);
  }
};

export const deleteDeliverable = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid deliverable ID" });
    const check = await pool.query("SELECT deliverable_code, phase_no, title FROM delivery_deliverables WHERE id = $1", [id]);
    if (check.rows.length === 0) return res.status(404).json({ success: false, message: "Deliverable not found" });
    const d = check.rows[0];
    await pool.query("DELETE FROM delivery_deliverables WHERE id = $1", [id]);
    const u = await pool.query("SELECT name FROM users WHERE id = $1", [req.user.userId]);
    const userName = u.rows[0]?.name || "HR Admin";
    await pool.query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, details, user_name, user_role, ip_address)
       VALUES ('DELETE_DELIVERY_DELIVERABLE', 'DELIVERY_DELIVERABLE', $1, $2, $3, $4, $5)`,
      [d.deliverable_code, `Deleted deliverable ${d.deliverable_code} (${d.title}) from Phase ${d.phase_no}`, userName, req.user.role, req.ip]
    );
    return res.json({ success: true, message: `Deliverable ${d.deliverable_code} removed successfully` });
  } catch (e) {
    return next(e);
  }
};
