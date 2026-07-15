
import React from 'react';
import { TunerStatus } from '../types';

interface NeedleDisplayProps {
  status: TunerStatus;
  targetFrequency: number;
}

const NeedleDisplay: React.FC<NeedleDisplayProps> = ({ status, targetFrequency }) => {
  // Clamp cents between -50 and 50 for the display
  // Handle NaN or invalid cents safely by defaulting to 0
  const safeCents = (Number.isNaN(status.cents) || !isFinite(status.cents)) ? 0 : status.cents;
  const clampedCents = Math.max(-50, Math.min(50, safeCents));
  
  // Calculate rotation angle: -50 cents = -45deg, 0 cents = 0deg, +50 cents = +45deg
  const rotation = (clampedCents / 50) * 45;

  let color = "#475569"; // slate-600
  let statusText = "Warte auf Ton...";
  let currentRotation = 0;
  let statusColorClass = "text-slate-600";

  if (!status.isSilent && status.noteName && status.frequency > 0) {
    currentRotation = rotation;
    if (Math.abs(safeCents) < 5) {
      color = "#22c55e"; // green-500
      statusText = "Perfekt";
      statusColorClass = "text-green-400";
    } else if (Math.abs(safeCents) < 15) {
      color = "#facc15"; // yellow-400
      statusText = safeCents < 0 ? "Etwas zu tief" : "Etwas zu hoch";
      statusColorClass = "text-yellow-400";
    } else {
      color = "#ef4444"; // red-500
      statusText = safeCents < 0 ? "Zu tief" : "Zu hoch";
      statusColorClass = "text-red-400";
    }
  }

  return (
    <div className="relative w-full h-full min-h-[160px] flex flex-col items-center justify-center pointer-events-none select-none">
      {/* Responsive SVG Container */}
      <svg 
        viewBox="0 0 300 150" 
        className="w-full h-full max-h-[300px]"
        preserveAspectRatio="xMidYMax meet"
      >
         <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
               <feGaussianBlur stdDeviation="2" result="blur" />
               <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
         </defs>

         {/* Background Arc */}
         <path 
           d="M 30 140 A 120 120 0 0 1 270 140" 
           fill="none" 
           stroke="#1e293b" 
           strokeWidth="20" 
           strokeLinecap="round" 
         />
         
         {/* Center Marker */}
         <line x1="150" y1="20" x2="150" y2="40" stroke="#64748b" strokeWidth="3" />
         
         {/* Tick Marks */}
         {/* -45 deg */}
         <line x1="65" y1="55" x2="75" y2="65" stroke="#334155" strokeWidth="2" />
         {/* +45 deg */}
         <line x1="235" y1="55" x2="225" y2="65" stroke="#334155" strokeWidth="2" />

         {/* Needle */}
         <g transform={`rotate(${currentRotation} 150 140)`} className="transition-transform duration-300 ease-out">
            <line 
                x1="150" y1="140" x2="150" y2="30" 
                stroke={color} 
                strokeWidth="4" 
                strokeLinecap="round"
                filter={status.isSilent ? "" : "url(#glow)"}
            />
         </g>

         {/* Pivot Point */}
         <circle cx="150" cy="140" r="8" fill="#e2e8f0" />
      </svg>

      {/* Digital Readout Overlay */}
      <div className="absolute bottom-0 flex flex-col items-center translate-y-2">
        <div className={`text-4xl lg:text-5xl font-bold tracking-tighter ${statusColorClass} transition-colors duration-200 drop-shadow-lg`}>
           {status.isSilent ? "--" : status.noteName}
        </div>
        <div className={`mt-1 text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur ${statusColorClass} border border-slate-700/50`}>
          {statusText}
        </div>
        {!status.isSilent && status.frequency > 0 && (
             <div className="text-[10px] text-slate-500 font-mono mt-1">
                {Math.round(status.frequency)} Hz ({safeCents > 0 ? '+' : ''}{Math.round(safeCents)} ¢)
             </div>
        )}
      </div>
    </div>
  );
};

export default NeedleDisplay;
