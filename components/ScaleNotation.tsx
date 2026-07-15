import React, { useMemo } from 'react';
import { NOTE_TO_INDEX } from '../constants';

interface ScaleNotationProps {
  rootName: string; 
  intervals: number[];
  diatonicSteps?: number[];
  keySignatureCount: number;
  activeFreq?: number | null;
  modeLabel?: string; 
  highlightNoteName?: string;
  hideBackground?: boolean;
  hideRootHighlight?: boolean;
  keyRootName?: string;
  keyIntervals?: number[];
}

const DIATONIC_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
const FREQ_C4 = 440 * Math.pow(2, -9/12);

const ScaleNotation: React.FC<ScaleNotationProps> = ({ 
   rootName, 
   intervals, 
   diatonicSteps,
   keySignatureCount, 
   activeFreq,
   modeLabel = "",
   highlightNoteName,
   hideBackground,
   hideRootHighlight,
   keyRootName,
   keyIntervals
}) => {
  
  const parseRoot = (name: string) => {
    if (name === 'H') return { diatonicIndex: 6, accidental: 0 }; 
    if (name === 'B') return { diatonicIndex: 6, accidental: -1 }; 
    const baseChar = name.charAt(0).toUpperCase();
    let accidental = 0;
    if (name.endsWith('is')) {
        accidental = 1;
    } else if (name.endsWith('es') || name === 'As' || name === 'Es') {
        accidental = -1;
    }
    
    const diatonicIndex = ['C', 'D', 'E', 'F', 'G', 'A', 'B'].indexOf(baseChar);
    return { diatonicIndex: diatonicIndex !== -1 ? diatonicIndex : 0, accidental };
  };

  const { diatonicIndex: rootDiatonic, accidental: rootAccidental } = parseRoot(rootName);
  const startOctaveOffset = 0; 

  const notes = useMemo(() => {
    const result = [];
    const rootSemitone = DIATONIC_OFFSETS[rootDiatonic] + rootAccidental;
    
    const fullIntervals = [...intervals];
    if (fullIntervals.length === 7) fullIntervals.push(12);

    for (let i = 0; i < fullIntervals.length; i++) {
        const stepOffset = diatonicSteps ? diatonicSteps[i] : i;
        const currentDiatonicRaw = rootDiatonic + stepOffset;
        const currentDiatonic = currentDiatonicRaw % 7;
        const octaveShift = Math.floor(currentDiatonicRaw / 7);

        const targetAbsSemitone = rootSemitone + fullIntervals[i];
        
        let accidentalVal = targetAbsSemitone - (DIATONIC_OFFSETS[currentDiatonic] + (startOctaveOffset + octaveShift) * 12);
        const visualStep = currentDiatonic + ((startOctaveOffset + octaveShift) * 7);
        const frequency = FREQ_C4 * Math.pow(2, targetAbsSemitone / 12);

        result.push({
            id: i,
            visualStep,
            accidental: accidentalVal,
            isRoot: i === 0 || i === fullIntervals.length - 1,
            frequency,
            semitoneDistance: fullIntervals[i],
            absSemitone: targetAbsSemitone
        });
    }
    return result;
  }, [rootDiatonic, rootAccidental, intervals, startOctaveOffset, diatonicSteps]); 

  const keyRootSemitone = useMemo(() => {
    if (!keyRootName) return -1;
    const parsed = parseRoot(keyRootName);
    return ((DIATONIC_OFFSETS[parsed.diatonicIndex] + parsed.accidental) % 12 + 12) % 12;
  }, [keyRootName]);

  const keyIntervalSet = useMemo(() => {
    if (!keyIntervals) return null;
    return new Set(keyIntervals.map(i => ((i % 12) + 12) % 12));
  }, [keyIntervals]);

  const LINE_SPACING = 10;
  const NOTE_RADIUS = 5;
  const getY = (step: number) => 30 + (11 - step) * (LINE_SPACING / 2);

  const isSharpKey = keySignatureCount > 0;
  const keySigCount = Math.abs(keySignatureCount);
  
  // Y positions mapped directly to staff lines for key signature
  // F5=35, C5=50, G5=30, D5=45, A4=60, E5=40, B4=55
  const sharpY = [35, 50, 30, 45, 60, 40, 55];
  // B4=55, E5=40, A4=60, D5=45, G4=65, C5=50, F4=70
  const flatY = [55, 40, 60, 45, 65, 50, 70];

  // Dynamic start position to ensure notes never overlap with key signature
  const STAFF_X_START = 80 + keySigCount * 14 + 10; 
  const NOTE_SPACING = 75; 
  
  const dynamicWidth = Math.max(700, STAFF_X_START + (notes.length * NOTE_SPACING) + 40);

  const formatModeLabel = () => {
    if (!modeLabel) return [];
    if (modeLabel === 'Dur') return ['Dur'];
    const parts = modeLabel.split(' ');
    if (parts.length > 1) {
        return [parts[0], parts.slice(1).join(' ').replace('(', '').replace(')', '')];
    }
    return [modeLabel];
  };

  const labelParts = formatModeLabel();
  
  // Highlight Note logic
  const highlightIdx = highlightNoteName 
    ? (NOTE_TO_INDEX[highlightNoteName.toLowerCase()] ?? NOTE_TO_INDEX[highlightNoteName] ?? -1) 
    : -1;

  const getNoteName = (absSemitone: number) => {
    const noteNamesSharp = ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'Ais', 'H'];
    const noteNamesFlat = ['C', 'Des', 'D', 'Es', 'E', 'F', 'Ges', 'G', 'As', 'A', 'B', 'H'];
    const useFlats = keySignatureCount < 0;
    return useFlats ? noteNamesFlat[(absSemitone + 120) % 12] : noteNamesSharp[(absSemitone + 120) % 12];
  };

  return (
    <div className={`w-full h-full flex justify-center items-center ${!hideBackground ? 'bg-[#fdf6e3] rounded-lg border border-slate-300 p-2 shadow-inner' : ''}`}>
      <svg width="100%" height="100%" viewBox={`0 0 ${dynamicWidth} 150`} preserveAspectRatio="xMidYMid meet" className="select-none w-full">
        {/* Staff Lines (E4 to F5) */}
        {[2, 4, 6, 8, 10].map(step => (
            <line 
                 key={step} 
                 x1="0" y1={getY(step)} 
                 x2="100%" y2={getY(step)} 
                 stroke="#666" strokeWidth="1" 
             />
        ))}

        {/* Treble Clef - properly sized and aligned around G line (y=65) */}
        <text x="15" y={getY(8)} fontSize="65" fontFamily="Times New Roman, serif" fill="#000" textAnchor="middle" dominantBaseline="central">𝄞</text>
        
        {/* Key Label under Clef */}
        <g transform={`translate(25, ${getY(0) + 35})`}>
            <text x="0" y="0" fontSize="18" fontWeight="bold" fill="#444" textAnchor="middle" fontFamily="sans-serif">
                {rootName}
            </text>
            {labelParts.map((part, i) => (
                <text key={i} x="0" y={14 + (i * 12)} fontSize="12" fill="#666" textAnchor="middle" fontFamily="sans-serif">
                    {part}
                </text>
            ))}
        </g>

        {/* Key Signature */}
        {Array.from({ length: keySigCount }).map((_, i) => {
             const x = 40 + (i * 14);
             const y = isSharpKey ? sharpY[i] : flatY[i];
             return (
                 <text
                     key={`keysig-${i}`}
                     x={x}
                     y={y - 1}
                     fontSize="26"
                     fill="#000"
                     fontFamily="Arial, sans-serif"
                     dominantBaseline="central"
                     textAnchor="middle"
                 >
                    {isSharpKey ? '♯' : '♭'}
                 </text>
             );
        })}

        {/* Notes */}
        {notes.map((note, i) => {
            const x = STAFF_X_START + (i * NOTE_SPACING);
            const y = getY(note.visualStep);
            
            const stemUp = note.visualStep < 7;
            const stemHeight = 35;
            
            const isNoteActiveFreq = activeFreq && Math.abs(12 * Math.log2(activeFreq / note.frequency)) < 0.4;
            const noteIdx = (note.absSemitone + 3) % 12;
            const isHighlightNote = highlightIdx !== -1 && noteIdx === highlightIdx;
            
            const isKeyRoot = !hideRootHighlight && note.isRoot;
            const headFill = isNoteActiveFreq ? "#fbbf24" : isHighlightNote ? "#d97706" : isKeyRoot ? "#f59e0b" : "#000";
            const strokeColor = isNoteActiveFreq ? "#d97706" : isHighlightNote ? "#d97706" : isKeyRoot ? "#d97706" : "#000";

            const keyDistance = keyRootSemitone >= 0 && keyIntervalSet
              ? ((note.absSemitone - keyRootSemitone) % 12 + 12) % 12
              : null;
            const inKey = keyDistance !== null && keyIntervalSet!.has(keyDistance);
            const displayDistance = keyRootName
              ? (inKey ? keyDistance : undefined)
              : note.semitoneDistance;

            const ledgers = [];
            for (let s = 0; s >= note.visualStep; s -= 2) {
                if (s % 2 === 0 && s <= 0) ledgers.push(s);
            }
            for (let s = 12; s <= note.visualStep; s += 2) {
                if (s >= 12) ledgers.push(s);
            }

            return (
                <g key={note.id}>
                    {isNoteActiveFreq && (
                        <circle cx={x} cy={y} r={NOTE_RADIUS * 3} fill="orange" opacity="0.3" filter="blur(4px)" />
                    )}
                    
                    {ledgers.map(ls => (
                        <line 
                            key={ls}
                            x1={x - 10} y1={getY(ls)}
                            x2={x + 10} y2={getY(ls)}
                            stroke={isNoteActiveFreq || isHighlightNote ? "#d97706" : "#000"} 
                            strokeWidth="1"
                        />
                    ))}

                    {note.accidental !== 0 && (
                        <text 
                             x={x - 14} 
                             y={y - 1} 
                             fontSize="26" 
                             fill={strokeColor} 
                             textAnchor="middle"
                             fontFamily="Arial, sans-serif"
                             dominantBaseline="central"
                        >
                            {note.accidental > 0 ? '♯' : note.accidental < 0 ? '♭' : '♮'}
                        </text>
                    )}

                    <ellipse 
                         cx={x} cy={y} 
                         rx={NOTE_RADIUS + 1} ry={NOTE_RADIUS} 
                         fill={headFill} 
                         stroke={strokeColor} 
                         strokeWidth={isNoteActiveFreq || isHighlightNote ? 1 : 0}
                         transform={`rotate(-15 ${x} ${y})`}
                    />
                    
                    <line 
                         x1={stemUp ? x + NOTE_RADIUS : x - NOTE_RADIUS} 
                         y1={y} 
                         x2={stemUp ? x + NOTE_RADIUS : x - NOTE_RADIUS} 
                         y2={stemUp ? y - stemHeight : y + stemHeight}
                         stroke={strokeColor} 
                         strokeWidth="1.5"
                    />

                    {/* Semitone Distance Label */}
                    <text
                        x={x}
                        y={110} 
                        fontSize="14"
                        fill="#666"
                        textAnchor="middle"
                        className="font-mono font-bold"
                    >
                        {displayDistance !== undefined ? displayDistance : '\u00A0'}
                    </text>
                    {/* Note Name */}
                    <text
                        x={x}
                        y={126} 
                        fontSize="16"
                        fill="#888"
                        textAnchor="middle"
                        fontFamily="sans-serif"
                    >
                        {getNoteName(note.absSemitone)}
                    </text>
                </g>
            );
        })}
      </svg>
    </div>
  );
};

export default ScaleNotation;
