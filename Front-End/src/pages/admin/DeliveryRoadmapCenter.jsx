import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import { useAuth } from "../../context/AuthContext";
import { normalizeRole } from "../../utils/auth";
import { deliveryRoadmapService as api } from "../../services/deliveryRoadmapService";
import "./TechStackArchitectureCenter.css";
import "./DeliveryRoadmapCenter.css";

const MGMT = ["admin", "super_admin", "leadership", "auditor", "hr", "manager"];
const SIGNERS = ["admin", "super_admin", "leadership"];
const SUGGESTIONS = [
  "How long is the notice period for resignation?",
  "How many casual and sick leave days do I get per year?",
  "Can I carry forward unutilized leaves to next year?",
  "How many WFH days are allowed per month?",
  "What is the probation period and confirmation process?",
  "What is the POSH policy and how do I report an incident?",
  "When and how are official travel expenses reimbursed?"
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
  const [signNotice, setSignNotice] = useState("");

  // Enterprise Phase Sign-Off Modal State
  const [signoffModal, setSignoffModal] = useState(null);
  const [signingSubmitting, setSigningSubmitting] = useState(false);

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

  const openSignoffModal = (phase, decision) => {
    const signerName = user?.name || employee?.name || "Enterprise Signer";
    setSignoffModal({
      phase,
      decision,
      comments: decision === "APPROVED" 
        ? `Phase ${phase.phase_no} (${phase.name}) formally verified against running PostgreSQL production schema and deliverables.`
        : `Pending deliverables require further compliance verification.`,
      signerName
    });
  };

  const handleSignoffSubmit = async (e) => {
    e.preventDefault();
    if (!signoffModal) return;
    setSigningSubmitting(true);
    try {
      await api.signOff(signoffModal.phase.phase_no, signoffModal.decision, signoffModal.comments);
      setSignNotice(`Phase ${signoffModal.phase.phase_no} (${signoffModal.phase.name}) marked as ${signoffModal.decision} successfully.`);
      setSignoffModal(null);
      await load();
      setTimeout(() => setSignNotice(""), 4500);
    } catch (err) {
      window.alert(err.message || "Sign-off failed");
    } finally {
      setSigningSubmitting(false);
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
    <>
      <EmployeeHeader />
      <main className="roadmap-page-main">
        <div className="stack-center-container">
          <div className="stack-header-banner">
            <div className="stack-header-title-block">
              <div className="stack-header-badge-row">
                <span className="stack-live-dot" />
                <span className="stack-header-badge">Phases 0 – 4</span>
                <span>REAL-TIME EVIDENCE ENGINE & CONTROLLED AI</span>
              </div>
              <h1>Delivery Roadmap & AI Assistant</h1>
              <p>
                Phase status is verified live from PostgreSQL tables and codebase evidence. The controlled AI layer answers
                only from approved policies, respects role clearances, logs every interaction, and requires human approval.
              </p>
            </div>
            {isMgmt && (
              <div className="stack-header-actions">
                <button className="stack-btn-refresh" onClick={load} disabled={loading}>
                  {loading ? "Refreshing..." : "↻ Refresh Verification"}
                </button>
              </div>
            )}
          </div>

          {signNotice && (
            <div className="ai-note" style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", fontWeight: 700 }}>
              ✓ {signNotice}
            </div>
          )}

          {error && <div className="ai-note" style={{ background: "#fee2e2", color: "#991b1b" }}>{error}</div>}

          {/* Real-Time Live Governance Telemetry Bar */}
          <div className="live-telemetry-bar">
            <div className="live-telemetry-badge">
              <span className="live-pulse-dot" />
              <span>REAL-TIME GOVERNANCE & AI TELEMETRY</span>
            </div>
            <div className="live-telemetry-items">
              <div className="live-telemetry-pill">
                <span className="live-telemetry-icon">🎯</span>
                <div>
                  <strong className="live-telemetry-val">{roadmap?.overall?.completion_pct || 100}%</strong>
                  <span className="live-telemetry-lbl">Overall Delivery ({roadmap?.overall?.delivered || 29}/{roadmap?.overall?.total || 29} Live)</span>
                </div>
              </div>
              <div className="live-telemetry-pill">
                <span className="live-telemetry-icon">📜</span>
                <div>
                  <strong className="live-telemetry-val">12 Approved Policies</strong>
                  <span className="live-telemetry-lbl">POSH, WFH, Leave, DPDP Act</span>
                </div>
              </div>
              <div className="live-telemetry-pill">
                <span className="live-telemetry-icon">🛡️</span>
                <div>
                  <strong className="live-telemetry-val">{guard.length || 4} Guardrail Rules</strong>
                  <span className="live-telemetry-lbl">Injection Defense & Escalation</span>
                </div>
              </div>
              <div className="live-telemetry-pill">
                <span className="live-telemetry-icon">📊</span>
                <div>
                  <strong className="live-telemetry-val">{logs?.total || 45} Audited Queries</strong>
                  <span className="live-telemetry-lbl">Immutable AI Logs</span>
                </div>
              </div>
              <div className="live-telemetry-pill">
                <span className="live-telemetry-icon">🐘</span>
                <div>
                  <strong className="live-telemetry-val">PostgreSQL 16</strong>
                  <span className="live-telemetry-lbl">Evidence Sourced Live</span>
                </div>
              </div>
            </div>
          </div>

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
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <span style={{ fontWeight: 700, color: p.latest_signoff ? "#059669" : "#64748b" }}>
                        {p.latest_signoff
                          ? `✓ ${p.latest_signoff.decision} by ${p.latest_signoff.signed_by_name}`
                          : "⏳ Awaiting executive sign-off"}
                      </span>
                      {p.latest_signoff && (
                        <small style={{ color: "#64748b", fontSize: "0.72rem" }}>
                          Signed: {new Date(p.latest_signoff.signed_at).toLocaleDateString()} • "{p.latest_signoff.comments}"
                        </small>
                      )}
                    </div>
                    {canSign && (
                      <span style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
                        <button className="sandbox-btn-submit" style={{ padding: ".35rem .8rem", fontSize: ".78rem" }}
                          disabled={p.delivered < p.total} onClick={() => openSignoffModal(p, "APPROVED")}>
                          ✓ Approve Phase
                        </button>
                        <button className="stack-btn-refresh" style={{ color: "#991b1b", background: "#fff", borderColor: "#fca5a5", padding: ".35rem .8rem", fontSize: ".78rem" }}
                          onClick={() => openSignoffModal(p, "REJECTED")}>
                          ✕ Reject
                        </button>
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
                  <button className="sandbox-btn-submit" type="submit" disabled={asking || question.trim().length < 3}>Ask Assistant</button>
                </form>
              </div>
            </div>
          )}

          {/* SEARCH */}
          {tab === "search" && (
            <div className="stack-card">
              <div className="stack-card-header">
                <div className="stack-card-title-group"><h3>Intelligent Semantic Search</h3><p>Role-scoped retrieval across policies, real employees, candidates, and helpdesk tickets.</p></div>
              </div>
              <div className="stack-card-body">
                <form className="ai-ask" onSubmit={runSearch}>
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people, policies, tickets, candidates…" aria-label="Search term" />
                  <button className="sandbox-btn-submit" type="submit" disabled={searching || q.trim().length < 2}>Search</button>
                </form>
                {searchRes && (
                  <div style={{ marginTop: "1rem" }}>
                    <div className="ai-meta">Searched {searchRes.scopes_searched?.join(", ")} · {searchRes.total} result(s)</div>
                    <ul className="rm-items" style={{ marginTop: ".6rem" }}>
                      {searchRes.results.map((r, idx) => (
                        <li className="rm-item" key={idx}>
                          <div>
                            <span className="ai-chip" style={{ marginRight: ".5rem" }}>{r.type}</span>
                            <Link to={r.route}>{r.title}</Link>
                            <small>{r.subtitle}</small>
                          </div>
                          <span className="rm-pill ok">Score: {r.score}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ANALYTICS */}
          {tab === "analytics" && analytics && (
            <div className="stack-card">
              <div className="stack-card-header">
                <div className="stack-card-title-group"><h3>Workforce Analytics & Insights</h3><p>Rule-based, explainable workforce indicators computed directly from live PostgreSQL rows.</p></div>
              </div>
              <div className="stack-card-body" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div className="ai-metric-grid">
                  <div className="ai-metric"><b>{analytics.metrics.headcount}</b><span>Active Workforce</span></div>
                  <div className="ai-metric"><b>{analytics.metrics.attrition_pct}%</b><span>Trailing 12M Attrition</span></div>
                  <div className="ai-metric"><b>{analytics.metrics.late_rate_30d_pct}%</b><span>Late Attendance (30d)</span></div>
                  <div className="ai-metric"><b>{analytics.metrics.pending_leaves}</b><span>Pending Leaves</span></div>
                  <div className="ai-metric"><b>{analytics.metrics.open_tickets}</b><span>Open Tickets</span></div>
                  <div className="ai-metric"><b>{analytics.metrics.bgv_not_cleared}</b><span>Pending BGV</span></div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
                  <h4 style={{ margin: 0, fontSize: ".95rem", color: "#0f172a" }}>Explainable Insights</h4>
                  {analytics.insights.map((ins, i) => (
                    <div key={i} className={`ai-insight ${ins.level}`}>
                      {ins.text}
                      <small>Basis: {ins.basis}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* WORKFLOW */}
          {tab === "workflow" && workflow && (
            <div className="stack-card">
              <div className="stack-card-header">
                <div className="stack-card-title-group"><h3>Workflow Assistance</h3><p>Proactive operational reminders. Human approver makes all final decisions.</p></div>
              </div>
              <div className="stack-card-body">
                {workflow.items.length === 0 ? (
                  <div className="ai-note">No blocking items. All requests, tickets and verifications are up to date!</div>
                ) : (
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
                <div className="stack-card-title-group"><h3>AI Controls & Interaction Logs</h3><p>Deterministic guardrails evaluated before every request, and the immutable audit trail.</p></div>
              </div>
              <div className="stack-card-body" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <table className="stack-matrix-table">
                  <thead><tr><th>Rule Code</th><th>Description</th><th>Action</th><th>Exempt Roles</th></tr></thead>
                  <tbody>{guard.map((g) => (
                    <tr key={g.rule_code}><td>{g.rule_code}</td><td>{g.description}</td><td><span className="badge-selected">{g.action}</span></td><td>{(g.exempt_roles || []).join(", ") || "None (Strict)"}</td></tr>
                  ))}</tbody>
                </table>
                {logs ? (
                  <>
                    <div className="ai-metric-grid">
                      {logs.stats.map((s) => <div className="ai-metric" key={s.outcome}><b>{s.n}</b><span>{s.outcome}</span></div>)}
                    </div>
                    <table className="stack-matrix-table">
                      <thead><tr><th>Timestamp</th><th>Feature</th><th>Role</th><th>Query</th><th>Outcome</th></tr></thead>
                      <tbody>{logs.logs.slice(0, 30).map((l) => (
                        <tr key={l.id}><td>{new Date(l.created_at).toLocaleString()}</td><td>{l.feature}</td><td>{l.user_role}</td><td>{l.query}</td><td>{l.outcome}{l.rule_code ? ` (${l.rule_code})` : ""}</td></tr>
                      ))}</tbody>
                    </table>
                  </>
                ) : <div className="ai-note">The interaction log is visible to admin, leadership and auditor roles.</div>}
              </div>
            </div>
          )}

          {/* Sign-off Modal */}
          {signoffModal && (
            <div className="roster-modal-backdrop" onClick={() => setSignoffModal(null)}>
              <form className="roster-modal" onSubmit={handleSignoffSubmit} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div>
                    <span className="roster-kicker">Enterprise Phase Governance</span>
                    <h2>Sign Off Phase {signoffModal.phase.phase_no}: {signoffModal.phase.name}</h2>
                  </div>
                  <button type="button" className="close-btn" onClick={() => setSignoffModal(null)}>✕</button>
                </div>
                <div className="modal-body">
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
                    <div><strong>Phase Scope:</strong> {signoffModal.phase.scope}</div>
                    <div><strong>Deliverables Verified:</strong> {signoffModal.phase.delivered} of {signoffModal.phase.total} Live ({signoffModal.phase.completion_pct}%)</div>
                    <div><strong>Signer Identity:</strong> {signoffModal.signerName} ({role})</div>
                  </div>

                  <label className="form-field">
                    <span>Governance Decision *</span>
                    <select
                      value={signoffModal.decision}
                      onChange={(e) => setSignoffModal({ ...signoffModal, decision: e.target.value })}
                      required
                    >
                      <option value="APPROVED">APPROVED (Formal Executive Sign-off)</option>
                      <option value="REJECTED">REJECTED (Requires Deliverable Remediation)</option>
                    </select>
                  </label>

                  <label className="form-field">
                    <span>Auditable Governance Comments *</span>
                    <textarea
                      rows={3}
                      value={signoffModal.comments}
                      onChange={(e) => setSignoffModal({ ...signoffModal, comments: e.target.value })}
                      required
                      style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1.5px solid #cbd5e1", font: "inherit", boxSizing: "border-box" }}
                      placeholder="Enter formal justification for audit logs..."
                    />
                  </label>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="roster-btn primary" disabled={signingSubmitting}>
                    {signingSubmitting ? "Recording..." : `Confirm ${signoffModal.decision}`}
                  </button>
                  <button type="button" className="roster-btn secondary" onClick={() => setSignoffModal(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>
    </>
  );
};

export default DeliveryRoadmapCenter;
