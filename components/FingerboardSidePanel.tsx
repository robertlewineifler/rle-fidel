import React from 'react';
import { Play, Volume2, Eye, EyeOff, ArrowRight } from 'lucide-react';
import KeySignature from './KeySignature';

interface FingerboardSidePanelProps {
  effectiveAccidentals: number;
  effectiveRootName: string;
  isMajor: boolean;
  minorVariant: string;
  isPlayingScale: boolean;
  showChordOutlines: boolean;
  isSilent: boolean;
  formatNoteLabel: (name: string, isMinor: boolean) => string;
  onPlayScale: () => void;
  onToggleChordOutlines: () => void;
  transpose: number;
  originalRoot: string;
}

const FingerboardSidePanel: React.FC<FingerboardSidePanelProps> = ({
  effectiveAccidentals,
  effectiveRootName,
  isMajor,
  minorVariant,
  isPlayingScale,
  showChordOutlines,
  isSilent,
  formatNoteLabel,
  onPlayScale,
  onToggleChordOutlines,
  transpose,
  originalRoot
}) => {
  return (
    <div className="w-[140px] flex-none flex flex-col gap-3">
      <div className="flex items-center justify-center gap-1.5">
        <div className={`h-2 w-2 rounded-full ${isSilent ? 'bg-slate-600' : 'bg-green-500 animate-pulse'}`}></div>
        <span className="text-[9px] font-mono text-slate-500 uppercase">Live</span>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-xl backdrop-blur-md">
        <div className="bg-slate-200 rounded-lg p-2 shadow-inner">
          <KeySignature accidentals={effectiveAccidentals} />
        </div>
        <div className="text-center mt-1">
          {transpose === 0 ? (
            <>
              <div className="text-xl font-bold text-slate-100 leading-none">
                {formatNoteLabel(effectiveRootName, !isMajor)}
              </div>
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mt-0.5">
                {isMajor ? 'Dur' : minorVariant}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-bold text-slate-400 leading-tight">
                {formatNoteLabel(originalRoot, !isMajor)} <span className="text-[10px] uppercase">{isMajor ? 'Dur' : minorVariant}</span>
              </div>
              <div className="flex items-center justify-center text-slate-500 my-0.5">
                <ArrowRight size={14} />
              </div>
              <div className="text-xl font-bold text-slate-100 leading-tight">
                {formatNoteLabel(effectiveRootName, !isMajor)} <span className="text-[10px] text-slate-400 uppercase">{isMajor ? 'Dur' : minorVariant}</span>
              </div>
              <div className="text-[9px] font-medium text-amber-400 mt-1">
                {transpose > 0 ? '+' : ''}{transpose} Halbt{Math.abs(transpose) === 1 ? 'on' : 'öne'}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <button
          onClick={onPlayScale}
          disabled={isPlayingScale}
          className={`flex flex-col items-center justify-center h-12 rounded-xl border transition-all
            ${isPlayingScale 
              ? 'bg-amber-500 text-slate-900 border-amber-400 shadow-lg' 
              : 'bg-slate-800 text-amber-500 border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
        >
          {isPlayingScale ? <Volume2 size={16} className="animate-pulse" /> : <Play size={16} />}
          <span className="text-[9px] mt-1 font-bold uppercase">Scale</span>
        </button>

        <button
          onClick={onToggleChordOutlines}
          className={`flex flex-col items-center justify-center h-12 rounded-xl border transition-all
            ${showChordOutlines 
              ? 'bg-slate-800 text-emerald-400 border-slate-700 hover:bg-slate-700' 
              : 'bg-slate-800/50 text-slate-500 border-slate-700/50 hover:bg-slate-700 hover:text-slate-300'
            }`}
        >
          {showChordOutlines ? <Eye size={16} /> : <EyeOff size={16} />}
          <span className="text-[9px] mt-1 font-bold uppercase">Akkorde</span>
        </button>
      </div>

      <div className="p-3 bg-slate-800/30 rounded-xl text-center">
        <p className="text-[9px] text-slate-500 leading-relaxed">
          <strong>1-8</strong> = Tonleiter
        </p>
      </div>
    </div>
  );
};

export default FingerboardSidePanel;
