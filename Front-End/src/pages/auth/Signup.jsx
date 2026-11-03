import React from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../../components/auth/AuthLayout";

function Signup() {
  const navigate = useNavigate();

  return (
    <AuthLayout
      title="Employee Account Provisioning"
      subtitle="Corporate Identity & Access Governance"
      footerText="Have questions? Contact HR Operations at hr@company.com"
    >
      <div className="enterprise-provisioning-view" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* Policy Notice Card */}
        <div
          style={{
            background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "20px",
            display: "flex",
            gap: "14px",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "#eff6ff",
              color: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <div>
            <h3 style={{ margin: "0 0 6px 0", fontSize: "0.98rem", fontWeight: 700, color: "#0f172a" }}>
              Self-Registration is Disabled
            </h3>
            <p style={{ margin: 0, fontSize: "0.85rem", lineHeight: 1.55, color: "#475569" }}>
              In compliance with enterprise security policies, employees <strong>cannot manually self-register</strong> accounts.
              All personnel profiles, employee codes, and login credentials are provisioned exclusively by the <strong>Human Resources Department</strong> upon hiring.
            </p>
          </div>
        </div>

        {/* 3-Step Process Explanation */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#64748b" }}>
            How Employee Access Works
          </span>

          <div style={{ display: "grid", gap: "12px" }}>
            {/* Step 1 */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                padding: "12px 14px",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#e0e7ff",
                  color: "#4338ca",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  flexShrink: 0,
                }}
              >
                1
              </div>
              <div style={{ fontSize: "0.84rem", color: "#334155" }}>
                <strong>HR Profile Creation:</strong> HR inputs your official designation, department, reporting manager, and compensation.
              </div>
            </div>

            {/* Step 2 */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                padding: "12px 14px",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#e0e7ff",
                  color: "#4338ca",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  flexShrink: 0,
                }}
              >
                2
              </div>
              <div style={{ fontSize: "0.84rem", color: "#334155" }}>
                <strong>Credentials Issuance:</strong> Your unique Employee ID (e.g. <code>EMP001</code>) and temporary credentials are generated.
              </div>
            </div>

            {/* Step 3 */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                padding: "12px 14px",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#dcfce7",
                  color: "#15803d",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  flexShrink: 0,
                }}
              >
                ✓
              </div>
              <div style={{ fontSize: "0.84rem", color: "#334155" }}>
                <strong>Day 1 Sign In:</strong> Use your HR-issued credentials on the sign-in page to access your employee dashboard.
              </div>
            </div>
          </div>
        </div>

        {/* HR Admin Callout */}
        <div
          style={{
            padding: "12px 16px",
            background: "#f8fafc",
            borderRadius: "10px",
            border: "1px dashed #cbd5e1",
            fontSize: "0.82rem",
            color: "#64748b",
            lineHeight: 1.5,
          }}
        >
          💼 <strong>Are you an HR Administrator?</strong> Please{" "}
          <Link to="/login" style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
            sign in to your HR account
          </Link>{" "}
          and navigate to <strong>Employee Management &gt; Add Employee</strong> or the <strong>Recruitment Onboarding Hub</strong> to provision new staff accounts.
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="auth-submit-btn"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "0.85rem",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: "0.92rem",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
            transition: "all 0.2s ease",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>Return to Sign In</span>
        </button>

      </div>
    </AuthLayout>
  );
}

export default Signup;
