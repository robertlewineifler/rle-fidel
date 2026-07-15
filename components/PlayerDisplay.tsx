
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Upload, RotateCcw, Music, ArrowRight, Download, Mic, History, Trash2, ArrowUpRight, Volume2 } from 'lucide-react';
import { AudioService } from '../services/audioService';
import { KeyResult, HistoryItem } from '../types';
import { PREFERRED_ROOT_NAMES_MAJOR, PREFERRED_ROOT_NAMES_MINOR, NOTE_TO_INDEX } from '../constants';

interface PlayerDisplayProps {
  audioService: AudioService;
  onFileLoaded?: (file: File) => void;
  detectedKey: KeyResult | null;
  transpose: number;
  onTransposeChange: (semitones: number) => void;
  externalFile?: File | null;
  onApplyKey?: (root: string, mode: string, transpose?: number) => void;
  
  // History Props
  history?: HistoryItem[];
  onLoadHistoryItem?: (item: HistoryItem) => void;
  onDeleteHistoryItem?: (id: string) => void;
}

const PlayerDisplay: React.FC<PlayerDisplayProps> = ({ 
  audioService, 
  onFileLoaded, 
  detectedKey,
  transpose,
  onTransposeChange,
  externalFile,
  onApplyKey,
  history = [],
  onLoadHistoryItem,
  onDeleteHistoryItem
}) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationRef = useRef<number | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Sync transpose prop to audio service
  useEffect(() => {
    audioService.setPlayerPitch(transpose);
  }, [transpose, audioService]);

  // Sync volume to audio service
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    audioService.setPlayerVolume(newVol);
  };

  // Handle External File (e.g. from Recording or History load)
  useEffect(() => {
    if (externalFile) {
        setFileName(externalFile.name);
        setCurrentFile(externalFile);
        
        const load = async () => {
             const dur = await audioService.loadPlayerFile(externalFile);
             setDuration(dur);
             setCurrentTime(0);
             setIsPlaying(false);
             onTransposeChange(0); // Reset transpose for new file
        }
        load();
    } else {
        if (externalFile === null && currentFile) {
            setFileName(null);
            setCurrentFile(null);
            setDuration(0);
            setCurrentTime(0);
            setIsPlaying(false);
        }
    }
  }, [externalFile, audioService, onTransposeChange]);

  const updateUI = () => {
    const state = audioService.getPlayerState();
    setCurrentTime(state.currentTime);
    setIsPlaying(state.isPlaying);
    setDuration(state.duration);
    
    if (state.isPlaying) {
      animationRef.current = requestAnimationFrame(updateUI);
    }
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setCurrentFile(file);
      if (onFileLoaded) onFileLoaded(file);
      
      const dur = await audioService.loadPlayerFile(file);
      setDuration(dur);
      setCurrentTime(0);
      setIsPlaying(false);
      onTransposeChange(0); 
    }
  };

  const handleDownload = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name || 'aufnahme.webm';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const togglePlay = () => {
    if (isPlaying) {
      audioService.pauseBuffer();
      setIsPlaying(false);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    } else {
      audioService.playBuffer();
      setIsPlaying(true);
      animationRef.current = requestAnimationFrame(updateUI);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration === 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, x / rect.width));
    audioService.seekTo(progress);
    setCurrentTime(progress * duration);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Naming Helper: "Ais" -> "B", Lowercase if Minor
  // Uses Preferred lists to handle enharmonic choice if input matches index
  const formatKeyName = (root: string, mode: string) => {
    // Try to normalize root using PREFERRED lists if possible
    const index = NOTE_TO_INDEX[root];
    const isMajor = mode === 'Dur';
    const isMinor = mode.includes('Moll');
    
    let displayRoot = root;
    
    if (index !== undefined) {
        if (isMajor) displayRoot = PREFERRED_ROOT_NAMES_MAJOR[index];
        else if (isMinor) displayRoot = PREFERRED_ROOT_NAMES_MINOR[index];
    }
    
    // Formatting: Lowercase for minor, "B" for Ais handled by array
    if (isMinor) {
        displayRoot = displayRoot.toLowerCase();
    } else {
        displayRoot = displayRoot.charAt(0).toUpperCase() + displayRoot.slice(1);
    }
    
    return `${displayRoot} ${mode}`;
  };

  const getSoundingKey = () => {
      if (!detectedKey) return null;
      const index = NOTE_TO_INDEX[detectedKey.root];
      if (index === undefined) return null;
      
      const transposedIndex = (index + transpose + 24) % 12;
      const isMajor = detectedKey.mode === 'Dur';
      const isMinor = detectedKey.mode.includes('Moll');
      
      let newRoot = '';
      if (isMajor) newRoot = PREFERRED_ROOT_NAMES_MAJOR[transposedIndex];
      else if (isMinor) newRoot = PREFERRED_ROOT_NAMES_MINOR[transposedIndex];
      
      // Capitalize for compatibility
      newRoot = newRoot.charAt(0).toUpperCase() + newRoot.slice(1);
      
      return { root: newRoot, mode: detectedKey.mode };
  };

  const soundingKey = getSoundingKey();

  const handleApplyKey = () => {
     if (onApplyKey && detectedKey) {
         // Apply ORIGINAL detected key and separate transpose value
         onApplyKey(detectedKey.root, detectedKey.mode, transpose);
     }
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      
      {/* Player Core Area */}
      <div className="flex flex-col gap-4">
        {/* Header / File Info */}
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400 shrink-0">
                <Music size={18} />
            </div>
            <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Audio Player</span>
                <span className="text-sm font-medium text-slate-200 truncate pr-2">
                {fileName ? fileName.replace('.webm', '').replace('Aufnahme_', 'Rec_') : "Keine Datei geladen"}
                </span>
            </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
                <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors"
                title="Datei öffnen"
                >
                <Upload size={18} />
                </button>
            </div>
            <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="audio/*,.mp3,.wav,.m4a,.aac,.webm,.ogg" 
            className="hidden" 
            />
        </div>

        {/* Detected Key Info */}
        {detectedKey && (
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
              <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
                
                <div className="flex flex-col items-center sm:items-start">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Original</span>
                    <span className="text-sm font-bold text-slate-300">
                        {formatKeyName(detectedKey.root, detectedKey.mode)}
                    </span>
                </div>

                {transpose !== 0 && (
                    <>
                    <ArrowRight size={14} className="text-slate-600 hidden sm:block" />
                    <div className="flex flex-col items-center sm:items-end">
                        <span className="text-[10px] text-amber-500 uppercase font-bold">Klingend</span>
                        <span className="text-sm font-bold text-amber-400">
                            {soundingKey ? formatKeyName(soundingKey.root, soundingKey.mode) : '--'}
                        </span>
                    </div>
                    </>
                )}
              </div>
              
              {/* Apply to Fingerboard Button */}
              {onApplyKey && (
                  <button 
                    onClick={handleApplyKey}
                    className="w-full mt-3 flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all text-xs font-bold"
                  >
                     <ArrowUpRight size={14} />
                     <span>Tonart in Griffbrett übernehmen</span>
                  </button>
              )}
            </div>
        )}

        {/* Progress Bar */}
        <div className="flex flex-col gap-1">
            <div 
            ref={progressBarRef}
            onClick={handleSeek}
            className="h-8 bg-slate-900 rounded-md cursor-pointer relative overflow-hidden group border border-slate-700"
            >
            <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjEwMCI+PHJlY3Qgd2lkdGg9IjIiIGhlaWdodD0iMTAwIiBmaWxsPSIjZmZmIi8+PC9zdmc+')]"></div>
            
            <div 
                className="absolute top-0 bottom-0 left-0 bg-indigo-600 opacity-60 transition-all duration-100 ease-linear"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            ></div>
            
            <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none">
                <span className="text-xs font-mono font-medium text-slate-300 drop-shadow-md">{formatTime(currentTime)}</span>
                <span className="text-xs font-mono font-medium text-slate-500 drop-shadow-md">{formatTime(duration)}</span>
            </div>
            </div>
        </div>

        {/* Controls: Play & Transpose */}
        <div className="flex flex-col sm:flex-row gap-4">
            
            <div className="flex items-center gap-2 flex-1">
                <button 
                onClick={togglePlay}
                disabled={!fileName}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-slate-700 text-white h-10 rounded-lg flex items-center justify-center gap-2 font-bold transition-all shadow-lg active:scale-95 touch-manipulation"
                >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                {isPlaying ? "Pause" : "Play"}
                </button>
                
                <button
                onClick={() => {
                    onTransposeChange(0);
                }}
                disabled={transpose === 0}
                className="h-10 w-10 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-slate-300 transition-colors touch-manipulation"
                title="Reset Pitch"
                >
                <RotateCcw size={16} />
                </button>
            </div>
        </div>
        
        {/* Playback Settings (Volume + Transpose) */}
        <div className="flex gap-2">
            {/* Volume Slider */}
            <div className="flex-1 flex flex-col justify-center bg-slate-800/50 rounded-lg px-3 py-1 border border-slate-700">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1">
                        <Volume2 size={10} /> Vol
                    </span>
                    <span className="text-xs font-bold font-mono text-slate-400">
                        {Math.round(volume * 100)}%
                    </span>
                </div>
                <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01"
                    value={volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-600 rounded-full appearance-none cursor-pointer accent-indigo-400"
                />
            </div>

            {/* Transpose Slider */}
            <div className="flex-1 flex flex-col justify-center bg-slate-800/50 rounded-lg px-3 py-1 border border-slate-700">
                <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] uppercase font-bold text-slate-500">Transp</span>
                <span className={`text-xs font-bold font-mono ${transpose !== 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                    {transpose > 0 ? `+${transpose}` : transpose} ST
                </span>
                </div>
                <input 
                type="range" 
                min="-12" 
                max="12" 
                value={transpose}
                onChange={(e) => onTransposeChange(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-600 rounded-full appearance-none cursor-pointer accent-amber-500"
                />
            </div>
        </div>
      </div>

      {/* --- HISTORY SECTION --- */}
      {history.length > 0 && (
         <div className="mt-4 flex-1 flex flex-col min-h-0 border-t border-slate-700/50 pt-4">
            <div className="flex items-center gap-2 mb-3 px-1">
               <History size={14} className="text-slate-400" />
               <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Historie</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[120px] max-h-[250px] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
               {history.map((item) => (
                  <div 
                    key={item.id} 
                    className={`
                        flex items-center justify-between p-2 rounded-lg border transition-all
                        ${currentFile?.name === item.file.name ? 'bg-slate-700 border-indigo-500/50' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'}
                    `}
                  >
                     <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`p-1.5 rounded-full shrink-0 ${item.source === 'recording' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {item.source === 'recording' ? <Mic size={12} /> : <Upload size={12} />}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-slate-200 truncate" title={item.file.name}>
                                {item.file.name.replace('.webm', '').replace('Aufnahme_', '').replace(/-/g, '.')}
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500">
                                    {item.timestamp.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'})}
                                </span>
                                {item.detectedKey && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                        {formatKeyName(item.detectedKey.root, item.detectedKey.mode)}
                                    </span>
                                )}
                            </div>
                        </div>
                     </div>

                     <div className="flex items-center gap-1 shrink-0">
                        {item.source === 'recording' && (
                            <button
                                onClick={() => handleDownload(item.file)}
                                className="p-1.5 rounded hover:bg-slate-600 text-slate-500 hover:text-green-400 transition-colors touch-manipulation"
                                title="Download"
                            >
                                <Download size={14} />
                            </button>
                        )}
                        <button 
                          onClick={() => onLoadHistoryItem && onLoadHistoryItem(item)}
                          className="p-1.5 rounded hover:bg-slate-600 text-slate-400 hover:text-white transition-colors touch-manipulation"
                          title="Laden"
                        >
                            <Play size={14} fill="currentColor" />
                        </button>
                        <button 
                          onClick={() => onDeleteHistoryItem && onDeleteHistoryItem(item.id)}
                          className="p-1.5 rounded hover:bg-red-900/30 text-slate-600 hover:text-red-400 transition-colors touch-manipulation"
                          title="Löschen"
                        >
                            <Trash2 size={14} />
                        </button>
                     </div>
                  </div>
               ))}
            </div>
         </div>
      )}

    </div>
  );
};

export default PlayerDisplay;
