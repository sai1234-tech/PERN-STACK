import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  askAiAssistant,
  queryAiAnalytics,
  getSmartAttendanceAnomalies,
  analyzeCandidateWithAi,
  searchPoliciesWithAi,
  getAiHubOverview,
} from "../../services/aiIntelligenceService";
import { getCandidates } from "../../services/candidateService";
import { useAuth } from "../../context/AuthContext";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import { toast } from "react-toastify";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import "./AiIntelligenceHub.css";

const AI_TABS = [
  { id: "assistant", label: "1. AI HR & Policy Assistant", icon: "💬", desc: "Conversational Employee Q&A, Policies & Self-Service" },
  { id: "analytics", label: "2. AI HR Analytics", icon: "📊", desc: "Natural Language Workforce Insights & Charts" },
  { id: "attendance", label: "3. Smart Attendance Monitoring", icon: "⏱️", desc: "Real-Time Biometric Telemetry & Anomaly Engine" },
  { id: "recruitment", label: "4. AI Recruitment Assistant", icon: "🎯", desc: "Resume Skill Match & Interview Generator" },
  { id: "policy", label: "5. HR Policy Search", icon: "📑", desc: "Semantic Policy Retrieval & Clause Citations" },
];

const PATTERN_ICONS = {
  CHRONIC_LATE_ARRIVALS: "⏰",
  LATE_ARRIVAL_VARIANCE: "🕒",
  MISSING_PUNCH_OUT: "🚪",
  SHIFT_DURATION_VARIANCE: "📉",
  UNEXCUSED_ABSENCE_GAP: "🚫",
  PENDING_REGULARIZATION_REVIEW: "📝",
};

function buildCandidateProfileSummary(c) {
  if (!c) return "";
  const skillsStr = Array.isArray(c.skills) ? c.skills.join(", ") : String(c.skills || "");
  return [
    c.name || `${c.first_name || ""} ${c.last_name || ""}`.trim(),
    c.designation ? `Role: ${c.designation}` : "",
    c.department ? `Department: ${c.department}` : "",
    c.experience ? `Experience: ${c.experience}` : "",
    skillsStr ? `Technical Skills: ${skillsStr}` : "",
    c.status ? `Pipeline Stage: ${c.status}` : "",
    c.bgv_status ? `BGV Status: ${c.bgv_status}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

export default function AiIntelligenceHub() {
  const navigate = useNavigate();
  const { user, employee: currentEmployee } = useAuth();
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
      text: "Hello! I am your AI HR & Policy Assistant connected to live PostgreSQL records. Ask me about your leave balances, leave status, employment letters, project deployment, reporting manager, attendance punches, or company policies.",
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
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [patternFilter, setPatternFilter] = useState("ALL");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [attendanceViewMode, setAttendanceViewMode] = useState("anomalies"); // "anomalies" | "roster"
  const [lookbackDays, setLookbackDays] = useState(30);

  // ---------------------------------------------------------------------------
  // TAB 4: AI RECRUITMENT ASSISTANT STATE
  // ---------------------------------------------------------------------------
  const [candidateList, setCandidateList] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [targetRole, setTargetRole] = useState("Lead Cloud Architect");
  const [customResume, setCustomResume] = useState("");
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
    if (activeTab === "attendance" && !Array.isArray(anomalyData?.anomalies)) {
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
        if (res.attendanceSummary) {
          setAnomalyData((prev) =>
            prev?.anomalies
              ? prev
              : {
                  scope: res.attendanceSummary.scope,
                  lookbackDays: res.attendanceSummary.lookbackDays ?? 30,
                  anomaliesFound: res.attendanceSummary.anomaliesDetected,
                  criticalCount: res.attendanceSummary.criticalAlerts,
                  warningCount: res.attendanceSummary.warningAlerts,
                  scannedPunches: res.attendanceSummary.scannedPunches ?? 0,
                  scannedEmployees: res.attendanceSummary.scannedEmployees ?? 0,
                  employeesWithPunches: res.attendanceSummary.employeesWithPunches ?? 0,
                  overallPunctualityRate: res.attendanceSummary.overallPunctualityRate ?? 100,
                  avgWorkforceHours: res.attendanceSummary.avgWorkforceHours ?? 0,
                  autoClosedCount: res.attendanceSummary.autoClosedCount ?? 0,
                  departmentBreakdown: res.attendanceSummary.departmentBreakdown ?? [],
                  patternBreakdown: res.attendanceSummary.patternBreakdown ?? [],
                  employeeTelemetry: res.attendanceSummary.employeeTelemetry ?? [],
                  recentPunches: res.attendanceSummary.recentPunches ?? [],
                  anomalies: res.attendanceSummary.anomalies ?? [],
                }
          );
        }
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
        const first = list[0];
        const firstId = String(first.id);
        const firstSummary = buildCandidateProfileSummary(first);
        const initialRole = first.designation && [
          "Lead Cloud Architect",
          "Senior Full-Stack PERN Engineer",
          "DevOps & SRE Specialist",
          "Staff Data Engineer",
          "Quality Assurance Automation Lead"
        ].includes(first.designation)
          ? first.designation
          : targetRole;

        setSelectedCandidateId(firstId);
        setCustomResume(firstSummary);

        // Immediately run live AI candidate analysis against DB record
        const matchRes = await analyzeCandidateWithAi({
          candidateId: Number(first.id),
          customResumeText: firstSummary,
          targetRole: initialRole,
        });
        if (matchRes && matchRes.success) {
          setRecruitmentResult(matchRes);
        }
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
          toast.success(
            `Scanned ${res.scannedPunches || 0} biometric punches across ${res.scannedEmployees || 0} employees.`
          );
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
        toast.success("Workforce analytics query resolved from PostgreSQL.");
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
  const handleCandidateSelectChange = (candId) => {
    setSelectedCandidateId(candId);
    if (!candId) {
      setCustomResume("");
      return;
    }
    const found = candidateList.find((c) => String(c.id) === String(candId));
    if (found) {
      setCustomResume(buildCandidateProfileSummary(found));
    }
  };

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

  // ---------------------------------------------------------------------------
  // DERIVED SMART ATTENDANCE FILTERS & ROLE-SCOPED TELEMETRY
  // ---------------------------------------------------------------------------
  const userRoleLower = String(user?.role || "employee").toLowerCase();
  const isHrEnterpriseView = useMemo(() => {
    if (anomalyData?.scope) {
      return anomalyData.scope === "ENTERPRISE";
    }
    return (
      ["hr", "admin", "super_admin", "hr_admin", "hr_manager", "hr_operations", "leadership", "executive"].includes(
        userRoleLower
      ) ||
      userRoleLower.includes("hr") ||
      userRoleLower.includes("admin")
    );
  }, [anomalyData?.scope, userRoleLower]);

  const matchesLoggedInEmployee = (record) => {
    if (!record) return false;
    const myUserId = user?.id || user?.userId;
    const myEmpId = currentEmployee?.id;
    const myEmpCode = currentEmployee?.employee_code;
    const myEmail = (user?.email || currentEmployee?.email || "").toLowerCase();
    const myName = (
      currentEmployee?.first_name
        ? `${currentEmployee.first_name} ${currentEmployee.last_name || ""}`.trim()
        : user?.name || ""
    ).toLowerCase();

    if (myUserId && (String(record.userId) === String(myUserId) || String(record.employeeId) === String(myUserId))) {
      return true;
    }
    if (myEmpId && (String(record.employeeId) === String(myEmpId) || String(record.userId) === String(myEmpId))) {
      return true;
    }
    if (myEmpCode && record.employeeCode && String(record.employeeCode).toLowerCase() === String(myEmpCode).toLowerCase()) {
      return true;
    }
    if (myEmail && record.employeeEmail && String(record.employeeEmail).toLowerCase() === myEmail) {
      return true;
    }
    if (myName && record.employeeName && String(record.employeeName).toLowerCase() === myName) {
      return true;
    }
    return false;
  };

  const anomalies = useMemo(() => {
    const raw = anomalyData?.anomalies || [];
    if (isHrEnterpriseView) return raw;
    if (anomalyData?.scope === "PERSONAL") return raw;
    return raw.filter(matchesLoggedInEmployee);
  }, [anomalyData, isHrEnterpriseView, user, currentEmployee]);

  const employeeTelemetry = useMemo(() => {
    const raw = anomalyData?.employeeTelemetry || [];
    if (isHrEnterpriseView) return raw;
    if (anomalyData?.scope === "PERSONAL") return raw;
    return raw.filter(matchesLoggedInEmployee);
  }, [anomalyData, isHrEnterpriseView, user, currentEmployee]);

  const recentPunches = useMemo(() => {
    const raw = anomalyData?.recentPunches || [];
    if (isHrEnterpriseView) return raw;
    if (anomalyData?.scope === "PERSONAL") return raw;
    return raw.filter(matchesLoggedInEmployee);
  }, [anomalyData, isHrEnterpriseView, user, currentEmployee]);

  const availableDepartments = useMemo(() => {
    const depts = new Set();
    anomalies.forEach((a) => {
      if (a.department) depts.add(a.department);
    });
    employeeTelemetry.forEach((e) => {
      if (e.department) depts.add(e.department);
    });
    return ["ALL", ...Array.from(depts).sort()];
  }, [anomalies, employeeTelemetry]);

  const availablePatterns = useMemo(() => {
    const map = new Map();
    anomalies.forEach((a) => {
      const type = a.type || a.patternType;
      const label = a.patternLabel || type?.replace(/_/g, " ");
      if (type) {
        map.set(type, { type, label, count: (map.get(type)?.count || 0) + 1 });
      }
    });
    return Array.from(map.values());
  }, [anomalies]);

  const filteredAnomalies = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    return anomalies.filter((item) => {
      if (severityFilter !== "ALL" && item.severity?.toUpperCase() !== severityFilter) {
        return false;
      }
      if (isHrEnterpriseView && departmentFilter !== "ALL" && item.department !== departmentFilter) {
        return false;
      }
      if (patternFilter !== "ALL" && (item.type || item.patternType) !== patternFilter) {
        return false;
      }
      if (isHrEnterpriseView && q) {
        const hay = `${item.employeeName || ""} ${item.employeeCode || ""} ${item.department || ""} ${item.designation || ""} ${item.managerName || ""} ${item.patternLabel || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [anomalies, severityFilter, departmentFilter, patternFilter, employeeSearch, isHrEnterpriseView]);

  const filteredRoster = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    return employeeTelemetry.filter((emp) => {
      if (isHrEnterpriseView && departmentFilter !== "ALL" && emp.department !== departmentFilter) {
        return false;
      }
      if (isHrEnterpriseView && q) {
        const hay = `${emp.employeeName || ""} ${emp.employeeCode || ""} ${emp.department || ""} ${emp.designation || ""} ${emp.managerName || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [employeeTelemetry, departmentFilter, employeeSearch, isHrEnterpriseView]);

  return (
    <>
      <EmployeeHeader />
      <div className="ai-intelligence-container" role="main">
        {/* ── HEADER BANNER ────────────────────────────────────────── */}
      <header className="ai-hero-card">
        <div className="ai-hero-meta">
          <div className="ai-live-badge">
            <span className="ai-pulse-dot" />
            PERN AI INTELLIGENCE SYSTEM • LIVE POSTGRESQL TELEMETRY
          </div>
          <h1 className="ai-hero-title">Cognitive HRMS Intelligence Engine</h1>
          <p className="ai-hero-subtitle">
            Enterprise AI capabilities powered 100% by live Express APIs &amp; PostgreSQL relational tables.
            Orchestrating Natural Language Self-Service, Workforce Analytics, Biometric Pattern Anomaly Detection,
            Candidate Qualification Matching, and Semantic Policy Search.
          </p>
        </div>

        <div className="ai-hero-stats">
          <div
            className="ai-stat-pod"
            title="All AI cognitive subsystems currently active"
          >
            <span className="ai-stat-label">Active AI Modules</span>
            <span className="ai-stat-value">
              {overview?.moduleSummary?.activeCount ??
                overview?.featuresEnabled?.filter((f) => f.status === "Active")?.length ??
                AI_TABS.length}{" "}
              / {overview?.moduleSummary?.totalCount ?? overview?.featuresEnabled?.length ?? AI_TABS.length}
            </span>
            <span className="ai-stat-tag text-emerald">
              {overview?.moduleSummary?.statusText ?? "100% Operational"}
            </span>
          </div>
          <div
            className="ai-stat-pod"
            onClick={() => {
              setActiveTab("attendance");
              setSearchParams({ tab: "attendance" });
            }}
            style={{ cursor: "pointer" }}
            title="Click to view Attendance Anomaly Detection Engine"
          >
            <span className="ai-stat-label">Attendance Anomalies</span>
            <span className="ai-stat-value">
              {anomalyData?.anomaliesFound ?? overview?.attendanceSummary?.anomaliesDetected ?? 0}
            </span>
            <span className="ai-stat-tag text-amber">
              {anomalyData?.criticalCount ?? overview?.attendanceSummary?.criticalAlerts ?? 0} Critical Flagged
            </span>
          </div>
          <div
            className="ai-stat-pod"
            onClick={() => {
              setActiveTab("policy");
              setSearchParams({ tab: "policy" });
            }}
            style={{ cursor: "pointer" }}
            title="Click to view Semantic HR Policy Vault"
          >
            <span className="ai-stat-label">Policy Vault</span>
            <span className="ai-stat-value">
              {`${overview?.policySummary?.totalPolicySets ?? 0} Doc Sets`}
            </span>
            <span className="ai-stat-tag text-cyan">
              {overview?.policySummary?.semanticIndexStatus ?? "PostgreSQL Indexed"}
            </span>
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
                  <span className="assistant-security-pill">🔒 Live PostgreSQL Connected</span>
                </div>

                {/* Messages Feed */}
                <div className="chat-messages-scroll" role="log" aria-live="polite">
                  {chatMessages.map((msg, idx) => {
                    const attRecord = msg.structuredData?.attendanceRecord || null;

                    return (
                      <div
                        key={idx}
                        className={`chat-bubble-row ${msg.sender === "user" ? "user-row" : "ai-row"}`}
                      >
                        {msg.sender === "ai" && <span className="bubble-avatar">🤖</span>}
                        <div className={`chat-bubble ${msg.sender}`}>
                          <div className="bubble-top-meta">
                            <span className="bubble-sender">
                              {msg.sender === "user" ? "You" : "AI HR Assistant"}
                            </span>
                            {msg.intent && (
                              <span className="intent-badge">
                                {msg.intent} {msg.confidence ? `(${(msg.confidence * 100).toFixed(0)}%)` : ""}
                              </span>
                            )}
                            <span className="bubble-time">{msg.timestamp}</span>
                          </div>

                          <div className="bubble-content-text">
                            {String(msg.text || "")
                              .split("\n\n")
                              .map((para, pIdx) => {
                                const parts = para.split(/(\*\*[^*]+\*\*)/g);
                                return (
                                  <p key={pIdx}>
                                    {parts.map((part, partIdx) => {
                                      if (part.startsWith("**") && part.endsWith("**")) {
                                        return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
                                      }
                                      return part;
                                    })}
                                  </p>
                                );
                              })}
                          </div>

                          {/* Structured Data: Attendance Telemetry Card */}
                          {attRecord && (
                            <div className="structured-attendance-card">
                              <div className="attendance-card-header">
                                <div className="attendance-header-meta">
                                  <span className="attendance-badge-telemetry">
                                    <span className="telemetry-radar-dot"></span> ⏱️ Biometric Telemetry
                                  </span>
                                  <span className="attendance-badge-date">📅 {attRecord.date}</span>
                                </div>
                                <span
                                  className={`attendance-status-badge ${
                                    attRecord.isLate
                                      ? "late"
                                      : attRecord.isMissing
                                      ? "missing"
                                      : "present"
                                  }`}
                                >
                                  <span className="status-pulse-dot" />
                                  {attRecord.isLate
                                    ? "Late Arrival"
                                    : attRecord.isMissing
                                    ? "Not Punched"
                                    : "On-Time / Present"}
                                </span>
                              </div>

                              <div className="attendance-telemetry-grid">
                                {/* Clock In Pod */}
                                <div className="attendance-telemetry-pod checkin">
                                  <div className="pod-label-row">
                                    <span>Clock In</span>
                                    <span className="pod-icon">🟢</span>
                                  </div>
                                  <div className="pod-value">{attRecord.checkIn}</div>
                                  <div className="pod-subtext">
                                    <span>🔒 PostgreSQL Attendance Log</span>
                                  </div>
                                </div>

                                {/* Clock Out Pod */}
                                <div className="attendance-telemetry-pod checkout">
                                  <div className="pod-label-row">
                                    <span>Clock Out</span>
                                    <span className="pod-icon">🚪</span>
                                  </div>
                                  <div className="pod-value">
                                    {String(attRecord.checkOut || "")
                                      .toLowerCase()
                                      .includes("pending") ||
                                    String(attRecord.checkOut || "")
                                      .toLowerCase()
                                      .includes("active") ? (
                                      <span className="pod-live-pill">
                                        <span className="status-pulse-dot live" /> Active
                                      </span>
                                    ) : (
                                      attRecord.checkOut
                                    )}
                                  </div>
                                  <div className="pod-subtext">
                                    {String(attRecord.checkOut || "")
                                      .toLowerCase()
                                      .includes("pending") ||
                                    String(attRecord.checkOut || "")
                                      .toLowerCase()
                                      .includes("active")
                                      ? "⏳ Shift in progress"
                                      : "🏁 Status Recorded"}
                                  </div>
                                </div>

                                {/* Shift Status Pod */}
                                <div
                                  className={`attendance-telemetry-pod status ${
                                    attRecord.isLate ? "is-late" : ""
                                  }`}
                                >
                                  <div className="pod-label-row">
                                    <span>Shift Status</span>
                                    <span className="pod-icon">📊</span>
                                  </div>
                                  <div className="pod-value" style={{ textTransform: "capitalize" }}>
                                    {attRecord.status || (attRecord.isLate ? "Late" : "Present")}
                                  </div>
                                  <div className="pod-subtext">
                                    {attRecord.isLate
                                      ? `⚠️ Checked-in past 09:30 (${attRecord.lateMinutes || 0}m late)`
                                      : attRecord.totalHours
                                      ? `⏱️ ${attRecord.totalHours} hrs logged`
                                      : "🎯 Standard Shift Window"}
                                  </div>
                                </div>
                              </div>

                              <div className="attendance-footer-strip">
                                <div className="attendance-terminal-info">
                                  <span>📍 Location: {attRecord.workLocation || "Registered Office"}</span>
                                </div>
                                <div className="attendance-sync-status">
                                  <span>⚡ PostgreSQL Synced</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Structured Data: Leave Balances Card */}
                          {msg.structuredData?.balances && msg.structuredData.balances.length > 0 && (
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
                                        width: `${Math.min(
                                          100,
                                          Math.max(0, (b.remaining / (b.total || 1)) * 100)
                                        )}%`,
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
                                {msg.actionableLinks.map((link, lIdx) => {
                                  const targetUrl = link.url || link.path || "/";
                                  return (
                                    <Link
                                      key={lIdx}
                                      to={targetUrl}
                                      onClick={(e) => {
                                        if (targetUrl.includes("tab=")) {
                                          e.preventDefault();
                                          const tabId = new URLSearchParams(
                                            targetUrl.split("?")[1] || ""
                                          ).get("tab");
                                          if (tabId && AI_TABS.some((t) => t.id === tabId)) {
                                            setActiveTab(tabId);
                                            setSearchParams({ tab: tabId });
                                            return;
                                          }
                                        }
                                        if (targetUrl.startsWith("/")) {
                                          e.preventDefault();
                                          navigate(targetUrl);
                                        }
                                      }}
                                      className="actionable-link-btn"
                                    >
                                      {link.label} →
                                    </Link>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                        {msg.sender === "user" && <span className="bubble-avatar user-icon">👤</span>}
                      </div>
                    );
                  })}

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
                  <p className="side-card-desc">Click any question below to test live PostgreSQL retrieval:</p>
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
                      <strong>Zero Static Data:</strong> Every answer is resolved dynamically from live PostgreSQL records.
                    </li>
                    <li>
                      <strong>Zero Role Escalation:</strong> Employees only retrieve their own leave, attendance, and project data.
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
                    className={`preset-chip ${analyticsQuery === preset ? "active" : ""}`}
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
                    <h3 className="analytics-title">
                      {analyticsResult.title || analyticsResult.metricTitle || "Workforce Analytics Summary"}
                    </h3>
                  </div>
                  <p className="analytics-narrative">
                    {String(analyticsResult.summary || "")
                      .split(/(\*\*[^*]+\*\*)/g)
                      .map((part, pIdx) =>
                        part.startsWith("**") && part.endsWith("**") ? (
                          <strong key={pIdx}>{part.slice(2, -2)}</strong>
                        ) : (
                          part
                        )
                      )}
                  </p>
                </div>

                {/* Key Metrics Cards */}
                {analyticsResult.keyMetrics && (
                  <div className="analytics-kpi-grid">
                    {(Array.isArray(analyticsResult.keyMetrics)
                      ? analyticsResult.keyMetrics.map((m) => [m.label, m.value])
                      : Object.entries(analyticsResult.keyMetrics)
                    ).map(([key, val], idx) => (
                      <div key={idx} className="kpi-card">
                        <span className="kpi-label">{String(key).replace(/([A-Z])/g, " $1").toUpperCase()}</span>
                        <span className="kpi-value">
                          {val && typeof val === "object" ? String(val.value ?? "") : String(val ?? "")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Visual Chart / Breakdown Deck */}
                {analyticsResult.chartData && (
                  <div className="analytics-chart-card">
                    <h4 className="chart-card-heading">
                      Visual Distribution:{" "}
                      {(analyticsResult.chartData.chartType || analyticsResult.chartType || "BAR").toUpperCase()}{" "}
                      Breakdown
                    </h4>

                    {(() => {
                      const bars = Array.isArray(analyticsResult.chartData)
                        ? analyticsResult.chartData
                        : Array.isArray(analyticsResult.chartData.data)
                        ? analyticsResult.chartData.data
                        : [];
                      const maxBarVal = Math.max(
                        ...bars.map((b) => Number(b.rate ?? b.count ?? b.value ?? 0)),
                        1
                      );
                      return (
                        bars.length > 0 && (
                          <div className="custom-bars-container">
                            {bars.map((item, idx) => {
                              const label =
                                item.department || item.name || item.label || item.status || `Group ${idx + 1}`;
                              const val = Number(item.rate ?? item.count ?? item.value ?? 0);
                              const isRate =
                                item.rate !== undefined ||
                                String(analyticsResult.chartType || "").toUpperCase() === "DOUGHNUT";
                              const formattedVal = isRate
                                ? item.subValue
                                  ? `${val}% (${item.subValue})`
                                  : `${val}%`
                                : item.subValue
                                ? `${val} (${item.subValue})`
                                : val;
                              const barWidth = Math.min(
                                100,
                                Math.max(18, Math.round((val / maxBarVal) * 95))
                              );

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
                        )
                      );
                    })()}
                  </div>
                )}

                {/* Breakdown Table if provided */}
                {Array.isArray(analyticsResult.breakdown) && analyticsResult.breakdown.length > 0 && (
                  <div className="analytics-table-card">
                    <div className="roster-card-header" style={{ marginBottom: "12px" }}>
                      <h4 className="table-card-heading" style={{ margin: 0 }}>
                        Detailed Data Breakdown ({analyticsResult.breakdown.length} Records)
                      </h4>
                      {analyticsResult.breakdown.length > 2 && (
                        <span className="scroll-records-badge">
                          ↕ Showing 2 of {analyticsResult.breakdown.length} records • Scroll for more
                        </span>
                      )}
                    </div>
                    <div className="table-responsive two-records-table-scroll">
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

                {/* AI Methodology & Data Lineage Footer */}
                {analyticsResult.explanation && (
                  <div className="governance-notice-bar">
                    <span className="gov-icon">🧠</span>
                    <span>
                      <strong>Data Lineage &amp; Methodology:</strong> {analyticsResult.explanation}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            TAB 3: SMART ATTENDANCE MONITORING (ROLE-SCOPED: PERSONAL VS HR ENTERPRISE)
            ========================================================= */}
        {activeTab === "attendance" && (
          <div className="ai-tab-panel attendance-panel">
            {/* Command Center Header & Controls */}
            <div className="smart-attendance-command-bar">
              <div className="command-bar-top">
                <div className="controls-left">
                  <div className="smart-radar-pill">
                    <span className="radar-live-dot" />
                    {isHrEnterpriseView
                      ? `ENTERPRISE BIOMETRIC & SHIFT TELEMETRY • ${lookbackDays}-DAY WORKFORCE WINDOW`
                      : `PERSONAL BIOMETRIC TELEMETRY • MY ${lookbackDays}-DAY ATTENDANCE MONITOR`}
                  </div>
                  <h3 className="section-title">
                    {isHrEnterpriseView
                      ? "Enterprise Smart Attendance & Pattern Anomaly Monitoring"
                      : "My Smart Attendance & Biometric Pattern Monitor"}
                  </h3>
                  <p className="section-sub">
                    {isHrEnterpriseView ? (
                      <>
                        Real-time cross-correlation of all employees&apos; PostgreSQL <code>attendance</code> punches,
                        system EOD auto-close events, <code>leaves</code>, and <code>employees</code> master records.
                      </>
                    ) : (
                      <>
                        Personal attendance telemetry, punctuality compliance, and shift pattern analysis for{" "}
                        <strong>
                          {employeeTelemetry[0]?.employeeName ||
                            (currentEmployee?.first_name
                              ? `${currentEmployee.first_name} ${currentEmployee.last_name || ""}`.trim()
                              : user?.name || "your profile")}
                        </strong>{" "}
                        ({employeeTelemetry[0]?.employeeCode || currentEmployee?.employee_code || "My Profile"}).
                      </>
                    )}
                  </p>
                </div>

                <div className="controls-right">
                  {/* View Switcher: Anomaly Feed vs Workforce/Personal Telemetry */}
                  <div className="view-mode-toggle">
                    <button
                      type="button"
                      className={`view-mode-btn ${attendanceViewMode === "anomalies" ? "active" : ""}`}
                      onClick={() => setAttendanceViewMode("anomalies")}
                    >
                      🚨 {isHrEnterpriseView ? `Anomaly Alerts (${anomalies.length})` : `My Pattern Flags (${anomalies.length})`}
                    </button>
                    <button
                      type="button"
                      className={`view-mode-btn ${attendanceViewMode === "roster" ? "active" : ""}`}
                      onClick={() => setAttendanceViewMode("roster")}
                    >
                      {isHrEnterpriseView
                        ? `👥 Workforce Telemetry (${employeeTelemetry.length})`
                        : `📅 My Punch Logs (${recentPunches.length})`}
                    </button>
                  </div>

                  <select
                    className="lookback-select"
                    value={lookbackDays}
                    onChange={(e) => {
                      const days = Number(e.target.value);
                      setLookbackDays(days);
                      loadAnomalies(days, true);
                    }}
                  >
                    <option value={7}>Last 7 Days</option>
                    <option value={15}>Last 15 Days</option>
                    <option value={30}>Last 30 Days</option>
                    <option value={60}>Last 60 Days</option>
                    <option value={90}>Last 90 Days</option>
                  </select>

                  <button
                    type="button"
                    className="scan-refresh-btn"
                    onClick={() => loadAnomalies(lookbackDays, true)}
                    disabled={loadingAnomalies}
                  >
                    🔄 {loadingAnomalies ? "Scanning DB..." : isHrEnterpriseView ? "Re-Scan Workforce" : "Refresh My Logs"}
                  </button>
                </div>
              </div>

              {/* Search, Department (HR Only), and Severity Filter Bar */}
              <div className="command-bar-filters">
                {isHrEnterpriseView ? (
                  <>
                    <div className="smart-search-input-wrap">
                      <span className="smart-search-icon">🔍</span>
                      <input
                        type="text"
                        className="smart-search-input"
                        placeholder="Search employee name, code, designation, department, or manager..."
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value)}
                      />
                      {employeeSearch && (
                        <button
                          type="button"
                          className="smart-search-clear"
                          onClick={() => setEmployeeSearch("")}
                          title="Clear search"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="filter-select-wrap">
                      <label className="filter-mini-label">Department:</label>
                      <select
                        className="smart-dept-select"
                        value={departmentFilter}
                        onChange={(e) => setDepartmentFilter(e.target.value)}
                      >
                        {availableDepartments.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept === "ALL" ? "All Departments" : dept}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="personal-scope-banner-pill">
                    <span>🔒</span>
                    <span>
                      <strong>Personal Privacy Scope Active:</strong> Showing only your own biometric attendance records and shift telemetry.
                    </span>
                  </div>
                )}

                {attendanceViewMode === "anomalies" && (
                  <div className="severity-filter-group">
                    {[
                      { id: "ALL", label: `All (${anomalies.length})` },
                      {
                        id: "CRITICAL",
                        label: `Critical (${anomalies.filter((a) => a.severity === "CRITICAL").length})`,
                      },
                      {
                        id: "WARNING",
                        label: `Warning (${anomalies.filter((a) => a.severity === "WARNING").length})`,
                      },
                    ].map((lvl) => (
                      <button
                        key={lvl.id}
                        type="button"
                        className={`filter-btn ${lvl.id.toLowerCase()} ${
                          severityFilter === lvl.id ? "active" : ""
                        }`}
                        onClick={() => setSeverityFilter(lvl.id)}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Pattern Filter Chips */}
              {attendanceViewMode === "anomalies" && availablePatterns.length > 0 && (
                <div className="pattern-chips-strip">
                  <span className="pattern-strip-label">Filter by Pattern:</span>
                  <button
                    type="button"
                    className={`pattern-chip-btn ${patternFilter === "ALL" ? "active" : ""}`}
                    onClick={() => setPatternFilter("ALL")}
                  >
                    All Patterns ({anomalies.length})
                  </button>
                  {availablePatterns.map((pat) => (
                    <button
                      key={pat.type}
                      type="button"
                      className={`pattern-chip-btn ${patternFilter === pat.type ? "active" : ""}`}
                      onClick={() =>
                        setPatternFilter((prev) => (prev === pat.type ? "ALL" : pat.type))
                      }
                    >
                      <span>{PATTERN_ICONS[pat.type] || "⚡"}</span> {pat.label}
                      <span className="pattern-chip-count">{pat.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 5-Card Live Telemetry KPI Banner */}
            {anomalyData && (
              <div className="anomaly-kpi-banner five-col">
                <div className="anomaly-counter-card telemetry-blue">
                  <div className="counter-icon-box blue">📋</div>
                  <div className="counter-meta">
                    <span className="counter-num">
                      {isHrEnterpriseView
                        ? anomalyData.scannedPunches ?? 0
                        : employeeTelemetry[0]?.totalPunchesInWindow ?? recentPunches.length ?? 0}
                    </span>
                    <span className="counter-desc">
                      {isHrEnterpriseView ? "Biometric Punches Scanned" : "My Punches Scanned"}
                    </span>
                    <span className="counter-sub">Rolling {lookbackDays}-day SQL window</span>
                  </div>
                </div>

                <div className="anomaly-counter-card telemetry-indigo">
                  <div className="counter-icon-box indigo">👥</div>
                  <div className="counter-meta">
                    <span className="counter-num">
                      {isHrEnterpriseView
                        ? anomalyData.scannedEmployees ?? 0
                        : employeeTelemetry[0]?.employeeCode || currentEmployee?.employee_code || "1"}
                    </span>
                    <span className="counter-desc">
                      {isHrEnterpriseView ? "Active Employees Monitored" : "Monitored Employee Profile"}
                    </span>
                    <span className="counter-sub">
                      {isHrEnterpriseView
                        ? `${anomalyData.employeesWithPunches ?? 0} with active punch logs`
                        : `${employeeTelemetry[0]?.department || "Assigned Practice"} • ${
                            employeeTelemetry[0]?.approvedLeaveDays ?? 0
                          } leave days`}
                    </span>
                  </div>
                </div>

                <div className="anomaly-counter-card telemetry-emerald">
                  <div className="counter-icon-box emerald">🎯</div>
                  <div className="counter-meta">
                    <span className="counter-num">
                      {isHrEnterpriseView
                        ? `${anomalyData.overallPunctualityRate ?? 100}%`
                        : `${employeeTelemetry[0]?.onTimeRate ?? anomalyData.overallPunctualityRate ?? 100}%`}
                    </span>
                    <span className="counter-desc">
                      {isHrEnterpriseView ? "Workforce Punctuality" : "My Punctuality Rate"}
                    </span>
                    <span className="counter-sub">
                      Avg Shift:{" "}
                      {isHrEnterpriseView
                        ? anomalyData.avgWorkforceHours ?? 0
                        : employeeTelemetry[0]?.avgWorkingHours ?? anomalyData.avgWorkforceHours ?? 0}{" "}
                      hrs/day
                    </span>
                  </div>
                </div>

                <div
                  className="anomaly-counter-card critical"
                  onClick={() => {
                    setAttendanceViewMode("anomalies");
                    setSeverityFilter(severityFilter === "CRITICAL" ? "ALL" : "CRITICAL");
                  }}
                  style={{ cursor: "pointer" }}
                  title="Click to filter Critical anomalies"
                >
                  <div className="counter-icon-box red">🚨</div>
                  <div className="counter-meta">
                    <span className="counter-num">
                      {anomalies.filter((a) => a.severity === "CRITICAL").length}
                    </span>
                    <span className="counter-desc">
                      {isHrEnterpriseView ? "Critical Pattern Flags" : "My Critical Flags"}
                    </span>
                    <span className="counter-sub">
                      {isHrEnterpriseView ? "Immediate HR/Manager action" : "Requires regularization"}
                    </span>
                  </div>
                </div>

                <div
                  className="anomaly-counter-card warning"
                  onClick={() => {
                    setAttendanceViewMode("anomalies");
                    setSeverityFilter(severityFilter === "WARNING" ? "ALL" : "WARNING");
                  }}
                  style={{ cursor: "pointer" }}
                  title="Click to filter Warning anomalies"
                >
                  <div className="counter-icon-box amber">⚠️</div>
                  <div className="counter-meta">
                    <span className="counter-num">
                      {anomalies.filter((a) => a.severity === "WARNING").length}
                    </span>
                    <span className="counter-desc">
                      {isHrEnterpriseView ? "Warning Level Flags" : "My Warning Flags"}
                    </span>
                    <span className="counter-sub">
                      {anomalyData.autoClosedCount ?? 0} system auto-closed shifts
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW MODE 1: ANOMALY CARDS FEED (2 RECORDS VISIBLE, REMAINING SCROLLABLE) */}
            {attendanceViewMode === "anomalies" ? (
              <div className="anomalies-feed-wrapper">
                {filteredAnomalies.length > 2 && (
                  <div className="scroll-records-indicator">
                    <span className="scroll-indicator-left">
                      <span className="scroll-dot" />
                      Showing <strong>2 records</strong> in viewport ({filteredAnomalies.length} total matched)
                    </span>
                    <span className="scroll-indicator-right">
                      ↕ Scroll inside feed to view remaining {filteredAnomalies.length - 2} record
                      {filteredAnomalies.length - 2 === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
                <div className="anomalies-feed-grid two-records-cards-scroll">
                {filteredAnomalies.length === 0 ? (
                  <div className="empty-anomalies-card">
                    <span className="empty-icon">✅</span>
                    <h4>
                      {isHrEnterpriseView
                        ? "No Matching Attendance Anomalies Found"
                        : "Your Attendance Telemetry is 100% Compliant"}
                    </h4>
                    <p>
                      {anomalies.length > 0
                        ? "No anomalies match your active filter criteria. Try resetting the severity, department, or search filters."
                        : isHrEnterpriseView
                        ? "All scanned employee punch records in PostgreSQL adhere to shift and punctuality policies."
                        : "You have no late-arrival patterns, missing punch-outs, or abnormal shift variances in the selected window."}
                    </p>
                    {anomalies.length > 0 && (
                      <button
                        type="button"
                        className="reset-filters-btn"
                        onClick={() => {
                          setSeverityFilter("ALL");
                          setDepartmentFilter("ALL");
                          setPatternFilter("ALL");
                          setEmployeeSearch("");
                        }}
                      >
                        Reset Active Filters
                      </button>
                    )}
                  </div>
                ) : (
                  filteredAnomalies.map((item, idx) => {
                    const score = item.anomalyScore ?? item.severityScore ?? 75;
                    const sevLower = (item.severity || "WARNING").toLowerCase();
                    const pType = item.type || item.patternType || "SHIFT_VARIANCE";
                    const pIcon = PATTERN_ICONS[pType] || "⚡";
                    const initials = String(item.employeeName || "E")
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <article
                        key={item.id || idx}
                        className={`anomaly-card-v2 severity-${sevLower}`}
                      >
                        {/* Top Accent Strip */}
                        <div className="anomaly-card-top-bar" />

                        {/* Employee Identity & Risk Gauge Header */}
                        <div className="anomaly-v2-header">
                          <div className="anomaly-v2-identity">
                            <div className={`anomaly-v2-avatar-wrap ${sevLower}`}>
                              {item.profilePhoto ? (
                                <img
                                  src={item.profilePhoto}
                                  alt={item.employeeName}
                                  className="anomaly-v2-avatar-img"
                                />
                              ) : (
                                <span className="anomaly-v2-avatar-initials">{initials}</span>
                              )}
                              <span className={`avatar-status-dot ${sevLower}`} />
                            </div>

                            <div className="anomaly-v2-user-info">
                              <div className="anomaly-v2-name-row">
                                <h4 className="anomaly-v2-name">{item.employeeName}</h4>
                                <span className="anomaly-v2-empcode">{item.employeeCode}</span>
                              </div>
                              <div className="anomaly-v2-role-row">
                                <span className="anomaly-v2-designation">{item.designation}</span>
                                <span className="anomaly-v2-dot">•</span>
                                <span className="anomaly-v2-dept-pill">{item.department}</span>
                              </div>
                              <div className="anomaly-v2-manager-row">
                                <span>👤 Reports to: <strong>{item.managerName || "Direct Lead"}</strong></span>
                                <span>📍 {item.workLocation || "Corporate Office"}</span>
                              </div>
                            </div>
                          </div>

                          {/* Severity & Risk Score Meter */}
                          <div className="anomaly-v2-score-cluster">
                            <span className={`severity-badge-v2 ${sevLower}`}>
                              <span className="sev-pulse-dot" />
                              {item.severity}
                            </span>
                            <div className="risk-score-box">
                              <div className="risk-score-top">
                                <span className="risk-label">Risk Index</span>
                                <span className={`risk-val ${sevLower}`}>{score}/100</span>
                              </div>
                              <div className="risk-progress-track">
                                <div
                                  className={`risk-progress-fill ${sevLower}`}
                                  style={{ width: `${Math.min(100, Math.max(10, score))}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Pattern Classification Banner */}
                        <div className="anomaly-v2-pattern-banner">
                          <div className="pattern-banner-left">
                            <span className="pattern-banner-icon">{pIcon}</span>
                            <div>
                              <span className="pattern-banner-sub">DETECTED BIOMETRIC PATTERN</span>
                              <strong className="pattern-banner-title">
                                {item.patternLabel || pType.replace(/_/g, " ")}
                              </strong>
                            </div>
                          </div>
                          <div className="pattern-banner-right">
                            {item.metricHighlight && (
                              <span className="pattern-highlight-chip">{item.metricHighlight}</span>
                            )}
                            <span className="pattern-occurrences-badge">
                              {item.detectedCount || 1}x in {lookbackDays}d
                            </span>
                          </div>
                        </div>

                        {/* 4-Column Live Employee Telemetry Grid */}
                        <div className="anomaly-v2-telemetry-grid">
                          <div className="telemetry-mini-cell">
                            <span className="t-cell-label">Window Punches</span>
                            <span className="t-cell-val">
                              {item.totalPunchesInWindow ?? 0}{" "}
                              <small>shifts</small>
                            </span>
                          </div>
                          <div className="telemetry-mini-cell">
                            <span className="t-cell-label">On-Time Rate</span>
                            <span
                              className={`t-cell-val ${
                                (item.onTimeRate ?? 100) < 70 ? "text-danger" : "text-ok"
                              }`}
                            >
                              {item.onTimeRate ?? 0}%
                            </span>
                          </div>
                          <div className="telemetry-mini-cell">
                            <span className="t-cell-label">Avg Working Hrs</span>
                            <span className="t-cell-val">
                              {item.avgWorkingHours ?? 0} <small>hrs/d</small>
                            </span>
                          </div>
                          <div className="telemetry-mini-cell">
                            <span className="t-cell-label">Latest Check-In</span>
                            <span className="t-cell-val">{item.latestCheckIn || "None"}</span>
                          </div>
                        </div>

                        {/* Affected Dates Timeline Chips */}
                        {Array.isArray(item.affectedDates) && item.affectedDates.length > 0 && (
                          <div className="anomaly-v2-dates-row">
                            <span className="dates-row-label">📅 Flagged Dates:</span>
                            <div className="dates-chips-wrap">
                              {item.affectedDates.map((dStr, dIdx) => (
                                <span key={dIdx} className="flagged-date-chip">
                                  {dStr}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* AI Explanation & Recommended Resolution */}
                        <div className="anomaly-v2-insights-stack">
                          <div className="anomaly-v2-explanation">
                            <div className="insight-box-header">
                              <span className="insight-icon">🧠</span>
                              <span className="insight-title">AI Diagnostic Telemetry</span>
                            </div>
                            <p>{item.explanation || item.narrativeExplanation}</p>
                          </div>

                          <div className="anomaly-v2-resolution">
                            <div className="insight-box-header">
                              <span className="insight-icon">🛡️</span>
                              <span className="insight-title">Recommended Resolution</span>
                            </div>
                            <p>{item.recommendedAction || item.suggestedAction}</p>
                          </div>
                        </div>

                        {/* Action Buttons Footer */}
                        <div className="anomaly-v2-footer">
                          {isHrEnterpriseView ? (
                            <>
                              <button
                                type="button"
                                className="anomaly-v2-btn primary"
                                onClick={() => {
                                  toast.success(
                                    `Regularization workflow initiated for ${item.employeeName} (${item.employeeCode}).`
                                  );
                                }}
                              >
                                <span>📋</span> Trigger Regularization
                              </button>
                              <button
                                type="button"
                                className="anomaly-v2-btn secondary"
                                onClick={() => {
                                  toast.info(
                                    `Escalation alert dispatched to ${item.managerName || "Reporting Manager"} for ${item.employeeName}.`
                                  );
                                }}
                              >
                                <span>📨</span> Notify Manager
                              </button>
                              <button
                                type="button"
                                className="anomaly-v2-btn ghost"
                                onClick={() => navigate("/hr/employees")}
                                title="View Employee Directory"
                              >
                                <span>👤</span> Profile →
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="anomaly-v2-btn primary"
                                onClick={() => navigate("/employee/attendance")}
                              >
                                <span>📋</span> Submit Regularization
                              </button>
                              <button
                                type="button"
                                className="anomaly-v2-btn secondary"
                                onClick={() => navigate("/employee/leaves")}
                              >
                                <span>🏖️</span> Apply Leave
                              </button>
                              <button
                                type="button"
                                className="anomaly-v2-btn ghost"
                                onClick={() => setAttendanceViewMode("roster")}
                              >
                                <span>📅</span> My Logs →
                              </button>
                            </>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
                </div>
              </div>
            ) : isHrEnterpriseView ? (
              /* VIEW MODE 2 (HR ENTERPRISE): FULL MONITORED EMPLOYEE BIOMETRIC TELEMETRY ROSTER */
              <div className="telemetry-roster-card">
                <div className="roster-card-header">
                  <div>
                    <h4 className="roster-title">
                      Live Workforce Biometric Telemetry Roster ({filteredRoster.length} Employees)
                    </h4>
                    <p className="roster-sub">
                      Direct PostgreSQL aggregation of every active employee&apos;s check-ins, punctuality compliance, working hours, and leave days over the last {lookbackDays} days.
                    </p>
                  </div>
                  {filteredRoster.length > 2 && (
                    <span className="scroll-records-badge">
                      ↕ Showing 2 of {filteredRoster.length} records • Scroll for remaining {filteredRoster.length - 2}
                    </span>
                  )}
                </div>

                <div className="table-responsive two-records-table-scroll">
                  <table className="ai-data-table telemetry-roster-table">
                    <thead>
                      <tr>
                        <th>EMPLOYEE</th>
                        <th>DEPARTMENT &amp; ROLE</th>
                        <th>REPORTING MANAGER</th>
                        <th>WINDOW PUNCHES</th>
                        <th>PUNCTUALITY</th>
                        <th>LATE MINS</th>
                        <th>AVG SHIFT HRS</th>
                        <th>APPROVED LEAVES</th>
                        <th>LATEST CHECK-IN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRoster.map((emp, idx) => (
                        <tr key={emp.employeeCode || idx}>
                          <td>
                            <div className="roster-emp-cell">
                              <strong>{emp.employeeName}</strong>
                              <span className="roster-emp-code">{emp.employeeCode}</span>
                            </div>
                          </td>
                          <td>
                            <div className="roster-emp-cell">
                              <span>{emp.department}</span>
                              <small className="text-muted">{emp.designation}</small>
                            </div>
                          </td>
                          <td>{emp.managerName}</td>
                          <td>
                            <strong>{emp.totalPunchesInWindow}</strong> shifts ({emp.onTimePunches} on-time)
                          </td>
                          <td>
                            <span
                              className={`roster-rate-pill ${
                                emp.totalPunchesInWindow === 0
                                  ? "neutral"
                                  : emp.onTimeRate >= 85
                                  ? "good"
                                  : emp.onTimeRate >= 60
                                  ? "warn"
                                  : "bad"
                              }`}
                            >
                              {emp.totalPunchesInWindow === 0 ? "No Punches" : `${emp.onTimeRate}%`}
                            </span>
                          </td>
                          <td>{emp.totalLateMinutes > 0 ? `${emp.totalLateMinutes} mins` : "0 mins"}</td>
                          <td>
                            {emp.avgWorkingHours > 0 ? `${emp.avgWorkingHours} hrs` : "—"}
                            {emp.totalOvertimeHours > 0 ? ` (+${emp.totalOvertimeHours}h OT)` : ""}
                          </td>
                          <td>{emp.approvedLeaveDays} days</td>
                          <td>
                            <div className="roster-emp-cell">
                              <span>{emp.latestCheckIn}</span>
                              {emp.recentDate && <small className="text-muted">{emp.recentDate}</small>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* VIEW MODE 2 (PERSONAL EMPLOYEE): MY BIOMETRIC PUNCH LOGS */
              <div className="telemetry-roster-card">
                <div className="roster-card-header">
                  <div>
                    <h4 className="roster-title">
                      My Biometric Punch Logs ({recentPunches.length} Records in Last {lookbackDays} Days)
                    </h4>
                    <p className="roster-sub">
                      Live PostgreSQL <code>attendance</code> records for your profile.
                    </p>
                  </div>
                  {recentPunches.length > 2 && (
                    <span className="scroll-records-badge">
                      ↕ Showing 2 of {recentPunches.length} records • Scroll for remaining {recentPunches.length - 2}
                    </span>
                  )}
                </div>

                {recentPunches.length === 0 ? (
                  <div className="empty-anomalies-card">
                    <span className="empty-icon">📅</span>
                    <h4>No Biometric Punch Records in Window</h4>
                    <p>No attendance punches were recorded for your account in the last {lookbackDays} days.</p>
                  </div>
                ) : (
                  <div className="table-responsive two-records-table-scroll">
                    <table className="ai-data-table telemetry-roster-table">
                      <thead>
                        <tr>
                          <th>DATE</th>
                          <th>CLOCK IN</th>
                          <th>CLOCK OUT</th>
                          <th>WORKING HOURS</th>
                          <th>LATE MINUTES</th>
                          <th>STATUS</th>
                          <th>REMARKS / POLICY</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentPunches.map((p, idx) => (
                          <tr key={p.id || idx}>
                            <td>
                              <strong>{p.date}</strong>
                            </td>
                            <td>{p.checkIn}</td>
                            <td>{p.checkOut}</td>
                            <td>
                              {p.workingHours > 0 ? `${p.workingHours} hrs` : "—"}
                              {p.overtimeHours > 0 ? ` (+${p.overtimeHours}h OT)` : ""}
                            </td>
                            <td>{p.lateMinutes > 0 ? `${p.lateMinutes} mins` : "0 mins"}</td>
                            <td>
                              <span
                                className={`roster-rate-pill ${
                                  p.isLate ? "warn" : String(p.status).toLowerCase() === "absent" ? "bad" : "good"
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td>{p.remarks || "Standard Biometric Log"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
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
                    Select any candidate from the PostgreSQL <code>candidates</code> table or paste a resume summary to compute skill alignment and generate technical interview questions.
                  </p>

                  <div className="form-group">
                    <label className="form-label">Select Candidate from PostgreSQL Pipeline:</label>
                    <select
                      className="form-select"
                      value={selectedCandidateId}
                      onChange={(e) => handleCandidateSelectChange(e.target.value)}
                    >
                      <option value="">-- Use Custom Resume Text Below --</option>
                      {candidateList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.first_name || c.name} {c.last_name || ""} ({c.candidate_id || `ID-${c.id}`} • {c.designation || c.status || "Applicant"})
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
                    <label className="form-label">Candidate Resume / DB Profile Summary:</label>
                    <textarea
                      rows={5}
                      className="form-textarea"
                      value={customResume}
                      onChange={(e) => setCustomResume(e.target.value)}
                      placeholder="Select a candidate above to load their live PostgreSQL skills profile, or paste resume text here..."
                    />
                  </div>

                  <button
                    type="button"
                    className="run-match-btn"
                    onClick={handleRunCandidateMatch}
                    disabled={isMatchingCandidate}
                  >
                    <span>🎯</span>{" "}
                    {isMatchingCandidate ? "Evaluating Qualifications..." : "Run AI Skill Match & Gap Analysis"}
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
                        <h4 className="match-candidate-name">
                          {recruitmentResult.candidateName}{" "}
                          <small className="text-muted">({recruitmentResult.candidateId})</small>
                        </h4>
                        <span className="match-target-role">
                          Target Requisition: {recruitmentResult.targetRole}
                          {recruitmentResult.candidateStatus ? ` • Pipeline: ${recruitmentResult.candidateStatus}` : ""}
                        </span>
                      </div>
                    </div>

                    {/* Skills Breakdown */}
                    <div className="skills-breakdown-section">
                      <div className="skills-column">
                        <span className="skills-column-title text-emerald">
                          ✓ Matched &amp; Verified Skills ({recruitmentResult.matchedSkills?.length || 0})
                        </span>
                        <div className="skill-pills-row">
                          {recruitmentResult.matchedSkills?.length === 0 ? (
                            <span className="text-muted">No matching skills detected in profile text.</span>
                          ) : (
                            recruitmentResult.matchedSkills?.map((skill, idx) => (
                              <span key={idx} className="skill-pill matched">
                                ✓ {skill}
                              </span>
                            ))
                          )}
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
                    <p>
                      Select a candidate from the PostgreSQL pipeline dropdown or paste resume text on the left, then click &quot;Run AI Skill Match&quot;.
                    </p>
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
                    {String(policyResult.answer || "")
                      .split("\n\n")
                      .map((chunk, cIdx) => {
                        const cleanChunk = chunk.replace(/^>\s*/, "");
                        const parts = cleanChunk.split(/(\*\*[^*]+\*\*)/g);
                        return (
                          <p key={cIdx}>
                            {parts.map((part, pIdx) =>
                              part.startsWith("**") && part.endsWith("**") ? (
                                <strong key={pIdx}>{part.slice(2, -2)}</strong>
                              ) : (
                                part
                              )
                            )}
                          </p>
                        );
                      })}
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
    </>
  );
}
