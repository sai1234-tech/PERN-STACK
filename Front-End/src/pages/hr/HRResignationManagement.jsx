import React, { useState, useEffect } from "react";
import { apiRequest } from "../../services/apiClient";
import { toast } from "react-toastify";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import { formatPhotoUrl } from "../../utils/photo";
import "./HRDashboard.css";
import "./EmployeeManagement.css";

export default function HRResignationManagement() {
  const [resignations, setResignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedResignation, setSelectedResignation] = useState(null);
  const [reviewStatus, setReviewStatus] = useState("");
  const [hrReviewComment, setHrReviewComment] = useState("");
  const [approvedLastWorkingDay, setApprovedLastWorkingDay] = useState("");

  const reasonLabels = {
    "better-opportunity": "Career Growth / Better Opportunity",
    "higher-studies": "Pursuing Higher Education",
    "personal-reasons": "Personal / Family Reasons",
    "health": "Health / Medical Issues",
    "relocation": "Relocation",
    "other": "Other"
  };

  const fetchResignations = async () => {
    try {
      setLoading(true);
      const endpoint = statusFilter ? `/resignations/all?status=${statusFilter}` : `/resignations/all`;
      const data = await apiRequest(endpoint);
      if (data.success) {
        setResignations(data.data);
      }
    } catch (error) {
      toast.error(error.message || "Failed to fetch resignations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResignations();
  }, [statusFilter]);

  const handleReview = async (e) => {
    e.preventDefault();
    if (!reviewStatus) return toast.error("Please select a status");

    try {
      const data = await apiRequest(`/resignations/${selectedResignation._id}/review`, {
        method: "PATCH",
        body: JSON.stringify({
          status: reviewStatus,
          hrReviewComment,
          approvedLastWorkingDay: reviewStatus === "approved" ? approvedLastWorkingDay : undefined
        })
      });

      if (data.success) {
        toast.success(data.message || "Resignation updated successfully.");
        setSelectedResignation(null);
        fetchResignations();
      }
    } catch (error) {
      toast.error(error.message || "Failed to update resignation request");
    }
  };

  const openReviewModal = (res) => {
    setSelectedResignation(res);
    setReviewStatus(res.status === "pending" ? "under_review" : res.status);
    setHrReviewComment(res.hrReviewComment || "");
    setApprovedLastWorkingDay(
      res.approvedLastWorkingDay
        ? res.approvedLastWorkingDay.split("T")[0]
        : res.requestedLastWorkingDay.split("T")[0]
    );
  };

  return (
    <>
      <EmployeeHeader />
      <main className="hr-dashboard-next fade-in" style={{ padding: "2rem", background: "#f1f5f9", minHeight: "calc(100vh - 70px)" }}>
        <section className="hr-hero-banner" style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", borderRadius: "16px", padding: "2.5rem", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.2)" }}>
          <div className="hr-hero-left">
            <div className="hero-kicker-pill" style={{ display: "inline-flex", background: "rgba(255,255,255,0.1)", padding: "0.25rem 0.75rem", borderRadius: "20px", fontSize: "0.8rem", marginBottom: "1rem", border: "1px solid rgba(255,255,255,0.2)" }}>
              <span className="pulsing-live-dot" style={{ background: "#10b981", width: "8px", height: "8px", borderRadius: "50%", marginRight: "8px", alignSelf: "center", boxShadow: "0 0 0 0 rgba(16, 185, 129, 0.7)", animation: "livePulse 2s infinite" }} />
              HR Command Center
            </div>
            <h1 style={{ margin: "0 0 0.5rem 0", fontSize: "2.2rem" }}>Resignation Management</h1>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: "1.05rem" }}>Review, process, and track employee exit requests securely.</p>
          </div>
          <div className="hr-hero-actions" style={{ display: "flex", gap: "15px" }}>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: "0.75rem 1.5rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: "0.95rem", outline: "none", cursor: "pointer", backdropFilter: "blur(10px)" }}
            >
              <option value="" style={{ color: "#000" }}>All Requests</option>
              <option value="pending" style={{ color: "#000" }}>Pending Manager</option>
              <option value="manager_approved" style={{ color: "#000" }}>Pending HR (Manager Approved)</option>
              <option value="manager_rejected" style={{ color: "#000" }}>Manager Rejected</option>
              <option value="under_review" style={{ color: "#000" }}>HR Reviewing</option>
              <option value="approved" style={{ color: "#000" }}>Approved</option>
              <option value="rejected" style={{ color: "#000" }}>Rejected</option>
            </select>
            <button type="button" onClick={fetchResignations} style={{ padding: "0.75rem 1.5rem", borderRadius: "12px", background: "#3b82f6", color: "#fff", border: "none", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}>
              Refresh Data
            </button>
          </div>
        </section>

        <section className="hr-panel-card" style={{ background: "#fff", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
          <div className="table-responsive-box">
            <table className="hr-modern-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", color: "#64748b", textAlign: "left", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <th style={{ padding: "1rem" }}>Employee Details</th>
                  <th style={{ padding: "1rem" }}>Requested LWD</th>
                  <th style={{ padding: "1rem" }}>Notice Period</th>
                  <th style={{ padding: "1rem" }}>Reason</th>
                  <th style={{ padding: "1rem" }}>Status</th>
                  <th style={{ padding: "1rem" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", padding: '40px', color: '#64748b' }}>Syncing with database...</td>
                  </tr>
                ) : resignations.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <div className="table-empty-notice" style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '15px', color: '#cbd5e1' }}>📄</span>
                        <strong style={{ display: 'block', fontSize: '1.2rem', color: '#334155' }}>No Resignation Requests Found</strong>
                        <p style={{ color: '#64748b', marginTop: '8px' }}>There are currently no matching records based on your selected filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  resignations.map((res) => (
                    <tr key={res._id} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {res.employee?.profilePhoto ? (
                            <img src={formatPhotoUrl(res.employee.profilePhoto)} alt="avatar" style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#e2e8f0", color: "#475569", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
                              {(res.employee?.firstName?.[0] || '') + (res.employee?.lastName?.[0] || 'E')}
                            </div>
                          )}
                          <div>
                            <strong style={{ display: "block", color: "#0f172a" }}>{res.employee?.firstName} {res.employee?.lastName}</strong>
                            <small style={{ color: "#64748b" }}>{res.employee?.email}</small>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <span style={{ background: "#f0f9ff", color: "#0284c7", padding: "4px 10px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "600" }}>
                          📅 {new Date(res.requestedLastWorkingDay).toLocaleDateString()}
                        </span>
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <span style={{ background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0", padding: "4px 10px", borderRadius: "6px", fontSize: "0.85rem" }}>
                          {res.noticePeriodDays} Days
                        </span>
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <span style={{ fontSize: "0.9rem", color: "#334155" }}>
                          {reasonLabels[res.reasonCategory] || res.reasonCategory?.replace("-", " ")}
                        </span>
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <span style={{ 
                          padding: "6px 12px", 
                          borderRadius: "20px", 
                          fontSize: "0.8rem", 
                          fontWeight: "700",
                          textTransform: "uppercase",
                          background: res.status === 'approved' ? '#dcfce7' : 
                                      res.status === 'manager_approved' ? '#dbeafe' :
                                      (res.status === 'rejected' || res.status === 'manager_rejected') ? '#fee2e2' : '#fef9c3',
                          color: res.status === 'approved' ? '#166534' : 
                                 res.status === 'manager_approved' ? '#1e40af' :
                                 (res.status === 'rejected' || res.status === 'manager_rejected') ? '#991b1b' : '#854d0e'
                        }}>
                          {res.status.replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <button 
                          onClick={() => openReviewModal(res)}
                          style={{ background: "#fff", border: "1px solid #cbd5e1", padding: "6px 14px", borderRadius: "6px", color: "#0f172a", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#94a3b8"; e.currentTarget.style.background = "#f1f5f9"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.background = "#fff"; }}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {selectedResignation && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <div className="modal-header" style={{ flexShrink: 0 }}>
                <h2>Resignation Review</h2>
                <button type="button" className="btn-close" onClick={() => setSelectedResignation(null)}>&times;</button>
              </div>
              <div className="modal-body" style={{ overflowY: 'auto', padding: '20px' }}>
                <div style={{ marginBottom: '24px', padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Employee Name</span>
                    <strong style={{ color: '#0f172a' }}>{selectedResignation.employee?.firstName} {selectedResignation.employee?.lastName}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Reason Category</span>
                    <strong style={{ color: '#0f172a' }}>{reasonLabels[selectedResignation.reasonCategory] || selectedResignation.reasonCategory?.replace("-", " ")}</strong>
                  </div>
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px', marginTop: '5px' }}>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '4px' }}>Employee Comments:</span>
                    <p style={{ margin: 0, color: '#334155', fontStyle: 'italic' }}>"{selectedResignation.reasonDetails}"</p>
                  </div>
                  {selectedResignation.managerReviewComment && (
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px', marginTop: '5px' }}>
                      <span style={{ color: '#64748b', display: 'block', marginBottom: '4px' }}>Manager Comments:</span>
                      <p style={{ margin: 0, color: '#334155', fontStyle: 'italic' }}>"{selectedResignation.managerReviewComment}"</p>
                    </div>
                  )}
                </div>

                <form onSubmit={handleReview} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1e293b' }}>HR Resolution Status</label>
                    <select 
                      value={reviewStatus} 
                      onChange={(e) => setReviewStatus(e.target.value)}
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', backgroundColor: '#f8fafc', color: '#0f172a', outline: 'none' }}
                    >
                      <option value="manager_approved">Override: Manager Approved</option>
                      <option value="manager_rejected">Override: Manager Rejected</option>
                      <option value="under_review">Mark as Under HR Review</option>
                      <option value="approved">Final HR Approval</option>
                      <option value="rejected">Final HR Rejection</option>
                    </select>
                  </div>

                  {reviewStatus === "approved" && (
                    <div style={{ animation: "fadeIn 0.3s ease" }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1e293b' }}>Final Approved Last Working Day</label>
                      <input 
                        type="date" 
                        value={approvedLastWorkingDay}
                        onChange={(e) => setApprovedLastWorkingDay(e.target.value)}
                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', backgroundColor: '#f8fafc' }}
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1e293b' }}>Official HR Comments</label>
                    <textarea 
                      value={hrReviewComment}
                      onChange={(e) => setHrReviewComment(e.target.value)}
                      rows={4}
                      placeholder="Add an internal note or a message to the employee..."
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', fontFamily: 'inherit', resize: 'vertical', backgroundColor: '#f8fafc' }}
                    ></textarea>
                  </div>

                  <div className="modal-actions">
                    <button type="button" onClick={() => setSelectedResignation(null)} style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '8px', color: '#475569', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" style={{ background: '#2563eb', border: 'none', padding: '10px 20px', borderRadius: '8px', color: '#fff', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}>Finalize & Save</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
