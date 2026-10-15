import React, { useState } from "react";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import ExpandableText from "../../components/common/ExpandableText";
import { usePerformance } from "../../hooks/usePerformance";
import "./Performance.css";

export default function Performance() {
  const { okrs, addOkr, loading, error } = usePerformance(false);
  const [newOkr, setNewOkr] = useState("");

  const handleAddOkr = async (e) => {
    e.preventDefault();
    if (newOkr.trim()) {
      await addOkr(newOkr.trim());
      setNewOkr("");
    }
  };

  return (
    <>
      <EmployeeHeader />
      <div className="perf-hub">
        <header className="perf-header">
          <div>
            <h1>OKRs & 360° Appraisals</h1>
            <p>Set Quarterly Objectives and Key Results for your performance review.</p>
          </div>
        </header>

        {error && <div className="error-banner">{error}</div>}

        <div className="add-okr-box">
          <h3>Set New Objective</h3>
          <form onSubmit={handleAddOkr} className="okr-form">
            <input 
              type="text" 
              placeholder="e.g., Launch new mobile application by Q3" 
              value={newOkr}
              onChange={e => setNewOkr(e.target.value)}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !newOkr.trim()}>Submit Goal</button>
          </form>
        </div>

        {loading && <p>Loading OKRs...</p>}

        <div className="okr-list">
          {okrs.map(okr => (
            <div key={okr._id} className="okr-card">
              <div className="okr-info">
                <ExpandableText text={okr.objective} as="h4" />
                <span className={`status ${okr.result === "Reviewed" ? "reviewed" : ""}`}>{okr.result}</span>
              </div>
              
              <div className="emp-score-box">
                {okr.score > 0 ? (
                <div className="emp-review-summary">
                    <div className="score-badge">Rating: {okr.score}/5</div>
                    {okr.feedback && (
                    <div className="feedback-badge">
                        <strong>Manager Feedback:</strong>{" "}
                        <ExpandableText text={okr.feedback} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="score-pending">Pending Review</div>
                )}
              </div>
            </div>
          ))}
          {!loading && okrs.length === 0 && (
            <p className="no-data">You haven't submitted any OKRs yet.</p>
          )}
        </div>
      </div>
    </>
  );
}
