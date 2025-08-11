// src/components/LoadingOverlay.js
import React from 'react';

const LoadingOverlay = () => {
  return (
    <div className="loading-overlay">
      <div className="spinner">
        <svg width="48" height="48" viewBox="0 0 50 50">
          <circle 
            cx="25" 
            cy="25" 
            r="20" 
            stroke="currentColor" 
            strokeWidth="5" 
            fill="none" 
            strokeDasharray="1, 200" 
            strokeLinecap="round"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 25 25"
              to="360 25 25"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
      </div>
      <p>Идет обработка видео...</p>
    </div>
  );
};

export default LoadingOverlay;