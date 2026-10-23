import React, { useState, useMemo, useRef, useEffect } from "react";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import { useRecruitment } from "../../hooks/useRecruitment";
import "./RecruitmentOnboarding.css";

const STAGES = [
  "Applied",
  "Screening",
  "Interview",
  "Offered",
  "Offer Accepted",
  "Hired",
];

const DEFAULT_CHECKLIST = [
  { id: "it_laptop", label: "💻 IT Provisioning: Laptop configured & asset tag allocated", category: "IT" },
  { id: "it_email", label: "📧 Corporate Email & SSO: Workspace credentials created & dispatched", category: "IT" },
  { id: "bgv_clear", label: "🛡️ Background Verification: Identity, address & criminal check cleared", category: "BGV" },
  { id: "docs_offer", label: "📄 Signed Offer & NDA: Signed letter & compliance documents returned", category: "Compliance" },
  { id: "docs_id", label: "🪪 Identity Verification: Aadhaar, PAN & bank details validated", category: "Compliance" },
  { id: "hr_orientation", label: "🎓 HR Orientation & Buddy: Welcome session scheduled & mentor assigned", category: "Induction" },
  { id: "facility_badge", label: "🏢 Workplace Access: RFID access card issued & biometric badge registered", category: "Facilities" },
];

export default function RecruitmentOnboarding({ isEmbedded = false }) {
  const {
    candidates,
    auditTrail,
    onboardingStatus,
    employees,
    companyEmployees = [],
    addCandidate,
    updateCandidateStatus,
    updateBgv,
    triggerOnboarding,
  } = useRecruitment();

  const pipelineRef = useRef(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [initialScrollLeft, setInitialScrollLeft] = useState(0);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [bgvFilter, setBgvFilter] = useState("ALL");
  const [activeStagePill, setActiveStagePill] = useState("ALL");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [onboardCandidate, setOnboardCandidate] = useState(null);
  const [checklistCandidate, setChecklistCandidate] = useState(null);

  // Preboarding checklists stored in localStorage
  const [checklists, setChecklists] = useState(() => {
    try {
      const saved = localStorage.getItem("hrms_preboarding_checklists");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleChecklistItem = (candId, taskId) => {
    setChecklists((prev) => {
      const candTasks = prev[candId] || {};
      const updated = {
        ...prev,
        [candId]: {
          ...candTasks,
          [taskId]: !candTasks[taskId],
        },
      };
      try {
        localStorage.setItem("hrms_preboarding_checklists", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const getChecklistProgress = (candId) => {
    const candTasks = checklists[candId] || {};
    const completedCount = DEFAULT_CHECKLIST.filter((task) => Boolean(candTasks[task.id])).length;
    const total = DEFAULT_CHECKLIST.length;
    const pct = Math.round((completedCount / total) * 100);
    return { completedCount, total, pct };
  };

  // Sub-Navigation Tabs & Entities
  const [activeSubTab, setActiveSubTab] = useState("pipeline"); // "pipeline" | "requisitions" | "interviews" | "onboarding"
  const [offerCandidate, setOfferCandidate] = useState(null);
  const [showReqModal, setShowReqModal] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);

  const [requisitions, setRequisitions] = useState(() => {
    try {
      const saved = localStorage.getItem("hrms_job_requisitions");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [interviews, setInterviews] = useState(() => {
    try {
      const saved = localStorage.getItem("hrms_scheduled_interviews");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [newReq, setNewReq] = useState({
    title: "",
    department: "Engineering",
    positions: 1,
    budget: "₹15L - ₹20L",
    targetDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    priority: "High",
    hiringManager: "Rajesh Sharma",
    status: "Open"
  });

  const [newInterview, setNewInterview] = useState({
    candidateName: "",
    role: "Software Engineer",
    round: "Technical Round 1",
    date: new Date().toISOString().slice(0, 10),
    time: "02:00 PM",
    panelist: "Senior Panelist",
    mode: "Google Meet",
    meetingLink: "https://meet.google.com/live-interview"
  });

  const handleCreateReq = (e) => {
    e.preventDefault();
    if (!newReq.title.trim()) return;
    const reqItem = {
      id: `REQ-2026-00${requisitions.length + 1}`,
      ...newReq,
      filled: 0
    };
    const updated = [reqItem, ...requisitions];
    setRequisitions(updated);
    try { localStorage.setItem("hrms_job_requisitions", JSON.stringify(updated)); } catch {}
    setShowReqModal(false);
    setNewReq({
      title: "",
      department: "Engineering",
      positions: 1,
      budget: "₹15L - ₹20L",
      targetDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      priority: "High",
      hiringManager: "Rajesh Sharma",
      status: "Open"
    });
  };

  const handleCreateInterview = (e) => {
    e.preventDefault();
    if (!newInterview.candidateName.trim()) return;
    const intItem = {
      id: `INT-${interviews.length + 101}`,
      ...newInterview,
      status: "Scheduled",
      score: "Pending"
    };
    const updated = [intItem, ...interviews];
    setInterviews(updated);
    try { localStorage.setItem("hrms_scheduled_interviews", JSON.stringify(updated)); } catch {}
    setShowInterviewModal(false);
    setNewInterview({
      candidateName: "",
      role: "Software Engineer",
      round: "Technical Round 1",
      date: new Date().toISOString().slice(0, 10),
      time: "02:00 PM",
      panelist: "Senior Panelist",
      mode: "Google Meet",
      meetingLink: "https://meet.google.com/live-interview"
    });
  };

  // Forms
  const [newCandidate, setNewCandidate] = useState({
    name: "",
    email: "",
    phone: "",
    skills: "",
    experience: "",
    department: "Engineering",
    designation: "Software Engineer",
  });

  const [onboardForm, setOnboardForm] = useState({
    department: "Engineering",
    manager: "",
    designation: "Software Engineer",
    joiningDate: new Date().toISOString().slice(0, 10),
  });

  // Smooth Horizontal Scroll
  const scrollPipeline = (direction) => {
    if (!pipelineRef.current) return;
    const scrollAmount = direction === "left" ? -360 : 360;
    pipelineRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  const scrollToStage = (stageName) => {
    setActiveStagePill(stageName);
    if (stageName === "ALL") {
      pipelineRef.current?.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    const colId = `stage-col-${stageName.toLowerCase().replace(/\s+/g, "-")}`;
    const el = document.getElementById(colId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  };

  // Mouse wheel horizontal scroll handler
  const handlePipelineWheel = (e) => {
    if (!pipelineRef.current) return;
    // Map vertical mouse wheel to horizontal scroll
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      pipelineRef.current.scrollLeft += e.deltaY * 1.2;
    }
  };

  // Click & Drag to Pan
  const handleMouseDown = (e) => {
    if (e.target.closest("button, select, input, a, textarea, .cand-actions, .cand-bgv-select, .checklist-toggle-btn")) {
      return;
    }
    setIsMouseDown(true);
    setDragStartX(e.pageX - (pipelineRef.current?.offsetLeft || 0));
    setInitialScrollLeft(pipelineRef.current?.scrollLeft || 0);
  };

  const handleMouseLeave = () => setIsMouseDown(false);
  const handleMouseUp = () => setIsMouseDown(false);
  const handleMouseMove = (e) => {
    if (!isMouseDown || !pipelineRef.current) return;
    e.preventDefault();
    const x = e.pageX - pipelineRef.current.offsetLeft;
    const walk = (x - dragStartX) * 1.5;
    pipelineRef.current.scrollLeft = initialScrollLeft - walk;
  };

  const handleAddCandidate = (e) => {
    e.preventDefault();
    addCandidate(newCandidate);
    setShowAddModal(false);
    setNewCandidate({
      name: "",
      email: "",
      phone: "",
      skills: "",
      experience: "",
      department: "Engineering",
      designation: "Software Engineer",
    });
  };

  const handleStatusChange = (candidate_id, newStatus) => {
    if (newStatus === "Hired") {
      const candidate = candidates.find((c) => (c.candidate_id || c.candidateId) === candidate_id);
      setOnboardCandidate(candidate);
      if (candidate) {
        setOnboardForm((prev) => ({
          ...prev,
          department: candidate.department || "Engineering",
          designation: candidate.designation || "Software Engineer",
        }));
      }
    } else {
      updateCandidateStatus(candidate_id, newStatus);
    }
  };

  const handleBgvChange = (candidate_id, newBgvStatus) => {
    if (updateBgv) {
      updateBgv(candidate_id, newBgvStatus);
    }
  };

  const startOnboarding = async () => {
    if (!onboardCandidate) return;
    const candidateId = onboardCandidate.candidate_id || onboardCandidate.candidateId;
    await triggerOnboarding(candidateId, onboardForm);
  };

  const getInitials = (name = "") => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase() || "CD";
  };

  // Filtered Candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter((cand) => {
      // Search filter
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const nameMatch = (cand.name || "").toLowerCase().includes(q);
        const emailMatch = (cand.email || "").toLowerCase().includes(q);
        const skillsMatch = String(cand.skills || "").toLowerCase().includes(q);
        const idMatch = String(cand.candidate_id || cand.candidateId || "").toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !skillsMatch && !idMatch) return false;
      }

      // Dept filter
      if (deptFilter !== "ALL") {
        if ((cand.department || "Engineering").toLowerCase() !== deptFilter.toLowerCase()) {
          return false;
        }
      }

      // BGV filter
      if (bgvFilter !== "ALL") {
        const bgv = (cand.bgvStatus || cand.bgv_status || "Pending").toLowerCase();
        if (bgv !== bgvFilter.toLowerCase()) return false;
      }

      return true;
    });
  }, [candidates, searchQuery, deptFilter, bgvFilter]);

  // Derived Metrics
  const metrics = useMemo(() => {
    const total = candidates.length;
    const screening = candidates.filter((c) => c.status === "Screening" || c.status === "Applied").length;
    const interview = candidates.filter((c) => c.status === "Interview").length;
    const offered = candidates.filter((c) => c.status === "Offered" || c.status === "Offer Accepted" || c.status === "Selected").length;
    const hired = candidates.filter((c) => c.status === "Hired").length;
    const bgvClear = candidates.filter((c) => (c.bgvStatus || c.bgv_status || "").toLowerCase() === "clear").length;
    const bgvClearPct = total > 0 ? Math.round((bgvClear / total) * 100) : 100;
    return { total, screening, interview, offered, hired, bgvClearPct };
  }, [candidates]);

  const renderCandidateCard = (candidate) => {
    const candId = candidate.candidate_id || candidate.candidateId;
    const isHired = candidate.status === "Hired";
    const obStatus = onboardingStatus[candId];
    const bgvStatus = candidate.bgvStatus || candidate.bgv_status || "Pending";
    const { completedCount, total, pct } = getChecklistProgress(candId);

    const skillsList = Array.isArray(candidate.skills)
      ? candidate.skills
      : String(candidate.skills || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

    const onboardedEmp = employees.find((e) => e.candidate_id === candId);

    return (
      <div key={candId} className={`candidate-card ${isHired ? "hired-card" : ""}`}>
        <div className="cand-header-row">
          <div className="cand-avatar">{getInitials(candidate.name)}</div>
          <div className="cand-title-block">
            <h4 className="cand-name">{candidate.name}</h4>
            <div className="cand-id-tag">
              {isHired ? (
                <span className="id-perm">Perm: {onboardedEmp?.employee_id || "Provisioned"}</span>
              ) : (
                <span className="id-temp">{candId}</span>
              )}
              <span className="cand-dept-tag">{candidate.department || "Engineering"}</span>
            </div>
          </div>
        </div>

        <div className="cand-meta-list">
          <div className="cand-meta-item">
            <span className="meta-icon">✉️</span>
            <span className="meta-text">{candidate.email}</span>
          </div>
          {candidate.phone && (
            <div className="cand-meta-item">
              <span className="meta-icon">📞</span>
              <span className="meta-text">{candidate.phone}</span>
            </div>
          )}
          {candidate.designation && (
            <div className="cand-meta-item">
              <span className="meta-icon">💼</span>
              <span className="meta-text">{candidate.designation}</span>
            </div>
          )}
        </div>

        {/* BGV & Experience Row with Quick-Update Dropdown */}
        <div className="cand-badge-row">
          <div className="cand-bgv-wrap">
            <select
              className={`cand-bgv-select bgv-${bgvStatus.toLowerCase().replace(/\s+/g, "-")}`}
              value={bgvStatus}
              onChange={(e) => handleBgvChange(candId, e.target.value)}
              title="Click to update Background Verification (BGV) Status"
            >
              <option value="Pending">🛡️ BGV: Pending</option>
              <option value="In Progress">⏳ BGV: In Progress</option>
              <option value="Clear">✅ BGV: Clear</option>
              <option value="Flagged">⚠️ BGV: Flagged</option>
            </select>
          </div>

          {candidate.experience && (
            <span className="cand-exp-badge">⭐ {candidate.experience}</span>
          )}
        </div>

        {/* Preboarding Checklist Quick Tracker */}
        {["Offered", "Offer Accepted", "Hired"].includes(candidate.status) && (
          <div className="cand-preboarding-box">
            <div className="preboarding-progress-header">
              <span className="preboarding-label">Preboarding Checklist</span>
              <strong className="preboarding-pct">{pct}%</strong>
            </div>
            <div className="preboarding-bar-track">
              <div
                className="preboarding-bar-fill"
                style={{
                  width: `${pct}%`,
                  backgroundColor: pct === 100 ? "#10b981" : pct >= 50 ? "#6366f1" : "#f59e0b",
                }}
              />
            </div>
            <button
              type="button"
              className="checklist-toggle-btn"
              onClick={() => setChecklistCandidate(candidate)}
              title="Open full interactive IT & HR preboarding checklist"
            >
              📋 {completedCount}/{total} tasks done • Open Checklist →
            </button>
          </div>
        )}

        {/* Skills Pills */}
        {skillsList.length > 0 && (
          <div className="cand-skills">
            {skillsList.map((s, idx) => (
              <span key={idx} className="skill-pill">
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Stage Transition & Actions */}
        {!isHired ? (
          <div className="cand-actions">
            <select
              className="cand-select-status"
              value={candidate.status}
              onChange={(e) => handleStatusChange(candId, e.target.value)}
              aria-label={`Change stage for ${candidate.name}`}
            >
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  Move to: {stage}
                </option>
              ))}
            </select>

            {["Offered", "Offer Accepted"].includes(candidate.status) && (
              <button
                type="button"
                className="btn-offer-view"
                style={{
                  background: "#4f46e5",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "5px 9px",
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px"
                }}
                onClick={() => setOfferCandidate(candidate)}
                title="View / Draft Corporate Offer Letter"
              >
                📄 Offer Letter
              </button>
            )}

            <button
              type="button"
              className="btn-hire"
              onClick={() => handleStatusChange(candId, "Hired")}
              title="Hire candidate and initiate 1-click onboarding"
            >
              Hire & Onboard
            </button>
          </div>
        ) : (
          <div className="cand-onboarded-pill">
            <span className="check-icon">✓</span>
            <span>Onboarded: {obStatus || "Active Employee"}</span>
          </div>
        )}
      </div>
    );
  };

  const content = (
    <div className={`recruitment-hub ${isEmbedded ? "embedded" : ""}`}>
      {/* Hero Banner (Only in standalone mode) */}
      {!isEmbedded ? (
        <section className="recruitment-hero-banner">
          <div className="hero-left-content">
            <div className="hero-kicker-pill">
              <span className="pulsing-live-dot" />
              <span>HR Talent Acquisition</span>
            </div>
            <h1>Recruitment & Onboarding Pipeline</h1>
            <p>
              Track candidate pipelines, monitor BGV compliance, and orchestrate
              automated 1-click employee provisioning.
            </p>
          </div>

          <div className="hero-actions-cluster">
            <button
              type="button"
              className="hero-btn primary"
              onClick={() => setShowAddModal(true)}
            >
              <span>+</span> Add Candidate
            </button>
          </div>
        </section>
      ) : (
        <div className="embedded-recruitment-header">
          <div>
            <div className="embedded-kicker">
              <span className="pulsing-live-dot" />
              <span>Talent Acquisition & Preboarding Pipeline</span>
            </div>
            <h3>Active Candidate Pipeline</h3>
            <p>Manage candidate stages, BGV clearance, and 1-click employee provisioning.</p>
          </div>
          <button
            type="button"
            className="add-candidate-btn"
            onClick={() => setShowAddModal(true)}
          >
            + Add Candidate
          </button>
        </div>
      )}

      {/* Real-time Summary Metric Cards */}
      <div className="recruitment-metrics-row">
        <div className="metric-pill">
          <span className="metric-num">{metrics.total}</span>
          <span className="metric-lbl">Total Candidates</span>
        </div>
        <div className="metric-pill">
          <span className="metric-num blue">{metrics.screening}</span>
          <span className="metric-lbl">Screening & Applied</span>
        </div>
        <div className="metric-pill">
          <span className="metric-num purple">{metrics.interview}</span>
          <span className="metric-lbl">In Interview</span>
        </div>
        <div className="metric-pill">
          <span className="metric-num amber">{metrics.offered}</span>
          <span className="metric-lbl">Offers & Preboarding</span>
        </div>
        <div className="metric-pill">
          <span className="metric-num emerald">{metrics.hired}</span>
          <span className="metric-lbl">Hired & Onboarded</span>
        </div>
        <div className="metric-pill">
          <span className="metric-num teal">{metrics.bgvClearPct}%</span>
          <span className="metric-lbl">BGV Clear Rate</span>
        </div>
      </div>

      {/* 4 Specialized Recruitment & Onboarding Module Sub-Tabs */}
      <div className="recruitment-subtabs-nav" style={{
        display: "flex",
        gap: "10px",
        margin: "1rem 0 1.25rem",
        borderBottom: "2px solid #e2e8f0",
        paddingBottom: "10px",
        overflowX: "auto"
      }}>
        <button
          type="button"
          onClick={() => setActiveSubTab("pipeline")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            background: activeSubTab === "pipeline" ? "#4f46e5" : "#f8fafc",
            color: activeSubTab === "pipeline" ? "#ffffff" : "#475569",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: activeSubTab === "pipeline" ? "0 4px 10px rgba(79, 70, 229, 0.25)" : "none"
          }}
        >
          <span>🎯 Candidate Pipeline & Offers</span>
          <span style={{
            background: activeSubTab === "pipeline" ? "rgba(255,255,255,0.25)" : "#e2e8f0",
            padding: "2px 8px",
            borderRadius: "10px",
            fontSize: "0.75rem"
          }}>{candidates.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("requisitions")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            background: activeSubTab === "requisitions" ? "#4f46e5" : "#f8fafc",
            color: activeSubTab === "requisitions" ? "#ffffff" : "#475569",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: activeSubTab === "requisitions" ? "0 4px 10px rgba(79, 70, 229, 0.25)" : "none"
          }}
        >
          <span>📋 Requisitions List</span>
          <span style={{
            background: activeSubTab === "requisitions" ? "rgba(255,255,255,0.25)" : "#e2e8f0",
            padding: "2px 8px",
            borderRadius: "10px",
            fontSize: "0.75rem"
          }}>{requisitions.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("interviews")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            background: activeSubTab === "interviews" ? "#4f46e5" : "#f8fafc",
            color: activeSubTab === "interviews" ? "#ffffff" : "#475569",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: activeSubTab === "interviews" ? "0 4px 10px rgba(79, 70, 229, 0.25)" : "none"
          }}
        >
          <span>🗓️ Interview Calendar</span>
          <span style={{
            background: activeSubTab === "interviews" ? "rgba(255,255,255,0.25)" : "#e2e8f0",
            padding: "2px 8px",
            borderRadius: "10px",
            fontSize: "0.75rem"
          }}>{interviews.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("onboarding")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            background: activeSubTab === "onboarding" ? "#4f46e5" : "#f8fafc",
            color: activeSubTab === "onboarding" ? "#ffffff" : "#475569",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: activeSubTab === "onboarding" ? "0 4px 10px rgba(79, 70, 229, 0.25)" : "none"
          }}
        >
          <span>🛡️ Onboarding & Preboarding Hub</span>
          <span style={{
            background: activeSubTab === "onboarding" ? "rgba(255,255,255,0.25)" : "#e2e8f0",
            padding: "2px 8px",
            borderRadius: "10px",
            fontSize: "0.75rem"
          }}>{candidates.filter(c => ["Offered", "Offer Accepted", "Hired"].includes(c.status)).length}</span>
        </button>
      </div>

      {activeSubTab === "pipeline" && (
        <>
          {/* Interactive Toolbar: Search, Filters, & Left/Right Horizontal Scroll Controls */}
          <div className="pipeline-controls-bar">
        <div className="pipeline-filters-left">
          {/* Search Input */}
          <div className="pipeline-search-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search candidate name, email, skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pipeline-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery("")}
              >
                ✕
              </button>
            )}
          </div>

          {/* Department Filter */}
          <select
            className="pipeline-filter-select"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="ALL">All Departments</option>
            <option value="Engineering">Engineering</option>
            <option value="Product">Product</option>
            <option value="Design">Design</option>
            <option value="HR">HR</option>
            <option value="Finance">Finance</option>
            <option value="Sales">Sales</option>
            <option value="Marketing">Marketing</option>
          </select>

          {/* BGV Filter */}
          <select
            className="pipeline-filter-select"
            value={bgvFilter}
            onChange={(e) => setBgvFilter(e.target.value)}
          >
            <option value="ALL">All BGV Status</option>
            <option value="Clear">✅ BGV Clear</option>
            <option value="In Progress">⏳ In Progress</option>
            <option value="Pending">🛡️ Pending</option>
            <option value="Flagged">⚠️ Flagged</option>
          </select>
        </div>

        {/* Scroll Left / Right Controls */}
        <div className="pipeline-scroll-controls">
          <span className="scroll-hint-label">Horizontal Scroll:</span>
          <button
            type="button"
            className="scroll-btn prev"
            onClick={() => scrollPipeline("left")}
            title="Scroll Pipeline Left (or use mouse wheel)"
          >
            ◀ Scroll Left
          </button>
          <button
            type="button"
            className="scroll-btn next"
            onClick={() => scrollPipeline("right")}
            title="Scroll Pipeline Right (or use mouse wheel)"
          >
            Scroll Right ▶
          </button>
        </div>
      </div>

      {/* Stage Quick-Jump Pill Tabs */}
      <div className="stage-jump-pills-bar">
        <button
          type="button"
          className={`stage-jump-pill ${activeStagePill === "ALL" ? "active" : ""}`}
          onClick={() => scrollToStage("ALL")}
        >
          All Stages ({candidates.length})
        </button>
        {STAGES.map((st) => {
          const count = candidates.filter((c) => c.status === st).length;
          return (
            <button
              key={st}
              type="button"
              className={`stage-jump-pill ${activeStagePill === st ? "active" : ""}`}
              onClick={() => scrollToStage(st)}
            >
              {st} ({count})
            </button>
          );
        })}
      </div>

      {/* Kanban Pipeline View (Full Horizontal Scroll with Wheel & Drag) */}
      <div className="pipeline-outer-wrapper">
        <section
          ref={pipelineRef}
          className={`candidate-pipeline ${isMouseDown ? "is-dragging" : ""}`}
          onWheel={handlePipelineWheel}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          {STAGES.map((stage) => {
            const stageCandidates = filteredCandidates.filter((c) => c.status === stage);
            const colId = `stage-col-${stage.toLowerCase().replace(/\s+/g, "-")}`;
            return (
              <div
                key={stage}
                id={colId}
                className={`pipeline-stage stage-${stage.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="stage-header">
                  <div className="stage-title-wrap">
                    <span className="stage-dot" />
                    <h3>{stage}</h3>
                  </div>
                  <span className="stage-count">{stageCandidates.length}</span>
                </div>
                <div className="stage-cards-container">
                  {stageCandidates.length === 0 ? (
                    <div className="stage-empty-placeholder">
                      {searchQuery || deptFilter !== "ALL" || bgvFilter !== "ALL"
                        ? "No matching candidates"
                        : `No candidates in ${stage}`}
                    </div>
                  ) : (
                    stageCandidates.map(renderCandidateCard)
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </>
  )}

      {/* VIEW 2: JOB REQUISITIONS LIST */}
      {activeSubTab === "requisitions" && (
        <section className="requisitions-panel" style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Open Job Requisitions</h2>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                Authorized manpower requisitions, headcount budgets, and target hiring timelines.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowReqModal(true)}
              style={{
                background: "#4f46e5",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 16px",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <span>+</span> Create Requisition
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontWeight: 700 }}>
                  <th style={{ padding: "10px 14px" }}>Req Code</th>
                  <th style={{ padding: "10px 14px" }}>Position & Department</th>
                  <th style={{ padding: "10px 14px" }}>Positions (Filled/Total)</th>
                  <th style={{ padding: "10px 14px" }}>Budget CTC</th>
                  <th style={{ padding: "10px 14px" }}>Target Date</th>
                  <th style={{ padding: "10px 14px" }}>Hiring Manager</th>
                  <th style={{ padding: "10px 14px" }}>Priority</th>
                  <th style={{ padding: "10px 14px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {requisitions.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#64748b" }}>
                      <div style={{ fontSize: "1.2rem", marginBottom: "6px" }}>📋</div>
                      <strong>No Active Job Requisitions</strong>
                      <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#94a3b8" }}>
                        Click "+ New Requisition" above to post and track an open role.
                      </p>
                    </td>
                  </tr>
                ) : (
                  requisitions.map((req) => (
                  <tr key={req.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: "#4f46e5" }}>{req.id}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <strong style={{ display: "block", color: "#0f172a" }}>{req.title}</strong>
                      <small style={{ color: "#64748b" }}>{req.department}</small>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontWeight: 700 }}>{req.filled} / {req.positions}</span>
                        <div style={{ flex: 1, minWidth: "50px", maxWidth: "70px", background: "#e2e8f0", height: "6px", borderRadius: "3px", overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, (req.filled / req.positions) * 100)}%`, background: "#10b981", height: "100%" }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: "#334155" }}>{req.budget}</td>
                    <td style={{ padding: "12px 14px", color: "#64748b" }}>📅 {req.targetDate}</td>
                    <td style={{ padding: "12px 14px", color: "#334155" }}>👤 {req.hiringManager}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{
                        padding: "3px 8px",
                        borderRadius: "12px",
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        background: req.priority === "Urgent" ? "#fee2e2" : req.priority === "High" ? "#ffedd5" : "#f1f5f9",
                        color: req.priority === "Urgent" ? "#991b1b" : req.priority === "High" ? "#c2410c" : "#475569"
                      }}>
                        {req.priority}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{
                        padding: "3px 8px",
                        borderRadius: "12px",
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        background: req.status === "Open" ? "#dcfce7" : req.status === "In Review" ? "#e0e7ff" : "#f1f5f9",
                        color: req.status === "Open" ? "#166534" : req.status === "In Review" ? "#3730a3" : "#475569"
                      }}>
                        {req.status}
                      </span>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* VIEW 3: INTERVIEW CALENDAR & SCHEDULE */}
      {activeSubTab === "interviews" && (
        <section className="interviews-panel" style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Interview Calendar & Schedule</h2>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                Coordinate technical evaluations, interview panels, video meeting links, and candidate feedback scorecards.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowInterviewModal(true)}
              style={{
                background: "#4f46e5",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 16px",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <span>+</span> Schedule Interview
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: interviews.length > 0 ? "repeat(auto-fill, minmax(310px, 1fr))" : "1fr", gap: "14px" }}>
            {interviews.length === 0 ? (
              <div style={{ border: "1px dashed #cbd5e1", borderRadius: "10px", padding: "2.5rem 1rem", textAlign: "center", color: "#64748b", background: "#f8fafc" }}>
                <div style={{ fontSize: "1.3rem", marginBottom: "6px" }}>📅</div>
                <strong>No Interviews Currently Scheduled</strong>
                <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#94a3b8" }}>
                  Click "+ Schedule Interview" above to invite candidates and assign interview panel members.
                </p>
              </div>
            ) : (
              interviews.map((intv) => (
                <div key={intv.id} style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px", background: "#f8fafc", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#4f46e5" }}>{intv.id}</span>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: "10px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      background: intv.status === "Confirmed" ? "#dcfce7" : "#e0e7ff",
                      color: intv.status === "Confirmed" ? "#166534" : "#3730a3"
                    }}>
                      {intv.status}
                    </span>
                  </div>
                  <strong style={{ fontSize: "1.05rem", color: "#0f172a" }}>{intv.candidateName}</strong>
                  <span style={{ fontSize: "0.82rem", color: "#475569" }}>💼 {intv.role}</span>
                  <span style={{ fontSize: "0.8rem", color: "#6366f1", fontWeight: 600 }}>🎯 {intv.round}</span>
                  <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", gap: "10px", marginTop: "2px" }}>
                    <span>📅 {intv.date}</span>
                    <span>🕒 {intv.time}</span>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#334155" }}>
                    <span>Interviewer: <strong>{intv.panelist}</strong></span>
                  </div>
                  {intv.score && intv.score !== "Pending" && (
                    <div style={{ fontSize: "0.78rem", color: "#059669", fontWeight: 700 }}>
                      ⭐ Scorecard: {intv.score}
                    </div>
                  )}
                  <div style={{ marginTop: "6px", display: "flex", gap: "8px" }}>
                    {intv.meetingLink && intv.meetingLink.startsWith("http") ? (
                      <a
                        href={intv.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flex: 1,
                          textAlign: "center",
                          background: "#4f46e5",
                          color: "#ffffff",
                          textDecoration: "none",
                          borderRadius: "6px",
                          padding: "6px 10px",
                          fontSize: "0.78rem",
                          fontWeight: 700
                        }}
                      >
                        🔗 Join {intv.mode}
                      </a>
                    ) : (
                      <span style={{ flex: 1, textAlign: "center", background: "#e2e8f0", color: "#334155", borderRadius: "6px", padding: "6px 10px", fontSize: "0.78rem", fontWeight: 600 }}>
                        📍 {intv.mode}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* VIEW 4: ONBOARDING & PREBOARDING COMMAND CENTER */}
      {activeSubTab === "onboarding" && (
        <section className="onboarding-hub-panel" style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Onboarding & Preboarding Command Center</h2>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                Supervise background verifications (BGV), IT provisioning, signed NDA/offers, and Day 1 readiness.
              </p>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontWeight: 700 }}>
                  <th style={{ padding: "10px 14px" }}>Candidate & Role</th>
                  <th style={{ padding: "10px 14px" }}>Department</th>
                  <th style={{ padding: "10px 14px" }}>Hiring Stage</th>
                  <th style={{ padding: "10px 14px" }}>BGV Verification</th>
                  <th style={{ padding: "10px 14px" }}>Preboarding Checklist</th>
                  <th style={{ padding: "10px 14px" }}>Day 1 Status</th>
                  <th style={{ padding: "10px 14px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidates
                  .filter((c) => ["Offered", "Offer Accepted", "Hired"].includes(c.status))
                  .map((cand) => {
                    const candId = cand.candidate_id || cand.candidateId;
                    const { completedCount, total, pct } = getChecklistProgress(candId);
                    const bgv = cand.bgvStatus || cand.bgv_status || "Pending";
                    return (
                      <tr key={candId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "12px 14px" }}>
                          <strong style={{ display: "block", color: "#0f172a" }}>{cand.name}</strong>
                          <small style={{ color: "#64748b" }}>{cand.designation || "Staff"}</small>
                        </td>
                        <td style={{ padding: "12px 14px", color: "#334155" }}>{cand.department || "Engineering"}</td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{
                            padding: "3px 8px",
                            borderRadius: "12px",
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            background: cand.status === "Hired" ? "#dcfce7" : "#fef3c7",
                            color: cand.status === "Hired" ? "#166534" : "#92400e"
                          }}>
                            {cand.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{
                            padding: "3px 8px",
                            borderRadius: "12px",
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            background: bgv === "Clear" ? "#dcfce7" : bgv === "In Progress" ? "#e0e7ff" : "#fee2e2",
                            color: bgv === "Clear" ? "#166534" : bgv === "In Progress" ? "#3730a3" : "#991b1b"
                          }}>
                            {bgv === "Clear" ? "✅ Cleared" : bgv === "In Progress" ? "⏳ In Progress" : "🛡️ " + bgv}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontWeight: 700, fontSize: "0.82rem" }}>{completedCount}/{total} ({pct}%)</span>
                            <div style={{ flex: 1, minWidth: "50px", maxWidth: "70px", background: "#e2e8f0", height: "6px", borderRadius: "3px", overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, background: pct === 100 ? "#10b981" : pct >= 50 ? "#6366f1" : "#f59e0b", height: "100%" }} />
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: pct === 100 ? "#059669" : "#d97706" }}>
                            {pct === 100 ? "Ready for Day 1" : "Tasks Incomplete"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <button
                            type="button"
                            onClick={() => setChecklistCandidate(cand)}
                            style={{
                              background: "#f1f5f9",
                              color: "#334155",
                              border: "1px solid #cbd5e1",
                              borderRadius: "6px",
                              padding: "5px 10px",
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              cursor: "pointer"
                            }}
                          >
                            📋 Checklist ({completedCount}/{total})
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Preboarding Checklist Modal / Drawer */}
      {checklistCandidate && (
        <div className="modal-overlay" onClick={() => setChecklistCandidate(null)}>
          <div className="onboard-modal checklist-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <div>
                <h2>Preboarding & Induction Checklist</h2>
                <p>
                  IT Provisioning & Verification tracker for <strong>{checklistCandidate.name}</strong> (
                  {checklistCandidate.candidate_id || checklistCandidate.candidateId})
                </p>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setChecklistCandidate(null)}
              >
                ✕
              </button>
            </div>

            {/* Checklist Progress Meter */}
            {(() => {
              const { completedCount, total, pct } = getChecklistProgress(
                checklistCandidate.candidate_id || checklistCandidate.candidateId
              );
              return (
                <div className="checklist-progress-meter">
                  <div className="meter-text-row">
                    <span>Overall Preboarding Readiness:</span>
                    <strong>{completedCount} of {total} completed ({pct}%)</strong>
                  </div>
                  <div className="meter-track">
                    <div
                      className="meter-fill"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: pct === 100 ? "#10b981" : pct >= 50 ? "#6366f1" : "#f59e0b",
                      }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Interactive Tasks Checklist */}
            <div className="checklist-tasks-grid">
              {DEFAULT_CHECKLIST.map((task) => {
                const candId = checklistCandidate.candidate_id || checklistCandidate.candidateId;
                const isChecked = Boolean(checklists[candId]?.[task.id]);
                return (
                  <div
                    key={task.id}
                    className={`checklist-task-item ${isChecked ? "checked" : ""}`}
                    onClick={() => toggleChecklistItem(candId, task.id)}
                  >
                    <div className="task-checkbox-box">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleChecklistItem(candId, task.id)}
                      />
                    </div>
                    <div className="task-label-block">
                      <span className="task-category-tag">{task.category}</span>
                      <span className="task-text">{task.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="ob-actions">
              <button
                type="button"
                className="btn-start"
                onClick={() => setChecklistCandidate(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HR Compliance Audit Trail */}
      <section className="audit-panel">
        <div className="audit-panel-header">
          <div className="audit-title-wrap">
            <span className="audit-icon">📝</span>
            <h3>HR Compliance Audit Trail</h3>
          </div>
          <span className="audit-count-badge">{auditTrail.length} Logged Events</span>
        </div>
        <div className="audit-list">
          {auditTrail.length === 0 ? (
            <p className="audit-empty-text">No audit telemetry logged yet.</p>
          ) : (
            auditTrail.slice(0, 8).map((log) => (
              <div key={log.id} className="audit-item">
                <span className="audit-time">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <div className="audit-content">
                  <strong>{log.action}</strong>
                  <p>{log.details}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Add Candidate Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="onboard-modal add-candidate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <div>
                <h2>Add Candidate to Pipeline</h2>
                <p>Register a prospective candidate for screening and interview evaluation.</p>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setShowAddModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddCandidate}>
              <div className="ob-form-grid">
                <div className="ob-field">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya Sharma"
                    value={newCandidate.name}
                    onChange={(e) => setNewCandidate({ ...newCandidate, name: e.target.value })}
                  />
                </div>
                <div className="ob-field">
                  <label>Work/Personal Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. priya.sharma@example.com"
                    value={newCandidate.email}
                    onChange={(e) => setNewCandidate({ ...newCandidate, email: e.target.value })}
                  />
                </div>
                <div className="ob-field">
                  <label>Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +91 98765 43210"
                    value={newCandidate.phone}
                    onChange={(e) => setNewCandidate({ ...newCandidate, phone: e.target.value })}
                  />
                </div>
                <div className="ob-field">
                  <label>Experience</label>
                  <input
                    type="text"
                    placeholder="e.g. 4 Years"
                    value={newCandidate.experience}
                    onChange={(e) => setNewCandidate({ ...newCandidate, experience: e.target.value })}
                  />
                </div>
                <div className="ob-field">
                  <label>Department</label>
                  <select
                    value={newCandidate.department}
                    onChange={(e) => setNewCandidate({ ...newCandidate, department: e.target.value })}
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Product">Product</option>
                    <option value="Design">Design</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                    <option value="Sales">Sales</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>
                <div className="ob-field">
                  <label>Target Role / Designation</label>
                  <input
                    type="text"
                    placeholder="e.g. Full Stack Engineer"
                    value={newCandidate.designation}
                    onChange={(e) => setNewCandidate({ ...newCandidate, designation: e.target.value })}
                  />
                </div>
              </div>
              <div className="ob-field full-width">
                <label>Key Skills (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. React, Node.js, PostgreSQL, Docker"
                  value={newCandidate.skills}
                  onChange={(e) => setNewCandidate({ ...newCandidate, skills: e.target.value })}
                />
              </div>
              <div className="ob-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-start">
                  Save Candidate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enterprise Onboarding Orchestrator Modal */}
      {onboardCandidate && (
        <div className="modal-overlay" onClick={() => setOnboardCandidate(null)}>
          <div className="onboard-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <div>
                <h2>Enterprise Onboarding Orchestrator</h2>
                <p>
                  Provision official employee records and identity credentials for{" "}
                  <strong>{onboardCandidate.name}</strong>.
                </p>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setOnboardCandidate(null)}
              >
                ✕
              </button>
            </div>

            {!onboardingStatus[onboardCandidate.candidate_id || onboardCandidate.candidateId] ||
            onboardingStatus[onboardCandidate.candidate_id || onboardCandidate.candidateId] === "Failed" ? (
              <>
                {onboardingStatus[onboardCandidate.candidate_id || onboardCandidate.candidateId] === "Failed" && (
                  <div className="onboarding-fail-notice">
                    <strong>⚠️ Onboarding Failed:</strong> Account provisioning encountered an error. Please retry.
                  </div>
                )}
                <div className="ob-form-grid">
                  <div className="ob-field">
                    <label>Assigned Department</label>
                    <select
                      value={onboardForm.department}
                      onChange={(e) => setOnboardForm({ ...onboardForm, department: e.target.value })}
                    >
                      <option value="Engineering">Engineering</option>
                      <option value="Product">Product</option>
                      <option value="Design">Design</option>
                      <option value="HR">HR</option>
                      <option value="Finance">Finance</option>
                      <option value="Sales">Sales</option>
                      <option value="Marketing">Marketing</option>
                    </select>
                  </div>
                  <div className="ob-field">
                    <label>Reporting Manager</label>
                    <input
                      type="text"
                      placeholder="Type or select reporting manager"
                      list="manager-options-datalist"
                      value={onboardForm.manager}
                      onChange={(e) => setOnboardForm({ ...onboardForm, manager: e.target.value })}
                    />
                    <datalist id="manager-options-datalist">
                      {(companyEmployees.length > 0 ? companyEmployees : employees).map((emp) => (
                        <option
                          key={emp._id || emp.id || emp.employeeCode}
                          value={emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim()}
                        >
                          {emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim()} (
                          {emp.employment?.designation || emp.designation || "Manager"})
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <div className="ob-field">
                    <label>Official Designation</label>
                    <input
                      type="text"
                      required
                      value={onboardForm.designation}
                      onChange={(e) => setOnboardForm({ ...onboardForm, designation: e.target.value })}
                    />
                  </div>
                  <div className="ob-field">
                    <label>Joining Date</label>
                    <input
                      type="date"
                      required
                      value={onboardForm.joiningDate}
                      onChange={(e) => setOnboardForm({ ...onboardForm, joiningDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="ob-actions">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setOnboardCandidate(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-start"
                    onClick={startOnboarding}
                  >
                    Trigger 1-Click Provisioning
                  </button>
                </div>
              </>
            ) : (
              <div className="onboarding-progress-view">
                {onboardingStatus[onboardCandidate.candidate_id || onboardCandidate.candidateId] === "Completed" ? (
                  <>
                    <div className="status-success-icon">✅</div>
                    <div className="status-text">Onboarding Complete!</div>
                    <p className="status-subtext">
                      Permanent Employee Code allocated, PostgreSQL database record created, and onboarding pack dispatched.
                    </p>

                    <div className="email-preview-box">
                      <div className="email-preview-kicker">Official Welcome Dispatch Preview:</div>
                      <div className="email-preview-card">
                        <p>
                          <strong>To:</strong> {onboardCandidate.email}
                        </p>
                        <p>
                          <strong>Subject:</strong> Welcome to Quadratic Systems! Next Steps & Access.
                        </p>
                        <hr className="email-divider" />
                        <p>
                          Hi <strong>{onboardCandidate.name}</strong>,
                        </p>
                        <p>Welcome to the team! Your employee profile and system credentials have been initialized.</p>
                        <ul className="email-list">
                          <li>
                            <strong>Permanent Employee ID:</strong>{" "}
                            {employees.find(
                              (e) =>
                                e.candidate_id ===
                                (onboardCandidate.candidate_id || onboardCandidate.candidateId)
                            )?.employee_id || "EMP-PROVISIONED"}
                          </li>
                          <li>
                            <strong>Department:</strong> {onboardForm.department}
                          </li>
                          <li>
                            <strong>Designation:</strong> {onboardForm.designation}
                          </li>
                          <li>
                            <strong>Reporting Manager:</strong> {onboardForm.manager || "Executive Management"}
                          </li>
                          <li>
                            <strong>Joining Date:</strong> {onboardForm.joiningDate}
                          </li>
                        </ul>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-start"
                      onClick={() => setOnboardCandidate(null)}
                    >
                      Close Workflow
                    </button>
                  </>
                ) : (
                  <>
                    <div className="status-spinner">⚙️</div>
                    <div className="status-text">
                      {onboardingStatus[onboardCandidate.candidate_id || onboardCandidate.candidateId]}
                    </div>
                    <p>Orchestrating identity, credentials, and master database entry...</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Offer Letter Generator & Preview Modal */}
      {offerCandidate && (
        <div className="modal-overlay" onClick={() => setOfferCandidate(null)}>
          <div className="onboard-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "680px", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="modal-header-row" style={{ borderBottom: "2px solid #e2e8f0", paddingBottom: "12px" }}>
              <div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "1px" }}>Official Enterprise Offer Letter</span>
                <h2 style={{ margin: "4px 0", color: "#0f172a" }}>Offer of Employment</h2>
                <p style={{ margin: 0, color: "#64748b", fontSize: "0.82rem" }}>
                  Ref: QUAD-OFFER-2026-{(offerCandidate.candidate_id || offerCandidate.candidateId || "CAND").slice(-4).toUpperCase()} • Date: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <button type="button" className="btn-modal-close" onClick={() => setOfferCandidate(null)}>✕</button>
            </div>

            <div style={{ padding: "16px 0", fontSize: "0.9rem", color: "#334155", lineHeight: 1.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "14px" }}>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Candidate Name</span>
                  <strong style={{ display: "block", color: "#0f172a" }}>{offerCandidate.name}</strong>
                  <small style={{ color: "#64748b" }}>{offerCandidate.email}</small>
                </div>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Designation & Dept</span>
                  <strong style={{ display: "block", color: "#4f46e5" }}>{offerCandidate.designation || "Software Engineer"}</strong>
                  <small style={{ color: "#64748b" }}>{offerCandidate.department || "Engineering"}</small>
                </div>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Joining Location</span>
                  <strong style={{ display: "block", color: "#0f172a" }}>Hyderabad HQ</strong>
                  <small style={{ color: "#10b981", fontWeight: 600 }}>Full-Time / Regular</small>
                </div>
              </div>

              <p>
                Dear <strong>{offerCandidate.name}</strong>,
              </p>
              <p>
                On behalf of Quadratic Enterprises, we are pleased to extend this formal offer of employment for the position of{" "}
                <strong>{offerCandidate.designation || "Software Engineer"}</strong> in the <strong>{offerCandidate.department || "Engineering"}</strong> department.
              </p>

              <h4 style={{ margin: "16px 0 8px", color: "#0f172a", fontSize: "0.95rem" }}>Annual Compensation Breakdown (INR)</h4>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem", marginBottom: "14px" }}>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 10px" }}>Basic Salary (50%)</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>₹9,00,000</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 10px" }}>House Rent Allowance / HRA (25%)</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>₹4,50,000</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 10px" }}>Special & Flexi Allowances (15%)</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>₹2,70,000</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 10px" }}>Employer Provident Fund & Retirals (10%)</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>₹1,80,000</td>
                  </tr>
                  <tr style={{ background: "#f8fafc", fontWeight: 800, color: "#0f172a" }}>
                    <td style={{ padding: "10px" }}>Total Fixed Annual CTC</td>
                    <td style={{ padding: "10px", textAlign: "right", color: "#4f46e5", fontSize: "1.05rem" }}>₹18,00,000</td>
                  </tr>
                </tbody>
              </table>

              <p style={{ fontSize: "0.82rem", color: "#64748b" }}>
                * This offer is contingent upon satisfactory completion of background verification (BGV) and presentation of valid proof of identity and education credentials.
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #e2e8f0", paddingTop: "14px" }}>
              <button
                type="button"
                onClick={() => setOfferCandidate(null)}
                style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", fontWeight: 600, cursor: "pointer" }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#4f46e5", color: "#ffffff", fontWeight: 700, cursor: "pointer" }}
              >
                🖨️ Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Requisition Modal */}
      {showReqModal && (
        <div className="modal-overlay" onClick={() => setShowReqModal(false)}>
          <div className="onboard-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
            <div className="modal-header-row">
              <div>
                <h2>Create Job Requisition</h2>
                <p>Authorize a new manpower position and allocate budget.</p>
              </div>
              <button type="button" className="btn-modal-close" onClick={() => setShowReqModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateReq} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>Job Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior DevOps Engineer"
                  value={newReq.title}
                  onChange={(e) => setNewReq({ ...newReq, title: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>Department</label>
                  <select
                    value={newReq.department}
                    onChange={(e) => setNewReq({ ...newReq, department: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Product">Product</option>
                    <option value="Design">Design</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                    <option value="Infrastructure">Infrastructure</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>Open Positions</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newReq.positions}
                    onChange={(e) => setNewReq({ ...newReq, positions: parseInt(e.target.value, 10) || 1 })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>Budget CTC Range</label>
                  <input
                    type="text"
                    placeholder="e.g. ₹18L - ₹24L"
                    value={newReq.budget}
                    onChange={(e) => setNewReq({ ...newReq, budget: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>Priority</label>
                  <select
                    value={newReq.priority}
                    onChange={(e) => setNewReq({ ...newReq, priority: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  >
                    <option value="Urgent">Urgent</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Standard">Standard</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>Target Joining Date</label>
                  <input
                    type="date"
                    required
                    value={newReq.targetDate}
                    onChange={(e) => setNewReq({ ...newReq, targetDate: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>Hiring Manager</label>
                  <input
                    type="text"
                    required
                    value={newReq.hiringManager}
                    onChange={(e) => setNewReq({ ...newReq, hiringManager: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" onClick={() => setShowReqModal(false)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button type="submit" style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#4f46e5", color: "#ffffff", fontWeight: 700, cursor: "pointer" }}>Authorize Requisition</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Interview Modal */}
      {showInterviewModal && (
        <div className="modal-overlay" onClick={() => setShowInterviewModal(false)}>
          <div className="onboard-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
            <div className="modal-header-row">
              <div>
                <h2>Schedule Evaluation Interview</h2>
                <p>Assign panelists, interview round, and video meeting coordinates.</p>
              </div>
              <button type="button" className="btn-modal-close" onClick={() => setShowInterviewModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateInterview} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>Candidate Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Arjun Verma"
                  value={newInterview.candidateName}
                  onChange={(e) => setNewInterview({ ...newInterview, candidateName: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>Target Role</label>
                  <input
                    type="text"
                    required
                    value={newInterview.role}
                    onChange={(e) => setNewInterview({ ...newInterview, role: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>Evaluation Round</label>
                  <select
                    value={newInterview.round}
                    onChange={(e) => setNewInterview({ ...newInterview, round: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  >
                    <option value="Screening Round">Screening Round</option>
                    <option value="Technical Round 1 (Coding)">Technical Round 1 (Coding)</option>
                    <option value="Technical Round 2 (System Design)">Technical Round 2 (System Design)</option>
                    <option value="Managerial & Culture Fit">Managerial & Culture Fit</option>
                    <option value="HR Leadership Final">HR Leadership Final</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>Date</label>
                  <input
                    type="date"
                    required
                    value={newInterview.date}
                    onChange={(e) => setNewInterview({ ...newInterview, date: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>Time (IST)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 03:00 PM"
                    value={newInterview.time}
                    onChange={(e) => setNewInterview({ ...newInterview, time: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>Interviewer / Panelist</label>
                  <input
                    type="text"
                    required
                    value={newInterview.panelist}
                    onChange={(e) => setNewInterview({ ...newInterview, panelist: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>Mode</label>
                  <select
                    value={newInterview.mode}
                    onChange={(e) => setNewInterview({ ...newInterview, mode: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  >
                    <option value="Google Meet">Google Meet</option>
                    <option value="Microsoft Teams">Microsoft Teams</option>
                    <option value="In-Person HQ">In-Person HQ</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>Video Meeting Link / Room</label>
                <input
                  type="text"
                  required
                  placeholder="https://meet.google.com/..."
                  value={newInterview.meetingLink}
                  onChange={(e) => setNewInterview({ ...newInterview, meetingLink: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" onClick={() => setShowInterviewModal(false)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button type="submit" style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#4f46e5", color: "#ffffff", fontWeight: 700, cursor: "pointer" }}>Confirm & Dispatch Invite</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  if (isEmbedded) {
    return <div className="recruitment-embedded-pane">{content}</div>;
  }

  return (
    <>
      <EmployeeHeader />
      <main className="recruitment-hub-page">{content}</main>
    </>
  );
}
