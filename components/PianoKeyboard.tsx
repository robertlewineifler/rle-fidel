
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { AudioService } from '../services/audioService';

interface PianoKeyboardProps {
  scaleIndices: Set<number>; // Set of pitch class indices (0-11) in the scale
  rootIndex: number; // Pitch class index of the root (0-11)
  scaleIntervals: number[]; // Intervals of the scale
  audioService: AudioService;
  activeFreq: number | null; // Frequency currently being played elsewhere (e.g. Fingerboard or Mic)
  onPlayStart: (freq: number) => void; 
  onPlayStop: () => void;
}

// Range: G3 (-14) to B5 (14) relative to A4 (0)
const RANGE_START = -14;
const RANGE_END = 14;

// 0=A (White), 1=A# (Black), 2=B (White), 3=C (White), 4=C# (Black)...
const KEY_TYPES = [
  'white', 'black', 'white', // A, A#, B
  'white', 'black', 'white', 'black', 'white', // C, C#, D, D#, E
  'white', 'black', 'white', 'black' // F, F#, G, G#
];

const PianoKeyboard: React.FC<PianoKeyboardProps> = ({ 
  scaleIndices, 
  rootIndex, 
  audioService,
  scaleIntervals,
  activeFreq,
  onPlayStart,
  onPlayStop
}) => {
  // We now track a Set of active frequencies to support Polyphony visual feedback
  const [activeKeys, setActiveKeys] = useState<Set<number>>(new Set());
  
  // Track held keys to prevent re-triggering on key hold
  const heldKeysRef = useRef<Set<string>>(new Set());

  // 1. Generate Key Data for Rendering
  const { keys, whiteKeyCount } = useMemo(() => {
    const keysData = [];
    let whiteCounter = 0;

    for (let semitone = RANGE_START; semitone <= RANGE_END; semitone++) {
      // Calculate Pitch Class (0-11, 0=A)
      const pitchIndex = ((semitone % 12) + 12) % 12;
      const type = KEY_TYPES[pitchIndex];
      const freq = 440 * Math.pow(2, semitone / 12);
      
      let position = 0;
      
      if (type === 'white') {
        position = whiteCounter;
        whiteCounter++;
      } else {
        position = whiteCounter; 
      }

      keysData.push({
        semitone,
        pitchIndex,
        type,
        freq,
        position
      });
    }
    return { keys: keysData, whiteKeyCount: whiteCounter };
  }, []);

  // 2. Calculate Frequencies for 1-8 Hotkeys
  // MUST MATCH Scale Playback Logic in FingerboardDisplay:
  // "const octaveShift = rootIndex < 3 ? 12 : 0;"
  // "const baseFreq = 220 * Math.pow(2, (rootIndex + octaveShift) / 12);"
  const hotkeyMap = useMemo(() => {
    // Logic from FingerboardDisplay scale playback:
    // Roots A(0), Bb(1), B(2) are shifted up one octave to sound in the main range (A4..)
    // Roots C(3) to G(11) stay in the standard range (C4..G4)
    // Base reference is 220Hz (A3).
    const octaveShift = rootIndex < 3 ? 12 : 0;
    const baseFreq = 220 * Math.pow(2, (rootIndex + octaveShift) / 12);

    const map: { [key: string]: number } = {};
    
    // Construct the scale intervals including the octave
    const intervals = [...scaleIntervals];
    if (intervals.length === 7) intervals.push(12); // Add octave if 7-note scale

    intervals.forEach((interval, i) => {
      // Calculate freq relative to the calculated base
      const freq = baseFreq * Math.pow(2, interval / 12);
      const keyChar = (i + 1).toString();
      map[keyChar] = freq;
    });

    return map;
  }, [rootIndex, scaleIntervals]);

  // 3. Interactions (Polyphonic)
  const startPlaying = (freq: number) => {
    audioService.startTone(freq);
    setActiveKeys(prev => new Set(prev).add(freq));
    onPlayStart(freq);
  };

  const stopPlaying = (freq: number) => {
    audioService.stopTone(freq);
    setActiveKeys(prev => {
        const next = new Set(prev);
        next.delete(freq);
        return next;
    });
    if (activeKeys.size <= 1) onPlayStop();
  };

  const handleMouseDown = (freq: number) => {
    startPlaying(freq);
  };

  const handleMouseUp = (freq: number) => {
    stopPlaying(freq);
  };

  const handleMouseEnter = (e: React.MouseEvent, freq: number) => {
    if (e.buttons === 1) { // If dragging
      startPlaying(freq);
    }
  };

  const handleMouseLeave = (e: React.MouseEvent, freq: number) => {
      if (activeKeys.has(freq)) {
          stopPlaying(freq);
      }
  };

  // 4. Keyboard Interaction (1-8)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (heldKeysRef.current.has(e.key)) return; 
      
      const freq = hotkeyMap[e.key];
      if (freq) {
        heldKeysRef.current.add(e.key);
        startPlaying(freq);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (heldKeysRef.current.has(e.key)) {
        const freq = hotkeyMap[e.key];
        if (freq) stopPlaying(freq);
        heldKeysRef.current.delete(e.key);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [hotkeyMap, audioService]);


  // Visual Helpers
  const getNoteLabel = (pitchIndex: number, type: string) => {
    const names = ['A', 'Ais', 'H', 'C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis'];
    let name = names[pitchIndex];
    if (pitchIndex === 1 && scaleIndices.has(1)) name = 'B'; 
    return name;
  };

  return (
    <div 
      className="relative w-full h-32 select-none mb-2"
    >
      <div className="absolute inset-0 flex justify-center">
        <div className="relative h-full" style={{ width: '100%' }}>
            {keys.map((key) => {
              const isRoot = key.pitchIndex === rootIndex;
              const isInScale = scaleIndices.has(key.pitchIndex);
              
              // Check active status (Polyphonic Local keys OR Monophonic external activeFreq)
              const isLocallyActive = activeKeys.has(key.freq);
              const isExternallyActive = activeFreq !== null && Math.abs(activeFreq - key.freq) < (key.freq * 0.03);
              const isActive = isLocallyActive || isExternallyActive;

              const whiteWidthPct = 100 / whiteKeyCount;
              const blackWidthPct = whiteWidthPct * 0.65;
              
              if (key.type === 'white') {
                // White Key Styling
                let bgClass = '';
                let borderClass = '';
                let textClass = '';

                if (isRoot) {
                    if (isActive) {
                        bgClass = 'bg-white';
                        borderClass = 'border-slate-300';
                        textClass = 'text-amber-600 font-bold';
                    } else {
                        bgClass = 'bg-amber-500';
                        borderClass = 'border-amber-600';
                        textClass = 'text-white font-bold';
                    }
                } else if (isInScale) {
                    bgClass = 'bg-white';
                    borderClass = 'border-slate-300';
                    textClass = 'text-slate-600';
                } else {
                    bgClass = 'bg-slate-900';
                    borderClass = 'border-slate-950';
                    textClass = 'text-slate-800 opacity-20';
                }

                return (
                  <div
                    key={key.semitone}
                    onMouseDown={() => handleMouseDown(key.freq)}
                    onMouseUp={() => handleMouseUp(key.freq)}
                    onMouseEnter={(e) => handleMouseEnter(e, key.freq)}
                    onMouseLeave={(e) => handleMouseLeave(e, key.freq)}
                    className={`
                      absolute top-0 h-full rounded-b-sm border-x border-b
                      flex items-end justify-center pb-2 cursor-pointer transition-all duration-75
                      ${bgClass} ${borderClass}
                      ${isActive 
                        ? 'ring-inset ring-[4px] ring-amber-500 z-30' // Active Ring
                        : isInScale 
                            ? 'z-10' 
                            : 'z-0'
                      }
                    `}
                    style={{
                      left: `${key.position * whiteWidthPct}%`,
                      width: `${whiteWidthPct}%`
                    }}
                  >
                    <span className={`text-[9px] font-bold mb-1 select-none ${textClass}`}>
                        {getNoteLabel(key.pitchIndex, 'white')}
                    </span>
                  </div>
                );
              } else {
                // Black Key Styling
                let bgClass = '';
                let borderClass = '';

                if (isRoot) {
                    if (isActive) {
                        bgClass = 'bg-slate-400'; 
                        borderClass = 'border-slate-500';
                    } else {
                        bgClass = 'bg-amber-500'; 
                        borderClass = 'border-amber-600';
                    }
                } else if (isInScale) {
                    bgClass = 'bg-slate-400';
                    borderClass = 'border-slate-500';
                } else {
                    bgClass = 'bg-black'; 
                    borderClass = 'border-black';
                }

                return (
                  <div
                    key={key.semitone}
                    onMouseDown={() => handleMouseDown(key.freq)}
                    onMouseUp={() => handleMouseUp(key.freq)}
                    onMouseEnter={(e) => handleMouseEnter(e, key.freq)}
                    onMouseLeave={(e) => handleMouseLeave(e, key.freq)}
                    className={`
                      absolute top-0 h-2/3 rounded-b-md border-x border-b
                      cursor-pointer transition-all duration-75
                      ${bgClass} ${borderClass}
                      ${isActive 
                        ? 'ring-inset ring-[3px] ring-amber-500 z-40' 
                        : isInScale 
                            ? 'z-20' 
                            : 'z-20' 
                      }
                    `}
                    style={{
                      left: `${(key.position * whiteWidthPct) - (blackWidthPct / 2)}%`,
                      width: `${blackWidthPct}%`
                    }}
                  >
                  </div>
                );
              }
            })}
        </div>
      </div>
      
      {/* Instructions Overlay */}
      <div className="absolute -bottom-5 w-full flex justify-center pointer-events-none">
        <span className="text-[9px] text-slate-500 font-mono bg-slate-900/50 px-2 py-0 rounded">
            Tastatur: 1-8
        </span>
      </div>
    </div>
  );
};

export default PianoKeyboard;
