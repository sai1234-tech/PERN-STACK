import { useState } from "react";
import { Link } from "react-router-dom";
import { useManager } from "../../hooks/useManager";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import Loader from "../../components/common/Loader";
import { formatPhotoUrl } from "../../utils/photo";
import "./ManagerProjects.css";

function ManagerProjects() {
  const { projects, loading, error } = useManager();
  const [searchQuery, setSearchQuery] = useState("");

  if (loading) return <Loader label="Loading Realtime Active Projects..." />;
  if (error) return <div style={{ padding: "2rem", color: "#e11d48", fontWeight: 700 }}>⚠️ {error}</div>;

  const safeProjects = Array.isArray(projects) ? projects : [];

  const filtered = safeProjects.filter((p) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    return (
      p.name?.toLowerCase().includes(query) ||
      p.client?.toLowerCase().includes(query)
    );
  });

  const totalHoursLogged = safeProjects.reduce((sum, p) => sum + Number(p.totalHours || 0), 0);

  return (
    <>
      <EmployeeHeader />
      <div className="manager-projects-container">
        {/* Hero Banner Header */}
        <div className="manager-projects-header">
          <div className="projects-hero-left">
            <div className="header-badge-capsule">
              <span className="live-sprint-dot" />
              <span>Active Team Deliverables & Sprints</span>
            </div>
            <h2>Realtime Active Projects</h2>
            <p>Monitor where your team is currently spending their time based on live timesheets and sprint allocations.</p>
          </div>

          <div className="projects-hero-metrics">
            <div className="hero-metric-pill">
              <span className="metric-num">{projects.length}</span>
              <span className="metric-lbl">Active Projects</span>
            </div>
            <div className="hero-metric-pill">
              <span className="metric-num">{totalHoursLogged}h</span>
              <span className="metric-lbl">Total Hours Logged</span>
            </div>
            <div className="hero-metric-pill">
              <span className="metric-num">98.4%</span>
              <span className="metric-lbl">Sprint Efficiency</span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="projects-control-bar">
          <div className="projects-search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by project name or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="projects-search-input"
            />
          </div>
          <span className="results-count-badge">
            Showing {filtered.length} of {projects.length} Projects
          </span>
        </div>

        {/* Projects Grid */}
        {filtered.length === 0 ? (
          <div className="manager-empty-projects">
            <div className="empty-icon-box">🚀</div>
            <h3>No Active Projects Found</h3>
            <p>No project logs match your filter criteria. Try adjusting your search keyword.</p>
          </div>
        ) : (
          <div className="projects-grid">
            {filtered.map((proj, idx) => {
              const hours = Number(proj.totalHours || 0);
              const targetHours = Math.max(hours, 40);
              const progressPct = Math.min(100, Math.round((hours / targetHours) * 100));

              return (
                <div key={idx} className="project-card">
                  <div className="proj-card-header">
                    <div className="proj-title-box">
                      <div className="proj-avatar-icon">
                        {idx % 3 === 0 ? "⚡" : idx % 3 === 1 ? "💻" : "🚀"}
                      </div>
                      <div>
                        <h3>{proj.name}</h3>
                        <span className="client-badge">🏢 Client: {proj.client || "Internal"}</span>
                      </div>
                    </div>
                    <span className="hours-pill">⏱️ {hours}h Logged</span>
                  </div>

                  <div className="proj-stats-grid">
                    <div className="stat-box">
                      <span className="stat-value">{hours} hrs</span>
                      <span className="stat-label">Total Effort</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-value">{proj.activeMembers?.length || 0}</span>
                      <span className="stat-label">Active Members</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="proj-progress-section">
                    <div className="proj-progress-rail">
                      <div
                        className="proj-progress-fill"
                        style={{ width: `${Math.max(12, progressPct)}%` }}
                      />
                    </div>
                    <div className="proj-progress-text">
                      <span>Logged Effort ({hours}h)</span>
                      <span>{progressPct}% of Sprint Target</span>
                    </div>
                  </div>

                  {/* Tasks List */}
                  {proj.recentTasks && proj.recentTasks.length > 0 && (
                    <div className="proj-recent-tasks">
                      <h4>Recent Task Activity</h4>
                      <ul>
                        {proj.recentTasks.slice(0, 3).map((task, tidx) => (
                          <li key={tidx}>
                            <span className="task-bullet">✓</span>
                            <span>{task}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Footer & Active Members Stack */}
                  <div className="proj-card-footer">
                    <span className="active-sprint-tag">
                      <span className="pulse-beacon" /> Active Sprint
                    </span>

                    <div className="proj-active-members">
                      <div className="members-avatar-stack">
                        {proj.activeMembers && proj.activeMembers.length > 0 ? (
                          proj.activeMembers.slice(0, 4).map((member, mIdx) => {
                            const firstName = member.firstName || member.name || "";
                            const lastName = member.lastName || "";
                            const fullName = `${firstName} ${lastName}`.trim() || "Team Member";
                            const initial = (firstName.charAt(0) || lastName.charAt(0) || member.name?.charAt(0) || "U").toUpperCase();

                            return (
                              <div
                                key={member._id || mIdx}
                                className={`member-avatar ${mIdx === 1 ? "alt-blue" : mIdx === 2 ? "alt-indigo" : ""}`}
                                title={fullName}
                              >
                                {member.profilePhoto ? (
                                  <img
                                    src={formatPhotoUrl(member.profilePhoto)}
                                    alt={firstName}
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                      const fallback = e.currentTarget.nextElementSibling;
                                      if (fallback) fallback.style.display = "inline";
                                    }}
                                  />
                                ) : null}
                                <span style={{ display: member.profilePhoto ? "none" : "inline" }}>{initial}</span>
                              </div>
                            );
                          })
                        ) : (
                          <span className="no-members-text">Unassigned</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default ManagerProjects;
