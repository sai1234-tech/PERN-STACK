import React, { useState } from "react";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import ExpandableText from "../../components/common/ExpandableText";
import { usePerformance } from "../../hooks/usePerformance";
import "../employee/Performance.css";

export default function ManagerPerformance() {
  const { okrs, rateOkr, loading, error } = usePerformance(true);
  const [feedbacks, setFeedbacks] = useState({});
  const [savingId, setSavingId] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const handleRate = async (id, score) => {
    const feedback = feedbacks[id] || "";
    setSavingId(id);
    setSaveMessage("");
    setSaveError("");
    try {
      await rateOkr(id, score, feedback);
      setFeedbacks((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
      setSaveMessage(`Feedback saved for ${okrs.find((okr) => okr._id === id)?.employee?.firstName || "employee"}.`);
    } catch (requestError) {
      setSaveError(requestError.message || "Failed to save feedback.");
    } finally {
      setSavingId("");
    }
  };

  const handleFeedbackChange = (id, value) => {
    setFeedbacks((previous) => ({ ...previous, [id]: value }));
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
        {saveMessage && <div className="success-banner" role="status">{saveMessage}</div>}
        {saveError && <div className="error-banner" role="alert">{saveError}</div>}
        {loading && <p>Loading OKRs...</p>}

        <div className="okr-list">
          {okrs.map(okr => (
            <div key={okr._id} className="okr-card">
              <div className="okr-info">
                <ExpandableText text={okr.objective} as="h4" />
                <div className="okr-employee-meta">
                  Employee: <strong>{okr.employee?.firstName} {okr.employee?.lastName}</strong> ({okr.employee?.email})
                </div>
                <span className={`status ${okr.result === "Reviewed" ? "reviewed" : ""}`}>{okr.result}</span>
              </div>
              
              <div className="hr-review-box">
                <div className="review-field">
                  <p>Manager Rating</p>
                  <div className="star-rating" role="group" aria-label={`Rate ${okr.employee?.firstName || "employee"}'s objective`}>
                    {[1,2,3,4,5].map(star => (
                      <button
                        key={star} 
                        type="button"
                        className={`star ${okr.score >= star ? 'filled' : ''}`}
                        onClick={() => handleRate(okr._id, star)}
                        disabled={savingId === okr._id}
                        aria-label={`${star} star${star > 1 ? "s" : ""}`}
                        aria-pressed={okr.score === star}
                      >★</button>
                    ))}
                  </div>
                </div>
                <div className="review-field">
                  <p>Manager Feedback</p>
                  <textarea 
                    value={feedbacks[okr._id] !== undefined ? feedbacks[okr._id] : (okr.feedback || "")}
                    onChange={(e) => handleFeedbackChange(okr._id, e.target.value)}
                    placeholder="Enter performance feedback here..."
                    disabled={savingId === okr._id}
                    className="manager-feedback-input"
                  />
                  <button 
                    type="button"
                    disabled={savingId === okr._id}
                    onClick={() => handleRate(okr._id, okr.score || 1)}
                    className="manager-feedback-submit"
                  >
                    {savingId === okr._id ? "Saving..." : "Submit Feedback"}
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
