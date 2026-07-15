
import { NoteConfig } from './types';

// Standard frequency for A4
export const DEFAULT_A4_FREQ = 440;

// Relative semitones from A4 (0) for the UI buttons (Violin Strings)
export const VIOLIN_SCALE = [
  { name: 'G3', semitones: -14, description: 'Die tiefste Saite' },
  { name: 'D4', semitones: -7, description: 'Die warme, resonante Saite' },
  { name: 'A4', semitones: 0, description: 'Die Referenzsaite' },
  { name: 'E5', semitones: 7, description: 'Die höchste, brillante Saite' },
];

// German Note Names (Sharps default)
// A, Ais (Bb), H (B natural), C, Cis, D, Dis (Es), E, F, Fis, G, Gis
export const GERMAN_NOTE_NAMES = [
  'A', 'Ais', 'H', 'C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis'
];

// German Note Names (Flats)
// A, B (Bb), H (B), C, Des, D, Es, E, F, Ges, G, As
export const GERMAN_NOTE_NAMES_FLAT = [
  'A', 'B', 'H', 'C', 'Des', 'D', 'Es', 'E', 'F', 'Ges', 'G', 'As'
];

// Preferred Display Names for Roots (Index 0-11)
// Handles "kein Ais, sondern B" and enharmonic context (Des vs Cis)
export const PREFERRED_ROOT_NAMES_MAJOR = [
  'A',   // 0
  'B',   // 1 (Bb) - User wants B
  'H',   // 2 (B)
  'C',   // 3
  'Des', // 4 (Db) - Prefer Flat for Major
  'D',   // 5
  'Es',  // 6 (Eb) - Prefer Flat for Major
  'E',   // 7
  'F',   // 8
  'Fis', // 9 (F#) - Prefer Sharp for Major (standard violin)
  'G',   // 10
  'As'   // 11 (Ab) - Prefer Flat for Major
];

export const PREFERRED_ROOT_NAMES_MINOR = [
  'a',   // 0
  'b',   // 1 (Bb min) - User wants b
  'h',   // 2 (B min)
  'c',   // 3
  'cis', // 4 (C# min) - Prefer Sharp (rel E Maj)
  'd',   // 5
  'es',  // 6 (Eb min) - Prefer Flat (rel Gb Maj) or Sharp (Dis rel F#)? Es is standard German.
  'e',   // 7
  'f',   // 8
  'fis', // 9 (F# min)
  'g',   // 10
  'gis'  // 11 (G# min) - Prefer Sharp (rel H Maj) over Ab min
];

// Mapping to determine if a Major Root uses Flats or Sharps
// True = Use Flats, False = Use Sharps
export const KEY_ACCIDENTALS: { [key: string]: boolean } = {
  'C': false,
  'F': true,   // 1b
  'B': true,   // 2b (German B = Bb)
  'Es': true,  // 3b
  'As': true,  // 4b
  'Des': true, // 5b
  'Ges': true, // 6b
  'Ces': true, // 7b
  'G': false,  // 1#
  'D': false,  // 2#
  'A': false,  // 3#
  'E': false,  // 4#
  'H': false,  // 5#
  'Fis': false,// 6#
  'Cis': false,// 7#
  'Gis': false // 8# (theoretical/relative)
};

// Modified list to prefer Des/Es/As over Cis/Dis/Gis for cleaner signatures
// Used for fallback iteration
export const ROOT_NOTES = [
  'C', 'Des', 'D', 'Es', 'E', 'F', 'Fis', 'G', 'As', 'A', 'B', 'H'
];

export const SCALES: { [key: string]: number[] } = {
  'Dur': [0, 2, 4, 5, 7, 9, 11],
  'Moll (Natürlich)': [0, 2, 3, 5, 7, 8, 10],   // W H W W H W W
  'Moll (Harmonisch)': [0, 2, 3, 5, 7, 8, 11],  // Raised 7th
  'Moll (Melodisch)': [0, 2, 3, 5, 7, 9, 11]    // Raised 6th & 7th (Ascending)
};

export const CHORD_INTERVALS: { [key: string]: number[] } = {
  'Dur': [0, 4, 7],
  'Moll': [0, 3, 7],
  '7': [0, 4, 7, 10],
  'maj7': [0, 4, 7, 11],
  'm7': [0, 3, 7, 10],
  'm7b5': [0, 3, 6, 10],
  'dim': [0, 3, 6],
  'aug': [0, 4, 8],
  'sus4': [0, 5, 7],
  'sus2': [0, 2, 7]
};

export const CHORD_COLORS = [
  '#22c55e', // green-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#84cc16', // lime-500
  '#14b8a6', // teal-500
  '#6366f1', // indigo-500
];

export const CHORD_DIATONIC_STEPS: { [key: string]: number[] } = {
  'Dur': [0, 2, 4],
  'Moll': [0, 2, 4],
  '7': [0, 2, 4, 6],
  'maj7': [0, 2, 4, 6],
  'm7': [0, 2, 4, 6],
  'm7b5': [0, 2, 4, 6],
  'dim': [0, 2, 4],
  'aug': [0, 2, 4],
  'sus4': [0, 3, 4],
  'sus2': [0, 1, 4]
};

export const AUDIO_CONTEXT_CONFIG = {
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
};

// Krumhansl-Schmuckler Key-Finding Profiles
export const MAJOR_PROFILE = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88
];

export const MINOR_PROFILE = [
  6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17
];

// Map root note names to their semitone index relative to A=0
export const NOTE_TO_INDEX: { [key: string]: number } = {
  'A': 0, 'a': 0, 
  'Ais': 1, 'ais': 1, 'B': 1, 'b': 1, 
  'H': 2, 'h': 2, 
  'C': 3, 'c': 3, 
  'Cis': 4, 'cis': 4, 'Des': 4, 'des': 4, 
  'D': 5, 'd': 5, 
  'Dis': 6, 'dis': 6, 'Es': 6, 'es': 6,
  'E': 7, 'e': 7, 
  'F': 8, 'f': 8, 
  'Fis': 9, 'fis': 9, 'Ges': 9, 'ges': 9, 
  'G': 10, 'g': 10, 
  'Gis': 11, 'gis': 11, 'As': 11, 'as': 11
};

// Map of Major Keys to Accidental Count
// Positive = Sharps, Negative = Flats
export const MAJOR_KEY_SIGNATURES: { [key: string]: number } = {
  'C': 0,
  'G': 1, 'D': 2, 'A': 3, 'E': 4, 'H': 5, 'Fis': 6, 'Cis': 7, 'Gis': 8,
  'F': -1, 'B': -2, 'Es': -3, 'As': -4, 'Des': -5, 'Ges': -6, 'Ces': -7
};

// Relative Minor to Major Mapping for Signature Lookup
// Key is LOWERCASE root
export const MINOR_TO_MAJOR_ROOT: { [key: string]: string } = {
  'a': 'C', 'e': 'G', 'h': 'D', 'fis': 'A', 'cis': 'E', 'gis': 'H', 'dis': 'Fis', 'ais': 'Cis',
  'd': 'F', 'g': 'B', 'c': 'Es', 'f': 'As', 'b': 'Des', 'es': 'Ges'
};

// Helper: Transpose a note name by N semitones
export const getTransposedNote = (root: string, semitones: number): string => {
  const index = NOTE_TO_INDEX[root];
  if (index === undefined) return root;
  
  const newIndex = (index + semitones + 24) % 12;
  // This is a rough return, UI should use PREFERRED_ROOT_NAMES_* for display
  return GERMAN_NOTE_NAMES[newIndex];
};
