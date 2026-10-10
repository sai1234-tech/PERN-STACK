import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { normalizeRole } from "../../utils/auth";
import "./AppFooter.css";

function AppFooter() {
  const { user } = useAuth();
  const role = normalizeRole(user);
  const isHrOrAdmin = role === "hr" || role === "admin";

  const currentYear = new Date().getFullYear();

  return (
    <footer className="hrms-app-footer" aria-label="Corporate Application Footer">
      <div className="footer-top-grid">
        {/* Brand Column */}
        <div className="footer-brand-col">
          <div className="footer-brand-header">
            <div className="footer-logo-box">QS</div>
            <div>
              <h3 className="footer-company-name">Quadratic Systems Inc</h3>
              <p className="footer-subtitle">Enterprise Human Resource Management System</p>
            </div>
          </div>
          <p className="footer-tagline">
            Empowering modern workforce operations, real-time attendance telemetry, global payroll, and corporate organizational alignment.
          </p>
          <div className="footer-badges-cluster">
            <span className="footer-badge live">
              <span className="footer-live-dot" /> Telemetry Active
            </span>
            <span className="footer-badge sec">🔒 256-bit SSL Encrypted</span>
            <span className="footer-badge ver">v3.4.0 Enterprise</span>
          </div>
        </div>

        {/* Quick Nav Column 1: Core Portal */}
        <div className="footer-links-col">
          <h4 className="footer-col-title">Core Portal</h4>
          <ul className="footer-links-list">
            <li><Link to="/employee/dashboard">Overview & Dashboard</Link></li>
            <li><Link to="/employee/attendance">Daily Attendance Logs</Link></li>
            <li><Link to="/employee/leaves">Leaves & WFH Hub</Link></li>
            <li><Link to="/employee/timesheets">Project Timesheets</Link></li>
            <li><Link to="/employee/payroll">My Payroll & Payslips</Link></li>
          </ul>
        </div>

        {/* Quick Nav Column 2: Enterprise Vault & Operations */}
        <div className="footer-links-col">
          <h4 className="footer-col-title">Enterprise Services</h4>
          <ul className="footer-links-list">
            <li><Link to="/employee/documents">Document Vault</Link></li>
            <li><Link to={isHrOrAdmin ? "/hr/employees" : "/organization"}>Workforce Directory</Link></li>
            <li><Link to="/organization">Org Hierarchy Flow</Link></li>
            {isHrOrAdmin && (
              <>
                <li><Link to="/hr/dashboard">HR Command Control</Link></li>
                <li><Link to="/admin/accounts">Security Accounts</Link></li>
              </>
            )}
          </ul>
        </div>

        {/* Compliance & Support Column */}
        <div className="footer-links-col">
          <h4 className="footer-col-title">Security & Compliance</h4>
          <ul className="footer-links-list">
            <li><span className="footer-static-link">SOC 2 Type II Certified</span></li>
            <li><span className="footer-static-link">GDPR & ISO 27001 Compliant</span></li>
            <li><span className="footer-static-link">IST Official Corporate Time</span></li>
            <li><span className="footer-static-link">Support: hrms-support@quadratics.com</span></li>
          </ul>
        </div>
      </div>

      {/* Bottom Legal & Copyright Bar */}
      <div className="footer-bottom-bar">
        <div className="footer-bottom-left">
          <span>© {currentYear} Quadratic Systems Inc (QSI). All rights reserved.</span>
          <span className="footer-dot">•</span>
          <span>Official Corporate Portal</span>
        </div>
        <div className="footer-bottom-right">
          <span className="node-pill">Server Node: HYD-HQ-AP14</span>
          <span className="ping-pill">🟢 Latency: 12ms</span>
        </div>
      </div>
    </footer>
  );
}

export default AppFooter;
