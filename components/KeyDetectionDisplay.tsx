
import React from 'react';
import { RotateCcw, Music2, BarChart3, Ear, Activity, Mic, Square, ArrowUpRight } from 'lucide-react';
import { GERMAN_NOTE_NAMES } from '../constants';
import { KeyResult } from '../services/keyDetector';

interface KeyDetectionDisplayProps {
  keyCandidates: KeyResult[];
  noteCounts: number[];
  onReset: () => void;
  isRecording: boolean;
  onToggleRecording: () => void;
  estimatedPitch: number | null;
  isAnalyzing: boolean;
  analysisProgress: number;
  onApplyKey: (root: string, mode: string) => void;
}

const KeyDetectionDisplay: React.FC<KeyDetectionDisplayProps> = ({ 
  keyCandidates, 
  noteCounts, 
  onReset,
  isRecording,
  onToggleRecording,
  estimatedPitch,
  isAnalyzing,
  analysisProgress,
  onApplyKey
}) => {
  // Calculate max for normalization of bars
  const maxCount = Math.max(...noteCounts, 1);
  const totalNotes = noteCounts.reduce((a, b) => a + b, 0);

  // Top result
  const detectedKey = keyCandidates.length > 0 ? keyCandidates[0] : null;
  // Next 3 candidates
  const alternativeKeys = keyCandidates.slice(1, 4);

  // Confidence percentage
  const confidencePercent = detectedKey ? Math.round(detectedKey.confidence * 100) : 0;
  
  // Color based on confidence
  let confidenceColor = "bg-red-500";
  if (confidencePercent > 40) confidenceColor = "bg-yellow-500";
  if (confidencePercent > 70) confidenceColor = "bg-green-500";

  // Helper to format key name consistent with FingerboardDisplay
  const formatKeyDisplay = (root: string, mode: string) => {
    let displayRoot = root;
    if (displayRoot === 'Ais') displayRoot = 'B';
    
    // Check mode
    const isMinor = mode.includes('Moll');
    if (isMinor) {
        displayRoot = displayRoot.toLowerCase();
    } else {
        displayRoot = displayRoot.charAt(0).toUpperCase() + displayRoot.slice(1);
    }
    return displayRoot;
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Top Controls: Estimated Pitch Only */}
      <div className="flex w-full justify-end items-start h-6">
         {/* Estimated Pitch Display */}
         {estimatedPitch && (
           <div className="flex flex-col items-end">
             <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-0.5 flex items-center gap-1">
               <Ear size={10} />
               Erkannter A4
             </div>
             <div className="text-amber-500 font-mono font-bold text-sm bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
               {estimatedPitch} Hz
             </div>
           </div>
         )}
      </div>

      {/* Main Key Display */}
      <div className="relative flex flex-col items-center justify-center pt-2 pb-2 w-full">
        <div className="text-slate-400 text-xs font-medium uppercase tracking-widest mb-2 flex items-center gap-2">
          <Music2 size={14} />
          Erkannte Tonart
        </div>
        
        <div className={`
          text-5xl lg:text-6xl font-bold tracking-tight transition-all duration-300 mb-2
          ${detectedKey ? 'text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]' : 'text-slate-700'}
        `}>
          {isAnalyzing ? (
            <div className="flex flex-col items-center">
              <span className="text-xl text-amber-500 font-medium mb-1">{analysisProgress}%</span>
              <div className="w-24 h-1 bg-slate-800 rounded-full overflow-hidden">
                 <div className="h-full bg-amber-500 transition-all duration-200" style={{width: `${analysisProgress}%`}}></div>
              </div>
            </div>
          ) : detectedKey ? (
            <div className="flex flex-col items-center animate-in zoom-in duration-300">
               <span>
                 {formatKeyDisplay(detectedKey.root, detectedKey.mode)}
                 <span className="text-2xl text-slate-400 font-light ml-2">{detectedKey.mode}</span>
               </span>
            </div>
          ) : (
            "--"
          )}
        </div>

        {/* Sync Button (Apply to Fingerboard) */}
        {detectedKey && !isAnalyzing && (
            <button 
                onClick={() => onApplyKey(detectedKey.root, detectedKey.mode)}
                className="flex items-center gap-1.5 text-[10px] bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 hover:text-white px-3 py-1.5 rounded-full border border-indigo-500/30 transition-all mt-1 mb-2"
            >
                <ArrowUpRight size={12} />
                Auf Griffbrett anzeigen
            </button>
        )}

        {/* Confidence Meter */}
        <div className="w-full max-w-[180px] mt-1 flex flex-col items-center gap-1 mb-2">
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
             <div 
               className={`h-full transition-all duration-500 ease-out ${confidenceColor}`}
               style={{ width: `${confidencePercent}%` }}
             ></div>
          </div>
          <div className="flex justify-between w-full text-[9px] text-slate-500 font-medium uppercase">
            <span>Unsicher</span>
            <span className={confidencePercent > 70 ? "text-green-500" : ""}>{confidencePercent}% Sicher</span>
          </div>
        </div>

        {/* Alternative Candidates */}
        {alternativeKeys.length > 0 && !isAnalyzing && (
          <div className="flex gap-3 mt-1 opacity-60">
             {alternativeKeys.map((k, i) => (
                <div key={i} className="flex flex-col items-center text-[10px] text-slate-400">
                   <span className="font-bold">{formatKeyDisplay(k.root, k.mode)} {k.mode}</span>
                   <span className="text-[9px] opacity-70">{Math.round(k.confidence * 100)}%</span>
                </div>
             ))}
          </div>
        )}
        
        {/* Status Text / Control Button Area */}
        <div className="mt-4 flex flex-col items-center gap-2">
          
          {/* Main Toggle Button */}
          {!isAnalyzing && (
            <button
              onClick={onToggleRecording}
              className={`
                flex items-center gap-2 px-5 py-2 rounded-full font-bold shadow-lg transition-all active:scale-95 text-xs
                ${isRecording 
                  ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse' 
                  : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                }
              `}
            >
              {isRecording ? (
                 <>
                  <Square size={14} fill="currentColor" />
                  <span>Aufnahme beenden</span>
                 </>
              ) : (
                 <>
                  <Mic size={14} />
                  <span>Aufnahme beginnen</span>
                 </>
              )}
            </button>
          )}

          <div className="h-4">
            {isAnalyzing && (
              <span className="text-[10px] text-amber-500 font-medium animate-pulse">Analysiere Aufnahme...</span>
            )}
            {!isAnalyzing && isRecording && (
              <span className="text-[10px] text-red-500 font-medium animate-pulse flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                 Aufnahme läuft... ({totalNotes})
              </span>
            )}
            {!isAnalyzing && !isRecording && (
              detectedKey ? (
                  <span className="text-[10px] text-green-500">Analyse abgeschlossen.</span>
              ) : (
                  <span className="text-[10px] text-slate-500">Drücke Aufnahme, um Tonart zu analysieren.</span>
              )
            )}
          </div>
        </div>
      </div>

      {/* Bar Chart Visualization */}
      <div className="w-full bg-slate-800/50 rounded-xl p-3 border border-slate-700">
        <div className="flex items-center justify-between mb-2">
           <span className="text-[10px] text-slate-400 flex items-center gap-1">
             <BarChart3 size={10}/>
             Statistik
           </span>
           <div className="flex items-center gap-2">
             <span className="text-[9px] text-slate-500 font-mono flex items-center gap-1">
               <Activity size={9} /> {totalNotes}
             </span>
           </div>
        </div>

        <div className="flex items-end justify-between h-20 gap-[2px]">
          {GERMAN_NOTE_NAMES.map((note, index) => {
            const count = noteCounts[index];
            const heightPercent = maxCount > 0 ? (count / maxCount) * 100 : 0;
            
            let isHighlight = false;
            if (detectedKey) {
                if (detectedKey.root === note) isHighlight = true;
                if (note === 'Ais' && detectedKey.root === 'B') isHighlight = true;
                if (note === 'Dis' && detectedKey.root === 'Es') isHighlight = true;
            }

            return (
              <div key={note} className="flex flex-col items-center gap-1 flex-1 group h-full justify-end">
                <div className="relative w-full h-full flex items-end">
                   {/* Background Track */}
                   <div className="absolute inset-x-0 bottom-0 top-0 bg-slate-800/50 rounded-t-sm"></div>
                   
                   {/* Bar */}
                   <div 
                      className={`w-full rounded-t-sm transition-all duration-300 ${isHighlight ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-indigo-500/60 group-hover:bg-indigo-400/80'}`}
                      style={{ height: `${Math.max(heightPercent, 2)}%` }}
                   ></div>
                </div>
                <span className={`text-[8px] font-bold ${isHighlight ? 'text-amber-500' : 'text-slate-600'}`}>
                  {note}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default KeyDetectionDisplay;
