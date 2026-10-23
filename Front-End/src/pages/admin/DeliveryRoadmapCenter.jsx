import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { normalizeRole } from "../../utils/auth";
import { deliveryRoadmapService as api } from "../../services/deliveryRoadmapService";
import "./TechStackArchitectureCenter.css";
import "./DeliveryRoadmapCenter.css";

const MGMT = ["admin", "super_admin", "leadership", "auditor", "hr", "manager"];
const SIGNERS = ["admin", "super_admin", "leadership"];
const SUGGESTIONS = [
  "How long is the notice period?",
  "Can I carry forward my leave?",
  "How many WFH days are allowed?",
  "What is the probation period?",
  "When are expenses reimbursed?"
];

const DeliveryRoadmapCenter = ({ defaultTab = "roadmap" }) => {
  const { user, employee } = useAuth();
  const role = normalizeRole(user, employee);
  const isMgmt = MGMT.includes(role);
  const canSign = SIGNERS.includes(role);

  const [tab, setTab] = useState(isMgmt ? defaultTab : "assistant");
  const [roadmap, setRoadmap] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [guard, setGuard] = useState([]);
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [chat, setChat] = useState([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const chatEnd = useRef(null);

  const [q, setQ] = useState("");
  const [searchRes, setSearchRes] = useState(null);
  const [searching, setSearching] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      if (isMgmt) {
        const [rm, an, wf, gr, lg] = await Promise.all([
          api.getRoadmap().catch(() => null),
          api.getAnalytics().catch(() => null),
          api.getWorkflowAssist().catch(() => null),
          api.getGuardrails().catch(() => null),
          api.getLogs().catch(() => null)
        ]);
        setRoadmap(rm?.success ? rm : null);
        setAnalytics(an?.success ? an : null);
        setWorkflow(wf?.success ? wf : null);
        setGuard(gr?.rules || []);
        setLogs(lg?.success ? lg : null);
        if (!rm) setError("Unable to load roadmap data.");
      }
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  const ask = async (text) => {
    const t = (text ?? question).trim();
    if (t.length < 3 || asking) return;
    setChat((c) => [...c, { from: "user", text: t }]);
    setQuestion("");
    setAsking(true);
    try {
      const r = await api.askPolicy(t);
      setChat((c) => [...c, { from: "bot", ...r }]);
    } catch (e) {
      setChat((c) => [...c, { from: "bot", outcome: "ERROR", answer: e.message || "Request failed" }]);
    } finally { setAsking(false); }
  };

  const runSearch = async (e) => {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setSearching(true);
    try { setSearchRes(await api.search(q.trim())); }
    catch (err) { setSearchRes({ results: [], error: err.message }); }
    finally { setSearching(false); }
  };

  const signOff = async (p, decision) => {
    const comments = window.prompt(`Comments for Phase ${p.phase_no} (${decision}):`, "");
    if (comments === null) return;
    try {
      await api.signOff(p.phase_no, decision, comments);
      await load();
    } catch (e) {
      window.alert(e.message || "Sign-off failed");
    }
  };

  const tabs = [
    ...(isMgmt ? [{ k: "roadmap", l: "🗺️ Delivery Roadmap" }] : []),
    { k: "assistant", l: "💬 Policy Assistant" },
    { k: "search", l: "🔎 Intelligent Search" },
    ...(isMgmt ? [
      { k: "analytics", l: "📈 AI Analytics" },
      { k: "workflow", l: "🧭 Workflow Assistance" },
      { k: "controls", l: "🛡️ AI Controls" }
    ] : [])
  ];

  return (
    <div className="stack-center-container">
      <div className="stack-header-banner">
        <div className="stack-header-title-block">
          <div className="stack-header-badge-row">
            <span className="stack-live-dot" />
            <span className="stack-header-badge">Phases 0 – 4</span>
            <span>CONTROLLED AI LAYER</span>
          </div>
          <h1>Delivery Roadmap & AI Assistant</h1>
          <p>
            Phase status is computed live from the running system. The AI layer answers only from approved policy
            text, respects your role, blocks sensitive requests, logs every interaction and never acts on its own.
          </p>
        </div>
        {isMgmt && (
          <div className="stack-header-actions">
            <button className="stack-btn-refresh" onClick={load} disabled={loading}>
              {loading ? "Refreshing..." : "↻ Refresh"}
            </button>
          </div>
        )}
      </div>

      {error && <div className="ai-note" style={{ background: "#fee2e2", color: "#991b1b" }}>{error}</div>}

      {roadmap && (
        <div className="stack-kpi-grid">
          <div className="stack-kpi-card">
            <div className="stack-kpi-icon blue">🎯</div>
            <div className="stack-kpi-content">
              <span className="stack-kpi-label">Overall delivery</span>
              <span className="stack-kpi-value">{roadmap.overall.completion_pct}%</span>
              <span className="stack-kpi-sub">{roadmap.overall.delivered} of {roadmap.overall.total} deliverables live</span>
            </div>
          </div>
          {roadmap.phases.map((p) => (
            <div className="stack-kpi-card" key={p.phase_no}>
              <div className={`stack-kpi-icon ${p.completion_pct === 100 ? "green" : "amber"}`}>{p.phase_no}</div>
              <div className="stack-kpi-content">
                <span className="stack-kpi-label">{p.name}</span>
                <span className="stack-kpi-value">{p.completion_pct}%</span>
                <span className="stack-kpi-sub">{p.outcome}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="stack-tab-bar" role="tablist">
        {tabs.map((t) => (
          <button key={t.k} role="tab" id={`rm-tab-${t.k}`}
            className={`stack-tab-btn ${tab === t.k ? "active" : ""}`} onClick={() => setTab(t.k)}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ROADMAP */}
      {tab === "roadmap" && roadmap && (
        <div className="rm-phase-grid">
          {roadmap.phases.map((p) => (
            <section key={p.phase_no} className={`rm-phase ${p.completion_pct === 100 ? "done" : ""}`}>
              <div className="rm-phase-head">
                <div>
                  <h3>Phase {p.phase_no} – {p.name}</h3>
                  <p>{p.scope}</p>
                </div>
                <span className={`rm-pill ${p.completion_pct === 100 ? "ok" : "pending"}`}>{p.delivered}/{p.total}</span>
              </div>
              <div className="rm-bar"><span style={{ width: `${p.completion_pct}%` }} /></div>
              <ul className="rm-items">
                {p.deliverables.map((d) => (
                  <li className="rm-item" key={d.deliverable_code}>
                    <div>
                      {d.ui_route ? <Link to={d.ui_route}>{d.title}</Link> : <strong>{d.title}</strong>}
                      <small>{d.evidence}{d.api_route ? ` · ${d.api_route}` : ""}</small>
                    </div>
                    <span className={`rm-pill ${d.live ? "ok" : "pending"}`}>{d.status}</span>
                  </li>
                ))}
              </ul>
              <div className="rm-signoff">
                <span>
                  {p.latest_signoff
                    ? `${p.latest_signoff.decision} by ${p.latest_signoff.signed_by_name} · ${new Date(p.latest_signoff.signed_at).toLocaleDateString()}`
                    : "Awaiting sign-off"}
                </span>
                {canSign && (
                  <span style={{ display: "flex", gap: ".4rem" }}>
                    <button className="sandbox-btn-submit" style={{ padding: ".35rem .8rem", fontSize: ".78rem" }}
                      disabled={p.delivered < p.total} onClick={() => signOff(p, "APPROVED")}>Approve phase</button>
                    <button className="stack-btn-refresh" style={{ color: "#991b1b", background: "#fff", borderColor: "#fca5a5", padding: ".35rem .8rem", fontSize: ".78rem" }}
                      onClick={() => signOff(p, "REJECTED")}>Reject</button>
                  </span>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* POLICY ASSISTANT */}
      {tab === "assistant" && (
        <div className="stack-card">
          <div className="stack-card-header">
            <div className="stack-card-title-group">
              <h3>Policy Assistant</h3>
              <p>Answers are extracted from approved company policies and cited. Out-of-scope questions are not guessed.</p>
            </div>
          </div>
          <div className="stack-card-body">
            <div className="ai-chat" aria-live="polite">
              {chat.length === 0 && <div className="ai-note">Ask about leave, attendance, WFH, probation, notice period, expenses, POSH, data privacy, helpdesk SLA, BGV or IT assets.</div>}
              {chat.map((m, i) => m.from === "user" ? (
                <div key={i} className="ai-msg user">{m.text}</div>
              ) : (
                <div key={i} className={`ai-msg bot ${m.outcome === "BLOCKED" || m.outcome === "ESCALATED" ? "blocked" : ""}`}>
                  {m.answer}
                  <div className="ai-meta">
                    {m.outcome && <span className="ai-chip">{m.outcome}</span>}
                    {m.confidence != null && <span>confidence {m.confidence}%</span>}
                    {(m.sources || []).map((s) => <span key={s.policy_code} className="ai-chip">{s.title} v{s.version}</span>)}
                    {m.suggested_route && <Link to={m.suggested_route}>Raise a ticket →</Link>}
                  </div>
                  {m.disclaimer && <div className="ai-meta">{m.disclaimer}</div>}
                </div>
              ))}
              {asking && <div className="ai-msg bot">Searching policies…</div>}
              <div ref={chatEnd} />
            </div>
            <div className="ai-suggest">
              {SUGGESTIONS.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}
            </div>
            <form className="ai-ask" onSubmit={(e) => { e.preventDefault(); ask(); }}>
              <input id="ai-question" value={question} maxLength={400} placeholder="Ask a policy question…"
                onChange={(e) => setQuestion(e.target.value)} aria-label="Policy question" />
              <button className="sandbox-btn-submit" disabled={asking || question.trim().length < 3}>Ask</button>
            </form>
          </div>
        </div>
      )}

      {/* SEARCH */}
      {tab === "search" && (
        <div className="stack-card">
          <div className="stack-card-header">
            <div className="stack-card-title-group">
              <h3>Intelligent Search</h3>
              <p>Ranked across the records your role is permitted to see. Sensitive fields are never returned.</p>
            </div>
          </div>
          <div className="stack-card-body">
            <form className="ai-ask" onSubmit={runSearch}>
              <input id="ai-search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={100}
                placeholder="e.g. java developer, leave policy, ticket payslip…" aria-label="Search" />
              <button className="sandbox-btn-submit" disabled={searching || q.trim().length < 2}>{searching ? "Searching…" : "Search"}</button>
            </form>
            {searchRes && (
              <>
                <p className="ai-note" style={{ margin: "1rem 0" }}>
                  {searchRes.error || `${searchRes.total ?? 0} match(es) · scopes: ${(searchRes.scopes_searched || []).join(", ")}`}
                </p>
                <ul className="rm-items">
                  {(searchRes.results || []).map((r, i) => (
                    <li className="rm-item" key={i}>
                      <div><Link to={r.route}>{r.title}</Link><small>{r.subtitle}</small></div>
                      <span className="rm-pill ok">{r.type}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {/* ANALYTICS */}
      {tab === "analytics" && analytics && (
        <div className="stack-card">
          <div className="stack-card-header">
            <div className="stack-card-title-group"><h3>AI Analytics</h3><p>Every insight states how it was calculated.</p></div>
          </div>
          <div className="stack-card-body" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div className="ai-metric-grid">
              {[
                ["Active headcount", analytics.metrics.headcount],
                ["Attrition 12m", `${analytics.metrics.attrition_pct}%`],
                ["Late rate 30d", `${analytics.metrics.late_rate_30d_pct}%`],
                ["Pending leaves", analytics.metrics.pending_leaves],
                ["Open tickets", analytics.metrics.open_tickets],
                ["BGV not cleared", analytics.metrics.bgv_not_cleared]
              ].map(([l, v]) => <div className="ai-metric" key={l}><b>{v}</b><span>{l}</span></div>)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}>
              {analytics.insights.map((i, n) => (
                <div key={n} className={`ai-insight ${i.level}`}>{i.text}<small>Basis: {i.basis}</small></div>
              ))}
            </div>
            <table className="stack-matrix-table">
              <thead><tr><th>Department</th><th>Active employees</th></tr></thead>
              <tbody>{analytics.headcount_by_department.map((d) => <tr key={d.d}><td>{d.d}</td><td>{d.n}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* WORKFLOW */}
      {tab === "workflow" && workflow && (
        <div className="stack-card">
          <div className="stack-card-header">
            <div className="stack-card-title-group"><h3>Workflow Assistance</h3><p>{workflow.note}</p></div>
          </div>
          <div className="stack-card-body">
            {workflow.items.length === 0 ? <div className="ai-note">Nothing needs attention right now.</div> : (
              <ul className="rm-items">
                {workflow.items.map((i) => (
                  <li className="rm-item" key={i.key}>
                    <div>
                      <strong>{i.count} · {i.title}</strong>
                      <small>{i.detail} — Suggested: {i.suggested_action}</small>
                    </div>
                    <span style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
                      <span className={`rm-pill ${i.priority === "HIGH" ? "pending" : "ok"}`}>{i.priority}</span>
                      <Link to={i.route}>Open →</Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* CONTROLS */}
      {tab === "controls" && (
        <div className="stack-card">
          <div className="stack-card-header">
            <div className="stack-card-title-group"><h3>AI Controls</h3><p>Guardrails evaluated before every request, and the interaction audit log.</p></div>
          </div>
          <div className="stack-card-body" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <table className="stack-matrix-table">
              <thead><tr><th>Rule</th><th>Description</th><th>Action</th><th>Exempt roles</th></tr></thead>
              <tbody>{guard.map((g) => (
                <tr key={g.rule_code}><td>{g.rule_code}</td><td>{g.description}</td><td>{g.action}</td><td>{(g.exempt_roles || []).join(", ") || "—"}</td></tr>
              ))}</tbody>
            </table>
            {logs ? (
              <>
                <div className="ai-metric-grid">
                  {logs.stats.map((s) => <div className="ai-metric" key={s.outcome}><b>{s.n}</b><span>{s.outcome}</span></div>)}
                </div>
                <table className="stack-matrix-table">
                  <thead><tr><th>Time</th><th>Feature</th><th>Role</th><th>Query</th><th>Outcome</th></tr></thead>
                  <tbody>{logs.logs.slice(0, 30).map((l) => (
                    <tr key={l.id}><td>{new Date(l.created_at).toLocaleString()}</td><td>{l.feature}</td><td>{l.user_role}</td><td>{l.query}</td><td>{l.outcome}{l.rule_code ? ` (${l.rule_code})` : ""}</td></tr>
                  ))}</tbody>
                </table>
              </>
            ) : <div className="ai-note">The interaction log is visible to admin, leadership and auditor roles.</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryRoadmapCenter;
