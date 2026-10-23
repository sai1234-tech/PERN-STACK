import React, { useState, useEffect, useCallback } from "react";
import { enterpriseAutomationsService } from "../../services/enterpriseAutomationsService";
import { toast } from "react-toastify";
import "./EnterpriseAutomationsHub.css";

const TAB_CONFIG = [
  { id: "overview", label: "Executive Posture", icon: "⚡" },
  { id: "onboarding", label: "Role/Client Onboarding", icon: "📋" },
  { id: "missing_docs", label: "Missing-Doc Reminders", icon: "📑" },
  { id: "bgv_slas", label: "BGV SLA Escalations", icon: "🔍" },
  { id: "payroll_cutoff", label: "Monthly Payroll Cut-Off", icon: "💳" },
  { id: "probation", label: "Probation Reminders", icon: "⏳" },
  { id: "performance", label: "Performance Reminders", icon: "🎯" },
  { id: "exit_clearance", label: "Exit Clearance (5 Depts)", icon: "🚪" },
  { id: "helpdesk_slas", label: "Helpdesk SLA Escalations", icon: "🎟️" },
  { id: "reports", label: "Scheduled Reports", icon: "📊" },
];

export default function EnterpriseAutomationsHub() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);

  // Data states
  const [onboardingInstances, setOnboardingInstances] = useState([]);
  const [onboardingTemplates, setOnboardingTemplates] = useState([]);
  const [activeOnboardingModal, setActiveOnboardingModal] = useState(false);
  const [onboardForm, setOnboardForm] = useState({ employeeId: "1", role: "Engineering", clientId: "" });

  const [missingDocs, setMissingDocs] = useState([]);
  const [bgvEscalations, setBgvEscalations] = useState([]);
  const [cutoffBatches, setCutoffBatches] = useState([]);

  const [probationAlerts, setProbationAlerts] = useState([]);
  const [activeProbationModal, setActiveProbationModal] = useState(null);
  const [probationDecisionForm, setProbationDecisionForm] = useState({ recommendationStatus: "CONFIRMED", managerComments: "" });

  const [perfAlerts, setPerfAlerts] = useState([]);
  const [exitTasks, setExitTasks] = useState([]);
  const [ticketEscalations, setTicketEscalations] = useState([]);
  const [scheduledReports, setScheduledReports] = useState([]);
  const [reportExecutions, setReportExecutions] = useState([]);

  // Fetch Overview Data
  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await enterpriseAutomationsService.getOverview();
      if (res.success) {
        setOverview(res.data);
      }
    } catch (err) {
      console.error("Failed to load automations overview:", err);
      toast.error("Failed to load automation engine metrics.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Tab-Specific Data
  const loadTabData = useCallback(async (tabId) => {
    try {
      if (tabId === "onboarding") {
        const [instRes, tplRes] = await Promise.all([
          enterpriseAutomationsService.getOnboardingInstances(),
          enterpriseAutomationsService.getOnboardingTemplates(),
        ]);
        if (instRes.success) setOnboardingInstances(instRes.data);
        if (tplRes.success) setOnboardingTemplates(tplRes.data);
      } else if (tabId === "missing_docs") {
        const res = await enterpriseAutomationsService.getMissingDocumentReminders();
        if (res.success) setMissingDocs(res.data);
      } else if (tabId === "bgv_slas") {
        const res = await enterpriseAutomationsService.getBgvSlaEscalations();
        if (res.success) setBgvEscalations(res.data);
      } else if (tabId === "payroll_cutoff") {
        const res = await enterpriseAutomationsService.getCutoffBatches();
        if (res.success) setCutoffBatches(res.data);
      } else if (tabId === "probation") {
        const res = await enterpriseAutomationsService.getProbationAlerts();
        if (res.success) setProbationAlerts(res.data);
      } else if (tabId === "performance") {
        const res = await enterpriseAutomationsService.getPerformanceAlerts();
        if (res.success) setPerfAlerts(res.data);
      } else if (tabId === "exit_clearance") {
        const res = await enterpriseAutomationsService.getExitClearanceTasks();
        if (res.success) setExitTasks(res.data);
      } else if (tabId === "helpdesk_slas") {
        const res = await enterpriseAutomationsService.getTicketSlaEscalations();
        if (res.success) setTicketEscalations(res.data);
      } else if (tabId === "reports") {
        const [repRes, execRes] = await Promise.all([
          enterpriseAutomationsService.getScheduledReports(),
          enterpriseAutomationsService.getReportExecutions(),
        ]);
        if (repRes.success) setScheduledReports(repRes.data);
        if (execRes.success) setReportExecutions(execRes.data);
      }
    } catch (err) {
      console.error(`Error loading data for tab ${tabId}:`, err);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  // Actions
  const handleGenerateOnboarding = async (e) => {
    e.preventDefault();
    try {
      const res = await enterpriseAutomationsService.generateOnboardingChecklist(onboardForm);
      if (res.success) {
        toast.success(res.message);
        setActiveOnboardingModal(false);
        loadTabData("onboarding");
        loadOverview();
      }
    } catch {
      toast.error("Failed to generate onboarding checklist.");
    }
  };

  const handleToggleOnboardTask = async (taskId, currentStatus) => {
    const nextStatus = currentStatus === "Completed" ? "Pending" : "Completed";
    try {
      const res = await enterpriseAutomationsService.updateOnboardingTaskStatus(taskId, nextStatus);
      if (res.success) {
        toast.info(`Task marked as ${nextStatus}.`);
        loadTabData("onboarding");
        loadOverview();
      }
    } catch {
      toast.error("Failed to update onboarding task.");
    }
  };

  const handleScanMissingDocs = async () => {
    try {
      const res = await enterpriseAutomationsService.scanMissingDocuments();
      if (res.success) {
        toast.success(res.message);
        loadTabData("missing_docs");
        loadOverview();
      }
    } catch {
      toast.error("Failed to scan documents.");
    }
  };

  const handleRemindDoc = async (id) => {
    try {
      const res = await enterpriseAutomationsService.triggerMissingDocReminder(id);
      if (res.success) {
        toast.success(res.message);
        loadTabData("missing_docs");
      }
    } catch {
      toast.error("Failed to send reminder.");
    }
  };

  const handleEscalateBgv = async (id) => {
    try {
      const res = await enterpriseAutomationsService.triggerBgvEscalation({ id, escalationLevel: "L2_DIRECTOR" });
      if (res.success) {
        toast.warning(res.message);
        loadTabData("bgv_slas");
        loadOverview();
      }
    } catch {
      toast.error("Failed to escalate BGV docket.");
    }
  };

  const handleRunCutoff = async () => {
    try {
      const res = await enterpriseAutomationsService.executeMonthlyCutoff({ month: "October", year: 2026, cutoffDay: 25 });
      if (res.success) {
        toast.success(res.message);
        loadTabData("payroll_cutoff");
        loadOverview();
      }
    } catch {
      toast.error("Failed to execute monthly payroll cut-off.");
    }
  };

  const handleSubmitProbationDecision = async (e) => {
    e.preventDefault();
    if (!activeProbationModal) return;
    try {
      const res = await enterpriseAutomationsService.updateProbationDecision(activeProbationModal.id, probationDecisionForm);
      if (res.success) {
        toast.success(res.message);
        setActiveProbationModal(null);
        loadTabData("probation");
        loadOverview();
      }
    } catch {
      toast.error("Failed to record probation decision.");
    }
  };

  const handleBroadcastPerfReminder = async () => {
    try {
      const res = await enterpriseAutomationsService.dispatchPerformanceReminder({
        cycleId: 1,
        stage: "SELF_APPRAISAL",
        message: "Automated Reminder: Q4 2026 Performance Self-Appraisals close in 5 days. Submit your ratings now.",
      });
      if (res.success) {
        toast.success(res.message);
        loadTabData("performance");
        loadOverview();
      }
    } catch {
      toast.error("Failed to dispatch performance reminder.");
    }
  };

  const handleClearExitTask = async (taskId, currentStatus) => {
    const nextStatus = currentStatus === "Cleared" ? "Pending" : "Cleared";
    try {
      const res = await enterpriseAutomationsService.updateClearanceTaskStatus(taskId, {
        status: nextStatus,
        remarks: nextStatus === "Cleared" ? "Department clearance verified and signed off" : "Under review",
      });
      if (res.success) {
        toast.success(`Clearance task updated to '${nextStatus}'.`);
        loadTabData("exit_clearance");
        loadOverview();
      }
    } catch {
      toast.error("Failed to update exit clearance task.");
    }
  };

  const handleEvaluateTicketSlas = async () => {
    try {
      const res = await enterpriseAutomationsService.evaluateTicketSlas();
      if (res.success) {
        toast.info(res.message);
        loadTabData("helpdesk_slas");
        loadOverview();
      }
    } catch {
      toast.error("Failed to evaluate ticket SLAs.");
    }
  };

  const handleRunReport = async (code) => {
    try {
      const res = await enterpriseAutomationsService.runScheduledReport(code);
      if (res.success) {
        toast.success(res.message);
        loadTabData("reports");
        loadOverview();
      }
    } catch {
      toast.error("Failed to generate scheduled report.");
    }
  };

  return (
    <div className="auto-hub-container">
      {/* ── HEADER ── */}
      <div className="auto-header">
        <div>
          <div className="auto-header-title-row">
            <span className="auto-gear-icon">⚙️</span>
            <div>
              <h1>Lifecycle Automations, SLA Escalation Engines & Scheduled Reports</h1>
              <p>
                Enterprise rule-based automation engine: Role & client-based onboarding checklists, missing-document reminders,
                BGV SLA escalations, 25th monthly payroll cut-off, probation/performance alerts, 5-department exit clearance,
                helpdesk SLA escalations, and scheduled authorized reports.
              </p>
            </div>
          </div>
          <div className="auto-header-badges">
            <span className="auto-badge auto-badge-active">✓ 9 Automation Engines Live</span>
            <span className="auto-badge auto-badge-sla">⏱️ Dynamic SLA Trackers Active</span>
            <span className="auto-badge auto-badge-scheduled">📊 Automated Reporting Scheduler</span>
          </div>
        </div>

        <div className="auto-header-actions">
          <button className="btn-auto-secondary" onClick={() => { loadOverview(); loadTabData(activeTab); }}>
            🔄 Refresh Telemetry
          </button>
          <button className="btn-auto-action" onClick={handleRunCutoff}>
            ⚡ Run Monthly Payroll Cut-off (25th)
          </button>
        </div>
      </div>

      {/* ── NAVIGATION TABS ── */}
      <div className="auto-tabs-bar">
        {TAB_CONFIG.map((t) => (
          <button
            key={t.id}
            className={`auto-tab-btn ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── TAB 0: EXECUTIVE POSTURE & OVERVIEW ── */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="auto-kpi-grid">
            <div className="auto-kpi-card">
              <div className="auto-kpi-icon-wrap" style={{ background: "#eff6ff", color: "#2563eb" }}>
                📋
              </div>
              <div className="auto-kpi-info">
                <h4>Onboarding Checklists</h4>
                <div className="auto-kpi-val">
                  {overview?.onboarding?.completed_tasks || 0} / {overview?.onboarding?.total_instances || 0}
                </div>
                <div className="auto-kpi-sub">Role & Client Induction Tasks</div>
              </div>
            </div>

            <div className="auto-kpi-card">
              <div className="auto-kpi-icon-wrap" style={{ background: "#fef2f2", color: "#dc2626" }}>
                📑
              </div>
              <div className="auto-kpi-info">
                <h4>Missing-Doc Reminders</h4>
                <div className="auto-kpi-val">{overview?.missingDocuments?.total_reminders || 0}</div>
                <div className="auto-kpi-sub">Aadhaar, PAN, Degree & Form 16</div>
              </div>
            </div>

            <div className="auto-kpi-card">
              <div className="auto-kpi-icon-wrap" style={{ background: "#fffbeb", color: "#d97706" }}>
                🔍
              </div>
              <div className="auto-kpi-info">
                <h4>BGV SLA Escalations</h4>
                <div className="auto-kpi-val">
                  {overview?.bgvSla?.breached_bgv || 0} Breached
                </div>
                <div className="auto-kpi-sub">
                  {overview?.bgvSla?.at_risk_bgv || 0} At Risk • {overview?.bgvSla?.on_track_bgv || 0} On Track
                </div>
              </div>
            </div>

            <div className="auto-kpi-card">
              <div className="auto-kpi-icon-wrap" style={{ background: "#ecfdf5", color: "#059669" }}>
                💳
              </div>
              <div className="auto-kpi-info">
                <h4>Payroll Cut-off Engine</h4>
                <div className="auto-kpi-val">25th Monthly Cut-Off</div>
                <div className="auto-kpi-sub">
                  {overview?.payrollCutoff?.latest_status || "CUTOFF_REACHED_GENERATED"}
                </div>
              </div>
            </div>

            <div className="auto-kpi-card">
              <div className="auto-kpi-icon-wrap" style={{ background: "#faf5ff", color: "#7c3aed" }}>
                ⏳
              </div>
              <div className="auto-kpi-info">
                <h4>Probation Confirmations</h4>
                <div className="auto-kpi-val">{overview?.probation?.total_probation_alerts || 0} Alerts</div>
                <div className="auto-kpi-sub">{overview?.probation?.urgent_probation || 0} Urgent (&lt; 7 Days)</div>
              </div>
            </div>

            <div className="auto-kpi-card">
              <div className="auto-kpi-icon-wrap" style={{ background: "#f0fdf4", color: "#16a34a" }}>
                🎯
              </div>
              <div className="auto-kpi-info">
                <h4>Performance Cycles</h4>
                <div className="auto-kpi-val">Q4 2026 Active</div>
                <div className="auto-kpi-sub">Self-Appraisal Stage Broadcast</div>
              </div>
            </div>

            <div className="auto-kpi-card">
              <div className="auto-kpi-icon-wrap" style={{ background: "#fef3c7", color: "#b45309" }}>
                🚪
              </div>
              <div className="auto-kpi-info">
                <h4>Exit Clearance Matrix</h4>
                <div className="auto-kpi-val">5 Departments</div>
                <div className="auto-kpi-sub">IT, Finance, Admin, Manager, HR</div>
              </div>
            </div>

            <div className="auto-kpi-card">
              <div className="auto-kpi-icon-wrap" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                🎟️
              </div>
              <div className="auto-kpi-info">
                <h4>Helpdesk SLA Escalations</h4>
                <div className="auto-kpi-val">{overview?.ticketSla?.breached_tickets || 0} Breached</div>
                <div className="auto-kpi-sub">{overview?.ticketSla?.approaching_tickets || 0} Approaching SLA</div>
              </div>
            </div>

            <div className="auto-kpi-card">
              <div className="auto-kpi-icon-wrap" style={{ background: "#f1f5f9", color: "#334155" }}>
                📊
              </div>
              <div className="auto-kpi-info">
                <h4>Scheduled Reports</h4>
                <div className="auto-kpi-val">{overview?.scheduledReports?.active_reports || 5} Reports</div>
                <div className="auto-kpi-sub">Daily, Weekly, Monthly & Quarterly</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 1: ROLE & CLIENT ONBOARDING CHECKLISTS ── */}
      {activeTab === "onboarding" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>📋 Role & Client-Based Onboarding Checklists</h3>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "#64748b" }}>
                Instantiates customized induction task dockets based on role (Engineering, Sales, HR, Finance) and client deployments.
              </p>
            </div>

            <button className="btn-auto-action" onClick={() => setActiveOnboardingModal(true)}>
              + Generate Role/Client Checklist
            </button>
          </div>

          <div className="auto-table-wrap">
            <div className="auto-table-header">
              <h3>Active Onboarding Checklist Tasks</h3>
              <span className="status-pill status-pill-blue">Role-Specific Workflows</span>
            </div>

            <table className="auto-data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Client Context</th>
                  <th>Task Name</th>
                  <th>Category</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {onboardingInstances.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.employee_name}</strong> ({t.employee_code || "EMP"})</td>
                    <td><span className="sec-spec-pill">{t.role}</span></td>
                    <td>{t.client_name ? <span className="status-pill status-pill-purple">{t.client_name}</span> : "Internal Core"}</td>
                    <td>{t.task_title}</td>
                    <td>{t.category}</td>
                    <td>{new Date(t.due_date).toLocaleDateString()}</td>
                    <td>
                      <span className={`status-pill ${t.status === "Completed" ? "status-pill-green" : t.status === "In Progress" ? "status-pill-blue" : "status-pill-amber"}`}>
                        {t.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-auto-action"
                        style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem", background: t.status === "Completed" ? "#64748b" : "#10b981" }}
                        onClick={() => handleToggleOnboardTask(t.id, t.status)}
                      >
                        {t.status === "Completed" ? "Mark Pending" : "✓ Mark Completed"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: MISSING-DOCUMENT REMINDERS ── */}
      {activeTab === "missing_docs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>📑 Missing-Document Auto-Detection & Reminders</h3>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "#64748b" }}>
                Scans employee dockets for missing statutory files (Aadhaar, PAN, Degree, Relieving Letter, Form 16) and sends reminders.
              </p>
            </div>

            <button className="btn-auto-action" onClick={handleScanMissingDocs}>
              🔍 Scan All Employee Dockets
            </button>
          </div>

          <div className="auto-table-wrap">
            <div className="auto-table-header">
              <h3>Pending Document Reminders</h3>
              <span className="status-pill status-pill-amber">Statutory Compliance</span>
            </div>

            <table className="auto-data-table">
              <thead>
                <tr>
                  <th>Employee Code</th>
                  <th>Employee Name</th>
                  <th>Department</th>
                  <th>Missing Required Documents</th>
                  <th>Reminder Count</th>
                  <th>Due Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {missingDocs.map((m) => {
                  const docs = Array.isArray(m.missing_documents)
                    ? m.missing_documents
                    : typeof m.missing_documents === "string"
                    ? JSON.parse(m.missing_documents)
                    : [];
                  return (
                    <tr key={m.id}>
                      <td><code>{m.employee_code}</code></td>
                      <td><strong>{m.employee_name}</strong></td>
                      <td>{m.department || "General"}</td>
                      <td>
                        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                          {docs.map((d) => (
                            <span key={d} className="status-pill status-pill-red" style={{ fontSize: "0.7rem" }}>
                              {d}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td><span className="sec-spec-pill">Reminder #{m.reminder_count}</span></td>
                      <td>{new Date(m.due_date).toLocaleDateString()}</td>
                      <td>
                        <button
                          className="btn-auto-action"
                          style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem" }}
                          onClick={() => handleRemindDoc(m.id)}
                        >
                          ✉️ Send Reminder
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: BGV SLA ESCALATIONS ── */}
      {activeTab === "bgv_slas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>🔍 Background Verification (BGV) SLA Escalation Engine</h3>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "#64748b" }}>
                Enforces 7-day screening SLAs. Automatically flags and escalates delayed dockets to Talent Acquisition Leads.
              </p>
            </div>
          </div>

          <div className="auto-table-wrap">
            <div className="auto-table-header">
              <h3>BGV Verification Dockets & Escalation Matrix</h3>
              <span className="status-pill status-pill-blue">Vendor SLA Monitoring</span>
            </div>

            <table className="auto-data-table">
              <thead>
                <tr>
                  <th>BGV Code</th>
                  <th>Candidate Name</th>
                  <th>Verification Scope</th>
                  <th>Screening Agency</th>
                  <th>SLA / Elapsed</th>
                  <th>SLA Status</th>
                  <th>Escalation Level</th>
                  <th>Escalated To</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {bgvEscalations.map((b) => (
                  <tr key={b.id}>
                    <td><code>{b.bgv_code}</code></td>
                    <td><strong>{b.candidate_name}</strong></td>
                    <td>{b.verification_type}</td>
                    <td>{b.agency}</td>
                    <td>{b.sla_days} Days / <strong>{b.days_elapsed} Days</strong></td>
                    <td>
                      <span className={`status-pill ${b.sla_status === "BREACHED" ? "status-pill-red" : b.sla_status === "AT_RISK" ? "status-pill-amber" : "status-pill-green"}`}>
                        {b.sla_status}
                      </span>
                    </td>
                    <td><span className="sec-spec-pill">{b.escalation_level}</span></td>
                    <td>{b.escalated_to || "Standard Monitoring"}</td>
                    <td>
                      {b.sla_status !== "ON_TRACK" && (
                        <button
                          className="btn-auto-action"
                          style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem", background: "#dc2626" }}
                          onClick={() => handleEscalateBgv(b.id)}
                        >
                          ⚡ Escalate L2
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: MONTHLY PAYROLL CUT-OFF INPUT GENERATION ── */}
      {activeTab === "payroll_cutoff" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>💳 Monthly Payroll-Input Generation After Cut-Off</h3>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "#64748b" }}>
                Automates 25th-of-month cut-off processing: Aggregates attendance loss-of-pay (LOP), overtime, salary revisions, and generates payroll inputs.
              </p>
            </div>

            <button className="btn-auto-action" onClick={handleRunCutoff}>
              ⚡ Run Monthly Cut-off (25th)
            </button>
          </div>

          <div className="auto-table-wrap">
            <div className="auto-table-header">
              <h3>Monthly Payroll Cut-Off Batches</h3>
              <span className="status-pill status-pill-green">Automated Cut-Off</span>
            </div>

            <table className="auto-data-table">
              <thead>
                <tr>
                  <th>Batch Code</th>
                  <th>Payroll Cycle</th>
                  <th>Cut-Off Day</th>
                  <th>Employees Processed</th>
                  <th>Total LOP Days</th>
                  <th>Overtime Hours</th>
                  <th>Gross Payable</th>
                  <th>Status</th>
                  <th>Executed At</th>
                </tr>
              </thead>
              <tbody>
                {cutoffBatches.map((c) => (
                  <tr key={c.id}>
                    <td><code>{c.batch_code}</code></td>
                    <td><strong>{c.month} {c.year}</strong></td>
                    <td>Day {c.cutoff_day}</td>
                    <td>{c.total_employees_processed} employees</td>
                    <td>{c.total_lop_days} days</td>
                    <td>{c.total_overtime_hours} hrs</td>
                    <td><strong>₹ {Number(c.total_gross_payable).toLocaleString()}</strong></td>
                    <td><span className="status-pill status-pill-green">✓ {c.status}</span></td>
                    <td>{new Date(c.executed_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 5: PROBATION & CONFIRMATION REMINDERS ── */}
      {activeTab === "probation" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>⏳ Probation Tracking & Confirmation Reminders</h3>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "#64748b" }}>
                Tracks 90/180-day probation periods. Triggers 30-day, 15-day, and 7-day prior alerts to managers to submit confirmation recommendations.
              </p>
            </div>
          </div>

          <div className="auto-table-wrap">
            <div className="auto-table-header">
              <h3>Probation Confirmation Alerts</h3>
              <span className="status-pill status-pill-amber">Manager Action Required</span>
            </div>

            <table className="auto-data-table">
              <thead>
                <tr>
                  <th>Emp Code</th>
                  <th>Employee Name</th>
                  <th>Department</th>
                  <th>Reporting Manager</th>
                  <th>Probation End Date</th>
                  <th>Days Remaining</th>
                  <th>Alert Stage</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {probationAlerts.map((p) => (
                  <tr key={p.id}>
                    <td><code>{p.employee_code}</code></td>
                    <td><strong>{p.employee_name}</strong></td>
                    <td>{p.department}</td>
                    <td>{p.manager_name}</td>
                    <td>{new Date(p.probation_end_date).toLocaleDateString()}</td>
                    <td><strong>{p.days_remaining} Days</strong></td>
                    <td>
                      <span className={`status-pill ${p.alert_stage === "7_DAYS_PRIOR" || p.alert_stage === "OVERDUE" ? "status-pill-red" : "status-pill-amber"}`}>
                        {p.alert_stage}
                      </span>
                    </td>
                    <td><span className="sec-spec-pill">{p.recommendation_status}</span></td>
                    <td>
                      <button
                        className="btn-auto-action"
                        style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem" }}
                        onClick={() => {
                          setActiveProbationModal(p);
                          setProbationDecisionForm({ recommendationStatus: "CONFIRMED", managerComments: "" });
                        }}
                      >
                        Submit Decision
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 6: PERFORMANCE CYCLE REMINDERS ── */}
      {activeTab === "performance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>🎯 Performance-Cycle Timeline Reminders</h3>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "#64748b" }}>
                Automates stage countdowns (Goal Setting, Self-Appraisal, Manager Review) and dispatches reminder broadcasts to participants.
              </p>
            </div>

            <button className="btn-auto-action" onClick={handleBroadcastPerfReminder}>
              📢 Broadcast Self-Appraisal Reminder
            </button>
          </div>

          <div className="auto-table-wrap">
            <div className="auto-table-header">
              <h3>Dispatched Performance Reminders</h3>
              <span className="status-pill status-pill-blue">Active Cycle Broadcasts</span>
            </div>

            <table className="auto-data-table">
              <thead>
                <tr>
                  <th>Cycle Code</th>
                  <th>Appraisal Cycle</th>
                  <th>Stage</th>
                  <th>Deadline Date</th>
                  <th>Days Remaining</th>
                  <th>Pending Count</th>
                  <th>Broadcast Message</th>
                  <th>Dispatched At</th>
                </tr>
              </thead>
              <tbody>
                {perfAlerts.map((a) => (
                  <tr key={a.id}>
                    <td><code>{a.cycle_code}</code></td>
                    <td><strong>{a.cycle_name}</strong></td>
                    <td><span className="status-pill status-pill-purple">{a.stage}</span></td>
                    <td>{new Date(a.deadline_date).toLocaleDateString()}</td>
                    <td><strong>{a.days_remaining} Days</strong></td>
                    <td>{a.total_pending_submissions} pending</td>
                    <td style={{ maxWidth: "320px" }}>{a.alert_message}</td>
                    <td>{new Date(a.sent_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 7: EXIT CLEARANCE TASKS (5 DEPARTMENTS) ── */}
      {activeTab === "exit_clearance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>🚪 Automated Exit Clearance Workflow (5 Functional Departments)</h3>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "#64748b" }}>
                Spawns department-wise clearance tasks across IT, Finance, Admin, Reporting Manager, and HR upon separation approval.
              </p>
            </div>
          </div>

          <div className="auto-table-wrap">
            <div className="auto-table-header">
              <h3>5-Department Exit Clearance Matrix</h3>
              <span className="status-pill status-pill-red">Offboarding Checklist</span>
            </div>

            <table className="auto-data-table">
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Department</th>
                  <th>Clearance Task</th>
                  <th>Required Directives</th>
                  <th>Status</th>
                  <th>Cleared By</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {exitTasks.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.employee_name}</strong></td>
                    <td><span className="sec-spec-pill">{t.department}</span></td>
                    <td><strong>{t.task_name}</strong></td>
                    <td style={{ maxWidth: "260px" }}>{t.required_action}</td>
                    <td>
                      <span className={`status-pill ${t.status === "Cleared" ? "status-pill-green" : "status-pill-amber"}`}>
                        {t.status}
                      </span>
                    </td>
                    <td>{t.cleared_by || "Pending Sign-off"}</td>
                    <td>
                      <button
                        className="btn-auto-action"
                        style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem", background: t.status === "Cleared" ? "#64748b" : "#10b981" }}
                        onClick={() => handleClearExitTask(t.id, t.status)}
                      >
                        {t.status === "Cleared" ? "Revoke Sign-off" : "✓ Sign-Off & Clear"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 8: HELPDESK SLA ESCALATION ENGINE ── */}
      {activeTab === "helpdesk_slas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>🎟️ Helpdesk SLA Auto-Escalation Engine</h3>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "#64748b" }}>
                Monitors support tickets against priority SLAs (Critical: 4h, High: 8h, Medium: 24h, Low: 48h). Flags breaches and triggers manager escalation.
              </p>
            </div>

            <button className="btn-auto-action" onClick={handleEvaluateTicketSlas}>
              ⚡ Scan & Evaluate Ticket SLAs
            </button>
          </div>

          <div className="auto-table-wrap">
            <div className="auto-table-header">
              <h3>Helpdesk Tickets & SLA Escalations</h3>
              <span className="status-pill status-pill-red">Live SLA Tracking</span>
            </div>

            <table className="auto-data-table">
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Requester</th>
                  <th>Priority</th>
                  <th>Target SLA</th>
                  <th>Hours Elapsed</th>
                  <th>SLA Status</th>
                  <th>Escalation Level</th>
                  <th>Escalated To</th>
                </tr>
              </thead>
              <tbody>
                {ticketEscalations.map((t) => (
                  <tr key={t.id}>
                    <td><code>{t.ticket_id}</code></td>
                    <td>{t.emp_id}</td>
                    <td>
                      <span className={`status-pill ${t.priority === "Critical" ? "status-pill-red" : t.priority === "High" ? "status-pill-amber" : "status-pill-blue"}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td>{t.sla_target_hours} Hours</td>
                    <td><strong>{t.hours_elapsed} Hours</strong></td>
                    <td>
                      <span className={`status-pill ${t.sla_status === "BREACHED" ? "status-pill-red" : t.sla_status === "APPROACHING_SLA" ? "status-pill-amber" : "status-pill-green"}`}>
                        {t.sla_status}
                      </span>
                    </td>
                    <td><span className="sec-spec-pill">{t.escalation_level}</span></td>
                    <td>{t.escalated_to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 9: SCHEDULED AUTHORIZED REPORTS ── */}
      {activeTab === "reports" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>📊 Scheduled Authorized Dashboards & Reports</h3>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "#64748b" }}>
                Automates recurring report compilation (Daily Attendance, Weekly Headcount, Monthly Payroll, Quarterly DPDP Compliance) with role authorization.
              </p>
            </div>
          </div>

          {/* Scheduled Report Definitions */}
          <div className="auto-table-wrap">
            <div className="auto-table-header">
              <h3>Scheduled Report Catalog</h3>
              <span className="status-pill status-pill-green">Authorized Distribution</span>
            </div>

            <table className="auto-data-table">
              <thead>
                <tr>
                  <th>Report Code</th>
                  <th>Title</th>
                  <th>Frequency</th>
                  <th>Category</th>
                  <th>Authorized Roles</th>
                  <th>Format</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {scheduledReports.map((r) => {
                  const roles = Array.isArray(r.authorized_roles)
                    ? r.authorized_roles
                    : typeof r.authorized_roles === "string"
                    ? JSON.parse(r.authorized_roles)
                    : [];
                  return (
                    <tr key={r.id}>
                      <td><code>{r.report_code}</code></td>
                      <td><strong>{r.title}</strong></td>
                      <td><span className="status-pill status-pill-blue">{r.frequency}</span></td>
                      <td>{r.category}</td>
                      <td>
                        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                          {roles.map((ro) => (
                            <span key={ro} className="sec-spec-pill" style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem" }}>
                              {ro}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>{r.format}</td>
                      <td>
                        <button
                          className="btn-auto-action"
                          style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem" }}
                          onClick={() => handleRunReport(r.report_code)}
                        >
                          ⚡ Generate Now
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Report Execution History */}
          <div className="auto-table-wrap">
            <div className="auto-table-header">
              <h3>Recent Report Execution History</h3>
              <span className="status-pill status-pill-blue">Audit Log</span>
            </div>

            <table className="auto-data-table">
              <thead>
                <tr>
                  <th>Report Code</th>
                  <th>Title</th>
                  <th>Generated By</th>
                  <th>Records Count</th>
                  <th>File Size</th>
                  <th>Status</th>
                  <th>Execution Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {reportExecutions.map((e) => (
                  <tr key={e.id}>
                    <td><code>{e.report_code}</code></td>
                    <td>{e.report_title}</td>
                    <td>{e.executed_by}</td>
                    <td>{e.records_count} records</td>
                    <td>{e.file_size_kb} KB</td>
                    <td><span className="status-pill status-pill-green">✓ {e.status}</span></td>
                    <td>{new Date(e.execution_timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ONBOARDING MODAL ── */}
      {activeOnboardingModal && (
        <div className="auto-modal-backdrop">
          <div className="auto-modal-content">
            <div className="auto-modal-header">
              <h3>📋 Generate Role/Client Onboarding Checklist</h3>
              <button className="auto-modal-close" onClick={() => setActiveOnboardingModal(false)}>×</button>
            </div>
            <form onSubmit={handleGenerateOnboarding}>
              <div className="auto-modal-body">
                <div className="auto-form-group">
                  <label>Employee Database ID</label>
                  <input
                    className="auto-input"
                    type="number"
                    required
                    value={onboardForm.employeeId}
                    onChange={(e) => setOnboardForm({ ...onboardForm, employeeId: e.target.value })}
                  />
                </div>

                <div className="auto-form-group">
                  <label>Target Role / Track</label>
                  <select
                    className="auto-select"
                    value={onboardForm.role}
                    onChange={(e) => setOnboardForm({ ...onboardForm, role: e.target.value })}
                  >
                    <option value="Engineering">Engineering (Git, Docker, OWASP, Architecture)</option>
                    <option value="Sales">Sales (CRM, Product Catalog, Territory)</option>
                    <option value="HR">HR Operations (Induction, Policy, Pipeline)</option>
                    <option value="Finance">Finance (ERP, Travel Policy, Statutory)</option>
                    <option value="Client Deployment">Client Deployment (Client NDA, VDI, VPN)</option>
                  </select>
                </div>

                <div className="auto-form-group">
                  <label>Client ID (Optional for Dedicated Deployments)</label>
                  <input
                    className="auto-input"
                    placeholder="e.g. 1"
                    value={onboardForm.clientId}
                    onChange={(e) => setOnboardForm({ ...onboardForm, clientId: e.target.value })}
                  />
                </div>
              </div>
              <div className="auto-modal-footer">
                <button type="button" className="btn-auto-secondary" onClick={() => setActiveOnboardingModal(false)}>Cancel</button>
                <button type="submit" className="btn-auto-action">Generate Checklist Dockets</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── PROBATION DECISION MODAL ── */}
      {activeProbationModal && (
        <div className="auto-modal-backdrop">
          <div className="auto-modal-content">
            <div className="auto-modal-header">
              <h3>⏳ Submit Probation Confirmation Decision</h3>
              <button className="auto-modal-close" onClick={() => setActiveProbationModal(null)}>×</button>
            </div>
            <form onSubmit={handleSubmitProbationDecision}>
              <div className="auto-modal-body">
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
                  Recording manager evaluation for: <strong>{activeProbationModal.employee_name}</strong> ({activeProbationModal.department}).
                </p>

                <div className="auto-form-group">
                  <label>Recommendation Decision</label>
                  <select
                    className="auto-select"
                    value={probationDecisionForm.recommendationStatus}
                    onChange={(e) => setProbationDecisionForm({ ...probationDecisionForm, recommendationStatus: e.target.value })}
                  >
                    <option value="CONFIRMED">CONFIRMED (Successful Confirmation as Regular Employee)</option>
                    <option value="EXTENDED">EXTENDED (Extend Probation by 30-60 Days)</option>
                    <option value="PIP">PIP (Enroll in Performance Improvement Plan)</option>
                  </select>
                </div>

                <div className="auto-form-group">
                  <label>Manager Evaluation Notes</label>
                  <textarea
                    className="auto-input"
                    rows={3}
                    placeholder="Provide performance justification and evaluation remarks."
                    value={probationDecisionForm.managerComments}
                    onChange={(e) => setProbationDecisionForm({ ...probationDecisionForm, managerComments: e.target.value })}
                  />
                </div>
              </div>
              <div className="auto-modal-footer">
                <button type="button" className="btn-auto-secondary" onClick={() => setActiveProbationModal(null)}>Cancel</button>
                <button type="submit" className="btn-auto-action">Submit Recommendation</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
