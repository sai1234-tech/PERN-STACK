import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate, Link } from "react-router-dom";

import AuthLayout from "../../components/auth/AuthLayout";
import InputField from "../../components/auth/InputField";

import { useAuth } from "../../context/AuthContext";
import { normalizeRole } from "../../utils/auth";
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

      const role = normalizeRole(response.user);
      if (role === "admin") {
        navigate("/admin/dashboard");
      } else if (role === "hr") {
        navigate("/hr/dashboard");
      } else if (role === "manager") {
        navigate("/manager/dashboard");
      } else {
        navigate("/employee/dashboard");
      }
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
    const role = normalizeRole(user);
    if (role === "admin") return <Navigate to="/admin/dashboard" replace />;
    if (role === "hr") return <Navigate to="/hr/dashboard" replace />;
    if (role === "manager") return <Navigate to="/manager/dashboard" replace />;
    return <Navigate to="/employee/dashboard" replace />;
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
