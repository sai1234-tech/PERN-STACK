import React, { useState, useEffect } from "react";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import { usePerformance } from "../../hooks/usePerformance";
import "../employee/Performance.css";
import { toast } from "react-toastify";

export default function ManagerPerformance() {
  const { okrs, rateOkr, loading, error, refreshOkrs } = usePerformance(true);
  const [feedbacks, setFeedbacks] = useState({});

  useEffect(() => {
    const handleDataChanged = () => refreshOkrs();
    window.addEventListener("hrms:data_changed", handleDataChanged);
    return () => window.removeEventListener("hrms:data_changed", handleDataChanged);
  }, [refreshOkrs]);

  console.log("Manager Appraisals loaded okrs:", okrs);

  const handleRate = async (id, score) => {
    const feedback = feedbacks[id] || "";
    await rateOkr(id, score, feedback);
  };

  const handleFeedbackChange = (id, value) => {
    setFeedbacks({ ...feedbacks, [id]: value });
  };

  return (
    <>
      <EmployeeHeader />
      <div className="perf-hub">
        <header className="perf-header">
          <div>
            <h1>Manager Appraisals</h1>
            <p>Review, score, and provide feedback for Objectives and Key Results submitted by your direct reports.</p>
          </div>
        </header>

        {error && <div className="error-banner">{error}</div>}
        {loading && <p>Loading OKRs...</p>}

        <div className="okr-list">
          {okrs.map(okr => (
            <div key={okr._id} className="okr-card">
              <div className="okr-info">
                <h4>{okr.objective}</h4>
                <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
                  Employee: <strong>{okr.employee?.firstName} {okr.employee?.lastName}</strong> ({okr.employee?.email})
                </div>
                <span className={`status ${okr.result === "Reviewed" ? "reviewed" : ""}`}>{okr.result}</span>
              </div>
              
              <div className="hr-review-box" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <p style={{ marginBottom: '5px' }}>Manager Rating:</p>
                  <div className="star-rating">
                    {[1,2,3,4,5].map(star => (
                      <span 
                        key={star} 
                        className={`star ${okr.score >= star ? 'filled' : ''}`}
                        onClick={() => handleRate(okr._id, star)}
                        style={{ cursor: "pointer" }}
                      >★</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ marginBottom: '5px' }}>Manager Feedback:</p>
                  <textarea 
                    value={feedbacks[okr._id] !== undefined ? feedbacks[okr._id] : (okr.feedback || "")}
                    onChange={(e) => handleFeedbackChange(okr._id, e.target.value)}
                    placeholder="Enter performance feedback here..."
                    style={{ width: '100%', minHeight: '60px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                  <button 
                    onClick={() => handleRate(okr._id, okr.score || 1)}
                    style={{ marginTop: '8px', padding: '6px 12px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Submit Feedback
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!loading && okrs.length === 0 && (
            <p className="no-data">No OKRs have been submitted by employees yet.</p>
          )}
        </div>
      </div>
    </>
  );
}
