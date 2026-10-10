import { useState, useEffect } from "react";
import { submitDailyPulse, getTodayPulse } from "../../services/pulseService";
import "./DailyPulseWidget.css";

const RATING_OPTIONS = [
  { level: 1, emoji: "😫", label: "Overwhelmed", color: "#ef4444" },
  { level: 2, emoji: "🙁", label: "Heavy", color: "#f97316" },
  { level: 3, emoji: "😐", label: "Moderate", color: "#eab308" },
  { level: 4, emoji: "🙂", label: "Manageable", color: "#3b82f6" },
  { level: 5, emoji: "😀", label: "Optimal", color: "#10b981" },
];

export function DailyPulseWidget() {
  const [selectedScore, setSelectedScore] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const todayKey = `pulse_dismissed_${new Date().toISOString().split("T")[0]}`;

  useEffect(() => {
    async function checkPulseStatus() {
      try {
        const res = await getTodayPulse();
        if (res?.data?.score) {
          setSelectedScore(res.data.score);
          setSubmitted(true);
          setShowModal(false); // Already submitted today -> do not show popup modal
        } else {
          // If not submitted today and not dismissed in session -> show popup modal on load
          const isDismissed = sessionStorage.getItem(todayKey) === "true";
          if (!isDismissed) {
            setShowModal(true);
          }
        }
      } catch (err) {
        console.error("Failed to check pulse status:", err);
      } finally {
        setLoading(false);
      }
    }
    checkPulseStatus();
  }, [todayKey]);

  const handleDismissModal = () => {
    sessionStorage.setItem(todayKey, "true");
    setShowModal(false);
  };

  const handleSelectScore = async (score) => {
    setSelectedScore(score);
    setSubmitting(true);
    try {
      await submitDailyPulse(score);
      setSubmitted(true);
      sessionStorage.setItem(todayKey, "true");
      setTimeout(() => {
        setShowModal(false);
      }, 700);
    } catch (err) {
      console.error("Error submitting pulse:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !showModal) {
    return null; // Render strictly as a popup modal on reload
  }

  return (
    <div className="daily-pulse-modal-backdrop" role="dialog" aria-modal="true">
      <div className="daily-pulse-modal-card">
        <button
          type="button"
          className="pulse-modal-close-btn"
          onClick={handleDismissModal}
          title="Dismiss for now"
        >
          ✕
        </button>

        <div className="daily-pulse-header">
          <div className="pulse-title-wrap">
            <span className="pulse-icon">💓</span>
            <div>
              <h3>Daily Pulse Check</h3>
              <span className="pulse-subtitle">Workforce Well-being & Workload Checklist</span>
            </div>
          </div>
        </div>

        <div className="pulse-question-box">
          <p className="pulse-question-text">
            "Do you feel your current workload is manageable?"
          </p>
        </div>

        <div className="pulse-rating-bar">
          {RATING_OPTIONS.map((opt) => {
            const isActive = selectedScore === opt.level;

            return (
              <button
                key={opt.level}
                type="button"
                disabled={submitting}
                className={`pulse-rate-btn ${isActive ? "active" : ""}`}
                onClick={() => handleSelectScore(opt.level)}
                style={{
                  "--pulse-color": opt.color,
                }}
                title={`${opt.level} - ${opt.label}`}
              >
                <span className="rate-num-badge">{opt.level}</span>
                <span className="rate-emoji">{opt.emoji}</span>
                <span className="rate-label-text">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {submitted ? (
          <div className="pulse-thankyou-note">
            <span>✨ Thanks for sharing! Your feedback helps optimize team bandwidth.</span>
          </div>
        ) : (
          <div className="pulse-footer-hint">
            <span>Your response is confidential & aggregated for HR workload health analytics.</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default DailyPulseWidget;
