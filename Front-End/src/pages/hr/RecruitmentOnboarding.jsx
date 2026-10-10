import React, { useState } from "react";
import { useRecruitment } from "../../hooks/useRecruitment";
import "./RecruitmentOnboarding.css";

const STAGES = ["Applied", "Screening", "Interview", "Selected", "Hired"];

export default function RecruitmentOnboarding() {
  const {
    candidates,
    auditTrail,
    onboardingStatus,
    employees,
    addCandidate,
    updateCandidateStatus,
    triggerOnboarding,
  } = useRecruitment();

  const [showAddModal, setShowAddModal] = useState(false);
  const [onboardCandidate, setOnboardCandidate] = useState(null);
  
  // Forms
  const [newCandidate, setNewCandidate] = useState({ name: "", email: "", phone: "", skills: "", experience: "" });
  const [onboardForm, setOnboardForm] = useState({ department: "Engineering", manager: "", designation: "Software Engineer", joiningDate: "" });

  const handleAddCandidate = (e) => {
    e.preventDefault();
    addCandidate(newCandidate);
    setShowAddModal(false);
    setNewCandidate({ name: "", email: "", phone: "", skills: "", experience: "" });
  };

  const handleStatusChange = (candidate_id, newStatus) => {
    if (newStatus === "Hired") {
      const candidate = candidates.find(c => c.candidate_id === candidate_id);
      setOnboardCandidate(candidate);
    } else {
      updateCandidateStatus(candidate_id, newStatus);
    }
  };

  const startOnboarding = async () => {
    const candidateId = onboardCandidate.candidate_id;
    // Don't close modal immediately, show progress inside it
    await triggerOnboarding(candidateId, onboardForm);
  };

  const renderCandidateCard = (candidate) => {
    const isHired = candidate.status === "Hired";
    const obStatus = onboardingStatus[candidate.candidate_id];

    return (
      <div key={candidate.candidate_id} className="candidate-card">
        <h4 className="cand-name">{candidate.name}</h4>
        <div className="cand-meta">
          <span>
            <strong>{isHired ? "Perm ID:" : "Temp ID:"}</strong>{" "}
            {isHired
              ? employees.find((e) => e.candidate_id === candidate.candidate_id)?.employee_id || "Provisioning..."
              : candidate.candidate_id}
          </span>
          <span>{candidate.email}</span>
        </div>
        <div className="cand-skills">
          {candidate.skills.split(",").map(s => (
            <span key={s} className="skill-pill">{s.trim()}</span>
          ))}
        </div>
        
        {!isHired ? (
          <div className="cand-actions">
            <select 
              className="cand-select-status"
              value={candidate.status}
              onChange={(e) => handleStatusChange(candidate.candidate_id, e.target.value)}
            >
              {STAGES.map(stage => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
            <button className="btn-hire" onClick={() => handleStatusChange(candidate.candidate_id, "Hired")}>
              Hire
            </button>
          </div>
        ) : (
          <div style={{ marginTop: "1rem", padding: "0.5rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px" }}>
            <span style={{ fontSize: "0.8rem", color: "#166534", fontWeight: "600" }}>Onboarding: {obStatus || "Completed"}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="recruitment-hub">
      <header className="recruitment-header">
        <div>
          <h1>Recruitment & Onboarding</h1>
          <p>Track candidate pipelines and automate employee account provisioning.</p>
        </div>
        <button className="add-candidate-btn" onClick={() => setShowAddModal(true)}>
          + Add Candidate
        </button>
      </header>

      {/* Pipeline View */}
      <section className="candidate-pipeline">
        {STAGES.map(stage => {
          const stageCandidates = candidates.filter(c => c.status === stage);
          return (
            <div key={stage} className="pipeline-stage">
              <div className="stage-header">
                <h3>{stage}</h3>
                <span className="stage-count">{stageCandidates.length}</span>
              </div>
              {stageCandidates.map(renderCandidateCard)}
            </div>
          );
        })}
      </section>

      {/* Audit Trail */}
      <section className="audit-panel">
        <h3><span>📝</span> HR Compliance Audit Trail</h3>
        <div className="audit-list">
          {auditTrail.length === 0 ? <p style={{ color: "#94a3b8" }}>No actions recorded yet.</p> : null}
          {auditTrail.map(log => (
            <div key={log.id} className="audit-item">
              <span className="audit-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
              <div className="audit-content">
                <strong>{log.action}</strong>
                <p>{log.details}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Add Candidate Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="onboard-modal">
            <h2>Add New Candidate</h2>
            <p>Enter candidate details to enter them into the recruitment pipeline.</p>
            <form onSubmit={handleAddCandidate}>
              <div className="ob-form-grid">
                <div className="ob-field">
                  <label>Full Name</label>
                  <input type="text" required value={newCandidate.name} onChange={e => setNewCandidate({...newCandidate, name: e.target.value})} />
                </div>
                <div className="ob-field">
                  <label>Email</label>
                  <input type="email" required value={newCandidate.email} onChange={e => setNewCandidate({...newCandidate, email: e.target.value})} />
                </div>
                <div className="ob-field">
                  <label>Phone</label>
                  <input type="text" required value={newCandidate.phone} onChange={e => setNewCandidate({...newCandidate, phone: e.target.value})} />
                </div>
                <div className="ob-field">
                  <label>Experience</label>
                  <input type="text" placeholder="e.g. 3 Years" required value={newCandidate.experience} onChange={e => setNewCandidate({...newCandidate, experience: e.target.value})} />
                </div>
              </div>
              <div className="ob-field" style={{ marginBottom: "1.5rem" }}>
                <label>Skills (comma separated)</label>
                <input type="text" required value={newCandidate.skills} onChange={e => setNewCandidate({...newCandidate, skills: e.target.value})} />
              </div>
              <div className="ob-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn-start">Save Candidate</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Onboarding Orchestrator Modal */}
      {onboardCandidate && (
        <div className="modal-overlay">
          <div className="onboard-modal">
            <h2>Enterprise Onboarding</h2>
            <p>Provisioning an employee account for <strong>{onboardCandidate.name}</strong>.</p>
            
            {!onboardingStatus[onboardCandidate.candidate_id] || onboardingStatus[onboardCandidate.candidate_id] === "Failed" ? (
              <>
                {onboardingStatus[onboardCandidate.candidate_id] === "Failed" && (
                  <div style={{ color: "#ef4444", marginBottom: "1rem", background: "#fef2f2", padding: "1rem", borderRadius: "8px" }}>
                    <strong>Onboarding Failed:</strong> Attempt to provision account failed. Check the audit log.
                  </div>
                )}
                <div className="ob-form-grid">
                  <div className="ob-field">
                    <label>Department</label>
                    <select value={onboardForm.department} onChange={e => setOnboardForm({...onboardForm, department: e.target.value})}>
                      <option>Engineering</option>
                      <option>HR</option>
                      <option>Sales</option>
                      <option>Marketing</option>
                    </select>
                  </div>
                  <div className="ob-field">
                    <label>Direct Manager</label>
                    <input
                      type="text"
                      placeholder="e.g. Vikas Guru or Select Manager"
                      list="manager-options-list"
                      value={onboardForm.manager}
                      onChange={e => setOnboardForm({...onboardForm, manager: e.target.value})}
                    />
                    <datalist id="manager-options-list">
                      {employees.map((emp) => (
                        <option key={emp._id || emp.employee_id || emp.id} value={emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim()}>
                          {emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim()} ({emp.employment?.designation || emp.designation || "Manager"})
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <div className="ob-field">
                    <label>Designation</label>
                    <input type="text" required value={onboardForm.designation} onChange={e => setOnboardForm({...onboardForm, designation: e.target.value})} />
                  </div>
                  <div className="ob-field">
                    <label>Joining Date</label>
                    <input type="date" required value={onboardForm.joiningDate} onChange={e => setOnboardForm({...onboardForm, joiningDate: e.target.value})} />
                  </div>
                </div>
                <div className="ob-actions">
                  <button type="button" className="btn-cancel" onClick={() => { setOnboardCandidate(null); }}>Cancel</button>
                  <button type="button" className="btn-start" onClick={startOnboarding}>
                    {onboardingStatus[onboardCandidate.candidate_id] === "Failed" ? "Retry Onboarding" : "Trigger Automation"}
                  </button>
                </div>
              </>
            ) : (
              <div className="onboarding-progress-view">
                {onboardingStatus[onboardCandidate.candidate_id] === "Completed" ? (
                  <>
                    <div className="status-success-icon">✅</div>
                    <div className="status-text">Onboarding Complete!</div>
                    <p>Employee ID Generated and Secure Welcome Email dispatched.</p>
                    
                    <div style={{ textAlign: "left", background: "#f8fafc", padding: "1.5rem", borderRadius: "12px", border: "1px solid #e2e8f0", marginTop: "1.5rem", marginBottom: "1.5rem" }}>
                      <h5 style={{ color: "#64748b", fontSize: "0.8rem", textTransform: "uppercase", marginBottom: "0.5rem" }}>Mock Email Preview sent to {onboardCandidate.email}:</h5>
                      <div style={{ background: "white", padding: "1.5rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", color: "#334155" }}>
                        <p><strong>Subject:</strong> Welcome to Quadratic Systems! Action Required.</p>
                        <hr style={{ margin: "1rem 0", borderColor: "#f1f5f9" }} />
                        <p>Hi <strong>{onboardCandidate.name}</strong>,</p>
                        <p>Welcome aboard! Your employee account has been provisioned.</p>
                        <ul style={{ paddingLeft: "1.5rem", margin: "1rem 0" }}>
                          <li><strong>Employee ID:</strong> {employees.find(e => e.candidate_id === onboardCandidate.candidate_id)?.employee_id || "EMP-XXXX"}</li>
                          <li><strong>Department:</strong> {onboardForm.department}</li>
                          <li><strong>Manager:</strong> {onboardForm.manager}</li>
                        </ul>
                        <p>Please click the secure link below within 24 hours to set your password and access the HRMS Portal.</p>
                        <button 
                          onClick={() => alert(`Simulating Activation for ${onboardCandidate.name}...\n\nIn a real production environment, this link navigates the user to a secure Password Setup portal where they can create their credentials.`)}
                          style={{ background: "#2563eb", color: "white", padding: "0.5rem 1rem", border: "none", borderRadius: "6px", marginTop: "0.5rem", cursor: "pointer", fontWeight: "600" }}
                        >
                          Activate Account
                        </button>
                      </div>
                    </div>

                    <button className="btn-start" onClick={() => setOnboardCandidate(null)}>Close Workflow</button>
                  </>
                ) : (
                  <>
                    <div className="status-spinner">⚙️</div>
                    <div className="status-text">{onboardingStatus[onboardCandidate.candidate_id]}</div>
                    <p>Automating provisioning securely...</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
