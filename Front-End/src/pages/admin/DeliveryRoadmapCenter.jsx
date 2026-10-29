import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import { useAuth } from "../../context/AuthContext";
import { normalizeRole } from "../../utils/auth";
import { deliveryRoadmapService as api } from "../../services/deliveryRoadmapService";
import "./TechStackArchitectureCenter.css";
import "./DeliveryRoadmapCenter.css";

const MGMT = ["admin", "super_admin", "leadership", "executive", "auditor", "hr", "hr_admin", "hr_manager", "hr_operations", "manager"];
const SIGNERS = ["admin", "super_admin", "leadership", "executive", "hr", "hr_admin", "hr_manager", "hr_operations"];
const CREATORS = ["admin", "super_admin", "leadership", "executive", "hr", "hr_admin", "hr_manager", "hr_operations"];
const SUGGESTIONS = [
  "How long is the notice period for resignation?",
  "How many casual and sick leave days do I get per year?",
  "Can I carry forward unutilized leaves to next year?",
  "How many WFH days are allowed per month?",
  "What is the probation period and confirmation process?",
  "What is the POSH policy and how do I report an incident?",
  "When and how are official travel expenses reimbursed?"
];

const SEARCH_SUGGESTIONS = [
  "Leave Policy",
  "Probation Period",
  "Working Hours",
  "Software Engineer",
  "Candidates",
  "Helpdesk Tickets"
];

const DeliveryRoadmapCenter = ({ defaultTab = "roadmap" }) => {
  const { user, employee } = useAuth();
  const role = normalizeRole(user, employee);
  const isMgmt = MGMT.includes(role);
  const canSign = SIGNERS.includes(role);
  const canCreate = CREATORS.includes(role);

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

  // HR Phase Creation Modal State
  const [phaseModal, setPhaseModal] = useState(false);
  const [phaseForm, setPhaseForm] = useState({ phase_no: "", name: "", scope: "", outcome: "" });
  const [phaseSubmitting, setPhaseSubmitting] = useState(false);

  // HR Deliverable Creation Modal State
  const [deliverableModal, setDeliverableModal] = useState(false);
  const [deliverableForm, setDeliverableForm] = useState({
    phase_no: "",
    deliverable_code: "",
    title: "",
    description: "",
    evidence_type: "TABLE",
    evidence_ref: "",
    min_rows: 1,
    ui_route: "",
    api_route: ""
  });
  const [deliverableSubmitting, setDeliverableSubmitting] = useState(false);

  const [chat, setChat] = useState([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const chatEnd = useRef(null);

  const [q, setQ] = useState("");
  const [searchRes, setSearchRes] = useState(null);
  const [searching, setSearching] = useState(false);
  const phaseScrollRef = useRef(null);

  const scrollPhases = (direction) => {
    if (!phaseScrollRef.current) return;
    const container = phaseScrollRef.current;
    const scrollAmount = (container.clientWidth / 2) + 10;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth"
    });
  };

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

  const runSearch = async (e, customQuery) => {
    if (e && e.preventDefault) e.preventDefault();
    const queryTerm = (customQuery !== undefined ? customQuery : q).trim();
    if (queryTerm.length < 2) {
      setSearchRes({ results: [], error: "Please enter at least 2 characters to search across policies, employees, candidates, and tickets." });
      return;
    }
    if (customQuery !== undefined) {
      setQ(customQuery);
    }
    setSearching(true);
    setSearchRes(null);
    try {
      const res = await api.search(queryTerm);
      setSearchRes(res);
    } catch (err) {
      setSearchRes({ results: [], error: err.message || "Failed to complete semantic search" });
    } finally {
      setSearching(false);
    }
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

  const handleCreatePhase = async (e) => {
    e.preventDefault();
    if (phaseForm.phase_no === "" || isNaN(Number(phaseForm.phase_no))) {
      window.alert("Please provide a valid phase number.");
      return;
    }
    setPhaseSubmitting(true);
    try {
      await api.createPhase({
        ...phaseForm,
        phase_no: Number(phaseForm.phase_no)
      });
      setSignNotice(`Phase ${phaseForm.phase_no} ("${phaseForm.name}") created successfully.`);
      setPhaseModal(false);
      setPhaseForm({ phase_no: "", name: "", scope: "", outcome: "" });
      await load();
      setTimeout(() => setSignNotice(""), 4500);
    } catch (err) {
      window.alert(err.message || "Failed to create phase");
    } finally {
      setPhaseSubmitting(false);
    }
  };

  const handleCreateDeliverable = async (e) => {
    e.preventDefault();
    setDeliverableSubmitting(true);
    try {
      await api.createDeliverable(deliverableForm);
      setSignNotice(`Deliverable "${deliverableForm.deliverable_code}" added to Phase ${deliverableForm.phase_no} successfully.`);
      setDeliverableModal(false);
      setDeliverableForm({
        phase_no: "",
        deliverable_code: "",
        title: "",
        description: "",
        evidence_type: "TABLE",
        evidence_ref: "",
        min_rows: 1,
        ui_route: "",
        api_route: ""
      });
      await load();
      setTimeout(() => setSignNotice(""), 4500);
    } catch (err) {
      window.alert(err.message || "Failed to add deliverable");
    } finally {
      setDeliverableSubmitting(false);
    }
  };

  const handleDeletePhase = async (phaseNo, phaseName) => {
    if (!window.confirm(`Are you sure you want to delete Phase ${phaseNo} ("${phaseName}") and all its deliverables?`)) return;
    try {
      await api.deletePhase(phaseNo);
      setSignNotice(`Phase ${phaseNo} ("${phaseName}") deleted successfully.`);
      await load();
      setTimeout(() => setSignNotice(""), 4500);
    } catch (err) {
      window.alert(err.message || "Failed to delete phase");
    }
  };

  const handleDeleteDeliverable = async (id, code, title) => {
    if (!window.confirm(`Remove only deliverable "${code}" (${title || ""})?`)) return;
    try {
      await api.deleteDeliverable(id || code);
      setSignNotice(`Deliverable "${code}" removed successfully.`);
      await load();
      setTimeout(() => setSignNotice(""), 4500);
    } catch (err) {
      await load();
      window.alert(err.message || "Failed to delete deliverable");
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
                <span className="stack-header-badge">{roadmap?.phases?.length ? `${roadmap.phases.length} Active Phase(s)` : "HR Configured"}</span>
                <span>REAL-TIME EVIDENCE ENGINE & CONTROLLED AI</span>
              </div>
              <h1>Delivery Roadmap & AI Assistant</h1>
              <p>
                Phase status is verified live from PostgreSQL tables and codebase evidence. The controlled AI layer answers
                only from approved policies, respects role clearances, logs every interaction, and requires human approval.
              </p>
            </div>
            {isMgmt && (
              <div className="stack-header-actions" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                {canCreate && (
                  <button
                    type="button"
                    className="sandbox-btn-submit"
                    style={{ padding: ".45rem .9rem", fontSize: ".85rem", cursor: "pointer" }}
                    onClick={() => {
                      const nextNo = roadmap?.phases?.length ? Math.max(...roadmap.phases.map((p) => p.phase_no)) + 1 : 1;
                      setPhaseForm({ phase_no: nextNo, name: "", scope: "", outcome: "" });
                      setPhaseModal(true);
                    }}
                  >
                    + Add New Phase
                  </button>
                )}
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
                  <strong className="live-telemetry-val">{roadmap?.overall?.completion_pct ?? 0}%</strong>
                  <span className="live-telemetry-lbl">Overall Delivery ({roadmap?.overall?.delivered ?? 0}/{roadmap?.overall?.total ?? 0} Live)</span>
                </div>
              </div>
              <div className="live-telemetry-pill">
                <span className="live-telemetry-icon">📜</span>
                <div>
                  <strong className="live-telemetry-val">{roadmap?.telemetry?.policy_count ?? 0} Approved Policies</strong>
                  <span className="live-telemetry-lbl">Verified Policy Repository</span>
                </div>
              </div>
              <div className="live-telemetry-pill">
                <span className="live-telemetry-icon">🛡️</span>
                <div>
                  <strong className="live-telemetry-val">{roadmap?.telemetry?.guardrail_count ?? guard.length} Guardrail Rules</strong>
                  <span className="live-telemetry-lbl">Active Policy Enforcement</span>
                </div>
              </div>
              <div className="live-telemetry-pill">
                <span className="live-telemetry-icon">📊</span>
                <div>
                  <strong className="live-telemetry-val">{roadmap?.telemetry?.log_count ?? (logs?.total || 0)} Audited Queries</strong>
                  <span className="live-telemetry-lbl">Immutable AI Logs</span>
                </div>
              </div>
              <div className="live-telemetry-pill">
                <span className="live-telemetry-icon">🐘</span>
                <div>
                  <strong className="live-telemetry-val">PostgreSQL</strong>
                  <span className="live-telemetry-lbl">100% Dynamic HR Sourced</span>
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
          {tab === "roadmap" && roadmap && roadmap.phases.length === 0 && (
            <div className="stack-card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.8rem" }}>🗺️</div>
              <h3 style={{ margin: "0 0 0.5rem" }}>No Delivery Roadmap Phases Configured</h3>
              <p style={{ color: "#64748b", maxWidth: "480px", margin: "0 auto 1.5rem" }}>
                All backend hardcoded phases and deliverables have been removed. HR and Leadership can now manually create customized enterprise phases and deliverables.
              </p>
              {canCreate && (
                <button
                  type="button"
                  className="sandbox-btn-submit"
                  style={{ padding: ".6rem 1.2rem", fontSize: ".9rem", cursor: "pointer" }}
                  onClick={() => {
                    setPhaseForm({ phase_no: 1, name: "", scope: "", outcome: "" });
                    setPhaseModal(true);
                  }}
                >
                  + Create Your First Phase
                </button>
              )}
            </div>
          )}

          {tab === "roadmap" && roadmap && roadmap.phases.length > 0 && (
            <div className="rm-phase-scroll-container">
              <div className="rm-phase-scroll-header">
                <span className="rm-scroll-indicator-text">
                  Viewing {roadmap.phases.length} Phases · Showing 2 side by side (scroll to view remaining)
                </span>
                <div className="rm-phase-scroll-controls">
                  <button
                    type="button"
                    className="rm-scroll-btn"
                    onClick={() => scrollPhases("left")}
                    title="Scroll left"
                    aria-label="Scroll left"
                  >
                    ◀ Prev
                  </button>
                  <button
                    type="button"
                    className="rm-scroll-btn"
                    onClick={() => scrollPhases("right")}
                    title="Scroll right"
                    aria-label="Scroll right"
                  >
                    Next ▶
                  </button>
                </div>
              </div>

              <div className="rm-phase-grid rm-phase-scrollable" ref={phaseScrollRef}>
                {roadmap.phases.map((p) => (
                  <section key={p.phase_no} className={`rm-phase ${p.completion_pct === 100 ? "done" : ""}`}>
                    <div className="rm-phase-head">
                      <div>
                        <h3>Phase {p.phase_no} – {p.name}</h3>
                        <p>{p.scope}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {canCreate && (
                          <>
                            <button
                              type="button"
                              className="rm-btn-add"
                              title="Add a new deliverable to this phase"
                              onClick={() => {
                                setDeliverableForm({
                                  phase_no: p.phase_no,
                                  deliverable_code: `P${p.phase_no}-`,
                                  title: "",
                                  description: "",
                                  evidence_type: "TABLE",
                                  evidence_ref: "",
                                  min_rows: 1,
                                  ui_route: "",
                                  api_route: ""
                                });
                                setDeliverableModal(true);
                              }}
                            >
                              + Add Deliverable
                            </button>
                            <button
                              type="button"
                              className="rm-btn-edit"
                              title="Edit this phase details"
                              onClick={() => {
                                setPhaseForm({
                                  phase_no: p.phase_no,
                                  name: p.name,
                                  scope: p.scope,
                                  outcome: p.outcome
                                });
                                setPhaseModal(true);
                              }}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              className="rm-btn-delete"
                              title="Delete this phase"
                              onClick={() => handleDeletePhase(p.phase_no, p.name)}
                            >
                              🗑 Delete
                            </button>
                          </>
                        )}
                        <span className={`rm-pill ${p.completion_pct === 100 ? "ok" : "pending"}`}>{p.delivered}/{p.total}</span>
                      </div>
                    </div>
                    <div className="rm-bar"><span style={{ width: `${p.completion_pct}%` }} /></div>
                    <ul className="rm-items">
                      {p.deliverables.map((d) => (
                        <li className="rm-item" key={d.deliverable_code}>
                          <div>
                            {d.ui_route ? <Link to={d.ui_route}>{d.title}</Link> : <strong>{d.title}</strong>}
                            <small>{d.evidence}{d.api_route ? ` · ${d.api_route}` : ""}</small>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span className={`rm-pill ${d.live ? "ok" : "pending"}`}>{d.status}</span>
                            {canCreate && (
                              <button
                                type="button"
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "0.9rem", padding: "0 0.2rem" }}
                                title={`Remove deliverable ${d.deliverable_code}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteDeliverable(d.id || d.deliverable_code, d.deliverable_code, d.title);
                                }}
                              >
                                ✕
                              </button>
                            )}
                          </div>
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
                          <button
                            type="button"
                            className="sandbox-btn-submit"
                            style={{
                              padding: ".35rem .8rem",
                              fontSize: ".78rem",
                              cursor: "pointer",
                              opacity: p.delivered < p.total || p.total === 0 ? 0.75 : 1
                            }}
                            title={p.total === 0 ? "Add at least one deliverable before approving" : p.delivered < p.total ? "All deliverables must be live to approve" : "Approve this phase"}
                            onClick={() => {
                              if (p.total === 0) {
                                window.alert("You must add at least 1 deliverable before approving Phase " + p.phase_no);
                                return;
                              }
                              if (p.delivered < p.total) {
                                window.alert(`Cannot approve Phase ${p.phase_no}: ${p.total - p.delivered} deliverable(s) are still PENDING. Deliverables must be verified live before approval.`);
                                return;
                              }
                              openSignoffModal(p, "APPROVED");
                            }}
                          >
                            ✓ Approve Phase
                          </button>
                          <button
                            type="button"
                            className="stack-btn-refresh"
                            style={{ color: "#991b1b", background: "#fff", borderColor: "#fca5a5", padding: ".35rem .8rem", fontSize: ".78rem" }}
                            onClick={() => openSignoffModal(p, "REJECTED")}
                          >
                            ✕ Reject
                          </button>
                        </span>
                      )}
                    </div>
                  </section>
                ))}
              </div>
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
                <div className="stack-card-title-group">
                  <h3>Intelligent Semantic Search</h3>
                  <p>Role-scoped retrieval across policies, real employees, candidates, and helpdesk tickets.</p>
                </div>
              </div>
              <div className="stack-card-body">
                <div className="rm-search-suggest-box">
                  <span className="rm-search-suggest-title">
                    ⚡ Quick Search Suggestions:
                  </span>
                  <div className="rm-search-suggest-chips">
                    {SEARCH_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="rm-search-suggest-chip"
                        onClick={() => runSearch(null, s)}
                      >
                        🔎 {s}
                      </button>
                    ))}
                  </div>
                </div>

                <form className="ai-ask" onSubmit={(e) => runSearch(e)}>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search people, policies, tickets, candidates (min 2 characters)…"
                    aria-label="Search term"
                  />
                  <button className="sandbox-btn-submit" type="submit" disabled={searching}>
                    {searching ? "Searching…" : "Search"}
                  </button>
                </form>

                {searching && (
                  <div className="ai-note" style={{ marginTop: "1rem", background: "#f0f9ff", color: "#0369a1", border: "1px solid #bae6fd" }}>
                    🔍 Searching across approved policies, workforce directory, candidates, and helpdesk tickets…
                  </div>
                )}

                {searchRes?.error && (
                  <div className="ai-note" style={{ marginTop: "1rem", background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }}>
                    ⚠️ {searchRes.error}
                  </div>
                )}

                {searchRes && !searchRes.error && searchRes.results && (
                  <div style={{ marginTop: "1.25rem" }}>
                    <div className="ai-meta" style={{ marginBottom: "0.5rem" }}>
                      Searched scopes: <strong>{searchRes.scopes_searched?.join(", ")}</strong> · Found {searchRes.total} result(s) for "{searchRes.query}"
                    </div>

                    {searchRes.results.length === 0 ? (
                      <div className="ai-note" style={{ background: "#f8fafc", color: "#64748b" }}>
                        No records found matching "{searchRes.query}". Try searching for keywords like "leave", "probation", "software", or employee names.
                      </div>
                    ) : (
                      <div className="rm-search-results-scrollable">
                        <ul className="rm-search-list">
                          {searchRes.results.map((r, idx) => (
                            <li className="rm-search-card" key={idx}>
                              <div className="rm-search-card-main">
                                <div className="rm-search-card-header">
                                  <span className={`rm-search-type-badge rm-badge-${r.type?.toLowerCase()}`}>
                                    {r.type}
                                  </span>
                                  {r.type === "POLICY" ? (
                                    <button
                                      type="button"
                                      className="rm-search-link-btn"
                                      onClick={() => {
                                        setTab("assistant");
                                        ask(`What are the key terms, rules, and guidelines in the ${r.title}?`);
                                      }}
                                      title="Open and query in Policy Assistant"
                                    >
                                      {r.title}
                                      <span className="rm-search-action-hint">↗ Ask Assistant</span>
                                    </button>
                                  ) : (
                                    <Link to={r.route} className="rm-search-link" title={`Go to ${r.route}`}>
                                      {r.title}
                                      <span className="rm-search-action-hint">↗ View</span>
                                    </Link>
                                  )}
                                </div>
                                <div className="rm-search-card-meta">
                                  <span>{r.subtitle}</span>
                                </div>
                              </div>
                              <div className="rm-search-card-aside">
                                <span className="rm-search-score-pill">
                                  Score: <strong>{r.score}</strong>
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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

          {/* HR Phase Creation Modal */}
          {phaseModal && (
            <div className="roster-modal-backdrop" onClick={() => setPhaseModal(false)}>
              <form className="roster-modal" onSubmit={handleCreatePhase} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div>
                    <span className="roster-kicker">HR Delivery Roadmap Governance</span>
                    <h2>Create New Roadmap Phase</h2>
                  </div>
                  <button type="button" className="close-btn" onClick={() => setPhaseModal(false)}>✕</button>
                </div>
                <div className="modal-body">
                  <p style={{ color: "#64748b", fontSize: "0.85rem", marginTop: 0 }}>
                    Define an enterprise milestone phase directly from HR. Once added, deliverables can be linked and verified.
                  </p>
                  <label className="form-field">
                    <span>Phase Number *</span>
                    <input
                      type="number"
                      min={0}
                      value={phaseForm.phase_no}
                      onChange={(e) => setPhaseForm({ ...phaseForm, phase_no: e.target.value })}
                      required
                      placeholder="e.g. 5"
                    />
                    {roadmap?.phases?.find((p) => p.phase_no === Number(phaseForm.phase_no)) ? (
                      <small style={{ color: "#0284c7", fontWeight: 600, marginTop: "0.2rem" }}>
                        ℹ️ Phase {phaseForm.phase_no} already exists ("{roadmap.phases.find((p) => p.phase_no === Number(phaseForm.phase_no)).name}"). Saving will update its name and scope.
                      </small>
                    ) : (
                      <small style={{ color: "#64748b", marginTop: "0.2rem" }}>
                        Unique phase number (e.g. {roadmap?.phases?.length ? Math.max(...roadmap.phases.map((p) => p.phase_no)) + 1 : 1} for next new phase).
                      </small>
                    )}
                  </label>
                  <label className="form-field">
                    <span>Phase Name *</span>
                    <input
                      type="text"
                      value={phaseForm.name}
                      onChange={(e) => setPhaseForm({ ...phaseForm, name: e.target.value })}
                      required
                      placeholder="e.g. Talent & Learning, Global Expansion"
                    />
                  </label>
                  <label className="form-field">
                    <span>Business Scope *</span>
                    <textarea
                      rows={2}
                      value={phaseForm.scope}
                      onChange={(e) => setPhaseForm({ ...phaseForm, scope: e.target.value })}
                      required
                      placeholder="e.g. Skill matrices, course catalog, compliance training, global mobility"
                    />
                  </label>
                  <label className="form-field">
                    <span>Target Outcome *</span>
                    <input
                      type="text"
                      value={phaseForm.outcome}
                      onChange={(e) => setPhaseForm({ ...phaseForm, outcome: e.target.value })}
                      required
                      placeholder="e.g. Continuous Learning & Workforce Development"
                    />
                  </label>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="roster-btn primary" disabled={phaseSubmitting}>
                    {phaseSubmitting
                      ? "Saving Phase..."
                      : roadmap?.phases?.some((p) => p.phase_no === Number(phaseForm.phase_no))
                      ? "Update Phase"
                      : "+ Create Phase"}
                  </button>
                  <button type="button" className="roster-btn secondary" onClick={() => setPhaseModal(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* HR Deliverable Creation Modal */}
          {deliverableModal && (
            <div className="roster-modal-backdrop" onClick={() => setDeliverableModal(false)}>
              <form className="roster-modal" onSubmit={handleCreateDeliverable} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div>
                    <span className="roster-kicker">HR Deliverable Acceptance Criteria</span>
                    <h2>Add Deliverable to Phase {deliverableForm.phase_no}</h2>
                  </div>
                  <button type="button" className="close-btn" onClick={() => setDeliverableModal(false)}>✕</button>
                </div>
                <div className="modal-body">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
                    <label className="form-field">
                      <span>Deliverable Code *</span>
                      <input
                        type="text"
                        value={deliverableForm.deliverable_code}
                        onChange={(e) => setDeliverableForm({ ...deliverableForm, deliverable_code: e.target.value.toUpperCase() })}
                        required
                        placeholder="e.g. P5-COURSES"
                      />
                    </label>
                    <label className="form-field">
                      <span>Deliverable Title *</span>
                      <input
                        type="text"
                        value={deliverableForm.title}
                        onChange={(e) => setDeliverableForm({ ...deliverableForm, title: e.target.value })}
                        required
                        placeholder="e.g. L&D Course Catalog"
                      />
                    </label>
                  </div>
                  <label className="form-field">
                    <span>Description</span>
                    <textarea
                      rows={2}
                      value={deliverableForm.description}
                      onChange={(e) => setDeliverableForm({ ...deliverableForm, description: e.target.value })}
                      placeholder="e.g. Real-time verification of courses available in database"
                    />
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
                    <label className="form-field">
                      <span>Evidence Type *</span>
                      <select
                        value={deliverableForm.evidence_type}
                        onChange={(e) => setDeliverableForm({ ...deliverableForm, evidence_type: e.target.value })}
                        required
                      >
                        <option value="TABLE">TABLE (PostgreSQL live rows)</option>
                        <option value="FILE">FILE (Repository source file exists)</option>
                      </select>
                    </label>
                    <label className="form-field">
                      <span>{deliverableForm.evidence_type === "TABLE" ? "Table Name *" : "File Path *"}</span>
                      <input
                        type="text"
                        value={deliverableForm.evidence_ref}
                        onChange={(e) => setDeliverableForm({ ...deliverableForm, evidence_ref: e.target.value })}
                        required
                        placeholder={deliverableForm.evidence_type === "TABLE" ? "e.g. learning_courses" : "e.g. Front-End/src/pages/hr/Skill.jsx"}
                      />
                    </label>
                  </div>
                  {deliverableForm.evidence_type === "TABLE" && (
                    <label className="form-field">
                      <span>Minimum Rows to Count Live *</span>
                      <input
                        type="number"
                        min={0}
                        value={deliverableForm.min_rows}
                        onChange={(e) => setDeliverableForm({ ...deliverableForm, min_rows: e.target.value })}
                        required
                      />
                    </label>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
                    <label className="form-field">
                      <span>UI Screen Route (Optional)</span>
                      <input
                        type="text"
                        value={deliverableForm.ui_route}
                        onChange={(e) => setDeliverableForm({ ...deliverableForm, ui_route: e.target.value })}
                        placeholder="e.g. /hr/learning"
                      />
                    </label>
                    <label className="form-field">
                      <span>API Route (Optional)</span>
                      <input
                        type="text"
                        value={deliverableForm.api_route}
                        onChange={(e) => setDeliverableForm({ ...deliverableForm, api_route: e.target.value })}
                        placeholder="e.g. /api/learning"
                      />
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="roster-btn primary" disabled={deliverableSubmitting}>
                    {deliverableSubmitting ? "Adding Deliverable..." : "+ Add Deliverable"}
                  </button>
                  <button type="button" className="roster-btn secondary" onClick={() => setDeliverableModal(false)}>
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
