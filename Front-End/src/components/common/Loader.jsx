import React from "react";
import "./Loader.css";

function Loader({ label = "Loading data..." }) {
  return (
    <div className="loader-container" role="status" aria-live="polite">
      <div className="spinner"></div>
      <div className="loader-label">{label}</div>
    </div>
  );
}

export default Loader;
