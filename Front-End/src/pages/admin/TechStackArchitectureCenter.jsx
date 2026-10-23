import React, { useState, useEffect } from "react";
import { techStackSelectionService } from "../../services/techStackSelectionService";
import "./TechStackArchitectureCenter.css";

const TechStackArchitectureCenter = () => {
  const [activeTab, setActiveTab] = useState("matrix");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Core Data States
  const [overview, setOverview] = useState(null);
  const [matrixData, setMatrixData] = useState([]);
  const [cloudProfiles, setCloudProfiles] = useState([]);
  const [storageProviders, setStorageProviders] = useState([]);
  const [idpConfigs, setIdpConfigs] = useState([]);
  const [tcoData, setTcoData] = useState(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Object Storage Sandbox State
  const [storageTestForm, setStorageTestForm] = useState({
    provider_code: "AWS_S3_PRIMARY",
    document_name: "employee-statutory-contracts/EMP-2026-9021.pdf"
  });
  const [storageTestResult, setStorageTestResult] = useState(null);
  const [storageTestLoading, setStorageTestLoading] = useState(false);

  // IdP SSO/MFA Sandbox State
  const [idpTestForm, setIdpTestForm] = useState({
    idp_code: "AZURE_AD_ENTRA",
    test_user_email: "vp.engineering@enterprise.com"
  });
  const [idpTestResult, setIdpTestResult] = useState(null);
  const [idpTestLoading, setIdpTestLoading] = useState(false);

  // Dynamic Weighting Simulator State
  const [weights, setWeights] = useState({
    skills_weight: 25,
    security_weight: 30,
    integrations_weight: 25,
    tco_weight: 20
  });
  const [simulatedRanking, setSimulatedRanking] = useState([]);
  const [simulating, setSimulating] = useState(false);

  // Load all architectural data
  const loadAllData = async () => {
    try {
      setRefreshing(true);
      setError(null);

      const [ovRes, matRes, cloudRes, storRes, idpRes, tcoRes] = await Promise.all([
        techStackSelectionService.getOverview().catch(() => null),
        techStackSelectionService.getMatrix().catch(() => null),
        techStackSelectionService.getCloudProfiles().catch(() => null),
        techStackSelectionService.getStorageProviders().catch(() => null),
        techStackSelectionService.getIdpConfigurations().catch(() => null),
        techStackSelectionService.getTcoComparison().catch(() => null)
      ]);

      if (ovRes && ovRes.success) setOverview(ovRes.architecture_decision);
      if (matRes && matRes.success) setMatrixData(matRes.matrix || []);
      if (cloudRes && cloudRes.success) setCloudProfiles(cloudRes.profiles || []);
      if (storRes && storRes.success) setStorageProviders(storRes.providers || []);
      if (idpRes && idpRes.success) setIdpConfigs(idpRes.identity_providers || []);
      if (tcoRes && tcoRes.success) setTcoData(tcoRes);
    } catch (err) {
      console.error("Failed to load tech stack architecture data:", err);
      setError("Unable to retrieve architecture selection data. Please retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Filter matrix data
  const filteredMatrix = matrixData.filter((item) => {
    if (categoryFilter && item.layer_category !== categoryFilter) return false;
    if (statusFilter && item.status !== statusFilter) return false;
    return true;
  });

  // Storage Test Handler
  const handleStorageTest = async (e) => {
    e.preventDefault();
    try {
      setStorageTestLoading(true);
      const res = await techStackSelectionService.testStorageOperation(storageTestForm);
      setStorageTestResult(res);
    } catch (err) {
      alert("Storage operation test failed: " + (err.message || "Unknown error"));
    } finally {
      setStorageTestLoading(false);
    }
  };

  // IdP Handshake Handler
  const handleIdpTest = async (e) => {
    e.preventDefault();
    try {
      setIdpTestLoading(true);
      const res = await techStackSelectionService.simulateIdpHandshake(idpTestForm);
      setIdpTestResult(res);
    } catch (err) {
      alert("IdP Handshake simulation failed: " + (err.message || "Unknown error"));
    } finally {
      setIdpTestLoading(false);
    }
  };

  // Run dynamic weighting recalculation
  const handleWeightChange = async (key, val) => {
    const updated = { ...weights, [key]: Number(val) };
    setWeights(updated);
    try {
      setSimulating(true);
      const res = await techStackSelectionService.evaluateCustomScoring(updated);
      if (res.success) {
        setSimulatedRanking(res.ranked_results || []);
      }
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="stack-center-container">
      {/* 1. Header Banner */}
      <div className="stack-header-banner">
        <div className="stack-header-title-block">
          <div className="stack-header-badge-row">
            <span className="stack-live-dot" />
            <span className="stack-header-badge">Architecture Decision Record (ADR-021)</span>
            <span>ENTERPRISE STANDARDS COMPLIANT</span>
          </div>
          <h1>Technology Stack & Multi-Cloud Infrastructure Hub</h1>
          <p>
            Definitive comparative evaluation across Internal Engineering Skills, Security Standards,
            Enterprise Integrations, and Total Cost of Ownership (TCO). Proven open-source PERN stack delivers
            <strong> 74.1% cost reduction ($574,100 net 3-year savings)</strong> over proprietary enterprise suites.
          </p>
        </div>
        <div className="stack-header-actions">
          <button
            className="stack-btn-refresh"
            onClick={loadAllData}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "↻ Refresh Topology"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: "1rem", borderRadius: "8px", border: "1px solid #f87171" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* 2. Executive Rationale & KPI Cards */}
      <div className="stack-kpi-grid">
        <div className="stack-kpi-card">
          <div className="stack-kpi-icon blue">⚡</div>
          <div className="stack-kpi-content">
            <span className="stack-kpi-label">Selected Frontend</span>
            <span className="stack-kpi-value">React 18 + Vite</span>
            <span className="stack-kpi-sub">Score: 96.5 | Unified JS/TS Ecosystem</span>
          </div>
        </div>

        <div className="stack-kpi-card">
          <div className="stack-kpi-icon green">🚀</div>
          <div className="stack-kpi-content">
            <span className="stack-kpi-label">Selected Backend</span>
            <span className="stack-kpi-value">Node.js + Express</span>
            <span className="stack-kpi-sub">Score: 95.8 | Asynchronous Non-Blocking I/O</span>
          </div>
        </div>

        <div className="stack-kpi-card">
          <div className="stack-kpi-icon purple">🐘</div>
          <div className="stack-kpi-content">
            <span className="stack-kpi-label">Selected Database</span>
            <span className="stack-kpi-value">PostgreSQL 16</span>
            <span className="stack-kpi-sub">Score: 98.2 | ACID + JSONB Document Store</span>
          </div>
        </div>

        <div className="stack-kpi-card">
          <div className="stack-kpi-icon amber">💰</div>
          <div className="stack-kpi-content">
            <span className="stack-kpi-label">3-Year TCO Savings</span>
            <span className="stack-kpi-value">$574,100</span>
            <span className="stack-kpi-sub">74.1% Cost Reduction vs Microsoft/Oracle</span>
          </div>
        </div>
      </div>

      {/* 3. Tab Navigation */}
      <div className="stack-tab-bar">
        <button
          className={`stack-tab-btn ${activeTab === "matrix" ? "active" : ""}`}
          onClick={() => setActiveTab("matrix")}
        >
          📊 Selection Matrix
        </button>
        <button
          className={`stack-tab-btn ${activeTab === "clouds" ? "active" : ""}`}
          onClick={() => setActiveTab("clouds")}
        >
          ☁️ Multi-Cloud Topology
        </button>
        <button
          className={`stack-tab-btn ${activeTab === "storage" ? "active" : ""}`}
          onClick={() => setActiveTab("storage")}
        >
          🗄️ Cloud Object Storage
        </button>
        <button
          className={`stack-tab-btn ${activeTab === "idp" ? "active" : ""}`}
          onClick={() => setActiveTab("idp")}
        >
          🛡️ Enterprise IdP SSO/MFA
        </button>
        <button
          className={`stack-tab-btn ${activeTab === "tco" ? "active" : ""}`}
          onClick={() => setActiveTab("tco")}
        >
          💵 3-Year TCO Model
        </button>
        <button
          className={`stack-tab-btn ${activeTab === "simulator" ? "active" : ""}`}
          onClick={() => setActiveTab("simulator")}
        >
          🎛️ Sensitivity Simulator
        </button>
      </div>

      {/* 4. Tab Content */}
      <div className="stack-content-panel">
        {/* TAB 1: SELECTION MATRIX */}
        {activeTab === "matrix" && (
          <div className="stack-card">
            <div className="stack-card-header">
              <div className="stack-card-title-group">
                <h3>Architectural Technology Selection Matrix</h3>
                <p>
                  Comparison of candidate technologies evaluated across all 4 enterprise dimensions.
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ padding: "0.4rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                >
                  <option value="">All Categories</option>
                  <option value="FRONTEND">Frontend (React vs Angular vs Vue)</option>
                  <option value="BACKEND">Backend (Node.js vs Spring Boot vs .NET)</option>
                  <option value="DATABASE">Database (Postgres vs MS SQL vs MySQL)</option>
                  <option value="OBJECT_STORAGE">Object Storage (S3 vs Blob vs GCS)</option>
                  <option value="API_ARCHITECTURE">API Architecture (REST vs GraphQL/gRPC)</option>
                  <option value="IDENTITY_MFA">Identity & MFA (SAML/OIDC vs LDAP)</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ padding: "0.4rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                >
                  <option value="">All Statuses</option>
                  <option value="SELECTED">Selected Only</option>
                  <option value="EVALUATED_ALTERNATIVE">Alternatives Only</option>
                </select>
              </div>
            </div>

            <div className="stack-card-body" style={{ overflowX: "auto", padding: 0 }}>
              <table className="stack-matrix-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Technology</th>
                    <th>Skills Fit (25%)</th>
                    <th>Security (30%)</th>
                    <th>Integrations (25%)</th>
                    <th>TCO / Cost (20%)</th>
                    <th>Overall Score</th>
                    <th>Architecture Justification</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMatrix.map((item) => (
                    <tr
                      key={item.id}
                      className={item.status === "SELECTED" ? "selected-row" : ""}
                    >
                      <td style={{ fontWeight: 600, color: "#64748b" }}>{item.layer_category}</td>
                      <td>
                        <div className="tech-name-cell">
                          <span>{item.technology_name}</span>
                          {item.status === "SELECTED" ? (
                            <span className="badge-selected">SELECTED</span>
                          ) : (
                            <span className="badge-alternative">ALTERNATIVE</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`score-badge ${Number(item.skills_fit_score) >= 90 ? "high" : Number(item.skills_fit_score) >= 80 ? "medium" : "low"}`}>
                          {item.skills_fit_score}
                        </span>
                      </td>
                      <td>
                        <span className={`score-badge ${Number(item.security_standards_score) >= 90 ? "high" : Number(item.security_standards_score) >= 80 ? "medium" : "low"}`}>
                          {item.security_standards_score}
                        </span>
                      </td>
                      <td>
                        <span className={`score-badge ${Number(item.integrations_score) >= 90 ? "high" : Number(item.integrations_score) >= 80 ? "medium" : "low"}`}>
                          {item.integrations_score}
                        </span>
                      </td>
                      <td>
                        <span className={`score-badge ${Number(item.tco_cost_score) >= 90 ? "high" : Number(item.tco_cost_score) >= 80 ? "medium" : "low"}`}>
                          {item.tco_cost_score}
                        </span>
                      </td>
                      <td>
                        <span className="score-badge high" style={{ fontSize: "0.95rem" }}>
                          {item.overall_score} / 100
                        </span>
                      </td>
                      <td style={{ fontSize: "0.825rem", color: "#475569", maxWidth: "420px", lineHeight: "1.4" }}>
                        <strong>{item.status === "SELECTED" ? "Why Selected: " : "Alternative Trade-off: "}</strong>
                        {item.evaluation_notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: MULTI-CLOUD TOPOLOGY */}
        {activeTab === "clouds" && (
          <div className="stack-content-panel">
            <div className="stack-card">
              <div className="stack-card-header">
                <div className="stack-card-title-group">
                  <h3>Multi-Cloud Infrastructure Deployment Profiles</h3>
                  <p>
                    Portable containerized architecture (Docker + Kubernetes) ready for immediate deployment on AWS, Azure, GCP, or On-Premises.
                  </p>
                </div>
              </div>
            </div>

            <div className="cloud-profiles-grid">
              {cloudProfiles.map((cloud) => (
                <div
                  key={cloud.id}
                  className={`cloud-profile-card ${cloud.status === "PRIMARY_RECOMMENDED" ? "active-prod" : ""}`}
                >
                  <div className="cloud-card-header">
                    <div className="cloud-provider-title">
                      <span>{cloud.cloud_provider === "AWS" ? "🟧" : cloud.cloud_provider === "AZURE" ? "🟦" : cloud.cloud_provider === "GCP" ? "🟥" : "🏢"}</span>
                      <span>{cloud.cloud_provider}</span>
                    </div>
                    {cloud.status === "PRIMARY_RECOMMENDED" && (
                      <span className="badge-selected">PRIMARY TARGET</span>
                    )}
                  </div>

                  <div className="cloud-pricing-banner">
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase" }}>Monthly Hosting Est.</div>
                      <div className="cloud-pricing-amount">${Number(cloud.monthly_est_usd).toLocaleString()} / mo</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase" }}>Uptime SLA</div>
                      <div style={{ fontWeight: 800, color: "#059669" }}>{cloud.sla_uptime_target}</div>
                    </div>
                  </div>

                  <div className="cloud-spec-list">
                    <div className="cloud-spec-item">
                      <span className="cloud-spec-label">Compute Topology</span>
                      <span className="cloud-spec-val">{cloud.compute_topology}</span>
                    </div>
                    <div className="cloud-spec-item">
                      <span className="cloud-spec-label">Database Service</span>
                      <span className="cloud-spec-val">{cloud.database_service}</span>
                    </div>
                    <div className="cloud-spec-item">
                      <span className="cloud-spec-label">Object Storage</span>
                      <span className="cloud-spec-val">{cloud.object_storage_service}</span>
                    </div>
                    <div className="cloud-spec-item">
                      <span className="cloud-spec-label">Secrets & KMS</span>
                      <span className="cloud-spec-val">{cloud.kms_secrets_service}</span>
                    </div>
                    <div className="cloud-spec-item">
                      <span className="cloud-spec-label">RPO Target</span>
                      <span className="cloud-spec-val">{cloud.rpo_target}</span>
                    </div>
                    <div className="cloud-spec-item">
                      <span className="cloud-spec-label">RTO Target</span>
                      <span className="cloud-spec-val">{cloud.rto_target}</span>
                    </div>
                  </div>

                  <div style={{ fontSize: "0.8rem", color: "#64748b", background: "#f8fafc", padding: "0.75rem", borderRadius: "6px" }}>
                    <strong>Architecture Notes:</strong> {cloud.notes}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: OBJECT STORAGE ENGINE */}
        {activeTab === "storage" && (
          <div className="stack-content-panel">
            <div className="stack-card">
              <div className="stack-card-header">
                <div className="stack-card-title-group">
                  <h3>Cloud Object Storage Configuration & Presigned URL Engine</h3>
                  <p>
                    S3 API-compatible enterprise storage layer with AES-256-GCM encryption at rest and short-lived HMAC signed URLs.
                  </p>
                </div>
              </div>
              <div className="stack-card-body">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem", marginBottom: "1.5rem" }}>
                  {storageProviders.map((p) => (
                    <div key={p.id} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1rem", background: p.is_default_active ? "rgba(56, 189, 248, 0.05)" : "#ffffff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <strong style={{ color: "#0f172a" }}>{p.provider_name}</strong>
                        {p.is_default_active && <span className="badge-selected">ACTIVE</span>}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                        <div><strong>Bucket:</strong> {p.bucket_name}</div>
                        <div><strong>Region:</strong> {p.region}</div>
                        <div><strong>Encryption:</strong> {p.encryption_algorithm}</div>
                        <div><strong>Signed URL TTL:</strong> {p.signed_url_ttl_seconds} seconds (15 min)</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Storage Sandbox Form */}
                <div className="sandbox-card">
                  <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "1rem" }}>
                    ⚡ Live Presigned URL & Document Access Verification Sandbox
                  </div>
                  <form onSubmit={handleStorageTest} className="sandbox-form-row">
                    <div className="sandbox-input-group">
                      <label>Target Provider</label>
                      <select
                        value={storageTestForm.provider_code}
                        onChange={(e) => setStorageTestForm({ ...storageTestForm, provider_code: e.target.value })}
                      >
                        <option value="AWS_S3_PRIMARY">AWS S3 (Primary Bucket ap-south-1)</option>
                        <option value="AZURE_BLOB_SECONDARY">Azure Blob Storage (Secondary Vault)</option>
                        <option value="ON_PREM_MINIO_VAULT">On-Premises MinIO (Air-Gapped Vault)</option>
                      </select>
                    </div>

                    <div className="sandbox-input-group" style={{ flex: 2 }}>
                      <label>Document Key / Statutory Docket</label>
                      <input
                        type="text"
                        value={storageTestForm.document_name}
                        onChange={(e) => setStorageTestForm({ ...storageTestForm, document_name: e.target.value })}
                        placeholder="e.g. employee-contracts/EMP-2026-9021.pdf"
                      />
                    </div>

                    <button type="submit" className="sandbox-btn-submit" disabled={storageTestLoading}>
                      {storageTestLoading ? "Signing URL..." : "🔒 Generate & Verify Signed URL"}
                    </button>
                  </form>

                  {storageTestResult && (
                    <div className="sandbox-result-box">
                      <div style={{ color: "#10b981", fontWeight: 700, marginBottom: "0.5rem" }}>
                        ✓ STATUS: {storageTestResult.status} (Verified in {storageTestResult.latency_ms}ms)
                      </div>
                      <div><strong>Operation Ref:</strong> {storageTestResult.operation_code}</div>
                      <div><strong>Server Encryption:</strong> {storageTestResult.encryption_verified}</div>
                      <div><strong>SHA-256 Checksum:</strong> {storageTestResult.sha256_checksum}</div>
                      <div style={{ marginTop: "0.5rem" }}>
                        <strong>Generated Presigned URL (15 Min TTL):</strong>
                        <div style={{ wordBreak: "break-all", color: "#f8fafc", background: "rgba(255,255,255,0.06)", padding: "0.5rem", borderRadius: "4px", marginTop: "0.25rem" }}>
                          {storageTestResult.presigned_download_url}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ENTERPRISE IDP SSO / MFA */}
        {activeTab === "idp" && (
          <div className="stack-content-panel">
            <div className="stack-card">
              <div className="stack-card-header">
                <div className="stack-card-title-group">
                  <h3>Enterprise Identity Provider (IdP) SSO & Multi-Factor Authentication</h3>
                  <p>
                    Federated single sign-on supporting SAML 2.0, OpenID Connect (OIDC), and hardware-enforced FIDO2/TOTP MFA.
                  </p>
                </div>
              </div>
              <div className="stack-card-body">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem", marginBottom: "1.5rem" }}>
                  {idpConfigs.map((idp) => (
                    <div key={idp.id} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1rem", background: idp.is_active_default ? "rgba(16, 185, 129, 0.05)" : "#ffffff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <strong style={{ color: "#0f172a" }}>{idp.idp_name}</strong>
                        {idp.is_active_default && <span className="badge-selected">DEFAULT</span>}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                        <div><strong>Protocol:</strong> {idp.protocol}</div>
                        <div><strong>Issuer:</strong> {idp.issuer_url}</div>
                        <div><strong>MFA Enforcement:</strong> {idp.mfa_enforced ? "Required (Step-Up)" : "Optional"}</div>
                        <div><strong>Supported Methods:</strong> {idp.supported_mfa_methods}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* IdP Handshake Sandbox */}
                <div className="sandbox-card">
                  <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "1rem" }}>
                    🛡️ Live Federated IdP SSO & MFA Handshake Simulator
                  </div>
                  <form onSubmit={handleIdpTest} className="sandbox-form-row">
                    <div className="sandbox-input-group">
                      <label>Federated Identity Provider</label>
                      <select
                        value={idpTestForm.idp_code}
                        onChange={(e) => setIdpTestForm({ ...idpTestForm, idp_code: e.target.value })}
                      >
                        <option value="AZURE_AD_ENTRA">Microsoft Azure AD / Entra ID (OIDC)</option>
                        <option value="OKTA_ENTERPRISE">Okta Enterprise SSO (SAML 2.0)</option>
                        <option value="KEYCLOAK_INTERNAL">RedHat Keycloak (Self-Hosted OIDC)</option>
                        <option value="GOOGLE_WORKSPACE">Google Workspace Enterprise (SAML)</option>
                      </select>
                    </div>

                    <div className="sandbox-input-group" style={{ flex: 2 }}>
                      <label>Test Corporate User Email</label>
                      <input
                        type="email"
                        value={idpTestForm.test_user_email}
                        onChange={(e) => setIdpTestForm({ ...idpTestForm, test_user_email: e.target.value })}
                        placeholder="e.g. employee@enterprise.com"
                      />
                    </div>

                    <button type="submit" className="sandbox-btn-submit" disabled={idpTestLoading}>
                      {idpTestLoading ? "Authenticating..." : "🔑 Simulate SSO/MFA Handshake"}
                    </button>
                  </form>

                  {idpTestResult && (
                    <div className="sandbox-result-box">
                      <div style={{ color: "#10b981", fontWeight: 700, marginBottom: "0.5rem" }}>
                        ✓ SSO FEDERATION: {idpTestResult.status} ({idpTestResult.handshake_latency_ms}ms)
                      </div>
                      <div><strong>Handshake Code:</strong> {idpTestResult.handshake_code}</div>
                      <div><strong>User Authenticated:</strong> {idpTestResult.user_authenticated}</div>
                      <div><strong>MFA Status:</strong> Verified ({idpTestResult.sso_claims_verified?.mfa_auth_method})</div>
                      <div><strong>Corporate Claims:</strong> Roles: {JSON.stringify(idpTestResult.sso_claims_verified?.roles)} | Groups: {JSON.stringify(idpTestResult.sso_claims_verified?.groups)}</div>
                      <div><strong>Session Token Issued:</strong> {idpTestResult.session_token_issued}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: 3-YEAR TCO FINANCIALS */}
        {activeTab === "tco" && (
          <div className="stack-content-panel">
            <div className="tco-savings-hero">
              <div className="tco-savings-content">
                <h2>Total Cost of Ownership (TCO) Financial Model</h2>
                <p>
                  Comprehensive 3-year financial comparison proving that selecting the open-source PERN stack delivers
                  <strong> $574,100 in direct net cost savings (74.1% reduction)</strong> by eliminating commercial database licensing fees
                  and unifying the engineering team under a single JavaScript/TypeScript runtime.
                </p>
              </div>
              <div className="tco-savings-badge">
                <div className="val">$574,100</div>
                <div className="lbl">3-Year Net Savings</div>
              </div>
            </div>

            <div className="tco-comparison-grid">
              {(tcoData?.models || []).map((m) => (
                <div
                  key={m.id}
                  className={`tco-card ${m.stack_tier === "SELECTED_PERN_OPEN_SOURCE" ? "recommended" : ""}`}
                >
                  <div className="tco-card-header">
                    <div>
                      {m.stack_tier === "SELECTED_PERN_OPEN_SOURCE" && (
                        <span className="badge-selected" style={{ marginBottom: "0.35rem", display: "inline-block" }}>
                          SELECTED ARCHITECTURE
                        </span>
                      )}
                      <h4>{m.stack_name}</h4>
                      <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{m.tier_description}</div>
                    </div>
                    <div className="tco-price-block">
                      <div className="tco-price-val">${Number(m.total_3yr_tco_usd).toLocaleString()}</div>
                      <div className="tco-price-lbl">3-Year Total TCO</div>
                    </div>
                  </div>

                  <div className="cloud-spec-list">
                    <div className="cloud-spec-item">
                      <span className="cloud-spec-label">Compute & Cloud Hosting</span>
                      <span className="cloud-spec-val">${Number(m.hosting_compute_3yr_usd).toLocaleString()}</span>
                    </div>
                    <div className="cloud-spec-item">
                      <span className="cloud-spec-label">Database & Software Licenses</span>
                      <span className="cloud-spec-val" style={{ color: Number(m.database_licensing_3yr_usd) === 0 ? "#059669" : "#dc2626", fontWeight: 700 }}>
                        {Number(m.database_licensing_3yr_usd) === 0 ? "$0 (Open-Source)" : `$${Number(m.database_licensing_3yr_usd).toLocaleString()}`}
                      </span>
                    </div>
                    <div className="cloud-spec-item">
                      <span className="cloud-spec-label">Developer Salaries & Velocity</span>
                      <span className="cloud-spec-val">${Number(m.developer_engineering_3yr_usd).toLocaleString()}</span>
                    </div>
                    <div className="cloud-spec-item">
                      <span className="cloud-spec-label">Enterprise Support Contracts</span>
                      <span className="cloud-spec-val">${Number(m.support_contracts_3yr_usd).toLocaleString()}</span>
                    </div>
                    <div className="cloud-spec-item">
                      <span className="cloud-spec-label">Savings vs Microsoft Enterprise</span>
                      <span className="cloud-spec-val" style={{ color: Number(m.total_savings_vs_proprietary_usd) > 0 ? "#059669" : "#64748b", fontWeight: 800 }}>
                        {Number(m.total_savings_vs_proprietary_usd) > 0 ? `+$${Number(m.total_savings_vs_proprietary_usd).toLocaleString()}` : "$0 Baseline"}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: "0.8rem", color: "#475569", background: "#f8fafc", padding: "0.75rem", borderRadius: "6px" }}>
                    <strong>Key Driver:</strong> {m.notes}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: DYNAMIC WEIGHTING SENSITIVITY SIMULATOR */}
        {activeTab === "simulator" && (
          <div className="stack-card">
            <div className="stack-card-header">
              <div className="stack-card-title-group">
                <h3>Executive Decision Sensitivity Simulator</h3>
                <p>
                  Adjust the weighting of each decision criteria in real-time to simulate how organizational priorities impact the final stack ranking.
                </p>
              </div>
            </div>

            <div className="stack-card-body" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div className="simulator-slider-grid">
                <div className="slider-group">
                  <div className="slider-group-header">
                    <span>Engineering Skills Fit</span>
                    <strong style={{ color: "#0284c7" }}>{weights.skills_weight}%</strong>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    value={weights.skills_weight}
                    onChange={(e) => handleWeightChange("skills_weight", e.target.value)}
                  />
                </div>

                <div className="slider-group">
                  <div className="slider-group-header">
                    <span>Security Standards</span>
                    <strong style={{ color: "#059669" }}>{weights.security_weight}%</strong>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    value={weights.security_weight}
                    onChange={(e) => handleWeightChange("security_weight", e.target.value)}
                  />
                </div>

                <div className="slider-group">
                  <div className="slider-group-header">
                    <span>Enterprise Integrations</span>
                    <strong style={{ color: "#7c3aed" }}>{weights.integrations_weight}%</strong>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    value={weights.integrations_weight}
                    onChange={(e) => handleWeightChange("integrations_weight", e.target.value)}
                  />
                </div>

                <div className="slider-group">
                  <div className="slider-group-header">
                    <span>Total Cost of Ownership</span>
                    <strong style={{ color: "#d97706" }}>{weights.tco_weight}%</strong>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    value={weights.tco_weight}
                    onChange={(e) => handleWeightChange("tco_weight", e.target.value)}
                  />
                </div>
              </div>

              <div style={{ fontWeight: 700, color: "#0f172a" }}>
                Dynamic Re-Ranked Results (Top 12 Evaluated Technologies) {simulating && "(Recalculating...)"}:
              </div>

              <table className="stack-matrix-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Technology</th>
                    <th>Layer</th>
                    <th>Skills Score</th>
                    <th>Security Score</th>
                    <th>Integrations Score</th>
                    <th>TCO Score</th>
                    <th>Custom Weighted Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(simulatedRanking.length > 0 ? simulatedRanking : matrixData).map((tech, idx) => (
                    <tr key={tech.id} className={tech.status === "SELECTED" ? "selected-row" : ""}>
                      <td style={{ fontWeight: 800, color: idx < 3 ? "#0284c7" : "#64748b" }}>#{idx + 1}</td>
                      <td style={{ fontWeight: 700, color: "#0f172a" }}>{tech.technology_name}</td>
                      <td>{tech.layer_category}</td>
                      <td>{tech.skills_fit_score}</td>
                      <td>{tech.security_standards_score}</td>
                      <td>{tech.integrations_score}</td>
                      <td>{tech.tco_cost_score}</td>
                      <td>
                        <span className="score-badge high" style={{ fontSize: "0.95rem" }}>
                          {tech.custom_weighted_score || tech.overall_score}
                        </span>
                      </td>
                      <td>
                        {tech.status === "SELECTED" ? (
                          <span className="badge-selected">SELECTED</span>
                        ) : (
                          <span className="badge-alternative">ALTERNATIVE</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TechStackArchitectureCenter;
