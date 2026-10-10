import { useState } from "react";
import "./ManagerApprovalsWidget.css";

const MOCK_TEAM_APPROVALS = [];

export default function ManagerApprovalsWidget() {
  const [approvals, setApprovals] = useState([]);

  const handleAction = (id, actionType) => {
    // In a real app, this would call an API like `/api/v1/leaves/${id}/approve`
    // For now, we mock the UI update to demonstrate the manager experience
    setApprovals(prev => prev.filter(req => req.id !== id));
  };

  if (approvals.length === 0) {
    return (
      <div className="manager-widget-container">
        <div className="manager-empty-state">
          <div className="manager-empty-icon">✨</div>
          <h4>You're all caught up!</h4>
          <p>There are no pending requests from your direct reports.</p>
        </div>
      </div>
    );
  }

  const leaveCount = approvals.filter(a => a.type === "leave").length;
  const timesheetCount = approvals.filter(a => a.type === "timesheet").length;

  return (
    <div className="manager-widget-container">
      <div className="manager-widget-header">
        <div>
          <h3>My Team & Approvals</h3>
          <p>Review and manage requests from your direct reports.</p>
        </div>
        <div className="manager-stats-row">
          {leaveCount > 0 && (
            <div className="manager-stat-pill urgent">
              <span>Leave Requests</span>
              <span className="stat-val">{leaveCount}</span>
            </div>
          )}
          {timesheetCount > 0 && (
            <div className="manager-stat-pill">
              <span>Timesheets</span>
              <span className="stat-val">{timesheetCount}</span>
            </div>
          )}
        </div>
      </div>

      <div className="approvals-grid">
        {approvals.map((req) => (
          <div key={req.id} className={`approval-card type-${req.type}`}>
            <div className="card-top-row">
              <div className="employee-mini-profile">
                <div className="emp-avatar">{req.initials}</div>
                <div className="emp-info">
                  <span className="emp-name">{req.employeeName}</span>
                  <span className="emp-role">{req.role}</span>
                </div>
              </div>
              <span className={`req-badge ${req.type}`}>
                {req.type === "leave" ? "Time Off" : "Timesheet"}
              </span>
            </div>

            <div className="card-details-box">
              {req.type === "leave" ? (
                <>
                  <div className="detail-row">
                    <span className="detail-label">Type</span>
                    <span className="detail-val">{req.details.type}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Duration</span>
                    <span className="detail-val">{req.details.duration}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Dates</span>
                    <span className="detail-val">{req.details.dates}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="detail-row">
                    <span className="detail-label">Project</span>
                    <span className="detail-val">{req.details.project}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Hours</span>
                    <span className="detail-val">{req.details.hours}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Period</span>
                    <span className="detail-val">{req.details.period}</span>
                  </div>
                </>
              )}
              <div className="detail-reason">
                "{req.details.reason}"
              </div>
            </div>

            <div className="card-actions-row">
              <button 
                className="action-btn reject"
                onClick={() => handleAction(req.id, "reject")}
                title="Reject Request"
              >
                ✕ Decline
              </button>
              <button 
                className="action-btn approve"
                onClick={() => handleAction(req.id, "approve")}
                title="Approve Request"
              >
                ✓ Approve
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
