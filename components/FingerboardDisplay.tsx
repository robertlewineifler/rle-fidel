
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { 
  GERMAN_NOTE_NAMES, 
  GERMAN_NOTE_NAMES_FLAT, 
  KEY_ACCIDENTALS, 
  SCALES, 
  VIOLIN_SCALE, 
  NOTE_TO_INDEX,
  MINOR_TO_MAJOR_ROOT,
  MAJOR_KEY_SIGNATURES,
  PREFERRED_ROOT_NAMES_MAJOR,
  PREFERRED_ROOT_NAMES_MINOR,
  CHORD_INTERVALS,
  CHORD_COLORS
} from '../constants';
import { AudioService } from '../services/audioService';
import { RotateCcw, Play, Volume2, SlidersHorizontal } from 'lucide-react';
import KeySignature from './KeySignature';
import FingerboardSidePanel from './FingerboardSidePanel';
import FingerboardControls from './FingerboardControls';
import PianoKeyboard from './PianoKeyboard';
import ScaleNotation from './ScaleNotation';
import { Chord } from '../types';

interface FingerboardDisplayProps {
  currentFrequency: number;
  isSilent: boolean;
  audioService: AudioService;
  
  // Controlled State
  root: string;
  isMajor: boolean;
  minorVariant: string;
  transpose: number;
  chords?: Chord[];
  outerScale?: number;

  onRootChange: (root: string) => void;
  onModeChange: (isMajor: boolean) => void;
  onVariantChange: (variant: string) => void;
  onTransposeChange: (semitones: number) => void;
}

const FingerboardDisplay: React.FC<FingerboardDisplayProps> = ({ 
  currentFrequency, 
  isSilent, 
  audioService,
  root,
  isMajor,
  minorVariant,
  transpose,
  chords = [],
  outerScale,
  onRootChange,
  onModeChange,
  onVariantChange,
  onTransposeChange
}) => {
  const [isPlayingScale, setIsPlayingScale] = useState(false);
  const [fbScale, setFbScale] = useState(1);
  const [showChordOutlines, setShowChordOutlines] = useState(true);
  const fingerboardWrapperRef = useRef<HTMLDivElement>(null);
  
  // Track frequency played by interactions (Click on string OR Piano)
  const [playbackFreq, setPlaybackFreq] = useState<number | null>(null);

  // Strings setup: G3, D4, A4, E5
  const strings = useMemo(() => {
    return VIOLIN_SCALE.map(s => ({
      ...s,
      baseFreq: 440 * Math.pow(2, s.semitones / 12)
    }));
  }, []);

  const currentMode = isMajor ? 'Dur' : minorVariant;
  const currentIntervals = useMemo(() => SCALES[currentMode] || SCALES['Dur'], [currentMode]);

  // Calculate Effective Root Name for Display & Logic using Preferred Names
  const effectiveRootName = useMemo(() => {
    const originalIndex = NOTE_TO_INDEX[root];
    const effectiveIndex = (originalIndex + transpose + 24) % 12;
    
    // Select name based on Mode to handle enharmonics (e.g. As vs Gis)
    const name = isMajor 
        ? PREFERRED_ROOT_NAMES_MAJOR[effectiveIndex]
        : PREFERRED_ROOT_NAMES_MINOR[effectiveIndex];
        
    // Capitalize for internal logic compatibility, display logic handles lowercase
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, [root, transpose, isMajor]);

  // Determine Effective Key Signature for Display
  const effectiveAccidentals = useMemo(() => {
    let rootForSig = effectiveRootName;
    
    if (!isMajor) {
      // Lookup relative major for accidentals context
      // Ensure we look up using lowercase root
      rootForSig = MINOR_TO_MAJOR_ROOT[effectiveRootName.toLowerCase()] || 'C';
    }
    
    return MAJOR_KEY_SIGNATURES[rootForSig] || 0;
  }, [effectiveRootName, isMajor]);

  // 1. Determine Notes in Scale using Effective Root
  const scaleNotes = useMemo(() => {
    const rootIndex = NOTE_TO_INDEX[effectiveRootName];
    const allowedIndices = new Set(currentIntervals.map(interval => (rootIndex + interval) % 12));
    return allowedIndices;
  }, [effectiveRootName, currentIntervals]);

  // 2. Determine Accidental Preference (Sharps vs Flats) based on Effective Key
  const useFlats = useMemo(() => {
    let checkRoot = effectiveRootName;
    if (!isMajor) {
       checkRoot = MINOR_TO_MAJOR_ROOT[effectiveRootName.toLowerCase()] || 'C';
    }
    
    if (checkRoot === 'C') return false; 
    if (KEY_ACCIDENTALS[checkRoot]) {
        return true;
    }
    return false;
  }, [effectiveRootName, isMajor]);

  const getNoteNameInContext = (absIndex: number) => {
      if (absIndex === 1) return 'B'; // German B = Bb

      const names = useFlats ? GERMAN_NOTE_NAMES_FLAT : GERMAN_NOTE_NAMES;
      return names[absIndex];
  };

  // 3. Determine chord indices for each note (for fixed-segment colored outlines)
  const noteChordIndices = useMemo(() => {
    const idxMap = new Map<number, Set<number>>();
    
    chords.forEach((chord, chordIdx) => {
      const rootIndex = NOTE_TO_INDEX[chord.root];
      const intervals = CHORD_INTERVALS[chord.type];
      if (rootIndex !== undefined && intervals) {
        intervals.forEach(interval => {
          const noteIndex = (rootIndex + interval + transpose + 48) % 12;
          if (!idxMap.has(noteIndex)) {
            idxMap.set(noteIndex, new Set());
          }
          idxMap.get(noteIndex)!.add(chordIdx);
        });
      }
    });

    const finalMap = new Map<number, number[]>();
    idxMap.forEach((idxSet, noteIndex) => {
      finalMap.set(noteIndex, Array.from(idxSet).sort((a, b) => a - b));
    });
    return finalMap;
  }, [chords, transpose]);

  // --- Interaction Handlers ---

  const playNote = (freq: number) => {
    audioService.playTone(freq);
    setPlaybackFreq(freq); // Highlight on Fingerboard AND Piano
    
    // Stop after short duration
    setTimeout(() => {
      audioService.stopTone();
      // Only clear if the user hasn't started playing something else
      setPlaybackFreq(prev => (prev === freq ? null : prev));
    }, 600);
  };

  const handlePianoStart = (freq: number) => {
    setPlaybackFreq(freq);
  };

  const handlePianoStop = () => {
    setPlaybackFreq(null);
  };

  const handlePlayScale = async () => {
    if (isPlayingScale) return;
    setIsPlayingScale(true);

    try {
        const rootIndex = NOTE_TO_INDEX[effectiveRootName];
        
        // Match visual notation logic: Center around Octave 4.
        const octaveShift = rootIndex < 3 ? 12 : 0;
        const baseFreq = 220 * Math.pow(2, (rootIndex + octaveShift) / 12);
        
        const fullScaleIntervals = [...currentIntervals, 12]; // Add octave

        for (const interval of fullScaleIntervals) {
            const freq = baseFreq * Math.pow(2, interval / 12);
            audioService.playTone(freq);
            setPlaybackFreq(freq);
            await new Promise(r => setTimeout(r, 400));
            audioService.stopTone();
            await new Promise(r => setTimeout(r, 50));
        }
        setPlaybackFreq(null);
    } finally {
        setIsPlayingScale(false);
    }
  };

  // Determine Cursor Positions
  const activeCursors = useMemo(() => {
    const cursors: { stringIndex: number, semitones: number, isMicInput: boolean }[] = [];

    // 1. Playback Cursor (Interaction)
    if (playbackFreq) {
      strings.forEach((str, strIdx) => {
         const st = 12 * Math.log2(playbackFreq / str.baseFreq);
         if (st >= -0.5 && st <= 8.5) {
             cursors.push({ stringIndex: strIdx, semitones: st, isMicInput: false });
         }
      });
    }

    // 2. Mic Input Cursor (Live)
    // Only show if not playing back and not silent
    if (!playbackFreq && !isSilent && currentFrequency > 0) {
      strings.forEach((str, strIdx) => {
         const st = 12 * Math.log2(currentFrequency / str.baseFreq);
         if (st >= -0.5 && st <= 8.5) {
             cursors.push({ stringIndex: strIdx, semitones: st, isMicInput: true });
         }
      });
    }

    return cursors;
  }, [currentFrequency, isSilent, strings, playbackFreq]);

  const getRelativeMinorLabel = (majorRoot: string) => {
    const idx = NOTE_TO_INDEX[majorRoot];
    const minorIdx = (((idx - 3) % 12) + 12) % 12;
    return PREFERRED_ROOT_NAMES_MINOR[minorIdx];
  };
  
  const formatNoteLabel = (name: string, isMinorMode: boolean) => {
    let label = name === 'Ais' ? 'B' : name;
    if (isMinorMode) {
        label = label.toLowerCase();
    } else {
        label = label.charAt(0).toUpperCase() + label.slice(1);
    }
    return label;
  };
  
  // Fixed "Zoomed" height for full length
  const SPACING_PX = 76;
  const STRING_PADDING_TOP = 24;
  const STRING_PADDING_BOTTOM = 48;
  const FINGERBOARD_HEIGHT = STRING_PADDING_TOP + STRING_PADDING_BOTTOM + 7 * SPACING_PX + 32 + 8;
  
  const ROOT_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  // Combined Active Frequency (Playback priority, else Mic) for Piano/Scale highlighting
  const activeHighlightFreq = playbackFreq || (!isSilent ? currentFrequency : null);

  useEffect(() => {
    const el = fingerboardWrapperRef.current?.parentElement;
    if (!el) return;
    const updateScale = () => {
      const availableWidth = el.getBoundingClientRect().width;
      const scaleByWidth = availableWidth / 250;
      const realOuterScale = outerScale ?? 0.9;
      const scaleByHeight = window.innerHeight / (FINGERBOARD_HEIGHT * realOuterScale);
      setFbScale(Math.max(1, Math.min(scaleByWidth, scaleByHeight)));
    };
    const observer = new ResizeObserver(() => updateScale());
    observer.observe(el);
    window.addEventListener('resize', updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [outerScale]);

  return (
    <div className="flex flex-col w-full h-full animate-in fade-in duration-500 items-center px-1 pb-4 mx-auto">
      
            {/* Main Content Area: Fingerboard + Side Tools */}
      <div className="flex flex-row w-full gap-4 items-start justify-center flex-none">

        <FingerboardSidePanel
          effectiveAccidentals={effectiveAccidentals}
          effectiveRootName={effectiveRootName}
          isMajor={isMajor}
          minorVariant={minorVariant}
          isPlayingScale={isPlayingScale}
          showChordOutlines={showChordOutlines}
          isSilent={isSilent}
          formatNoteLabel={formatNoteLabel}
          onPlayScale={handlePlayScale}
          onToggleChordOutlines={() => setShowChordOutlines(!showChordOutlines)}
          transpose={transpose}
          originalRoot={root}
        />

        {/* Fingerboard - Takes available space */}
        <div className="flex-1 min-w-[200px] relative flex justify-center">
            <div 
                ref={fingerboardWrapperRef}
                className="relative bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl select-none transition-all duration-500 w-full"
                style={{ height: `${FINGERBOARD_HEIGHT * fbScale}px` }}
            >
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-[#1a1510] to-[#0f0b08] opacity-90"></div>
                
                {/* Guide Lines */}
                <div className="absolute inset-0 top-2 pointer-events-none">
                    <div className="absolute w-full border-t border-slate-400/30 z-0" style={{ top: `${(16 + STRING_PADDING_TOP) * fbScale}px` }} />
                    {[2, 4, 6].map((semitone) => (
                    <div 
                        key={`guide-${semitone}`}
                        className="absolute w-full border-t border-slate-400/30 z-0" 
                        style={{ top: `${(semitone * SPACING_PX + 16 + STRING_PADDING_TOP) * fbScale}px` }}
                    >
                    </div>
                    ))}
                </div>

                {/* Strings */}
                <div className="absolute inset-0 top-2 px-3 flex justify-between">
                {strings.map((str, index) => {
                    const cursor = activeCursors.find(c => c.stringIndex === index);
                    
                    return (
                    <div key={str.name} className="relative h-full flex flex-col items-center w-7 group">
                        {/* String Wire */}
                        <div className={`absolute top-0 bottom-0 w-[2px] ${index > 1 ? 'bg-slate-400' : 'bg-amber-700/60'} shadow-[0_0_5px_rgba(0,0,0,0.8)] z-0`}></div>
                        
                        {/* LIVE TUNER CURSOR LINE */}
                        {cursor && cursor.isMicInput && (
                            <div 
                                className={`
                                    absolute w-12 h-0.5 z-50 transition-all duration-75 shadow-[0_0_10px_rgba(255,255,255,0.8)]
                                    bg-red-500 shadow-red-500/50
                                `}
                                style={{ top: `${(cursor.semitones * SPACING_PX + 16 + STRING_PADDING_TOP) * fbScale}px` }}
                            >
                                <div className="absolute left-1/2 -translate-x-1/2 -top-1.5 w-0.5 h-3.5 bg-white opacity-80"></div>
                            </div>
                        )}

                        {/* Scale Notes / Buttons */}
                        {Array.from({ length: 8 }).map((_, semitone) => {
                            const noteFreq = str.baseFreq * Math.pow(2, semitone / 12);
                            const absIndex = (((0 + str.semitones + semitone) % 12) + 12) % 12;
                            const isInScale = scaleNotes.has(absIndex);
                            const isRoot = absIndex === NOTE_TO_INDEX[effectiveRootName];
                            const noteName = getNoteNameInContext(absIndex);

                            const topPos = (STRING_PADDING_TOP + semitone * SPACING_PX) * fbScale;
                            const isNoteActive = cursor && Math.abs(cursor.semitones - semitone) < 0.2;
                            const chordIndices = noteChordIndices.get(absIndex) || [];
                            const hasChordHighlight = showChordOutlines && chordIndices.length > 0 && chords.length > 0;

                            if (!isInScale && !isNoteActive && !hasChordHighlight) return null;

                            const activeStyle = isNoteActive 
                                ? cursor.isMicInput 
                                    ? 'ring-[2px] ring-red-500 z-50 scale-105 shadow-[0_0_15px_rgba(239,68,68,0.5)]' 
                                    : 'ring-[2px] ring-amber-400 z-50 scale-105 shadow-[0_0_15px_rgba(251,191,36,0.5)]'
                                : '';
                            
                            // Generate background style for fixed-segment colored border
                            let wrapperStyle = {};
                            if (hasChordHighlight) {
                                const totalChords = chords.length;
                                const segmentDeg = 360 / totalChords;
                                const stops: string[] = [];
                                for (let i = 0; i < totalChords; i++) {
                                    const s = i * segmentDeg;
                                    const e = (i + 1) * segmentDeg;
                                    stops.push(chordIndices.includes(i) ? `${CHORD_COLORS[i % CHORD_COLORS.length]} ${s}deg ${e}deg` : `transparent ${s}deg ${e}deg`);
                                }
                                wrapperStyle = { background: `conic-gradient(${stops.join(', ')})` };
                            }

                            return (
                            <div
                                key={semitone}
                                className="absolute w-full flex items-center justify-center z-10"
                                style={{ top: `${topPos}px`, height: `${32 * fbScale}px` }}
                            >
                                <div className="absolute w-full h-[1px] bg-slate-600 z-0"></div>

                                <div 
                                    className={`relative flex items-center justify-center ${semitone === 0 ? 'rounded-md' : 'rounded-full'} ${hasChordHighlight ? 'p-[7px]' : ''} ${activeStyle ? 'z-50' : 'z-10'}`}
                                    style={wrapperStyle}
                                >
                                    <button
                                        onClick={() => playNote(noteFreq)}
                                        className={`
                                            w-12 h-12 flex items-center justify-center relative
                                            transition-all duration-100 active:scale-90
                                            ${semitone === 0 
                                            ? 'border border-dashed border-slate-600 w-14 h-10 rounded-md' 
                                            : 'shadow-lg hover:scale-110 rounded-full'
                                            }
                                            ${activeStyle}
                                            ${!isNoteActive && isRoot 
                                            ? 'bg-amber-500 text-slate-900 font-bold z-20' 
                                            : !isNoteActive && semitone === 0 
                                                ? 'bg-slate-800 text-slate-500 text-[18px]' 
                                                : !isNoteActive 
                                                    ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                                    : 'bg-slate-700 text-white' 
                                            }
                                        `}
                                    >
                                        <span className="text-[18px] font-bold z-10 relative">
                                            {noteName}
                                        </span>
                                    </button>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                    );
                })}
                </div>
            </div>
        </div>

        

      </div>
{/* Piano & Notation Container - Full width of constrained middle panel */}
      {/* ADDED GAP between Fingerboard and Piano */}
      <div className="flex flex-col gap-2 w-full mt-6 animate-in slide-in-from-bottom-2 fade-in flex-none pb-4">
            <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-1">
                <PianoKeyboard 
                    scaleIndices={scaleNotes} 
                    rootIndex={NOTE_TO_INDEX[effectiveRootName]} 
                    audioService={audioService}
                    scaleIntervals={currentIntervals}
                    activeFreq={activeHighlightFreq}
                    onPlayStart={handlePianoStart}
                    onPlayStop={handlePianoStop}
                />
            </div>
            
            <ScaleNotation 
                rootName={effectiveRootName}
                intervals={currentIntervals}
                keySignatureCount={effectiveAccidentals}
                activeFreq={activeHighlightFreq}
                modeLabel={currentMode}
            />
        </div>


      <FingerboardControls
        root={root}
        isMajor={isMajor}
        minorVariant={minorVariant}
        transpose={transpose}
        onRootChange={onRootChange}
        onModeChange={onModeChange}
        onVariantChange={onVariantChange}
        onTransposeChange={onTransposeChange}
        getRelativeMinorLabel={getRelativeMinorLabel}
        formatNoteLabel={formatNoteLabel}
      />

    </div>
  );
};

export default FingerboardDisplay;
