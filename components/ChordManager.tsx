import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Layers, Plus, X, GripVertical, Music, ArrowRightCircle, Download, Upload, Edit2, Check, Trash2, List, ArrowRight, StickyNote, RotateCcw } from 'lucide-react';
import { Chord, KeyResult, ChordList } from '../types';
import { ROOT_NOTES, CHORD_INTERVALS, MAJOR_KEY_SIGNATURES, CHORD_DIATONIC_STEPS, NOTE_TO_INDEX, SCALES, PREFERRED_ROOT_NAMES_MAJOR, CHORD_COLORS, PREFERRED_ROOT_NAMES_MINOR, SHARP_CHORD_ROOTS, FLAT_CHORD_ROOTS } from '../constants';
import ScaleNotation from './ScaleNotation';
import FingerboardControls from './FingerboardControls';

interface ChordManagerProps {
  chordLists: ChordList[];
  activeListId: string;
  onUpdateLists: (lists: ChordList[]) => void;
  onSelectList: (id: string) => void;
  keySignatureCount: number;
  onApplyKey?: (root: string, mode: string) => void;
  currentKeyRoot: string;
  currentKeyIntervals: number[];
  transpose: number;
  originalRoot: string;
  originalIsMajor: boolean;
  originalMinorVariant: string;
}

const CHORD_TYPES = Object.keys(CHORD_INTERVALS);

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

const ChordManager: React.FC<ChordManagerProps> = ({ 
  chordLists, 
  activeListId, 
  onUpdateLists, 
  onSelectList, 
  keySignatureCount, 
  onApplyKey,
  currentKeyRoot,
  currentKeyIntervals,
  transpose,
  originalRoot,
  originalIsMajor,
  originalMinorVariant
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [selectedRoot, setSelectedRoot] = useState('C');
  const [selectedType, setSelectedType] = useState('Dur');
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showOriginalKeyPicker, setShowOriginalKeyPicker] = useState(false);
  const [tempOriginalRoot, setTempOriginalRoot] = useState('C');
  const [tempOriginalIsMajor, setTempOriginalIsMajor] = useState(true);
  const [tempOriginalMinorVariant, setTempOriginalMinorVariant] = useState('Moll (Natürlich)');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    applyImportedKey(activeList);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeListId]);

  useEffect(() => {
    if (confirmDeleteId) {
      const timer = setTimeout(() => setConfirmDeleteId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmDeleteId]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const activeList = useMemo(() => 
    chordLists.find(l => l.id === activeListId) || chordLists[0], 
  [chordLists, activeListId]);
  
  const chords = activeList.chords;

  const getTransposedChordRoot = (chordRoot: string) => {
    if (transpose === 0) return chordRoot;
    const index = NOTE_TO_INDEX[chordRoot];
    if (index === undefined) return chordRoot;
    const newIndex = (index + transpose + 24) % 12;
    return PREFERRED_ROOT_NAMES_MAJOR[newIndex];
  };

  const adjustChordRoot = (root: string) => {
    const idx = NOTE_TO_INDEX[root];
    if (idx === undefined) return root;
    return (keySignatureCount < 0 ? FLAT_CHORD_ROOTS : SHARP_CHORD_ROOTS)[idx];
  };

  const updateCurrentList = (updatedChords: Chord[]) => {
    const newLists = chordLists.map(list => 
      list.id === activeListId ? { ...list, chords: updatedChords } : list
    );
    onUpdateLists(newLists);
  };

  const getChordColor = (idx: number) => CHORD_COLORS[idx % CHORD_COLORS.length];

  const addChord = () => {
    if (chords.length >= 8) return;
    const newChord: Chord = {
      id: Math.random().toString(36).substring(7),
      root: selectedRoot,
      type: selectedType,
      color: getChordColor(chords.length)
    };
    updateCurrentList([...chords, newChord]);
    setShowAddMenu(false);
  };

  const removeChord = (id: string) => {
    updateCurrentList(chords.filter(c => c.id !== id));
  };

  const onDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    e.dataTransfer.setDragImage(el, rect.width / 2, rect.height / 2);
  };

  const onDragOverItem = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null) return;
    if (idx !== dropTargetIdx) {
      setDropTargetIdx(idx);
    }
  };

  const onDragEnd = () => {
    setDraggedIdx(null);
    setDropTargetIdx(null);
  };

  const onDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) {
      setDraggedIdx(null);
      setDropTargetIdx(null);
      return;
    }
    const newChords = [...chords];
    const draggedItem = newChords.splice(draggedIdx, 1)[0];
    newChords.splice(targetIdx, 0, draggedItem);
    const reordered = newChords.map((c, i) => ({ ...c, color: getChordColor(i) }));
    updateCurrentList(reordered);
    setDraggedIdx(null);
    setDropTargetIdx(null);
  };

  // Detect Key from chords
  const calculateKeyMatchPercent = (root: string, mode: string, chs: Chord[]): number => {
    if (chs.length === 0) return 0;
    const keyRootIndex = NOTE_TO_INDEX[root.toLowerCase()] ?? NOTE_TO_INDEX[root];
    const keyScale = SCALES[mode];
    if (keyRootIndex === undefined || !keyScale) return 0;
    const keyNotes = new Set(keyScale.map(i => (keyRootIndex + i) % 12));
    let totalMatch = 0;
    chs.forEach(chord => {
      const chordRootIndex = NOTE_TO_INDEX[chord.root];
      const chordIntervals = CHORD_INTERVALS[chord.type] || [];
      let matchCount = 0;
      if (chordRootIndex !== undefined) {
        chordIntervals.forEach(interval => {
          if (keyNotes.has((chordRootIndex + interval) % 12)) matchCount++;
        });
        totalMatch += chordIntervals.length > 0 ? (matchCount / chordIntervals.length) : 0;
      }
    });
    return Math.round((totalMatch / chs.length) * 100);
  };

  const findBestKey = (chs: Chord[]): { root: string; mode: string; matchPercent: number } | null => {
    if (chs.length === 0) return null;

    let bestMatch = -1;
    let bestRoot = '';
    let bestMode = '';

    for (let i = 0; i < 12; i++) {
      const majorRoot = PREFERRED_ROOT_NAMES_MAJOR[i];
      const majorDisplay = majorRoot.charAt(0).toUpperCase() + majorRoot.slice(1);
      const majorMatch = calculateKeyMatchPercent(majorDisplay, 'Dur', chs);
      if (majorMatch > bestMatch) {
        bestMatch = majorMatch;
        bestRoot = majorDisplay;
        bestMode = 'Dur';
      }

      const minorRoot = PREFERRED_ROOT_NAMES_MINOR[i];
      const minorDisplay = minorRoot.charAt(0).toUpperCase() + minorRoot.slice(1);
      const variants = ['Moll (Natürlich)', 'Moll (Harmonisch)', 'Moll (Melodisch)'];
      for (const variant of variants) {
        const minorMatch = calculateKeyMatchPercent(minorDisplay, variant, chs);
        if (minorMatch > bestMatch) {
          bestMatch = minorMatch;
          bestRoot = minorDisplay;
          bestMode = variant;
        }
      }
    }
    return { root: bestRoot, mode: bestMode, matchPercent: bestMatch };
  };

  const bestKeyInfo = useMemo(() => {
    const best = findBestKey(chords);
    if (!best) return null;
    return {
      key: { root: best.root, mode: best.mode, confidence: best.matchPercent / 100, correlation: best.matchPercent / 100 },
      matchPercent: best.matchPercent
    };
  }, [chords]);

  const effectiveKeyInfo = useMemo(() => {
    if (!activeList.originalKeyRoot) return bestKeyInfo;
    const mode = activeList.originalIsMajor ? 'Dur' : (activeList.originalMinorVariant || 'Moll (Natürlich)');
    const matchPercent = calculateKeyMatchPercent(activeList.originalKeyRoot, mode, chords);
    return { key: { root: activeList.originalKeyRoot, mode }, matchPercent };
  }, [activeList.originalKeyRoot, activeList.originalIsMajor, activeList.originalMinorVariant, bestKeyInfo, chords]);

  const displayKeyRoot = activeList.originalKeyRoot || bestKeyInfo?.key.root || 'C';
  const displayIsMajor = activeList.originalKeyRoot !== undefined
    ? (activeList.originalIsMajor ?? true)
    : (bestKeyInfo?.key.mode === 'Dur');
  const displayMinorVariant = activeList.originalKeyRoot !== undefined
    ? (activeList.originalMinorVariant || 'Moll (Natürlich)')
    : (bestKeyInfo?.key.mode || 'Moll (Natürlich)');

  const hasOriginalKey = activeList.originalKeyRoot !== undefined;

  const fbMode = originalIsMajor ? 'Dur' : originalMinorVariant;
  const isAlreadyOnFingerboard = effectiveKeyInfo
    ? (originalRoot === effectiveKeyInfo.key.root && fbMode === effectiveKeyInfo.key.mode)
    : false;

  const showGriffbrettInfo = effectiveKeyInfo && (
    (originalRoot !== effectiveKeyInfo.key.root || fbMode !== effectiveKeyInfo.key.mode) ||
    (originalRoot === effectiveKeyInfo.key.root && fbMode === effectiveKeyInfo.key.mode && transpose !== 0)
  );
  const isDifferentKey = effectiveKeyInfo && (
    originalRoot !== effectiveKeyInfo.key.root || fbMode !== effectiveKeyInfo.key.mode
  );

  const handleApplyKey = () => {
    if (isAlreadyOnFingerboard) return;
    if (effectiveKeyInfo && onApplyKey) {
      onApplyKey(effectiveKeyInfo.key.root, effectiveKeyInfo.key.mode);
    }
  };

  const calculateChordMatch = (chord: Chord): number => {
    if (!effectiveKeyInfo) return 0;
    const keyRootIndex = NOTE_TO_INDEX[effectiveKeyInfo.key.root.toLowerCase()] ?? NOTE_TO_INDEX[effectiveKeyInfo.key.root];
    if (keyRootIndex === undefined) return 0;
    const keyScale = SCALES[effectiveKeyInfo.key.mode];
    if (!keyScale) return 0;
    
    const keyNotes = new Set(keyScale.map(i => (keyRootIndex + i) % 12));
    
    const chordRootIndex = NOTE_TO_INDEX[chord.root];
    if (chordRootIndex === undefined) return 0;
    const chordIntervals = CHORD_INTERVALS[chord.type] || [];
    
    let matchCount = 0;
    chordIntervals.forEach(interval => {
      if (keyNotes.has((chordRootIndex + interval) % 12)) {
        matchCount++;
      }
    });
    
    return chordIntervals.length > 0 ? Math.round((matchCount / chordIntervals.length) * 100) : 0;
  };

  const handleConfirmOriginalKey = () => {
    const newLists = chordLists.map(list =>
      list.id === activeListId
        ? { ...list, originalKeyRoot: tempOriginalRoot, originalIsMajor: tempOriginalIsMajor, originalMinorVariant: tempOriginalMinorVariant }
        : list
    );
    onUpdateLists(newLists);
    const mode = tempOriginalIsMajor ? 'Dur' : tempOriginalMinorVariant;
    onApplyKey?.(tempOriginalRoot, mode);
    setShowOriginalKeyPicker(false);
  };

  const handleResetOriginalKey = () => {
    const newLists = chordLists.map(list =>
      list.id === activeListId
        ? { ...list, originalKeyRoot: undefined, originalIsMajor: undefined, originalMinorVariant: undefined }
        : list
    );
    onUpdateLists(newLists);
  };

  const openOriginalKeyPicker = () => {
    setTempOriginalRoot(displayKeyRoot);
    setTempOriginalIsMajor(displayIsMajor);
    setTempOriginalMinorVariant(displayMinorVariant);
    setShowOriginalKeyPicker(true);
  };

  // --- List Management ---
  const handleCreateList = () => {
    const newList: ChordList = {
      id: Math.random().toString(36).substring(7),
      name: `Neues Lied ${chordLists.length + 1}`,
      chords: [],
      notes: ''
    };
    onUpdateLists([...chordLists, newList]);
    onSelectList(newList.id);
  };

  const handleDeleteList = () => {
    setConfirmDeleteId(null);
    const newLists = chordLists.filter(l => l.id !== activeListId);
    if (newLists.length === 0) {
      const defaultList: ChordList = {
        id: Math.random().toString(36).substring(7),
        name: 'Neues Lied',
        chords: [],
        notes: ''
      };
      onUpdateLists([defaultList]);
      onSelectList(defaultList.id);
    } else {
      onUpdateLists(newLists);
      onSelectList(newLists[0].id);
    }
  };

  const handleStartEditName = () => {
    setEditNameValue(activeList.name);
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    if (editNameValue.trim() !== '') {
      const newLists = chordLists.map(list => 
        list.id === activeListId ? { ...list, name: editNameValue.trim() } : list
      );
      onUpdateLists(newLists);
    }
    setIsEditingName(false);
  };

  const handleNotesChange = (value: string) => {
    const newLists = chordLists.map(list => 
      list.id === activeListId ? { ...list, notes: value } : list
    );
    onUpdateLists(newLists);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify([activeList], null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = activeList.name.replace(/[\\/:*?"<>|]/g, '_');
    link.download = `${safeName}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const applyImportedKey = (imported: ChordList) => {
    if (imported.originalKeyRoot) {
      const mode = imported.originalIsMajor ? 'Dur' : (imported.originalMinorVariant || 'Moll (Natürlich)');
      onApplyKey?.(imported.originalKeyRoot, mode);
    } else if (imported.chords.length > 0) {
      const best = findBestKey(imported.chords);
      if (best) {
        onApplyKey?.(best.root, best.mode);
      }
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allNormalized: ChordList[] = [];
    let fileCount = 0;
    let failCount = 0;

    for (const file of Array.from(files) as File[]) {
      fileCount++;
      try {
        const text = await file.text();
        const raw = JSON.parse(text);
        const items = Array.isArray(raw) ? raw : [raw];
        for (const item of items) {
          allNormalized.push({
            id: Math.random().toString(36).substring(7),
            name: item.name || 'Importiertes Lied',
            chords: Array.isArray(item.chords) ? item.chords : [],
            notes: typeof item.notes === 'string' ? item.notes : '',
            originalKeyRoot: item.originalKeyRoot,
            originalIsMajor: item.originalIsMajor,
            originalMinorVariant: item.originalMinorVariant,
          });
        }
      } catch {
        failCount++;
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';

    if (allNormalized.length === 0) {
      setNotification(`Keine gültigen Daten in ${fileCount} Datei${fileCount !== 1 ? 'en' : ''} gefunden.`);
      return;
    }

    const failMsg = failCount > 0
      ? `${failCount} Datei${failCount !== 1 ? 'en' : ''} konnten nicht gelesen werden. `
      : '';
    setNotification(`${failMsg}${allNormalized.length} Lied${allNormalized.length !== 1 ? 'er' : ''} aus ${fileCount} Datei${fileCount !== 1 ? 'en' : ''} erfolgreich importiert.`);

    const currentIsEmpty = activeList.chords.length === 0 && !activeList.notes;
    if (currentIsEmpty) {
      const [first, ...rest] = allNormalized;
      const updatedLists = chordLists.map(l =>
        l.id === activeListId ? { ...first, id: activeListId } : l
      );
      onUpdateLists(rest.length > 0 ? [...updatedLists, ...rest] : updatedLists);
      applyImportedKey(first);
    } else {
      onUpdateLists([...chordLists, ...allNormalized]);
      onSelectList(allNormalized[0].id);
    }
  };

  return (
    <>
    {notification && (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-slate-600 text-slate-200 px-4 py-2 rounded-lg shadow-xl text-xs font-medium animate-in fade-in slide-in-from-top-2">
        {notification}
      </div>
    )}
    <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 shadow-xl flex-1 flex flex-col min-h-[400px]">
      
      {/* List Header & Controls */}
      <div className="flex flex-col gap-3 mb-4 pb-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
             <List size={16} className="text-amber-500" />
             <select 
                value={activeListId} 
                onChange={(e) => onSelectList(e.target.value)}
                className="bg-slate-800 text-slate-200 text-sm rounded px-2 py-1 border border-slate-700 focus:outline-none focus:border-amber-500 flex-1 min-w-0"
             >
                {chordLists.map(list => (
                  <option key={list.id} value={list.id}>{list.name}</option>
                ))}
             </select>
          </div>
          <div className="flex items-center gap-1 ml-2">
             <button onClick={handleCreateList} className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors" title="Neues Lied erstellen">
                <Plus size={14} />
             </button>
              {confirmDeleteId === activeListId ? (
                 <div className="flex items-center gap-1">
                   <button onClick={handleDeleteList} className="px-1.5 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] font-bold transition-colors">Ja</button>
                   <button onClick={() => setConfirmDeleteId(null)} className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-400 text-[10px] transition-colors">Nein</button>
                 </div>
              ) : (
                 <button onClick={() => setConfirmDeleteId(activeListId)} className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors" title="Aktuelles Lied löschen">
                   <Trash2 size={14} />
                 </button>
              )}
          </div>
        </div>

        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2 flex-1">
              {isEditingName ? (
                <div className="flex items-center gap-1 w-full">
                  <input 
                    type="text" 
                    value={editNameValue} 
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    className="bg-slate-800 text-slate-100 text-sm rounded px-2 py-1 w-full focus:outline-none border border-amber-500/50"
                    autoFocus
                  />
                  <button onClick={handleSaveName} className="p-1 text-emerald-400 hover:bg-emerald-400/20 rounded">
                    <Check size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group cursor-pointer" onClick={handleStartEditName}>
                  <span className="font-bold text-slate-100">{activeList.name}</span>
                  <Edit2 size={12} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
           </div>
           
           <div className="flex items-center gap-1">
              <button onClick={handleExport} className="p-1 text-slate-400 hover:text-slate-200" title="Akkorde exportieren">
                <Download size={14} />
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="p-1 text-slate-400 hover:text-slate-200" title="Akkorde importieren">
                <Upload size={14} />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" multiple className="hidden" />
           </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-slate-500" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Akkorde ({chords.length}/8)</span>
        </div>
        {chords.length < 8 && !showAddMenu && (
          <button 
            onClick={() => setShowAddMenu(true)}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1"
          >
            <Plus size={14} /> <span className="text-xs pr-1">Hinzufügen</span>
          </button>
        )}
      </div>
      
      <div className="bg-slate-800/60 rounded-xl p-3 mb-4 border border-slate-700/50">
        {bestKeyInfo ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div>
                  <div className={`text-[10px] uppercase tracking-wider font-semibold mb-0.5 ${hasOriginalKey ? 'text-slate-500' : 'text-amber-400'}`}>Erkannte Tonart</div>
                  <span className={`text-sm font-bold ${hasOriginalKey ? 'text-slate-500' : 'text-amber-400'}`}>
                    {bestKeyInfo.key.root} {bestKeyInfo.key.mode} <span className="text-xs font-normal opacity-70 ml-0.5">({bestKeyInfo.matchPercent}%)</span>
                  </span>
                </div>
                <div className="flex items-start gap-1">
                  <button
                    onClick={openOriginalKeyPicker}
                    className="group flex flex-col items-start rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 hover:bg-slate-700/40 transition-colors cursor-pointer"
                    title="Original-Tonart festlegen"
                  >
                    <div className={`text-[10px] uppercase tracking-wider font-semibold mb-0.5 flex items-center gap-1 ${hasOriginalKey ? 'text-emerald-400' : 'text-slate-500'}`}>
                      Original-Tonart
                      <Edit2 size={9} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {hasOriginalKey && effectiveKeyInfo ? (
                      <span className="text-sm font-bold text-emerald-400">
                        {effectiveKeyInfo.key.root} {effectiveKeyInfo.key.mode} <span className="text-xs font-normal text-emerald-500/70 ml-0.5">({effectiveKeyInfo.matchPercent}%)</span>
                      </span>
                    ) : (
                      <span className="text-sm text-slate-600">—</span>
                    )}
                  </button>
                  {hasOriginalKey && (
                    <button
                      onClick={handleResetOriginalKey}
                      className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
                      title="Zur erkannten Tonart zurück"
                    >
                      <RotateCcw size={11} />
                    </button>
                  )}
                </div>
              {showGriffbrettInfo && (
                <div>
                  <div className={`text-[10px] uppercase tracking-wider font-semibold mb-0.5 ${isDifferentKey ? 'text-red-400' : 'text-slate-500'}`}>Griffbrett</div>
                  <span className={`text-sm font-bold ${isDifferentKey ? 'text-red-400' : 'text-slate-300'}`}>{currentKeyRoot} {fbMode}</span>
                </div>
              )}
              </div>
              {onApplyKey && effectiveKeyInfo && (
                <button 
                  onClick={handleApplyKey}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors border shrink-0 ${isAlreadyOnFingerboard ? 'opacity-30 pointer-events-none' : ''} ${hasOriginalKey ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20'}`}
                >
                  <span className="text-xs font-bold">Übernehmen</span>
                  <ArrowRightCircle size={14} />
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
              <button
                onClick={openOriginalKeyPicker}
                className="group flex flex-col items-start rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 hover:bg-slate-700/40 transition-colors cursor-pointer"
                title="Original-Tonart festlegen"
              >
                <div className={`text-[10px] uppercase tracking-wider font-semibold mb-0.5 flex items-center gap-1 ${hasOriginalKey && effectiveKeyInfo ? 'text-emerald-400' : 'text-slate-500'}`}>
                  Original-Tonart
                  <Edit2 size={9} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                </div>
                {hasOriginalKey && effectiveKeyInfo ? (
                  <span className="text-sm font-bold text-emerald-400">
                    {effectiveKeyInfo.key.root} {effectiveKeyInfo.key.mode}
                  </span>
                ) : (
                  <span className="text-sm text-slate-600">—</span>
                )}
              </button>
              {showGriffbrettInfo && (
                <div>
                  <div className={`text-[10px] uppercase tracking-wider font-semibold mb-0.5 ${isDifferentKey ? 'text-red-400' : 'text-slate-500'}`}>Griffbrett</div>
                  <span className={`text-sm font-bold ${isDifferentKey ? 'text-red-400' : 'text-slate-300'}`}>{currentKeyRoot} {fbMode}</span>
                </div>
              )}
              </div>
              <div className="flex items-center gap-1">
                {hasOriginalKey && (
                  <button
                    onClick={handleResetOriginalKey}
                    className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
                    title="Zurücksetzen"
                  >
                    <RotateCcw size={11} />
                  </button>
                )}
                {onApplyKey && hasOriginalKey && effectiveKeyInfo && (
                  <button 
                    onClick={handleApplyKey}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors border shrink-0 ${isAlreadyOnFingerboard ? 'opacity-30 pointer-events-none' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'}`}
                  >
                    <span className="text-xs font-bold">Übernehmen</span>
                    <ArrowRightCircle size={14} />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {showAddMenu && (
        <div className="bg-slate-800/80 rounded-xl p-3 mb-4 animate-in fade-in slide-in-from-top-2 border border-slate-700">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase">Neuer Akkord</h4>
            <button onClick={() => setShowAddMenu(false)} className="text-slate-400 hover:text-white">
              <X size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-[10px] text-slate-400 mb-1">Grundton</div>
              <div className="flex flex-wrap gap-1">
                {ROOT_NOTES.map(r => (
                  <button 
                    key={r} 
                    onClick={() => setSelectedRoot(r)}
                    className={`px-2 py-1 text-xs rounded font-medium border ${selectedRoot === r ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 mb-1">Akkordtyp</div>
              <div className="flex flex-wrap gap-1">
                {CHORD_TYPES.map(t => (
                  <button 
                    key={t} 
                    onClick={() => setSelectedType(t)}
                    className={`px-2 py-1 text-xs rounded font-medium border ${selectedType === t ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <button 
              onClick={addChord}
              className="mt-2 w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm rounded transition-colors"
            >
              Hinzufügen
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 no-scrollbar pb-10">
        {chords.length === 0 && !showAddMenu && (
           <div className="flex-1 flex items-center justify-center opacity-30 text-slate-500 flex-col gap-2">
             <Music size={48} />
             <p className="text-sm font-medium">Keine Akkorde ausgewählt</p>
             <p className="text-xs text-center max-w-[200px]">Klicke auf das Plus-Symbol, um Akkorde zum Üben hinzuzufügen.</p>
           </div>
        )}
        
        {chords.map((chord, idx) => {
          const matchPercent = calculateChordMatch(chord);
          const transposedRoot = getTransposedChordRoot(chord.root);
          const isDragged = draggedIdx === idx;
          const isDropTarget = dropTargetIdx === idx && draggedIdx !== null && draggedIdx !== idx;
          const gapAbove = isDropTarget && draggedIdx !== null && draggedIdx > idx;
          const gapBelow = isDropTarget && draggedIdx !== null && draggedIdx < idx;
          
          return (
            <React.Fragment key={chord.id}>
              {gapAbove && (
                <div className="h-2 bg-amber-500/30 rounded-full mx-2 animate-pulse" />
              )}
              <div 
                draggable
                onDragStart={(e) => onDragStart(e, idx)}
                onDragOver={(e) => onDragOverItem(e, idx)}
                onDragEnd={onDragEnd}
                onDrop={(e) => onDrop(e, idx)}
                className={`flex flex-col bg-slate-800 rounded-xl border-l-[6px] border-r border-t border-b overflow-hidden shadow-md transition-all duration-200 ${isDragged ? 'opacity-30 scale-95' : 'opacity-100 scale-100'} ${gapAbove ? 'mt-3' : ''} ${gapBelow ? 'mb-3' : ''}`}
                style={{ borderLeftColor: CHORD_COLORS[idx % CHORD_COLORS.length], borderTopColor: '#334155', borderRightColor: '#334155', borderBottomColor: '#334155' }}
              >
                <div className="flex items-center justify-between px-3 py-2 bg-slate-800/50">
                   <div className="flex items-center gap-2">
                      <div className={`${isDragged ? 'cursor-grabbing' : 'cursor-grab'} text-slate-500 hover:text-slate-300`}>
                        <GripVertical size={16} />
                      </div>
                       <div className="font-bold text-slate-100 text-lg flex items-baseline gap-1">
                          {transpose === 0 ? (
                            <>{adjustChordRoot(chord.root)}</>
                          ) : (
                            <span className="flex items-center gap-1">
                              <span className="text-slate-400">{adjustChordRoot(chord.root)} {chord.type}</span>
                              <ArrowRight size={14} className="text-slate-500" />
                              <span>{adjustChordRoot(transposedRoot)} {chord.type}</span>
                            </span>
                          )}
                          {transpose === 0 && <span className="text-sm font-medium text-slate-400">{chord.type}</span>}
                       </div>
                   </div>
                   <div className="flex items-center gap-3">
                      {bestKeyInfo && (
                        <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${matchPercent === 100 ? 'bg-emerald-500/20 text-emerald-400' : matchPercent >= 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                          {matchPercent}%
                        </div>
                      )}
                      <button onClick={() => removeChord(chord.id)} className="text-slate-500 hover:text-red-400 transition-colors">
                          <X size={16} />
                      </button>
                   </div>
                </div>
                <div className="bg-[#fdf6e3] h-[120px] overflow-hidden relative">
                   <div className="absolute inset-0 flex items-center justify-center origin-center mt-[-5px]">
                     <ScaleNotation 
                         rootName={adjustChordRoot(transposedRoot)} 
                        intervals={CHORD_INTERVALS[chord.type]} 
                        diatonicSteps={CHORD_DIATONIC_STEPS[chord.type]}
                        keySignatureCount={keySignatureCount}
                        modeLabel=""
                        hideBackground={true}
                        hideRootHighlight={false}
                        arpeggio={true}
                        keyRootName={currentKeyRoot}
                        keyIntervals={currentKeyIntervals}
                     />
                   </div>
                </div>
              </div>
              {gapBelow && (
                <div className="h-2 bg-amber-500/30 rounded-full mx-2 animate-pulse" />
              )}
            </React.Fragment>
          );
        })}
        
        <div className="mt-4 pt-4 border-t border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <StickyNote size={14} className="text-amber-500" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Notizen</span>
          </div>
          <textarea
            value={activeList.notes || ''}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Notizen zum Lied..."
            className="w-full bg-slate-800/80 text-slate-200 text-sm rounded-lg border border-slate-700 p-3 resize-y min-h-[80px] placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-colors"
            rows={3}
          />
        </div>
      </div>
    </div>

    {showOriginalKeyPicker && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowOriginalKeyPicker(false)}>
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl p-4 w-[420px] max-w-[95vw]" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-200">Original-Tonart festlegen</h3>
            <button onClick={() => setShowOriginalKeyPicker(false)} className="text-slate-400 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
          <FingerboardControls
            root={tempOriginalRoot}
            isMajor={tempOriginalIsMajor}
            minorVariant={tempOriginalMinorVariant}
            transpose={0}
            onRootChange={setTempOriginalRoot}
            onModeChange={setTempOriginalIsMajor}
            onVariantChange={setTempOriginalMinorVariant}
            onTransposeChange={() => {}}
            getRelativeMinorLabel={getRelativeMinorLabel}
            formatNoteLabel={formatNoteLabel}
            hideTranspose={true}
            compact={true}
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowOriginalKeyPicker(false)}
              className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-bold transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleConfirmOriginalKey}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg text-xs font-bold transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default ChordManager;
