import React from 'react';
import { RotateCcw } from 'lucide-react';
import { PREFERRED_ROOT_NAMES_MAJOR, PREFERRED_ROOT_NAMES_MINOR, NOTE_TO_INDEX } from '../constants';

interface FingerboardControlsProps {
  root: string;
  isMajor: boolean;
  minorVariant: string;
  transpose: number;
  onRootChange: (root: string) => void;
  onModeChange: (isMajor: boolean) => void;
  onVariantChange: (variant: string) => void;
  onTransposeChange: (semitones: number) => void;
  getRelativeMinorLabel: (majorRoot: string) => string;
  formatNoteLabel: (name: string, isMinor: boolean) => string;
  hideTranspose?: boolean;
  compact?: boolean;
}

const ROOT_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

const FingerboardControls: React.FC<FingerboardControlsProps> = ({
  root,
  isMajor,
  minorVariant,
  transpose,
  onRootChange,
  onModeChange,
  onVariantChange,
  onTransposeChange,
  getRelativeMinorLabel,
  formatNoteLabel,
  hideTranspose = false,
  compact = false
}) => {
  const currentRootIndex = NOTE_TO_INDEX[root];

  return (
    <div className={`w-full flex flex-col gap-[2px] ${compact ? '' : 'bg-slate-900/80 rounded-2xl border border-slate-800 p-3 shadow-xl shrink-0'}`}>
      <div className="grid grid-cols-12 w-full gap-[1px]">
        {ROOT_INDICES.map((idx) => {
          const currentMajorRoot = PREFERRED_ROOT_NAMES_MAJOR[idx];
          const relMinorRoot = getRelativeMinorLabel(currentMajorRoot);

          const isMajorActive = isMajor && root === currentMajorRoot;
          const isMinorActive = !isMajor && root.toLowerCase() === relMinorRoot.toLowerCase();
          
          return (
            <div key={idx} className="flex flex-col min-w-0">
              <button
                onClick={() => { onRootChange(currentMajorRoot); onModeChange(true); }}
                className={`h-8 w-full rounded-t-sm text-[10px] font-bold transition-all border-x border-t flex items-center justify-center p-0
                  ${isMajorActive
                    ? 'bg-amber-500 text-slate-900 border-amber-400 z-10' 
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                  }`}
              >
                {formatNoteLabel(currentMajorRoot, false)}
              </button>
              <button
                onClick={() => { onRootChange(relMinorRoot.charAt(0).toUpperCase() + relMinorRoot.slice(1)); onModeChange(false); }}
                className={`h-8 w-full rounded-b-sm text-[10px] transition-all border-x border-b flex items-center justify-center p-0
                  ${isMinorActive
                    ? 'bg-indigo-500 text-white border-indigo-400 z-10 font-bold' 
                    : 'bg-slate-800/50 text-slate-500 border-slate-700/50 hover:bg-slate-700 hover:text-slate-300'
                  }`}
              >
                {formatNoteLabel(relMinorRoot, true)}
              </button>
            </div>
          );
        })}
      </div>

      {!hideTranspose && (
      <div className="w-full mt-1">
        <div className="flex w-full justify-between items-center gap-[1px] bg-slate-800/50 rounded-lg p-[1px] border border-slate-700">
          <button 
            onClick={() => onTransposeChange(0)}
            disabled={transpose === 0}
            className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-l text-slate-400 disabled:opacity-30 transition-colors"
          >
            <RotateCcw size={12} />
          </button>

          {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((offset) => {
            const isSelected = transpose === offset;
            const isBase = offset === 0;
            
            const targetIndex = (currentRootIndex + offset + 24) % 12;
            let targetName = isMajor 
              ? PREFERRED_ROOT_NAMES_MAJOR[targetIndex] 
              : PREFERRED_ROOT_NAMES_MINOR[targetIndex];
            
            let mainLabel = targetName.charAt(0).toUpperCase() + targetName.slice(1);
            if (targetName === 'Ais') mainLabel = 'B';
            if (!isMajor) mainLabel = mainLabel.toLowerCase();

            const offsetLabel = offset > 0 ? `+${offset}` : offset.toString();

            return (
              <button
                key={offset}
                onClick={() => onTransposeChange(offset)}
                className={`flex flex-col items-center justify-center h-8 flex-1 transition-all duration-200
                  ${isSelected 
                    ? 'bg-amber-600 text-white z-10 rounded shadow-sm' 
                    : isBase
                      ? 'bg-slate-700 text-indigo-300 hover:bg-slate-600'
                      : 'text-slate-500 hover:bg-slate-700/50 hover:text-slate-300'
                  }`}
              >
                <span className="text-[10px] font-bold leading-none">{mainLabel}</span>
                {!isBase && <span className="text-[8px] opacity-60 leading-none scale-75">{offsetLabel}</span>}
              </button>
            );
          })}
        </div>
      </div>
      )}

      <div className="w-full mt-1">
        <div className={`grid grid-cols-3 gap-[1px] transition-opacity duration-300 ${isMajor ? 'opacity-40 pointer-events-none grayscale' : 'opacity-100'}`}>
          {['Natürlich', 'Harmonisch', 'Melodisch'].map((variantShort) => {
            const fullVariant = `Moll (${variantShort})`;
            const isActive = minorVariant === fullVariant;
            return (
              <button
                key={variantShort}
                onClick={() => onVariantChange(fullVariant)}
                disabled={isMajor}
                className={`h-6 flex items-center justify-center text-[9px] font-medium transition-all border first:rounded-l last:rounded-r
                  ${isActive 
                    ? 'bg-indigo-500 text-white border-indigo-400 z-10 shadow-sm' 
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                  }`}
              >
                {variantShort}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FingerboardControls;
