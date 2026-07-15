
import { MAJOR_PROFILE, MINOR_PROFILE, PREFERRED_ROOT_NAMES_MAJOR, PREFERRED_ROOT_NAMES_MINOR } from '../constants';

export interface KeyResult {
  root: string;
  mode: string; // 'Dur' | 'Moll (Natürlich)' | etc.
  confidence: number; // 0 to 1
  correlation: number;
}

export class KeyDetector {
  /**
   * Calculates the most likely keys based on the distribution of played notes.
   * Returns sorted list of candidates with improved confidence calculation.
   */
  static detectKey(noteCounts: number[]): KeyResult[] {
    const totalSamples = noteCounts.reduce((a, b) => a + b, 0);
    if (totalSamples < 5) return [];

    const results: KeyResult[] = [];

    // 1. Calculate raw correlations for all 24 basic keys (Major & Generic Minor)
    for (let i = 0; i < 12; i++) {
      // Major
      const majorCorr = this.calculateCorrelation(noteCounts, MAJOR_PROFILE, i);
      // Use Preferred Name (e.g., 'B' instead of 'Ais')
      const majorRoot = PREFERRED_ROOT_NAMES_MAJOR[i];
      // Capitalize first letter for consistency with UI title display
      const displayMajorRoot = majorRoot.charAt(0).toUpperCase() + majorRoot.slice(1);
      
      results.push({ root: displayMajorRoot, mode: 'Dur', correlation: majorCorr, confidence: 0 });

      // Minor (Generic detection using Natural profile first)
      const minorCorr = this.calculateCorrelation(noteCounts, MINOR_PROFILE, i);
      
      // Determine specific minor flavor
      const minorVariant = this.determineMinorVariant(noteCounts, i);
      
      // Use Preferred Name (e.g., 'cis' instead of 'des' or 'cis' for minor context)
      const minorRoot = PREFERRED_ROOT_NAMES_MINOR[i];
      // Capitalize first letter for consistency with UI title display (e.g. "Cis")
      // The UI can lowercase it later if it wants strictly "cis Moll"
      const displayMinorRoot = minorRoot.charAt(0).toUpperCase() + minorRoot.slice(1);

      results.push({ root: displayMinorRoot, mode: minorVariant, correlation: minorCorr, confidence: 0 });
    }

    // 2. Filter out negative correlations and sort
    const validResults = results
        .filter(r => r.correlation > 0)
        .sort((a, b) => b.correlation - a.correlation);

    if (validResults.length === 0) return [];

    // 3. Normalize Scores based on the top candidates
    const topCandidates = validResults.slice(0, 5);

    // 4. Data Sufficiency Factor
    // 50 samples is our threshold for 100% sufficiency.
    const dataSufficiency = Math.min(1.0, Math.max(0, (totalSamples - 5) / 45));

    // 5. Assign Confidence
    validResults.forEach(r => {
      const inTopGroup = topCandidates.includes(r);
      
      if (inTopGroup) {
        // Map correlation (typically 0.4 to 0.9) to a 0-1 scale more aggressively
        let baseConf = Math.max(0, (r.correlation - 0.2) / 0.65);
        let calculatedConf = baseConf * dataSufficiency;
        calculatedConf = Math.min(1.0, calculatedConf);
        r.confidence = calculatedConf;
      } else {
        r.confidence = 0;
      }
    });

    validResults.sort((a, b) => b.confidence - a.confidence);

    return validResults;
  }

  /**
   * Analyzes the presence of the 6th and 7th degrees relative to the minor root
   * to determine if it is Natural, Harmonic, or Melodic.
   */
  private static determineMinorVariant(noteCounts: number[], rootIndex: number): string {
    // Indices relative to root
    // Natural Minor:  Root, M2, m3, P4, P5, m6, m7
    // Harmonic Minor: Root, M2, m3, P4, P5, m6, M7 (Raised 7)
    // Melodic Minor:  Root, M2, m3, P4, P5, M6, M7 (Raised 6 & 7)

    const minor6Index = (rootIndex + 8) % 12;
    const major6Index = (rootIndex + 9) % 12;
    const minor7Index = (rootIndex + 10) % 12;
    const major7Index = (rootIndex + 11) % 12;

    const countm6 = noteCounts[minor6Index];
    const countM6 = noteCounts[major6Index];
    const countm7 = noteCounts[minor7Index];
    const countM7 = noteCounts[major7Index];

    // Simple score comparison
    const scoreNatural = countm6 + countm7;
    const scoreHarmonic = countm6 + countM7;
    const scoreMelodic = countM6 + countM7;

    if (scoreHarmonic > scoreNatural && scoreHarmonic > scoreMelodic) {
        return 'Moll (Harmonisch)';
    }
    if (scoreMelodic > scoreNatural && scoreMelodic > scoreHarmonic) {
        return 'Moll (Melodisch)';
    }
    return 'Moll (Natürlich)';
  }

  static estimateReferencePitch(avgCentsDeviation: number): number {
    return Math.round(440 * Math.pow(2, avgCentsDeviation / 1200));
  }

  private static calculateCorrelation(input: number[], profile: number[], rootOffset: number): number {
    let sumProduct = 0;
    let sumInputSq = 0;
    let sumProfileSq = 0;
    
    const inputMean = input.reduce((a,b) => a+b, 0) / 12;
    const profileMean = profile.reduce((a,b) => a+b, 0) / 12;

    for (let k = 0; k < 12; k++) {
      const interval = (k - rootOffset + 12) % 12;
      
      const x = input[k] - inputMean;
      const y = profile[interval] - profileMean;
      
      sumProduct += x * y;
      sumInputSq += x * x;
      sumProfileSq += y * y;
    }
    
    if (sumInputSq === 0 || sumProfileSq === 0) return 0;
    
    return sumProduct / Math.sqrt(sumInputSq * sumProfileSq);
  }
}
