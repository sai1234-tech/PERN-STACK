import { useState, useEffect } from "react";
import { getPulseAnalytics } from "../../services/pulseService";
import Loader from "../common/Loader";
import { formatPhotoUrl } from "../../utils/photo";
import "./EmployeeEngagementAnalytics.css";

export function EmployeeEngagementAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await getPulseAnalytics();
        if (res?.data) {
          setData(res.data);
        }
      } catch (err) {
        console.error("Failed to load pulse analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  if (loading) {
    return <Loader label="Loading Engagement Analytics..." />;
  }

  const analytics = data || {
    todaysResponses: 0,
    totalEmployees: 0,
    averagePulseScore: 0,
    responseRate: 0,
    weeklyTrend: [],
    departmentComparison: [],
    recentResponses: [],
  };

  return (
    <div className="engagement-analytics-container">
      {/* Header Banner */}
      <div className="engagement-header-bar">
        <div>
          <h2>Employee Engagement & Daily Pulse</h2>
          <p>Real-time workforce workload health, response rate, and team sentiment trend.</p>
        </div>
        <span className="live-pulse-badge">
          <span className="pulse-dot-green" /> Realtime Pulse Feed
        </span>
      </div>

      {/* Analytics KPI Row */}
      <div className="engagement-kpi-grid">
        <div className="engagement-kpi-card">
          <span className="eng-kpi-label">TODAY'S RESPONSES</span>
          <div className="eng-kpi-val">{analytics.todaysResponses}</div>
          <span className="eng-kpi-sub">{analytics.totalEmployees} Active Workforce</span>
        </div>

        <div className="engagement-kpi-card">
          <span className="eng-kpi-label">AVERAGE PULSE SCORE</span>
          <div className="eng-kpi-val text-amber">
            {analytics.averagePulseScore > 0 ? analytics.averagePulseScore : "--"} <small>/ 5.0</small>
          </div>
          <span className="eng-kpi-sub text-emerald">
            {analytics.averagePulseScore >= 4
              ? "⭐ Workload Manageable"
              : analytics.averagePulseScore > 0
              ? "⚡ Moderate Workload"
              : "Awaiting Pulses"}
          </span>
        </div>

        <div className="engagement-kpi-card">
          <span className="eng-kpi-label">RESPONSE RATE</span>
          <div className="eng-kpi-val text-indigo">{analytics.responseRate}%</div>
          <span className="eng-kpi-sub text-sky">
            {analytics.responseRate >= 70
              ? "🎯 High Participation"
              : analytics.responseRate > 0
              ? "📈 Active Polling"
              : "No Responses Yet"}
          </span>
        </div>

        <div className="engagement-kpi-card">
          <span className="eng-kpi-label">ENGAGEMENT STATUS</span>
          <div className="eng-kpi-val text-emerald" style={{ fontSize: "1.35rem" }}>
            {analytics.todaysResponses > 0 ? "🟢 Live Feed" : "⚪ Awaiting Check-ins"}
          </div>
          <span className="eng-kpi-sub">
            {analytics.todaysResponses > 0 ? "Real-time responses synced" : "Shift responses pending"}
          </span>
        </div>
      </div>

      {/* Main Grid: Weekly Trend + Department Comparison */}
      <div className="engagement-charts-grid">
        {/* Weekly Trend Card */}
        <div className="engagement-card-box">
          <div className="eng-card-header">
            <h4>Weekly Trend (Last 7 Days)</h4>
            <span className="sub-tag">Daily Avg Score</span>
          </div>

          <div className="weekly-trend-bars">
            {analytics.weeklyTrend && analytics.weeklyTrend.length > 0 ? (
              analytics.weeklyTrend.map((day, idx) => {
                const heightPct = Math.round((day.avgScore / 5) * 100);

                return (
                  <div key={idx} className="trend-bar-col">
                    <span className="bar-val-text">{day.avgScore > 0 ? day.avgScore : "--"}</span>
                    <div className="bar-rail">
                      <div
                        className="bar-fill"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="bar-day-text">{day.dayName}</span>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: "1.5rem", textAlign: "center", color: "#64748b", width: "100%" }}>
                No weekly telemetry recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Department Comparison Card */}
        <div className="engagement-card-box">
          <div className="eng-card-header">
            <h4>Department Comparison</h4>
            <span className="sub-tag">Avg Rating per Dept</span>
          </div>

          <div className="dept-comp-list">
            {analytics.departmentComparison && analytics.departmentComparison.length > 0 ? (
              analytics.departmentComparison.map((dept, idx) => {
                const pct = Math.round((dept.avgScore / 5) * 100);

                return (
                  <div key={idx} className="dept-comp-item">
                    <div className="dept-comp-meta">
                      <span className="dept-name-text">{dept.department}</span>
                      <span className="dept-score-val">{dept.avgScore} / 5.0 ({dept.count} votes)</span>
                    </div>
                    <div className="dept-progress-rail">
                      <div className="dept-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: "1.5rem", textAlign: "center", color: "#64748b" }}>
                No department pulse responses recorded today yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Employee Pulse Submissions Audit Roster */}
      <div className="engagement-card-box" style={{ marginTop: "0.5rem" }}>
        <div className="eng-card-header" style={{ marginBottom: "0.75rem" }}>
          <div>
            <h4 style={{ fontSize: "1.1rem" }}>Employee Pulse Responses & Feedback Feed</h4>
            <span className="sub-tag">Identifies which employee submitted what rating score & comment</span>
          </div>
          <span className="sub-tag" style={{ fontWeight: 700, color: "#3b82f6" }}>
            {analytics.recentResponses?.length || 0} Submissions Recorded
          </span>
        </div>

        {analytics.recentResponses && analytics.recentResponses.length > 0 ? (
          <div className="pulse-roster-table-wrap">
            <table className="pulse-roster-table">
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Employee Code</th>
                  <th>Department</th>
                  <th>Workload Rating</th>
                  <th>Feedback / Comment</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {analytics.recentResponses.map((item, idx) => {
                  const initial = (item.firstName?.charAt(0) || item.employeeName?.charAt(0) || "E").toUpperCase();
                  const scoreColor = item.score >= 4 ? "#10b981" : item.score === 3 ? "#d97706" : "#ef4444";

                  return (
                    <tr key={item.id || idx}>
                      <td>
                        <div className="pulse-user-cell">
                          <div className="pulse-user-avatar">
                            {item.profilePhoto ? (
                              <img 
                                src={formatPhotoUrl(item.profilePhoto)} 
                                alt={item.employeeName}
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  const fallback = e.currentTarget.nextElementSibling;
                                  if (fallback) fallback.style.display = "inline";
                                }}
                              />
                            ) : null}
                            <span style={{ display: item.profilePhoto ? "none" : "inline" }}>{initial}</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span className="pulse-user-name">{item.employeeName}</span>
                            <span className="pulse-user-sub">{item.designation}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: "monospace", color: "#64748b" }}>{item.employeeCode}</td>
                      <td>{item.department}</td>
                      <td>
                        <span 
                          className="pulse-score-pill"
                          style={{ background: `${scoreColor}15`, color: scoreColor, border: `1px solid ${scoreColor}40` }}
                        >
                          Score {item.score} / 5 {item.score >= 4 ? "🙂 Optimal" : item.score === 3 ? "😐 Moderate" : "😫 Heavy"}
                        </span>
                      </td>
                      <td style={{ fontStyle: item.feedback ? "normal" : "italic", color: item.feedback ? "#334155" : "#94a3b8" }}>
                        "{item.feedback || "Workload score logged."}"
                      </td>
                      <td style={{ color: "#64748b", fontSize: "0.82rem" }}>{item.date}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "1.5rem", textAlign: "center", color: "#64748b" }}>
            No employee pulse responses logged yet today.
          </div>
        )}
      </div>
    </div>
  );
}

export default EmployeeEngagementAnalytics;
