import { useEffect, useMemo, useState } from "react";
import {
  getLeaveTypes,
  approveLeave,
  rejectLeave,
  revertLeave,
} from "../../services/hrService";
import { formatDate } from "../../utils/date";
import "./LeaveManagement.css";

const AVATAR_PALETTES = [
  { bg: "#ede9fe", text: "#6d28d9" },
  { bg: "#e0f2fe", text: "#0369a1" },
  { bg: "#fef3c7", text: "#b45309" },
  { bg: "#fce7f3", text: "#be185d" },
  { bg: "#dcfce7", text: "#15803d" },
  { bg: "#ccfbf1", text: "#0f766e" },
  { bg: "#fee2e2", text: "#b91c1c" },
];

function getColorForString(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

function getInitials(firstName = "", lastName = "") {
  const f = firstName?.[0] || "";
  const l = lastName?.[0] || "";
  return `${f}${l}`.toUpperCase() || "LV";
}

function LeaveManagement({ leaves = [], onChanged }) {
  const [types, setTypes] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionError, setActionError] = useState("");
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    getLeaveTypes()
      .then((response) => setTypes(response.data || []))
      .catch(() => setTypes([]));
  }, []);

  const filteredLeaves = useMemo(() => {
    return leaves.filter((leave) => {
      const currentStatus = String(leave.status || "").toLowerCase();
      const targetStatus = statusFilter.toLowerCase();
      const statusMatches =
        statusFilter === "all" || currentStatus === targetStatus;

      const typeId =
        leave.leaveType?._id || leave.leaveType?.id || leave.leaveType;
      const typeMatches =
        typeFilter === "all" || String(typeId) === String(typeFilter);

      const empName = `${leave.employee?.firstName || ""} ${
        leave.employee?.lastName || ""
      } ${leave.employee?.name || ""} ${leave.employee?.email || ""}`.toLowerCase();
      const reason = (leave.reason || "").toLowerCase();
      const query = searchTerm.trim().toLowerCase();
      const searchMatches =
        !query || empName.includes(query) || reason.includes(query);

      return statusMatches && typeMatches && searchMatches;
    });
  }, [leaves, statusFilter, typeFilter, searchTerm]);

  const history = useMemo(
    () =>
      filteredLeaves.filter((leave) =>
        ["approved", "rejected", "cancelled"].includes(
          String(leave.status || "").toLowerCase()
        )
      ),
    [filteredLeaves]
  );

function ApprovalFlowBadge({ status }) {
  const normStatus = String(status || "").toLowerCase();
  
  if (normStatus === "pending manager" || normStatus === "pending_manager" || normStatus === "pending") {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", background: "#fef3c7", color: "#92400e", padding: "3px 10px", borderRadius: "12px", fontWeight: 600 }}>
        <span>👤 Employee</span> ➔ <span style={{ textDecoration: "underline" }}>⌛ Manager Review</span> ➔ <span>🏢 HR Final</span>
      </div>
    );
  }
  
  if (normStatus === "pending hr" || normStatus === "pending_hr") {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", background: "#e0f2fe", color: "#0369a1", padding: "3px 10px", borderRadius: "12px", fontWeight: 600 }}>
        <span>👤 Employee</span> ➔ <span>✓ Manager Approved</span> ➔ <span style={{ textDecoration: "underline" }}>⌛ HR Final Review</span>
      </div>
    );
  }

  if (normStatus === "approved") {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", background: "#dcfce7", color: "#166534", padding: "3px 10px", borderRadius: "12px", fontWeight: 600 }}>
        <span>👤 Employee</span> ➔ <span>✓ Manager</span> ➔ <span>✓ HR Approved</span> 🎉
      </div>
    );
  }

  if (normStatus === "rejected") {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", background: "#fee2e2", color: "#991b1b", padding: "3px 10px", borderRadius: "12px", fontWeight: 600 }}>
        <span>✕ Rejected</span>
      </div>
    );
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", background: "#f1f5f9", color: "#475569", padding: "3px 10px", borderRadius: "12px", fontWeight: 600 }}>
      <span>⌛ Pending Approval</span>
    </div>
  );
}

  const pending = useMemo(
    () =>
      filteredLeaves.filter((leave) =>
        ["pending", "pending manager", "pending hr", "pending_manager", "pending_hr"].includes(
          String(leave.status || "").toLowerCase()
        )
      ),
    [filteredLeaves]
  );

  const balance = useMemo(() => {
    return types.map((type) => {
      const used = leaves
        .filter((leave) => {
          const leaveTypeId =
            leave.leaveType?._id || leave.leaveType?.id || leave.leaveType;
          return (
            String(leaveTypeId) === String(type._id) &&
            String(leave.status || "").toLowerCase() === "approved"
          );
        })
        .reduce((total, leave) => total + Number(leave.numberOfDays || 0), 0);
      const allocation = Number(type.annualAllocation || 0);
      const available = Math.max(allocation - used, 0);
      const pct =
        allocation > 0
          ? Math.min(100, Math.round((used / allocation) * 100))
          : 0;
      return {
        ...type,
        available,
        used,
        pct,
      };
    });
  }, [types, leaves]);

  const act = async (leaveId, action) => {
    setActionError("");
    try {
      setProcessingId(leaveId);
      if (action === "approve") {
        await approveLeave(leaveId);
      }
      if (action === "reject") {
        const reason = window.prompt("Why is this leave being rejected?");
        if (!reason?.trim()) return;
        await rejectLeave(leaveId, reason.trim());
      }
      if (action === "revert") {
        await revertLeave(leaveId);
      }
      if (onChanged) {
        await onChanged();
      }
    } catch (error) {
      setActionError(error.message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <section className="leave-management">
      {/* Header and Filter Row */}
      <div className="leave-panel-header">
        <div>
          <h2>Leave Management & Approvals</h2>
          <p>Review employee requests, company allocations, and approval history.</p>
        </div>

        <div className="leave-filters-row">
          {/* Instant Search Box */}
          <div className="leave-search-wrap">
            <svg
              className="leave-search-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="leave-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search employee or reason..."
              aria-label="Search leave requests"
            />
            {searchTerm && (
              <button
                type="button"
                className="leave-search-clear"
                onClick={() => setSearchTerm("")}
              >
                ×
              </button>
            )}
          </div>

          <select
            className="leave-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by leave status"
          >
            <option value="all">All Statuses</option>
            <option value="Pending">Pending Review</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select
            className="leave-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by leave type"
          >
            <option value="all">All Leave Types</option>
            {types.map((type) => (
              <option key={type._id} value={type._id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {actionError && (
        <div className="hr-inline-error" role="alert">
          ⚠️ {actionError}
        </div>
      )}

      {/* Leave Balance Overview Cards */}
      {balance.length > 0 && (
        <div className="leave-balance-grid">
          {balance.map((type) => (
            <div className="leave-balance-card" key={type._id}>
              <span className="leave-type-name">{type.name}</span>
              <strong className="leave-days-count">{type.available}</strong>
              <small className="leave-days-meta">
                {type.used || 0} used of {type.annualAllocation || 0} total days
              </small>
              <div className="leave-progress-track">
                <div
                  className="leave-progress-bar"
                  style={{ width: `${type.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending Requests Section */}
      <div className="leave-section-title-row">
        <h3 className="leave-section-title">
          <span>⏳</span> Pending Review
        </h3>
        {pending.length > 0 && (
          <span className="pending-counter-badge">
            {pending.length} Action Needed
          </span>
        )}
      </div>

      <div className="pending-leaves-list">
        {pending.length === 0 ? (
          <div className="empty-state-box">
            <span>🎉</span>
            <p>No pending leave requests at this time. All caught up!</p>
          </div>
        ) : (
          pending.map((leave) => {
            const isProcessing = processingId === leave._id;
            const empName = `${leave.employee?.firstName || ""} ${
              leave.employee?.lastName || ""
            }`.trim() || leave.employee?.name || leave.employee?.email || "Employee";
            const initials = getInitials(
              leave.employee?.firstName,
              leave.employee?.lastName
            );
            const palette = getColorForString(empName);

            return (
              <div className="pending-leave-card" key={leave._id}>
                <div className="pending-card-main">
                  <div
                    className="applicant-avatar"
                    style={{ backgroundColor: palette.bg, color: palette.text }}
                  >
                    {initials}
                  </div>
                  <div className="applicant-info">
                    <div className="applicant-name-row" style={{ flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                      <strong className="applicant-name">{empName}</strong>
                      <span className="leave-badge">
                        {leave.leaveType?.name || "Leave"}
                      </span>
                      <ApprovalFlowBadge status={leave.status} />
                      <span className="leave-dates-text">
                        📅 {formatDate(leave.startDate)} to{" "}
                        {formatDate(leave.endDate)} ({leave.numberOfDays || 1}{" "}
                        days)
                      </span>
                    </div>
                    {leave.reason ? (
                      <p className="leave-reason-quote">
                        &ldquo;{leave.reason}&rdquo;
                      </p>
                    ) : (
                      <small style={{ color: "#94a3b8" }}>
                        No reason specified
                      </small>
                    )}
                  </div>
                </div>

                <div className="pending-actions-wrap">
                  <button
                    type="button"
                    className="btn-approve"
                    disabled={isProcessing}
                    onClick={() => act(leave._id, "approve")}
                  >
                    {isProcessing ? (
                      "Saving..."
                    ) : (
                      <>
                        <span>✓</span> Approve
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn-reject"
                    disabled={isProcessing}
                    onClick={() => act(leave._id, "reject")}
                  >
                    {isProcessing ? (
                      "Saving..."
                    ) : (
                      <>
                        <span>✕</span> Reject
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Approval History Section */}
      <div className="leave-section-title-row">
        <h3 className="leave-section-title">
          <span>📋</span> Approval History
        </h3>
      </div>

      <div className="history-table-wrap">
        <table className="history-modern-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Leave Type</th>
              <th>Duration</th>
              <th>Days</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td
                  colSpan="6"
                  style={{
                    textAlign: "center",
                    padding: "3rem 1rem",
                    color: "#64748b",
                  }}
                >
                  No leave records matching the selected status or type.
                </td>
              </tr>
            ) : (
              history.map((leave) => {
                const empName = `${leave.employee?.firstName || ""} ${
                  leave.employee?.lastName || ""
                }`.trim() || leave.employee?.name || leave.employee?.email || "Employee";
                const status = String(leave.status).toLowerCase();
                const canRevert = ["approved", "rejected"].includes(status);
                const palette = getColorForString(empName);

                return (
                  <tr key={leave._id}>
                    <td>
                      <div className="history-emp-cell">
                        <div
                          className="history-avatar-mini"
                          style={{
                            backgroundColor: palette.bg,
                            color: palette.text,
                          }}
                        >
                          {getInitials(
                            leave.employee?.firstName,
                            leave.employee?.lastName
                          )}
                        </div>
                        <strong className="history-emp-name">{empName}</strong>
                      </div>
                    </td>
                    <td>
                      <span className="leave-badge">
                        {leave.leaveType?.name || "Leave"}
                      </span>
                    </td>
                    <td>
                      <span className="duration-chip">
                        {formatDate(leave.startDate)} &rarr;{" "}
                        {formatDate(leave.endDate)}
                      </span>
                    </td>
                    <td>
                      <span className="days-pill">
                        {leave.numberOfDays || 1}d
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${status}`}>
                        <span className="pulse-dot" />
                        {leave.status}
                      </span>
                    </td>
                    <td>
                      {canRevert && (
                        <button
                          type="button"
                          className="btn-revert"
                          disabled={processingId === leave._id}
                          onClick={() => act(leave._id, "revert")}
                        >
                          {processingId === leave._id ? "Reverting..." : "Revert"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default LeaveManagement;
