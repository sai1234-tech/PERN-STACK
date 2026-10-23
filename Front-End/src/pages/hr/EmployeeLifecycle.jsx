import React, { useState, useEffect, useMemo, useCallback } from "react";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import Loader from "../../components/common/Loader";
import { getEmployees } from "../../services/hrService";
import { getLifecycleStages, getEmployeeLifecycle, advanceLifecycleStage } from "../../services/lifecycleService";
import "./EmployeeLifecycle.css";

const PHASES = [
  { id: "all", name: "Full Journey (All 22 Stages)" },
  { id: "Talent Acquisition", name: "Phase 1: Sourcing & Selection (1–6)" },
  { id: "Preboarding", name: "Phase 2: Preboarding & Verification (7–11)" },
  { id: "Joining & Onboarding", name: "Phase 3: Joining & Deployment (12–14)" },
  { id: "Active Employment", name: "Phase 4: Active Lifecycle (15–18)" },
  { id: "Offboarding & Separation", name: "Phase 5: Offboarding & Exit (19–22)" },
];

export default function EmployeeLifecycle({ isEmbedded = false, initialEmployeeId = null }) {
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState(initialEmployeeId || "");
  const [lifecycleData, setLifecycleData] = useState(null);
  const [stagesMaster, setStagesMaster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingStage, setUpdatingStage] = useState(null);
  const [activePhaseTab, setActivePhaseTab] = useState("all");
  const [selectedStageDetail, setSelectedStageDetail] = useState(null);
  const [actionModal, setActionModal] = useState(null); // { stage }
  const [actionNotes, setActionNotes] = useState("");
  const [actionStatus, setActionStatus] = useState("Completed");

  // Load initial employees list & stages blueprint
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        setLoading(true);
        const [empRes, stagesRes] = await Promise.all([
          getEmployees().catch(() => ({ employees: [] })),
          getLifecycleStages().catch(() => ({ stages: [] })),
        ]);

        if (!mounted) return;
        const list = empRes?.employees || empRes?.data || [];
        setEmployees(Array.isArray(list) ? list : []);
        setStagesMaster(stagesRes?.stages || []);

        const defaultId = initialEmployeeId || (list.length > 0 ? (list[0].id || list[0]._id) : "");
        setSelectedEmpId(defaultId);
      } catch (err) {
        console.error("Failed to load lifecycle base data:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();
    return () => { mounted = false; };
  }, [initialEmployeeId]);

  // Load selected employee's lifecycle
  const loadEmployeeData = useCallback(async (empId) => {
    if (!empId) return;
    try {
      setLoading(true);
      const res = await getEmployeeLifecycle(empId);
      setLifecycleData(res);
      if (res.stages && res.stages.length > 0) {
        setSelectedStageDetail(res.stages.find((s) => s.stageNumber === res.summary?.currentStage) || res.stages[0]);
      }
    } catch (err) {
      console.error("Failed to fetch employee lifecycle:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedEmpId) {
      loadEmployeeData(selectedEmpId);
    }
  }, [selectedEmpId, loadEmployeeData]);

  // Handle stage transition submit
  const handleAdvanceStage = async (e) => {
    e.preventDefault();
    if (!actionModal) return;
    setUpdatingStage(actionModal.stageNumber);
    try {
      await advanceLifecycleStage({
        employeeId: selectedEmpId,
        stageNumber: actionModal.stageNumber,
        status: actionStatus,
        notes: actionNotes,
      });
      setActionModal(null);
      setActionNotes("");
      await loadEmployeeData(selectedEmpId);
    } catch (err) {
      alert("Failed to advance stage: " + err.message);
    } finally {
      setUpdatingStage(null);
    }
  };

  // Filtered stages based on phase tab
  const displayedStages = useMemo(() => {
    if (!lifecycleData?.stages) return [];
    if (activePhaseTab === "all") return lifecycleData.stages;
    return lifecycleData.stages.filter((s) => s.phase === activePhaseTab);
  }, [lifecycleData, activePhaseTab]);

  const summary = lifecycleData?.summary || {
    totalStages: 22,
    completedCount: 0,
    progressPct: 0,
    currentStage: 1,
    currentStageName: "Manpower Request",
    isSeparated: false,
  };

  const currentEmp = lifecycleData?.employee || {};

  return (
    <div className={`lifecycle-hub-page ${isEmbedded ? "embedded" : ""}`}>
      {!isEmbedded && <EmployeeHeader />}

      <main className="lifecycle-container">
        {/* Hero Command Banner */}
        <header className="lifecycle-hero-banner">
          <div className="lifecycle-hero-left">
            <div className="hero-kicker-pill">
              <span className="live-pulse-dot" />
              <span>HRMS End-to-End Orchestrator</span>
            </div>
            <h1>Employee Lifecycle — HRMS Workflow</h1>
            <p>
              Real-time monitoring and governance of the 22-stage employee journey — from
              manpower requisition, interview selection, and IT provisioning to project allocation,
              payroll runs, and final exit clearance.
            </p>
          </div>

          <div className="lifecycle-hero-selector">
            <label>Select Workforce Member:</label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="emp-lifecycle-select"
            >
              {employees.map((emp) => {
                const name = emp.firstName ? `${emp.firstName} ${emp.lastName || ""}`.trim() : (emp.name || emp.user?.name || "Employee");
                const code = emp.employeeCode || emp.employee_code || "EMP";
                const dept = emp.department || emp.employment?.department || "General";
                return (
                  <option key={emp.id || emp._id} value={emp.id || emp._id}>
                    {name} ({code} - {dept})
                  </option>
                );
              })}
            </select>
          </div>
        </header>

        {loading && !lifecycleData ? (
          <Loader label="Computing 22-stage workflow dependencies..." />
        ) : (
          <>
            {/* Journey Summary Dashboard Cards */}
            <section className="lifecycle-summary-grid">
              <article className="lifecycle-card profile-card">
                <div className="profile-badge-row">
                  <span className="avatar-circle">
                    {(currentEmp.name || "E").slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <h3>{currentEmp.name}</h3>
                    <p className="emp-sub-meta">
                      <span>{currentEmp.code}</span> • <span>{currentEmp.designation}</span>
                    </p>
                  </div>
                </div>
                <div className="profile-details-mini">
                  <div>
                    <strong>Department:</strong> {currentEmp.department}
                  </div>
                  <div>
                    <strong>Joining Date:</strong>{" "}
                    {currentEmp.joiningDate ? new Date(currentEmp.joiningDate).toLocaleDateString() : "Active"}
                  </div>
                  <div>
                    <strong>Employment Status:</strong>{" "}
                    <span className={`status-pill ${summary.isSeparated ? "separated" : "active"}`}>
                      {summary.isSeparated ? "Separated / Inactive" : "Active In Roster"}
                    </span>
                  </div>
                </div>
              </article>

              <article className="lifecycle-card progress-card">
                <div className="progress-card-top">
                  <div>
                    <span className="card-kicker">Overall Journey Progress</span>
                    <h2>{summary.progressPct}% Complete</h2>
                  </div>
                  <div className="stage-counter-circle">
                    <strong>{summary.completedCount}</strong>
                    <span>/ 22</span>
                  </div>
                </div>
                <div className="journey-progress-bar-wrap">
                  <div className="journey-progress-bar" style={{ width: `${summary.progressPct}%` }} />
                </div>
                <p className="progress-foot-note">
                  Current Active Milestone: <strong>Stage {summary.currentStage} — {summary.currentStageName}</strong>
                </p>
              </article>

              <article className="lifecycle-card governance-card">
                <span className="card-kicker">Workflow Governance Rules</span>
                <ul className="governance-rules-list">
                  <li>
                    <span>🔒 Dual Approval:</span> Requisitions require Manager & HR sign-off.
                  </li>
                  <li>
                    <span>🛡️ Compliance Gate:</span> BGV & document checks lock employee provisioning.
                  </li>
                  <li>
                    <span>💳 Separation Rule:</span> F&F settlement is locked until all 4 clearances clear.
                  </li>
                  <li>
                    <span>📜 Audit Trail:</span> Every stage transition is immutably logged with actor IDs.
                  </li>
                </ul>
              </article>
            </section>

            {/* Phase Navigation Tabs */}
            <nav className="lifecycle-phase-tabs">
              {PHASES.map((ph) => (
                <button
                  key={ph.id}
                  type="button"
                  className={`phase-tab-btn ${activePhaseTab === ph.id ? "active" : ""}`}
                  onClick={() => setActivePhaseTab(ph.id)}
                >
                  {ph.name}
                </button>
              ))}
            </nav>

            {/* Main Stage Grid & Detail Inspector */}
            <div className="lifecycle-workspace-layout">
              {/* Left Column: 22-Stage Workflow Stepper Grid */}
              <div className="stages-timeline-column">
                <div className="stages-cards-grid">
                  {displayedStages.map((st) => {
                    const isSelected = selectedStageDetail?.stageNumber === st.stageNumber;
                    const isCompleted = st.status === "Completed";
                    const isInProgress = st.status === "In Progress";
                    const isPending = st.status === "Pending";
                    const isRejected = st.status === "Rejected";

                    return (
                      <div
                        key={st.stageNumber}
                        className={`stage-card ${isSelected ? "selected" : ""} ${st.status.toLowerCase().replace(/\s+/g, "-")}`}
                        onClick={() => setSelectedStageDetail(st)}
                      >
                        <div className="stage-card-header">
                          <div className="stage-num-badge">Stage {st.stageNumber}</div>
                          <span className={`status-badge ${st.status.toLowerCase().replace(/\s+/g, "-")}`}>
                            {isCompleted ? "✓ Completed" : isInProgress ? "⏳ In Progress" : isRejected ? "✕ Rejected" : "Pending"}
                          </span>
                        </div>

                        <h4 className="stage-title">{st.title}</h4>
                        <span className="stage-phase-sub">{st.phase}</span>
                        <p className="stage-desc-brief">{st.description}</p>

                        <div className="stage-card-footer">
                          <div className="stage-owner-tag">
                            <span className="owner-icon">👤</span> {st.owner}
                          </div>
                          {st.details && <div className="stage-live-hint">{st.details}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Stage Deep-Dive & Action Console */}
              {selectedStageDetail && (
                <aside className="stage-inspector-panel">
                  <div className="inspector-header">
                    <div className="inspector-stage-tag">
                      Stage {selectedStageDetail.stageNumber} of 22
                    </div>
                    <h3>{selectedStageDetail.title}</h3>
                    <span className="inspector-phase">{selectedStageDetail.phase}</span>
                  </div>

                  <div className="inspector-body">
                    <div className="inspector-field">
                      <label>Status & Progress:</label>
                      <div className="inspector-status-row">
                        <span className={`status-badge ${selectedStageDetail.status.toLowerCase().replace(/\s+/g, "-")}`}>
                          {selectedStageDetail.status}
                        </span>
                        {selectedStageDetail.completedAt && (
                          <small>Date: {new Date(selectedStageDetail.completedAt).toLocaleDateString()}</small>
                        )}
                      </div>
                    </div>

                    <div className="inspector-field">
                      <label>Stage Objective:</label>
                      <p>{selectedStageDetail.description}</p>
                    </div>

                    <div className="inspector-field">
                      <label>Responsible Stage Owner:</label>
                      <div className="owner-chip">
                        <span>👔</span> <strong>{selectedStageDetail.owner}</strong>
                      </div>
                    </div>

                    <div className="inspector-field">
                      <label>Approval Rule & Authority:</label>
                      <p className="rule-box">
                        <span>⚖️</span> {selectedStageDetail.approvalRules}
                      </p>
                    </div>

                    <div className="inspector-field">
                      <label>Automated Notification Trigger:</label>
                      <p className="notify-box">
                        <span>🔔</span> {selectedStageDetail.notification}
                      </p>
                    </div>

                    <div className="inspector-field">
                      <label>Database Relationship & Model:</label>
                      <code className="db-entity-tag">
                        {selectedStageDetail.dbEntity}
                      </code>
                    </div>

                    {selectedStageDetail.details && (
                      <div className="inspector-field highlight">
                        <label>Live Database Record Data:</label>
                        <div className="live-data-callout">
                          ✓ {selectedStageDetail.details}
                        </div>
                      </div>
                    )}

                    {/* Stage Transition Action Button */}
                    <div className="inspector-actions">
                      <button
                        type="button"
                        className="advance-stage-btn"
                        onClick={() => {
                          setActionModal(selectedStageDetail);
                          setActionStatus(selectedStageDetail.status === "Completed" ? "Completed" : "Completed");
                        }}
                      >
                        ⚡ Transition / Update Stage {selectedStageDetail.stageNumber}
                      </button>
                    </div>
                  </div>

                  {/* Audit History Timeline for this stage / employee */}
                  <div className="inspector-audit-section">
                    <h4>Stage Telemetry & Audit Logs</h4>
                    {lifecycleData?.auditHistory?.length > 0 ? (
                      <div className="mini-audit-feed">
                        {lifecycleData.auditHistory.slice(0, 5).map((log) => (
                          <div key={log.id} className="audit-feed-item">
                            <span className="audit-dot" />
                            <div className="audit-feed-meta">
                              <strong>{log.action}</strong>
                              <span>By: {log.user_name || "System"} • {new Date(log.created_at).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="no-audits-note">No recent audit logs for this record.</p>
                    )}
                  </div>
                </aside>
              )}
            </div>
          </>
        )}

        {/* Transition Stage Modal */}
        {actionModal && (
          <div className="lifecycle-modal-backdrop" onClick={() => setActionModal(null)}>
            <div className="lifecycle-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <span className="modal-kicker">Stage {actionModal.stageNumber} Workflow Transition</span>
                  <h3>{actionModal.title}</h3>
                </div>
                <button type="button" className="close-btn" onClick={() => setActionModal(null)}>
                  ✕
                </button>
              </div>

              <form onSubmit={handleAdvanceStage} className="modal-form">
                <div className="form-group">
                  <label>Update Workflow Status *</label>
                  <select
                    value={actionStatus}
                    onChange={(e) => setActionStatus(e.target.value)}
                    className="modal-select"
                  >
                    <option value="Completed">✓ Completed (Approve & Finalize)</option>
                    <option value="In Progress">⏳ In Progress (Under Review)</option>
                    <option value="Approved">👍 Approved (Passed Governance)</option>
                    <option value="Pending">🛡️ Pending (Awaiting Dependency)</option>
                    <option value="Rejected">✕ Rejected / Flagged</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Audit & Transition Notes *</label>
                  <textarea
                    rows={3}
                    placeholder="Provide operational context or approval rationale (will be logged in immutable audit trail)..."
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    required
                    className="modal-textarea"
                  />
                </div>

                <div className="modal-foot-actions">
                  <button type="button" className="cancel-btn" onClick={() => setActionModal(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="confirm-btn" disabled={Boolean(updatingStage)}>
                    {updatingStage ? "Recording to Audit Trail..." : `✓ Commit Stage ${actionModal.stageNumber} Transition`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
