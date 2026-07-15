
export interface NoteConfig {
  name: string;
  frequency: number;
  description?: string;
}

export interface TunerStatus {
  noteName: string | null;
  cents: number;
  frequency: number;
  volume: number;
  isSilent: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface KeyResult {
  root: string;
  mode: string;
  confidence: number;
  correlation: number;
}

export interface Chord {
  id: string;
  root: string;
  type: string;
  color: string;
}

export interface ChordList {
  id: string;
  name: string;
  chords: Chord[];
  notes: string;
}

export interface HistoryItem {
  id: string;
  file: File;
  detectedKey: KeyResult | null;
  noteCounts: number[]; // Store statistics
  timestamp: Date;
  source: 'recording' | 'upload';
}
