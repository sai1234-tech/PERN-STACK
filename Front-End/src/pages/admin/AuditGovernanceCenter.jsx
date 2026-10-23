import React, { useState, useEffect, useMemo } from "react";
import { auditEffectiveDatingService } from "../../services/auditEffectiveDatingService";
import "./AuditGovernanceCenter.css";

const AuditGovernanceCenter = () => {
  const [activeTab, setActiveTab] = useState("critical_changes");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Data states across all 5 pillars
  const [overview, setOverview] = useState(null);
  const [criticalChanges, setCriticalChanges] = useState([]);
  const [approvalDecisions, setApprovalDecisions] = useState([]);
  const [effectiveHistory, setEffectiveHistory] = useState([]);
  const [sensitiveExports, setSensitiveExports] = useState([]);
  const [adminActions, setAdminActions] = useState([]);
  const [documentPolicies, setDocumentPolicies] = useState([]);
  const [documentAudits, setDocumentAudits] = useState([]);

  // Time-travel As-Of-Date state
  const [asOfDate, setAsOfDate] = useState("2024-06-15");
  const [asOfEntityId, setAsOfEntityId] = useState("201");
  const [asOfResult, setAsOfResult] = useState(null);
  const [asOfLoading, setAsOfLoading] = useState(false);

  // Modals
  const [modalType, setModalType] = useState(null); // 'change', 'approval', 'revision', 'export', 'perm_test'
  const [actionSuccess, setActionSuccess] = useState(null);

  // Form states for modals
  const [changeForm, setChangeForm] = useState({
    entity_type: "EMPLOYEE_COMPENSATION",
    entity_id: "201",
    entity_name: "Integration Test Candidate",
    action_type: "UPDATE",
    old_basic: 105000,
    new_basic: 125000,
    changed_fields: "basic_salary, ctc_annual",
    business_justification: "Annual Executive Performance Appraisal Merit Increment",
    criticality: "CRITICAL"
  });

  const [approvalForm, setApprovalForm] = useState({
    workflow_type: "LEAVE_REQUEST",
    entity_id: "LV-2026-901",
    entity_title: "Privilege Leave Request (3 Days)",
    step_number: 1,
    step_name: "Level 1 - Line Manager Approval",
    decision: "APPROVED",
    comments: "All critical deliverables covered by peer backup. Approved.",
    previous_status: "PENDING",
    resulting_status: "APPROVED_FINAL"
  });

  const [revisionForm, setRevisionForm] = useState({
    entity_type: "EMPLOYEE_COMPENSATION",
    entity_id: "201",
    entity_name: "Integration Test Candidate",
    effective_from: "2026-12-01",
    change_reason: "MERIT_INCREASE_Q4",
    designation: "Principal Engineering Specialist",
    department: "Cloud Architecture",
    basic: 135000,
    hra: 54000,
    ctc_annual: 2700000
  });

  const [exportForm, setExportForm] = useState({
    export_type: "SALARY_REGISTER_EXCEL",
    export_format: "XLSX",
    record_count: 142,
    sensitivity_level: "FINANCIAL_CONFIDENTIAL",
    export_purpose: "Monthly Corporate Bank Net Disbursal Upload to ICICI Corporate Net Banking"
  });

  const [permTestForm, setPermTestForm] = useState({
    category_code: "COMPENSATION_LETTERS",
    action_type: "PREVIEW",
    target_role: "manager",
    target_user_email: "vikas.manager@company.com"
  });
  const [permTestResult, setPermTestResult] = useState(null);

  // Fetch all initial data
  const loadDashboardData = async () => {
    try {
      setRefreshing(true);
      setError(null);

      const [
        overviewRes,
        changesRes,
        approvalsRes,
        effRes,
        exportsRes,
        adminRes,
        policiesRes,
        docAuditRes
      ] = await Promise.all([
        auditEffectiveDatingService.getOverview().catch(() => null),
        auditEffectiveDatingService.getCriticalChanges({ limit: 50 }).catch(() => ({ data: [] })),
        auditEffectiveDatingService.getApprovalDecisions({ limit: 50 }).catch(() => ({ data: [] })),
        auditEffectiveDatingService.getEffectiveDatedHistory().catch(() => ({ data: [] })),
        auditEffectiveDatingService.getSensitiveExports({ limit: 50 }).catch(() => ({ data: [] })),
        auditEffectiveDatingService.getAdminActions({ limit: 50 }).catch(() => ({ data: [] })),
        auditEffectiveDatingService.getDocumentPolicies().catch(() => ({ data: [] })),
        auditEffectiveDatingService.getDocumentAudit({ limit: 50 }).catch(() => ({ data: [] }))
      ]);

      if (overviewRes?.kpis) setOverview(overviewRes.kpis);
      if (changesRes?.data) setCriticalChanges(changesRes.data);
      if (approvalsRes?.data) setApprovalDecisions(approvalsRes.data);
      if (effRes?.data) setEffectiveHistory(effRes.data);
      if (exportsRes?.data) setSensitiveExports(exportsRes.data);
      if (adminRes?.data) setAdminActions(adminRes.data);
      if (policiesRes?.data) setDocumentPolicies(policiesRes.data);
      if (docAuditRes?.data) setDocumentAudits(docAuditRes.data);

    } catch (err) {
      console.error("Failed to load audit governance center data:", err);
      setError(err.message || "Failed to load audit governance ledger.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Time-travel As-Of-Date query handler
  const handleAsOfQuery = async () => {
    try {
      setAsOfLoading(true);
      setAsOfResult(null);
      const res = await auditEffectiveDatingService.getAsOfDateRecord({
        entity_type: "EMPLOYEE_COMPENSATION",
        entity_id: asOfEntityId,
        as_of_date: asOfDate
      });
      if (res?.data) {
        setAsOfResult(res.data);
      }
    } catch (err) {
      setAsOfResult({ error: err.message || "No record found for this point in time" });
    } finally {
      setAsOfLoading(false);
    }
  };

  // Submit Critical Change
  const handleSubmitChange = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        entity_type: changeForm.entity_type,
        entity_id: changeForm.entity_id,
        entity_name: changeForm.entity_name,
        action_type: changeForm.action_type,
        old_values: { basic_salary: Number(changeForm.old_basic) },
        new_values: { basic_salary: Number(changeForm.new_basic) },
        changed_fields: changeForm.changed_fields.split(",").map(f => f.trim()),
        business_justification: changeForm.business_justification,
        criticality: changeForm.criticality
      };
      const res = await auditEffectiveDatingService.logCriticalChange(payload);
      setActionSuccess(`Critical change recorded and cryptographically anchored! Code: ${res.data.change_code}`);
      setModalType(null);
      loadDashboardData();
    } catch (err) {
      alert(`Error logging change: ${err.message}`);
    }
  };

  // Submit Approval Decision
  const handleSubmitApproval = async (e) => {
    e.preventDefault();
    try {
      const res = await auditEffectiveDatingService.recordApprovalDecision(approvalForm);
      setActionSuccess(`Approval decision recorded permanently! Ref: ${res.data.decision_code}`);
      setModalType(null);
      loadDashboardData();
    } catch (err) {
      alert(`Error recording decision: ${err.message}`);
    }
  };

  // Submit Effective-Dated Revision (Non-Overwriting)
  const handleSubmitRevision = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        entity_type: revisionForm.entity_type,
        entity_id: revisionForm.entity_id,
        entity_name: revisionForm.entity_name,
        effective_from: revisionForm.effective_from,
        change_reason: revisionForm.change_reason,
        record_payload: {
          designation: revisionForm.designation,
          department: revisionForm.department,
          basic: Number(revisionForm.basic),
          hra: Number(revisionForm.hra),
          ctc_annual: Number(revisionForm.ctc_annual)
        },
        diff_summary: {
          note: `New version created effective ${revisionForm.effective_from}. Prior version automatically closed.`
        }
      };
      const res = await auditEffectiveDatingService.createEffectiveDatedRevision(payload);
      setActionSuccess(res.message || "Effective-dated version advanced successfully without overwriting history!");
      setModalType(null);
      loadDashboardData();
    } catch (err) {
      alert(`Error advancing version: ${err.message}`);
    }
  };

  // Submit Sensitive Export
  const handleSubmitExport = async (e) => {
    e.preventDefault();
    try {
      const res = await auditEffectiveDatingService.logSensitiveExport(exportForm);
      setActionSuccess(`Sensitive export event logged with SHA-256 checksum! Ref: ${res.data.export_code}`);
      setModalType(null);
      loadDashboardData();
    } catch (err) {
      alert(`Error logging export: ${err.message}`);
    }
  };

  // Evaluate Document Permission & Watermark
  const handleEvaluatePermission = async (e) => {
    e.preventDefault();
    try {
      const res = await auditEffectiveDatingService.evaluateDocumentAccess(permTestForm);
      if (res?.data) {
        setPermTestResult(res.data);
      }
    } catch (err) {
      alert(`Permission evaluation error: ${err.message}`);
    }
  };

  // Filtered lists
  const filteredChanges = useMemo(() => {
    if (!searchTerm) return criticalChanges;
    const term = searchTerm.toLowerCase();
    return criticalChanges.filter(c =>
      (c.change_code || "").toLowerCase().includes(term) ||
      (c.entity_name || "").toLowerCase().includes(term) ||
      (c.user_name || "").toLowerCase().includes(term) ||
      (c.business_justification || "").toLowerCase().includes(term)
    );
  }, [criticalChanges, searchTerm]);

  const filteredApprovals = useMemo(() => {
    if (!searchTerm) return approvalDecisions;
    const term = searchTerm.toLowerCase();
    return approvalDecisions.filter(a =>
      (a.decision_code || "").toLowerCase().includes(term) ||
      (a.entity_title || "").toLowerCase().includes(term) ||
      (a.approver_name || "").toLowerCase().includes(term) ||
      (a.comments || "").toLowerCase().includes(term)
    );
  }, [approvalDecisions, searchTerm]);

  return (
    <div className="audit-gov-container">
      {/* 1. Header Banner */}
      <header className="audit-gov-header">
        <div className="header-title-block">
          <div className="header-badge-row">
            <span className="live-dot-pulse"></span>
            <span className="security-tag">ENTERPRISE AUDIT & COMPLIANCE</span>
            <span className="sha-tag">SHA-256 IMMUTABLE LEDGER</span>
          </div>
          <h1>Audit, Temporal History & Document Governance</h1>
          <p className="header-subtitle">
            Capture critical changes with source IP/channel, retain approval decisions and mandatory comments, maintain non-overwriting effective-dated revisions, monitor sensitive exports, and enforce fine-grained document preview vs download authorization.
          </p>
        </div>

        <div className="header-actions">
          <button
            className="btn-refresh"
            onClick={loadDashboardData}
            disabled={refreshing}
            title="Refresh All 5 Pillars"
          >
            {refreshing ? "↻ Refreshing..." : "↻ Refresh Live Ledger"}
          </button>
        </div>
      </header>

      {/* Global alert / success banner */}
      {actionSuccess && (
        <div className="action-success-banner">
          <span>✅ {actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="btn-close-banner">✕</button>
        </div>
      )}

      {error && (
        <div className="action-error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="btn-close-banner">✕</button>
        </div>
      )}

      {/* 2. Top Stats Cards Deck */}
      <section className="stats-deck">
        <div className="stat-card stat-critical">
          <div className="stat-icon">🔍</div>
          <div className="stat-details">
            <span className="stat-label">Critical Data Changes</span>
            <span className="stat-value">{overview?.critical_changes?.total ?? criticalChanges.length}</span>
            <span className="stat-meta">
              {overview?.critical_changes?.critical ?? 0} Critical • {overview?.critical_changes?.updates ?? 0} Updates
            </span>
          </div>
        </div>

        <div className="stat-card stat-approval">
          <div className="stat-icon">⚖️</div>
          <div className="stat-details">
            <span className="stat-label">Retained Decisions</span>
            <span className="stat-value">{overview?.approvals?.total ?? approvalDecisions.length}</span>
            <span className="stat-meta">
              {overview?.approvals?.approved ?? 0} Approved • {overview?.approvals?.rejected ?? 0} Rejected
            </span>
          </div>
        </div>

        <div className="stat-card stat-temporal">
          <div className="stat-icon">⏳</div>
          <div className="stat-details">
            <span className="stat-label">Effective-Dated Versions</span>
            <span className="stat-value">{overview?.effective_dating?.total_revisions ?? effectiveHistory.length}</span>
            <span className="stat-meta">
              {overview?.effective_dating?.current_versions ?? 0} Active • {overview?.effective_dating?.historical_versions ?? 0} Historical Preserved
            </span>
          </div>
        </div>

        <div className="stat-card stat-exports">
          <div className="stat-icon">📤</div>
          <div className="stat-details">
            <span className="stat-label">Sensitive Exports Logged</span>
            <span className="stat-value">{overview?.sensitive_exports?.total_exports ?? sensitiveExports.length}</span>
            <span className="stat-meta">
              {overview?.sensitive_exports?.records_extracted ?? 0} Records • {overview?.sensitive_exports?.financial_exports ?? 0} Financial
            </span>
          </div>
        </div>

        <div className="stat-card stat-document">
          <div className="stat-icon">🛡️</div>
          <div className="stat-details">
            <span className="stat-label">Document Policies Active</span>
            <span className="stat-value">{overview?.document_governance?.total_policies ?? documentPolicies.length}</span>
            <span className="stat-meta">
              {overview?.document_governance?.granted ?? 0} Granted • {overview?.document_governance?.denied ?? 0} Denied
            </span>
          </div>
        </div>
      </section>

      {/* 3. Navigation Tabs */}
      <nav className="audit-nav-tabs">
        <button
          className={`nav-tab ${activeTab === "critical_changes" ? "active" : ""}`}
          onClick={() => setActiveTab("critical_changes")}
        >
          🔍 1. Critical Change Tracker
          <span className="tab-badge">{criticalChanges.length}</span>
        </button>

        <button
          className={`nav-tab ${activeTab === "approval_history" ? "active" : ""}`}
          onClick={() => setActiveTab("approval_history")}
        >
          ⚖️ 2. Immutable Approval Ledger
          <span className="tab-badge">{approvalDecisions.length}</span>
        </button>

        <button
          className={`nav-tab ${activeTab === "effective_history" ? "active" : ""}`}
          onClick={() => setActiveTab("effective_history")}
        >
          ⏳ 3. Effective-Dated History
          <span className="tab-badge">{effectiveHistory.length}</span>
        </button>

        <button
          className={`nav-tab ${activeTab === "sensitive_exports" ? "active" : ""}`}
          onClick={() => setActiveTab("sensitive_exports")}
        >
          📤 4. Sensitive Exports & Admin Action Audit
          <span className="tab-badge">{sensitiveExports.length + adminActions.length}</span>
        </button>

        <button
          className={`nav-tab ${activeTab === "document_governance" ? "active" : ""}`}
          onClick={() => setActiveTab("document_governance")}
        >
          🛡️ 5. Document Preview & Download Governance
          <span className="tab-badge">{documentPolicies.length}</span>
        </button>
      </nav>

      {/* Search Bar & Quick Action */}
      <div className="tab-toolbar">
        <div className="search-box">
          <span className="search-icon">🔎</span>
          <input
            type="text"
            placeholder="Search change code, approver, justification, entity, or keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="btn-clear-search" onClick={() => setSearchTerm("")}>✕</button>
          )}
        </div>

        <div className="tab-action-buttons">
          {activeTab === "critical_changes" && (
            <button className="btn-primary" onClick={() => setModalType("change")}>
              + Record Critical Change
            </button>
          )}
          {activeTab === "approval_history" && (
            <button className="btn-primary" onClick={() => setModalType("approval")}>
              + Record Approval Decision
            </button>
          )}
          {activeTab === "effective_history" && (
            <button className="btn-primary" onClick={() => setModalType("revision")}>
              + Create New Revision (Non-Overwriting)
            </button>
          )}
          {activeTab === "sensitive_exports" && (
            <button className="btn-primary" onClick={() => setModalType("export")}>
              + Log Sensitive Export Event
            </button>
          )}
          {activeTab === "document_governance" && (
            <button className="btn-primary" onClick={() => { setModalType("perm_test"); setPermTestResult(null); }}>
              🧪 Test Permission & Dynamic Watermark
            </button>
          )}
        </div>
      </div>

      {/* 4. Tab Contents */}

      {/* TAB 1: Critical Change Tracker */}
      {activeTab === "critical_changes" && (
        <div className="tab-panel">
          <div className="panel-summary-card">
            <h3>Pillar 1: Critical Data Change Tracking (User, Timestamp, Source & Diff)</h3>
            <p>
              Records the exact user, timestamp, source IP, channel, and visual old-vs-new value diff for any modification to critical entities like salaries, bank details, statutory IDs, SOW billing rates, and role permissions.
            </p>
          </div>

          <div className="table-responsive">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Change Code</th>
                  <th>Entity & Action</th>
                  <th>User & Role</th>
                  <th>Source & Timestamp</th>
                  <th>Old Values vs New Values</th>
                  <th>Business Justification</th>
                  <th>Criticality</th>
                </tr>
              </thead>
              <tbody>
                {filteredChanges.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-cell">No critical changes found matching query.</td>
                  </tr>
                ) : (
                  filteredChanges.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="code-pill">{c.change_code}</span>
                      </td>
                      <td>
                        <strong>{c.entity_name || c.entity_id}</strong>
                        <div className="meta-subtext">Type: {c.entity_type} • Action: <span className="action-pill">{c.action_type}</span></div>
                      </td>
                      <td>
                        <div className="user-line"><strong>{c.user_name}</strong></div>
                        <div className="meta-subtext">{c.user_email} • <span className="role-tag">{c.user_role}</span></div>
                      </td>
                      <td>
                        <div>IP: <code>{c.source_ip}</code></div>
                        <div className="meta-subtext">Channel: {c.source_channel}</div>
                        <div className="time-subtext">{new Date(c.created_at).toLocaleString()}</div>
                      </td>
                      <td>
                        <div className="diff-box">
                          <div className="diff-old">
                            <span className="diff-label">Old:</span>
                            <code>{typeof c.old_values === 'string' ? c.old_values : JSON.stringify(c.old_values)}</code>
                          </div>
                          <div className="diff-new">
                            <span className="diff-label">New:</span>
                            <code>{typeof c.new_values === 'string' ? c.new_values : JSON.stringify(c.new_values)}</code>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="justification-text">{c.business_justification}</div>
                      </td>
                      <td>
                        <span className={`badge-criticality ${c.criticality.toLowerCase()}`}>
                          {c.criticality}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Immutable Approval Ledger */}
      {activeTab === "approval_history" && (
        <div className="tab-panel">
          <div className="panel-summary-card">
            <h3>Pillar 2: Immutable Approval Decision History & Comments Retention</h3>
            <p>
              Every stage of an approval workflow (Leave, Payroll Cutoff, Salary Revision, Exit Clearance, Reimbursements) retains the approver, decision timestamp, previous and resulting status, and mandatory comments permanently for statutory audit inspection.
            </p>
          </div>

          <div className="table-responsive">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Decision Code</th>
                  <th>Workflow & Entity</th>
                  <th>Step & Decision</th>
                  <th>Approver Details</th>
                  <th>Retained Comments & Justification</th>
                  <th>Status Transition</th>
                  <th>Timestamp & Source</th>
                </tr>
              </thead>
              <tbody>
                {filteredApprovals.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-cell">No approval decision records found.</td>
                  </tr>
                ) : (
                  filteredApprovals.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <span className="code-pill">{a.decision_code}</span>
                      </td>
                      <td>
                        <strong>{a.entity_title || a.entity_id}</strong>
                        <div className="meta-subtext">Workflow: {a.workflow_type}</div>
                        {a.requester_name && <div className="meta-subtext">Requester: {a.requester_name}</div>}
                      </td>
                      <td>
                        <div className="step-name">{a.step_name} (Step #{a.step_number})</div>
                        <span className={`decision-badge ${a.decision.toLowerCase()}`}>
                          {a.decision === "APPROVED" ? "✔ APPROVED" : a.decision === "REJECTED" ? "✖ REJECTED" : a.decision}
                        </span>
                      </td>
                      <td>
                        <strong>{a.approver_name}</strong>
                        <div className="meta-subtext">{a.approver_email}</div>
                        <span className="role-tag">{a.approver_role}</span>
                      </td>
                      <td>
                        <blockquote className="retained-comments">
                          "{a.comments}"
                        </blockquote>
                      </td>
                      <td>
                        <div className="transition-flow">
                          <span className="status-badge prev">{a.previous_status}</span>
                          <span className="arrow-sep">➔</span>
                          <span className="status-badge result">{a.resulting_status}</span>
                        </div>
                      </td>
                      <td>
                        <div>{new Date(a.decided_at || a.created_at).toLocaleString()}</div>
                        <div className="meta-subtext">Channel: {a.source_channel} • IP: {a.ip_address}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Effective-Dated History Ledger */}
      {activeTab === "effective_history" && (
        <div className="tab-panel">
          <div className="panel-summary-card">
            <h3>Pillar 3: Effective-Dated History Ledger (Temporal Non-Overwriting)</h3>
            <p>
              Transactions never overwrite historical rows. When an employee's salary, designation, or department changes, a new version is inserted with a start date (<code>effective_from</code>) while the prior record's interval is closed. Point-in-time "As-Of Date" time-travel queries allow auditors to view exact past snapshots.
            </p>
          </div>

          {/* Time-Travel Simulator Box */}
          <div className="time-travel-card">
            <div className="time-travel-header">
              <span className="clock-icon">🕰️</span>
              <h4>Temporal "As-Of Date" Time-Travel Query Engine</h4>
            </div>
            <div className="time-travel-form">
              <div className="form-group-inline">
                <label>Entity ID (e.g. Employee ID):</label>
                <input
                  type="text"
                  value={asOfEntityId}
                  onChange={(e) => setAsOfEntityId(e.target.value)}
                  placeholder="201"
                />
              </div>
              <div className="form-group-inline">
                <label>Point-in-Time Date (YYYY-MM-DD):</label>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                />
              </div>
              <button
                className="btn-timetravel"
                onClick={handleAsOfQuery}
                disabled={asOfLoading}
              >
                {asOfLoading ? "Calculating..." : "🔍 Run Point-in-Time Query"}
              </button>
            </div>

            {asOfResult && (
              <div className="time-travel-result">
                {asOfResult.error ? (
                  <div className="result-error">⚠️ {asOfResult.error}</div>
                ) : (
                  <div className="result-success">
                    <div className="result-meta">
                      <strong>Point-in-Time Snapshot on {asOfDate}:</strong> Version #{asOfResult.version_number} (Effective: {asOfResult.effective_from} to {asOfResult.effective_to})
                    </div>
                    <pre className="json-snapshot">
                      {JSON.stringify(asOfResult.record_payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Full Revisions Table */}
          <div className="table-responsive">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Entity Tracked</th>
                  <th>Effective Date Span</th>
                  <th>Status</th>
                  <th>Change Reason</th>
                  <th>Historical Record Payload</th>
                  <th>Author & Created At</th>
                </tr>
              </thead>
              <tbody>
                {effectiveHistory.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-cell">No effective-dated revisions recorded.</td>
                  </tr>
                ) : (
                  effectiveHistory.map((h) => (
                    <tr key={h.id} className={h.is_current ? "current-version-row" : "historical-row"}>
                      <td>
                        <span className={`version-pill ${h.is_current ? "active-v" : "past-v"}`}>
                          v{h.version_number}
                        </span>
                      </td>
                      <td>
                        <strong>{h.entity_name || h.entity_id}</strong>
                        <div className="meta-subtext">Type: {h.entity_type}</div>
                      </td>
                      <td>
                        <div className="date-span">
                          <strong>{h.effective_from}</strong> ➔ <span>{h.effective_to === "9999-12-31" ? "Present (Open)" : h.effective_to}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${h.is_current ? "status-active" : "status-archived"}`}>
                          {h.is_current ? "CURRENT ACTIVE" : "HISTORICAL"}
                        </span>
                      </td>
                      <td>
                        <span className="reason-tag">{h.change_reason}</span>
                      </td>
                      <td>
                        <details className="payload-accordion">
                          <summary className="summary-btn">View Historical Payload</summary>
                          <pre className="payload-pre">
                            {typeof h.record_payload === 'string' ? h.record_payload : JSON.stringify(h.record_payload, null, 2)}
                          </pre>
                        </details>
                      </td>
                      <td>
                        <div>{h.created_by_name}</div>
                        <div className="time-subtext">{new Date(h.created_at).toLocaleDateString()}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Sensitive Exports & Admin Action Audit */}
      {activeTab === "sensitive_exports" && (
        <div className="tab-panel">
          <div className="panel-summary-card">
            <h3>Pillar 4: Sensitive Export Tracking & Administrative Action Audit</h3>
            <p>
              Monitors and logs every bulk data export containing financial or personal data (Salary Register, Bank Files, Aadhaar/PAN lists, Form 16) with cryptographic SHA-256 checksums and record counts. Also tracks sensitive administrative actions such as role privilege modifications and policy overrides.
            </p>
          </div>

          <div className="dual-grid">
            {/* Left Column: Sensitive Exports */}
            <div className="grid-section">
              <div className="section-header-row">
                <h4>Sensitive Data Exports Ledger ({sensitiveExports.length})</h4>
              </div>
              <div className="table-responsive">
                <table className="enterprise-table mini">
                  <thead>
                    <tr>
                      <th>Export Ref</th>
                      <th>Type & Format</th>
                      <th>Sensitivity & Count</th>
                      <th>User & IP</th>
                      <th>SHA-256 Checksum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensitiveExports.length === 0 ? (
                      <tr><td colSpan="5" className="empty-cell">No sensitive exports logged.</td></tr>
                    ) : (
                      sensitiveExports.map((e) => (
                        <tr key={e.id}>
                          <td><span className="code-pill">{e.export_code}</span></td>
                          <td>
                            <strong>{e.export_type}</strong>
                            <div className="meta-subtext">Format: {e.export_format}</div>
                          </td>
                          <td>
                            <span className="badge-sensitivity">{e.sensitivity_level}</span>
                            <div className="record-count">{e.record_count} records</div>
                          </td>
                          <td>
                            <strong>{e.user_name}</strong>
                            <div className="meta-subtext">{e.ip_address}</div>
                          </td>
                          <td>
                            <code className="checksum-code" title={e.file_checksum_sha256}>
                              {e.file_checksum_sha256.slice(0, 16)}...
                            </code>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column: Administrative Actions */}
            <div className="grid-section">
              <div className="section-header-row">
                <h4>Administrative Privilege & Policy Actions ({adminActions.length})</h4>
              </div>
              <div className="table-responsive">
                <table className="enterprise-table mini">
                  <thead>
                    <tr>
                      <th>Action Code</th>
                      <th>Category & Target</th>
                      <th>Admin & Details</th>
                      <th>Status</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminActions.length === 0 ? (
                      <tr><td colSpan="5" className="empty-cell">No administrative actions logged.</td></tr>
                    ) : (
                      adminActions.map((a) => (
                        <tr key={a.id}>
                          <td><span className="code-pill">{a.action_code}</span></td>
                          <td>
                            <strong>{a.action_category}</strong>
                            <div className="meta-subtext">Target: {a.target_entity_type} ({a.target_entity_id})</div>
                          </td>
                          <td>
                            <strong>{a.admin_name}</strong>
                            <p className="admin-action-text">{a.action_details}</p>
                          </td>
                          <td>
                            <span className={`status-pill ${a.status === 'SUCCESS' ? 'status-active' : 'status-blocked'}`}>
                              {a.status}
                            </span>
                          </td>
                          <td>
                            <div className="time-subtext">{new Date(a.created_at).toLocaleString()}</div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Document Preview & Download Governance */}
      {activeTab === "document_governance" && (
        <div className="tab-panel">
          <div className="panel-summary-card">
            <h3>Pillar 5: Document Preview & Download Governance Matrix</h3>
            <p>
              Enforces least-privilege document access. Configures distinct role permissions for <strong>PREVIEW</strong> versus <strong>DOWNLOAD</strong>, enforces dynamic watermarks containing user identity, IP address, and timestamp, and imposes daily download caps to prevent bulk document exfiltration.
            </p>
          </div>

          <div className="table-responsive">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Category Code</th>
                  <th>Category Label & Description</th>
                  <th>Preview Permitted Roles</th>
                  <th>Download Permitted Roles</th>
                  <th>Watermark Required</th>
                  <th>MFA Required</th>
                  <th>Daily Quota</th>
                </tr>
              </thead>
              <tbody>
                {documentPolicies.map((p) => {
                  const previewRoles = typeof p.can_preview_roles === 'string' ? JSON.parse(p.can_preview_roles) : p.can_preview_roles;
                  const downloadRoles = typeof p.can_download_roles === 'string' ? JSON.parse(p.can_download_roles) : p.can_download_roles;
                  return (
                    <tr key={p.id}>
                      <td><span className="code-pill">{p.category_code}</span></td>
                      <td>
                        <strong>{p.category_label}</strong>
                        <div className="meta-subtext">{p.description}</div>
                      </td>
                      <td>
                        <div className="role-chips">
                          {previewRoles.map((r, i) => (
                            <span key={i} className="chip chip-preview">{r}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="role-chips">
                          {downloadRoles.map((r, i) => (
                            <span key={i} className="chip chip-download">{r}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {p.requires_watermark ? (
                          <span className="badge-watermark">✔ Watermark Enforced</span>
                        ) : (
                          <span className="badge-off">None</span>
                        )}
                      </td>
                      <td>
                        {p.requires_mfa_stepup_download ? (
                          <span className="badge-mfa">🔐 Step-Up MFA</span>
                        ) : (
                          <span className="badge-off">Standard</span>
                        )}
                      </td>
                      <td>
                        <span className="quota-tag">{p.max_downloads_per_day} files/day</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Document Access Logs Section */}
          <div className="doc-audit-section">
            <div className="section-header-row">
              <h4>Recent Document Access & Permission Verification Audit ({documentAudits.length})</h4>
            </div>
            <div className="table-responsive">
              <table className="enterprise-table mini">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Category</th>
                    <th>User & Role</th>
                    <th>Action</th>
                    <th>Access Decision</th>
                    <th>Watermark Text Applied</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {documentAudits.map((d) => (
                    <tr key={d.id}>
                      <td><strong>{d.document_name}</strong></td>
                      <td><span className="meta-subtext">{d.document_category}</span></td>
                      <td>
                        <strong>{d.user_name}</strong>
                        <div className="meta-subtext">{d.user_role} • {d.ip_address}</div>
                      </td>
                      <td><span className="action-pill">{d.action_type}</span></td>
                      <td>
                        {d.access_granted ? (
                          <span className="decision-badge approved">✔ GRANTED</span>
                        ) : (
                          <span className="decision-badge rejected" title={d.denial_reason}>✖ DENIED</span>
                        )}
                      </td>
                      <td>
                        {d.watermark_applied ? (
                          <code className="watermark-preview-code">{d.watermark_applied}</code>
                        ) : (
                          <span className="meta-subtext">—</span>
                        )}
                      </td>
                      <td><div className="time-subtext">{new Date(d.created_at).toLocaleString()}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS
      ========================================================================= */}

      {/* Modal 1: Record Critical Change */}
      {modalType === "change" && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Record Critical Data Change</h3>
              <button className="btn-close" onClick={() => setModalType(null)}>✕</button>
            </div>
            <form onSubmit={handleSubmitChange}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Entity Type:</label>
                  <select
                    value={changeForm.entity_type}
                    onChange={(e) => setChangeForm({ ...changeForm, entity_type: e.target.value })}
                  >
                    <option value="EMPLOYEE_COMPENSATION">EMPLOYEE_COMPENSATION</option>
                    <option value="BANK_ACCOUNT">BANK_ACCOUNT</option>
                    <option value="STATUTORY_IDENTIFIERS">STATUTORY_IDENTIFIERS</option>
                    <option value="SECURITY_ROLE_PERMISSION">SECURITY_ROLE_PERMISSION</option>
                    <option value="SOW_BILLING_RATE">SOW_BILLING_RATE</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Entity ID:</label>
                    <input
                      type="text"
                      value={changeForm.entity_id}
                      onChange={(e) => setChangeForm({ ...changeForm, entity_id: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Entity Name:</label>
                    <input
                      type="text"
                      value={changeForm.entity_name}
                      onChange={(e) => setChangeForm({ ...changeForm, entity_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Old Basic Salary (INR):</label>
                    <input
                      type="number"
                      value={changeForm.old_basic}
                      onChange={(e) => setChangeForm({ ...changeForm, old_basic: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>New Basic Salary (INR):</label>
                    <input
                      type="number"
                      value={changeForm.new_basic}
                      onChange={(e) => setChangeForm({ ...changeForm, new_basic: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Business Justification (Mandatory):</label>
                  <textarea
                    rows="3"
                    value={changeForm.business_justification}
                    onChange={(e) => setChangeForm({ ...changeForm, business_justification: e.target.value })}
                    required
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Commit & Anchor Change</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Record Approval Decision */}
      {modalType === "approval" && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Record Approval Decision with Permanent Comments</h3>
              <button className="btn-close" onClick={() => setModalType(null)}>✕</button>
            </div>
            <form onSubmit={handleSubmitApproval}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Workflow Type:</label>
                    <select
                      value={approvalForm.workflow_type}
                      onChange={(e) => setApprovalForm({ ...approvalForm, workflow_type: e.target.value })}
                    >
                      <option value="LEAVE_REQUEST">LEAVE_REQUEST</option>
                      <option value="MONTHLY_PAYROLL_CUTOFF">MONTHLY_PAYROLL_CUTOFF</option>
                      <option value="SALARY_REVISION">SALARY_REVISION</option>
                      <option value="EXPENSE_REIMBURSEMENT">EXPENSE_REIMBURSEMENT</option>
                      <option value="EXIT_CLEARANCE">EXIT_CLEARANCE</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Entity ID / Request Ref:</label>
                    <input
                      type="text"
                      value={approvalForm.entity_id}
                      onChange={(e) => setApprovalForm({ ...approvalForm, entity_id: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Title / Description:</label>
                  <input
                    type="text"
                    value={approvalForm.entity_title}
                    onChange={(e) => setApprovalForm({ ...approvalForm, entity_title: e.target.value })}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Step Name:</label>
                    <input
                      type="text"
                      value={approvalForm.step_name}
                      onChange={(e) => setApprovalForm({ ...approvalForm, step_name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Decision:</label>
                    <select
                      value={approvalForm.decision}
                      onChange={(e) => setApprovalForm({ ...approvalForm, decision: e.target.value })}
                    >
                      <option value="APPROVED">APPROVED</option>
                      <option value="REJECTED">REJECTED</option>
                      <option value="SENT_BACK">SENT_BACK</option>
                      <option value="DELEGATED">DELEGATED</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Mandatory Comments & Auditor Justification:</label>
                  <textarea
                    rows="3"
                    value={approvalForm.comments}
                    onChange={(e) => setApprovalForm({ ...approvalForm, comments: e.target.value })}
                    placeholder="Provide clear reasons and audit trail remarks..."
                    required
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Permanently Record Decision</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Create Effective-Dated Revision */}
      {modalType === "revision" && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Create Non-Destructive Effective-Dated Revision</h3>
              <button className="btn-close" onClick={() => setModalType(null)}>✕</button>
            </div>
            <form onSubmit={handleSubmitRevision}>
              <div className="modal-body">
                <p className="modal-desc">
                  Submitting this will create a new version effective from the specified date. The previous active version will automatically have its end-date set without overwriting historical data.
                </p>

                <div className="form-row">
                  <div className="form-group">
                    <label>Entity ID (e.g. Employee ID):</label>
                    <input
                      type="text"
                      value={revisionForm.entity_id}
                      onChange={(e) => setRevisionForm({ ...revisionForm, entity_id: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Effective From Date:</label>
                    <input
                      type="date"
                      value={revisionForm.effective_from}
                      onChange={(e) => setRevisionForm({ ...revisionForm, effective_from: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Change Reason:</label>
                  <input
                    type="text"
                    value={revisionForm.change_reason}
                    onChange={(e) => setRevisionForm({ ...revisionForm, change_reason: e.target.value })}
                    placeholder="ANNUAL_MERIT_REVISION or PROMOTION"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>New Designation:</label>
                    <input
                      type="text"
                      value={revisionForm.designation}
                      onChange={(e) => setRevisionForm({ ...revisionForm, designation: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>New Basic Salary (INR):</label>
                    <input
                      type="number"
                      value={revisionForm.basic}
                      onChange={(e) => setRevisionForm({ ...revisionForm, basic: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>New Annual CTC (INR):</label>
                  <input
                    type="number"
                    value={revisionForm.ctc_annual}
                    onChange={(e) => setRevisionForm({ ...revisionForm, ctc_annual: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Advance Version Safely</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Log Sensitive Export */}
      {modalType === "export" && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Log Sensitive Data Export Event</h3>
              <button className="btn-close" onClick={() => setModalType(null)}>✕</button>
            </div>
            <form onSubmit={handleSubmitExport}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Export Type:</label>
                    <select
                      value={exportForm.export_type}
                      onChange={(e) => setExportForm({ ...exportForm, export_type: e.target.value })}
                    >
                      <option value="SALARY_REGISTER_EXCEL">SALARY_REGISTER_EXCEL</option>
                      <option value="BANK_DISBURSAL_CSV">BANK_DISBURSAL_CSV</option>
                      <option value="AADHAAR_PAN_COMPLIANCE_DOCKET">AADHAAR_PAN_COMPLIANCE_DOCKET</option>
                      <option value="PF_ESI_ECR_REPORT">PF_ESI_ECR_REPORT</option>
                      <option value="EMPLOYEE_MASTER_DUMP">EMPLOYEE_MASTER_DUMP</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Export Format:</label>
                    <select
                      value={exportForm.export_format}
                      onChange={(e) => setExportForm({ ...exportForm, export_format: e.target.value })}
                    >
                      <option value="XLSX">XLSX (Excel)</option>
                      <option value="CSV">CSV</option>
                      <option value="PDF">PDF</option>
                      <option value="ZIP">ZIP Encrypted</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Record Count:</label>
                    <input
                      type="number"
                      value={exportForm.record_count}
                      onChange={(e) => setExportForm({ ...exportForm, record_count: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Sensitivity Level:</label>
                    <select
                      value={exportForm.sensitivity_level}
                      onChange={(e) => setExportForm({ ...exportForm, sensitivity_level: e.target.value })}
                    >
                      <option value="FINANCIAL_CONFIDENTIAL">FINANCIAL_CONFIDENTIAL</option>
                      <option value="RESTRICTED_PII">RESTRICTED_PII</option>
                      <option value="STATUTORY_RESTRICTED">STATUTORY_RESTRICTED</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Export Purpose & Justification:</label>
                  <textarea
                    rows="3"
                    value={exportForm.export_purpose}
                    onChange={(e) => setExportForm({ ...exportForm, export_purpose: e.target.value })}
                    required
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Generate Hash & Log Export</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Document Permission & Watermark Simulator */}
      {modalType === "perm_test" && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>🧪 Test Document Preview vs Download Permissions</h3>
              <button className="btn-close" onClick={() => setModalType(null)}>✕</button>
            </div>
            <form onSubmit={handleEvaluatePermission}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Document Category:</label>
                    <select
                      value={permTestForm.category_code}
                      onChange={(e) => setPermTestForm({ ...permTestForm, category_code: e.target.value })}
                    >
                      {documentPolicies.map((p) => (
                        <option key={p.category_code} value={p.category_code}>
                          {p.category_label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Action Requested:</label>
                    <select
                      value={permTestForm.action_type}
                      onChange={(e) => setPermTestForm({ ...permTestForm, action_type: e.target.value })}
                    >
                      <option value="PREVIEW">PREVIEW (View with dynamic watermark)</option>
                      <option value="DOWNLOAD">DOWNLOAD (Save file to local disk)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Simulated User Role:</label>
                    <select
                      value={permTestForm.target_role}
                      onChange={(e) => setPermTestForm({ ...permTestForm, target_role: e.target.value })}
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="hr">HR Admin</option>
                      <option value="finance">Finance Officer</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                      <option value="auditor">Auditor (Read-Only)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Simulated User Email:</label>
                    <input
                      type="email"
                      value={permTestForm.target_user_email}
                      onChange={(e) => setPermTestForm({ ...permTestForm, target_user_email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="simulator-action-row">
                  <button type="submit" className="btn-primary">
                    ⚡ Evaluate Authorization & Watermark
                  </button>
                </div>

                {permTestResult && (
                  <div className="perm-result-box">
                    <div className="perm-result-header">
                      <strong>Access Evaluation Result:</strong>
                      {permTestResult.access_granted ? (
                        <span className="decision-badge approved">✔ ACCESS GRANTED</span>
                      ) : (
                        <span className="decision-badge rejected">✖ ACCESS DENIED</span>
                      )}
                    </div>

                    {!permTestResult.access_granted && (
                      <div className="denial-alert">
                        <strong>Reason for Denial:</strong> {permTestResult.denial_reason}
                      </div>
                    )}

                    {permTestResult.requires_mfa && (
                      <div className="mfa-alert">
                        🔐 <strong>Step-Up MFA Required:</strong> User must provide TOTP OTP challenge before downloading this confidential category.
                      </div>
                    )}

                    {permTestResult.watermark_applied && permTestResult.watermark_text && (
                      <div className="watermark-box">
                        <label>Dynamic Watermark Generated for Document:</label>
                        <div className="watermark-stamp">
                          {permTestResult.watermark_text}
                        </div>
                      </div>
                    )}

                    <div className="policy-summary-meta">
                      <div>Category: <strong>{permTestResult.category_label}</strong></div>
                      <div>Allowed Download Roles: <code>{permTestResult.policy_rules?.download_roles?.join(", ")}</code></div>
                      <div>Daily Quota Limit: <strong>{permTestResult.policy_rules?.max_downloads_per_day} files/day</strong></div>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setModalType(null)}>Close</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditGovernanceCenter;
