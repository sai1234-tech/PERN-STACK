import pool from "../config/db.js";

/**
 * Controlled AI layer.
 * - No external LLM: answers are extracted from approved policy text (retrieval), so every
 *   answer is grounded, cited and reproducible. Analytics/workflow output is rule-based and explainable.
 * - Guardrails (DB-driven) run before any feature; every interaction is logged.
 * - Workflow assistance only SUGGESTS; a human performs the action.
 */

const STOP = new Set(("a an the is are am was were be been of to in on for and or if do does can i my me we our you your it its " +
  "at by with from as that this what how when where which who whom will shall should would could please tell about get have has").split(" "));

const stem = (w) => {
  let s = w;
  if (s.length > 5 && s.endsWith("ing")) s = s.slice(0, -3);
  else if (s.length > 4 && s.endsWith("ed")) s = s.slice(0, -2);
  if (s.length > 3 && s.endsWith("es")) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1);
  if (s.length > 3 && s.endsWith("e")) s = s.slice(0, -1);
  return s;
};
const tokenize = (s = "") =>
  s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);

const HR_WIDE = ["admin", "super_admin", "hr", "hr_admin", "hr_manager", "hr_operations", "leadership", "executive"];
const roleOf = (req) => String(req.user?.role || "employee").toLowerCase();

const log = (req, feature, query, outcome, extra = {}) =>
  pool
    .query(
      `INSERT INTO ai_interaction_logs (feature,user_id,user_role,query,outcome,rule_code,sources,confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [feature, String(req.user?.userId ?? ""), roleOf(req), (query || "").slice(0, 500), outcome,
       extra.rule || null, extra.sources || null, extra.confidence ?? null]
    )
    .catch((e) => console.error("AI log failed:", e.message));

const checkGuardrails = async (req, query) => {
  const role = roleOf(req);
  const { rows } = await pool.query("SELECT * FROM ai_guardrail_rules WHERE is_active");
  for (const r of rows) {
    let hit = false;
    try { hit = new RegExp(r.pattern, "i").test(query); } catch { /* bad pattern ignored */ }
    if (hit && !(r.exempt_roles || []).includes(role)) return r;
  }
  return null;
};

const maskOutput = (t) =>
  t.replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "XXXX-XXXX-XXXX").replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, "XXXXX0000X");

const safe = async (sql, params = [], fallback = []) => {
  try { return (await pool.query(sql, params)).rows; } catch (e) { console.error("AI query:", e.message); return fallback; }
};

// ------------------------------------------------------------------ policy assistant
export const policyAssistant = async (req, res, next) => {
  try {
    const question = String(req.body?.question || "").trim();
    if (question.length < 3 || question.length > 400) {
      return res.status(400).json({ success: false, message: "Question must be 3-400 characters" });
    }
    const rule = await checkGuardrails(req, question);
    if (rule) {
      await log(req, "POLICY_ASSISTANT", question, rule.action === "BLOCK" ? "BLOCKED" : "ESCALATED", { rule: rule.rule_code });
      return res.json({
        success: true,
        outcome: rule.action === "BLOCK" ? "BLOCKED" : "ESCALATED",
        rule_code: rule.rule_code,
        answer: rule.action === "BLOCK"
          ? `I can't help with this request (${rule.description}). Please use the secured HRMS screens or raise a helpdesk ticket.`
          : "This involves a decision about a person, which needs a human decision-maker. Please raise it with HR.",
        sources: []
      });
    }

    const role = roleOf(req);
    const { rows: policies } = await pool.query(
      "SELECT * FROM ai_policy_documents WHERE is_active AND ('all' = ANY(audience) OR $1 = ANY(audience))", [role]);
    const q = [...new Set(tokenize(question))];
    if (!q.length) {
      await log(req, "POLICY_ASSISTANT", question, "NO_ANSWER", { confidence: 0 });
      return res.json({ success: true, outcome: "NO_ANSWER", answer: "Please ask a more specific policy question.", sources: [] });
    }

    const docs = policies.map((p) => ({ p, title: tokenize(p.title + " " + p.category), body: tokenize(p.content) }));
    const idf = (t) => Math.log(1 + docs.length / (1 + docs.filter((d) => d.body.includes(t) || d.title.includes(t)).length));
    const scored = docs.map((d) => {
      let score = 0, matched = 0, maxScore = 0;
      for (const t of q) {
        const w = idf(t);
        maxScore += w * 4;
        const tf = d.body.filter((x) => x === t).length;
        const inTitle = d.title.includes(t);
        if (tf || inTitle) matched++;
        score += w * (Math.min(tf, 3) + (inTitle ? 3 : 0)) / (tf || inTitle ? 1 : 1);
      }
      const confidence = Math.round(Math.min(1, score / maxScore) * 100 * (matched / q.length) * 1.6);
      return { ...d, score, matched, confidence: Math.min(100, confidence) };
    }).filter((d) => d.matched > 0).sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best || best.confidence < 35) {
      await log(req, "POLICY_ASSISTANT", question, "NO_ANSWER", { confidence: best?.confidence || 0 });
      return res.json({
        success: true, outcome: "NO_ANSWER", confidence: best?.confidence || 0,
        answer: "I couldn't find this in the approved policies. Please raise a helpdesk ticket so HR can answer.",
        suggested_route: "/helpdesk", sources: []
      });
    }

    const sentences = best.p.content.split(/(?<=[.!?])\s+/);
    const ranked = sentences
      .map((s, i) => ({ s, i, hits: new Set(tokenize(s).filter((t) => q.includes(t))).size }))
      .filter((x) => x.hits > 0).sort((a, b) => b.hits - a.hits).slice(0, 2).sort((a, b) => a.i - b.i);
    const answer = maskOutput((ranked.length ? ranked.map((x) => x.s) : sentences.slice(0, 2)).join(" "));

    const sources = scored.slice(0, 3).map((d) => ({
      policy_code: d.p.policy_code, title: d.p.title, version: d.p.version, confidence: d.confidence
    }));
    await log(req, "POLICY_ASSISTANT", question, "ANSWERED", { sources: sources.map((s) => s.policy_code), confidence: best.confidence });
    return res.json({
      success: true, outcome: "ANSWERED", confidence: best.confidence, answer, sources,
      disclaimer: "Extracted from approved policy text. Confirm with HR for exceptions."
    });
  } catch (e) { return next(e); }
};

// ------------------------------------------------------------------ intelligent search
export const intelligentSearch = async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2 || q.length > 100) return res.status(400).json({ success: false, message: "q must be 2-100 characters" });
    const role = roleOf(req);
    const tokens = [...new Set(tokenize(q))].slice(0, 6);
    if (!tokens.length) return res.json({ success: true, query: q, results: [] });
    const likes = tokens.map((t) => `%${t}%`);
    const scoreOf = (text) => tokens.filter((t) => text.toLowerCase().includes(t)).length;

    const results = [];
    const scopes = ["policies"];

    const pol = await safe(
      `SELECT policy_code,title,category,content FROM ai_policy_documents
       WHERE is_active AND ('all'=ANY(audience) OR $2=ANY(audience))
         AND (title ILIKE ANY($1) OR content ILIKE ANY($1) OR category ILIKE ANY($1)) LIMIT 30`, [likes, role]);
    pol.forEach((r) => results.push({
      type: "POLICY", title: r.title, subtitle: r.category, route: "/admin/delivery-roadmap",
      score: scoreOf(`${r.title} ${r.category} ${r.content}`) + 1 }));

    if (HR_WIDE.includes(role) || ["manager", "recruiter", "talent_acquisition", "auditor"].includes(role)) {
      if (HR_WIDE.includes(role) || role === "manager") {
        scopes.push("employees");
        const emp = await safe(
          `SELECT employee_code,first_name,last_name,email,department,designation FROM employees
           WHERE first_name ILIKE ANY($1) OR last_name ILIKE ANY($1) OR email ILIKE ANY($1) OR employee_code ILIKE ANY($1)
              OR department ILIKE ANY($1) OR designation ILIKE ANY($1) LIMIT 30`, [likes]);
        emp.forEach((r) => results.push({
          type: "EMPLOYEE", title: `${r.first_name} ${r.last_name}`.trim(), subtitle: `${r.employee_code} · ${r.designation || ""} · ${r.department || ""}`,
          route: "/hr/employees", score: scoreOf(Object.values(r).join(" ")) }));
      }
      if (HR_WIDE.includes(role) || role === "recruiter" || role === "talent_acquisition") {
        scopes.push("candidates");
        const c = await safe(
          `SELECT candidate_id,name,email,skills,status,designation FROM candidates
           WHERE name ILIKE ANY($1) OR email ILIKE ANY($1) OR skills::text ILIKE ANY($1) OR designation ILIKE ANY($1) LIMIT 30`, [likes]);
        c.forEach((r) => results.push({
          type: "CANDIDATE", title: r.name, subtitle: `${r.candidate_id} · ${r.status || ""} · ${r.designation || ""}`,
          route: "/hr/recruitment", score: scoreOf(Object.values(r).join(" ")) }));
      }
      if (HR_WIDE.includes(role)) {
        scopes.push("tickets");
        const t = await safe(
          `SELECT ticket_id,query,status FROM tickets WHERE query ILIKE ANY($1) OR ticket_id ILIKE ANY($1) LIMIT 30`, [likes]);
        t.forEach((r) => results.push({
          type: "TICKET", title: r.ticket_id, subtitle: `${r.status} · ${String(r.query).slice(0, 80)}`,
          route: "/hr/helpdesk", score: scoreOf(`${r.ticket_id} ${r.query}`) }));
      }
    }

    results.sort((a, b) => b.score - a.score);
    const top = results.slice(0, 25);
    await log(req, "SEARCH", q, "SERVED", { confidence: top[0]?.score || 0 });
    return res.json({ success: true, query: q, scopes_searched: scopes, total: results.length, results: top });
  } catch (e) { return next(e); }
};

// ------------------------------------------------------------------ analytics
export const analytics = async (req, res, next) => {
  try {
    const [head, byDept, exits, leavePend, late, tix, bgv, cand] = await Promise.all([
      safe("SELECT count(*)::int n FROM employees WHERE status ILIKE 'active%'"),
      safe("SELECT COALESCE(department,'Unassigned') d, count(*)::int n FROM employees WHERE status ILIKE 'active%' GROUP BY 1 ORDER BY n DESC LIMIT 6"),
      safe("SELECT count(*)::int n FROM resignations WHERE resignation_date >= CURRENT_DATE - INTERVAL '365 days'"),
      safe("SELECT count(*)::int n FROM leaves WHERE status ILIKE 'pending%'"),
      safe("SELECT count(*)::int total, COALESCE(sum(CASE WHEN is_late THEN 1 ELSE 0 END),0)::int late FROM attendance WHERE date >= CURRENT_DATE - INTERVAL '30 days'"),
      safe("SELECT count(*)::int n FROM tickets WHERE status NOT ILIKE 'resolved%' AND status NOT ILIKE 'closed%'"),
      safe("SELECT count(*)::int n FROM bgv WHERE status NOT ILIKE 'clear%' AND status NOT ILIKE 'complete%' AND status NOT ILIKE 'verified%'"),
      safe("SELECT COALESCE(status,'Unknown') s, count(*)::int n FROM candidates GROUP BY 1 ORDER BY n DESC")
    ]);

    const headcount = head[0]?.n ?? 0;
    const exitCount = exits[0]?.n ?? 0;
    const attrition = headcount ? +((exitCount / headcount) * 100).toFixed(1) : 0;
    const att = late[0] || { total: 0, late: 0 };
    const lateRate = att.total ? +((att.late / att.total) * 100).toFixed(1) : 0;

    const insights = [];
    if (headcount) insights.push({ level: attrition > 15 ? "WARN" : "INFO",
      text: `Trailing-12-month attrition is ${attrition}% (${exitCount} exits on ${headcount} active employees).`,
      basis: "resignations in last 365 days ÷ active employees" });
    if (att.total) insights.push({ level: lateRate > 10 ? "WARN" : "INFO",
      text: `${lateRate}% of attendance records in the last 30 days were late (${att.late} of ${att.total}).`,
      basis: "attendance.is_late over 30 days" });
    if ((leavePend[0]?.n || 0) > 0) insights.push({ level: "ACTION",
      text: `${leavePend[0].n} leave request(s) are awaiting approval.`, basis: "leaves with pending status" });
    if ((tix[0]?.n || 0) > 0) insights.push({ level: "ACTION",
      text: `${tix[0].n} helpdesk ticket(s) are still open.`, basis: "tickets not resolved/closed" });
    if ((bgv[0]?.n || 0) > 0) insights.push({ level: "ACTION",
      text: `${bgv[0].n} background verification(s) are not yet cleared.`, basis: "bgv not cleared/complete" });
    if (byDept[0] && headcount) insights.push({ level: "INFO",
      text: `Largest department is ${byDept[0].d} with ${byDept[0].n} people (${((byDept[0].n / headcount) * 100).toFixed(0)}% of headcount).`,
      basis: "active employees grouped by department" });
    if (!insights.length) insights.push({ level: "INFO", text: "Not enough data yet to generate insights.", basis: "-" });

    await log(req, "ANALYTICS", "overview", "SERVED");
    return res.json({
      success: true, generated_at: new Date().toISOString(),
      metrics: { headcount, attrition_pct: attrition, exits_12m: exitCount, late_rate_30d_pct: lateRate,
        pending_leaves: leavePend[0]?.n ?? 0, open_tickets: tix[0]?.n ?? 0, bgv_not_cleared: bgv[0]?.n ?? 0 },
      headcount_by_department: byDept, candidates_by_status: cand, insights
    });
  } catch (e) { return next(e); }
};

// ------------------------------------------------------------------ workflow assistance
export const workflowAssist = async (req, res, next) => {
  try {
    const [leaves, tix, bgv, docs, resign, prob] = await Promise.all([
      safe("SELECT count(*)::int n, COALESCE(max(EXTRACT(DAY FROM now()-applied_at)),0)::int oldest FROM leaves WHERE status ILIKE 'pending%' AND applied_at < now() - INTERVAL '2 days'"),
      safe("SELECT count(*)::int n, COALESCE(max(EXTRACT(DAY FROM now()-created_at)),0)::int oldest FROM tickets WHERE status NOT ILIKE 'resolved%' AND status NOT ILIKE 'closed%' AND created_at < now() - INTERVAL '48 hours'"),
      safe("SELECT count(*)::int n, COALESCE(max(CURRENT_DATE - initiated_date::date),0)::int oldest FROM bgv WHERE status NOT ILIKE 'clear%' AND status NOT ILIKE 'complete%' AND status NOT ILIKE 'verified%' AND initiated_date::date < CURRENT_DATE - 7"),
      safe("SELECT count(*)::int n FROM documents WHERE status ILIKE 'pending%' OR status ILIKE 'requested%'"),
      safe("SELECT count(*)::int n FROM resignations WHERE status ILIKE 'pending%'"),
      safe("SELECT count(*)::int n FROM probation_confirmation_alerts WHERE days_remaining <= 30 AND recommendation_status ILIKE 'pending%'")
    ]);
    const items = [
      { key: "LEAVE", priority: "HIGH", count: leaves[0]?.n, detail: `oldest waiting ${leaves[0]?.oldest ?? 0} day(s)`,
        title: "Leave requests pending over 2 days", suggested_action: "Approve or reject, or reassign to the backup approver", route: "/hr/leaves" },
      { key: "TICKET", priority: "HIGH", count: tix[0]?.n, detail: `oldest open ${tix[0]?.oldest ?? 0} day(s)`,
        title: "Helpdesk tickets beyond 48h", suggested_action: "Respond or escalate per SLA policy", route: "/hr/helpdesk" },
      { key: "BGV", priority: "HIGH", count: bgv[0]?.n, detail: `oldest ${bgv[0]?.oldest ?? 0} day(s) since initiation`,
        title: "BGV beyond 7-day SLA", suggested_action: "Chase the agency and escalate if no update", route: "/hr/automations" },
      { key: "RESIGN", priority: "MEDIUM", count: resign[0]?.n, detail: "awaiting review",
        title: "Resignations awaiting review", suggested_action: "Review and start clearance tasks", route: "/hr/resignations" },
      { key: "PROBATION", priority: "MEDIUM", count: prob[0]?.n, detail: "due within 30 days",
        title: "Probation confirmations due", suggested_action: "Request manager recommendation", route: "/hr/automations" },
      { key: "DOCS", priority: "LOW", count: docs[0]?.n, detail: "pending verification or upload",
        title: "Documents awaiting action", suggested_action: "Verify uploaded documents or send reminders", route: "/hr/documents" }
    ].filter((i) => i.count > 0).map((i) => ({ ...i, requires_human_approval: true }));

    await log(req, "WORKFLOW", "assist", "SERVED");
    return res.json({ success: true, generated_at: new Date().toISOString(),
      note: "Suggestions only – no action is taken automatically.", total_actions: items.length, items });
  } catch (e) { return next(e); }
};

// ------------------------------------------------------------------ governance
export const getGuardrails = async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT rule_code,description,action,exempt_roles,is_active FROM ai_guardrail_rules ORDER BY id");
    return res.json({ success: true, rules: rows });
  } catch (e) { return next(e); }
};

export const getInteractionLogs = async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM ai_interaction_logs ORDER BY created_at DESC LIMIT 100");
    const { rows: stats } = await pool.query(
      "SELECT outcome, count(*)::int n FROM ai_interaction_logs GROUP BY outcome ORDER BY n DESC");
    return res.json({ success: true, stats, logs: rows });
  } catch (e) { return next(e); }
};
