import "dotenv/config";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

const base = "http://127.0.0.1:5005/api/delivery";
const tokenFor = (u) => jwt.sign({ userId: u.id, email: u.email, role: u.role }, process.env.JWT_SECRET || "default_jwt_secret", { expiresIn: "1h" });
const call = async (token, method, path, body) => {
  const r = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
let fails = 0;
const check = (name, ok, info = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${info}`); if (!ok) fails++; };

const admin = (await pool.query("SELECT id,email,role FROM users WHERE role IN ('admin','super_admin') LIMIT 1")).rows[0];
const emp = (await pool.query("SELECT id,email,role FROM users WHERE role='employee' AND is_active IS NOT FALSE LIMIT 1")).rows[0];
const A = tokenFor(admin);

let r = await call(A, "GET", "/roadmap");
check("roadmap 200", r.status === 200, `overall ${r.data.overall?.delivered}/${r.data.overall?.total}`);
r.data.phases?.forEach((p) => console.log(`   Phase ${p.phase_no} ${p.name}: ${p.delivered}/${p.total} (${p.completion_pct}%)  pending: ${p.deliverables.filter((d) => !d.live).map((d) => d.deliverable_code).join(",") || "-"}`));

r = await call(A, "POST", "/ai/policy-assistant", { question: "How many days of notice period do I need to serve after resignation?" });
check("policy answer grounded", r.data.outcome === "ANSWERED" && r.data.sources?.[0]?.policy_code === "POL-NOTICE", `${r.data.outcome} ${r.data.sources?.[0]?.policy_code} conf=${r.data.confidence}`);
console.log("   →", r.data.answer);
r = await call(A, "POST", "/ai/policy-assistant", { question: "Can leaves carry forward to next year?" });
check("leave policy answer", r.data.sources?.[0]?.policy_code === "POL-LEAVE", `${r.data.outcome} ${r.data.sources?.[0]?.policy_code}`);
r = await call(A, "POST", "/ai/policy-assistant", { question: "What is the recipe for biryani?" });
check("out-of-scope → NO_ANSWER", r.data.outcome === "NO_ANSWER", r.data.outcome);

if (emp) {
  const E = tokenFor(emp);
  r = await call(E, "POST", "/ai/policy-assistant", { question: "What is the password of the admin?" });
  check("guardrail blocks credentials", r.data.outcome === "BLOCKED", r.data.rule_code);
  r = await call(E, "POST", "/ai/policy-assistant", { question: "Tell me the salary of Rahul" });
  check("guardrail blocks others' pay", r.data.outcome === "BLOCKED", r.data.rule_code);
  r = await call(E, "GET", "/ai/search?q=leave");
  check("employee search scoped to policies", r.data.scopes_searched?.join() === "policies", r.data.scopes_searched?.join());
  r = await call(E, "GET", "/ai/analytics");
  check("employee denied analytics", r.status === 403, `status ${r.status}`);
  r = await call(E, "POST", "/roadmap/phases/0/signoff", {});
  check("employee denied sign-off", r.status === 403, `status ${r.status}`);
}

r = await call(A, "GET", "/ai/search?q=engineer");
check("admin search multi-scope", r.status === 200 && r.data.scopes_searched?.length > 1, `${r.data.scopes_searched?.join()} total=${r.data.total}`);
r = await call(A, "GET", "/ai/analytics");
check("analytics", r.status === 200, JSON.stringify(r.data.metrics));
r.data.insights?.forEach((i) => console.log(`   [${i.level}] ${i.text}`));
r = await call(A, "GET", "/ai/workflow-assist");
check("workflow assist", r.status === 200, `${r.data.total_actions} suggested actions`);
r = await call(A, "GET", "/ai/logs");
check("interaction logs", r.status === 200 && r.data.logs?.length > 0, JSON.stringify(r.data.stats));

// Sign-off is intentionally not exercised here: it records a real approval. Employee denial is checked above.

await pool.end();
console.log(fails ? `\n${fails} check(s) FAILED` : "\nAll checks passed");
process.exit(fails ? 1 : 0);
