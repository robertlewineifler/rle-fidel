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
  arpeggio?: boolean;
}

const DIATONIC_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
const FREQ_C4 = 440 * Math.pow(2, -9/12);

const VIOLIN_MIN_ABS = -5;
const VIOLIN_MAX_ABS = 23;

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
   keyIntervals,
   arpeggio = false
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
  const rootSemitone = DIATONIC_OFFSETS[rootDiatonic] + rootAccidental;

  const noteToObject = (abs: number, idx: number, isRootForScale: boolean | ((i: number) => boolean)) => {
    const relSemitone = ((abs - rootSemitone) % 12 + 12) % 12;
    const octaveOffset = Math.floor((abs - rootSemitone) / 12);
    const intervalIdx = intervals.indexOf(relSemitone);

    let stepOffset: number;
    if (diatonicSteps && intervalIdx >= 0) {
      stepOffset = diatonicSteps[intervalIdx];
    } else {
      stepOffset = intervalIdx;
    }

    const currentDiatonicRaw = rootDiatonic + stepOffset + octaveOffset * 7;
    const currentDiatonic = ((currentDiatonicRaw % 7) + 7) % 7;
    const octaveShift = Math.floor(currentDiatonicRaw / 7);

    const accidentalVal = abs - (DIATONIC_OFFSETS[currentDiatonic] + octaveShift * 12);
    const visualStep = currentDiatonic + octaveShift * 7;
    const frequency = FREQ_C4 * Math.pow(2, abs / 12);

    const isRoot = typeof isRootForScale === 'function' ? isRootForScale(idx) : (relSemitone === 0);

    return {
      id: idx,
      visualStep,
      accidental: accidentalVal,
      isRoot,
      frequency,
      semitoneDistance: arpeggio ? relSemitone : abs - rootSemitone,
      absSemitone: abs
    };
  };

  // --- Arpeggio mode: multi-octave, violin range ---
  const arpeggioNotes = useMemo(() => {
    if (!arpeggio) return [];

    const uniqueAbs = new Set<number>();
    const minOct = Math.floor((VIOLIN_MIN_ABS - rootSemitone - 11) / 12);
    const maxOct = Math.ceil((VIOLIN_MAX_ABS - rootSemitone + 11) / 12);

    for (let oct = minOct; oct <= maxOct; oct++) {
      for (let i = 0; i < intervals.length; i++) {
        const abs = rootSemitone + intervals[i] + oct * 12;
        if (abs >= VIOLIN_MIN_ABS && abs <= VIOLIN_MAX_ABS) {
          uniqueAbs.add(abs);
        }
      }
    }

    const sorted = Array.from(uniqueAbs).sort((a, b) => a - b);
    if (sorted.length === 0) return [];

    let rootIdx = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (((sorted[i] - rootSemitone) % 12 + 12) % 12 === 0) {
        rootIdx = i;
        break;
      }
    }

    const pattern: number[] = [];
    for (let i = rootIdx; i < sorted.length; i++) pattern.push(sorted[i]);
    for (let i = sorted.length - 2; i >= 0; i--) pattern.push(sorted[i]);
    for (let i = 1; i <= rootIdx; i++) pattern.push(sorted[i]);

    return pattern.map((abs, idx) => noteToObject(abs, idx, false));
  }, [arpeggio, rootSemitone, intervals, diatonicSteps]);

  // --- Scale mode: single octave, original logic ---
  const scaleNotes = useMemo(() => {
    if (arpeggio) return [];

    const result: ReturnType<typeof noteToObject>[] = [];
    const fullIntervals = [...intervals];
    if (fullIntervals.length === 7) fullIntervals.push(12);

    for (let i = 0; i < fullIntervals.length; i++) {
      const abs = rootSemitone + fullIntervals[i];
      result.push(noteToObject(abs, i, (j: number) => j === 0 || j === fullIntervals.length - 1));
    }
    return result;
  }, [arpeggio, rootSemitone, intervals, diatonicSteps]);

  const notes = arpeggio ? arpeggioNotes : scaleNotes;

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
  const KEY_SIG_SPACING = arpeggio ? 16 : 14;
  const getY = (step: number) => 30 + (11 - step) * (LINE_SPACING / 2);

  const STAFF_MIN = 2;
  const STAFF_MAX = 10;

  const isSharpKey = keySignatureCount > 0;
  const keySigCount = Math.abs(keySignatureCount);
  
  const sharpY = useMemo(() => [10, 7, 12, 8, 4, 11, 6].map(s => getY(s)), [getY]);
  const flatY = useMemo(() => [6, 9, 5, 8, 4, 7, 2].map(s => getY(s)), [getY]);
  const ARPEGGIO_NOTE_SPACING = 35;
  const ARPEGGIO_ROOT_GAP = 25;
  const ARPEGGIO_FIRST_NOTE_GAP = 5;
  const ARPEGGIO_VIEWBOX_W = 800;
  const SCALE_VIEWBOX_W = 800;
  const ARPEGGIO_LEFT_PAD = 8;

  const STAFF_X_START = arpeggio
    ? 80 + keySigCount * KEY_SIG_SPACING + ARPEGGIO_FIRST_NOTE_GAP
    : 80 + keySigCount * KEY_SIG_SPACING + LINE_SPACING;

  const scaleNoteSpacing = (() => {
    if (notes.length <= 1) return 75;
    const available = SCALE_VIEWBOX_W - STAFF_X_START - 40;
    return available / (notes.length - 1);
  })();

  const NOTE_SPACING = arpeggio ? ARPEGGIO_NOTE_SPACING : scaleNoteSpacing;

  const noteXs = useMemo(() => {
    if (!arpeggio) return [] as number[];

    const rootIndices: number[] = [];
    for (let i = 0; i < notes.length; i++) {
      if (notes[i].isRoot) rootIndices.push(i);
    }

    const gapBefore = new Set<number>();
    const gapAfter = new Set<number>();

    for (let k = 0; k < rootIndices.length - 1; k++) {
      const r2 = rootIndices[k + 1];
      const prev = notes[r2 - 1];
      if (prev.absSemitone < notes[r2].absSemitone) {
        gapBefore.add(r2);
      } else {
        gapAfter.add(r2);
      }
    }

    const xs: number[] = [];
    let gap = 0;
    for (let i = 0; i < notes.length; i++) {
      if (gapBefore.has(i)) gap += ARPEGGIO_ROOT_GAP;
      xs.push(STAFF_X_START + i * NOTE_SPACING + gap);
      if (gapAfter.has(i)) gap += ARPEGGIO_ROOT_GAP;
    }
    return xs;
  }, [notes, STAFF_X_START, arpeggio]);

  const viewBoxW = arpeggio ? ARPEGGIO_VIEWBOX_W : SCALE_VIEWBOX_W;
  const staffLeft = arpeggio ? ARPEGGIO_LEFT_PAD : 0;
  const staffRight = arpeggio ? viewBoxW - ARPEGGIO_LEFT_PAD : viewBoxW;

  const minVisualStep = arpeggio ? Math.min(STAFF_MIN - 2, ...notes.map(n => n.visualStep)) : STAFF_MIN - 2;
  const maxVisualStep = arpeggio ? Math.max(STAFF_MAX + 2, ...notes.map(n => n.visualStep)) : STAFF_MAX + 2;

  const labelY1 = arpeggio ? getY(STAFF_MIN - 2) + 18 : 110;
  const labelY2 = arpeggio ? getY(STAFF_MIN - 2) + 36 : 126;
   
  const viewBoxTop = getY(maxVisualStep) - 25;
  const viewBoxBottom = arpeggio
    ? Math.max(getY(minVisualStep) + 25, labelY2 + 10)
    : getY(minVisualStep) + 25;
  const viewBoxHeight = arpeggio ? 160 : 150;
  const viewBoxY = arpeggio ? -20 : 0;

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
      <svg width="100%" height="100%" viewBox={`0 ${viewBoxY} ${viewBoxW} ${viewBoxHeight}`} preserveAspectRatio="xMidYMid meet" className="select-none w-full">
        {/* Staff Lines */}
        {[2, 4, 6, 8, 10].map(step => (
            <line 
                 key={step} 
                 x1={staffLeft} y1={getY(step)} 
                 x2={staffRight} y2={getY(step)} 
                 stroke="#666" strokeWidth="1" 
             />
        ))}

        {/* Treble Clef */}
        <text x={arpeggio ? 15 + ARPEGGIO_LEFT_PAD : 15} y={getY(8)} fontSize="65" fontFamily="Times New Roman, serif" fill="#000" textAnchor="middle" dominantBaseline="central">𝄞</text>
        
        {/* Key Label under Clef */}
        {!arpeggio && (
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
        )}

        {/* Key Signature */}
        {Array.from({ length: keySigCount }).map((_, i) => {
             const x = (arpeggio ? 40 + ARPEGGIO_LEFT_PAD : 40) + (i * KEY_SIG_SPACING);
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
            const x = arpeggio ? noteXs[i] : STAFF_X_START + (i * NOTE_SPACING);
            const y = getY(note.visualStep);
            
            const stemUp = arpeggio ? (note.visualStep < 6) : (note.visualStep < 7);
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
            for (let s = STAFF_MIN - 2; s >= note.visualStep; s -= 2) {
                if (s % 2 === 0 && s < STAFF_MIN) ledgers.push(s);
            }
            for (let s = STAFF_MAX + 2; s <= note.visualStep; s += 2) {
                if (s > STAFF_MAX) ledgers.push(s);
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

                    {/* Note Name */}
                    <text
                        x={x}
                        y={labelY1} 
                        fontSize={arpeggio ? 14 : 16}
                        fill="#888"
                        textAnchor="middle"
                        fontFamily="sans-serif"
                    >
                        {getNoteName(note.absSemitone)}
                    </text>
                    {/* Semitone Distance Label */}
                    <text
                        x={x}
                        y={labelY2} 
                        fontSize={arpeggio ? 12 : 14}
                        fill="#666"
                        textAnchor="middle"
                        className="font-mono font-bold"
                    >
                        {displayDistance !== undefined ? displayDistance : 'X'}
                    </text>
                </g>
            );
        })}
      </svg>
    </div>
  );
};

export default ScaleNotation;
