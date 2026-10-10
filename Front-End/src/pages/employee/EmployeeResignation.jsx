import React, { useState, useEffect } from "react";
import { apiRequest } from "../../services/apiClient";
import { toast } from "react-toastify";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import { useEmployee } from "../../hooks/useEmployee";
import { useAuth } from "../../context/AuthContext";
import "./EmployeeDashboard.css";

export default function EmployeeResignation() {
  const { user } = useAuth();
  const { employee, loading: empLoading } = useEmployee();
  const [resignation, setResignation] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [requestedLastWorkingDay, setRequestedLastWorkingDay] = useState("");
  const [reasonCategory, setReasonCategory] = useState("better-opportunity");
  const [reasonDetails, setReasonDetails] = useState("");
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);

  const reasonLabels = {
    "better-opportunity": "Career Growth / Better Opportunity",
    "higher-studies": "Pursuing Higher Education",
    "personal-reasons": "Personal / Family Reasons",
    "health": "Health / Medical Issues",
    "relocation": "Relocation",
    "other": "Other"
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const resData = await apiRequest("/resignations/my");
      if (resData.success && resData.data) {
        setResignation(resData.data);
      } else {
        setResignation(null);
      }

      const ticketsData = await apiRequest("/tickets/my");
      if (ticketsData.success && ticketsData.tickets) {
        setTickets(ticketsData.tickets.filter(t => t.query.includes("HR Connect")));
      }
    } catch (error) {
      console.error("Fetch data error", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Auto-update if HR resolves the ticket while employee is looking at the page
    const handleSync = (e) => {
      if (e.key === "hrms_tickets_sync" || e.type === "hrms_tickets_updated") {
        fetchData();
        toast.info("Your HR Connect request has been updated!");
      }
    };
    window.addEventListener("storage", handleSync);
    window.addEventListener("hrms_tickets_updated", handleSync);
    
    return () => {
      window.removeEventListener("storage", handleSync);
      window.removeEventListener("hrms_tickets_updated", handleSync);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreedToPolicy) {
      return toast.error("You must agree to the company exit policies.");
    }

    try {
      const data = await apiRequest("/resignations", {
        method: "POST",
        body: JSON.stringify({
          requestedLastWorkingDay,
          reasonCategory,
          reasonDetails,
        })
      });

      if (data.success) {
        toast.success(data.message || "Resignation submitted successfully");
        fetchResignation();
      }
    } catch (error) {
      toast.error(error.message || "Failed to submit resignation");
    }
  };

  const handleWithdraw = async () => {
    if (!window.confirm("Are you sure you want to withdraw your resignation request? This action will cancel your exit process.")) return;
    try {
      const data = await apiRequest("/resignations/my", { method: "DELETE" });
      if (data.success) {
        toast.success(data.message || "Resignation withdrawn");
        fetchData();
      }
    } catch (error) {
      toast.error(error.message || "Failed to withdraw resignation");
    }
  };

  const handleHRConnect = async () => {
    try {
      // Use robust profile resolution to grab first/last name or fallback to user
      const profile = employee || user || {};
      const fullName = profile.name || `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || user?.name || "Employee";
      const empCode = profile.employeeCode || profile.employeeId || user?.employeeId || profile._id || "EMP-UNKNOWN";
      const empDisplay = `${fullName} (${empCode})`;

      const data = await apiRequest("/tickets", {
        method: "POST",
        body: JSON.stringify({
          empId: empDisplay,
          query: "I would like to schedule an HR Connect regarding my resignation decision.",
        }),
      });
      if (data.success) {
        toast.success("HR connect request sent successfully! An HR representative will contact you soon.");
        window.dispatchEvent(new Event("hrms_tickets_updated"));
        localStorage.setItem("hrms_tickets_sync", Date.now().toString());
        fetchData();
      }
    } catch (error) {
      toast.error(error.message || "Failed to send HR connect request.");
    }
  };

  if (loading || empLoading) {
    return (
      <div className="employee-dashboard-hub">
        <div style={{ textAlign: "center", padding: "50px" }}>Loading...</div>
      </div>
    );
  }

  const localDate = new Date();
  localDate.setDate(localDate.getDate() + 90);
  const minDateString = new Date(localDate.getTime() - (localDate.getTimezoneOffset() * 60000)).toISOString().split("T")[0];

  return (
    <>
      <EmployeeHeader />
      <main className="employee-dashboard-hub fade-in">
        <section className="emp-hero-banner">
          <div className="emp-hero-left">
            <div className="hero-kicker-pill">
              <span className="pulsing-live-dot"></span>
              <span>Offboarding & Separation</span>
            </div>
            <h1>Resignation Portal</h1>
            <p>Initiate your separation process, view status, and track your offboarding checklist.</p>
            <div className="emp-meta-pills">
              <div className="meta-pill-tag">Notice Period: 90 Days</div>
            </div>
          </div>
        </section>

        <div className="dashboard-content" style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: "1.5rem" }}>
          {resignation && ["pending", "manager_approved", "under_review", "approved"].includes(resignation.status) ? (
            resignation.status === 'approved' ? (
              <div className="exit-approved-card" style={{ gridColumn: "1 / -1", padding: '24px' }}>
                <div className="exit-approved-header">
                  <h2>✅ Exit Request Approved</h2>
                </div>
                
                <div className="exit-metrics-wrapper">
                  <div className="exit-metric-premium">
                    <span className="label">Submitted On</span>
                    <div className="value">
                      {new Date(resignation.resignationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  
                  <div className="exit-metric-premium">
                    <span className="label">Requested LWD</span>
                    <div className="value">
                      {new Date(resignation.requestedLastWorkingDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>

                  <div className="exit-metric-premium">
                    <span className="label">Reason</span>
                    <div className="value">
                      {reasonLabels[resignation.reasonCategory] || resignation.reasonCategory.replace("-", " ")}
                    </div>
                  </div>

                  {resignation.approvedLastWorkingDay && (
                    <div className="exit-metric-premium exit-metric-highlight">
                      <span className="label">Official Notice Period End</span>
                      <div className="value">
                        {new Date(resignation.approvedLastWorkingDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  )}
                </div>
                
                {resignation.hrReviewComment && (
                  <div className="exit-hr-feedback-premium">
                    <h4>🌟 HR Feedback</h4>
                    <p>{resignation.hrReviewComment}</p>
                  </div>
                )}
                
                <div className="exit-next-steps-banner">
                  <p>
                    <strong>Next Steps:</strong> You have officially entered your Notice Period. Please ensure you begin the Exit & Clearance Process with IT and Finance over the coming weeks.
                  </p>
                </div>
              </div>
            ) : (
            <div className="dash-panel-card" style={{ gridColumn: "1 / -1" }}>
              <div className="dash-panel-head">
                <h2>Current Request</h2>
                <span className={`status-chip-badge ${resignation.status === 'manager_approved' ? 'late' : resignation.status === 'rejected' ? 'absent' : 'late'}`}>
                  {resignation.status === 'pending' ? 'PENDING MANAGER APPROVAL' :
                   resignation.status === 'manager_approved' ? 'PENDING HR APPROVAL' :
                   resignation.status.replace("_", " ").toUpperCase()}
                </span>
              </div>
              
              <div className="dash-metrics-grid" style={{ marginTop: "20px" }}>
                <div className="metric-box">
                  <span className="metric-label">Submitted On</span>
                  <div className="metric-val" style={{ fontSize: "1.2rem" }}>
                    {new Date(resignation.resignationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Requested LWD</span>
                  <div className="metric-val" style={{ fontSize: "1.2rem" }}>
                    {new Date(resignation.requestedLastWorkingDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Reason Category</span>
                  <div className="metric-val" style={{ fontSize: "1.2rem" }}>
                    {reasonLabels[resignation.reasonCategory] || resignation.reasonCategory.replace("-", " ")}
                  </div>
                </div>
              </div>
              
              {resignation.hrReviewComment && (
                <div style={{ padding: '20px', background: '#eff6ff', borderRadius: '12px', borderLeft: '4px solid #3b82f6', marginTop: '20px' }}>
                  <h4 style={{ color: '#1d4ed8', margin: '0 0 10px 0', fontSize: '1rem' }}>HR Feedback</h4>
                  <p style={{ color: '#1e3a8a', margin: 0, lineHeight: '1.6' }}>{resignation.hrReviewComment}</p>
                </div>
              )}

              {tickets.length > 0 && (
                <div style={{ marginTop: '20px', padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: '#1e293b' }}>HR Connect Requests</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {tickets.map(ticket => (
                      <div key={ticket.id} style={{ padding: '15px', background: 'white', borderRadius: '8px', borderLeft: `4px solid ${ticket.status === 'Resolved' ? '#10b981' : '#f59e0b'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontWeight: '600', color: '#334155' }}>{ticket.id}</span>
                          <span style={{ fontSize: '0.85rem', padding: '4px 10px', borderRadius: '20px', background: ticket.status === 'Resolved' ? '#d1fae5' : '#fef3c7', color: ticket.status === 'Resolved' ? '#047857' : '#b45309', fontWeight: '500' }}>
                            {ticket.status}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: '0.95rem' }}>{ticket.query}</p>
                        {ticket.resolution && (
                          <div style={{ marginTop: '10px', padding: '10px', background: '#f0fdf4', borderRadius: '6px' }}>
                            <strong style={{ color: '#166534', fontSize: '0.9rem', display: 'block', marginBottom: '5px' }}>Message from HR:</strong>
                            <p style={{ margin: 0, color: '#15803d', fontSize: '0.95rem' }}>{ticket.resolution}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {["pending", "under_review", "manager_approved"].includes(resignation.status) && (
                <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={handleWithdraw}
                    className="punch-btn out"
                  >
                    Withdraw Resignation Request
                  </button>
                </div>
              )}
            </div>
            )
          ) : (
            <>
              <div className="dash-panel-card">
                <div className="dash-panel-head">
                  <h2>Submit Resignation</h2>
                </div>
                
                <form onSubmit={handleSubmit} style={{ marginTop: "20px", display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1e293b' }}>
                      Requested Last Working Day <span style={{color: '#ef4444'}}>*</span>
                    </label>
                    <input 
                      type="date" 
                      required 
                      min={minDateString}
                      value={requestedLastWorkingDay}
                      onChange={(e) => setRequestedLastWorkingDay(e.target.value)}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem', background: '#f8fafc', color: '#0f172a' }}
                    />
                    <small style={{ color: '#64748b', display: 'block', marginTop: '6px' }}>
                      As per company policy, a standard 90-day notice period is required.
                    </small>
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1e293b' }}>
                      Primary Reason for Separation <span style={{color: '#ef4444'}}>*</span>
                    </label>
                    <select 
                      value={reasonCategory}
                      onChange={(e) => setReasonCategory(e.target.value)}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem', background: '#f8fafc', color: '#0f172a' }}
                    >
                      <option value="better-opportunity">Career Growth / Better Opportunity</option>
                      <option value="higher-studies">Pursuing Higher Education</option>
                      <option value="personal-reasons">Personal / Family Reasons</option>
                      <option value="health">Health / Medical Issues</option>
                      <option value="relocation">Relocation</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1e293b' }}>
                      Detailed Remarks <span style={{color: '#ef4444'}}>*</span>
                    </label>
                    <textarea 
                      required 
                      rows={5}
                      value={reasonDetails}
                      onChange={(e) => setReasonDetails(e.target.value)}
                      placeholder="Please provide any additional context regarding your decision..."
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', resize: 'vertical', fontSize: '0.95rem', fontFamily: 'inherit', background: '#f8fafc', color: '#0f172a' }}
                    ></textarea>
                  </div>

                  <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '10px', border: '1px solid #bbf7d0', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <input 
                      type="checkbox" 
                      id="policyAgree" 
                      checked={agreedToPolicy}
                      onChange={(e) => setAgreedToPolicy(e.target.checked)}
                      style={{ marginTop: '4px', width: '16px', height: '16px', accentColor: '#10b981', cursor: 'pointer' }} 
                    />
                    <label htmlFor="policyAgree" style={{ color: '#065f46', fontSize: '0.9rem', lineHeight: '1.5', cursor: 'pointer', margin: 0 }}>
                      I acknowledge that submitting this request initiates the official separation process. I have read and agree to the company's <strong style={{ textDecoration: "underline" }}>Exit Policy</strong>.
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button 
                      type="submit" 
                      disabled={!agreedToPolicy || !requestedLastWorkingDay || !reasonDetails.trim()}
                      className="punch-btn in"
                      style={{ opacity: (!agreedToPolicy || !requestedLastWorkingDay || !reasonDetails.trim()) ? 0.5 : 1 }}
                    >
                      Submit Resignation
                    </button>
                  </div>
                </form>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="dash-panel-card">
                  <div className="dash-panel-head">
                    <h2>Important Information</h2>
                  </div>
                  <ul style={{ paddingLeft: '20px', color: '#475569', fontSize: '0.9rem', lineHeight: '1.6', margin: "15px 0 0 0", display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <li>Your <strong>90-day notice period</strong> begins on the date of submission.</li>
                    <li>Leaves during the notice period may extend your Last Working Day (LWD).</li>
                    <li>Final LWD is subject to HR and Manager approval.</li>
                    <li>Ensure all company assets are returned before your LWD.</li>
                  </ul>
                </div>

                <div className="dash-panel-card" style={{ background: "linear-gradient(135deg, #091e20 0%, #0d3438 100%)", color: "#fff", border: "none" }}>
                  <div className="dash-panel-head">
                    <h2 style={{ color: "#fff" }}>Need to talk?</h2>
                  </div>
                  <p style={{ margin: '15px 0 20px 0', fontSize: '0.9rem', color: '#ccfbf1', lineHeight: '1.5' }}>
                    Before making your final decision, our HR team is here to listen and help resolve any concerns.
                  </p>
                  <button onClick={handleHRConnect} style={{ width: '100%', background: '#fff', color: '#0f172a', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>
                    Schedule HR Connect
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
