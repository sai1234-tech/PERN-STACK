import React from 'react';
import './InitialLoader.css';

function InitialLoader() {
  return (
    <div className="initial-loader-wrapper">
      <div className="initial-loader-container">
        <div className="logo-pulse">
          {/* Abstract SVG Logo or Icon */}
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="var(--primary, #176b70)" />
            <path d="M2 17L12 22L22 17" stroke="var(--primary, #176b70)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 12L12 17L22 12" stroke="var(--primary, #176b70)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        
        <h2 className="loading-text">
          Loading Workspace<span className="dots"></span>
        </h2>
        
        <div className="progress-bar-container">
          <div className="progress-bar-fill"></div>
        </div>
        
        <p className="loading-subtext">Initializing secure environment...</p>
      </div>
    </div>
  );
}

export default InitialLoader;
