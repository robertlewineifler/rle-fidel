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
   rootName, intervals, diatonicSteps, keySignatureCount, activeFreq,
   modeLabel = "", highlightNoteName, hideBackground, hideRootHighlight,
   keyRootName, keyIntervals, arpeggio = false
}) => {
   
  const parseRoot = (name: string) => {
    if (name === 'H') return { diatonicIndex: 6, accidental: 0 }; 
    if (name === 'B') return { diatonicIndex: 6, accidental: -1 }; 
    const baseChar = name.charAt(0).toUpperCase();
    let accidental = 0;
    if (name.endsWith('is')) { accidental = 1; }
    else if (name.endsWith('es') || name === 'As' || name === 'Es') { accidental = -1; }
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
    if (diatonicSteps && intervalIdx >= 0) { stepOffset = diatonicSteps[intervalIdx]; }
    else { stepOffset = intervalIdx; }
    const currentDiatonicRaw = rootDiatonic + stepOffset + octaveOffset * 7;
    let currentDiatonic = ((currentDiatonicRaw % 7) + 7) % 7;
    let octaveShift = Math.floor(currentDiatonicRaw / 7);
    let accidentalVal = abs - (DIATONIC_OFFSETS[currentDiatonic] + octaveShift * 12);
    let visualStep = currentDiatonic + octaveShift * 7;

    if (keySignatureCount !== 0) {
      const name = keySignatureCount < 0
        ? ['C', 'Des', 'D', 'Es', 'E', 'F', 'Ges', 'G', 'As', 'A', 'B', 'H']
        : ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'Ais', 'H'];
      const parsed = parseRoot(name[(abs + 120) % 12]);
      const oct = Math.round((abs - parsed.accidental - DIATONIC_OFFSETS[parsed.diatonicIndex]) / 12);
      visualStep = parsed.diatonicIndex + oct * 7;
      accidentalVal = parsed.accidental;
    }

    const frequency = FREQ_C4 * Math.pow(2, abs / 12);
    const isRoot = typeof isRootForScale === 'function' ? isRootForScale(idx) : (relSemitone === 0);
    return {
      id: idx, visualStep, accidental: accidentalVal, isRoot, frequency,
      semitoneDistance: arpeggio ? relSemitone : abs - rootSemitone, absSemitone: abs
    };
  };

  // --- Arpeggio notes ---
  const arpeggioNotes = useMemo(() => {
    if (!arpeggio) return [] as ReturnType<typeof noteToObject>[];
    const uniqueAbs = new Set<number>();
    const minOct = Math.floor((VIOLIN_MIN_ABS - rootSemitone - 11) / 12);
    const maxOct = Math.ceil((VIOLIN_MAX_ABS - rootSemitone + 11) / 12);
    for (let oct = minOct; oct <= maxOct; oct++) {
      for (let i = 0; i < intervals.length; i++) {
        const abs = rootSemitone + intervals[i] + oct * 12;
        if (abs >= VIOLIN_MIN_ABS && abs <= VIOLIN_MAX_ABS) uniqueAbs.add(abs);
      }
    }
    const sorted = Array.from(uniqueAbs).sort((a, b) => a - b);
    if (sorted.length === 0) return [];
    let rootIdx = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (((sorted[i] - rootSemitone) % 12 + 12) % 12 === 0) { rootIdx = i; break; }
    }
    const pattern: number[] = [];
    for (let i = rootIdx; i < sorted.length; i++) pattern.push(sorted[i]);
    for (let i = sorted.length - 2; i >= 0; i--) pattern.push(sorted[i]);
    for (let i = 1; i <= rootIdx; i++) pattern.push(sorted[i]);
    return pattern.map((abs, idx) => noteToObject(abs, idx, false));
  }, [arpeggio, rootSemitone, rootDiatonic, rootAccidental, intervals, diatonicSteps, keySignatureCount]);

  // --- Scale notes ---
  const scaleNotes = useMemo(() => {
    if (arpeggio) return [] as ReturnType<typeof noteToObject>[];
    const result: ReturnType<typeof noteToObject>[] = [];
    const fullIntervals = [...intervals];
    if (fullIntervals.length === 7) fullIntervals.push(12);
    for (let i = 0; i < fullIntervals.length; i++) {
      const abs = rootSemitone + fullIntervals[i];
      result.push(noteToObject(abs, i, (j: number) => j === 0 || j === fullIntervals.length - 1));
    }
    return result;
  }, [arpeggio, rootSemitone, rootDiatonic, rootAccidental, intervals, diatonicSteps, keySignatureCount]);

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

  // Layout constants
  const LINE_SPACING = 10;
  const NOTE_RADIUS = 5;
  const getY = (step: number) => 30 + (11 - step) * (LINE_SPACING / 2);
  const STAFF_MIN = 2;
  const STAFF_MAX = 10;
  const isSharpKey = keySignatureCount > 0;
  const keySigCount = Math.abs(keySignatureCount);
  const sharpY = useMemo(() => [10, 7, 12, 8, 4, 11, 6].map(s => getY(s)), [getY]);
  const flatY = useMemo(() => [6, 9, 5, 8, 4, 7, 2].map(s => getY(s)), [getY]);
  const KEY_SIG_SPACING = arpeggio ? 16 : 14;

  // Arpeggio parameters
  const ARPEGGIO_NOTE_SPACING = 35;
  const ARPEGGIO_ROOT_GAP = 25;
  const ARPEGGIO_FIRST_NOTE_GAP = 0;
  const ARPEGGIO_VIEWBOX_W = 800;
  const ARPEGGIO_LEFT_PAD = 8;
  const ARP_SCALE = 0.9;
  const ARP_X = 3;
  const ARP_Y = 3;

  // Scale parameters
  const SCALE_VIEWBOX_W = 800;

  const STAFF_X_START = arpeggio
    ? 80 + keySigCount * KEY_SIG_SPACING + ARPEGGIO_FIRST_NOTE_GAP
    : 80 + keySigCount * KEY_SIG_SPACING + LINE_SPACING;

  const scaleNoteSpacing = (() => {
    if (notes.length <= 1) return 75;
    const available = SCALE_VIEWBOX_W - STAFF_X_START - 40;
    return available / (notes.length - 1);
  })();

  const NOTE_SPACING = arpeggio ? ARPEGGIO_NOTE_SPACING : scaleNoteSpacing;

  // Arpeggio note X positions with group gaps
  const noteXs = useMemo(() => {
    if (!arpeggio) return [] as number[];
    const rootIndices: number[] = [];
    for (let i = 0; i < notes.length; i++) { if (notes[i].isRoot) rootIndices.push(i); }
    const highestNoteAbs = Math.max(...notes.map(n => n.absSemitone));
    const gapBefore = new Set<number>();
    const gapAfter = new Set<number>();
    for (let k = 0; k < rootIndices.length - 1; k++) {
      const r2 = rootIndices[k + 1];
      const prev = notes[r2 - 1];
      if (prev.absSemitone < notes[r2].absSemitone) {
        gapBefore.add(r2);
        if (notes[r2].absSemitone === highestNoteAbs) gapAfter.add(r2);
      }
      else { gapAfter.add(r2); }
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

  // Scale viewBox
  const scaleViewBoxTop = getY(STAFF_MAX + 2) - 25;
  const scaleViewBoxBottom = getY(STAFF_MIN - 2) + 25;
  const scaleViewBoxH = 150;
  const scaleViewBoxY = 0;

  // Labels
  const labelY1 = arpeggio ? getY(STAFF_MIN - 2) + 18 : 110;
  const labelY2 = arpeggio ? getY(STAFF_MIN - 2) + 36 : 126;

  // Helpers
  const labelParts = (() => {
    if (!modeLabel) return [] as string[];
    if (modeLabel === 'Dur') return ['Dur'];
    const parts = modeLabel.split(' ');
    if (parts.length > 1) { return [parts[0], parts.slice(1).join(' ').replace('(', '').replace(')', '')]; }
    return [modeLabel];
  })();
  
  const highlightIdx = highlightNoteName 
    ? (NOTE_TO_INDEX[highlightNoteName.toLowerCase()] ?? NOTE_TO_INDEX[highlightNoteName] ?? -1) : -1;

  const getNoteName = (absSemitone: number) => {
    const sharp = ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'Ais', 'H'];
    const flat = ['C', 'Des', 'D', 'Es', 'E', 'F', 'Ges', 'G', 'As', 'A', 'B', 'H'];
    return (keySignatureCount < 0 ? flat : sharp)[(absSemitone + 120) % 12];
  };

  // Shared note rendering
  const renderNotes = (getX: (i: number) => number, stemThreshold: number) => notes.map((note, i) => {
    const x = getX(i);
    const y = getY(note.visualStep);
    const stemUp = note.visualStep < stemThreshold;
    const stemHeight = 35;
    const isNoteActiveFreq = activeFreq && Math.abs(12 * Math.log2(activeFreq / note.frequency)) < 0.4;
    const noteIdx = (note.absSemitone + 3) % 12;
    const isHighlightNote = highlightIdx !== -1 && noteIdx === highlightIdx;
    const isKeyRoot = !hideRootHighlight && note.isRoot;
    const headFill = isNoteActiveFreq ? "#fbbf24" : isHighlightNote ? "#d97706" : isKeyRoot ? "#f59e0b" : "#000";
    const sc = isNoteActiveFreq ? "#d97706" : isHighlightNote ? "#d97706" : isKeyRoot ? "#d97706" : "#000";
    const keyDist = keyRootSemitone >= 0 && keyIntervalSet
      ? ((note.absSemitone - keyRootSemitone) % 12 + 12) % 12 : null;
    const inKey = keyDist !== null && keyIntervalSet!.has(keyDist);
    const dispDist = keyRootName ? (inKey ? keyDist : undefined) : note.semitoneDistance;
    const ledgers: number[] = [];
    for (let s = STAFF_MIN - 2; s >= note.visualStep; s -= 2) { if (s % 2 === 0 && s < STAFF_MIN) ledgers.push(s); }
    for (let s = STAFF_MAX + 2; s <= note.visualStep; s += 2) { if (s > STAFF_MAX) ledgers.push(s); }

    return (
      <g key={note.id}>
        {isNoteActiveFreq && <circle cx={x} cy={y} r={NOTE_RADIUS * 3} fill="orange" opacity="0.3" filter="blur(4px)" />}
        {ledgers.map(ls => <line key={ls} x1={x - 12} y1={getY(ls)} x2={x + 12} y2={getY(ls)} stroke={isNoteActiveFreq || isHighlightNote ? "#d97706" : "#666"} strokeWidth="1" />)}
        {note.accidental !== 0 && (
          <text x={x - 14} y={note.accidental > 0 ? y - 1 : y - 5} fontSize="26" fill={sc} textAnchor="middle" fontFamily="Arial, sans-serif" dominantBaseline="central">
            {note.accidental > 0 ? '♯' : note.accidental < 0 ? '♭' : '♮'}
          </text>
        )}
        <ellipse cx={x} cy={y} rx={NOTE_RADIUS + 1} ry={NOTE_RADIUS} fill={headFill} stroke={sc} strokeWidth={isNoteActiveFreq || isHighlightNote ? 1 : 0} transform={`rotate(-15 ${x} ${y})`} />
        <line x1={stemUp ? x + NOTE_RADIUS : x - NOTE_RADIUS} y1={y} x2={stemUp ? x + NOTE_RADIUS : x - NOTE_RADIUS} y2={stemUp ? y - stemHeight : y + stemHeight} stroke={sc} strokeWidth="1.5" />
        {note.visualStep > 0 && (
        <text x={x} y={labelY1} fontSize={arpeggio ? 14 : 16} fill="#888" textAnchor="middle" fontFamily="sans-serif">{getNoteName(note.absSemitone)}</text>
        )}
        <text x={x} y={labelY2} fontSize={arpeggio ? 12 : 14} fill="#888" textAnchor="middle" className="font-mono font-bold">{dispDist !== undefined ? dispDist : 'X'}</text>
      </g>
    );
  });

  return (
    <div className={`w-full h-full flex justify-center items-center ${!hideBackground ? 'bg-[#fdf6e3] rounded-lg border border-slate-300 p-2 shadow-inner' : ''}`}>
      {arpeggio ? (
        <svg width="100%" height="100%" overflow="visible" className="select-none w-full">
          <g transform={`translate(${ARP_X}, ${ARP_Y}) scale(${ARP_SCALE})`}>
            {[2, 4, 6, 8, 10].map(step => (
              <line key={step} x1={ARPEGGIO_LEFT_PAD} y1={getY(step)} x2={ARPEGGIO_VIEWBOX_W - ARPEGGIO_LEFT_PAD} y2={getY(step)} stroke="#666" strokeWidth="1" />
            ))}
            <text x={15 + ARPEGGIO_LEFT_PAD} y={getY(8)} fontSize="65" fontFamily="Times New Roman, serif" fill="#000" textAnchor="middle" dominantBaseline="central">𝄞</text>
            {Array.from({ length: keySigCount }).map((_, i) => (
              <text key={`ks-${i}`} x={40 + ARPEGGIO_LEFT_PAD + i * KEY_SIG_SPACING} y={isSharpKey ? sharpY[i] - 1 : flatY[i] - 5} fontSize="26" fill="#000" fontFamily="Arial, sans-serif" dominantBaseline="central" textAnchor="middle">
                {isSharpKey ? '♯' : '♭'}
              </text>
            ))}
            {renderNotes(i => noteXs[i], 6)}
          </g>
        </svg>
      ) : (
        <svg width="100%" height="100%" viewBox={`0 ${scaleViewBoxY} ${SCALE_VIEWBOX_W} ${scaleViewBoxH}`} preserveAspectRatio="xMidYMid meet" className="select-none w-full">
          {[2, 4, 6, 8, 10].map(step => (
            <line key={step} x1="0" y1={getY(step)} x2="100%" y2={getY(step)} stroke="#666" strokeWidth="1" />
          ))}
          <text x="15" y={getY(8)} fontSize="65" fontFamily="Times New Roman, serif" fill="#000" textAnchor="middle" dominantBaseline="central">𝄞</text>
          <g transform={`translate(25, ${getY(0) + 35})`}>
            <text x="0" y="0" fontSize="18" fontWeight="bold" fill="#444" textAnchor="middle" fontFamily="sans-serif">{rootName}</text>
            {labelParts.map((part, i) => (
              <text key={i} x="0" y={14 + (i * 12)} fontSize="12" fill="#666" textAnchor="middle" fontFamily="sans-serif">{part}</text>
            ))}
          </g>
          {Array.from({ length: keySigCount }).map((_, i) => (
            <text key={`ks-${i}`} x={40 + i * KEY_SIG_SPACING} y={isSharpKey ? sharpY[i] - 1 : flatY[i] - 5} fontSize="26" fill="#000" fontFamily="Arial, sans-serif" dominantBaseline="central" textAnchor="middle">
              {isSharpKey ? '♯' : '♭'}
            </text>
          ))}
          {renderNotes(i => STAFF_X_START + i * NOTE_SPACING, 7)}
        </svg>
      )}
    </div>
  );
};

export default ScaleNotation;
