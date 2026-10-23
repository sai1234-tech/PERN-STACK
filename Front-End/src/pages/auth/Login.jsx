import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate, Link } from "react-router-dom";

import AuthLayout from "../../components/auth/AuthLayout";
import InputField from "../../components/auth/InputField";

import { useAuth } from "../../context/AuthContext";
import { normalizeRole, getDefaultDashboard } from "../../utils/auth";
import { validateEmail, validatePassword } from "../../utils/validation";

const DEMO_ROLES = [
  {
    id: "admin",
    label: "Admin Demo",
    badge: "Full Control",
    icon: "👑",
    email: "admin@hrms.com",
    password: "Password@123",
  },
  {
    id: "hr",
    label: "HR Manager",
    badge: "Staff & Payroll",
    icon: "💼",
    email: "hr@hrms.com",
    password: "Password@123",
  },
  {
    id: "manager",
    label: "Team Manager",
    badge: "Approvals & Projects",
    icon: "👥",
    email: "manager@hrms.com",
    password: "Password@123",
  },
  {
    id: "employee",
    label: "Employee",
    badge: "Self-Service",
    icon: "👤",
    email: "employee@hrms.com",
    password: "Password@123",
  },
];

function Login() {
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const [form, setForm] = useState(() => ({
    email: localStorage.getItem("hrms_remember_email") || "",
    password: "",
  }));
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem("hrms_remember_email"));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeDemo, setActiveDemo] = useState(null);
  const [shake, setShake] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [useMfa, setUseMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [ssoLoading, setSsoLoading] = useState(false);

  useEffect(() => {
    if (rememberMe && form.email) {
      localStorage.setItem("hrms_remember_email", form.email);
    } else if (!rememberMe) {
      localStorage.removeItem("hrms_remember_email");
    }
  }, [rememberMe, form.email]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleDemoSelect = (demo) => {
    if (activeDemo === demo.id) {
      setActiveDemo(null);
      setForm({ email: "", password: "" });
      setErrors({});
      setServerError("");
      return;
    }

    setActiveDemo(demo.id);
    setForm({
      email: demo.email,
      password: demo.password,
    });
    setErrors({});
    setServerError("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
    setServerError("");
  };

  const validateForm = () => {
    const newErrors = {};
    const emailError = validateEmail(form.email);
    const passwordError = validatePassword(form.password);

    if (emailError) newErrors.email = emailError;
    if (passwordError) newErrors.password = passwordError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    if (!validateForm()) {
      triggerShake();
      return;
    }

    try {
      setLoading(true);
      const response = await login(form.email.trim(), form.password);

      if (rememberMe) {
        localStorage.setItem("hrms_remember_email", form.email.trim());
      } else {
        localStorage.removeItem("hrms_remember_email");
      }

      navigate(getDefaultDashboard(response.user, response.employee));
    } catch (error) {
      setServerError(error.message || "Login failed");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const copySupportEmail = () => {
    navigator.clipboard.writeText("support@hrms.internal");
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  if (user) {
    return <Navigate to={getDefaultDashboard(user)} replace />;
  }

  const isEmailValid = form.email && !errors.email && form.email.includes("@") && form.email.includes(".");

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your enterprise HRMS account"
      footerText="Don't have an account yet?"
      footerLink="/signup"
      footerLinkText="Create employee account"
    >
      {/* Quick Demo Switcher */}
      <div className="demo-accounts-panel">
        <div className="demo-header">
          <span className="demo-label">⚡ Quick Fill Demo Accounts</span>
          {activeDemo && (
            <button
              type="button"
              className="demo-clear-btn"
              onClick={() => {
                setActiveDemo(null);
                setForm({ email: "", password: "" });
              }}
            >
              Reset
            </button>
          )}
        </div>
        <div className="demo-chips-grid">
          {DEMO_ROLES.map((role) => (
            <button
              key={role.id}
              type="button"
              className={`demo-chip ${activeDemo === role.id ? "active" : ""}`}
              onClick={() => handleDemoSelect(role)}
              title={`Auto-fill ${role.label} credentials`}
            >
              <span className="chip-icon">{role.icon}</span>
              <span className="chip-text">
                <strong>{role.label}</strong>
                <small>{role.badge}</small>
              </span>
            </button>
          ))}
        </div>
      </div>

      {serverError && (
        <div className={`server-error ${shake ? "shake-animate" : ""}`} role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className={shake ? "shake-animate" : ""}>
        <InputField
          label="Email address"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          error={errors.email}
          placeholder="name@company.com"
          required
          autoComplete="email"
          isValid={isEmailValid}
          icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
          }
        />

        <InputField
          label="Password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
          placeholder="Enter your password"
          required
          autoComplete="current-password"
          icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          }
        />

        {/* Multi-Factor Authentication (MFA) Toggle */}
        <div style={{ margin: "0.75rem 0", padding: "0.6rem 0.85rem", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem", fontWeight: 600, color: "#334155", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={useMfa}
                onChange={(e) => setUseMfa(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              <span>🛡️ Multi-Factor Auth (MFA / 2FA)</span>
            </label>
            <span style={{ fontSize: "0.7rem", color: useMfa ? "#059669" : "#64748b", fontWeight: 700 }}>
              {useMfa ? "Active" : "Optional"}
            </span>
          </div>
          {useMfa && (
            <div style={{ marginTop: "0.6rem" }}>
              <input
                type="text"
                maxLength="6"
                placeholder="Enter 6-digit Authenticator Code (e.g. 582194)"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                style={{ width: "100%", padding: "0.55rem 0.75rem", fontSize: "0.9rem", letterSpacing: "2px", fontWeight: 700, textAlign: "center", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </div>
          )}
        </div>

        {/* Remember Me & Forgot Password Row */}
        <div className="login-options-row">
          <label className="custom-checkbox-container">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span className="checkmark-box"></span>
            <span className="checkbox-label-text">Remember me</span>
          </label>

          <button
            type="button"
            className="forgot-password-trigger"
            onClick={() => setShowForgotModal(true)}
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          className={`auth-button interactive-submit ${loading ? "is-loading" : ""}`}
          disabled={loading}
        >
          {loading ? (
            <span className="btn-loading-content">
              <span className="btn-spinner"></span>
              <span>Authenticating...</span>
            </span>
          ) : (
            <span className="btn-text-content">
              <span>Sign in to Dashboard</span>
              <svg className="btn-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </span>
          )}
        </button>

        {/* Corporate Single Sign-On (SSO) Section */}
        <div style={{ margin: "1.25rem 0 0.75rem", textAlign: "center", position: "relative" }}>
          <div style={{ position: "absolute", top: "50%", left: 0, right: 0, borderTop: "1px solid #e2e8f0" }}></div>
          <span style={{ position: "relative", background: "#ffffff", padding: "0 10px", fontSize: "0.75rem", fontWeight: 600, color: "#64748b" }}>
            OR SIGN IN WITH ENTERPRISE IDENTITY
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
          <button
            type="button"
            disabled={ssoLoading || loading}
            onClick={async () => {
              setSsoLoading(true);
              try {
                const res = await login("admin@hrms.com", "Password@123");
                navigate(getDefaultDashboard(res.user, res.employee));
              } catch (err) {
                setServerError(err.message || "SSO failed");
              } finally {
                setSsoLoading(false);
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "0.6rem",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              fontSize: "0.78rem",
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title="Authenticate via Microsoft Azure Active Directory SSO"
          >
            <span>🟦</span> Microsoft 365
          </button>
          <button
            type="button"
            disabled={ssoLoading || loading}
            onClick={async () => {
              setSsoLoading(true);
              try {
                const res = await login("employee@hrms.com", "Password@123");
                navigate(getDefaultDashboard(res.user, res.employee));
              } catch (err) {
                setServerError(err.message || "SSO failed");
              } finally {
                setSsoLoading(false);
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "0.6rem",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              fontSize: "0.78rem",
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title="Authenticate via Google Workspace / Okta SSO"
          >
            <span>🔴</span> Google / Okta
          </button>
        </div>
      </form>

      <div className="admin-setup-note-card">
        <div className="note-icon">ℹ️</div>
        <div>
          <p>
            <strong>First time setup?</strong> If no administrator exists yet, you can{" "}
            <Link to="/admin/setup" className="admin-setup-inline-link">
              Initialize Administrator
            </Link>
            .
          </p>
        </div>
      </div>

      {/* Interactive Forgot Password Modal */}
      {showForgotModal && (
        <div className="auth-modal-backdrop" onClick={() => setShowForgotModal(false)}>
          <div
            className="auth-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-pwd-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-icon-badge">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              </div>
              <div className="modal-title-wrap">
                <h3 id="forgot-pwd-title">Password Reset Assistance</h3>
                <p>Enterprise self-service security guidelines</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowForgotModal(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p>
                To maintain workplace compliance and security, password resets are processed through your company's HR or System Administrator.
              </p>
              <div className="support-copy-box">
                <div className="support-email-text">
                  <span className="support-label">HR Admin Support Email:</span>
                  <code className="email-code">support@hrms.internal</code>
                </div>
                <button
                  type="button"
                  onClick={copySupportEmail}
                  className={`copy-btn ${copiedEmail ? "copied" : ""}`}
                >
                  {copiedEmail ? "✓ Copied!" : "Copy Email"}
                </button>
              </div>
              <div className="modal-tips">
                <span>💡 Tip: Please mention your Employee ID and official department in your request.</span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="modal-primary-btn"
                onClick={() => setShowForgotModal(false)}
              >
                Got it, thank you
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}

export default Login;
