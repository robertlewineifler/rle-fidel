import React from 'react';
import { PREFERRED_ROOT_NAMES_MAJOR, PREFERRED_ROOT_NAMES_MINOR, NOTE_TO_INDEX } from '../constants';

interface TransposeBarProps {
  root: string;
  isMajor: boolean;
  transpose: number;
  onTransposeChange: (semitones: number) => void;
}

const OFFSETS = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];

const TransposeBar: React.FC<TransposeBarProps> = ({
  root, isMajor, transpose, onTransposeChange,
}) => {
  const currentRootIndex = NOTE_TO_INDEX[root] ?? 3;

  return (
    <div className="w-full">
      <div className="flex w-full gap-[1px] bg-slate-800/50 rounded-t-lg p-[1px] border border-slate-700 border-b-0">
        {OFFSETS.map((offset) => {
          const isSelected = transpose === offset || (Math.abs(transpose) === 6 && Math.abs(offset) === 6);
          const isBase = offset === 0;
          const isSelectedNonBase = isSelected && !isBase;

          const targetIndex = (currentRootIndex + offset + 24) % 12;
          let targetName = isMajor
            ? PREFERRED_ROOT_NAMES_MAJOR[targetIndex]
            : PREFERRED_ROOT_NAMES_MINOR[targetIndex];
          let mainLabel = targetName.charAt(0).toUpperCase() + targetName.slice(1);
          if (targetName === 'Ais') mainLabel = 'B';
          if (!isMajor) mainLabel = mainLabel.toLowerCase();

          const keyFill = isMajor ? 'bg-amber-500' : 'bg-indigo-500';
          const keyText = isMajor ? 'text-slate-900' : 'text-white';
          const keyBorder = isMajor ? 'border-amber-500' : 'border-indigo-500';

          let btnClass = 'border-2 border-transparent text-slate-500 hover:bg-slate-700/50 hover:text-slate-300';
          if (isBase) {
            btnClass = `${keyFill} ${keyText} rounded shadow-sm`;
          } else if (isSelectedNonBase) {
            btnClass = `border-2 ${keyBorder} bg-slate-700 text-white rounded`;
          }

          return (
            <button
              key={offset}
              onClick={() => onTransposeChange(offset)}
              className={`flex items-center justify-center h-10 flex-1 outline-none ${btnClass}`}
            >
              <span className="text-base font-bold leading-none">{mainLabel}</span>
            </button>
          );
        })}
      </div>
      <div className="flex w-full gap-[1px] bg-slate-800/50 rounded-b-lg p-[1px] border border-slate-700 border-t-0">
        {OFFSETS.map((offset) => {
          if (offset === 0) {
            return <div key={offset} className="flex-1 h-5" />;
          }
          const isSelected = transpose === offset || (Math.abs(transpose) === 6 && Math.abs(offset) === 6);
          const textColor = isSelected ? (isMajor ? 'text-amber-400' : 'text-indigo-400') : 'text-slate-600';
          const offsetLabel = offset > 0 ? `+${offset}` : offset.toString();
          return (
            <div key={offset} className="flex-1 flex items-center justify-center h-5">
              <span className={`text-xs leading-none ${textColor}`}>{offsetLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TransposeBar;
