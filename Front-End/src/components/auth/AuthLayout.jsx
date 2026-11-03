import React, { useEffect } from 'react';
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

  // The login and authentication layout strictly maintains light mode aesthetic
  useEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.getAttribute("data-theme") || "light";
    root.setAttribute("data-theme", "light");

    return () => {
      // When leaving auth views, restore the user's dashboard theme preference
      try {
        const savedTheme = localStorage.getItem("hrms_theme") || previousTheme;
        root.setAttribute("data-theme", savedTheme);
      } catch {
        root.setAttribute("data-theme", previousTheme);
      }
    };
  }, []);

  return (
    <div className="auth-page" data-theme="light">
      {/* Dynamic ambient floating gradient orbs */}
      <div className="auth-ambient-mesh" aria-hidden="true">
        <div className="ambient-orb orb-1"></div>
        <div className="ambient-orb orb-2"></div>
        <div className="ambient-orb orb-3"></div>
        <div className="ambient-orb orb-4"></div>
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

        {/* Main Card */}
        <div className="auth-card">
          <div className="auth-header">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="auth-content">
            {children}
          </div>

          {(footerText || footerLink) && (
            <div className="auth-footer">
              {footerText && <span>{footerText}</span>}
              {footerLink && (
                <Link to={footerLink} className="footer-action-link">
                  {footerLinkText || "Learn More"}
                </Link>
              )}
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
