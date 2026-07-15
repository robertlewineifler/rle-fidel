
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Music, Volume2, Minus, Plus, Power, Activity, Disc, StickyNote, Monitor } from 'lucide-react';
import { AudioService } from './services/audioService';
import { VIOLIN_SCALE, DEFAULT_A4_FREQ, GERMAN_NOTE_NAMES, MAJOR_KEY_SIGNATURES, MINOR_TO_MAJOR_ROOT, NOTE_TO_INDEX, PREFERRED_ROOT_NAMES_MAJOR, PREFERRED_ROOT_NAMES_MINOR, SCALES } from './constants';
import { TunerStatus, HistoryItem, KeyResult, Chord, ChordList } from './types';
import NeedleDisplay from './components/NeedleDisplay';
import KeyDetectionDisplay from './components/KeyDetectionDisplay';
import PlayerDisplay from './components/PlayerDisplay';
import FingerboardDisplay from './components/FingerboardDisplay';
import ChordManager from './components/ChordManager';
import { KeyDetector } from './services/keyDetector';
import AudioMeter from './components/AudioMeter';

const audioService = new AudioService();

// Erhöht auf 0.8 für viel schnellere Reaktion (Latenz minimieren)
const SMOOTHING_FACTOR = 0.8; 

const INTERNAL_WIDTH = 1600;

const STANDARD_SCALE = 0.9; 

const App: React.FC = () => {
  // Scaling Logic
  const [isScalingEnabled, setIsScalingEnabled] = useState(false); // Standardmäßig aus (Standardansicht)
  const [scale, setScale] = useState(STANDARD_SCALE);
  const [marginLeft, setMarginLeft] = useState(0);
  const [internalHeight, setInternalHeight] = useState<number | string>('100vh');
  const [showOverflow, setShowOverflow] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      let newScale = STANDARD_SCALE;
      let newMargin = 0;

      if (isScalingEnabled) {
          // Dynamic Mode: Scale exactly to fit window width - no overflow ever
          newScale = w / INTERNAL_WIDTH;
          newMargin = 0;
          setShowOverflow(false);
      } else {
          // Fixed Mode: Lock to Standard Scale
          newScale = STANDARD_SCALE;
          
          const visualWidth = INTERNAL_WIDTH * newScale;
          if (w > visualWidth) {
              newMargin = (w - visualWidth) / 2;
              setShowOverflow(false);
          } else {
              newMargin = 0;
              setShowOverflow(true);
          }
      }
      
      setScale(newScale);
      setMarginLeft(newMargin);
      // Ensure internal height fills the viewport at the current scale
      setInternalHeight(h / newScale);
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [isScalingEnabled]);

  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadedHistoryItem, setLoadedHistoryItem] = useState<HistoryItem | null>(null);

  const [referencePitch, setReferencePitch] = useState(DEFAULT_A4_FREQ);
  
  // Fingerboard State
  const [fbRoot, setFbRoot] = useState('G');
  const [fbIsMajor, setFbIsMajor] = useState(true);
  const [fbMinorVariant, setFbMinorVariant] = useState('Moll (Natürlich)');
  const [fbTranspose, setFbTranspose] = useState(0); 

  // Chords State
  const [chordLists, setChordLists] = useState<ChordList[]>([
    { id: 'default', name: 'Neues Lied', chords: [], notes: '' }
  ]);
  const [activeChordListId, setActiveChordListId] = useState<string>('default');

  const activeChordList = useMemo(() => 
    chordLists.find(l => l.id === activeChordListId) || chordLists[0], 
  [chordLists, activeChordListId]);

  const chords = activeChordList.chords;

  const [activeTab, setActiveTab] = useState<'tuner' | 'chords'>('tuner');

  const effectiveKeyRoot = useMemo(() => {
    const originalIndex = NOTE_TO_INDEX[fbRoot];
    const effectiveIndex = (originalIndex + fbTranspose + 24) % 12;
    const name = fbIsMajor 
        ? PREFERRED_ROOT_NAMES_MAJOR[effectiveIndex]
        : PREFERRED_ROOT_NAMES_MINOR[effectiveIndex];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, [fbRoot, fbTranspose, fbIsMajor]);

  const currentKeyIntervals = useMemo(() => {
    const mode = fbIsMajor ? 'Dur' : fbMinorVariant;
    return SCALES[mode] || SCALES['Dur'];
  }, [fbIsMajor, fbMinorVariant]);

  const effectiveAccidentals = useMemo(() => {
    const originalIndex = NOTE_TO_INDEX[fbRoot];
    const effectiveIndex = (originalIndex + fbTranspose + 24) % 12;
    let rootForSig = fbIsMajor
        ? PREFERRED_ROOT_NAMES_MAJOR[effectiveIndex]
        : PREFERRED_ROOT_NAMES_MINOR[effectiveIndex];
    rootForSig = rootForSig.charAt(0).toUpperCase() + rootForSig.slice(1);
    if (!fbIsMajor) {
      const majorRoot = MINOR_TO_MAJOR_ROOT[rootForSig.toLowerCase()];
      if (majorRoot) {
        rootForSig = majorRoot;
      }
    }
    return MAJOR_KEY_SIGNATURES[rootForSig] || 0;
  }, [fbRoot, fbTranspose, fbIsMajor]);

  const [estimatedPitch, setEstimatedPitch] = useState<number | null>(null);

  // Restore sensitivity to 0.01 (was 0.005) to avoid triggering on low level noise in songs
  const [sensitivity, setSensitivity] = useState(0.01);
  const [inputGain, setInputGain] = useState(1.0); 
  const [isPlayingNote, setIsPlayingNote] = useState<string | null>(null);
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  
  // Tuner State
  const [tunerStatus, setTunerStatus] = useState<TunerStatus>({
    noteName: null,
    cents: 0,
    frequency: 0,
    volume: 0,
    isSilent: true
  });

  const [noteCounts, setNoteCounts] = useState<number[]>(new Array(12).fill(0));
  const [keyCandidates, setKeyCandidates] = useState<KeyResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const requestRef = useRef<number | null>(null);
  const lastCentsRef = useRef<number>(0);
  
  const noteCountsAccumulator = useRef<number[]>(new Array(12).fill(0));
  const centsDeviationAccumulator = useRef<{ total: number, count: number }>({ total: 0, count: 0 });
  const framesSinceLastKeyCheck = useRef(0);

  const settingsRef = useRef({ sensitivity, referencePitch, inputGain, isRecording });

  useEffect(() => {
    settingsRef.current = { sensitivity, referencePitch, inputGain, isRecording };
  }, [sensitivity, referencePitch, inputGain, isRecording]);
  
  const currentStrings = useMemo(() => {
    return VIOLIN_SCALE.map(str => ({
      name: str.name,
      description: str.description,
      frequency: referencePitch * Math.pow(2, str.semitones / 12)
    }));
  }, [referencePitch]);

  const detectPitch = useCallback(() => {
    const { 
      sensitivity: currentSensitivity, 
      referencePitch: currentRefPitch, 
      inputGain: currentGain, 
      isRecording: currentIsRecording 
    } = settingsRef.current;

    // We request 'calculateRaw=true' ONLY if we are recording, to save CPU otherwise.
    // However, if we are NOT recording, we still need Tuner data (filtered).
    const analysis = audioService.getAnalysis(currentSensitivity, currentGain, currentIsRecording);
    const { pitch, volume, rawPitch } = analysis;
    
    // --- TUNER LOGIC (Filtered Pitch) ---
    // Safety check for pitch validity (must be > 0)
    if (pitch === -1 || pitch <= 0 || Number.isNaN(pitch)) {
      lastCentsRef.current = lastCentsRef.current * 0.8; 
      setTunerStatus(prev => ({ 
        ...prev, 
        volume: volume,
        isSilent: true,
        cents: lastCentsRef.current,
        frequency: 0 
      }));
    } else {
      const semitonesFromRef = 12 * Math.log2(pitch / currentRefPitch);
      const noteIndex = Math.round(semitonesFromRef);
      const rawCents = (semitonesFromRef - noteIndex) * 100;
      const nameIndex = ((noteIndex % 12) + 12) % 12; 
      const noteName = GERMAN_NOTE_NAMES[nameIndex];
      
      const safeLastCents = Number.isNaN(lastCentsRef.current) ? 0 : lastCentsRef.current;
      const smoothedCents = safeLastCents + SMOOTHING_FACTOR * (rawCents - safeLastCents);
      lastCentsRef.current = smoothedCents;

      setTunerStatus({
        noteName: noteName,
        cents: smoothedCents,
        frequency: pitch,
        volume: volume,
        isSilent: false
      });
    }

    // --- KEY DETECTION STATS (Unfiltered RawPitch) ---
    // Use rawPitch here to include bass frequencies in key detection
    if (currentIsRecording && rawPitch > 0) {
          const semitonesFrom440 = 12 * Math.log2(rawPitch / 440);
          const noteIndex440 = Math.round(semitonesFrom440);
          const nameIndex440 = ((noteIndex440 % 12) + 12) % 12;

          noteCountsAccumulator.current[nameIndex440] += 1;
          
          const centsFrom440 = (semitonesFrom440 - noteIndex440) * 100;
          centsDeviationAccumulator.current.total += centsFrom440;
          centsDeviationAccumulator.current.count += 1;
    }

    framesSinceLastKeyCheck.current += 1;
    if (framesSinceLastKeyCheck.current > 5) {
      framesSinceLastKeyCheck.current = 0;
      
      if (currentIsRecording) {
        setNoteCounts([...noteCountsAccumulator.current]);
        
        const results = KeyDetector.detectKey(noteCountsAccumulator.current);
        setKeyCandidates(results);

        if (centsDeviationAccumulator.current.count > 10) {
          const avgDev = centsDeviationAccumulator.current.total / centsDeviationAccumulator.current.count;
          const est = KeyDetector.estimateReferencePitch(avgDev);
          setEstimatedPitch(est);
        }
      }
    }

    requestRef.current = requestAnimationFrame(detectPitch);
  }, []); 

  const toggleListening = async () => {
    if (isListening) {
      audioService.stop();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      setIsListening(false);
      setTunerStatus(prev => ({ ...prev, isSilent: true, volume: 0, cents: 0, frequency: 0 }));
      setIsRecording(false);
    } else {
      try {
        setError(null);
        // Set Filter back to 180Hz (Violin G3 approx 196Hz) to filter out noise for the Tuner.
        // Raw audio for key detection is handled via a separate analyzer path in AudioService.
        const minFreq = 180; 
        await audioService.start(minFreq);
        setIsListening(true);
        requestRef.current = requestAnimationFrame(detectPitch);
      } catch (err) {
        console.error(err);
        setError("Mikrofonzugriff fehlgeschlagen.");
        setIsListening(false);
      }
    }
  };



  // --- HISTORY & RESET LOGIC ---

  const handleResetApp = async () => {
    if (isListening) await toggleListening();
    audioService.stop();
    audioService.stopBuffer();
    
    setHistory([]);
    setLoadedHistoryItem(null);
    
    setReferencePitch(DEFAULT_A4_FREQ);
    setFbRoot('G');
    setFbIsMajor(true);
    setFbMinorVariant('Moll (Natürlich)');
    setFbTranspose(0);
    resetKeyDetection();
    setRecordedFile(null); 
    
    setTimeout(() => toggleListening(), 500);
  };

  const addToHistory = (file: File, key: KeyResult | null, counts: number[], source: 'recording' | 'upload') => {
    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      file,
      detectedKey: key,
      noteCounts: counts,
      timestamp: new Date(),
      source
    };
    setHistory(prev => [newItem, ...prev]);
    return newItem;
  };

  const deleteFromHistory = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
    if (loadedHistoryItem?.id === id) {
      setLoadedHistoryItem(null);
    }
  };

  const loadFromHistory = (item: HistoryItem) => {
    setLoadedHistoryItem(item);
    
    if (item.detectedKey) {
        applyDetectedKeyToFingerboard(item.detectedKey.root, item.detectedKey.mode);
        setKeyCandidates([item.detectedKey]);
    }
    
    if (item.noteCounts && item.noteCounts.length === 12) {
        setNoteCounts(item.noteCounts);
    } else {
        setNoteCounts(new Array(12).fill(0));
    }
  };

  // --- RECORDING & UPLOAD ---

  const [recordedFile, setRecordedFile] = useState<File | null>(null);

  const toggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false);
      
      const blob = await audioService.stopRecording();
      
      const now = new Date();
      const dateStr = now.toLocaleDateString('de-DE').split('.').reverse().join('-');
      const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }).replace(':', '-');
      
      const bestKey = keyCandidates.length > 0 ? `${keyCandidates[0].root}-${keyCandidates[0].mode}` : 'Unbekannt';
      const cleanKey = bestKey.replace(' ', '_').replace('(', '').replace(')', '');
      const fileName = `Aufnahme_${dateStr}_${timeStr}_${cleanKey}.webm`;

      const file = new File([blob], fileName, { type: 'audio/webm' });
      
      const currentKey = keyCandidates.length > 0 ? keyCandidates[0] : null;
      // Pass the current accumulated counts to history
      const historyItem = addToHistory(file, currentKey, [...noteCountsAccumulator.current], 'recording');
      
      // Load it back (this keeps the stats visible)
      loadFromHistory(historyItem);
      
      // Do NOT reset key detection here, so stats stay visible
      
    } else {
      if (!isListening) {
         try {
           await audioService.start(180); // Start mit 180Hz
           setIsListening(true);
           if (!requestRef.current) requestRef.current = requestAnimationFrame(detectPitch);
         } catch(err) {
           setError("Mikrofonzugriff fehlgeschlagen.");
           return;
         }
      }
      
      resetKeyDetection(); // Only reset when starting NEW recording
      audioService.startRecording();
      setIsRecording(true);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setIsAnalyzingFile(true);
      setAnalysisProgress(0);
      setError(null);
      resetKeyDetection(); 
      
      if (isListening) {
        audioService.stop();
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        setIsListening(false);
        setIsRecording(false);
      }
      
      await audioService.loadPlayerFile(file);

      const result = await audioService.analyzeAudioFile(file, (percent) => {
        setAnalysisProgress(percent);
      });
      
      noteCountsAccumulator.current = [...result.noteCounts];
      setNoteCounts([...result.noteCounts]);

      const results = KeyDetector.detectKey(result.noteCounts);
      setKeyCandidates(results);

      const estPitch = KeyDetector.estimateReferencePitch(result.avgCentsDeviation);
      setEstimatedPitch(estPitch);

      const detectedKey = results.length > 0 ? results[0] : null;
      const historyItem = addToHistory(file, detectedKey, result.noteCounts, 'upload');
      
      setLoadedHistoryItem(historyItem);

    } catch (err) {
      console.error(err);
      setError("Fehler beim Analysieren der Datei.");
    } finally {
      setIsAnalyzingFile(false);
      setAnalysisProgress(0);
    }
  };

  const resetKeyDetection = () => {
    noteCountsAccumulator.current = new Array(12).fill(0);
    centsDeviationAccumulator.current = { total: 0, count: 0 };
    setNoteCounts(new Array(12).fill(0));
    setKeyCandidates([]);
    setEstimatedPitch(null);
  };

  const applyDetectedKeyToFingerboard = (root: string, mode: string, transpose: number = 0) => {
    setFbRoot(root);
    setFbIsMajor(mode === 'Dur');
    if (mode.startsWith('Moll')) {
       setFbMinorVariant(mode);
    } else {
        setFbMinorVariant('Moll (Natürlich)');
    }
    setFbTranspose(transpose);
  };

  const playString = (name: string, frequency: number) => {
    if (isPlayingNote === name) {
      audioService.stopTone(frequency);
      setIsPlayingNote(null);
    } else {
      audioService.playTone(frequency);
      setIsPlayingNote(name);
    }
  };

  const changePitch = (delta: number) => {
    const newPitch = Math.max(430, Math.min(450, referencePitch + delta));
    setReferencePitch(newPitch);
    if (isPlayingNote) {
       const playingStringObj = VIOLIN_SCALE.find(s => s.name === isPlayingNote);
       if (playingStringObj) {
         const newFreq = newPitch * Math.pow(2, playingStringObj.semitones / 12);
         audioService.updateTone(newFreq);
       }
    }
  };

  useEffect(() => {
    return () => {
      audioService.stop();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    // SCALED WRAPPER
    <div 
      className="bg-slate-950"
      style={{
        width: '100%',
        height: '100%',
        overflowX: showOverflow ? 'auto' : 'hidden',
        overflowY: showOverflow ? 'auto' : 'hidden',
      }}
    >
      <div 
        className="flex flex-col items-center justify-start p-2 origin-top-left"
        style={{
          width: `${INTERNAL_WIDTH}px`,
          height: typeof internalHeight === 'number' ? `${internalHeight}px` : internalHeight,
          minHeight: '850px',
          transform: `scale(${scale})`,
          marginLeft: `${marginLeft}px`,
          transformOrigin: 'top left'
        }}
      >
        {/* --- DESKTOP 2-COLUMN DASHBOARD --- */}
        <div className="w-full h-full flex flex-col gap-0 relative">

          {/* Two Columns */}
          <div className="flex gap-4 w-full flex-1 min-h-0 px-1 pb-2 pt-3">
            
            {/* === LEFT COLUMN: GRIFFBRETT === */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Main Fingerboard */}
                <div className="flex-1 mt-0 w-full h-full relative overflow-y-auto no-scrollbar">
                    <FingerboardDisplay 
                        currentFrequency={tunerStatus.frequency}
                        isSilent={tunerStatus.isSilent}
                        audioService={audioService}
                        root={fbRoot}
                        isMajor={fbIsMajor}
                        minorVariant={fbMinorVariant}
                        transpose={fbTranspose}
                        onRootChange={setFbRoot}
                        onModeChange={setFbIsMajor}
                        onVariantChange={setFbMinorVariant}
                        onTransposeChange={setFbTranspose}
                        chords={chords}
                        outerScale={scale}
                    />
                </div>
            </div>

            {/* === RIGHT COLUMN: TAB PANEL === */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
                {/* Tab Bar with integrated Logo & Controls */}
                <div className="flex shrink-0 gap-0 items-end">
                    {/* Logo */}
                    <div className="flex items-center gap-2 px-4 py-2.5 mr-2">
                        <div className="w-5 h-5 rounded flex items-center justify-center overflow-hidden bg-slate-800">
                            <img src="/favicon.ico" alt="RLE Fidel Logo" className="w-full h-full object-cover" />
                        </div>
                        <span className="font-bold text-sm text-slate-200">RLE Fidel</span>
                    </div>
                    
                    {/* Tabs */}
                    <button 
                        onClick={() => setActiveTab('tuner')}
                        className={`px-5 py-2.5 rounded-t-xl text-sm font-bold transition-all border border-b-0 ${
                            activeTab === 'tuner' 
                                ? 'bg-slate-900/80 text-amber-500 border-slate-800 z-10' 
                                : 'bg-slate-800/50 text-slate-500 border-slate-800/50 hover:text-slate-300'
                        }`}
                    >
                        Stimmgabel
                    </button>
                    <button 
                        onClick={() => setActiveTab('chords')}
                        className={`px-5 py-2.5 rounded-t-xl text-sm font-bold transition-all border border-b-0 ${
                            activeTab === 'chords' 
                                ? 'bg-slate-900/80 text-amber-500 border-slate-800 z-10' 
                                : 'bg-slate-800/50 text-slate-500 border-slate-800/50 hover:text-slate-300'
                        }`}
                    >
                        Akkorde
                    </button>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Controls */}
                    <div className="flex items-center gap-1 px-2 pb-1.5">
                        <button 
                          onClick={() => setIsScalingEnabled(!isScalingEnabled)} 
                          className={`p-1.5 rounded transition-colors ${isScalingEnabled ? 'text-green-400 hover:bg-green-500/10' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`} 
                          title={isScalingEnabled ? "Auto-Skalierung AN" : "Fixansicht"}
                        >
                            <Monitor size={14} />
                        </button>
                        <button onClick={handleResetApp} className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded transition-colors" title="Global Reset">
                            <Power size={14} />
                        </button>
                    </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-hidden min-h-0">
                    {activeTab === 'tuner' ? (
                        <div className="flex flex-col gap-3 h-full overflow-y-auto p-4 pr-2 pb-4 no-scrollbar">
                            
                            {/* Tuner Panel */}
                            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 shadow-xl flex flex-col min-h-[300px] shrink-0">
                                <div className="flex items-center justify-between mb-4">
                                  <span className="text-xs font-bold uppercase text-slate-400 flex items-center gap-2">
                                    <Music size={14} className="text-amber-500" /> 
                                    Tuner
                                  </span>
                                  
                                  <div className="flex items-center gap-1 bg-slate-800 rounded px-1 py-0.5 border border-slate-700">
                                    <button onClick={() => changePitch(-1)} className="p-1 hover:text-white text-slate-400 transition-colors"><Minus size={10} /></button>
                                    <span className="text-[10px] font-mono font-bold text-amber-500 w-8 text-center">{referencePitch}</span>
                                    <button onClick={() => changePitch(1)} className="p-1 hover:text-white text-slate-400 transition-colors"><Plus size={10} /></button>
                                  </div>
                                </div>

                                <div className="flex-1 relative">
                                    <NeedleDisplay status={tunerStatus} targetFrequency={referencePitch} />
                                </div>

                                <div className="grid grid-cols-4 gap-2 mt-4">
                                    {currentStrings.map((str) => {
                                        const isMicDetected = !tunerStatus.isSilent && Math.abs(12 * Math.log2(tunerStatus.frequency / str.frequency)) < 0.7;
                                        const isManuallyPlaying = isPlayingNote === str.name;
                                        const isActive = isManuallyPlaying || isMicDetected;
                                        
                                        return (
                                        <button 
                                            key={str.name}
                                            onClick={() => playString(str.name, str.frequency)}
                                            className={`
                                            flex flex-col items-center justify-center py-2 rounded-lg border transition-all active:scale-95
                                            ${isActive 
                                                ? 'bg-amber-600 border-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]' 
                                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                                            }
                                            `}
                                        >
                                            <span className="text-sm font-bold">{str.name}</span>
                                        </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Audio Settings */}
                            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 shadow-xl shrink-0">
                                <AudioMeter 
                                    volume={tunerStatus.volume}
                                    sensitivity={sensitivity}
                                    inputGain={inputGain}
                                    isListening={isListening}
                                    onToggleListening={toggleListening}
                                    onSensitivityChange={setSensitivity}
                                    onInputGainChange={setInputGain}
                                />
                            </div>

                            {/* Key Detection */}
                            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 shadow-xl flex-col min-h-0 shrink-0">
                                <KeyDetectionDisplay 
                                    keyCandidates={keyCandidates}
                                    noteCounts={noteCounts}
                                    onReset={resetKeyDetection}
                                    isRecording={isRecording}
                                    onToggleRecording={toggleRecording}
                                    estimatedPitch={estimatedPitch}
                                    isAnalyzing={isAnalyzingFile}
                                    analysisProgress={analysisProgress}
                                    onApplyKey={applyDetectedKeyToFingerboard}
                                />
                            </div>

                            {/* Player */}
                            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 shadow-xl flex flex-col gap-2 shrink-0">
                                <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase text-slate-400">
                                    <Disc size={14} className="text-indigo-400" />
                                    Player & Import
                                </div>
                                <PlayerDisplay 
                                  audioService={audioService} 
                                  onFileLoaded={handleFileUpload}
                                  detectedKey={loadedHistoryItem?.detectedKey || (keyCandidates.length > 0 ? keyCandidates[0] : null)}
                                  transpose={fbTranspose}
                                  onTransposeChange={setFbTranspose}
                                  externalFile={loadedHistoryItem?.file}
                                  history={history}
                                  onLoadHistoryItem={loadFromHistory}
                                  onDeleteHistoryItem={deleteFromHistory}
                                  onApplyKey={applyDetectedKeyToFingerboard}
                                />
                            </div>

                        </div>
                    ) : (
                        <div className="h-full overflow-y-auto pr-2 pb-4 no-scrollbar">
                            <ChordManager 
                                chordLists={chordLists} 
                                activeListId={activeChordListId}
                                onUpdateLists={setChordLists}
                                onSelectList={setActiveChordListId}
                                keySignatureCount={effectiveAccidentals} 
                                onApplyKey={applyDetectedKeyToFingerboard} 
                                currentKeyRoot={effectiveKeyRoot}
                                currentKeyIntervals={currentKeyIntervals}
                                transpose={fbTranspose}
                                originalRoot={fbRoot}
                                originalIsMajor={fbIsMajor}
                                originalMinorVariant={fbMinorVariant}
                            />
                        </div>
                    )}
                </div>
            </div>
          </div>
        </div>

        {/* Error Toast */}
        {error && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-full shadow-2xl font-bold text-sm animate-bounce z-50">
              {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
