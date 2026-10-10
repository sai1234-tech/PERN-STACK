import React from 'react';
import { Link, useLocation } from "react-router-dom";

function AuthLayout({
  title,
  subtitle,
  children,
  footerText,
  footerLink,
  footerLinkText,
  badgeText = "Enterprise Edition",
}) {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div className="auth-page">
      {/* Dynamic ambient floating gradient orbs */}
      <div className="auth-ambient-mesh" aria-hidden="true">
        <div className="ambient-orb orb-1"></div>
        <div className="ambient-orb orb-2"></div>
        <div className="ambient-orb orb-3"></div>
      </div>

      <div className="auth-container">
        {/* Brand Header */}
        <header className="auth-brand">
          <Link to="/login" className="brand-logo-link">
            <div className="brand-logo">
              <span>H</span>
            </div>
            <div className="brand-info">
              <div className="brand-title-row">
                <h2>HRMS</h2>
                <span className="brand-badge">{badgeText}</span>
              </div>
              <span className="brand-subtitle">Human Resource Management Suite</span>
            </div>
          </Link>
          
          <div className="system-status-pill">
            <span className="status-dot"></span>
            <span>System Online</span>
          </div>
        </header>

        {/* Auth Switcher Tab (Sign In / Sign Up) */}
        <div className="auth-mode-switcher">
          <Link
            to="/login"
            className={`mode-tab ${currentPath === "/login" ? "active" : ""}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
              <polyline points="10 17 15 12 10 7"></polyline>
              <line x1="15" y1="12" x2="3" y2="12"></line>
            </svg>
            <span>Sign In</span>
          </Link>
          <Link
            to="/signup"
            className={`mode-tab ${currentPath === "/signup" ? "active" : ""}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
            <span>Create Account</span>
          </Link>
        </div>

        {/* Main Card */}
        <div className="auth-card">
          <div className="auth-header">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="auth-content">
            {children}
          </div>

          {footerText && footerLink && (
            <div className="auth-footer">
              <span>{footerText}</span>
              <Link to={footerLink} className="footer-action-link">
                {footerLinkText}
              </Link>
            </div>
          )}
        </div>

        {/* Security & Compliance Trust Badges */}
        <div className="auth-trust-bar">
          <div className="trust-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>256-Bit SSL Encrypted</span>
          </div>
          <span className="trust-divider">•</span>
          <div className="trust-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <span>ISO 27001 Certified</span>
          </div>
          <span className="trust-divider">•</span>
          <div className="trust-item">
            <span>SOC-2 Compliant</span>
          </div>
        </div>

        <p className="copyright">
          © {new Date().getFullYear()} HRMS Portal. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default AuthLayout;
