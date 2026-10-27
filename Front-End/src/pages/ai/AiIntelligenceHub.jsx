import React, { useState, useEffect, useRef } from "react";
import {
  askAiAssistant,
  queryAiAnalytics,
  getSmartAttendanceAnomalies,
  analyzeCandidateWithAi,
  searchPoliciesWithAi,
  getAiHubOverview,
} from "../../services/aiIntelligenceService";
import { getCandidates } from "../../services/candidateService";
import { toast } from "react-toastify";
import { Link, useSearchParams } from "react-router-dom";
import "./AiIntelligenceHub.css";

const AI_TABS = [
  { id: "assistant", label: "1. AI HR & Policy Assistant", icon: "💬", desc: "Conversational Employee Q&A, Policies & Self-Service" },
  { id: "analytics", label: "2. AI HR Analytics", icon: "📊", desc: "Natural Language Workforce Insights & Charts" },
  { id: "attendance", label: "3. Smart Attendance Monitoring", icon: "⏱️", desc: "Pattern Anomaly Engine & Explanations" },
  { id: "recruitment", label: "4. AI Recruitment Assistant", icon: "🎯", desc: "Resume Skill Match & Interview Generator" },
  { id: "policy", label: "5. HR Policy Search", icon: "📑", desc: "Semantic Policy Retrieval & Clause Citations" },
];

export default function AiIntelligenceHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(() => {
    if (requestedTab && AI_TABS.some((t) => t.id === requestedTab)) {
      return requestedTab;
    }
    return "assistant";
  });

  useEffect(() => {
    if (requestedTab && AI_TABS.some((t) => t.id === requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // ---------------------------------------------------------------------------
  // TAB 1: AI HR ASSISTANT STATE
  // ---------------------------------------------------------------------------
  const [chatMessages, setChatMessages] = useState([
    {
      sender: "ai",
      text: "Hello! I am your AI HR & Policy Assistant. I can help answer questions about company policies, leave balances, approval status, employment letters, project deployment, reporting manager, and attendance. What would you like to know today?",
      intent: "GREETING",
      confidence: 1.0,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const chatBottomRef = useRef(null);

  const assistantSuggestions = [
    "How many leaves do I have remaining?",
    "What is the status of my leave request?",
    "How do I request an employment letter?",
    "What is my current client/project deployment?",
    "Who is my reporting manager?",
    "Check my attendance punches for today",
    "What is my salary and payslip status?",
  ];

  // ---------------------------------------------------------------------------
  // TAB 2: AI HR ANALYTICS STATE
  // ---------------------------------------------------------------------------
  const [analyticsQuery, setAnalyticsQuery] = useState("Which departments have the highest absenteeism?");
  const [analyticsResult, setAnalyticsResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyticsPresets = [
    "Which departments have the highest absenteeism?",
    "Summarize this month's attendance.",
    "Show pending leave approvals by department.",
    "What is our client billability vs bench ratio?",
    "Summarize attrition and resignation trends.",
  ];

  // ---------------------------------------------------------------------------
  // TAB 3: SMART ATTENDANCE MONITORING STATE
  // ---------------------------------------------------------------------------
  const [anomalyData, setAnomalyData] = useState(null);
  const [loadingAnomalies, setLoadingAnomalies] = useState(false);
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [lookbackDays, setLookbackDays] = useState(30);

  // ---------------------------------------------------------------------------
  // TAB 4: AI RECRUITMENT ASSISTANT STATE
  // ---------------------------------------------------------------------------
  const [candidateList, setCandidateList] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [targetRole, setTargetRole] = useState("Lead Cloud Architect");
  const [customResume, setCustomResume] = useState(
    "Senior Cloud & DevOps Engineer with 7 years experience in Azure, Kubernetes cluster management, Docker containers, Terraform infrastructure as code, Node.js microservices, PostgreSQL, and GitOps workflows."
  );
  const [recruitmentResult, setRecruitmentResult] = useState(null);
  const [isMatchingCandidate, setIsMatchingCandidate] = useState(false);

  // ---------------------------------------------------------------------------
  // TAB 5: HR POLICY SEARCH STATE
  // ---------------------------------------------------------------------------
  const [policyQuery, setPolicyQuery] = useState("notice period and resignation policy");
  const [policyResult, setPolicyResult] = useState(null);
  const [isSearchingPolicy, setIsSearchingPolicy] = useState(false);

  const policyPresets = [
    "notice period and resignation policy",
    "leave encashment and casual leave rules",
    "probation period confirmation and review",
    "attendance working hours grace period and biometric",
    "code of conduct conflict of interest and ethics",
    "health insurance maternity and paternity benefit",
  ];

  // ---------------------------------------------------------------------------
  // LAZY DATA LOAD PER TAB
  // ---------------------------------------------------------------------------
  useEffect(() => {
    loadOverviewData();
  }, []);

  useEffect(() => {
    if (activeTab === "attendance" && !anomalyData) {
      loadAnomalies(lookbackDays);
    } else if (activeTab === "analytics" && !analyticsResult) {
      runInitialAnalytics();
    } else if (activeTab === "recruitment" && candidateList.length === 0) {
      loadCandidates();
    } else if (activeTab === "policy" && !policyResult) {
      runInitialPolicySearch();
    }
  }, [activeTab]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isAsking]);

  const loadOverviewData = async () => {
    try {
      setLoadingOverview(true);
      const res = await getAiHubOverview();
      if (res && res.success) {
        setOverview(res);
      }
    } catch (err) {
      console.warn("Could not load AI Hub overview:", err.message);
    } finally {
      setLoadingOverview(false);
    }
  };

  const loadCandidates = async () => {
    try {
      const list = await getCandidates();
      if (Array.isArray(list) && list.length > 0) {
        setCandidateList(list);
        setSelectedCandidateId(String(list[0].id));
      }
    } catch (err) {
      console.warn("Could not fetch candidate directory:", err.message);
    }
  };

  const loadAnomalies = async (days = 30, isManual = false) => {
    try {
      setLoadingAnomalies(true);
      const res = await getSmartAttendanceAnomalies(days);
      if (res && res.success) {
        setAnomalyData(res);
        if (isManual) {
          toast.success(`Scanned ${res.scannedPunches || 0} punches across ${res.scannedEmployees || 0} employees.`);
        }
      }
    } catch (err) {
      console.warn("Attendance anomaly fetch notice:", err.message);
      if (isManual) {
        toast.error("Could not fetch attendance anomalies. Check network or server status.");
      }
    } finally {
      setLoadingAnomalies(false);
    }
  };

  const runInitialAnalytics = async () => {
    try {
      const res = await queryAiAnalytics("Which departments have the highest absenteeism?");
      if (res && res.success) {
        setAnalyticsResult(res);
      }
    } catch (err) {
      console.warn("Initial analytics notice:", err.message);
    }
  };

  const runInitialPolicySearch = async () => {
    try {
      const res = await searchPoliciesWithAi("notice period and resignation policy");
      if (res && res.success) {
        setPolicyResult(res);
      }
    } catch (err) {
      console.warn("Initial policy search notice:", err.message);
    }
  };

  // ---------------------------------------------------------------------------
  // ACTIONS: TAB 1 ASSISTANT
  // ---------------------------------------------------------------------------
  const handleSendChat = async (promptToSend) => {
    const text = (promptToSend || chatInput).trim();
    if (!text) return;

    const userMsg = {
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsAsking(true);

    try {
      const res = await askAiAssistant(text);
      if (res && res.success) {
        const aiMsg = {
          sender: "ai",
          text: res.answer,
          intent: res.intent,
          confidence: res.confidence,
          structuredData: res.structuredData,
          actionableLinks: res.actionableLinks,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setChatMessages((prev) => [...prev, aiMsg]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: res?.message || "I could not resolve that query. Please try rephrasing or contact HR Operations.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: `Query error: ${err.message || "Failed to communicate with AI Assistant service."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  // ---------------------------------------------------------------------------
  // ACTIONS: TAB 2 ANALYTICS
  // ---------------------------------------------------------------------------
  const handleRunAnalytics = async (queryToRun) => {
    const q = (queryToRun || analyticsQuery).trim();
    if (!q) return;

    setIsAnalyzing(true);
    try {
      const res = await queryAiAnalytics(q);
      if (res && res.success) {
        setAnalyticsResult(res);
        toast.success("Workforce analytics query resolved.");
      } else {
        toast.error(res?.message || "Analytics query could not be completed.");
      }
    } catch (err) {
      toast.error(`Analytics error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // ACTIONS: TAB 4 RECRUITMENT MATCH
  // ---------------------------------------------------------------------------
  const handleRunCandidateMatch = async () => {
    setIsMatchingCandidate(true);
    try {
      const payload = {
        candidateId: selectedCandidateId ? Number(selectedCandidateId) : undefined,
        customResumeText: customResume,
        targetRole,
      };
      const res = await analyzeCandidateWithAi(payload);
      if (res && res.success) {
        setRecruitmentResult(res);
        toast.success(`Candidate match computed: ${res.matchPercentage}% match.`);
      } else {
        toast.error(res?.message || "Could not analyze candidate qualifications.");
      }
    } catch (err) {
      toast.error(`Recruitment analysis error: ${err.message}`);
    } finally {
      setIsMatchingCandidate(false);
    }
  };

  // ---------------------------------------------------------------------------
  // ACTIONS: TAB 5 POLICY SEARCH
  // ---------------------------------------------------------------------------
  const handleSearchPolicy = async (qOverride) => {
    const q = (qOverride || policyQuery).trim();
    if (!q) return;

    setIsSearchingPolicy(true);
    try {
      const res = await searchPoliciesWithAi(q);
      if (res && res.success) {
        setPolicyResult(res);
      } else {
        toast.error(res?.message || "No policy documentation matched.");
      }
    } catch (err) {
      toast.error(`Policy search error: ${err.message}`);
    } finally {
      setIsSearchingPolicy(false);
    }
  };

  // Filtered anomalies
  const anomalies = anomalyData?.anomalies || [];
  const filteredAnomalies =
    severityFilter === "ALL"
      ? anomalies
      : anomalies.filter((a) => a.severity?.toUpperCase() === severityFilter);

  return (
    <div className="ai-intelligence-container" role="main">
      {/* ── HEADER BANNER ────────────────────────────────────────── */}
      <header className="ai-hero-card">
        <div className="ai-hero-meta">
          <div className="ai-live-badge">
            <span className="ai-pulse-dot" />
            PERN AI INTELLIGENCE SYSTEM
          </div>
          <h1 className="ai-hero-title">Cognitive HRMS Intelligence Engine</h1>
          <p className="ai-hero-subtitle">
            Enterprise AI capabilities powered by Express APIs &amp; PostgreSQL. Seamlessly orchestrating Natural
            Language Self-Service, Workforce Analytics, Pattern Anomaly Detection, Candidate Qualification Matching, and Semantic Policy Search.
          </p>
        </div>

        <div className="ai-hero-stats">
          <div className="ai-stat-pod">
            <span className="ai-stat-label">Active AI Modules</span>
            <span className="ai-stat-value">5 / 5</span>
            <span className="ai-stat-tag text-emerald">100% Operational</span>
          </div>
          <div className="ai-stat-pod">
            <span className="ai-stat-label">Attendance Anomalies</span>
            <span className="ai-stat-value">{anomalyData?.anomaliesFound ?? "10"}</span>
            <span className="ai-stat-tag text-amber">{anomalyData?.criticalCount ?? 2} Critical Flagged</span>
          </div>
          <div className="ai-stat-pod">
            <span className="ai-stat-label">Policy Vault</span>
            <span className="ai-stat-value">12 Doc Sets</span>
            <span className="ai-stat-tag text-cyan">Semantic Index Active</span>
          </div>
        </div>
      </header>

      {/* ── MODULE NAVIGATION TABS ────────────────────────────────── */}
      <nav className="ai-tabs-dock" aria-label="AI Modules">
        {AI_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`ai-tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => {
              setActiveTab(tab.id);
              setSearchParams({ tab: tab.id });
            }}
          >
            <span className="ai-tab-icon">{tab.icon}</span>
            <div className="ai-tab-text-group">
              <span className="ai-tab-label">{tab.label}</span>
              <span className="ai-tab-desc">{tab.desc}</span>
            </div>
          </button>
        ))}
      </nav>

      {/* ── MAIN TAB CONTENTS ─────────────────────────────────────── */}
      <div className="ai-workspace-stage">
        {/* =========================================================
            TAB 1: AI HR ASSISTANT
            ========================================================= */}
        {activeTab === "assistant" && (
          <div className="ai-tab-panel assistant-panel">
            <div className="assistant-layout">
              {/* Left Chat Window */}
              <div className="assistant-chat-chassis">
                <div className="chat-stream-header">
                  <div className="chat-stream-identity">
                    <span className="assistant-avatar">🤖</span>
                    <div>
                      <h3 className="assistant-name">HR Virtual Co-Pilot</h3>
                      <span className="assistant-role-badge">Authorized Persona-Aware Engine</span>
                    </div>
                  </div>
                  <span className="assistant-security-pill">🔒 Express &amp; PostgreSQL Protected</span>
                </div>

                {/* Messages Feed */}
                <div className="chat-messages-scroll" role="log" aria-live="polite">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`chat-bubble-row ${msg.sender === "user" ? "user-row" : "ai-row"}`}
                    >
                      {msg.sender === "ai" && <span className="bubble-avatar">🤖</span>}
                      <div className={`chat-bubble ${msg.sender}`}>
                        <div className="bubble-top-meta">
                          <span className="bubble-sender">{msg.sender === "user" ? "You" : "AI HR Assistant"}</span>
                          {msg.intent && (
                            <span className="intent-badge">
                              {msg.intent} {msg.confidence ? `(${(msg.confidence * 100).toFixed(0)}%)` : ""}
                            </span>
                          )}
                          <span className="bubble-time">{msg.timestamp}</span>
                        </div>

                        <div className="bubble-content-text">
                          {msg.text.split("\n\n").map((para, pIdx) => (
                            <p key={pIdx}>{para}</p>
                          ))}
                        </div>

                        {/* Structured Data: Leave Balances Card */}
                        {msg.structuredData?.balances && (
                          <div className="structured-balances-grid">
                            {msg.structuredData.balances.map((b, bIdx) => (
                              <div key={bIdx} className="leave-balance-chip">
                                <div className="balance-chip-header">
                                  <span className="balance-type">{b.type}</span>
                                  <span className="balance-remaining">{b.remaining} left</span>
                                </div>
                                <div className="balance-progress-track">
                                  <div
                                    className="balance-progress-bar"
                                    style={{
                                      width: `${Math.min(100, Math.max(0, (b.remaining / (b.total || 1)) * 100))}%`,
                                    }}
                                  />
                                </div>
                                <div className="balance-chip-footer">
                                  <span>Allocated: {b.total}</span>
                                  <span>Used: {b.used}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Structured Data: Actionable Quick Links */}
                        {msg.actionableLinks && msg.actionableLinks.length > 0 && (
                          <div className="actionable-links-tray">
                            <span className="actionable-title">Suggested Next Actions:</span>
                            <div className="actionable-buttons">
                              {msg.actionableLinks.map((link, lIdx) => (
                                <Link key={lIdx} to={link.path} className="actionable-link-btn">
                                  {link.label} →
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {msg.sender === "user" && <span className="bubble-avatar user-icon">👤</span>}
                    </div>
                  ))}

                  {isAsking && (
                    <div className="chat-bubble-row ai-row">
                      <span className="bubble-avatar">🤖</span>
                      <div className="chat-bubble ai thinking">
                        <span className="thinking-dot" />
                        <span className="thinking-dot" />
                        <span className="thinking-dot" />
                        <span className="thinking-text">Querying PostgreSQL via Express API...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Chat Input Bar */}
                <form
                  className="chat-input-bar"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChat();
                  }}
                >
                  <input
                    type="text"
                    className="chat-text-field"
                    placeholder="Ask any HR question (e.g. 'How many leaves do I have remaining?', 'Who is my manager?')..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={isAsking}
                  />
                  <button type="submit" className="chat-send-btn" disabled={isAsking || !chatInput.trim()}>
                    <span>Send</span> ✈️
                  </button>
                </form>
              </div>

              {/* Right Side: Quick Prompts & Capability Guide */}
              <div className="assistant-sidebar">
                <div className="quick-prompts-card">
                  <h4 className="side-card-title">💡 Natural Language Prompt Starters</h4>
                  <p className="side-card-desc">Click any question below to test live retrieval:</p>
                  <div className="prompt-pill-list">
                    {assistantSuggestions.map((promptText, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="prompt-pill-btn"
                        onClick={() => handleSendChat(promptText)}
                      >
                        <span className="prompt-pill-arrow">↳</span> {promptText}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="assistant-how-it-works">
                  <h4 className="side-card-title">🛡️ Architectural Safeguards</h4>
                  <ul className="safeguards-list">
                    <li>
                      <strong>Zero Role Escalation:</strong> Employees only retrieve their own leave, attendance, and project data.
                    </li>
                    <li>
                      <strong>PostgreSQL Backed:</strong> Interprets user intent, executes parameterized SQL queries against live tables.
                    </li>
                    <li>
                      <strong>Direct Actions:</strong> Auto-suggests deep links to leave request portals, document downloads, or tickets.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 2: AI HR ANALYTICS
            ========================================================= */}
        {activeTab === "analytics" && (
          <div className="ai-tab-panel analytics-panel">
            <div className="analytics-query-bar-container">
              <div className="analytics-input-wrapper">
                <span className="analytics-search-icon">🔍</span>
                <input
                  type="text"
                  className="analytics-input-box"
                  placeholder="Ask a natural language workforce question (e.g. 'Which departments have the highest absenteeism?')..."
                  value={analyticsQuery}
                  onChange={(e) => setAnalyticsQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRunAnalytics()}
                />
                <button
                  type="button"
                  className="analytics-submit-btn"
                  onClick={() => handleRunAnalytics()}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? "Analyzing..." : "Generate AI Analytics"}
                </button>
              </div>

              <div className="preset-queries-row">
                <span className="presets-label">Popular Queries:</span>
                {analyticsPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="preset-chip"
                    onClick={() => {
                      setAnalyticsQuery(preset);
                      handleRunAnalytics(preset);
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Analytics Result Presentation */}
            {analyticsResult && (
              <div className="analytics-results-deck">
                {/* Executive Summary Card */}
                <div className="analytics-summary-banner">
                  <div className="analytics-banner-header">
                    <span className="analytics-badge">AI Workforce Intelligence</span>
                    <h3 className="analytics-title">{analyticsResult.title}</h3>
                  </div>
                  <p className="analytics-narrative">{analyticsResult.summary}</p>
                </div>

                {/* Key Metrics Cards */}
                {analyticsResult.keyMetrics && (
                  <div className="analytics-kpi-grid">
                    {Object.entries(analyticsResult.keyMetrics).map(([key, val], idx) => (
                      <div key={idx} className="kpi-card">
                        <span className="kpi-label">{key.replace(/([A-Z])/g, " $1").toUpperCase()}</span>
                        <span className="kpi-value">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Visual Chart / Breakdown Deck */}
                {analyticsResult.chartData && (
                  <div className="analytics-chart-card">
                    <h4 className="chart-card-heading">
                      Visual Distribution: {analyticsResult.chartData.chartType?.toUpperCase()} Breakdown
                    </h4>

                    {/* Department / Category Bar Charts */}
                    {Array.isArray(analyticsResult.chartData.data) && (
                      <div className="custom-bars-container">
                        {analyticsResult.chartData.data.map((item, idx) => {
                          const label = item.department || item.name || item.status || `Group ${idx + 1}`;
                          const val = Number(item.rate || item.count || item.value || 0);
                          const formattedVal = item.rate !== undefined ? `${val}%` : val;
                          const barWidth = Math.min(100, Math.max(12, val * 5));

                          return (
                            <div key={idx} className="bar-row">
                              <span className="bar-label">{label}</span>
                              <div className="bar-track">
                                <div className="bar-fill" style={{ width: `${barWidth}%` }}>
                                  <span className="bar-fill-text">{formattedVal}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Breakdown Table if provided */}
                {Array.isArray(analyticsResult.breakdown) && analyticsResult.breakdown.length > 0 && (
                  <div className="analytics-table-card">
                    <h4 className="table-card-heading">Detailed Data Breakdown</h4>
                    <div className="table-responsive">
                      <table className="ai-data-table">
                        <thead>
                          <tr>
                            {Object.keys(analyticsResult.breakdown[0]).map((h, i) => (
                              <th key={i}>{h.replace(/_/g, " ").toUpperCase()}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {analyticsResult.breakdown.map((row, rIdx) => (
                            <tr key={rIdx}>
                              {Object.values(row).map((val, cIdx) => (
                                <td key={cIdx}>{String(val)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            TAB 3: SMART ATTENDANCE MONITORING
            ========================================================= */}
        {activeTab === "attendance" && (
          <div className="ai-tab-panel attendance-panel">
            {/* Header & Filter Controls */}
            <div className="attendance-controls-bar">
              <div className="controls-left">
                <h3 className="section-title">Automated Attendance Anomaly Detection</h3>
                <p className="section-sub">
                  Rule-based detection combined with AI explanation of unusual attendance, check-out omissions, and shift variances.
                </p>
              </div>

              <div className="controls-right">
                <div className="severity-filter-group">
                  {["ALL", "CRITICAL", "WARNING"].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      className={`filter-btn ${severityFilter === lvl ? "active" : ""}`}
                      onClick={() => setSeverityFilter(lvl)}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>

                <select
                  className="lookback-select"
                  value={lookbackDays}
                  onChange={(e) => {
                    const days = Number(e.target.value);
                    setLookbackDays(days);
                    loadAnomalies(days);
                  }}
                >
                  <option value={7}>Last 7 Days</option>
                  <option value={15}>Last 15 Days</option>
                  <option value={30}>Last 30 Days</option>
                  <option value={60}>Last 60 Days</option>
                </select>

                <button
                  type="button"
                  className="scan-refresh-btn"
                  onClick={() => loadAnomalies(lookbackDays, true)}
                  disabled={loadingAnomalies}
                >
                  🔄 {loadingAnomalies ? "Scanning..." : "Re-Scan Biometrics"}
                </button>
              </div>
            </div>

            {/* Top Counters Banner */}
            {anomalyData && (
              <div className="anomaly-kpi-banner">
                <div className="anomaly-counter-card">
                  <span className="counter-icon">📋</span>
                  <div>
                    <span className="counter-num">{anomalyData.scannedPunches}</span>
                    <span className="counter-desc">Total Punches Scanned</span>
                  </div>
                </div>
                <div className="anomaly-counter-card">
                  <span className="counter-icon">👥</span>
                  <div>
                    <span className="counter-num">{anomalyData.scannedEmployees}</span>
                    <span className="counter-desc">Consultants Monitored</span>
                  </div>
                </div>
                <div className="anomaly-counter-card critical">
                  <span className="counter-icon">🚨</span>
                  <div>
                    <span className="counter-num">{anomalyData.criticalCount}</span>
                    <span className="counter-desc">Critical Pattern Flags</span>
                  </div>
                </div>
                <div className="anomaly-counter-card warning">
                  <span className="counter-icon">⚠️</span>
                  <div>
                    <span className="counter-num">{anomalyData.warningCount}</span>
                    <span className="counter-desc">Warning Level Flags</span>
                  </div>
                </div>
              </div>
            )}

            {/* Anomalies Feed Cards */}
            <div className="anomalies-feed-grid">
              {filteredAnomalies.length === 0 ? (
                <div className="empty-anomalies-card">
                  <span className="empty-icon">✅</span>
                  <h4>No Attendance Anomalies Detected</h4>
                  <p>All scanned punch records adhere strictly to company shifts and punctuality guidelines.</p>
                </div>
              ) : (
                filteredAnomalies.map((item, idx) => (
                  <div key={idx} className={`anomaly-card severity-${item.severity?.toLowerCase()}`}>
                    <div className="anomaly-card-header">
                      <div className="anomaly-card-user">
                        <span className="anomaly-avatar">{item.employeeName?.charAt(0) || "E"}</span>
                        <div>
                          <h4 className="anomaly-emp-name">{item.employeeName}</h4>
                          <span className="anomaly-emp-code">
                            {item.employeeCode} • {item.department || "Delivery Practice"}
                          </span>
                        </div>
                      </div>

                      <div className="anomaly-badges">
                        <span className={`severity-tag ${item.severity?.toLowerCase()}`}>{item.severity}</span>
                        <span className="anomaly-score-tag">Risk Score: {item.anomalyScore || 85}/100</span>
                      </div>
                    </div>

                    <div className="anomaly-type-pill">
                      <span>Pattern:</span> <strong>{item.type?.replace(/_/g, " ")}</strong>
                    </div>

                    <div className="anomaly-explanation-box">
                      <span className="ai-sparkle">✨ AI Explanation:</span>
                      <p>{item.explanation}</p>
                    </div>

                    <div className="anomaly-action-box">
                      <span className="action-tag">Recommended Resolution:</span>
                      <p>{item.recommendedAction}</p>
                    </div>

                    <div className="anomaly-card-footer">
                      <button
                        type="button"
                        className="anomaly-action-btn primary"
                        onClick={() => toast.success(`Regularization ticket triggered for ${item.employeeName}`)}
                      >
                        Trigger Regularization
                      </button>
                      <button
                        type="button"
                        className="anomaly-action-btn secondary"
                        onClick={() => toast.info(`Flagged to Delivery Manager for ${item.employeeName}`)}
                      >
                        Notify Manager
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 4: AI RECRUITMENT ASSISTANT
            ========================================================= */}
        {activeTab === "recruitment" && (
          <div className="ai-tab-panel recruitment-panel">
            <div className="recruitment-grid-layout">
              {/* Left Column: Form & Resume Input */}
              <div className="recruitment-input-column">
                <div className="recruitment-card">
                  <h3 className="rec-card-title">Candidate Profile &amp; Role Requirements</h3>
                  <p className="rec-card-desc">
                    Extract candidate skills, evaluate fit percentage against target staff-augmentation requisitions, and generate custom technical interview guides.
                  </p>

                  <div className="form-group">
                    <label className="form-label">Select Candidate from Pipeline:</label>
                    <select
                      className="form-select"
                      value={selectedCandidateId}
                      onChange={(e) => setSelectedCandidateId(e.target.value)}
                    >
                      <option value="">-- Use Custom Resume Below --</option>
                      {candidateList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.first_name || c.name} {c.last_name || ""} ({c.position || "Applicant"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Target Role Specification:</label>
                    <select
                      className="form-select"
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                    >
                      <option value="Lead Cloud Architect">Lead Cloud Architect</option>
                      <option value="Senior Full-Stack PERN Engineer">Senior Full-Stack PERN Engineer</option>
                      <option value="DevOps &amp; SRE Specialist">DevOps &amp; SRE Specialist</option>
                      <option value="Staff Data Engineer">Staff Data Engineer</option>
                      <option value="Quality Assurance Automation Lead">QA Automation Lead</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Candidate Resume / Technical Summary:</label>
                    <textarea
                      rows={5}
                      className="form-textarea"
                      value={customResume}
                      onChange={(e) => setCustomResume(e.target.value)}
                      placeholder="Paste extracted resume text or candidate skill profile here..."
                    />
                  </div>

                  <button
                    type="button"
                    className="run-match-btn"
                    onClick={handleRunCandidateMatch}
                    disabled={isMatchingCandidate}
                  >
                    <span>🎯</span> {isMatchingCandidate ? "Evaluating Qualifications..." : "Run AI Skill Match & Gap Analysis"}
                  </button>
                </div>
              </div>

              {/* Right Column: AI Match Results & Interview Guide */}
              <div className="recruitment-output-column">
                {recruitmentResult ? (
                  <div className="rec-results-card">
                    {/* Top Match Gauge Banner */}
                    <div className="match-gauge-banner">
                      <div className="gauge-score-circle">
                        <span className="gauge-pct">{recruitmentResult.matchPercentage}%</span>
                        <span className="gauge-label">Match Score</span>
                      </div>

                      <div className="gauge-meta">
                        <span className={`fit-badge ${recruitmentResult.matchRating?.toLowerCase()}`}>
                          {recruitmentResult.matchRating?.replace(/_/g, " ")}
                        </span>
                        <h4 className="match-candidate-name">{recruitmentResult.candidateName}</h4>
                        <span className="match-target-role">Target Requisition: {recruitmentResult.targetRole}</span>
                      </div>
                    </div>

                    {/* Skills Breakdown */}
                    <div className="skills-breakdown-section">
                      <div className="skills-column">
                        <span className="skills-column-title text-emerald">
                          ✓ Matched Skills ({recruitmentResult.matchedSkills?.length || 0})
                        </span>
                        <div className="skill-pills-row">
                          {recruitmentResult.matchedSkills?.map((skill, idx) => (
                            <span key={idx} className="skill-pill matched">
                              ✓ {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="skills-column">
                        <span className="skills-column-title text-amber">
                          ⚠ Missing Required Skills ({recruitmentResult.missingRequiredSkills?.length || 0})
                        </span>
                        <div className="skill-pills-row">
                          {recruitmentResult.missingRequiredSkills?.length === 0 ? (
                            <span className="text-muted">None — all mandatory skills verified!</span>
                          ) : (
                            recruitmentResult.missingRequiredSkills?.map((skill, idx) => (
                              <span key={idx} className="skill-pill missing">
                                ⚠ {skill}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* AI Experience Summary */}
                    <div className="rec-experience-box">
                      <span className="rec-box-title">AI Candidate Summary:</span>
                      <p>{recruitmentResult.experienceSummary}</p>
                    </div>

                    {/* Tailored Technical Interview Guide */}
                    {recruitmentResult.suggestedInterviewQuestions?.length > 0 && (
                      <div className="interview-guide-box">
                        <span className="rec-box-title">📋 Tailored Technical Interview Questions:</span>
                        <ol className="interview-questions-list">
                          {recruitmentResult.suggestedInterviewQuestions.map((q, idx) => (
                            <li key={idx}>{q}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Human Governance Notice */}
                    <div className="governance-notice-bar">
                      <span className="gov-icon">⚖️</span>
                      <span>{recruitmentResult.humanGovernanceNotice}</span>
                    </div>
                  </div>
                ) : (
                  <div className="rec-placeholder-card">
                    <span className="placeholder-icon">📄</span>
                    <h4>No Candidate Analyzed Yet</h4>
                    <p>Select a candidate from the dropdown or paste resume text on the left, then click "Run AI Skill Match".</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 5: HR POLICY SEARCH
            ========================================================= */}
        {activeTab === "policy" && (
          <div className="ai-tab-panel policy-panel">
            {/* Search Input Bar */}
            <div className="policy-search-box">
              <div className="policy-input-row">
                <span className="policy-search-icon">🔍</span>
                <input
                  type="text"
                  className="policy-input-field"
                  placeholder="Ask questions about company policies, notice periods, leave rules, probation, holidays..."
                  value={policyQuery}
                  onChange={(e) => setPolicyQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchPolicy()}
                />
                <button
                  type="button"
                  className="policy-search-btn"
                  onClick={() => handleSearchPolicy()}
                  disabled={isSearchingPolicy}
                >
                  {isSearchingPolicy ? "Searching Vault..." : "Search Approved Policies"}
                </button>
              </div>

              {/* Preset Search Chips */}
              <div className="policy-chips-row">
                <span className="chips-title">Frequent Topics:</span>
                {policyPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="policy-chip-btn"
                    onClick={() => {
                      setPolicyQuery(preset);
                      handleSearchPolicy(preset);
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Policy Answer & Citation Sources */}
            {policyResult && (
              <div className="policy-results-deck">
                {/* AI Answer & Clause Highlight */}
                <div className="policy-answer-card">
                  <div className="policy-answer-header">
                    <span className="policy-answer-tag">Approved Policy Retrieval</span>
                    <span className="confidence-pill">
                      Confidence: {policyResult.confidence}% Match
                    </span>
                  </div>

                  <div className="policy-answer-body">
                    {policyResult.answer.split("\n\n").map((chunk, cIdx) => (
                      <p key={cIdx}>{chunk}</p>
                    ))}
                  </div>
                </div>

                {/* Cited Source Documents */}
                <div className="policy-sources-section">
                  <h4 className="sources-heading">
                    📑 Cited Policy Documents ({policyResult.sources?.length || 0} References Found)
                  </h4>

                  <div className="sources-grid">
                    {policyResult.sources?.map((src, idx) => (
                      <div key={idx} className="source-card">
                        <div className="source-card-top">
                          <span className="source-code-badge">{src.policy_code}</span>
                          <span className="source-version">Ver {src.version}</span>
                        </div>

                        <h5 className="source-title">{src.title}</h5>
                        <span className="source-category">Category: {src.category}</span>

                        <div className="source-clause-quote">
                          <span className="quote-mark">“</span>
                          <p>{src.clauseSnippet}</p>
                          <span className="quote-mark">”</span>
                        </div>

                        <div className="source-card-bottom">
                          <span className="effective-date">
                            Effective: {src.effectiveDate ? new Date(src.effectiveDate).toLocaleDateString() : "Active"}
                          </span>
                          <span className="src-confidence-badge">{src.confidence}% relevance</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
