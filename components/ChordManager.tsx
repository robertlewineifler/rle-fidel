import React, { useState, useMemo, useRef } from 'react';
import { Layers, Plus, X, GripVertical, Music, ArrowRightCircle, Download, Upload, Edit2, Check, Trash2, List, ArrowRight, StickyNote } from 'lucide-react';
import { Chord, KeyResult, ChordList } from '../types';
import { ROOT_NOTES, CHORD_INTERVALS, MAJOR_KEY_SIGNATURES, CHORD_DIATONIC_STEPS, NOTE_TO_INDEX, SCALES, PREFERRED_ROOT_NAMES_MAJOR, CHORD_COLORS } from '../constants';
import ScaleNotation from './ScaleNotation';
import { KeyDetector } from '../services/keyDetector';

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
  const bestKeyInfo = useMemo(() => {
    if (chords.length === 0) return null;
    const noteCounts = new Array(12).fill(0);
    chords.forEach(chord => {
      const rootIndex = NOTE_TO_INDEX[chord.root];
      const intervals = CHORD_INTERVALS[chord.type];
      if (rootIndex !== undefined && intervals) {
        intervals.forEach(interval => {
          const noteIndex = (rootIndex + interval) % 12;
          noteCounts[noteIndex] += 10; // Multiply by 10 to satisfy totalSamples >= 5 in KeyDetector
        });
      }
    });
    const results = KeyDetector.detectKey(noteCounts);
    if (results.length === 0) return null;
    const bestKey = results[0];

    // Calculate average chord match for a more logical percentage
    let totalMatch = 0;
    const keyRootIndex = NOTE_TO_INDEX[bestKey.root.toLowerCase()] ?? NOTE_TO_INDEX[bestKey.root];
    const keyScale = SCALES[bestKey.mode];
    if (keyRootIndex !== undefined && keyScale) {
        const keyNotes = new Set(keyScale.map(i => (keyRootIndex + i) % 12));
        chords.forEach(chord => {
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
    }
    const avgMatch = chords.length > 0 ? Math.round((totalMatch / chords.length) * 100) : 0;

    return { key: bestKey, matchPercent: avgMatch };
  }, [chords]);

  const handleApplyKey = () => {
    if (bestKeyInfo && onApplyKey) {
      onApplyKey(bestKeyInfo.key.root, bestKeyInfo.key.mode);
    }
  };

  const calculateChordMatch = (chord: Chord): number => {
    if (!bestKeyInfo) return 0;
    const keyRootIndex = NOTE_TO_INDEX[bestKeyInfo.key.root.toLowerCase()] ?? NOTE_TO_INDEX[bestKeyInfo.key.root];
    if (keyRootIndex === undefined) return 0;
    const keyScale = SCALES[bestKeyInfo.key.mode];
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
    if (chordLists.length <= 1) return;
    const newLists = chordLists.filter(l => l.id !== activeListId);
    onUpdateLists(newLists);
    onSelectList(newLists[0].id);
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
    const dataStr = JSON.stringify(chordLists, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = activeList.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${safeName}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = JSON.parse(event.target?.result as string);
        if (!Array.isArray(raw) || raw.length === 0) {
          alert('Ungültiges Dateiformat.');
          return;
        }
        const normalized: ChordList[] = raw.map((item: any) => ({
          id: item.id || Math.random().toString(36).substring(7),
          name: item.name || 'Importiertes Lied',
          chords: Array.isArray(item.chords) ? item.chords : [],
          notes: typeof item.notes === 'string' ? item.notes : '',
        }));
        onUpdateLists(normalized);
        onSelectList(normalized[0].id);
      } catch (error) {
        alert('Fehler beim Importieren der Datei.');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
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
             <button onClick={handleDeleteList} disabled={chordLists.length <= 1} className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors disabled:opacity-30" title="Aktuelles Lied löschen">
                <Trash2 size={14} />
             </button>
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
              <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
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
      
      {bestKeyInfo && (
        <div className="bg-slate-800/60 rounded-xl p-3 mb-4 flex items-center justify-between border border-slate-700/50">
           <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">Passende Tonart</div>
              <div className="text-sm font-bold text-emerald-400">
                {bestKeyInfo.key.root} {bestKeyInfo.key.mode} <span className="text-xs font-normal text-emerald-500/70 ml-1">({bestKeyInfo.matchPercent}%)</span>
              </div>
           </div>
           {onApplyKey && (
             <button 
                onClick={handleApplyKey}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors border border-emerald-500/20"
             >
                <span className="text-xs font-bold">Übernehmen</span>
                <ArrowRightCircle size={14} />
             </button>
           )}
        </div>
      )}

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
                className={`flex flex-col bg-slate-800 rounded-xl border-l-4 border-r border-t border-b overflow-hidden shadow-md transition-all duration-200 ${isDragged ? 'opacity-30 scale-95' : 'opacity-100 scale-100'} ${gapAbove ? 'mt-3' : ''} ${gapBelow ? 'mb-3' : ''}`}
                style={{ borderLeftColor: CHORD_COLORS[idx % CHORD_COLORS.length], borderTopColor: '#334155', borderRightColor: '#334155', borderBottomColor: '#334155' }}
              >
                <div className="flex items-center justify-between px-3 py-2 bg-slate-800/50">
                   <div className="flex items-center gap-2">
                      <div className={`${isDragged ? 'cursor-grabbing' : 'cursor-grab'} text-slate-500 hover:text-slate-300`}>
                        <GripVertical size={16} />
                      </div>
                      <div className="font-bold text-slate-100 text-lg flex items-baseline gap-1">
                         {transpose === 0 ? (
                           <>{chord.root}</>
                         ) : (
                           <span className="flex items-center gap-1">
                             <span className="text-slate-400">{chord.root} {chord.type}</span>
                             <ArrowRight size={14} className="text-slate-500" />
                             <span>{transposedRoot} {chord.type}</span>
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
                        rootName={transposedRoot} 
                        intervals={CHORD_INTERVALS[chord.type]} 
                        diatonicSteps={CHORD_DIATONIC_STEPS[chord.type]}
                        keySignatureCount={keySignatureCount}
                        modeLabel=""
                        highlightNoteName={currentKeyRoot}
                        hideBackground={true}
                        hideRootHighlight={true}
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
  );
};

export default ChordManager;
