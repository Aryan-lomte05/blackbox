import React from 'react';

/**
 * Film grain noise overlay inspired by high-end design portfolios (shantanav.in).
 * Adds rich organic texture and eliminates flat digital plastic surfaces.
 */
export const GrainOverlay: React.FC = () => {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden opacity-[0.035] mix-blend-screen">
      <svg
        className="absolute -inset-[100%] h-[300%] w-[300%] animate-noise"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <filter id="blackbox-noise-filter">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="4"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#blackbox-noise-filter)" />
      </svg>
    </div>
  );
};
