import { useMemo } from "react";
import {
  calculateTenure,
  formatTenure,
  getNextAnniversary,
  getServiceMilestone,
} from "../../utils/tenureUtils";
import { formatDate } from "../../utils/date";
import "./TenureDetails.css";

export default function TenureDetails({ joiningDate, exitDate, status }) {
  const isExited = status === "Inactive" || status === "Exited" || !!exitDate;

  const tenureData = useMemo(() => {
    const tenure = calculateTenure(joiningDate, exitDate);
    const formatted = formatTenure(tenure);
    const anniv = getNextAnniversary(joiningDate, exitDate);
    const milestone = getServiceMilestone(tenure.years);
    
    return {
      years: tenure.years,
      formatted,
      anniv,
      milestone,
      isNew: tenure.isNew,
    };
  }, [joiningDate, exitDate]);

  if (!joiningDate) {
    return (
      <article className="dossier-section-card tenure-card">
        <div className="dossier-head">
          <h3>⏳ Service & Tenure</h3>
          <span className="meta-pill-tag warning-badge">Missing Record</span>
        </div>
        <div className="tenure-empty">
          <p>Date of Joining is not recorded for this employee.</p>
        </div>
      </article>
    );
  }

  return (
    <article className="dossier-section-card tenure-card">
      <div className="dossier-head">
        <h3>⏳ Service & Tenure</h3>
        <div className="dossier-head-actions">
          {isExited ? (
            <span className="meta-pill-tag inactive-badge">Service Concluded</span>
          ) : (
            <span className="meta-pill-tag active-service-badge">
              {tenureData.milestone}
            </span>
          )}
        </div>
      </div>

      <div className="dossier-fields-grid tenure-grid">
        <div className="dossier-field">
          <span>Date of Joining</span>
          <strong>{formatDate(joiningDate)}</strong>
        </div>

        {isExited && exitDate && (
          <div className="dossier-field">
            <span>Date of Exit</span>
            <strong style={{ color: "#e11d48" }}>{formatDate(exitDate)}</strong>
          </div>
        )}

        <div className="dossier-field">
          <span>{isExited ? "Total Tenure" : "Current Tenure"}</span>
          <strong className="tenure-highlight">{tenureData.formatted}</strong>
        </div>

        {!isExited && tenureData.anniv && (
          <>
            <div className="dossier-field">
              <span>Next Anniversary</span>
              <strong>{formatDate(tenureData.anniv.date)}</strong>
            </div>

            <div className="dossier-field">
              <span>Countdown</span>
              {tenureData.anniv.daysRemaining === 0 ? (
                <strong className="anniv-today">🎉 Happy Work Anniversary!</strong>
              ) : (
                <strong>
                  {tenureData.anniv.daysRemaining}{" "}
                  {tenureData.anniv.daysRemaining === 1 ? "Day" : "Days"} Remaining
                </strong>
              )}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
