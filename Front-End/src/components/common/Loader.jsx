import React from "react";
import "./Loader.css";

function Loader({
  label = "Loading enterprise workspace...",
  sublabel = "Synchronizing with live HRMS backend...",
  size = "md",
  fullscreen = false,
  variant = "aurora",
}) {
  const containerClass = [
    "hrms-quantum-loader",
    `loader-${size}`,
    `loader-${variant}`,
    fullscreen ? "loader-fullscreen" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClass} role="status" aria-live="polite">
      <div className="loader-pod-card">
        {/* Futuristic Multi-Ring Orbital Spinner */}
        <div className="orbital-spinner-chassis">
          <div className="orbital-ring orbital-outer" />
          <div className="orbital-ring orbital-middle" />
          <div className="orbital-ring orbital-inner" />
          <div className="orbital-core-orb">
            <span className="core-pulse-beacon" />
          </div>
          <div className="orbital-ambient-glow" />
        </div>

        {/* Dynamic Typography & Subtitle */}
        <div className="loader-text-group">
          <div className="loader-primary-label">
            <span>{label}</span>
            <span className="loader-animated-dots">
              <span className="dot dot-1">.</span>
              <span className="dot dot-2">.</span>
              <span className="dot dot-3">.</span>
            </span>
          </div>
          {sublabel && (
            <div className="loader-secondary-subtext">{sublabel}</div>
          )}
        </div>

        {/* Sleek Shimmer Track */}
        <div className="loader-shimmer-track">
          <div className="loader-shimmer-beam" />
        </div>
      </div>
    </div>
  );
}

export default Loader;
