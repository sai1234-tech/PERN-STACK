import React, { useState, useEffect, useCallback, useMemo } from "react";
import { integrationService } from "../../services/integrationService";
import { toast } from "react-toastify";
import "./EnterpriseIntegrationsHub.css";

const CONNECTOR_METADATA = {
  payroll_vendor: {
    icon: "💰",
    scopeBadge: "Payroll inputs/results",
    protocolBadge: "API / SFTP / encrypted file",
    accentColor: "#3b82f6",
    actionLabel: "Export Inputs / Pull Results"
  },
  biometric_attendance: {
    icon: "⏱️",
    scopeBadge: "Attendance",
    protocolBadge: "API / scheduled import",
    accentColor: "#10b981",
    actionLabel: "Pull Biometric Punches"
  },
  identity_provider: {
    icon: "🛡️",
    scopeBadge: "SSO/MFA",
    protocolBadge: "OAuth2/OIDC/SAML as applicable",
    accentColor: "#6366f1",
    actionLabel: "Verify SSO & SCIM Directory"
  },
  email_service: {
    icon: "✉️",
    scopeBadge: "Notifications",
    protocolBadge: "Microsoft Graph / SMTP / provider API",
    accentColor: "#ec4899",
    actionLabel: "Send Heartbeat Notification"
  },
  bgv_provider: {
    icon: "🔍",
    scopeBadge: "Verification status",
    protocolBadge: "API / secure file",
    accentColor: "#f59e0b",
    actionLabel: "Poll Screening Dockets"
  },
  calendar_service: {
    icon: "🗓️",
    scopeBadge: "Interview scheduling",
    protocolBadge: "Microsoft/Google API",
    accentColor: "#8b5cf6",
    actionLabel: "Sync Interview Slots"
  },
  finance_erp: {
    icon: "📊",
    scopeBadge: "Cost center/accounting",
    protocolBadge: "API / file",
    accentColor: "#06b6d4",
    actionLabel: "Post GL Payroll Journal"
  },
  it_asset_system: {
    icon: "💻",
    scopeBadge: "Laptop/email/access",
    protocolBadge: "API / workflow",
    accentColor: "#14b8a6",
    actionLabel: "Trigger Provisioning Workflow"
  }
};

export default function EnterpriseIntegrationsHub() {
  const [summary, setSummary] = useState(null);
  const [connectors, setConnectors] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncingKey, setSyncingKey] = useState(null);

  // Selected Connector Modal / Detail Drawer
  const [selectedConnectorKey, setSelectedConnectorKey] = useState(null);
  const [connectorDetail, setConnectorDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [editFormData, setEditFormData] = useState({});

  // Filter logs by connector
  const [logFilter, setLogFilter] = useState("all");
  const [activeViewMode, setActiveViewMode] = useState("matrix"); // "matrix" | "cards"

  // Fetch summary and connectors
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setIsRefreshing(true);
    try {
      const res = await integrationService.getSummary();
      if (res && res.success) {
        setSummary(res.metrics);
        setConnectors(res.connectors || []);
        setRecentLogs(res.recentSyncLogs || []);
      } else {
        toast.error("Failed to load enterprise integration status");
      }
    } catch (err) {
      console.error("Integration fetch error:", err);
      if (err.message && (err.message.includes("Invalid or expired token") || err.message.includes("Access denied"))) {
        toast.warning("Your session has expired. Please log in again to manage enterprise integrations.");
      } else {
        toast.error(`Integration telemetry error: ${err.message}`);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch Connector Detail
  const fetchConnectorDetail = useCallback(async (key) => {
    setDetailLoading(true);
    setSelectedConnectorKey(key);
    setIsEditingConfig(false);
    try {
      const res = await integrationService.getConnectorDetail(key);
      if (res && res.success) {
        setConnectorDetail(res);
        setEditFormData({
          name: res.connector.name,
          endpoint_url: res.connector.endpoint_url || "",
          auth_type: res.connector.auth_type || "",
          sync_interval_mins: res.connector.sync_interval_mins || 60,
          is_enabled: res.connector.is_enabled,
          config_data_str: JSON.stringify(res.connector.config_data || {}, null, 2)
        });
      } else {
        toast.error(res?.message || "Failed to load connector details");
      }
    } catch (err) {
      console.error("Detail error:", err);
      toast.error(`Detail error: ${err.message}`);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Trigger On-Demand Sync
  const handleTriggerSync = async (key, e) => {
    if (e) e.stopPropagation();
    setSyncingKey(key);
    try {
      const res = await integrationService.triggerSync(key);
      if (res && res.success) {
        toast.success(res.message || "Sync execution completed");
        fetchData(true);
        if (selectedConnectorKey === key) {
          fetchConnectorDetail(key);
        }
      } else {
        toast.error(res?.message || "Sync execution failed");
      }
    } catch (err) {
      console.error("Sync trigger error:", err);
      toast.error(`Sync error: ${err.message}`);
    } finally {
      setSyncingKey(null);
    }
  };

  // Handle Save Configuration
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!selectedConnectorKey) return;
    try {
      let parsedConfig = {};
      try {
        parsedConfig = JSON.parse(editFormData.config_data_str || "{}");
      } catch (jsonErr) {
        toast.error(`Invalid JSON configuration: ${jsonErr.message}`);
        return;
      }

      const payload = {
        name: editFormData.name,
        endpoint_url: editFormData.endpoint_url,
        auth_type: editFormData.auth_type,
        sync_interval_mins: parseInt(editFormData.sync_interval_mins, 10),
        is_enabled: editFormData.is_enabled,
        config_data: parsedConfig
      };

      const res = await integrationService.updateConnector(selectedConnectorKey, payload);
      if (res && res.success) {
        toast.success(res.message || "Connector updated successfully");
        setIsEditingConfig(false);
        fetchConnectorDetail(selectedConnectorKey);
        fetchData(true);
      } else {
        toast.error(res?.message || "Failed to update configuration");
      }
    } catch (err) {
      toast.error(`Save error: ${err.message}`);
    }
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    if (logFilter === "all") return recentLogs;
    return recentLogs.filter((log) => log.connector_key === logFilter);
  }, [recentLogs, logFilter]);

  return (
    <div className="integrations-hub-container">
      {/* ── 1. Top Executive Command Header ── */}
      <header className="integrations-hero-header">
        <div className="integrations-hero-content">
          <div className="integrations-hero-tag">
            <span className="live-radar-pulse"></span>
            <span>ENTERPRISE EXTERNAL SYSTEMS INTEGRATION BRIDGE</span>
          </div>
          <h1 className="integrations-hero-title">8-Channel Enterprise Integration Hub</h1>
          <p className="integrations-hero-subtitle">
            Synchronizing live biometric terminals, payroll SFTP gateways, OAuth2/SAML IdP authentication,
            Microsoft Graph email dispatcher, BGV screening APIs, calendar schedules, SAP/NetSuite ERP journals, and IT asset workflows.
          </p>
        </div>

        <div className="integrations-hero-telemetry">
          <div className="hub-telemetry-card">
            <span className="hub-telemetry-label">Active Connectors</span>
            <span className="hub-telemetry-value">
              {summary ? `${summary.healthyConnectors} / ${summary.totalConnectors}` : "—"}
            </span>
          </div>
          <div className="hub-telemetry-card">
            <span className="hub-telemetry-label">Total Sync Runs</span>
            <span className="hub-telemetry-value highlighted">
              {summary ? summary.totalSyncExecutions : "—"}
            </span>
          </div>
          <div className="hub-telemetry-card">
            <span className="hub-telemetry-label">PostgreSQL Synced Records</span>
            <span className="hub-telemetry-value">
              {summary ? (
                (summary.biometricPunchesLogged || 0) +
                (summary.payrollVendorBatches || 0) +
                (summary.erpJournalsPosted || 0) +
                (summary.itAssetJobsActive || 0) +
                (summary.ssoIdentitiesEnrolled || 0) +
                (summary.systemNotificationsSent || 0) +
                (summary.candidateBgvCases || 0) +
                (summary.interviewsScheduled || 0)
              ) : "—"}
            </span>
          </div>
          <div className="hub-telemetry-card">
            <span className="hub-telemetry-label">Success Rate</span>
            <span className="hub-telemetry-value success">
              {summary ? `${summary.successRate}%` : "—"}
            </span>
          </div>
          <button
            className={`hub-sync-all-btn ${isRefreshing ? "spinning" : ""}`}
            onClick={() => fetchData()}
            title="Refresh All Real-Time Telemetry"
          >
            ↻ Sync Live Status
          </button>
        </div>
      </header>

      {/* ── View Switcher Toolbar ── */}
      <div className="hub-view-switcher-bar">
        <div className="hub-switcher-tabs">
          <button
            className={`hub-switch-tab ${activeViewMode === "matrix" ? "active" : ""}`}
            onClick={() => setActiveViewMode("matrix")}
          >
            📋 Integration Requirements Specification Matrix (8 Channels)
          </button>
          <button
            className={`hub-switch-tab ${activeViewMode === "cards" ? "active" : ""}`}
            onClick={() => setActiveViewMode("cards")}
          >
            ⚡ Connectors Cards Grid ({connectors.length})
          </button>
        </div>
      </div>

      {/* ── 2A. Integration Requirements Specification Matrix ── */}
      {activeViewMode === "matrix" && (
        <section className="requirements-matrix-section">
          <div className="section-title-row">
            <div>
              <h2 className="section-heading">Integration Requirements Specification Matrix</h2>
              <p className="section-subheading">
                Live external communication channels, operational status, transmission protocols, and real-time database sync.
              </p>
            </div>
          </div>

          <div className="matrix-table-wrapper">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th>Integration</th>
                  <th>Purpose</th>
                  <th>Method</th>
                  <th>Configured Provider</th>
                  <th>Database Records</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {connectors.map((c) => {
                  const meta = CONNECTOR_METADATA[c.connector_key] || {};
                  const isSyncing = syncingKey === c.connector_key;
                  return (
                    <tr key={c.connector_key} onClick={() => fetchConnectorDetail(c.connector_key)} className="matrix-clickable-row">
                      <td className="matrix-col-integration">
                        <span className="matrix-icon">{meta.icon || "🔌"}</span>
                        <div className="matrix-name-box">
                          <strong className="matrix-name-title">{c.name}</strong>
                          <span className="matrix-key"><code>{c.connector_key}</code></span>
                        </div>
                      </td>
                      <td className="matrix-col-purpose">
                        <span className="purpose-badge" style={{ backgroundColor: `${meta.accentColor || '#3b82f6'}18`, color: meta.accentColor || '#1d4ed8' }}>
                          {meta.scopeBadge || c.category}
                        </span>
                      </td>
                      <td className="matrix-col-method">
                        <span className="method-badge">
                          {meta.protocolBadge || c.protocol}
                        </span>
                      </td>
                      <td className="matrix-col-provider">
                        <strong className="provider-name">{c.provider}</strong>
                        <small className="endpoint-snippet">{c.auth_type} • {c.endpoint_url || "Configured Endpoint"}</small>
                      </td>
                      <td className="matrix-col-records">
                        <div className="matrix-records-badge">
                          <span className="matrix-record-count">{c.live_record_count ?? 0}</span>
                          <span className="matrix-record-label">live rows</span>
                        </div>
                      </td>
                      <td className="matrix-col-status">
                        <span className="connector-health-pill connected">
                          <span className="status-dot"></span>
                          {c.health_status}
                        </span>
                      </td>
                      <td className="matrix-col-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="matrix-sync-btn"
                          disabled={isSyncing}
                          onClick={(e) => handleTriggerSync(c.connector_key, e)}
                          title={`Execute real-time sync for ${c.name}`}
                        >
                          {isSyncing ? (
                            <span className="btn-spinner"></span>
                          ) : (
                            <>
                              <span>⚡</span>
                              <span>Sync</span>
                            </>
                          )}
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

      {/* ── 2B. The 8 Enterprise Integration Cards Grid ── */}
      {activeViewMode === "cards" && (
        <section className="connectors-grid-section">
          <div className="section-title-row">
            <div>
              <h2 className="section-heading">Active Integration Connectors</h2>
            <p className="section-subheading">
              Click any connector to inspect live protocol payloads, SFTP batch logs, raw punch streams, and GL vouchers.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="hub-loading-state">
            <div className="hub-quantum-spinner"></div>
            <p>Connecting to PostgreSQL telemetry and verifying 8 external integration handshakes...</p>
          </div>
        ) : (
          <div className="connectors-cards-grid">
            {connectors.map((connector) => {
              const meta = CONNECTOR_METADATA[connector.connector_key] || {
                icon: "🔌",
                scopeBadge: connector.category,
                protocolBadge: connector.protocol,
                accentColor: "#3b82f6",
                actionLabel: "Sync Now"
              };
              const isSyncing = syncingKey === connector.connector_key;

              return (
                <article
                  key={connector.connector_key}
                  className="connector-card"
                  onClick={() => fetchConnectorDetail(connector.connector_key)}
                >
                  <div className="connector-card-header">
                    <div className="connector-icon-badge" style={{ backgroundColor: `${meta.accentColor}15`, color: meta.accentColor }}>
                      <span className="connector-emoji">{meta.icon}</span>
                    </div>
                    <div className="connector-status-group">
                      <span className="connector-health-pill connected">
                        <span className="status-dot"></span>
                        {connector.health_status}
                      </span>
                    </div>
                  </div>

                  <div className="connector-card-body">
                    <h3 className="connector-name">{connector.name}</h3>
                    <p className="connector-provider">{connector.provider}</p>

                    <div className="connector-meta-pills">
                      <div className="meta-pill scope-pill" title="Functional Scope">
                        <span className="pill-dot"></span>
                        <span>{meta.scopeBadge}</span>
                      </div>
                      <div className="meta-pill protocol-pill" title="Protocol & Transmission Channel">
                        <span>{meta.protocolBadge}</span>
                      </div>
                    </div>

                    <div className="connector-telemetry-row">
                      <div className="telemetry-item">
                        <span className="item-label">Live Records</span>
                        <span className="item-val highlight">{connector.live_record_count ?? 0}</span>
                      </div>
                      <div className="telemetry-item">
                        <span className="item-label">Total Syncs</span>
                        <span className="item-val">{connector.total_sync_count ?? 0}</span>
                      </div>
                      <div className="telemetry-item">
                        <span className="item-label">Last Sync</span>
                        <span className="item-val">
                          {connector.last_sync_at ? connector.last_sync_at.replace("T", " ").substring(0, 16) : "Pending"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="connector-card-footer">
                    <button
                      className="connector-sync-action-btn"
                      disabled={isSyncing}
                      onClick={(e) => handleTriggerSync(connector.connector_key, e)}
                    >
                      {isSyncing ? (
                        <>
                          <span className="btn-spinner"></span>
                          <span>Synchronizing...</span>
                        </>
                      ) : (
                        <>
                          <span>⚡</span>
                          <span>{meta.actionLabel}</span>
                        </>
                      )}
                    </button>
                    <button className="connector-inspect-btn" title="Inspect Telemetry & Logs">
                      Inspect →
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      )}

      {/* ── 3. Real-Time Telemetry & Sync Audit Stream Table ── */}
      <section className="sync-logs-stream-section">
        <div className="logs-toolbar-row">
          <div>
            <h2 className="section-heading">Real-Time Sync Telemetry & Audit Stream</h2>
            <p className="section-subheading">
              PostgreSQL audit log of all inbound and outbound data transfers across the 8 enterprise connectors.
            </p>
          </div>

          <div className="logs-filter-group">
            <label htmlFor="log-connector-filter">Filter Connector:</label>
            <select
              id="log-connector-filter"
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              className="logs-filter-select"
            >
              <option value="all">All 8 Connectors ({recentLogs.length})</option>
              {connectors.map((c) => (
                <option key={c.connector_key} value={c.connector_key}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="sync-logs-table-wrapper">
          <table className="sync-logs-table">
            <thead>
              <tr>
                <th>CONNECTOR</th>
                <th>JOB TYPE</th>
                <th>DIRECTION</th>
                <th>RECORDS</th>
                <th>LATENCY</th>
                <th>TRIGGER</th>
                <th>PAYLOAD SUMMARY / PROTOCOL LOG</th>
                <th>TIMESTAMP</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} className="log-row">
                  <td className="log-connector-name">
                    <strong>{log.connector_name || log.connector_key}</strong>
                  </td>
                  <td>
                    <code className="job-type-code">{log.job_type}</code>
                  </td>
                  <td>
                    <span
                      className={`direction-badge ${
                        log.direction === "INBOUND"
                          ? "dir-inbound"
                          : log.direction === "OUTBOUND"
                          ? "dir-outbound"
                          : "dir-bidirectional"
                      }`}
                    >
                      {log.direction}
                    </span>
                  </td>
                  <td className="text-center font-bold">
                    {log.records_processed}
                  </td>
                  <td className="font-mono text-muted">
                    {log.duration_ms} ms
                  </td>
                  <td>
                    <span className="trigger-badge">{log.triggered_by}</span>
                  </td>
                  <td className="payload-summary-cell" title={log.payload_summary}>
                    {log.payload_summary}
                  </td>
                  <td className="timestamp-cell">
                    {log.created_at ? log.created_at.split("T")[0] + " " + log.created_at.split("T")[1]?.substring(0, 8) : "Just now"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 4. Connector Details & Configuration Modal / Drawer ── */}
      {selectedConnectorKey && (
        <div className="hub-modal-backdrop" onClick={() => setSelectedConnectorKey(null)}>
          <div className="hub-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <div className="modal-title-group">
                <span className="modal-title-emoji">
                  {CONNECTOR_METADATA[selectedConnectorKey]?.icon || "🔌"}
                </span>
                <div>
                  <h2 className="modal-connector-title">
                    {connectorDetail?.connector?.name || selectedConnectorKey}
                  </h2>
                  <span className="modal-provider-tag">
                    {connectorDetail?.connector?.provider} • Protocol: {connectorDetail?.connector?.protocol}
                  </span>
                </div>
              </div>

              <div className="modal-header-actions">
                <button
                  className="modal-sync-now-btn"
                  onClick={() => handleTriggerSync(selectedConnectorKey)}
                  disabled={syncingKey === selectedConnectorKey}
                >
                  ⚡ {syncingKey === selectedConnectorKey ? "Syncing..." : "Sync Now"}
                </button>
                <button className="modal-close-icon-btn" onClick={() => setSelectedConnectorKey(null)}>
                  ✕
                </button>
              </div>
            </div>

            {detailLoading ? (
              <div className="modal-loading-box">
                <div className="hub-quantum-spinner"></div>
                <p>Loading live configuration & domain batches from PostgreSQL...</p>
              </div>
            ) : (
              <div className="modal-body-scroll">
                {/* Protocol & Endpoints Overview */}
                <div className="modal-protocol-card">
                  <div className="protocol-card-col">
                    <span className="protocol-label">Transmission Protocol</span>
                    <span className="protocol-value">{connectorDetail?.connector?.protocol}</span>
                  </div>
                  <div className="protocol-card-col">
                    <span className="protocol-label">Authentication Type</span>
                    <span className="protocol-value">{connectorDetail?.connector?.auth_type}</span>
                  </div>
                  <div className="protocol-card-col">
                    <span className="protocol-label">Endpoint URL / SFTP Host</span>
                    <code className="protocol-code">{connectorDetail?.connector?.endpoint_url || "Dynamic Host"}</code>
                  </div>
                  <div className="protocol-card-col">
                    <span className="protocol-label">Sync Interval</span>
                    <span className="protocol-value">{connectorDetail?.connector?.sync_interval_mins} mins</span>
                  </div>
                </div>

                {/* Domain Specific Batch Preview */}
                {selectedConnectorKey === "biometric_attendance" && connectorDetail?.domainData?.punches && (
                  <div className="domain-telemetry-section">
                    <h3 className="domain-section-title">Raw Ingested Biometric Device Punches (PostgreSQL Live)</h3>
                    <div className="domain-table-wrapper">
                      <table className="domain-table">
                        <thead>
                          <tr>
                            <th>TERMINAL ID</th>
                            <th>TERMINAL IP</th>
                            <th>EMPLOYEE CODE</th>
                            <th>PUNCH TIME</th>
                            <th>TYPE</th>
                            <th>VERIFICATION MODE</th>
                            <th>PROCESSED</th>
                          </tr>
                        </thead>
                        <tbody>
                          {connectorDetail.domainData.punches.map((p) => (
                            <tr key={p.id}>
                              <td><code>{p.device_id}</code></td>
                              <td>{p.terminal_ip}</td>
                              <td><strong>{p.employee_code}</strong></td>
                              <td>{p.punch_time?.replace("T", " ")?.substring(0, 19)}</td>
                              <td><span className="punch-type-pill">{p.punch_type}</span></td>
                              <td>{p.verification_mode}</td>
                              <td><span className="badge-processed">Reconciled</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedConnectorKey === "payroll_vendor" && connectorDetail?.domainData?.payrollBatches && (
                  <div className="domain-telemetry-section">
                    <h3 className="domain-section-title">Dispatched Payroll Vendor SFTP / API Batches</h3>
                    <div className="domain-table-wrapper">
                      <table className="domain-table">
                        <thead>
                          <tr>
                            <th>BATCH CODE</th>
                            <th>PERIOD</th>
                            <th>TRANSFER METHOD</th>
                            <th>EMPLOYEES</th>
                            <th>TOTAL GROSS</th>
                            <th>TOTAL NET</th>
                            <th>STATUS</th>
                            <th>CHECKSUM</th>
                          </tr>
                        </thead>
                        <tbody>
                          {connectorDetail.domainData.payrollBatches.map((b) => (
                            <tr key={b.id}>
                              <td><code>{b.batch_code}</code></td>
                              <td>{b.period}</td>
                              <td><span className="method-pill">{b.transfer_method}</span></td>
                              <td>{b.total_employees}</td>
                              <td className="currency">₹{Number(b.total_gross).toLocaleString("en-IN")}</td>
                              <td className="currency">₹{Number(b.total_net).toLocaleString("en-IN")}</td>
                              <td><span className="badge-processed">{b.status}</span></td>
                              <td><code className="checksum-code">{b.file_checksum?.substring(0, 16)}...</code></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedConnectorKey === "finance_erp" && connectorDetail?.domainData?.erpVouchers && (
                  <div className="domain-telemetry-section">
                    <h3 className="domain-section-title">Finance & ERP General Ledger Payroll Journal Batches</h3>
                    <div className="domain-table-wrapper">
                      <table className="domain-table">
                        <thead>
                          <tr>
                            <th>VOUCHER CODE</th>
                            <th>ERP SYSTEM</th>
                            <th>PERIOD</th>
                            <th>TOTAL DEBIT</th>
                            <th>TOTAL CREDIT</th>
                            <th>COST CENTERS</th>
                            <th>STATUS</th>
                            <th>ERP REF DOC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {connectorDetail.domainData.erpVouchers.map((v) => (
                            <tr key={v.id}>
                              <td><code>{v.voucher_code}</code></td>
                              <td>{v.erp_system}</td>
                              <td>{v.period}</td>
                              <td className="currency">₹{Number(v.total_debit).toLocaleString("en-IN")}</td>
                              <td className="currency">₹{Number(v.total_credit).toLocaleString("en-IN")}</td>
                              <td>{v.cost_centers_count} Centers</td>
                              <td><span className="badge-processed">{v.status}</span></td>
                              <td><code>{v.erp_reference_doc}</code></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedConnectorKey === "it_asset_system" && connectorDetail?.domainData?.itJobs && (
                  <div className="domain-telemetry-section">
                    <h3 className="domain-section-title">IT Asset & System Access Provisioning Queue</h3>
                    <div className="domain-table-wrapper">
                      <table className="domain-table">
                        <thead>
                          <tr>
                            <th>REQUEST CODE</th>
                            <th>TARGET SYSTEM</th>
                            <th>EMPLOYEE</th>
                            <th>PROVISIONING ITEM</th>
                            <th>STATUS</th>
                            <th>ASSIGNED ASSET / LICENSE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {connectorDetail.domainData.itJobs.map((j) => (
                            <tr key={j.id}>
                              <td><code>{j.request_code}</code></td>
                              <td>{j.target_system}</td>
                              <td><strong>{j.employee_name}</strong></td>
                              <td><span className="item-pill">{j.item_type}</span></td>
                              <td><span className="badge-processed">{j.status}</span></td>
                              <td>{j.assigned_serial_or_license}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Configuration Editor Toggle */}
                <div className="config-editor-section">
                  <div className="config-header-row">
                    <h3 className="domain-section-title">Connector Parameters & Credentials</h3>
                    <button
                      type="button"
                      className="edit-config-toggle-btn"
                      onClick={() => setIsEditingConfig(!isEditingConfig)}
                    >
                      {isEditingConfig ? "Cancel Editing" : "✎ Edit Configuration"}
                    </button>
                  </div>

                  {isEditingConfig ? (
                    <form onSubmit={handleSaveConfig} className="config-edit-form">
                      <div className="form-fields-grid">
                        <div className="form-input-group">
                          <label>Connector Display Name</label>
                          <input
                            type="text"
                            value={editFormData.name || ""}
                            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                            required
                          />
                        </div>

                        <div className="form-input-group">
                          <label>Endpoint URL / SFTP Gateway</label>
                          <input
                            type="text"
                            value={editFormData.endpoint_url || ""}
                            onChange={(e) => setEditFormData({ ...editFormData, endpoint_url: e.target.value })}
                            required
                          />
                        </div>

                        <div className="form-input-group">
                          <label>Authentication Type</label>
                          <input
                            type="text"
                            value={editFormData.auth_type || ""}
                            onChange={(e) => setEditFormData({ ...editFormData, auth_type: e.target.value })}
                            required
                          />
                        </div>

                        <div className="form-input-group">
                          <label>Sync Interval (Minutes)</label>
                          <input
                            type="number"
                            value={editFormData.sync_interval_mins || 60}
                            onChange={(e) => setEditFormData({ ...editFormData, sync_interval_mins: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <div className="form-input-group full-width">
                        <label>Extended Parameters (JSON)</label>
                        <textarea
                          rows={6}
                          value={editFormData.config_data_str || "{}"}
                          onChange={(e) => setEditFormData({ ...editFormData, config_data_str: e.target.value })}
                          className="json-textarea"
                        />
                      </div>

                      <div className="form-actions-row">
                        <button type="submit" className="save-config-submit-btn">
                          Save Connector Configuration
                        </button>
                      </div>
                    </form>
                  ) : (
                    <pre className="config-json-preview">
                      {JSON.stringify(connectorDetail?.connector?.config_data || {}, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
